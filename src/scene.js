import * as THREE from 'three';
import { createCustomMaterial } from './shaders.js';

export function buildScene(scene, index, materialsToUpdate, activeMeshes) {
    // Clear previous
    activeMeshes.forEach(mesh => {
        scene.remove(mesh);
        if (mesh.material) {
            const idx = materialsToUpdate.indexOf(mesh.material);
            if (idx !== -1) materialsToUpdate.splice(idx, 1);
        }
    });
    activeMeshes.length = 0;

    if (index === 0) {
        // Standard Cube
        const boxGeom = new THREE.BoxGeometry(10, 10, 10, 30, 30, 30);
        const boxMat = createCustomMaterial(0xf59e0b);
        materialsToUpdate.push(boxMat);
        const box = new THREE.Mesh(boxGeom, boxMat);
        box.position.set(0, 5, -15);
        scene.add(box);
        activeMeshes.push(box);
        
    } else if (index === 1) {
        // Forest & Torus
        const pillarGeom = new THREE.BoxGeometry(1, 15, 1, 10, 50, 10);
        const pillarMat = createCustomMaterial(0x10b981);
        materialsToUpdate.push(pillarMat);

        for (let r = 5; r <= 30; r += 5) {
            const numPillars = r * 2;
            for (let i = 0; i < numPillars; i++) {
                const angle = (i / numPillars) * Math.PI * 2;
                const p = new THREE.Mesh(pillarGeom, pillarMat);
                p.position.set(Math.cos(angle) * r, 7.5, Math.sin(angle) * r);
                scene.add(p);
                activeMeshes.push(p);
            }
        }

        const ringGeom = new THREE.TorusGeometry(8, 0.5, 16, 100);
        ringGeom.rotateX(Math.PI / 2);
        const ringMat = createCustomMaterial(0xa855f7);
        materialsToUpdate.push(ringMat);
        const centralRing = new THREE.Mesh(ringGeom, ringMat);
        centralRing.position.set(0, 15, 0);
        scene.add(centralRing);
        activeMeshes.push(centralRing);
        
    } else if (index === 2) {
        // Parallel Lines
        const lineGeom = new THREE.CylinderGeometry(0.2, 0.2, 40, 8, 100);
        lineGeom.rotateX(Math.PI / 2);
        const lineMaterial = createCustomMaterial(0xef4444);
        materialsToUpdate.push(lineMaterial);
        
        for (let i = -15; i <= 15; i += 3) {
            const l = new THREE.Mesh(lineGeom, lineMaterial);
            l.position.set(i, 2, -10);
            scene.add(l);
            activeMeshes.push(l);
        }
    }
}
