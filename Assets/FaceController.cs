using UnityEngine;
using System.Collections;
using System.Collections.Generic;

[System.Serializable]
public class FaceData
{
    public string name;
    public float val;
}

[System.Serializable]
public class AIResponse
{
    public string message;
    public List<FaceData> expressions; // Expects a list of expressions
}


public class FaceController : MonoBehaviour
{
    public SkinnedMeshRenderer bodyRenderer;
    private Dictionary<int, float> targetWeights = new Dictionary<int, float>();
    private float smoothSpeed = 10f; // Speed of the transition

    void Update()
    {
        // Smoothly move all active blendshapes toward their target values
        if (targetWeights.Count > 0)
        {
            List<int> keys = new List<int>(targetWeights.Keys);
            foreach (int index in keys)
            {
                float current = bodyRenderer.GetBlendShapeWeight(index);
                float target = targetWeights[index];
                
                // Lerp for smoothness
                float nextValue = Mathf.Lerp(current, target, Time.deltaTime * smoothSpeed);
                bodyRenderer.SetBlendShapeWeight(index, nextValue);
            }
        }
    }

    // Call this function with the JSON string from the AI
    public void OnAIResponse(string jsonResponse)
    {
        try 
        {
            // Parse the JSON
            AIResponse data = JsonUtility.FromJson<AIResponse>(jsonResponse);

            if (data.expressions != null)
            {
                foreach (FaceData face in data.expressions)
                {
                    int index = bodyRenderer.sharedMesh.GetBlendShapeIndex(face.name);
                    if (index != -1)
                    {
                        // CLAMP VALUE TO 50
                        float safeValue = Mathf.Clamp(face.val, 0f, 50f);
                        
                        if (targetWeights.ContainsKey(index))
                            targetWeights[index] = safeValue;
                        else
                            targetWeights.Add(index, safeValue);
                    }
                }
            }
        }
        catch (System.Exception e)
        {
            Debug.LogWarning("Face Parse Error (ignoring): " + e.Message);
        }
    }
    
    // Helper to reset face to neutral
    public void ResetFace()
    {
        targetWeights.Clear();
        for(int i=0; i < bodyRenderer.sharedMesh.blendShapeCount; i++)
        {
            bodyRenderer.SetBlendShapeWeight(i, 0);
        }
    }
}