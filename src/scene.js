import * as THREE from 'three';
import { createCustomMaterial } from './shaders.js';

function createTextTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, 512, 512);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 240px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 15;
    ctx.strokeStyle = 'black';
    ctx.strokeText(text, 256, 256);
    ctx.fillText(text, 256, 256);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

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

    if (index === 1) {
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
                p.frustumCulled = false;
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
        centralRing.frustumCulled = false;
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
            l.frustumCulled = false;
            scene.add(l);
            activeMeshes.push(l);
        }

        const cubeGeom = new THREE.BoxGeometry(4, 4, 4, 20, 20, 20);
        const cubeMat = createCustomMaterial(0x3b82f6);
        materialsToUpdate.push(cubeMat);
        const cube = new THREE.Mesh(cubeGeom, cubeMat);
        cube.position.set(0, 4, -15);
        cube.frustumCulled = false;
        scene.add(cube);
        activeMeshes.push(cube);
        
    } else if (index === 3) {
        // Geometry Quirks (Demonstrates looping and parallel lines)
        
        // 1. Long corridor of arches to show looping
        const leftPillarGeom = new THREE.CylinderGeometry(0.5, 0.5, 10, 16);
        const rightPillarGeom = new THREE.CylinderGeometry(0.5, 0.5, 10, 16);
        const topGeom = new THREE.CylinderGeometry(0.5, 0.5, 10, 16);
        topGeom.rotateZ(Math.PI / 2);
        
        const colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
        
        let gateNumber = 0;
        for (let z = 0; z <= 400; z += 15) {
            const color = colors[(z / 15) % colors.length];
            const mat = createCustomMaterial(color);
            materialsToUpdate.push(mat);
            
            const left = new THREE.Mesh(leftPillarGeom, mat);
            left.position.set(-4, 5, -z);
            left.frustumCulled = false;
            scene.add(left);
            activeMeshes.push(left);
            
            const right = new THREE.Mesh(rightPillarGeom, mat);
            right.position.set(4, 5, -z);
            right.frustumCulled = false;
            scene.add(right);
            activeMeshes.push(right);
            
            const top = new THREE.Mesh(topGeom, mat);
            top.position.set(0, 10, -z);
            top.frustumCulled = false;
            scene.add(top);
            activeMeshes.push(top);
            
            const signGeom = new THREE.PlaneGeometry(6, 6);
            const tex = createTextTexture(gateNumber.toString());
            const signMat = createCustomMaterial(0xffffff);
            signMat.uniforms.u_useMap = { value: 1.0 };
            signMat.uniforms.u_map = { value: tex };
            materialsToUpdate.push(signMat);
            
            const sign = new THREE.Mesh(signGeom, signMat);
            sign.position.set(0, 14, -z);
            sign.frustumCulled = false;
            scene.add(sign);
            activeMeshes.push(sign);
            
            gateNumber++;
        }
        
        // 2. Parallel rails to show intersection/divergence
        const railGeom = new THREE.CylinderGeometry(0.2, 0.2, 800, 8, 100);
        railGeom.rotateX(Math.PI / 2);
        const railMat = createCustomMaterial(0xffffff);
        materialsToUpdate.push(railMat);
        
        const leftRail = new THREE.Mesh(railGeom, railMat);
        leftRail.position.set(-4, 0.5, -200);
        leftRail.frustumCulled = false;
        scene.add(leftRail);
        activeMeshes.push(leftRail);
        
        const rightRail = new THREE.Mesh(railGeom, railMat);
        rightRail.position.set(4, 0.5, -200);
        rightRail.frustumCulled = false;
        scene.add(rightRail);
        activeMeshes.push(rightRail);
    }
}
