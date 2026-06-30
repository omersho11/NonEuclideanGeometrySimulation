import * as THREE from 'three';

export const nonEuclideanShader = {
    uniforms: {
        u_curvature: { value: 0.0 },
        u_isMap: { value: 0.0 },
        u_fadeEnabled: { value: 1.0 },
        color: { value: new THREE.Color(0x3b82f6) }
    },
    vertexShader: `
        uniform float u_curvature;
        uniform float u_isMap;
        uniform vec2 u_playerBasePos;
        varying vec3 vWorldPosition;
        varying vec2 vBasePosition;
        varying float vDistance;
        varying float vOriginalR;
        varying vec2 vUv;

        void main() {
            vUv = uv;
            vOriginalR = 0.0;
            // Transform to world space first so curvature originates from world center
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vBasePosition = worldPos.xz;
            
            if (u_isMap > 0.5) {
                float dx = worldPos.x - u_playerBasePos.x;
                float dz = worldPos.z - u_playerBasePos.y;
                float d = sqrt(dx*dx + dz*dz);
                
                vec2 projectedPos = vec2(dx, dz);
                
                if (d > 0.0001) {
                    if (u_curvature > 0.0) {
                        float R = 1.0 / sqrt(max(u_curvature, 0.00001));
                        float theta = min(d / R, 3.14159265 * 0.9);
                        float r_proj = 2.0 * R * tan(theta / 2.0);
                        projectedPos *= (r_proj / d);
                    } else if (u_curvature < 0.0) {
                        float R = 1.0 / sqrt(max(-u_curvature, 0.00001));
                        float e = exp(d / R);
                        float tanh_val = (e - 1.0) / (e + 1.0);
                        float r_proj = 2.0 * R * tanh_val;
                        projectedPos *= (r_proj / d);
                    }
                }
                
                worldPos = vec4(u_playerBasePos.x + projectedPos.x, 0.0, u_playerBasePos.y + projectedPos.y, 1.0);
                vWorldPosition = worldPos.xyz;
                vDistance = d;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            } else {
                vec2 offset = worldPos.xz - u_playerBasePos;
                float r = length(offset);
                vOriginalR = r;
                
                if (r > 0.0001) {
                    if (u_curvature > 0.0) {
                        float R = 1.0 / sqrt(max(u_curvature, 0.00001));
                        float scale = sin(r / R) / (r / R);
                        
                        vec3 P_surf;
                        P_surf.x = offset.x * scale;
                        P_surf.z = offset.y * scale;
                        P_surf.y = -R * (1.0 - cos(r / R));
                        
                        vec3 N;
                        N.x = (offset.x / r) * sin(r / R);
                        N.z = (offset.y / r) * sin(r / R);
                        N.y = cos(r / R);
                        
                        worldPos.xyz = P_surf + N * worldPos.y;
                    } else if (u_curvature < 0.0) {
                        float R = 1.0 / sqrt(max(-u_curvature, 0.00001));
                        float scale = sinh(r / R) / (r / R);
                        
                        vec3 P_surf;
                        P_surf.x = offset.x * scale;
                        P_surf.z = offset.y * scale;
                        P_surf.y = R * (cosh(r / R) - 1.0);
                        
                        vec3 N;
                        N.x = -(offset.x / r) * sinh(r / R) / cosh(r / R);
                        N.z = -(offset.y / r) * sinh(r / R) / cosh(r / R);
                        N.y = 1.0 / cosh(r / R);
                        
                        worldPos.xyz = P_surf + N * worldPos.y;
                    } else {
                        worldPos.x = offset.x;
                        worldPos.z = offset.y;
                    }
                } else {
                    worldPos.x = offset.x;
                    worldPos.z = offset.y;
                }
                
                vWorldPosition = worldPos.xyz;
                vDistance = distance(cameraPosition, worldPos.xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        }
    `,
    fragmentShader: `
        uniform vec3 color;
        uniform float u_fadeEnabled;
        uniform float u_isGrid;
        uniform float u_curvature;
        uniform float u_useMap;
        uniform sampler2D u_map;
        uniform vec2 u_playerBasePos;
        varying vec3 vWorldPosition;
        varying float vDistance;
        varying vec2 vBasePosition;
        varying float vOriginalR;
        varying vec2 vUv;
        
        void main() {
            // Unconditional texture sample to avoid derivative errors in divergent control flow
            vec4 texColor = texture2D(u_map, vUv);
            
            if (u_curvature > 0.0) {
                float R = 1.0 / sqrt(max(u_curvature, 0.00001));
                if (vOriginalR > 3.14159265 * R) {
                    discard; // Prevent anything from wrapping multiple times and clipping through the floor
                }
            }
            
            vec3 finalColor = color;
            if (u_useMap > 0.5) {
                if (texColor.a < 0.5) discard;
                finalColor = texColor.rgb;
            }
            
            float unbentDistance = distance(u_playerBasePos, vBasePosition);
            
            float alpha = 1.0;
            if (u_fadeEnabled > 0.5 && u_isGrid < 0.5) {
                alpha = 1.0 - smoothstep(30.0, 60.0, unbentDistance);
            }
            if (alpha <= 0.01) discard;
            
            // Calculate normals via standard derivatives for gorgeous flat lighting
            vec3 dx = dFdx(vWorldPosition);
            vec3 dy = dFdy(vWorldPosition);
            vec3 normal = normalize(cross(dx, dy));
            if (!gl_FrontFacing) normal = -normal;
            
            // Basic directional light
            vec3 lightDir = normalize(vec3(0.3, 1.0, 0.4));
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 lighting = vec3(0.3) + vec3(0.7) * diff; // Ambient + Diffuse
            
            // Checkerboard pattern using unbent world coordinates
            if (u_isGrid > 0.5) {
                float checker = mod(floor(vBasePosition.x * 0.5) + floor(vBasePosition.y * 0.5), 2.0);
                if (checker > 0.5) finalColor = color * 0.85;
                
                // Add faint grid lines for polish
                vec2 gridUV = fract(vBasePosition);
                if (gridUV.x < 0.05 || gridUV.y < 0.05) {
                    finalColor += vec3(0.1);
                }
            }
            
            gl_FragColor = vec4(finalColor * lighting, alpha);
        }`,
    transparent: true,
    wireframe: false
};

export const createCustomMaterial = (colorHex) => {
    return new THREE.ShaderMaterial({
        uniforms: {
            u_curvature: { value: 0.0 }, // Updated externally
            u_isMap: { value: 0.0 },
            u_isGrid: { value: 0.0 },
            u_useMap: { value: 0.0 },
            u_map: { value: null },
            u_playerBasePos: { value: new THREE.Vector2(0, 0) },
            u_fadeEnabled: { value: 1.0 },
            color: { value: new THREE.Color(colorHex) }
        },
        vertexShader: nonEuclideanShader.vertexShader,
        fragmentShader: nonEuclideanShader.fragmentShader,
        transparent: true,
        wireframe: false,
        extensions: {
            derivatives: true
        }
    });
};

export const createPickingMaterial = (id) => {
    return new THREE.ShaderMaterial({
        uniforms: {
            u_curvature: { value: 0.0 }, // Updated externally
            u_isMap: { value: 0.0 },
            u_playerBasePos: { value: new THREE.Vector2(0, 0) },
            color: { value: new THREE.Color(id) } // ID encoded as color
        },
        vertexShader: nonEuclideanShader.vertexShader,
        fragmentShader: `
            uniform vec3 color;
            varying vec3 vWorldPosition;
            varying vec2 vBasePosition;
            varying float vDistance;
            varying float vOriginalR;
            varying vec2 vUv;
            void main() {
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
};
