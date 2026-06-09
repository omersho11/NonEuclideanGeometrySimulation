import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class ControlsManager {
    constructor(camera, container) {
        this.camera = camera;
        this.cameraGroup = new THREE.Group();
        this.cameraGroup.add(this.camera);
        
        this.controls = new PointerLockControls(this.camera, document.body);
        this.baseHeight = 1.5; // The height of the player above the ground
        this.baseX = 0;
        this.baseZ = 5; // Starting position
        
        // Initial setup
        this.camera.position.set(0, 0, 0); // Local to group
        
        this.moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };
        this.direction = new THREE.Vector3();
        
        this.setupKeyboard();
        
        // Expose lock state
        this.crosshair = document.getElementById('crosshair');
        this.controls.addEventListener('lock', () => this.crosshair.style.display = 'block');
        this.controls.addEventListener('unlock', () => this.crosshair.style.display = 'none');
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
        const dx = Math.sin(yaw) * moveZ * speed * delta + Math.cos(yaw) * moveX * speed * delta;
        const dz = Math.cos(yaw) * moveZ * speed * delta - Math.sin(yaw) * moveX * speed * delta;
        
        this.baseX += dx;
        this.baseZ += dz;

        // Vertical movement relative to the curved floor
        if (this.moveState.up) this.baseHeight += speed * delta;
        if (this.moveState.down) this.baseHeight -= speed * delta;
        
        // Prevent going completely under the floor
        if (this.baseHeight < 0.5) this.baseHeight = 0.5;

        // Calculate mapped position and surface normal
        const r = Math.sqrt(this.baseX ** 2 + this.baseZ ** 2);
        let xp = this.baseX;
        let zp = this.baseZ;
        let yp = 0;
        let normal = new THREE.Vector3(0, 1, 0);
        
        if (r > 0.0001) {
            if (curvature > 0.0) {
                const R = 1.0 / Math.sqrt(curvature);
                const scale = Math.sin(r / R) / (r / R);
                xp *= scale;
                zp *= scale;
                yp = R * (1.0 - Math.cos(r / R));
                normal.set(-xp, R - yp, -zp).normalize();
            } else if (curvature < 0.0) {
                const R = 1.0 / Math.sqrt(-curvature);
                const scale = Math.sinh(r / R) / (r / R);
                xp *= scale;
                zp *= scale;
                yp = R * (Math.cosh(r / R) - 1.0);
                normal.set(-xp, yp + R, -zp).normalize();
            }
        }
        
        // Set camera group position offset by baseHeight along the normal
        this.cameraGroup.position.set(
            xp + normal.x * this.baseHeight,
            yp + normal.y * this.baseHeight,
            zp + normal.z * this.baseHeight
        );
        
        // Tilt the camera group to stand upright on the surface
        this.cameraGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    }

    lock() {
        this.controls.lock();
    }

    isLocked() {
        return this.controls.isLocked;
    }
}
