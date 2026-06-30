import * as THREE from 'three';
import { ControlsManager } from './controls.js';
import { createCustomMaterial, createPickingMaterial } from './shaders.js';
import { buildScene } from './scene.js';

// --- Error Overlay ---
window.addEventListener('error', (e) => {
    const errDiv = document.createElement('div');
    errDiv.style.position = 'absolute';
    errDiv.style.top = '10px';
    errDiv.style.left = '10px';
    errDiv.style.color = 'red';
    errDiv.style.background = 'rgba(0,0,0,0.8)';
    errDiv.style.padding = '10px';
    errDiv.style.zIndex = '9999';
    errDiv.style.fontFamily = 'monospace';
    errDiv.style.pointerEvents = 'none';
    errDiv.innerHTML = `<strong>Error:</strong> ${e.message}<br><small>${e.filename}:${e.lineno}</small>`;
    document.body.appendChild(errDiv);
});

// --- State ---
let curvature = 0.0;
let targetCurvature = 0.0;
let mapVisible = false;
let fadeEnabled = false;

// --- Setup ---
const container = document.body;
const mapContainer = document.getElementById('map-container');
const curvatureInput = document.getElementById('curvature');
const curvatureVal = document.getElementById('curvature-val');
const trueCurvatureVal = document.getElementById('true-curvature-val');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0a0c10);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = null;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 0);

const mapCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
mapCamera.position.set(0, 20, 0);
mapCamera.lookAt(0, 0, 0);

const controlsManager = new ControlsManager(camera, container);
scene.add(controlsManager.cameraGroup);

// Map Toggle & Curvature Adjust listener
document.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
        e.preventDefault();
        mapVisible = !mapVisible;
        if (mapVisible) mapContainer.classList.remove('hidden');
        else mapContainer.classList.add('hidden');
    }
    
    // Curvature adjustments with +/- or =/-
    if (e.key === '+' || e.key === '=' || e.key === '-') {
        const step = 0.05;
        const currentSlider = parseFloat(curvatureInput.value);
        let newSlider = e.key === '-' ? currentSlider - step : currentSlider + step;
        newSlider = Math.max(-1, Math.min(1, newSlider));
        curvatureInput.value = newSlider;
        curvatureInput.dispatchEvent(new Event('input'));
    }

    if (e.code === 'KeyF') {
        fadeEnabled = !fadeEnabled;
        if (fadeEnabled) {
            scene.fog = new THREE.FogExp2(0x0a0c10, 0.05);
        } else {
            scene.fog = null;
        }
        materialsToUpdate.forEach(m => {
            if (m && m.uniforms && m.uniforms.u_fadeEnabled) {
                m.uniforms.u_fadeEnabled.value = fadeEnabled ? 1.0 : 0.0;
            }
        });
    }
});

// --- Projectiles ---
class Projectile {
    constructor(x, z, height, dx, dz, dy) {
        this.baseX = x;
        this.baseZ = z;
        this.height = height;
        this.dx = dx;
        this.dz = dz;
        this.dy = dy;
        
        const geom = new THREE.SphereGeometry(0.4, 16, 16);
        const mat = createCustomMaterial(0xffffff); // Bright white ball
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        materialsToUpdate.push(mat);
        this.life = 6.0; // seconds
    }
    
    update(delta) {
        this.baseX += this.dx * delta;
        this.baseZ += this.dz * delta;
        this.height += this.dy * delta;
        this.dy -= 15.0 * delta; // Gravity
        
        if (this.height < 0.4) {
            this.height = 0.4;
            this.dy *= -0.6; // Bounce
            // Apply friction
            this.dx *= 0.98;
            this.dz *= 0.98;
        }
        
        // Shader automatically bends the (baseX, height, baseZ) unbent coordinate!
        this.mesh.position.set(this.baseX, this.height, this.baseZ);
        this.life -= delta;
    }
    
    destroy() {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        const idx = materialsToUpdate.indexOf(this.mesh.material);
        if (idx > -1) materialsToUpdate.splice(idx, 1);
    }
}

const projectiles = [];

function fireProjectile() {
    const yaw = camera.rotation.y;
    const pitch = camera.rotation.x; // positive is looking up
    
    const speed = 25.0;
    const dx = -Math.sin(yaw) * Math.cos(pitch) * speed;
    const dz = -Math.cos(yaw) * Math.cos(pitch) * speed;
    const dy = Math.sin(pitch) * speed;
    
    // Add velocity of the player for momentum
    const moveZ = Number(controlsManager.moveState.forward) - Number(controlsManager.moveState.backward);
    const moveX = Number(controlsManager.moveState.right) - Number(controlsManager.moveState.left);
    const playerSpeed = 10.0;
    const pdx = -Math.sin(yaw) * moveZ * playerSpeed + Math.cos(yaw) * moveX * playerSpeed;
    const pdz = -Math.cos(yaw) * moveZ * playerSpeed - Math.sin(yaw) * moveX * playerSpeed;
    
    const p = new Projectile(
        controlsManager.baseX, 
        controlsManager.baseZ, 
        controlsManager.baseHeight, 
        dx + pdx, dz + pdz, dy
    );
    projectiles.push(p);
}

document.addEventListener('mousedown', (e) => {
    if (controlsManager.controls.isLocked && e.button === 0) {
        fireProjectile();
    }
});

// --- Base Geometry ---
const materialsToUpdate = [];
const customMaterial = createCustomMaterial(0x3b82f6);
materialsToUpdate.push(customMaterial);

const gridGeom = new THREE.PlaneGeometry(800, 800, 400, 400); // Massive grid
gridGeom.rotateX(-Math.PI / 2);
const grid = new THREE.Mesh(gridGeom, customMaterial);
grid.frustumCulled = false;
customMaterial.uniforms.u_isGrid = { value: 1.0 }; // Flag to prevent grid from fading
scene.add(grid);

// --- Picking & Triangle ---
const pickingScene = new THREE.Scene();
const pickingTexture = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

const points = [
    new THREE.Vector3(0, 0, -3),
    new THREE.Vector3(-3, 0, 3),
    new THREE.Vector3(3, 0, 3)
];
const idToObject = {};

const vGeom = new THREE.SphereGeometry(0.2, 16, 16);
const vMat = createCustomMaterial(0xff3366);
materialsToUpdate.push(vMat);

points.forEach((p, index) => {
    const s = new THREE.Mesh(vGeom, vMat);
    s.position.copy(p);
    s.frustumCulled = false;
    scene.add(s);
    
    const id = index + 1;
    const pMat = createPickingMaterial(id);
    materialsToUpdate.push(pMat);
    const pSphere = new THREE.Mesh(vGeom, pMat);
    pSphere.position.copy(p);
    pSphere.frustumCulled = false;
    pickingScene.add(pSphere);
    
    idToObject[id] = { visual: s, picking: pSphere, index: index };
});

const lineMat = createCustomMaterial(0xffaa00);
lineMat.linewidth = 3;
materialsToUpdate.push(lineMat);

function createSubdividedLine(p1, p2, segments = 50) {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array((segments + 1) * 3);
    const uvs = new Float32Array((segments + 1) * 2);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    const line = new THREE.Line(geom, lineMat);
    line.frustumCulled = false;
    return line;
}

const lines = [
    createSubdividedLine(points[0], points[1]),
    createSubdividedLine(points[1], points[2]),
    createSubdividedLine(points[2], points[0])
];
lines.forEach(l => scene.add(l));

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
updateLines();

// --- Map Marker ---
const mapMarkerGroup = new THREE.Group();

const dotGeo = new THREE.CircleGeometry(1.5, 32);
const dotMat = new THREE.MeshBasicMaterial({ color: 0xef4444, depthTest: false, side: THREE.DoubleSide, transparent: true, opacity: 1.0 });
const dot = new THREE.Mesh(dotGeo, dotMat);
dot.rotation.x = -Math.PI / 2;
mapMarkerGroup.add(dot);

const arrowGeo = new THREE.ConeGeometry(1.2, 4.0, 16);
const arrowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, side: THREE.DoubleSide, transparent: true, opacity: 1.0 });
const arrow = new THREE.Mesh(arrowGeo, arrowMat);
arrow.position.set(0, 0, -2.5);
arrow.rotation.x = -Math.PI / 2;
mapMarkerGroup.add(arrow);

mapMarkerGroup.position.set(0, 15, 0); // Elevated higher
mapMarkerGroup.visible = false; // Hide from main camera
scene.add(mapMarkerGroup);

// --- Architectural Scene Loading ---
const activeSceneMeshes = [];
buildScene(scene, 1, materialsToUpdate, activeSceneMeshes);

const sceneSelect = document.getElementById('scene-select');
sceneSelect.addEventListener('change', (e) => {
    buildScene(scene, parseInt(e.target.value), materialsToUpdate, activeSceneMeshes);
    updateCurvatureUniforms();
});

// Sync slider drag to target curvature

// --- Angle Math ---
const angleSumElement = document.getElementById('angle-sum');
function updateAngleSum() {
    const a = points[0].distanceTo(points[1]);
    const b = points[1].distanceTo(points[2]);
    const c = points[2].distanceTo(points[0]);
    const s = (a + b + c) / 2;
    const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
    
    let sumRadians;
    if (curvature === 0) sumRadians = Math.PI;
    else if (curvature > 0) sumRadians = Math.PI + 2 * Math.PI * (1 - Math.exp(-curvature * area * 0.1));
    else sumRadians = Math.PI - Math.PI * (1 - Math.exp(curvature * area * 0.1));
    
    angleSumElement.textContent = (sumRadians * (180 / Math.PI)).toFixed(1) + "°";
}
updateAngleSum();

// --- Environment Colors ---
function updateEnvironmentColor() {
    const cFlat = new THREE.Color(0x0a0c10); // Dark neutral
    const cSphere = new THREE.Color(0x0f172a); // Deep blue night
    const cHyper = new THREE.Color(0x2e0615); // Deep red/purple void
    
    let color = new THREE.Color();
    if (curvature >= 0) {
        color.lerpColors(cFlat, cSphere, Math.min(1, curvature * 3.0));
    } else {
        color.lerpColors(cFlat, cHyper, Math.min(1, -curvature * 3.0));
    }
    
    renderer.setClearColor(color);
    if (scene.fog) {
        scene.fog.color.copy(color);
    }
}

// --- Curvature Binding ---

function updateCurvatureUniforms() {
    materialsToUpdate.forEach(m => {
        if (m && m.uniforms && m.uniforms.u_curvature) {
            m.uniforms.u_curvature.value = curvature;
        }
    });
}

curvatureInput.addEventListener('input', (e) => {
    const rawValue = parseFloat(e.target.value);
    // Non-linear mapping: values near 0 change slowly, but grow fast towards the extremes
    targetCurvature = rawValue * rawValue * rawValue; 
    
    // Display raw value and true value on UI
    curvatureVal.textContent = rawValue.toFixed(2); 
    trueCurvatureVal.textContent = targetCurvature.toFixed(4);
});

// --- Interaction ---
let draggedObjectId = null;
let isDragging = false;
const mouse = new THREE.Vector2();

container.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    
    if (isDragging && draggedObjectId) {
        const obj = idToObject[draggedObjectId];
        const raycaster = new THREE.Raycaster();
        const normMouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
        raycaster.setFromCamera(normMouse, camera);
        
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        
        if (target) {
            // Target is relative to the camera, so add the player's true unbent base position
            target.x += controlsManager.baseX;
            target.z += controlsManager.baseZ;
            points[obj.index].copy(target);
            obj.visual.position.copy(target);
            obj.picking.position.copy(target);
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
    gl.readPixels(e.clientX, window.innerHeight - e.clientY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
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

container.addEventListener('click', () => {
    if (!controlsManager.isLocked() && !isDragging && !draggedObjectId) {
        controlsManager.lock();
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Render Loop ---
const clock = new THREE.Clock();
const fpsElement = document.getElementById('fps-counter');
let frames = 0;
let lastFpsTime = 0;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    
    frames++;
    if (elapsedTime - lastFpsTime >= 1.0) {
        fpsElement.textContent = `FPS: ${frames}`;
        frames = 0;
        lastFpsTime = elapsedTime;
    }
    
    // Smooth curvature morphing
    curvature += (targetCurvature - curvature) * 5.0 * delta;
    updateCurvatureUniforms(); // Push smoothed value to shaders
    updateEnvironmentColor();
    updateAngleSum();

    controlsManager.update(delta, curvature);
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update(delta);
        if (p.life <= 0) {
            p.destroy();
            projectiles.splice(i, 1);
        }
    }

    materialsToUpdate.forEach(m => {
        if (m && m.uniforms && m.uniforms.u_playerBasePos) {
            m.uniforms.u_playerBasePos.value.set(controlsManager.baseX, controlsManager.baseZ);
        }
    });

    // Make the grid infinite by snapping its unwarped XZ origin to the player's base grid cell
    const gridStep = 0.5; // Snap interval based on geometry subdivision
    grid.position.x = Math.round(controlsManager.baseX / gridStep) * gridStep;
    grid.position.z = Math.round(controlsManager.baseZ / gridStep) * gridStep;

    // Render Main
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    
    if (!controlsManager.isLocked() && !isDragging) {
        renderer.setRenderTarget(pickingTexture);
        renderer.clear();
        renderer.render(pickingScene, camera);
        const pixelBuffer = new Uint8Array(4);
        const gl = renderer.getContext();
        gl.readPixels(mouse.x, window.innerHeight - mouse.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
        const id = (pixelBuffer[0] << 16) | (pixelBuffer[1] << 8) | (pixelBuffer[2]);
        renderer.setRenderTarget(null);
        document.body.style.cursor = (id > 0 && idToObject[id]) ? 'pointer' : 'default';
    }
    
    renderer.render(scene, camera);

    // Render Map
    if (mapVisible) {
        materialsToUpdate.forEach(m => {
            if (m && m.uniforms && m.uniforms.u_isMap) {
                m.uniforms.u_isMap.value = 1.0;
            }
        });

        // The map marker and camera track the unbent position (baseX/baseZ)
        mapMarkerGroup.position.set(controlsManager.baseX, 10, controlsManager.baseZ);
        const yaw = controlsManager.camera.rotation.y;
        mapMarkerGroup.rotation.y = yaw;

        mapCamera.position.x = controlsManager.baseX;
        mapCamera.position.z = controlsManager.baseZ;
        mapCamera.up.set(0, 0, -1);
        mapCamera.lookAt(controlsManager.baseX, 0, controlsManager.baseZ);
        
        const rect = mapContainer.getBoundingClientRect();
        const x = rect.left, y = window.innerHeight - rect.bottom, w = rect.width, h = rect.height;
        
        renderer.setViewport(x, y, w, h);
        renderer.setScissor(x, y, w, h);
        renderer.setScissorTest(true);
        
        mapCamera.left = -w/20; mapCamera.right = w/20;
        mapCamera.top = h/20; mapCamera.bottom = -h/20;
        mapCamera.updateProjectionMatrix();
        
        mapMarkerGroup.visible = true; // Show for map render
        renderer.clearDepth();
        renderer.render(scene, mapCamera);
        mapMarkerGroup.visible = false; // Hide again

        materialsToUpdate.forEach(m => {
            if (m && m.uniforms && m.uniforms.u_isMap) {
                m.uniforms.u_isMap.value = 0.0;
            }
        });
    }
}

animate();
