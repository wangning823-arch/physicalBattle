// ============ Scene3D — Three.js 场景骨架 ============
// 职责：场景 / 相机 / 灯光 / 渲染器生命周期；#2 竞技场与地面 3D 化。
// 与 2D Renderer 共存：默认不启用；?render=3d 时挂到 #three-container。

const SCENE3D = {
    WIDTH: 800,
    HEIGHT: 600,
    ARENA_RADIUS: 300, // 与 GAME_CONFIG.ARENA_RADIUS 对齐（2D 逻辑单位 → 3D，1:1）
    CAMERA_POS: { x: 0, y: 420, z: 380 },
    LOOK_AT: { x: 0, y: 0, z: 0 },
    DEBUG_AXES: false
};

// 场地特效类型 → 3D 地面标记样式
const ARENA3D_EFFECT_STYLE = {
    gravityField: {
        color: 0x9932cc,
        emissive: 0x4a0060,
        opacity: 0.45,
        ring: 0xba55d3
    },
    repulsionField: {
        color: 0x00ffff,
        emissive: 0x006666,
        opacity: 0.35,
        ring: 0x66ffff
    },
    frictionZone: {
        color: 0x87cefa,
        emissive: 0x1a3a5c,
        opacity: 0.40,
        ring: 0xb0e0ff
    },
    dampingField: {
        color: 0x32cd32,
        emissive: 0x145214,
        opacity: 0.35,
        ring: 0x90ee90
    },
    airFrictionZone: {
        color: 0x88aacc,
        emissive: 0x1a2a40,
        opacity: 0.30,
        ring: 0xaaccff
    },
    oilZone: {
        color: 0xcc9933,
        emissive: 0x4a3300,
        opacity: 0.40,
        ring: 0xffcc66
    }
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
        this.floorMesh = null;
        this.gridGroup = null;
        this.boundaryGroup = null;
        this.energyArcGroup = null;
        this.boundaryDots = null;
        this.effectsGroup = null;
        this._effectMeshes = [];
        this._effectKeys = '';
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
        this.renderer.setClearColor(0x070714, 1);
        this.renderer.domElement.id = 'three-canvas';
        this.renderer.domElement.style.width = w + 'px';
        this.renderer.domElement.style.height = h + 'px';
        this.renderer.domElement.style.display = 'block';
        this.container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x070714, 700, 1400);

        this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
        this.camera.position.set(SCENE3D.CAMERA_POS.x, SCENE3D.CAMERA_POS.y, SCENE3D.CAMERA_POS.z);
        this.camera.lookAt(SCENE3D.LOOK_AT.x, SCENE3D.LOOK_AT.y, SCENE3D.LOOK_AT.z);

        this.createLights();
        this.createArena();
        if (SCENE3D.DEBUG_AXES) {
            const axes = new THREE.AxesHelper(80);
            axes.position.y = 1.2;
            this.scene.add(axes);
        }

        this.clock = new THREE.Clock();
        window.addEventListener('resize', this._onResize);
        this.ready = true;
        console.log('[Scene3D] 竞技场 3D 化完成');
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

    // ---------- 竞技场主体（对齐 2D drawArena / drawGrid 视觉）----------

    createArena() {
        this.arenaGroup = new THREE.Group();
        this.arenaGroup.name = 'arena';
        const R = SCENE3D.ARENA_RADIUS;

        this.createOuterFloor(R);
        this.createArenaFloor(R);
        this.createGrid(R);
        this.createBoundary(R);
        this.createEnergyArcs(R);
        this.createCenterMark();

        this.effectsGroup = new THREE.Group();
        this.effectsGroup.name = 'arenaEffects';
        this.arenaGroup.add(this.effectsGroup);

        this.scene.add(this.arenaGroup);
    }

    /** 竞技场外地坪（视觉延伸） */
    createOuterFloor(R) {
        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(R + 220, 64),
            new THREE.MeshStandardMaterial({
                color: 0x0a0e1c,
                metalness: 0.08,
                roughness: 0.96,
                side: THREE.DoubleSide
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.6;
        floor.name = 'outerFloor';
        this.arenaGroup.add(floor);
    }

    /** 圆盘地面：CanvasTexture 复刻 2D 径向渐变 + 星空 + 同心/放射网格 */
    createArenaFloor(R) {
        const texSize = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = texSize;
        canvas.height = texSize;
        const ctx = canvas.getContext('2d');
        const c = texSize / 2;
        const pxR = (R / (R + 8)) * c; // 纹理内圆盘占满，留极小边

        // 深空径向渐变（与 renderer.drawArena 同色）
        const grad = ctx.createRadialGradient(c, c, 0, c, c, pxR);
        grad.addColorStop(0, '#0d0d2b');
        grad.addColorStop(0.4, '#111133');
        grad.addColorStop(0.75, '#1a1a3e');
        grad.addColorStop(1, '#252550');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c, c, pxR, 0, Math.PI * 2);
        ctx.fill();

        // 星空粒子（确定性伪随机，与 2D seed=42 同分布风格）
        let seed = 42;
        const rng = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let i = 0; i < 90; i++) {
            const angle = rng() * Math.PI * 2;
            const dist = rng() * pxR * 0.94;
            const x = c + Math.cos(angle) * dist;
            const y = c + Math.sin(angle) * dist;
            const size = 0.8 + rng() * 1.6;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200,220,255,${0.35 + rng() * 0.5})`;
            ctx.fill();
        }

        // 同心圆网格
        ctx.strokeStyle = 'rgba(30, 100, 200, 0.18)';
        ctx.lineWidth = 1.5;
        for (let r = 50; r < R; r += 50) {
            const rr = (r / R) * pxR;
            ctx.beginPath();
            ctx.arc(c, c, rr, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 径向线
        ctx.strokeStyle = 'rgba(30, 100, 200, 0.10)';
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(c, c);
            ctx.lineTo(c + Math.cos(angle) * pxR, c + Math.sin(angle) * pxR);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;

        const disc = new THREE.Mesh(
            new THREE.CircleGeometry(R, 64),
            new THREE.MeshStandardMaterial({
                map: texture,
                metalness: 0.22,
                roughness: 0.68,
                side: THREE.DoubleSide
            })
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 0;
        disc.name = 'arenaFloor';
        this.floorMesh = disc;
        this.arenaGroup.add(disc);

        // 轻微厚度台阶，增强圆盘立体感
        const rimStep = new THREE.Mesh(
            new THREE.CylinderGeometry(R + 4, R + 8, 6, 64, 1, true),
            new THREE.MeshStandardMaterial({
                color: 0x121830,
                metalness: 0.35,
                roughness: 0.55,
                side: THREE.DoubleSide
            })
        );
        rimStep.position.y = -3;
        rimStep.name = 'arenaStep';
        this.arenaGroup.add(rimStep);
    }

    /** 轻量网格线（叠加在纹理之上，便于后续按需隐藏/调色） */
    createGrid(R) {
        this.gridGroup = new THREE.Group();
        this.gridGroup.name = 'grid';

        const matCircle = new THREE.LineBasicMaterial({
            color: 0x1e64c8,
            transparent: true,
            opacity: 0.14
        });
        const matRadial = new THREE.LineBasicMaterial({
            color: 0x1e64c8,
            transparent: true,
            opacity: 0.08
        });

        for (let r = 50; r < R; r += 50) {
            const pts = [];
            const seg = 64;
            for (let i = 0; i <= seg; i++) {
                const a = (i / seg) * Math.PI * 2;
                pts.push(new THREE.Vector3(Math.cos(a) * r, 0.35, Math.sin(a) * r));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            this.gridGroup.add(new THREE.Line(geo, matCircle));
        }

        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const geo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0.35, 0),
                new THREE.Vector3(Math.cos(a) * R, 0.35, Math.sin(a) * R)
            ]);
            this.gridGroup.add(new THREE.Line(geo, matRadial));
        }

        this.arenaGroup.add(this.gridGroup);
    }

    /** 边界：外发光环 + 双层旋转能量环 + 脉冲光点 */
    createBoundary(R) {
        this.boundaryGroup = new THREE.Group();
        this.boundaryGroup.name = 'boundary';

        // 主边界环
        const mainRing = new THREE.Mesh(
            new THREE.RingGeometry(R - 2, R + 5, 96),
            new THREE.MeshStandardMaterial({
                color: 0x1e90ff,
                emissive: 0x0a3a80,
                emissiveIntensity: 0.85,
                metalness: 0.45,
                roughness: 0.3,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            })
        );
        mainRing.rotation.x = -Math.PI / 2;
        mainRing.position.y = 0.8;
        mainRing.name = 'mainRing';
        this.boundaryGroup.add(mainRing);

        // 内侧细环
        const innerGlow = new THREE.Mesh(
            new THREE.RingGeometry(R - 10, R - 7, 96),
            new THREE.MeshBasicMaterial({
                color: 0x4488ff,
                transparent: true,
                opacity: 0.25,
                side: THREE.DoubleSide
            })
        );
        innerGlow.rotation.x = -Math.PI / 2;
        innerGlow.position.y = 0.5;
        this.boundaryGroup.add(innerGlow);

        // 旋转能量弧（两段，转速不同，对齐 2D 双层环）
        this.energyArcGroup = new THREE.Group();
        this.energyArcGroup.name = 'energyArcs';

        const arc1 = this._makeArcSegment(R - 4, Math.PI * 1.2, 0x4488ff, 0.22, 7);
        arc1.name = 'arcA';
        this.energyArcGroup.add(arc1);

        const arc2 = this._makeArcSegment(R + 2, Math.PI * 0.9, 0x66aaff, 0.15, 5);
        arc2.name = 'arcB';
        this.energyArcGroup.add(arc2);

        this.boundaryGroup.add(this.energyArcGroup);

        // 边界脉冲点（12 个）
        const dotCount = 12;
        const dotGeo = new THREE.SphereGeometry(3.2, 10, 10);
        const dotMat = new THREE.MeshBasicMaterial({
            color: 0x64b4ff,
            transparent: true,
            opacity: 0.9
        });
        this.boundaryDots = new THREE.InstancedMesh(dotGeo, dotMat, dotCount);
        this.boundaryDots.name = 'boundaryDots';
        this.boundaryDots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this._dotCount = dotCount;
        this.boundaryGroup.add(this.boundaryDots);

        this.arenaGroup.add(this.boundaryGroup);
    }

    _makeArcSegment(radius, arcLen, color, opacity, width) {
        const pts = [];
        const seg = 48;
        for (let i = 0; i <= seg; i++) {
            const a = (i / seg) * arcLen;
            pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity,
            linewidth: width
        });
        const line = new THREE.Line(geo, mat);
        line.position.y = 1.4;
        return line;
    }

    createCenterMark() {
        const center = new THREE.Mesh(
            new THREE.RingGeometry(18, 24, 32),
            new THREE.MeshStandardMaterial({
                color: 0xffd700,
                emissive: 0x664400,
                metalness: 0.5,
                roughness: 0.3,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide
            })
        );
        center.rotation.x = -Math.PI / 2;
        center.position.y = 0.9;
        center.name = 'centerMark';
        this.centerMark = center;
        this.arenaGroup.add(center);
    }

    // ---------- 场地特效同步（physics.effects → 地面标记）----------

    /**
     * 与游戏状态同步场地特效圆盘。
     * @param {Array} effects physics.effects（含 type / x / y / radius）
     */
    syncArenaEffects(effects) {
        if (!this.ready || !this.effectsGroup) return;
        const list = Array.isArray(effects) ? effects : [];
        // 仅关心有位置的区域特效
        const zones = list.filter(e =>
            ARENA3D_EFFECT_STYLE[e.type] &&
            typeof e.x === 'number' &&
            typeof e.y === 'number' &&
            typeof e.radius === 'number' &&
            e.radius > 0
        );

        const key = zones
            .map(e => `${e.type}|${e.x.toFixed(1)}|${e.y.toFixed(1)}|${e.radius.toFixed(1)}`)
            .sort()
            .join(';');

        if (key === this._effectKeys) return;
        this._effectKeys = key;
        this._rebuildEffectMeshes(zones);
    }

    _rebuildEffectMeshes(zones) {
        // 释放旧网格
        this._effectMeshes.forEach(mesh => {
            this.effectsGroup.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
                else mesh.material.dispose();
            }
        });
        this._effectMeshes = [];

        zones.forEach(effect => {
            const style = ARENA3D_EFFECT_STYLE[effect.type];
            const group = new THREE.Group();
            // 2D (x,y) → 3D (x, 0, -y)
            group.position.set(effect.x, 0.25, -effect.y);
            group.name = `fx_${effect.type}`;

            const disc = new THREE.Mesh(
                new THREE.CircleGeometry(effect.radius, 48),
                new THREE.MeshStandardMaterial({
                    color: style.color,
                    emissive: style.emissive,
                    emissiveIntensity: 0.7,
                    transparent: true,
                    opacity: style.opacity,
                    metalness: 0.15,
                    roughness: 0.6,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            disc.rotation.x = -Math.PI / 2;
            group.add(disc);

            const ring = new THREE.Mesh(
                new THREE.RingGeometry(effect.radius - 3, effect.radius, 48),
                new THREE.MeshBasicMaterial({
                    color: style.ring,
                    transparent: true,
                    opacity: 0.55,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.15;
            group.add(ring);

            // 中心装饰环
            const core = new THREE.Mesh(
                new THREE.RingGeometry(
                    Math.max(4, effect.radius * 0.15),
                    Math.max(8, effect.radius * 0.22),
                    24
                ),
                new THREE.MeshBasicMaterial({
                    color: style.ring,
                    transparent: true,
                    opacity: 0.4,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            core.rotation.x = -Math.PI / 2;
            core.position.y = 0.2;
            group.add(core);

            this.effectsGroup.add(group);
            this._effectMeshes.push(group);
        });
    }

    // ---------- 帧更新 ----------

    handleResize() {
        if (!this.ready || !this.container) return;
        this.renderer.setSize(SCENE3D.WIDTH, SCENE3D.HEIGHT, false);
        this.camera.aspect = SCENE3D.WIDTH / SCENE3D.HEIGHT;
        this.camera.updateProjectionMatrix();
    }

    /** 2D 逻辑坐标 (x,y) → 3D 世界 (x, 0, -y)：屏幕 y 向下，世界 z 向后 */
    worldFrom2D(x, y) {
        return new THREE.Vector3(x, 0, -y);
    }

    render(deltaMs, gameState) {
        if (!this.ready) return;
        const t = this.clock ? this.clock.getElapsedTime() : 0;

        if (gameState) {
            this.syncArenaEffects(gameState.effects);
        }

        // 中心环呼吸
        if (this.centerMark) {
            const s = 1 + Math.sin(t * 2) * 0.06;
            this.centerMark.scale.set(s, s, 1);
        }

        // 双层能量弧反向旋转
        if (this.energyArcGroup) {
            const arcA = this.energyArcGroup.getObjectByName('arcA');
            const arcB = this.energyArcGroup.getObjectByName('arcB');
            if (arcA) arcA.rotation.y = t * 0.4;
            if (arcB) arcB.rotation.y = -t * 0.25;
        }

        // 边界脉冲点
        if (this.boundaryDots) {
            const R = SCENE3D.ARENA_RADIUS;
            const m = new THREE.Matrix4();
            for (let i = 0; i < this._dotCount; i++) {
                const a = (i / this._dotCount) * Math.PI * 2 + t * 0.3;
                const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 1.5 + i * 0.5));
                const sc = 0.6 + pulse * 0.7;
                m.makeScale(sc, sc, sc);
                m.setPosition(Math.cos(a) * R, 1.5, Math.sin(a) * R);
                this.boundaryDots.setMatrixAt(i, m);
            }
            this.boundaryDots.instanceMatrix.needsUpdate = true;
            const mat = this.boundaryDots.material;
            if (mat) mat.opacity = 0.55 + 0.25 * Math.sin(t * 2);
        }

        // 主边界环呼吸发光
        if (this.boundaryGroup) {
            const mainRing = this.boundaryGroup.getObjectByName('mainRing');
            if (mainRing && mainRing.material) {
                mainRing.material.emissiveIntensity = 0.7 + 0.35 * Math.sin(t * 2);
                mainRing.material.opacity = 0.75 + 0.15 * Math.sin(t * 2);
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
                    else {
                        if (obj.material.map) obj.material.map.dispose();
                        obj.material.dispose();
                    }
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
        this.floorMesh = null;
        this.gridGroup = null;
        this.boundaryGroup = null;
        this.energyArcGroup = null;
        this.boundaryDots = null;
        this.effectsGroup = null;
        this.centerMark = null;
        this._effectMeshes = [];
        this._effectKeys = '';
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
        const canvas2d = document.getElementById('game-canvas');
        const container3d = document.getElementById('three-container');
        if (canvas2d) canvas2d.style.display = 'none';
        if (container3d) container3d.classList.remove('hidden');
    }
    return window.Scene3DInstance;
}

// DOM ready 后若请求 3D 则立即起场景（不必等开局）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureScene3D(); });
} else {
    ensureScene3D();
}
