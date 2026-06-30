import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class ControlsManager {
    constructor(camera, container) {
        this.camera = camera;
        this.cameraGroup = new THREE.Group();
        this.cameraGroup.add(this.camera);
        
        this.controls = new PointerLockControls(this.camera, container);
        this.baseHeight = 1.5; // The height of the player above the ground
        this.baseX = 0;
        this.baseZ = 5; // Starting position
        this.bobTime = 0;
        
        // Initial setup
        this.camera.position.set(0, 0, 0); // Local to group
        this.camera.rotation.order = 'YXZ'; // Prevent Euler extraction gimbal lock/flips
        
        this.moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };
        this.direction = new THREE.Vector3();
        
        this.setupKeyboard();
        
        // Expose lock state
        this.crosshair = document.getElementById('crosshair');
        this.controls.addEventListener('lock', () => this.crosshair.style.display = 'block');
        this.controls.addEventListener('unlock', () => this.crosshair.style.display = 'none');

        container.addEventListener('click', () => {
            if (!this.controls.isLocked) {
                this.controls.lock();
            }
        });
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW') this.moveState.forward = true;
            if (e.code === 'KeyS') this.moveState.backward = true;
            if (e.code === 'KeyA') this.moveState.left = true;
            if (e.code === 'KeyD') this.moveState.right = true;
            if (e.code === 'Space') this.moveState.up = true;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.moveState.down = true;
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW') this.moveState.forward = false;
            if (e.code === 'KeyS') this.moveState.backward = false;
            if (e.code === 'KeyA') this.moveState.left = false;
            if (e.code === 'KeyD') this.moveState.right = false;
            if (e.code === 'Space') this.moveState.up = false;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.moveState.down = false;
        });
    }

    update(delta, curvature = 0) {
        if (!this.controls.isLocked) return;

        const speed = 10.0;
        const moveZ = Number(this.moveState.forward) - Number(this.moveState.backward);
        const moveX = Number(this.moveState.right) - Number(this.moveState.left);

        // Move in the unwarped base plane using the camera's local yaw
        const yaw = this.camera.rotation.y;
        const dx = -Math.sin(yaw) * moveZ * speed * delta + Math.cos(yaw) * moveX * speed * delta;
        const dz = -Math.cos(yaw) * moveZ * speed * delta - Math.sin(yaw) * moveX * speed * delta;
        
        this.baseX += dx;
        this.baseZ += dz;

        // Vertical movement relative to the curved floor
        if (this.moveState.up) this.baseHeight += speed * delta;
        if (this.moveState.down) this.baseHeight -= speed * delta;
        
        // Prevent going completely under the floor
        if (this.baseHeight < 0.5) this.baseHeight = 0.5;

        // Because the shader maps the world relative to u_playerBasePos,
        // the camera NEVER physically moves in 3D space! It just bobs up and down.
        this.cameraGroup.position.set(0, this.baseHeight, 0);
        this.cameraGroup.quaternion.identity();
    }

    lock() {
        this.controls.lock();
    }

    isLocked() {
        return this.controls.isLocked;
    }
}
