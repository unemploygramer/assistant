using UnityEngine;
using UnityEngine.Networking;
using TMPro;
using System.Collections;
using System.Text;
using System.IO;
using System.Collections.Generic;
using System.Linq;

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
    public ExpressionData[] face_data; // New facial expression data from server
}

public class AIController : MonoBehaviour
{
    [Header("Server Settings")]
    public string serverUrl = "http://localhost:3000"; 

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
[Range(10, 2000)] public float sensitivity = 800f;
    [Range(0.001f, 0.1f)] public float noiseGate = 0.02f; 
    public float smoothness = 20f; 

    // Internal Variables
    private int jawIndex = -1;
    private float currentJawWeight = 0f;
    private bool lastIsTalking = false;
    
    // Face expression tracking
    private Dictionary<string, int> blendShapeIndices = new Dictionary<string, int>();
    private Dictionary<string, float> targetBlendShapeWeights = new Dictionary<string, float>();
    private Dictionary<string, float> currentBlendShapeWeights = new Dictionary<string, float>();
    private float faceLerpSpeed = 5f; // Speed for Mathf.Lerp interpolation

    void Start()
    {
        Debug.Log("🟢 UNITY STARTING...");

        if (voiceSource == null) 
        {
            voiceSource = gameObject.AddComponent<AudioSource>();
            voiceSource.spatialBlend = 0; // FORCE 2D SOUND so you can always hear it
            Debug.Log("✅ AudioSource created & set to 2D");
        }
        else
        {
            voiceSource.spatialBlend = 0; // Ensure existing source is 2D
        }
        
        // 1. Auto-Detect Blendshape logic
        if (faceMesh != null)
        {
            Mesh m = faceMesh.sharedMesh;
            
            // Auto-detect jaw blendshape
            string[] possibleNames = { "jawOpen", "MouthOpen", "Aah", "mouth_a", "Mouth_Open", "jaw_open" };
            for(int i = 0; i < possibleNames.Length; i++) {
                int index = m.GetBlendShapeIndex(possibleNames[i]);
                if (index != -1) {
                    jawIndex = index;
                    Debug.Log($"✅ AUTO-DETECTED MOUTH: '{possibleNames[i]}' (Index {index})");
                    break;
                }
            }
            
            // Pre-cache facial expression blendshape indices
            string[] faceBlendShapes = {
                "eyeBlinkLeft", "eyeBlinkRight", 
                "mouthSmileLeft", "mouthSmileRight", 
                "mouthPucker", "mouthFrownRight", 
                "browInnerUp", "browDownLeft",
                "eyeSquintRight", "eyeWideLeft"
            };
            
            foreach (string shapeName in faceBlendShapes)
            {
                int index = m.GetBlendShapeIndex(shapeName);
                if (index != -1)
                {
                    blendShapeIndices[shapeName] = index;
                    targetBlendShapeWeights[shapeName] = 0f;
                    currentBlendShapeWeights[shapeName] = 0f;
                    Debug.Log($"✅ Cached blendshape: '{shapeName}' (Index {index})");
                }
            }
            
            Debug.Log($"✅ Total facial blendshapes cached: {blendShapeIndices.Count}");
            
            // Log all cached blendshapes for debugging
            Debug.Log($"📋 [FACE_DATA] Cached blendshapes:");
            foreach (var kvp in blendShapeIndices)
            {
                Debug.Log($"   - {kvp.Key} (index {kvp.Value})");
            }
        }

        // 2. Start Polling
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
            // Handle jaw animation (lip sync)
            float targetWeight = 0f;
            if (voiceSource != null && voiceSource.isPlaying)
            {
                float vol = GetAverageVolume();
                if (vol > noiseGate) targetWeight = vol * sensitivity; 
            }
            currentJawWeight = Mathf.Lerp(currentJawWeight, targetWeight, Time.deltaTime * smoothness);
            faceMesh.SetBlendShapeWeight(jawIndex, currentJawWeight);
            
            // Handle facial expressions with smooth interpolation
            bool hasActiveExpressions = false;
            foreach (var kvp in blendShapeIndices)
            {
                string shapeName = kvp.Key;
                int shapeIndex = kvp.Value;
                
                // Get target weight (0 if not set)
                float target = targetBlendShapeWeights.ContainsKey(shapeName) 
                    ? targetBlendShapeWeights[shapeName] 
                    : 0f;
                
                // Smoothly lerp to target
                float current = currentBlendShapeWeights.ContainsKey(shapeName) 
                    ? currentBlendShapeWeights[shapeName] 
                    : 0f;
                
                float previous = current;
                current = Mathf.Lerp(current, target, Time.deltaTime * faceLerpSpeed);
                currentBlendShapeWeights[shapeName] = current;
                
                // Apply to mesh with 0.5f multiplier to prevent distortion (server sends 0-50, Unity uses 0-100)
                // Multiply by 0.5f to keep expressions subtle and prevent face distortion
                float appliedWeight = Mathf.Clamp(current * 0.5f, 0f, 50f);
                faceMesh.SetBlendShapeWeight(shapeIndex, appliedWeight);
                
                // Debug log if there's movement or active expression
                if (Mathf.Abs(target) > 0.1f || Mathf.Abs(current) > 0.1f)
                {
                    hasActiveExpressions = true;
                    if (Mathf.Abs(previous - current) > 0.5f) // Only log if significant change
                    {
                        Debug.Log($"   😊 [FACE_LERP] {shapeName}: {previous:F1} → {current:F1} (target: {target:F1}, applied: {appliedWeight:F1})");
                    }
                }
            }
            
            // Periodic summary log (every ~2 seconds)
            if (Time.frameCount % 120 == 0 && hasActiveExpressions)
            {
                Debug.Log($"📊 [FACE_DATA] Active expressions summary:");
                foreach (var kvp in blendShapeIndices)
                {
                    float target = targetBlendShapeWeights.ContainsKey(kvp.Key) ? targetBlendShapeWeights[kvp.Key] : 0f;
                    float current = currentBlendShapeWeights.ContainsKey(kvp.Key) ? currentBlendShapeWeights[kvp.Key] : 0f;
                    if (Mathf.Abs(target) > 0.1f || Mathf.Abs(current) > 0.1f)
                    {
                        Debug.Log($"      {kvp.Key}: current={current:F1}, target={target:F1}, diff={Mathf.Abs(current - target):F1}");
                    }
                }
            }
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
                        // Check if face_data is in the raw JSON (quiet check)
                        if (!response.Contains("face_data"))
                        {
                            Debug.LogWarning("⚠️ [DEBUG] 'face_data' NOT found in response!");
                        }
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
            // Reduced logging - only show summary, not full JSON
            Debug.Log($"📥 [DEBUG] Received response (length: {json.Length} chars)");
            
            // Check if face_data exists in raw JSON
            if (json.Contains("\"face_data\""))
            {
                Debug.Log("✅ [DEBUG] Found 'face_data' field in raw JSON");
            }
            else if (json.Contains("face_data"))
            {
                Debug.Log("⚠️ [DEBUG] Found 'face_data' but not as JSON field (might be malformed)");
            }
            else
            {
                Debug.LogWarning("❌ [DEBUG] 'face_data' NOT found in raw JSON at all!");
            }
            
            ServerPacket packet = JsonUtility.FromJson<ServerPacket>(json);
            
            Debug.Log($"📥 [DEBUG] Parsed packet - message: {(packet.message != null ? "yes" : "no")}, face_data: {(packet.face_data != null ? packet.face_data.Length.ToString() : "null")}");
            
            // Manual fallback: Try to parse face_data manually if JsonUtility failed
            if (packet.face_data == null && json.Contains("\"face_data\""))
            {
                Debug.LogWarning("⚠️ [DEBUG] JsonUtility failed to parse face_data, trying manual parse...");
                try
                {
                    // Simple manual extraction
                    int faceDataStart = json.IndexOf("\"face_data\":[");
                    if (faceDataStart > 0)
                    {
                        int arrayStart = json.IndexOf("[", faceDataStart);
                        int arrayEnd = json.LastIndexOf("]");
                        if (arrayStart > 0 && arrayEnd > arrayStart)
                        {
                            string faceDataJson = json.Substring(arrayStart, arrayEnd - arrayStart + 1);
                            Debug.Log($"📥 [DEBUG] Extracted face_data array: {faceDataJson}");
                            packet.face_data = JsonUtility.FromJson<ExpressionData[]>("{\"array\":" + faceDataJson + "}")?.ToArray();
                            if (packet.face_data != null)
                            {
                                Debug.Log($"✅ [DEBUG] Manual parse successful! Got {packet.face_data.Length} expressions");
                            }
                        }
                    }
                }
                catch (System.Exception e)
                {
                    Debug.LogError($"❌ [DEBUG] Manual parse failed: {e.Message}");
                }
            }
            
            if (aiTextField != null) aiTextField.text = packet.message;
            if (faceController != null) faceController.OnAIResponse(json);
            if (!string.IsNullOrEmpty(packet.audio)) StartCoroutine(PlayVoice(packet.audio));
            
            // Apply facial expressions from server
            Debug.Log($"😊 [FACE_DATA] Received face_data: {(packet.face_data != null ? packet.face_data.Length.ToString() : "null")} expressions");
            
            if (packet.face_data != null && packet.face_data.Length > 0)
            {
                Debug.Log($"😊 [FACE_DATA] Applying {packet.face_data.Length} facial expressions...");
                foreach (ExpressionData expr in packet.face_data)
                {
                    Debug.Log($"   📥 [FACE_DATA] Processing: {expr.name} = {expr.val}");
                    
                    if (blendShapeIndices.ContainsKey(expr.name))
                    {
                        int shapeIndex = blendShapeIndices[expr.name];
                        float oldTarget = targetBlendShapeWeights.ContainsKey(expr.name) ? targetBlendShapeWeights[expr.name] : 0f;
                        
                        // Server sends 0-50, we store it as target (will be lerped)
                        targetBlendShapeWeights[expr.name] = expr.val;
                        
                        Debug.Log($"   ✅ [FACE_DATA] Set {expr.name} (index {shapeIndex}): {oldTarget} → {expr.val} (target weight)");
                    }
                    else
                    {
                        Debug.LogWarning($"   ⚠️ [FACE_DATA] Unknown blendshape: '{expr.name}' (not found in mesh)");
                        Debug.LogWarning($"   💡 [FACE_DATA] Available blendshapes: {string.Join(", ", blendShapeIndices.Keys)}");
                    }
                }
                
                Debug.Log($"   📊 [FACE_DATA] Total target weights set: {targetBlendShapeWeights.Count}");
            }
            else
            {
                Debug.Log($"   ⚠️ [FACE_DATA] No face_data in response - KEEPING existing expressions (not resetting)");
                // DON'T reset - keep existing expressions until new ones arrive
                // This prevents expressions from flickering back to zero
            }
        }
        catch (System.Exception e) { Debug.LogError($"❌ JSON Error: {e.Message}"); }
    }

    IEnumerator PlayVoice(string base64Audio)
    {
        Debug.Log("💿 Decoding Audio...");

        // 1. Clean the string
        if (base64Audio.Contains(",")) base64Audio = base64Audio.Substring(base64Audio.IndexOf(",") + 1);
        base64Audio = base64Audio.Trim().Replace("\n", "").Replace("\r", "");

        // 2. Save to file
        byte[] audioBytes = System.Convert.FromBase64String(base64Audio);
        string tempPath = Path.Combine(Application.persistentDataPath, "voice_temp.mp3");
        File.WriteAllBytes(tempPath, audioBytes);
        Debug.Log($"💾 Audio saved to: {tempPath}");

        // 3. Load from file using proper URI scheme
        string url = "file:///" + tempPath; 

        using (UnityWebRequest www = UnityWebRequestMultimedia.GetAudioClip(url, AudioType.MPEG))
        {
            yield return www.SendWebRequest();

            if (www.result == UnityWebRequest.Result.Success)
            {
                AudioClip clip = DownloadHandlerAudioClip.GetContent(www);
                if (clip == null) 
                {
                    Debug.LogError("❌ Audio Clip is NULL! (Decoding failed)");
                    yield break;
                }

                Debug.Log($"✅ Playing Audio! Length: {clip.length}s");
                
                if (voiceSource != null) 
                { 
                    voiceSource.clip = clip; 
                    voiceSource.Play(); 
                }
                else 
                {
                    Debug.LogError("❌ VoiceSource is NULL!");
                }
            }
            else
            {
                Debug.LogError($"❌ Audio Load Error: {www.error}");
                Debug.LogError($"❌ URL attempted: {url}");
            }
        }
    }
}