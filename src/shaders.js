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
                
                vOriginalR = d; // Store for fragment shader clipping
                
                vec2 projectedPos = vec2(dx, dz);
                
                if (d > 0.0001) {
                    if (u_curvature > 0.0) {
                        // Spherical: Orthographic Projection (Compact Sphere)
                        float R = 1.0 / sqrt(max(u_curvature, 0.00001));
                        float r_proj = R * sin(min(d / R, 3.14159265 * 0.5));
                        projectedPos *= (r_proj / d);
                    } else if (u_curvature < 0.0) {
                        // Hyperbolic: Exponential Expansion
                        float R = 1.0 / sqrt(max(-u_curvature, 0.00001));
                        float r_proj = R * sinh(d / R);
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
        uniform float u_isMap;
        uniform float u_curvature;
        uniform float u_useMap;
        uniform sampler2D u_map;
        uniform vec2 u_playerBasePos;
        varying vec3 vWorldPosition;
        varying float vDistance;
        varying vec2 vBasePosition;
        varying float vOriginalR;
        varying vec2 vUv;
        
        uniform vec2 u_mapCenter;
        uniform float u_mapRadius;
        
        void main() {
            // Clip map rendering to a perfect circle and equator
            if (u_isMap > 0.5) {
                if (distance(gl_FragCoord.xy, u_mapCenter) > u_mapRadius) {
                    discard;
                }
                // Clip spherical map at the equator to prevent messy folding
                if (u_curvature > 0.0) {
                    float R = 1.0 / sqrt(max(u_curvature, 0.00001));
                    if (vOriginalR > 3.14159265 * 0.5 * R) {
                        discard;
                    }
                }
            }
            
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
                alpha = 1.0 - smoothstep(150.0, 300.0, unbentDistance);
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
            
            // Grid Patterns using unbent world coordinates
            float gridType = floor(u_isGrid + 0.5);
            if (gridType == 1.0) {
                // Classic Squares
                float checker = mod(floor(vBasePosition.x * 0.5) + floor(vBasePosition.y * 0.5), 2.0);
                if (checker > 0.5) finalColor = color * 0.85;
                vec2 gridUV = fract(vBasePosition);
                if (gridUV.x < 0.05 || gridUV.y < 0.05) finalColor += vec3(0.1);
            } else if (gridType == 2.0) {
                // Ethereal Hexagonal Tessellation (Escher-style glow)
                vec2 p = vBasePosition * 0.5; // Larger hexagons
                vec2 r = vec2(1.0, 1.732);
                vec2 h = r * 0.5;
                vec2 a = mod(p, r) - h;
                vec2 b = mod(p - h, r) - h;
                vec2 gv = dot(a, a) < dot(b, b) ? a : b;
                float hexDist = max(abs(gv.x), dot(abs(gv), normalize(vec2(1.0, 1.732))));
                float edgeDist = 0.5 - hexDist;
                float glow = 0.03 / max(edgeDist, 0.005);
                vec3 neonColor = vec3(0.1, 0.6, 1.0);
                float innerDist = length(gv);
                float rings = sin(innerDist * 40.0 - unbentDistance * 2.0);
                glow += 0.01 / max(abs(rings), 0.01) * 0.3;
                finalColor = color * 0.15 + neonColor * glow;
                finalColor = min(finalColor, vec3(1.0));
            } else if (gridType == 3.0) {
                // Triangular Matrix
                vec2 p = vBasePosition * 0.5; // Larger triangles
                float y = p.y * 1.15470053838;
                float x = p.x - y * 0.5;
                vec2 gridCoord = fract(vec2(x, y));
                float d1 = gridCoord.x;
                float d2 = gridCoord.y;
                float d3 = 1.0 - gridCoord.x - gridCoord.y;
                float edge = min(min(abs(d1), abs(d2)), abs(d3));
                float glow = smoothstep(0.05, 0.0, edge);
                vec3 baseColor = vec3(0.05, 0.08, 0.15);
                vec3 edgeColor = vec3(0.2, 0.8, 1.0);
                finalColor = mix(baseColor, edgeColor, glow);
            } else if (gridType == 4.0) {
                // Voronoi Quantum Dots
                vec2 p = vBasePosition * 2.0;
                vec2 i = floor(p);
                vec2 f = fract(p);
                float minDist = 1.0;
                for (int y = -1; y <= 1; y++) {
                    for (int x = -1; x <= 1; x++) {
                        vec2 neighbor = vec2(float(x), float(y));
                        vec2 r = fract(sin(vec2(dot(i + neighbor, vec2(127.1, 311.7)), dot(i + neighbor, vec2(269.5, 183.3)))) * 43758.5453);
                        vec2 diff = neighbor + r - f;
                        float dist = length(diff);
                        minDist = min(minDist, dist);
                    }
                }
                float dotVal = smoothstep(0.2, 0.0, minDist);
                float cellVal = smoothstep(0.8, 0.9, minDist);
                vec3 baseColor = vec3(0.0, 0.05, 0.0);
                vec3 dotColor = vec3(0.4, 1.0, 0.3);
                vec3 cellColor = vec3(0.0, 0.3, 0.1);
                finalColor = mix(baseColor, dotColor, dotVal);
                finalColor = mix(finalColor, cellColor, cellVal);
            } else if (gridType == 5.0) {
                // Interference Waves
                vec2 p = vBasePosition * 0.5;
                float wave1 = sin(p.x * 5.0 + sin(p.y * 3.0));
                float wave2 = sin(p.y * 5.0 + cos(p.x * 4.0));
                float wave3 = sin((p.x + p.y) * 4.0);
                float interference = (wave1 + wave2 + wave3) / 3.0;
                float bands = sin(interference * 20.0);
                float glow = smoothstep(0.8, 1.0, bands);
                vec3 baseColor = vec3(0.1, 0.02, 0.15);
                vec3 waveColor = vec3(1.0, 0.3, 0.8);
                finalColor = mix(baseColor, waveColor, glow * 0.8 + abs(interference) * 0.2);
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
            u_mapCenter: { value: new THREE.Vector2(0, 0) },
            u_mapRadius: { value: 0.0 },
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
