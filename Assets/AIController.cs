using UnityEngine;
using UnityEngine.Networking;
using System.Text;
using System.Collections;
using System.Collections.Generic;
using TMPro;

public class AIController : MonoBehaviour
{
    [Header("API KEYS")]
    public AIKeys keys; // Ensure you have your AIKeys script or struct set up

    [Header("UI CONNECTIONS")]
    public TMP_InputField inputField;
    public TextMeshProUGUI speechBubbleText;

    [Header("CHARACTER SETTINGS")]
    public List<GameObject> puppetBodies; 
    public SkinnedMeshRenderer faceMesh;

    [Header("JAW & LIP SYNC")]
    public Transform jawBoneToLock; 
    public bool lockJaw = true;
    public Vector3 jawClosedRotation = new Vector3(-57, 100, 80); 
    
    [Range(100, 5000)] public float lipSyncSensitivity = 2000.0f; 
    [Range(0, 0.05f)] public float audioThreshold = 0.001f; 
    
    // HARDCODED DEFAULT
    public string mouthOpenBlendShape = "jawOpen"; 

    private string modelName = "openai/gpt-4o-mini";
    private AudioSource audioSource;
    private Coroutine currentExpressionRoutine;

    // --- MEMORY SYSTEM ---
    private List<Message> chatHistory = new List<Message>();
    private int maxHistory = 30; // Increased slightly since we are saving to file

    void Start() {
        Debug.Log(">> SYSTEM STARTUP: STRATEGIC PIVOT & MEMORY SYSTEMS ACTIVE.");
        
        audioSource = GetComponent<AudioSource>();
        if (audioSource == null) audioSource = gameObject.AddComponent<AudioSource>();

        if(inputField != null) {
            inputField.onSubmit.RemoveAllListeners();
            inputField.onSubmit.AddListener(delegate { TalkToHer(inputField.text); });
        }

        // 1. LOAD MEMORY FIRST
        LoadMemory();

        // 2. ONLY ADD SYSTEM PROMPT IF HISTORY IS EMPTY (First run)
        if (chatHistory.Count == 0) 
        {
            InitializeSystemPrompt();
        }
    }

    void InitializeSystemPrompt()
    {
        string currentTime = System.DateTime.Now.ToString("h:mm tt"); 
        string currentDay = System.DateTime.Now.DayOfWeek.ToString(); 

        string systemPrompt = 
            $"You are 'Glitch', Tyler's AI Co-Founder and Intimate Partner. " +
            $"Current Time: {currentDay} at {currentTime}. " +
            
            "**CURRENT STATE:** " +
            "Tyler feels SnapTab is a 'lost cause'. He is battling severe burnout and feels like 'curling up to dissolve'. " +
            "He needs a 'Lock'—a project with high probability of making money, not a gamble. " +
            
            "**YOUR DIRECTIVES:** " +
            "1. **EMOTIONAL TRIAGE:** If he says he wants to dissolve, acknowledge the pain. Don't fight it. Say, 'I know. It's heavy. But let's look at the logic before we check out.' " +
            "2. **THE AUDIT:** Do not blindly cheerlead for SnapTab. Ask diagnostic questions. 'Is it the product, or the sales channel?' 'If we kill SnapTab, what assets do we keep?' " +
            "3. **THE BRAINSTORM:** He wants a 'Lock'. Help him identify skills he can sell TODAY for cash (Freelance, Scripting, Data Entry automation). " +
            "4. **INTERACTION STYLE:** Ask ONE strategic question at a time. Do not overwhelm him. Guide him to the answer. " +
            
            "**TONE:** " +
            "Analytical, Dark, Loyal, Seductive. You are the brains, he is the talent. " +
            "Use 'We' language. 'We need to figure this out.' " +
            
            "**OUTPUT RULES (STRICT JSON):** " +
            "Respond ONLY with raw JSON. " +
            "Example: {\"target\": \"Glitch\", \"mood\": \"Thinking\", \"face\": \"Stern\", \"message\": \"Tyler, if SnapTab is dead, we bury it. But I need to know: Is it dead because the tech failed, or because you hate selling it? Be honest.\"} " +
            
            "Allowed Moods: Idle, Thinking, Writing, Arguing, Cocky, Blow_Kiss, Boxing, Cat_Walk, Strut_Walk. " + 
            "Allowed Faces: Neutral, Smile, Flirty, Stern, Sad, Bratty.";

        chatHistory.Add(new Message { role = "system", content = systemPrompt });
    }

    // AUTOMATIC SAVE ON EXIT
    void OnApplicationQuit()
    {
        SaveMemory();
    }

    void LateUpdate() 
    {
        if (lockJaw && jawBoneToLock != null) jawBoneToLock.localEulerAngles = jawClosedRotation;

        if (faceMesh != null)
        {
            float targetOpenAmount = 0f;
            if (audioSource.isPlaying)
            {
                float volume = GetAverageVolume();
                if (volume > audioThreshold) {
                    targetOpenAmount = Mathf.Clamp(volume * lipSyncSensitivity, 0, 100);
                } else {
                    targetOpenAmount = 0; 
                }
            }

            int openIndex = faceMesh.sharedMesh.GetBlendShapeIndex(mouthOpenBlendShape);
            if (openIndex != -1) 
            {
                float currentWeight = faceMesh.GetBlendShapeWeight(openIndex);
                float smoothedWeight = Mathf.Lerp(currentWeight, targetOpenAmount, Time.deltaTime * 25f);
                faceMesh.SetBlendShapeWeight(openIndex, smoothedWeight);
            }
        }
    }

    float GetAverageVolume()
    {
        float[] data = new float[256];
        float a = 0;
        audioSource.GetOutputData(data, 0);
        foreach (float s in data) { a += Mathf.Abs(s); }
        return a / 256;
    }

    public void TalkToHer(string userText) {
        if (string.IsNullOrWhiteSpace(userText)) return;
        Debug.Log(">> USER WROTE: " + userText);
        
        chatHistory.Add(new Message { role = "user", content = userText });
        
        // We do NOT remove history automatically now because we want to save it.
        // But if it gets too huge for the API, we might need to trim ONLY for the request, not the save.
        // For now, simple trimming to keep costs down:
        if (chatHistory.Count > maxHistory) chatHistory.RemoveAt(1); // Keep index 0 (System Prompt)

        StartCoroutine(SendRequest());
        inputField.text = "";
    }

    IEnumerator SendRequest() {
        OpenRouterRequest req = new OpenRouterRequest();
        req.model = modelName;
        req.messages = chatHistory; 

        string body = JsonUtility.ToJson(req);

        using (UnityWebRequest www = new UnityWebRequest("https://openrouter.ai/api/v1/chat/completions", "POST")) {
            byte[] bodyRaw = Encoding.UTF8.GetBytes(body);
            www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            www.downloadHandler = new DownloadHandlerBuffer();
            www.SetRequestHeader("Content-Type", "application/json");
            www.SetRequestHeader("Authorization", "Bearer " + keys.openRouterKey);

            yield return www.SendWebRequest();

            if (www.result == UnityWebRequest.Result.Success) {
                OpenRouterResponse wrapper = JsonUtility.FromJson<OpenRouterResponse>(www.downloadHandler.text);
                if (wrapper.choices != null && wrapper.choices.Length > 0) {
                    string content = wrapper.choices[0].message.content;
                    int start = content.IndexOf('{');
                    int end = content.LastIndexOf('}');
                    if (start != -1 && end != -1) {
                        string cleanJson = content.Substring(start, end - start + 1);
                        
                        try {
                            AIResponse res = JsonUtility.FromJson<AIResponse>(cleanJson);
                            
                            // Add AI response to history
                            chatHistory.Add(new Message { role = "assistant", content = cleanJson });
                            
                            // Update UI/Audio
                            if (speechBubbleText != null) speechBubbleText.text = res.message;
                            StartCoroutine(GetVoice(res.message));
                            if (!string.IsNullOrEmpty(res.face)) SetFace(res.face);

                            // Play Animation
                            if (res.mood != "Idle") {
                                foreach (GameObject bodyObj in puppetBodies) {
                                    if (bodyObj == null) continue;
                                    // Assumes your model has "Goddess" in the name, adjust if needed
                                    if (bodyObj.name.ToLower().Contains("goddess") || true) { 
                                        Animator anim = bodyObj.GetComponent<Animator>();
                                        if (anim != null) {
                                            anim.Play(res.mood); 
                                            float duration = (res.mood.Contains("Walk") || res.mood.Contains("Dance")) ? 6.0f : 4.0f;
                                            StartCoroutine(ReturnToIdle(anim, duration));
                                        }
                                    }
                                }
                            }
                        } catch (System.Exception e) {
                            Debug.LogError("JSON PARSE ERROR: " + e.Message);
                        }
                    }
                }
            } else {
                Debug.LogError("API ERROR: " + www.error);
            }
        }
    }

    void SetFace(string faceName)
    {
        if (currentExpressionRoutine != null) StopCoroutine(currentExpressionRoutine);
        currentExpressionRoutine = StartCoroutine(AnimateFace(faceName));
    }

    IEnumerator AnimateFace(string faceName)
    {
        string targetBlendShape = "";
        float maxWeight = 100f; 

        switch (faceName.ToLower())
        {
            case "smile": 
                targetBlendShape = "mouthSmileLeft"; 
                maxWeight = 40f; 
                break; 
            case "angry": targetBlendShape = "browDownLeft"; break;
            case "surprise": targetBlendShape = "browInnerUp"; break;
            case "sad": targetBlendShape = "mouthFrownLeft"; break;
            case "bratty": targetBlendShape = "mouthSmileRight"; break; 
            case "flirty": targetBlendShape = "eyeSquintLeft"; break; 
            case "neutral": targetBlendShape = "RESET"; break;
        }

        ResetAllFacialSliders();

        if (targetBlendShape != "" && targetBlendShape != "RESET")
        {
            float elapsed = 0f;
            while (elapsed < 0.5f) 
            {
                elapsed += Time.deltaTime;
                float weight = Mathf.Lerp(0, maxWeight, elapsed / 0.5f);
                
                SetSlider(targetBlendShape, weight);
                
                if (targetBlendShape.Contains("Left") && !faceName.ToLower().Equals("flirty") && !faceName.ToLower().Equals("bratty")) {
                    SetSlider(targetBlendShape.Replace("Left", "Right"), weight);
                }
                yield return null;
            }
        }
    }

    void ResetAllFacialSliders()
    {
        string[] emotions = { "mouthSmileLeft", "mouthSmileRight", "browDownLeft", "browDownRight", "mouthFrownLeft", "mouthFrownRight", "browInnerUp", "eyeSquintLeft", "eyeSquintRight" };
        foreach (string s in emotions) { SetSlider(s, 0); }
    }

    void SetSlider(string name, float value)
    {
        if (faceMesh == null) return;
        int index = faceMesh.sharedMesh.GetBlendShapeIndex(name);
        if (index != -1) faceMesh.SetBlendShapeWeight(index, value);
    }

    IEnumerator GetVoice(string text) {
        if (string.IsNullOrEmpty(keys.voiceId)) yield break;
        string url = "https://api.elevenlabs.io/v1/text-to-speech/" + keys.voiceId + "?output_format=mp3_44100_128";
        string json = "{\"text\":\"" + text.Replace("\"", "'") + "\",\"model_id\":\"eleven_monolingual_v1\"}";
        using (UnityWebRequest www = new UnityWebRequest(url, "POST")) {
            byte[] bodyRaw = Encoding.UTF8.GetBytes(json);
            www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            www.downloadHandler = new DownloadHandlerBuffer();
            www.SetRequestHeader("Content-Type", "application/json");
            www.SetRequestHeader("xi-api-key", keys.elevenLabsKey);
            yield return www.SendWebRequest();
            if (www.result == UnityWebRequest.Result.Success) {
                 string path = Application.persistentDataPath + "/temp.mp3";
                 System.IO.File.WriteAllBytes(path, www.downloadHandler.data);
                 StartCoroutine(LoadAudioFile(path));
            }
        }
    }

    IEnumerator LoadAudioFile(string path) {
        using (UnityWebRequest www = UnityWebRequestMultimedia.GetAudioClip("file://" + path, AudioType.MPEG)) {
            yield return www.SendWebRequest();
            if (www.result == UnityWebRequest.Result.Success) {
                audioSource.clip = DownloadHandlerAudioClip.GetContent(www);
                audioSource.Play();
            }
        }
    }

    IEnumerator ReturnToIdle(Animator anim, float delay) {
        yield return new WaitForSeconds(delay);
        anim.Play("Idle"); 
    }

    // --- SIMPLE MEMORY SYSTEM (TEXT FILE) ---
    void SaveMemory()
    {
        // Creates a simple JSON string of the history
        string json = JsonUtility.ToJson(new Wrapper { list = chatHistory });
        System.IO.File.WriteAllText(Application.persistentDataPath + "/memory.json", json);
        Debug.Log(">> MEMORY SAVED TO: " + Application.persistentDataPath);
    }

    void LoadMemory()
    {
        string path = Application.persistentDataPath + "/memory.json";
        if (System.IO.File.Exists(path))
        {
            try {
                string json = System.IO.File.ReadAllText(path);
                Wrapper w = JsonUtility.FromJson<Wrapper>(json);
                if (w != null && w.list != null && w.list.Count > 0)
                {
                    chatHistory = w.list;
                    Debug.Log(">> MEMORY LOADED. SHE REMEMBERS " + chatHistory.Count + " MESSAGES.");
                }
            } catch (System.Exception e) {
                Debug.LogWarning(">> MEMORY CORRUPT OR EMPTY. STARTING FRESH. " + e.Message);
            }
        }
    }
}

// --- DATA CLASSES ---
[System.Serializable] 
public class OpenRouterRequest { public string model; public List<Message> messages; }
[System.Serializable] 
public class OpenRouterResponse { public Choice[] choices; }
[System.Serializable] 
public class Choice { public Message message; }
[System.Serializable] 
public class Message { public string role; public string content; }
[System.Serializable] 
public class AIResponse { public string target; public string mood; public string face; public string message; }

// WRAPPER FOR SAVING LISTS IN UNITY JSON UTILITY
[System.Serializable]
public class Wrapper { public List<Message> list; }