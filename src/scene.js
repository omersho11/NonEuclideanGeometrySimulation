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
                const color = (i % 2 === 0) ? 0x10b981 : 0x06b6d4; // Alternate Emerald and Cyan
                const pMat = createCustomMaterial(color);
                materialsToUpdate.push(pMat);
                const p = new THREE.Mesh(pillarGeom, pMat);
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

        const cubeGeom = new THREE.BoxGeometry(4, 4, 4, 20, 20, 20);
        const cubeMat = createCustomMaterial(0x3b82f6);
        materialsToUpdate.push(cubeMat);
        const cube = new THREE.Mesh(cubeGeom, cubeMat);
        cube.position.set(0, 4, -15);
        scene.add(cube);
        activeMeshes.push(cube);
        
    } else if (index === 3) {
        // Riemann City (Demonstrates multi-sheeted spherical space)
        // Spaced out along Z axis to show different locations overlapping on the sphere
        const buildingGeom = new THREE.BoxGeometry(4, 15, 4, 10, 20, 10);
        
        const districts = [
            { z: 0, color: 0xef4444 },    // Red District
            { z: 80, color: 0x10b981 },   // Green District
            { z: 160, color: 0x3b82f6 },  // Blue District
            { z: 240, color: 0xf59e0b }   // Yellow District
        ];
        
        districts.forEach(district => {
            const dMat = createCustomMaterial(district.color);
            materialsToUpdate.push(dMat);
            
            // Build a small cluster of buildings
            for (let x = -10; x <= 10; x += 10) {
                for (let z = -10; z <= 10; z += 10) {
                    if (x === 0 && z === 0) continue; // Leave center empty
                    const b = new THREE.Mesh(buildingGeom, dMat);
                    // Add some height variation
                    const hOffset = Math.random() * 5;
                    b.position.set(x, 7.5 + hOffset, district.z + z);
                    b.scale.y = 1.0 + (hOffset / 15.0);
                    scene.add(b);
                    activeMeshes.push(b);
                }
            }
            
            // Add a central marker for the district
            const centerGeom = new THREE.TorusGeometry(3, 1, 16, 32);
            centerGeom.rotateX(Math.PI / 2);
            const cMat = createCustomMaterial(0xffffff);
            materialsToUpdate.push(cMat);
            const center = new THREE.Mesh(centerGeom, cMat);
            center.position.set(0, 10, district.z);
            scene.add(center);
            activeMeshes.push(center);
        });
    }
}
