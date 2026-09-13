// ============ Scene3D — Three.js 场景骨架（#1 脚手架）============
// 职责：场景 / 相机 / 灯光 / 渲染器生命周期；后续里程碑再挂玩家与卡牌特效。
// 与 2D Renderer 共存：默认不启用；?3d=1 时挂到 #three-container。

const SCENE3D = {
    WIDTH: 800,
    HEIGHT: 600,
    ARENA_RADIUS: 300, // 与 GAME_CONFIG.ARENA_RADIUS 对齐（2D 逻辑单位 → 3D 米，1:1）
    CAMERA_POS: { x: 0, y: 420, z: 380 }, // 斜俯视，保持圆盘竞技场可读性
    LOOK_AT: { x: 0, y: 0, z: 0 }
};

class Scene3D {
    constructor() {
        this.ready = false;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.container = null;
        this.arenaGroup = null;
        this._raf = 0;
        this._onResize = () => this.handleResize();
    }

    static isSupported() {
        return typeof THREE !== 'undefined';
    }

    static shouldEnable() {
        try {
            const q = new URLSearchParams(window.location.search);
            return q.get('render') === '3d' || q.get('3d') === '1';
        } catch (e) {
            return false;
        }
    }

    init(container) {
        if (!Scene3D.isSupported()) {
            console.warn('[Scene3D] THREE 未加载，跳过 3D 初始化');
            return false;
        }
        if (this.ready) return true;

        this.container = container || document.getElementById('three-container');
        if (!this.container) {
            console.warn('[Scene3D] 找不到 #three-container');
            return false;
        }

        const w = SCENE3D.WIDTH;
        const h = SCENE3D.HEIGHT;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h, false);
        this.renderer.setClearColor(0x0a0a1a, 1);
        this.renderer.domElement.id = 'three-canvas';
        this.renderer.domElement.style.width = w + 'px';
        this.renderer.domElement.style.height = h + 'px';
        this.renderer.domElement.style.display = 'block';
        this.container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x0a0a1a, 600, 1200);

        this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
        this.camera.position.set(SCENE3D.CAMERA_POS.x, SCENE3D.CAMERA_POS.y, SCENE3D.CAMERA_POS.z);
        this.camera.lookAt(SCENE3D.LOOK_AT.x, SCENE3D.LOOK_AT.y, SCENE3D.LOOK_AT.z);

        this.createLights();
        this.createArenaPlaceholder();
        this.createHelpers();

        this.clock = new THREE.Clock();
        window.addEventListener('resize', this._onResize);
        this.ready = true;
        console.log('[Scene3D] 初始化完成');
        return true;
    }

    createLights() {
        const ambient = new THREE.AmbientLight(0x6a7aaa, 0.55);
        this.scene.add(ambient);

        const key = new THREE.DirectionalLight(0xffffff, 0.95);
        key.position.set(180, 320, 160);
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0x1e90ff, 0.35);
        fill.position.set(-200, 120, -80);
        this.scene.add(fill);

        const rim = new THREE.PointLight(0xff6b35, 0.45, 900);
        rim.position.set(0, 80, -260);
        this.scene.add(rim);
    }

    // 占位：圆盘地面 + 边界环 + 中心标记（#2 正式竞技场 3D 化时替换）
    createArenaPlaceholder() {
        this.arenaGroup = new THREE.Group();
        this.arenaGroup.name = 'arenaPlaceholder';

        const R = SCENE3D.ARENA_RADIUS;

        const disc = new THREE.Mesh(
            new THREE.CircleGeometry(R, 64),
            new THREE.MeshStandardMaterial({
                color: 0x121a32,
                metalness: 0.25,
                roughness: 0.7,
                side: THREE.DoubleSide
            })
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 0;
        this.arenaGroup.add(disc);

        const rim = new THREE.Mesh(
            new THREE.RingGeometry(R - 6, R + 4, 64),
            new THREE.MeshStandardMaterial({
                color: 0x1e90ff,
                emissive: 0x0a3a80,
                metalness: 0.4,
                roughness: 0.35,
                side: THREE.DoubleSide
            })
        );
        rim.rotation.x = -Math.PI / 2;
        rim.position.y = 0.6;
        this.arenaGroup.add(rim);

        const center = new THREE.Mesh(
            new THREE.RingGeometry(18, 24, 32),
            new THREE.MeshStandardMaterial({
                color: 0xffd700,
                emissive: 0x664400,
                metalness: 0.5,
                roughness: 0.3,
                side: THREE.DoubleSide
            })
        );
        center.rotation.x = -Math.PI / 2;
        center.position.y = 0.8;
        this.arenaGroup.add(center);

        // 外围地板（视觉延伸）
        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(R + 180, 64),
            new THREE.MeshStandardMaterial({
                color: 0x0a0e1c,
                metalness: 0.1,
                roughness: 0.95,
                side: THREE.DoubleSide
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.5;
        this.arenaGroup.add(floor);

        this.scene.add(this.arenaGroup);
    }

    createHelpers() {
        const axes = new THREE.AxesHelper(80);
        axes.position.y = 1.2;
        this.scene.add(axes);
    }

    handleResize() {
        if (!this.ready || !this.container) return;
        // 脚手架阶段固定逻辑分辨率；后续可改为自适应容器
        this.renderer.setSize(SCENE3D.WIDTH, SCENE3D.HEIGHT, false);
        this.camera.aspect = SCENE3D.WIDTH / SCENE3D.HEIGHT;
        this.camera.updateProjectionMatrix();
    }

    /** 2D 逻辑坐标 (x,y) → 3D 世界 (x, 0, -y)：屏幕 y 向下，世界 z 向后 */
    worldFrom2D(x, y) {
        return new THREE.Vector3(x, 0, -y);
    }

    render(deltaMs) {
        if (!this.ready) return;
        const t = this.clock ? this.clock.getElapsedTime() : 0;
        if (this.arenaGroup) {
            // 轻微呼吸感：中心环脉动，证明渲染循环活着
            const center = this.arenaGroup.children[2];
            if (center) {
                const s = 1 + Math.sin(t * 2) * 0.06;
                center.scale.set(s, s, 1);
            }
        }
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (!this.ready) return;
        window.removeEventListener('resize', this._onResize);
        if (this._raf) cancelAnimationFrame(this._raf);
        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
        }
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.arenaGroup = null;
        this.container = null;
        this.ready = false;
    }
}

// 单例：main.js 通过 window.Scene3DInstance 访问
window.Scene3DInstance = null;

function ensureScene3D() {
    if (!Scene3D.shouldEnable()) return null;
    if (!Scene3D.isSupported()) {
        console.warn('[Scene3D] URL 已请求 3D，但 THREE 未加载');
        return null;
    }
    if (!window.Scene3DInstance) {
        window.Scene3DInstance = new Scene3D();
        const ok = window.Scene3DInstance.init(document.getElementById('three-container'));
        if (!ok) {
            window.Scene3DInstance = null;
            return null;
        }
        // 覆盖 2D canvas：3D 模式下隐藏 2D，显示 three-container
        const canvas2d = document.getElementById('game-canvas');
        const container3d = document.getElementById('three-container');
        if (canvas2d) canvas2d.style.display = 'none';
        if (container3d) container3d.classList.remove('hidden');
    }
    return window.Scene3DInstance;
}

// 脚手架自检：DOM ready 后若请求 3D 则立即起场景（不必等开局）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureScene3D(); });
} else {
    ensureScene3D();
}
