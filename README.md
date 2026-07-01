# Non-Euclidean Geometry Simulation

An interactive, web-based laboratory for exploring non-Euclidean geometry in real-time. This project leverages WebGL and Three.js with custom procedural shaders to dynamically render Euclidean (Flat), Hyperbolic (Negatively Curved), and Spherical (Positively Curved) geometries.

## Features

- **Real-Time Space Warping:** Seamlessly transition the fundamental curvature of the universe from a flat plane to a compact sphere or an infinitely expanding hyperbolic saddle, fully calculated on the GPU via vertex shaders.
- **Decoupled Architecture:** Mix and match the 3D topology with procedural floor shaders:
  - *Topologies*: Empty Space, Forest & Torus, Parallel Lines, Geometry Quirks.
  - *Floor Tiles*: Classic Squares, Ethereal Hexagons, Triangular Matrix, Voronoi Quantum Dots, Interference Waves.
- **Advanced Dual-View System:** 
  - **Immersive 3D View:** A first-person, rolling-world projection where geometry bends around you.
  - **Dynamic Radar Minimap:** A transparent, perfectly circular overlay that accurately maps the topology. It uses an Orthographic projection for Spherical space and an Exponential expansion for Hyperbolic space, with automatic camera scaling to keep the universe perfectly framed.
- **Autonomous Drone Swarm:** Spawn a fleet of drones that travel outward, dynamically bending and conforming to the curvature of the active manifold.
- **Interactive Mechanics:** Shoot physics balls that follow geodesic arcs across the curved space, and observe real-time telemetry like the triangle angle sum deviation.

## How to Run

Ensure you have [Node.js](https://nodejs.org/) installed, then follow these steps:

1. Clone or download the repository.
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:5173` (or the port specified in your terminal).

## Controls

- **WASD / Arrows:** Move around the environment.
- **Mouse:** Click and drag to look around.
- **Space / Shift:** Fly Up / Fly Down.
- **Left Click:** Shoot a geodesic projectile.
- **Slider:** Adjust the fundamental curvature of the universe in real-time.
- **TAB:** Toggle the 2D Radar Minimap.
- **T:** Spawn the autonomous drone swarm.
- **R:** Reset the drone swarm to the origin.
- **F:** Toggle geometric fog/fade.

## Technical Details

The simulation does not rely on CPU-side physics or standard non-Euclidean matrices. Instead, it utilizes a "Player-Centric Rolling World" approach. As the player moves, the entire world translates in the opposite direction. A custom WebGL vertex shader then dynamically applies a non-linear displacement (using `sin`/`sinh` functions based on the chosen curvature constant `K`) to every vertex, simulating the visual experience of moving through curved space at 60+ FPS.