using UnityEngine;
using System.Collections;

public class AutoBlink : MonoBehaviour
{
    public SkinnedMeshRenderer faceMesh; // Drag Goddess here

    [Header("Slider Names (Check capitalization!)")]
    public string leftEyeName = "eyeBlinkLeft";
    public string rightEyeName = "eyeBlinkRight";

    [Header("Timing")]
    public float minWait = 2.0f;
    public float maxWait = 5.0f;
    public float blinkSpeed = 0.15f; // How fast the blink happens

    void Start()
    {
        if (faceMesh != null) StartCoroutine(BlinkRoutine());
    }

    IEnumerator BlinkRoutine()
    {
        while (true)
        {
            // 1. Wait for a random amount of time (so it doesn't look robotic)
            yield return new WaitForSeconds(Random.Range(minWait, maxWait));

            // 2. Close Eyes
            yield return StartCoroutine(AnimateBlink(0f, 100f));

            // 3. Keep closed for a tiny fraction
            yield return new WaitForSeconds(0.05f);

            // 4. Open Eyes
            yield return StartCoroutine(AnimateBlink(100f, 0f));
        }
    }

    IEnumerator AnimateBlink(float start, float end)
    {
        float elapsed = 0f;
        while (elapsed < blinkSpeed)
        {
            elapsed += Time.deltaTime;
            float current = Mathf.Lerp(start, end, elapsed / blinkSpeed);
            
            // Apply to both eyes
            SetBlendShape(leftEyeName, current);
            SetBlendShape(rightEyeName, current);
            
            yield return null;
        }
    }

    void SetBlendShape(string name, float value)
    {
        int index = faceMesh.sharedMesh.GetBlendShapeIndex(name);
        if (index != -1) faceMesh.SetBlendShapeWeight(index, value);
    }
}