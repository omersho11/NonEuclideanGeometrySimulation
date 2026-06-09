import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- State ---
let curvature = 0.0;
let mapVisible = false;

// --- Setup ---
const container = document.body;
const mapContainer = document.getElementById('map-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0a0c10);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0c10, 0.05);

// Main Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 5);

// Map Camera (Orthographic)
const mapCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
mapCamera.position.set(0, 20, 0);
mapCamera.lookAt(0, 0, 0);

// --- Controls ---
const controls = new PointerLockControls(camera, document.body);

const crosshair = document.getElementById('crosshair');
controls.addEventListener('lock', () => crosshair.style.display = 'block');
controls.addEventListener('unlock', () => crosshair.style.display = 'none');

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveState = { forward: false, backward: false, left: false, right: false };

document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveState.forward = true;
    if (e.code === 'KeyS') moveState.backward = true;
    if (e.code === 'KeyA') moveState.left = true;
    if (e.code === 'KeyD') moveState.right = true;
    
    if (e.code === 'Tab') {
        e.preventDefault();
        mapVisible = !mapVisible;
        if (mapVisible) {
            mapContainer.classList.remove('hidden');
        } else {
            mapContainer.classList.add('hidden');
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveState.forward = false;
    if (e.code === 'KeyS') moveState.backward = false;
    if (e.code === 'KeyA') moveState.left = false;
    if (e.code === 'KeyD') moveState.right = false;
});

// --- Shader Material ---
const nonEuclideanShader = {
    uniforms: {
        u_curvature: { value: 0.0 },
        color: { value: new THREE.Color(0x3b82f6) }
    },
    vertexShader: `
        uniform float u_curvature;
        varying vec3 vWorldPosition;
        varying float vDistance;

        void main() {
            vec3 pos = position;
            float r = length(pos);
            
            if (r > 0.0001) {
                if (u_curvature > 0.0) {
                    float k_sqrt = sqrt(u_curvature);
                    float scale = sin(r * k_sqrt) / (r * k_sqrt);
                    pos.x *= scale;
                    pos.z *= scale;
                } else if (u_curvature < 0.0) {
                    float k_sqrt = sqrt(-u_curvature);
                    float scale = sinh(r * k_sqrt) / (r * k_sqrt);
                    pos.x *= scale;
                    pos.z *= scale;
                }
            }
            
            vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
            vWorldPosition = worldPosition.xyz;
            vDistance = distance(cameraPosition, worldPosition.xyz);
            
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 color;
        varying float vDistance;
        
        void main() {
            float alpha = 1.0 - smoothstep(15.0, 30.0, vDistance);
            gl_FragColor = vec4(color, alpha);
        }
    `,
    transparent: true,
    wireframe: true
};

const customMaterial = new THREE.ShaderMaterial(nonEuclideanShader);

// --- Picking Setup ---
const pickingScene = new THREE.Scene();
const pickingTexture = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
const pickingMaterial = new THREE.ShaderMaterial({
    uniforms: {
        u_curvature: nonEuclideanShader.uniforms.u_curvature,
        color: { value: new THREE.Color(0xff0000) } // Overridden per object
    },
    vertexShader: nonEuclideanShader.vertexShader,
    fragmentShader: `
        uniform vec3 color;
        void main() {
            gl_FragColor = vec4(color, 1.0);
        }
    `
});

// --- Geometry ---
// Base Grid
const gridGeom = new THREE.PlaneGeometry(40, 40, 100, 100);
gridGeom.rotateX(-Math.PI / 2);
const grid = new THREE.Mesh(gridGeom, customMaterial);
scene.add(grid);

// Interactive Triangle Vertices
const vGeom = new THREE.SphereGeometry(0.2, 16, 16);
const vMat = new THREE.MeshBasicMaterial({ color: 0xff3366 });

const points = [
    new THREE.Vector3(0, 0, -3),
    new THREE.Vector3(-3, 0, 3),
    new THREE.Vector3(3, 0, 3)
];

const idToObject = {};

const spheres = points.map((p, index) => {
    // Visual Sphere
    const s = new THREE.Mesh(vGeom, vMat);
    s.position.copy(p);
    scene.add(s);
    
    // Picking Sphere
    const id = index + 1; // ID 1, 2, 3
    const pMat = pickingMaterial.clone();
    pMat.uniforms.color.value = new THREE.Color(id); // Use the ID directly as an integer color
    const pSphere = new THREE.Mesh(vGeom, pMat);
    pSphere.position.copy(p);
    pickingScene.add(pSphere);
    
    idToObject[id] = { visual: s, picking: pSphere, index: index };
    
    return s;
});

// Triangle Edges (highly subdivided lines to show curvature)
const lineMat = new THREE.ShaderMaterial({
    uniforms: {
        u_curvature: nonEuclideanShader.uniforms.u_curvature,
        color: { value: new THREE.Color(0xffaa00) }
    },
    vertexShader: nonEuclideanShader.vertexShader,
    fragmentShader: `
        uniform vec3 color;
        void main() {
            gl_FragColor = vec4(color, 1.0);
        }
    `,
    linewidth: 3
});

function createSubdividedLine(p1, p2, segments = 50) {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array((segments + 1) * 3);
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        positions[i*3] = p1.x + (p2.x - p1.x) * t;
        positions[i*3+1] = p1.y + (p2.y - p1.y) * t;
        positions[i*3+2] = p1.z + (p2.z - p1.z) * t;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Line(geom, lineMat);
}

const lines = [
    createSubdividedLine(points[0], points[1]),
    createSubdividedLine(points[1], points[2]),
    createSubdividedLine(points[2], points[0])
];
lines.forEach(l => scene.add(l));

// --- Architectural Scene ---
// Add pillars to explore and visualize curvature
const pillarGeom = new THREE.BoxGeometry(1, 15, 1, 10, 50, 10);
const pillarMat = new THREE.ShaderMaterial({
    uniforms: {
        u_curvature: nonEuclideanShader.uniforms.u_curvature,
        color: { value: new THREE.Color(0x10b981) } // Emerald green
    },
    vertexShader: nonEuclideanShader.vertexShader,
    fragmentShader: nonEuclideanShader.fragmentShader,
    transparent: true,
    wireframe: true
});

for (let r = 5; r <= 30; r += 5) {
    const numPillars = r * 2;
    for (let i = 0; i < numPillars; i++) {
        const angle = (i / numPillars) * Math.PI * 2;
        const p = new THREE.Mesh(pillarGeom, pillarMat);
        p.position.set(Math.cos(angle) * r, 7.5, Math.sin(angle) * r);
        scene.add(p);
    }
}

// Add a central floating ring
const ringGeom = new THREE.TorusGeometry(8, 0.5, 16, 100);
ringGeom.rotateX(Math.PI / 2);
const ringMat = new THREE.ShaderMaterial({
    uniforms: {
        u_curvature: nonEuclideanShader.uniforms.u_curvature,
        color: { value: new THREE.Color(0xa855f7) } // Purple
    },
    vertexShader: nonEuclideanShader.vertexShader,
    fragmentShader: nonEuclideanShader.fragmentShader,
    transparent: true,
    wireframe: true
});
const centralRing = new THREE.Mesh(ringGeom, ringMat);
centralRing.position.set(0, 15, 0);
scene.add(centralRing);

// Collect all materials that need curvature updates
const materialsToUpdate = [
    customMaterial, 
    pickingMaterial, 
    lineMat, 
    pillarMat, 
    ringMat,
    idToObject[1].picking.material, 
    idToObject[2].picking.material, 
    idToObject[3].picking.material
];

// --- Geometry Update Math ---
function updateLines() {
    for (let j = 0; j < 3; j++) {
        const p1 = points[j];
        const p2 = points[(j + 1) % 3];
        const geom = lines[j].geometry;
        const positions = geom.attributes.position.array;
        const segments = 50;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            positions[i*3] = p1.x + (p2.x - p1.x) * t;
            positions[i*3+1] = p1.y + (p2.y - p1.y) * t;
            positions[i*3+2] = p1.z + (p2.z - p1.z) * t;
        }
        geom.attributes.position.needsUpdate = true;
    }
}

// Calculate Angle Sum based on Curvature
const angleSumElement = document.getElementById('angle-sum');
function updateAngleSum() {
    // In a flat plane (curvature = 0), sum is 180.
    // In Hyperbolic (K < 0), sum is < 180 (approaches 0).
    // In Spherical (K > 0), sum is > 180 (approaches 540).
    // A mathematically sound approach involves the Gauss-Bonnet theorem: Area * K = Sum - Pi.
    // We approximate the Euclidean area of the base points first:
    const a = points[0].distanceTo(points[1]);
    const b = points[1].distanceTo(points[2]);
    const c = points[2].distanceTo(points[0]);
    const s = (a + b + c) / 2;
    const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    
    const sumRadians = Math.PI + (curvature * area);
    let sumDegrees = sumRadians * (180 / Math.PI);
    
    // Clamp to logical constraints for simple visualization
    if (sumDegrees < 0) sumDegrees = 0;
    if (sumDegrees > 540) sumDegrees = 540;
    
    angleSumElement.textContent = sumDegrees.toFixed(1) + "°";
}

updateAngleSum();

// --- UI Binding ---
const curvatureInput = document.getElementById('curvature');
const curvatureVal = document.getElementById('curvature-val');

curvatureInput.addEventListener('input', (e) => {
    curvature = parseFloat(e.target.value);
    curvatureVal.textContent = curvature.toFixed(2);
    
    // Update curvature uniform on all custom materials
    materialsToUpdate.forEach(m => {
        if (m && m.uniforms && m.uniforms.u_curvature) {
            m.uniforms.u_curvature.value = curvature;
        }
    });
    
    updateAngleSum();
});

// --- Interaction (Dragging) ---
let draggedObjectId = null;
let hoveredObjectId = null;
let isDragging = false;
const mouse = new THREE.Vector2();

container.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    
    if (isDragging && draggedObjectId) {
        const obj = idToObject[draggedObjectId];
        // Move the point based on mouse delta.
        // We calculate a ray intersection with the Y=0 plane to find the world position.
        // For simplicity in this demo, since moving the mouse in screen space corresponds
        // to moving the point on the ground plane relative to the camera:
        
        // Use standard Raycaster for Euclidean ground plane intersection
        const raycaster = new THREE.Raycaster();
        const normMouse = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );
        raycaster.setFromCamera(normMouse, camera);
        
        // Plane at Y=0
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        
        if (target) {
            points[obj.index].copy(target);
            obj.visual.position.copy(target);
            obj.picking.position.copy(target);
            updateLines();
            updateAngleSum();
        }
    }
});

container.addEventListener('mousedown', (e) => {
    // Read pixel from picking texture
    renderer.setRenderTarget(pickingTexture);
    renderer.clear();
    renderer.render(pickingScene, camera);
    
    const pixelBuffer = new Uint8Array(4);
    const gl = renderer.getContext();
    // Read the exact pixel
    const x = e.clientX;
    const y = window.innerHeight - e.clientY;
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
    
    renderer.setRenderTarget(null);
    
    // The ID was encoded into the color directly (e.g. ID 1 = Color(1), which is #000001, so R=1, G=0, B=0 roughly)
    // Wait, THREE.Color(1) means r=1, g=1, b=1? No, THREE.Color(integer) interprets it as a hex code.
    // ID 1 -> 0x000001 -> r=0, g=0, b=1.
    // So the ID is basically the B channel, or B + G*256 + R*65536.
    const id = (pixelBuffer[0] << 16) | (pixelBuffer[1] << 8) | (pixelBuffer[2]);
    
    if (id > 0 && idToObject[id]) {
        // Clicked a point!
        draggedObjectId = id;
        isDragging = true;
        // Don't lock controls if we clicked a point
        e.stopPropagation();
    }
});

container.addEventListener('mouseup', () => {
    isDragging = false;
    draggedObjectId = null;
});

// Update standard click to lock controls, but ensure we don't lock if dragging
container.addEventListener('click', (e) => {
    if (!controls.isLocked && !isDragging && !draggedObjectId) {
        controls.lock();
    }
});

// Remove old click listener that was unconditionally locking
// (It's replaced by the one above)

// --- Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Render Loop ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();

    // Movement
    if (controls.isLocked) {
        direction.z = Number(moveState.forward) - Number(moveState.backward);
        direction.x = Number(moveState.right) - Number(moveState.left);
        direction.normalize(); // consistent movement in all directions

        const speed = 5.0;
        if (moveState.forward || moveState.backward) controls.moveForward(direction.z * speed * delta);
        if (moveState.left || moveState.right) controls.moveRight(direction.x * speed * delta);
        
        // Keep to ground roughly
        camera.position.y = 1.5;
    }

    // 1. Render Main Scene
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    
    // Continuous hover check for pointer
    if (!controls.isLocked && !isDragging) {
        renderer.setRenderTarget(pickingTexture);
        renderer.clear();
        renderer.render(pickingScene, camera);
        
        const pixelBuffer = new Uint8Array(4);
        const gl = renderer.getContext();
        gl.readPixels(mouse.x, window.innerHeight - mouse.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
        const id = (pixelBuffer[0] << 16) | (pixelBuffer[1] << 8) | (pixelBuffer[2]);
        
        renderer.setRenderTarget(null);
        if (id > 0 && idToObject[id]) {
            document.body.style.cursor = 'pointer';
        } else {
            document.body.style.cursor = 'default';
        }
    }
    
    renderer.render(scene, camera);

    // 2. Render Map (if visible)
    if (mapVisible) {
        // We set viewport and scissor to the map container's rect
        const rect = mapContainer.getBoundingClientRect();
        
        // Convert to WebGL coordinates (bottom-left origin)
        const x = rect.left;
        const y = window.innerHeight - rect.bottom;
        const w = rect.width;
        const h = rect.height;
        
        renderer.setViewport(x, y, w, h);
        renderer.setScissor(x, y, w, h);
        renderer.setScissorTest(true);
        
        // Adjust map camera aspect and render
        mapCamera.left = -w/20;
        mapCamera.right = w/20;
        mapCamera.top = h/20;
        mapCamera.bottom = -h/20;
        mapCamera.updateProjectionMatrix();
        
        // Clear depth so map renders on top
        renderer.clearDepth();
        renderer.render(scene, mapCamera);
    }
}

animate();
