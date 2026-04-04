// three-scene.js - Efeito de abertura do painel
class AuraOpeningEffect {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.container.offsetWidth / this.container.offsetHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        
        this.particles = null;
        this.init();
    }
    
    init() {
        this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.container.appendChild(this.renderer.domElement);
        
        // Criar partículas com gradiente azul/roxo
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        
        const count = 800;
        for (let i = 0; i < count; i++) {
            positions.push(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );
            
            // Gradiente azul para roxo (Gemini style)
            const r = 0.3 + Math.random() * 0.3;
            const g = 0.4 + Math.random() * 0.2;
            const b = 0.9 + Math.random() * 0.1;
            colors.push(r, g, b);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
        
        this.camera.position.z = 5;
        
        // Handle resize
        window.addEventListener('resize', () => {
            this.camera.aspect = this.container.offsetWidth / this.container.offsetHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
        });

        this.animate();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.particles) {
            this.particles.rotation.x += 0.0005;
            this.particles.rotation.y += 0.001;
            
            // Pulsing effect
            const time = Date.now() * 0.001;
            this.particles.material.opacity = 0.4 + Math.sin(time) * 0.2;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}
