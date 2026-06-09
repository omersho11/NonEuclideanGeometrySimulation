import * as THREE from 'three';

export const nonEuclideanShader = {
    uniforms: {
        u_curvature: { value: 0.0 },
        color: { value: new THREE.Color(0x3b82f6) }
    },
    vertexShader: `
        uniform float u_curvature;
        varying vec3 vWorldPosition;
        varying float vDistance;

        void main() {
            // Transform to world space first so curvature originates from world center
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            
            // Calculate distance from origin in XZ plane
            float r = length(worldPos.xz);
            
            if (r > 0.0001) {
                if (u_curvature > 0.0) {
                    float R = 1.0 / sqrt(u_curvature);
                    float scale = sin(r / R) / (r / R);
                    worldPos.x *= scale;
                    worldPos.z *= scale;
                    // Curve Y upwards to form a sphere
                    worldPos.y += R * (1.0 - cos(r / R));
                } else if (u_curvature < 0.0) {
                    float R = 1.0 / sqrt(-u_curvature);
                    float scale = sinh(r / R) / (r / R);
                    worldPos.x *= scale;
                    worldPos.z *= scale;
                    // Curve Y upwards to form a hyperboloid (bowl)
                    worldPos.y += R * (cosh(r / R) - 1.0);
                }
            }
            
            vWorldPosition = worldPos.xyz;
            vDistance = distance(cameraPosition, worldPos.xyz);
            
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: `
        uniform vec3 color;
        varying float vDistance;
        
        void main() {
            // Fade out objects that are too far away
            float alpha = 1.0 - smoothstep(20.0, 40.0, vDistance);
            gl_FragColor = vec4(color, alpha);
        }
    `,
    transparent: true,
    wireframe: true
};

export const createCustomMaterial = (colorHex) => {
    return new THREE.ShaderMaterial({
        uniforms: {
            u_curvature: { value: 0.0 }, // Updated externally
            color: { value: new THREE.Color(colorHex) }
        },
        vertexShader: nonEuclideanShader.vertexShader,
        fragmentShader: nonEuclideanShader.fragmentShader,
        transparent: true,
        wireframe: true
    });
};

export const createPickingMaterial = (id) => {
    return new THREE.ShaderMaterial({
        uniforms: {
            u_curvature: { value: 0.0 }, // Updated externally
            color: { value: new THREE.Color(id) } // ID encoded as color
        },
        vertexShader: nonEuclideanShader.vertexShader,
        fragmentShader: `
            uniform vec3 color;
            void main() {
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
};
