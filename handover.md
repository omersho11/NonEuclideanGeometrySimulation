# Non-Euclidean Geometry Simulation - Handover

## Recent Updates
- **UI & Architecture Refactor**: The Classic UI has been entirely removed, and the dynamic V2 UI is now the default. The "Environment" selector has been decoupled into two distinct systems:
  - **Topology**: Controls the 3D objects spawned in the scene.
  - **Floor Tiles**: Controls the procedural WebGL grid shader.
- **New Floor Shaders**: Added three stunning procedural floor shaders (Triangular Matrix, Voronoi Quantum Dots, Interference Waves) that warp beautifully in curved space.
- **Minimap Projection Fixes**: 
  - **Spherical Space** now uses a strict Orthographic projection bounded at the equator (`r_proj = R * sin(d/R)`), making it look like a physical compact sphere.
  - **Hyperbolic Space** now uses an exponential expansion projection (`r_proj = R * sinh(d/R)`) to physically represent the divergent nature of hyperbolic lines.
  - The minimap camera now dynamically zooms in/out based on the current curvature to perfectly frame the world, and uses native `gl_FragCoord` clipping to achieve a perfectly transparent circular border.
- **Drone Improvements**: Expanded the drone swarm to 8 distinct entities (45-degree intervals) with automatic long-distance resets, and added manual resets via the 'R' key.
- **View Enhancements**: Extended the fog and grid fade range massively (up to 300 units) to allow viewing deep into hyperbolic space.
- **Euclidean Snapping**: Smooth curvature transitions now snap perfectly to `0.0` Euclidean space when close, instantly resolving any slight non-Euclidean lingering.

## Future Ideas
- **Dynamic Lighting**: Introduce dynamic point lights attached to drones that cast shadows onto the non-Euclidean surfaces.
- **Non-Euclidean Physics**: Implement rigid-body collision mechanics (e.g. bouncing balls) that naturally follow the geodesics of the curved space.
- **Custom Shader Importer**: Allow users to write and hot-reload their own GLSL floor patterns directly from the UI.
