using UnityEngine;

public class JigglePhysics : MonoBehaviour
{
    [Header("Settings")]
    public float bounceAmount = 5.0f;  // How hard it reacts to movement
    public float stiffness = 10.0f;    // How fast it snaps back
    public float maxAngle = 20.0f;     // Limit so it doesn't break the mesh

    private Quaternion originalLocalRotation;
    private Vector3 lastPosition;
    private Vector3 momentum;

    void Start()
    {
        // Remember the "Perky" position
        originalLocalRotation = transform.localRotation;
        lastPosition = transform.position;
    }

    void LateUpdate()
    {
        // 1. Calculate how fast the body moved this frame
        Vector3 worldDelta = transform.position - lastPosition;
        lastPosition = transform.position;

        // 2. Convert world movement to local "jiggle" force
        // (If body moves UP, force goes DOWN)
        Vector3 localDelta = transform.InverseTransformDirection(worldDelta);
        momentum -= localDelta * bounceAmount;

        // 3. Apply Spring Physics (Return to center)
        momentum = Vector3.Lerp(momentum, Vector3.zero, Time.deltaTime * stiffness);

        // 4. Clamp the movement so it doesn't look like a glitch
        momentum.x = Mathf.Clamp(momentum.x, -maxAngle, maxAngle);
        momentum.y = Mathf.Clamp(momentum.y, -maxAngle, maxAngle);

        // 5. Apply the rotation
        // Move Y (Up/Down) -> rotates X axis
        // Move X (Left/Right) -> rotates Z axis
        Quaternion jiggleRotation = Quaternion.Euler(momentum.y, 0, -momentum.x);
        
        transform.localRotation = Quaternion.Slerp(transform.localRotation, originalLocalRotation * jiggleRotation, Time.deltaTime * 20f);
    }
}