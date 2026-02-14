using UnityEngine;
using System.Collections;
using System.Collections.Generic;

[System.Serializable]
public class FaceExpression
{
    public string name;
    public float val;
}

[System.Serializable]
public class FaceData
{
    public FaceExpression[] face;
}

public class FaceController : MonoBehaviour
{
    [Header("Face Mesh")]
    public SkinnedMeshRenderer faceMesh;

    [Header("Settings")]
    [Tooltip("Maximum value allowed for blendshapes (prevents distortion)")]
    public float maxValue = 50f;
    
    [Tooltip("Smoothing duration in seconds")]
    public float smoothDuration = 0.2f;

    // Internal state
    private Dictionary<string, float> targetWeights = new Dictionary<string, float>();
    private Dictionary<string, float> currentWeights = new Dictionary<string, float>();
    private Dictionary<string, float> startWeights = new Dictionary<string, float>();
    private Dictionary<string, float> transitionStartTime = new Dictionary<string, float>();

    void Update()
    {
        if (faceMesh == null || faceMesh.sharedMesh == null) return;

        // Smoothly transition all active blendshapes
        List<string> keysToRemove = new List<string>();
        
        foreach (var kvp in targetWeights)
        {
            string blendShapeName = kvp.Key;
            float targetValue = kvp.Value;

            // Get blendshape index
            int index = faceMesh.sharedMesh.GetBlendShapeIndex(blendShapeName);
            if (index == -1)
            {
                // Invalid blendshape, remove from tracking
                keysToRemove.Add(blendShapeName);
                continue;
            }

            // Initialize tracking if needed
            if (!currentWeights.ContainsKey(blendShapeName))
            {
                currentWeights[blendShapeName] = faceMesh.GetBlendShapeWeight(index);
                startWeights[blendShapeName] = currentWeights[blendShapeName];
                transitionStartTime[blendShapeName] = Time.time;
            }

            // Calculate smooth transition over 0.2 seconds
            float elapsed = Time.time - transitionStartTime[blendShapeName];
            float t = Mathf.Clamp01(elapsed / smoothDuration);
            
            float startValue = startWeights[blendShapeName];
            float currentValue = Mathf.Lerp(startValue, targetValue, t);
            
            // Update current weight
            currentWeights[blendShapeName] = currentValue;
            
            // Apply to mesh
            faceMesh.SetBlendShapeWeight(index, currentValue);

            // Remove from tracking if transition is complete
            if (t >= 1.0f)
            {
                keysToRemove.Add(blendShapeName);
            }
        }

        // Clean up completed transitions
        foreach (string key in keysToRemove)
        {
            targetWeights.Remove(key);
            currentWeights.Remove(key);
            startWeights.Remove(key);
            transitionStartTime.Remove(key);
        }
    }

    /// <summary>
    /// Accepts a JSON string containing facial expression data
    /// Expected format: {"face": [{"name": "blendShapeName", "val": 25.0}, ...]}
    /// </summary>
    public void OnAIResponse(string jsonString)
    {
        if (string.IsNullOrEmpty(jsonString)) return;

        try
        {
            FaceData data = JsonUtility.FromJson<FaceData>(jsonString);
            ApplyFaceData(data);
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[FaceController] Failed to parse JSON: {e.Message}");
        }
    }

    /// <summary>
    /// Accepts a FaceData object directly
    /// </summary>
    public void ApplyFaceData(FaceData data)
    {
        if (data == null || data.face == null) return;
        if (faceMesh == null || faceMesh.sharedMesh == null)
        {
            Debug.LogWarning("[FaceController] Face mesh not assigned!");
            return;
        }

        foreach (FaceExpression expr in data.face)
        {
            if (string.IsNullOrEmpty(expr.name)) continue;

            // Clamp value to max (0-50)
            float clampedValue = Mathf.Clamp(expr.val, 0f, maxValue);

            // Get blendshape index
            int index = faceMesh.sharedMesh.GetBlendShapeIndex(expr.name);
            if (index == -1)
            {
                // Invalid blendshape name - safely ignore
                Debug.LogWarning($"[FaceController] Invalid blendshape name: {expr.name} (ignoring)");
                continue;
            }

            // Set target weight (will be smoothly transitioned in Update)
            if (targetWeights.ContainsKey(expr.name))
            {
                // Update existing target
                startWeights[expr.name] = currentWeights.ContainsKey(expr.name) 
                    ? currentWeights[expr.name] 
                    : faceMesh.GetBlendShapeWeight(index);
                transitionStartTime[expr.name] = Time.time;
                targetWeights[expr.name] = clampedValue;
            }
            else
            {
                // New target
                float currentValue = faceMesh.GetBlendShapeWeight(index);
                currentWeights[expr.name] = currentValue;
                startWeights[expr.name] = currentValue;
                transitionStartTime[expr.name] = Time.time;
                targetWeights[expr.name] = clampedValue;
            }
        }
    }

    /// <summary>
    /// Reset all blendshapes to 0
    /// </summary>
    public void ResetFace()
    {
        targetWeights.Clear();
        currentWeights.Clear();
        startWeights.Clear();
        transitionStartTime.Clear();

        if (faceMesh != null && faceMesh.sharedMesh != null)
        {
            for (int i = 0; i < faceMesh.sharedMesh.blendShapeCount; i++)
            {
                faceMesh.SetBlendShapeWeight(i, 0f);
            }
        }
    }
}
