using UnityEngine;
using UnityEngine.Networking;
using TMPro;
using System.Collections;
using System.Text;
using System.IO;

[System.Serializable]
public class ExpressionData { public string name; public float val; }

[System.Serializable]
public class ServerPacket
{
    public string message;
    public string target;
    public string mood;
    public string face;
    public string audio; 
    public ExpressionData[] expressions;
}

public class AIController : MonoBehaviour
{
    [Header("Server Settings")]
    public string serverUrl = "http://localhost:3000"; // AUTOMATICALLY FIXES URL NOW

    [Header("Connections")]
    public FaceController faceController; 
    public TMP_InputField userField;
    public TextMeshProUGUI aiTextField;
    public AudioSource voiceSource;

    [Header("PART 1: THE LOCK (Drag Jaw Bone Here)")]
    public Transform jawBone; 
    public Vector3 jawClosed = new Vector3(-57, 100, 80); 

    [Header("PART 2: THE ANIMATION (Drag Goddess Mesh Here)")]
    public SkinnedMeshRenderer faceMesh; 
    public string jawBlendShape = "jawOpen"; 

    [Header("Tuning")]
    [Range(10, 2000)] public float sensitivity = 1000f; 
    [Range(0.001f, 0.1f)] public float noiseGate = 0.02f; 
    public float smoothness = 20f; 

    // Internal Variables
    private int jawIndex = -1;
    private float currentJawWeight = 0f;
    private bool lastIsTalking = false;

    void Start()
    {
        Debug.Log("🟢 UNITY STARTING...");

        if (voiceSource == null) 
        {
            voiceSource = gameObject.AddComponent<AudioSource>();
            Debug.Log("✅ AudioSource created");
        }
        
        // 1. Auto-Detect Blendshape logic
        if (faceMesh != null)
        {
            Mesh m = faceMesh.sharedMesh;
            string[] possibleNames = { "jawOpen", "MouthOpen", "Aah", "mouth_a", "Mouth_Open", "jaw_open" };
            
            for(int i = 0; i < possibleNames.Length; i++) {
                int index = m.GetBlendShapeIndex(possibleNames[i]);
                if (index != -1) {
                    jawIndex = index;
                    Debug.Log($"✅ AUTO-DETECTED MOUTH: '{possibleNames[i]}' (Index {index})");
                    break;
                }
            }
        }

        // 2. Start Polling (NOW WITH URL FIX)
        StartCoroutine(PollServer());
    }

    void Update()
    {
        // Traffic Light Logic
        bool isTalkingNow = voiceSource != null && voiceSource.isPlaying;
        if (isTalkingNow != lastIsTalking)
        {
            lastIsTalking = isTalkingNow;
            StartCoroutine(ReportStatus(isTalkingNow));
        }
    }

    void LateUpdate()
    {
        if (jawBone != null) jawBone.localEulerAngles = jawClosed;

        if (faceMesh != null && jawIndex != -1)
        {
            float targetWeight = 0f;
            if (voiceSource != null && voiceSource.isPlaying)
            {
                float vol = GetAverageVolume();
                if (vol > noiseGate) targetWeight = vol * sensitivity; 
            }
            currentJawWeight = Mathf.Lerp(currentJawWeight, targetWeight, Time.deltaTime * smoothness);
            faceMesh.SetBlendShapeWeight(jawIndex, currentJawWeight);
        }
    }

    float GetAverageVolume()
    {
        float[] data = new float[256];
        voiceSource.GetOutputData(data, 0);
        float sum = 0;
        foreach (float s in data) sum += Mathf.Abs(s);
        return sum / 256f;
    }

    // --- NETWORKING ---

    IEnumerator ReportStatus(bool talking)
    {
        // Fix URL if user typed /chat
        string cleanUrl = serverUrl.Replace("/chat", "");
        if (cleanUrl.EndsWith("/")) cleanUrl = cleanUrl.Substring(0, cleanUrl.Length - 1);
        
        string url = cleanUrl + "/status";
        string json = "{\"isTalking\": " + (talking ? "true" : "false") + "}";
        
        using (UnityWebRequest www = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = Encoding.UTF8.GetBytes(json);
            www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            www.downloadHandler = new DownloadHandlerBuffer();
            www.SetRequestHeader("Content-Type", "application/json");
            yield return www.SendWebRequest();
        }
    }

    IEnumerator PollServer()
    {
        // Fix URL if user typed /chat
        string cleanUrl = serverUrl.Replace("/chat", "");
        if (cleanUrl.EndsWith("/")) cleanUrl = cleanUrl.Substring(0, cleanUrl.Length - 1);

        string checkInboxUrl = cleanUrl + "/check-inbox";
        Debug.Log($"🚀 POLLING CORRECTED URL: {checkInboxUrl}");
        
        while (true)
        {
            yield return new WaitForSeconds(0.5f);
            
            using (UnityWebRequest request = UnityWebRequest.Get(checkInboxUrl))
            {
                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    string response = request.downloadHandler.text;
                    if (response != "null" && !string.IsNullOrEmpty(response) && response != "{}")
                    {
                        Debug.Log("📬 MESSAGE RECEIVED!");
                        HandleServerResponse(response);
                    }
                }
            }
        }
    }

    void HandleServerResponse(string json)
    {
        try
        {
            ServerPacket packet = JsonUtility.FromJson<ServerPacket>(json);
            if (aiTextField != null) aiTextField.text = packet.message;
            if (faceController != null) faceController.OnAIResponse(json);
            if (!string.IsNullOrEmpty(packet.audio)) StartCoroutine(PlayVoice(packet.audio));
        }
        catch (System.Exception e) { Debug.LogError($"❌ JSON Error: {e.Message}"); }
    }

    IEnumerator PlayVoice(string base64Audio)
    {
        if (base64Audio.Contains(",")) base64Audio = base64Audio.Substring(base64Audio.IndexOf(",") + 1);
        base64Audio = base64Audio.Trim().Replace("\n", "").Replace("\r", "");
        
        byte[] audioBytes = System.Convert.FromBase64String(base64Audio);
        string tempPath = Application.persistentDataPath + "/voice_temp.mp3";
        File.WriteAllBytes(tempPath, audioBytes);
        
        using (UnityWebRequest www = UnityWebRequestMultimedia.GetAudioClip("file://" + tempPath, AudioType.MPEG))
        {
            yield return www.SendWebRequest();
            if (www.result == UnityWebRequest.Result.Success) 
            {
                AudioClip clip = DownloadHandlerAudioClip.GetContent(www);
                if (voiceSource != null) { voiceSource.clip = clip; voiceSource.Play(); }
            }
        }
    }
}