# Non-Euclidean Geometry Simulation

An interactive, web-based laboratory for exploring non-Euclidean geometry. This project leverages WebGL and Three.js with custom shaders to dynamically render Euclidean (Parabolic), Hyperbolic, and Elliptic (Spherical) geometries.

## Core Features
- **Dynamic Geometry Selection:** Switch instantly between Euclidean, Hyperbolic, and Elliptic spaces.
- **GPU-Accelerated Rendering:** Curved spaces are calculated entirely in the vertex/fragment shaders for maximum performance.
- **Dual-View System:** 
  - *3D Immersive View:* Exploring the manifold from a first-person or orbital perspective.
  - *2D Projection Map:* Real-time planar projection of the topology.
- **Interactive Manipulation:** Draggable points and lines that recalculate geodesic paths instantly.
- **Real-time Metrics:** Dynamic calculation of the sum of angles for triangles demonstrating deviations from $180^\circ$.

---

## Technical Architecture & Guidance

### 1. State Management (Instant Curvature Switching)
To switch the geometry parameter (curvature $K$) instantly without re-initializing the entire WebGL context:
- **Centralized State:** Use a lightweight state manager (like Zustand or React Context if using React, or a simple observable pattern in vanilla JS) to store the global `K` value.
- **GLSL Uniforms:** Pass $K$ as a `uniform float u_curvature;` to your custom shaders.
- **Instant Updates:** When the user changes the geometry, simply update the `u_curvature` uniform on the Three.js material (`material.uniforms.u_curvature.value = newK;`). The GPU will immediately reflect this change in the very next frame without any heavy CPU-side re-computation or WebGL context re-initialization.
- **Topology:** Ensure your base geometry has enough subdivisions (vertices) so that the vertex shader has enough points to smoothly curve the space.

### 2. Vertex Shader Template (Geodesic Transformation)
Below is a template for the vertex shader that applies a non-linear transformation based on the curvature parameter $K$.

```glsl
uniform float u_curvature; // K: 0 (Euclidean), <0 (Hyperbolic), >0 (Elliptic)
varying vec3 vWorldPosition;

void main() {
    // Start with the local vertex position
    vec3 pos = position;
    
    // Apply non-linear transformation based on curvature K
    // This example demonstrates scaling to approximate geodesic mappings.
    float r = length(pos);

    if (r > 0.0001) {
        if (u_curvature > 0.0) {
            // Elliptic (Spherical) geometry mapping
            float k_sqrt = sqrt(u_curvature);
            float scale = sin(r * k_sqrt) / (r * k_sqrt);
            pos *= scale;
        } else if (u_curvature < 0.0) {
            // Hyperbolic geometry mapping (e.g., hyperboloid to Poincaré)
            float k_sqrt = sqrt(-u_curvature);
            float scale = sinh(r * k_sqrt) / (r * k_sqrt);
            pos *= scale;
        }
        // If u_curvature == 0.0, pos remains unchanged (Euclidean)
    }

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
```

### 3. Object Picking in Curved Space
Native Three.js raycasting (`THREE.Raycaster`) relies on straight lines and Euclidean CPU-side bounding boxes, which will fail when vertices are displaced by the GPU. 
To achieve perfectly accurate mouse picking in curved space:

**Recommended Approach: GPU-based Color Picking (Off-screen Rendering)**
1. Assign a unique, hidden color ID to every interactive object (points, lines, polygons).
2. Create an off-screen WebGLRenderTarget.
3. When the user clicks, render the scene to this off-screen target using a special "picking material" that outputs the unique color IDs (applying the exact same non-linear vertex shader as the main scene).
4. Use `renderer.readRenderTargetPixels()` to read the exact color of the single pixel under the mouse coordinates.
5. Map the read color back to the selected object. 
*Why this works:* This method perfectly accounts for any complex GLSL vertex displacement because the picking is evaluated based on the final rendered pixels, not a CPU-side mathematical intersection.