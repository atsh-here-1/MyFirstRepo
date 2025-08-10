// Ensure THREE is loaded
if (typeof THREE === 'undefined') {
    console.error('Three.js has not been loaded. Check the script tag in your HTML.');
}

// 1. Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
    alpha: true // Make canvas transparent
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.setZ(5);

// 2. Mouse Tracking
const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// 3. Particle Geometry and Shader Material
const particleCount = 5000;
const positions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 10;
}

const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const vertexShader = `
    uniform float u_time;
    uniform vec2 u_mouse;
    varying float v_alpha;

    // 2D Random function
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    // 2D Noise function
    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
        vec3 pos = position;

        // Mouse interaction: create a "warp" effect
        float dist = distance(pos.xy, u_mouse * 5.0);
        float warpFactor = smoothstep(2.0, 0.0, dist);
        pos.z += warpFactor * 2.0;
        v_alpha = 1.0 - warpFactor;

        // Organic movement using noise
        pos.z += noise(vec2(pos.x * 0.1 + u_time * 0.1, pos.y * 0.1)) * 0.5;
        pos.x += noise(vec2(pos.z * 0.1, pos.y * 0.1 + u_time * 0.2)) * 0.5;

        vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        vec4 projectedPosition = projectionMatrix * viewPosition;

        gl_Position = projectedPosition;
        gl_PointSize = 10.0 * (1.0 / -viewPosition.z);
    }
`;

const fragmentShader = `
    uniform float u_time;
    varying float v_alpha;

    void main() {
        // Create soft circular particles
        float dist = distance(gl_PointCoord, vec2(0.5));
        float strength = 1.0 - smoothstep(0.4, 0.5, dist);

        // Color inspired by "hues of the ocean" and "sparkling water"
        // Mix between a deep blue and a vibrant cyan based on time and alpha
        vec3 deepBlue = vec3(0.1, 0.2, 0.4);
        vec3 cyan = vec3(0.0, 1.0, 1.0);
        float mixFactor = (sin(u_time * 2.0 + gl_FragCoord.x * 0.1) + 1.0) / 2.0;
        vec3 color = mix(deepBlue, cyan, mixFactor);

        gl_FragColor = vec4(color, strength * v_alpha);
    }
`;

const particlesMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
        u_time: { value: 0.0 },
        u_mouse: { value: mouse }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

// 4. Window Resize Handling
window.addEventListener('resize', () => {
    // Update camera
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// 5. Animation Loop
const clock = new THREE.Clock();

const animate = () => {
    const elapsedTime = clock.getElapsedTime();

    // Update material uniforms
    particlesMaterial.uniforms.u_time.value = elapsedTime;

    // Render the scene
    renderer.render(scene, camera);

    // Call animate again on the next frame
    window.requestAnimationFrame(animate);
};

animate();
