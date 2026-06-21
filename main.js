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

// Main Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 5);

// Map Camera (Orthographic)
const mapCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
mapCamera.position.set(0, 20, 0);
mapCamera.up.set(0, 0, -1);
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
        u_playerPos: { value: new THREE.Vector3(0, 0, 0) },
        color: { value: new THREE.Color(0x3b82f6) }
    },
    vertexShader: `
        uniform float u_curvature;
        uniform vec3 u_playerPos;
        varying vec3 vWorldPosition;

        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vec3 relativePos = worldPosition.xyz - u_playerPos;
            
            float r = length(relativePos);
            
            if (r > 0.0001) {
                if (u_curvature > 0.0) {
                    float k_sqrt = sqrt(u_curvature);
                    float scale = sin(r * k_sqrt) / (r * k_sqrt);
                    relativePos *= scale;
                } else if (u_curvature < 0.0) {
                    float k_sqrt = sqrt(-u_curvature);
                    float scale = sinh(r * k_sqrt) / (r * k_sqrt);
                    relativePos *= scale;
                }
            }
            
            worldPosition.xyz = u_playerPos + relativePos;
            vWorldPosition = worldPosition.xyz;
            
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 color;
        
        void main() {
            gl_FragColor = vec4(color, 1.0);
        }
    `,
    transparent: false,
    wireframe: false
};

const customMaterial = new THREE.ShaderMaterial({
    uniforms: {
        u_curvature: nonEuclideanShader.uniforms.u_curvature,
        u_playerPos: nonEuclideanShader.uniforms.u_playerPos,
        color: { value: new THREE.Color(0x3b82f6) }
    },
    vertexShader: nonEuclideanShader.vertexShader,
    fragmentShader: nonEuclideanShader.fragmentShader,
    transparent: false,
    wireframe: false
});

// --- Picking Setup ---
const pickingScene = new THREE.Scene();
const pickingTexture = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
const pickingMaterial = new THREE.ShaderMaterial({
    uniforms: {
        u_curvature: nonEuclideanShader.uniforms.u_curvature,
        u_playerPos: nonEuclideanShader.uniforms.u_playerPos,
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

// Create solid grid lines instead of a wireframe plane to clearly show curvature without z-fighting
const lineGeoX = new THREE.BoxGeometry(100, 0.1, 0.1, 200, 1, 1);
for(let z = -50; z <= 50; z += 5) {
    const mesh = new THREE.Mesh(lineGeoX, customMaterial);
    mesh.position.set(0, 0, z);
    scene.add(mesh);
}
const lineGeoZ = new THREE.BoxGeometry(0.1, 0.1, 100, 1, 1, 200);
for(let x = -50; x <= 50; x += 5) {
    const mesh = new THREE.Mesh(lineGeoZ, customMaterial);
    mesh.position.set(x, 0, 0);
    scene.add(mesh);
}

// Interactive Triangle Vertices
const vGeom = new THREE.SphereGeometry(0.3, 16, 16);
const vMat = new THREE.ShaderMaterial({
    uniforms: {
        u_curvature: nonEuclideanShader.uniforms.u_curvature,
        u_playerPos: nonEuclideanShader.uniforms.u_playerPos,
        color: { value: new THREE.Color(0xff3366) }
    },
    vertexShader: nonEuclideanShader.vertexShader,
    fragmentShader: nonEuclideanShader.fragmentShader,
    transparent: false,
    wireframe: false
});

const points = [
    new THREE.Vector3(0, 0.1, -5),
    new THREE.Vector3(-5, 0.1, 5),
    new THREE.Vector3(5, 0.1, 5)
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
        u_playerPos: nonEuclideanShader.uniforms.u_playerPos,
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

// Collect all materials that need curvature and player pos updates
const materialsToUpdate = [
    customMaterial, 
    pickingMaterial, 
    lineMat, 
    vMat,
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
    const a = points[0].distanceTo(points[1]);
    const b = points[1].distanceTo(points[2]);
    const c = points[2].distanceTo(points[0]);
    const s = (a + b + c) / 2;
    const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    
    const sumRadians = Math.PI + (curvature * area);
    let sumDegrees = sumRadians * (180 / Math.PI);
    
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
    
    materialsToUpdate.forEach(m => {
        if (m && m.uniforms && m.uniforms.u_curvature) {
            m.uniforms.u_curvature.value = curvature;
        }
    });
    
    updateAngleSum();
});

// --- Interaction (Dragging) ---
let draggedObjectId = null;
let isDragging = false;
const mouse = new THREE.Vector2();

container.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    
    if (isDragging && draggedObjectId) {
        const obj = idToObject[draggedObjectId];
        
        const raycaster = new THREE.Raycaster();
        const normMouse = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );
        raycaster.setFromCamera(normMouse, camera);
        
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        
        if (target) {
            points[obj.index].copy(target);
            points[obj.index].y = 0.1; // keep slightly above ground
            obj.visual.position.copy(target);
            obj.visual.position.y = 0.1;
            obj.picking.position.copy(target);
            obj.picking.position.y = 0.1;
            updateLines();
            updateAngleSum();
        }
    }
});

container.addEventListener('mousedown', (e) => {
    renderer.setRenderTarget(pickingTexture);
    renderer.clear();
    renderer.render(pickingScene, camera);
    
    const pixelBuffer = new Uint8Array(4);
    const gl = renderer.getContext();
    const x = e.clientX;
    const y = window.innerHeight - e.clientY;
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
    
    renderer.setRenderTarget(null);
    
    const id = (pixelBuffer[0] << 16) | (pixelBuffer[1] << 8) | (pixelBuffer[2]);
    
    if (id > 0 && idToObject[id]) {
        draggedObjectId = id;
        isDragging = true;
        e.stopPropagation();
    }
});

container.addEventListener('mouseup', () => {
    isDragging = false;
    draggedObjectId = null;
});

container.addEventListener('click', (e) => {
    if (!controls.isLocked && !isDragging && !draggedObjectId) {
        controls.lock();
    }
});

// --- Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    pickingTexture.setSize(window.innerWidth, window.innerHeight);
});

// --- Render Loop ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();

    // Movement
    if (controls.isLocked) {
        // Fix for W and S being swapped
        direction.z = Number(moveState.backward) - Number(moveState.forward);
        direction.x = Number(moveState.right) - Number(moveState.left);
        direction.normalize(); 

        const speed = 5.0;
        if (moveState.forward || moveState.backward) controls.moveForward(direction.z * speed * delta);
        if (moveState.left || moveState.right) controls.moveRight(direction.x * speed * delta);
        
        camera.position.y = 1.5;
    }

    // Update player position uniform for shaders
    materialsToUpdate.forEach(m => {
        if (m && m.uniforms && m.uniforms.u_playerPos) {
            m.uniforms.u_playerPos.value.copy(camera.position);
        }
    });

    // 1. Render Main Scene
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    
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
        const rect = mapContainer.getBoundingClientRect();
        
        const x = rect.left;
        const y = window.innerHeight - rect.bottom;
        const w = rect.width;
        const h = rect.height;
        
        renderer.setViewport(x, y, w, h);
        renderer.setScissor(x, y, w, h);
        renderer.setScissorTest(true);
        
        // Make the map camera follow the player to show the projection at their position
        mapCamera.position.set(camera.position.x, 20, camera.position.z);
        
        mapCamera.left = -w/20;
        mapCamera.right = w/20;
        mapCamera.top = h/20;
        mapCamera.bottom = -h/20;
        mapCamera.updateProjectionMatrix();
        
        renderer.clearDepth();
        renderer.render(scene, mapCamera);
    }
}

animate();
