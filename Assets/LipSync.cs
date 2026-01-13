using UnityEngine;

public class LipSync : MonoBehaviour
{
    public AudioSource audioSource;
    public SkinnedMeshRenderer meshRenderer;
    public int mouthShapeIndex = 10; // I set this to 10 for you automatically!
    public float intensity = 500f;

    void Start()
    {
        // MAGIC LINE: This finds the Audio Source so you don't have to drag it!
        if (audioSource == null) audioSource = GetComponent<AudioSource>();
    }

    void Update()
    {
        if (audioSource != null && audioSource.isPlaying)
        {
            float[] samples = new float[256];
            audioSource.GetOutputData(samples, 0);
            float volume = 0;
            foreach (var s in samples) volume += Mathf.Abs(s);
            meshRenderer.SetBlendShapeWeight(mouthShapeIndex, volume * intensity);
        }
        else if (meshRenderer != null)
        {
            meshRenderer.SetBlendShapeWeight(mouthShapeIndex, 0);
        }
    }
}