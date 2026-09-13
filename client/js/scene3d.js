// ============ Scene3D — Three.js 场景骨架 ============
// 职责：场景 / 相机 / 灯光 / 渲染器生命周期；#2 竞技场与地面 3D 化；#3 玩家体 3D。
// 与 2D Renderer 共存：默认不启用；?render=3d 时挂到 #three-container。

const SCENE3D = {
    WIDTH: 800,
    HEIGHT: 600,
    ARENA_RADIUS: 300, // 与 GAME_CONFIG.ARENA_RADIUS 对齐（2D 逻辑单位 → 3D，1:1）
    CAMERA_POS: { x: 0, y: 420, z: 380 },
    LOOK_AT: { x: 0, y: 0, z: 0 },
    DEBUG_AXES: false,
    // #4 相机默认轨道参数（俯视斜角总览）
    CAMERA_MODES: {
        overview: { radius: 520, pitch: 0.72, yaw: 0.35 }, // pitch: 弧度，从水平面向上抬
        follow: { radius: 340, pitch: 0.95, yaw: 0.35 }
    },
    CAMERA_MIN_RADIUS: 180,
    CAMERA_MAX_RADIUS: 900,
    CAMERA_MIN_PITCH: 0.25,
    CAMERA_MAX_PITCH: 1.35,
    FOLLOW_LERP: 0.08,
    ORBIT_DRAG_SPEED: 0.0055,
    ZOOM_SPEED: 0.12
};

// 玩家配色（对齐 renderer.drawPlayer 的 playerColors）
const PLAYER3D_COLORS = {
    1: { main: 0xff6b35, emissive: 0x8a2a10, css: '#FF6B35' },
    2: { main: 0x1e90ff, emissive: 0x0a3a80, css: '#1E90FF' },
    3: { main: 0x22c55e, emissive: 0x0d5c2e, css: '#22c55e' }
};

const PLAYER3D_BODY_RADIUS = 18; // ≈ PLAYER_CONFIG.WIDTH/2 - 2

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
        this.playersGroup = null;
        this._playerViews = new Map(); // playerId -> view
        this._effectMeshes = [];
        this._effectKeys = '';
        this._raf = 0;
        this._onResize = () => this.handleResize();

        // #4 相机与操作映射
        this.cameraMode = 'overview'; // overview | follow
        this._camYaw = SCENE3D.CAMERA_MODES.overview.yaw;
        this._camPitch = SCENE3D.CAMERA_MODES.overview.pitch;
        this._camRadius = SCENE3D.CAMERA_MODES.overview.radius;
        this._camFocus = new THREE.Vector3(0, 0, 0);
        this._camFocusTarget = new THREE.Vector3(0, 0, 0);
        this._orbiting = false;
        this._lastPointer = { x: 0, y: 0 };
        this._followPlayerId = null;
        this._aimVisual = null; // { line, ring, marker }
        this._targetRings = []; // 目标选择高亮
        this._raycaster = null;
        this._groundPlane = null;
        this._ndc = null;
        this._bindPointer = this._bindPointer.bind(this);
        this._unbindPointer = this._unbindPointer.bind(this);
        this.onAimPick = null;   // (gameX, gameY) => void  —— 2D 逻辑坐标
        this.onTargetPick = null; // (playerId) => void
        this.onOrbitChange = null; // 环绕开始/结束（瞄准时禁用拖拽旋转）
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
        this._initCameraRig();
        if (SCENE3D.DEBUG_AXES) {
            const axes = new THREE.AxesHelper(80);
            axes.position.y = 1.2;
            this.scene.add(axes);
        }

        this.clock = new THREE.Clock();
        window.addEventListener('resize', this._onResize);
        this._bindPointer();
        this.ready = true;
        console.log('[Scene3D] 竞技场/玩家体/相机与操作映射就绪（#4）');
        return true;
    }

    // ---------- #4 相机 rig / 视角 ----------

    _initCameraRig() {
        this._raycaster = new THREE.Raycaster();
        this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this._ndc = new THREE.Vector2();
        this._aimVisual = this._createAimVisual();
        this.scene.add(this._aimVisual.root);
    }

    _createAimVisual() {
        const root = new THREE.Group();
        root.name = 'aimVisual';
        root.visible = false;

        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 1)
        ]);
        const lineMat = new THREE.LineDashedMaterial({
            color: 0xffd700,
            dashSize: 12,
            gapSize: 8,
            transparent: true,
            opacity: 0.95
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        line.position.y = 1.2;
        line.name = 'aimLine';
        root.add(line);

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(12, 18, 32),
            new THREE.MeshBasicMaterial({
                color: 0xffd700,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.9;
        ring.name = 'aimRing';
        root.add(ring);

        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(4, 12, 12),
            new THREE.MeshBasicMaterial({
                color: 0xffd700,
                transparent: true,
                opacity: 0.85,
                depthWrite: false
            })
        );
        marker.position.y = 2;
        marker.name = 'aimMarker';
        root.add(marker);

        return { root, line, ring, marker, lineMat, ringMat: ring.material, markerMat: marker.material };
    }

    /** 切换相机模式：overview（总览）/ follow（跟随当前玩家） */
    setCameraMode(mode) {
        if (mode !== 'overview' && mode !== 'follow') return this.cameraMode;
        this.cameraMode = mode;
        const preset = SCENE3D.CAMERA_MODES[mode] || SCENE3D.CAMERA_MODES.overview;
        this._camRadius = preset.radius;
        this._camPitch = preset.pitch;
        this._camYaw = preset.yaw;
        return this.cameraMode;
    }

    toggleCameraMode() {
        return this.setCameraMode(this.cameraMode === 'overview' ? 'follow' : 'overview');
    }

    /** 设置跟随目标：2D 逻辑坐标点或 playerId；null 清除并回中心（总览） */
    setFollowTarget(target) {
        if (target == null) {
            this._followPlayerId = null;
            if (this.cameraMode === 'overview') {
                this._camFocusTarget.set(0, 0, 0);
            }
            return;
        }
        if (typeof target === 'number') {
            this._followPlayerId = target;
            return;
        }
        if (typeof target.x === 'number' && typeof target.y === 'number') {
            this._followPlayerId = null;
            this._camFocusTarget.set(target.x, 0, -target.y);
        }
    }

    /** 更新相机：orbit 缓动 + 可选跟随当前玩家 */
    updateCamera(deltaMs, gameState) {
        if (!this.ready || !this.camera) return;
        const k = Math.min(1, (deltaMs || 16.67) / 16.67);

        // 跟随模式：焦点对准当前玩家
        if (this.cameraMode === 'follow') {
            let focusX = 0, focusZ = 0;
            if (this._followPlayerId != null && gameState && Array.isArray(gameState.physicsPlayers)) {
                const pp = gameState.physicsPlayers.find(p => p.playerId === this._followPlayerId);
                if (pp && pp.position) {
                    focusX = pp.position.x;
                    focusZ = -pp.position.y;
                }
            }
            this._camFocusTarget.set(focusX, 0, focusZ);
        } else if (this._followPlayerId == null) {
            // 总览模式下若无显式 focus，缓动回中心
            // （setFollowTarget 点坐标时保持一段时间由外部控制；此处不强制回中）
        }

        const lerp = SCENE3D.FOLLOW_LERP * k;
        this._camFocus.lerp(this._camFocusTarget, Math.min(1, lerp * 2));

        // 球坐标 → 笛卡尔
        const pitch = this._camPitch;
        const yaw = this._camYaw;
        const r = this._camRadius;
        const cy = Math.sin(pitch) * r;
        const ch = Math.cos(pitch) * r;
        this.camera.position.set(
            this._camFocus.x + Math.sin(yaw) * ch,
            this._camFocus.y + cy,
            this._camFocus.z + Math.cos(yaw) * ch
        );
        this.camera.lookAt(this._camFocus.x, this._camFocus.y, this._camFocus.z);
    }

    // ---------- #4 指针：环绕 / 缩放 / 拾取 ----------

    _bindPointer() {
        const el = this.renderer && this.renderer.domElement;
        if (!el) return;
        // 预绑定，保证 removeEventListener 可匹配
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
        el.style.touchAction = 'none';
        el.addEventListener('pointerdown', this._onPointerDown);
        el.addEventListener('pointermove', this._onPointerMove);
        el.addEventListener('pointerup', this._onPointerUp);
        el.addEventListener('pointercancel', this._onPointerUp);
        el.addEventListener('wheel', this._onWheel, { passive: false });
        el.addEventListener('contextmenu', this._onContextMenu);
    }

    _unbindPointer() {
        const el = this.renderer && this.renderer.domElement;
        if (!el) return;
        if (this._onPointerDown) el.removeEventListener('pointerdown', this._onPointerDown);
        if (this._onPointerMove) el.removeEventListener('pointermove', this._onPointerMove);
        if (this._onPointerUp) {
            el.removeEventListener('pointerup', this._onPointerUp);
            el.removeEventListener('pointercancel', this._onPointerUp);
        }
        if (this._onWheel) el.removeEventListener('wheel', this._onWheel);
        if (this._onContextMenu) el.removeEventListener('contextmenu', this._onContextMenu);
    }

    _isAimingActive() {
        return !!(this._inputGate && this._inputGate.isAiming && this._inputGate.isAiming());
    }

    /** 外部注入：瞄准中禁用环绕拖拽 */
    setInputGate(gate) {
        this._inputGate = gate || null;
    }

    _onContextMenu(e) {
        e.preventDefault();
    }

    _onPointerDown(e) {
        // 中键 / 右键：环绕；瞄准中仅左键拾取
        if (this._isAimingActive()) {
            if (e.button === 0) this._handlePick(e);
            return;
        }
        if (e.button === 2 || e.button === 1) {
            this._orbiting = true;
            this._lastPointer.x = e.clientX;
            this._lastPointer.y = e.clientY;
            if (this.onOrbitChange) this.onOrbitChange(true);
            e.preventDefault();
            return;
        }
        if (e.button === 0) this._handlePick(e);
    }

    _onPointerMove(e) {
        if (this._orbiting) {
            const dx = e.clientX - this._lastPointer.x;
            const dy = e.clientY - this._lastPointer.y;
            this._lastPointer.x = e.clientX;
            this._lastPointer.y = e.clientY;
            this._camYaw -= dx * SCENE3D.ORBIT_DRAG_SPEED;
            this._camPitch += dy * SCENE3D.ORBIT_DRAG_SPEED;
            this._camPitch = Math.max(SCENE3D.CAMERA_MIN_PITCH, Math.min(SCENE3D.CAMERA_MAX_PITCH, this._camPitch));
            e.preventDefault();
            return;
        }
        // 瞄准中：移动更新预览点（与 2D mousemove 对齐）
        if (this._isAimingActive() && typeof this.onAimHover === 'function') {
            const pt = this.pickGroundPoint(e.clientX, e.clientY);
            if (pt) this.onAimHover(pt.x, pt.y);
        }
    }

    _onPointerUp(e) {
        if (this._orbiting) {
            this._orbiting = false;
            if (this.onOrbitChange) this.onOrbitChange(false);
        }
    }

    _onWheel(e) {
        e.preventDefault();
        const dir = e.deltaY > 0 ? 1 : -1;
        this._camRadius *= (1 + dir * SCENE3D.ZOOM_SPEED);
        this._camRadius = Math.max(SCENE3D.CAMERA_MIN_RADIUS, Math.min(SCENE3D.CAMERA_MAX_RADIUS, this._camRadius));
    }

    /** 拾取：瞄准确认 / 目标玩家选择 */
    _handlePick(e) {
        if (!this.ready) return;
        if (this._isAimingActive()) {
            const pt = this.pickGroundPoint(e.clientX, e.clientY);
            if (pt && typeof this.onAimPick === 'function') {
                this.onAimPick(pt.x, pt.y);
            }
            return;
        }
        if (this._inputGate && this._inputGate.isTargeting && this._inputGate.isTargeting()) {
            const pid = this.pickPlayer(e.clientX, e.clientY);
            if (pid != null && typeof this.onTargetPick === 'function') {
                this.onTargetPick(pid);
            }
        }
    }

    /** 屏幕点 → 地面 y=0 平面交点 → 2D 逻辑坐标 {x,y}（y = -worldZ）；无交点返回 null */
    pickGroundPoint(clientX, clientY) {
        if (!this.ready || !this.camera || !this.renderer) return null;
        const rect = this.renderer.domElement.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        this._ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this._ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._ndc, this.camera);
        const hit = new THREE.Vector3();
        const ok = this._raycaster.ray.intersectPlane(this._groundPlane, hit);
        if (!ok) return null;
        return { x: hit.x, y: -hit.z };
    }

    /** 屏幕点 → 命中的玩家 playerId（按屏幕距离近似，兼容隐藏量子体） */
    pickPlayer(clientX, clientY) {
        if (!this.ready || !this.camera || !this.renderer) return null;
        const rect = this.renderer.domElement.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        let bestId = null;
        let bestDist = 45; // 与 2D CLICK_RADIUS 一致
        this._playerViews.forEach((view, id) => {
            if (!view.root.visible) return;
            const wp = new THREE.Vector3();
            view.root.getWorldPosition(wp);
            wp.y = view.body ? view.body.getWorldPosition(new THREE.Vector3()).y : wp.y;
            const ndc = wp.clone().project(this.camera);
            const sx = (ndc.x * 0.5 + 0.5) * rect.width;
            const sy = (-ndc.y * 0.5 + 0.5) * rect.height;
            const d = Math.hypot(sx - mx, sy - my);
            if (d < bestDist) {
                bestDist = d;
                bestId = id;
            }
        });
        return bestId;
    }

    /**
     * 更新瞄准可视化。
     * @param {Object|null} opts { from: {x,y}, to: {x,y}, valid: boolean } 2D 逻辑坐标；null 隐藏
     */
    setAimVisual(opts) {
        if (!this.ready || !this._aimVisual) return;
        const v = this._aimVisual;
        if (!opts || !opts.from || !opts.to) {
            v.root.visible = false;
            return;
        }
        v.root.visible = true;
        const ax = opts.from.x;
        const az = -opts.from.y;
        const bx = opts.to.x;
        const bz = -opts.to.y;
        const valid = opts.valid !== false;
        const color = valid ? 0xffd700 : 0xff2222;

        v.lineMat.color.setHex(color);
        v.ringMat.color.setHex(color);
        v.markerMat.color.setHex(color);

        const pos = v.line.geometry.attributes.position;
        pos.setXYZ(0, ax, 0, az);
        pos.setXYZ(1, bx, 0, bz);
        pos.needsUpdate = true;
        v.line.geometry.computeBoundingSphere();
        v.line.computeLineDistances();

        v.ring.position.set(bx, 0.9, bz);
        v.marker.position.set(bx, 2, bz);

        const t = this.clock ? this.clock.getElapsedTime() : 0;
        const pulse = 1 + Math.sin(t * 4) * 0.2;
        v.ring.scale.set(pulse, pulse, 1);
        v.ringMat.opacity = 0.5 + 0.25 * Math.sin(t * 6);
    }

    /** 目标选择：高亮可选玩家地面环 */
    setTargetHighlight(activePlayerIds) {
        if (!this.ready || !this.playersGroup) return;
        // 清理旧环
        this._targetRings.forEach(r => {
            this.scene.remove(r);
            if (r.geometry) r.geometry.dispose();
            if (r.material) r.material.dispose();
        });
        this._targetRings = [];
        if (!activePlayerIds || !activePlayerIds.length) return;

        activePlayerIds.forEach(id => {
            const view = this._playerViews.get(id);
            if (!view) return;
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(PLAYER3D_BODY_RADIUS + 4, PLAYER3D_BODY_RADIUS + 10, 32),
                new THREE.MeshBasicMaterial({
                    color: 0x00ffcc,
                    transparent: true,
                    opacity: 0.75,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(view.root.position.x, 0.7, view.root.position.z);
            ring.name = `targetRing_${id}`;
            this.scene.add(ring);
            this._targetRings.push(ring);
        });
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
        this.createBoundary(R); // 含能量弧 energyArcGroup（原 createEnergyArcs 调用为死引用）
        this.createCenterMark();

        this.effectsGroup = new THREE.Group();
        this.effectsGroup.name = 'arenaEffects';
        this.arenaGroup.add(this.effectsGroup);

        this.playersGroup = new THREE.Group();
        this.playersGroup.name = 'players';
        this.scene.add(this.playersGroup);

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

    // ---------- 玩家体 3D（#3：与 physics / 玩家逻辑状态同步）----------

    _ensurePlayerView(playerId) {
        if (this._playerViews.has(playerId)) return this._playerViews.get(playerId);
        const palette = PLAYER3D_COLORS[playerId] || PLAYER3D_COLORS[1];
        const view = this._createPlayerView(playerId, palette);
        this._playerViews.set(playerId, view);
        this.playersGroup.add(view.root);
        return view;
    }

    _createPlayerView(playerId, palette) {
        const root = new THREE.Group();
        root.name = `player_${playerId}`;
        const R = PLAYER3D_BODY_RADIUS;

        // 主体：金属感多面体 + 发光核心
        const bodyMat = new THREE.MeshStandardMaterial({
            color: palette.main,
            emissive: palette.emissive,
            emissiveIntensity: 0.35,
            metalness: 0.55,
            roughness: 0.35,
            transparent: true,
            opacity: 1
        });
        const body = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 1), bodyMat);
        body.position.y = R + 2;
        body.castShadow = false;
        body.name = 'body';
        root.add(body);

        // 内核发光球
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.35
        });
        const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.35, 12, 12), coreMat);
        core.position.y = body.position.y;
        core.name = 'core';
        root.add(core);

        // 底部接触光晕
        const glowMat = new THREE.MeshBasicMaterial({
            color: palette.main,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const glow = new THREE.Mesh(new THREE.CircleGeometry(R + 8, 24), glowMat);
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.4;
        glow.name = 'glow';
        root.add(glow);

        // 护盾气泡（默认隐藏）
        const shieldMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0x8a7000,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.18,
            metalness: 0.1,
            roughness: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const shield = new THREE.Mesh(new THREE.SphereGeometry(R + 14, 20, 16), shieldMat);
        shield.position.y = body.position.y;
        shield.name = 'shield';
        shield.visible = false;
        root.add(shield);

        // 定位锚地面环 + 四桩（默认隐藏）
        const anchorGroup = new THREE.Group();
        anchorGroup.name = 'anchor';
        anchorGroup.position.y = 0.6;
        anchorGroup.visible = false;
        const chainMat = new THREE.MeshBasicMaterial({
            color: 0xcd853f,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        const anchorRing = new THREE.Mesh(new THREE.RingGeometry(R + 8, R + 12, 28), chainMat);
        anchorRing.rotation.x = -Math.PI / 2;
        anchorGroup.add(anchorRing);
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            const stake = new THREE.Mesh(
                new THREE.BoxGeometry(4, 3, 10),
                new THREE.MeshStandardMaterial({
                    color: 0xcd853f,
                    metalness: 0.4,
                    roughness: 0.6
                })
            );
            stake.position.set(Math.cos(a) * (R + 16), 1.5, Math.sin(a) * (R + 16));
            stake.rotation.y = -a;
            anchorGroup.add(stake);
        }
        root.add(anchorGroup);

        // 电荷环（默认隐藏）
        const chargeMat = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const chargeRing = new THREE.Mesh(new THREE.TorusGeometry(R + 6, 1.5, 8, 32), chargeMat);
        chargeRing.rotation.x = Math.PI / 2;
        chargeRing.position.y = body.position.y;
        chargeRing.name = 'chargeRing';
        chargeRing.visible = false;
        root.add(chargeRing);

        // 热机充能粒子（占位：沿轨道的小球，#5 再细化）
        const heatGroup = new THREE.Group();
        heatGroup.name = 'heat';
        heatGroup.position.y = body.position.y + R + 10;
        heatGroup.visible = false;
        const heatDots = [];
        for (let i = 0; i < 5; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xff6600,
                transparent: true,
                opacity: 0.9
            });
            const d = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8), mat);
            heatGroup.add(d);
            heatDots.push(d);
        }
        root.add(heatGroup);

        // P 标签 Sprite
        const label = this._makePlayerLabel(palette.css, `P${playerId}`);
        label.position.y = body.position.y + R + 28;
        label.name = 'label';
        root.add(label);

        // 质量变化外环（虚线风格用细环近似）
        const massRingMat = new THREE.MeshBasicMaterial({
            color: 0xff6666,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const massRing = new THREE.Mesh(new THREE.TorusGeometry(R + 10, 1, 6, 24), massRingMat);
        massRing.rotation.x = Math.PI / 2;
        massRing.position.y = 0.8;
        massRing.name = 'massRing';
        massRing.visible = false;
        root.add(massRing);

        return {
            playerId,
            root,
            body,
            core,
            glow,
            shield,
            anchorGroup,
            chargeRing,
            heatGroup,
            heatDots,
            massRing,
            label,
            palette,
            lastPos: null
        };
    }

    _makePlayerLabel(cssColor, text) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 64);
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(64, 36, 28, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cssColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeText(text, 64, 32);
        ctx.fillText(text, 64, 32);
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        const mat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            depthTest: false
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(36, 18, 1);
        return sprite;
    }

    /**
     * 与游戏状态同步玩家 3D 体。
     * @param {Object} gameState main.js 传入的 getState() 快照
     *  - physicsPlayers: [{playerId, position:{x,y}, velocity, mass}]
     *  - players: 逻辑玩家（eliminated / quantumState / effects / heatEngine / charge / shieldActive）
     *  - shields: {id:bool}
     */
    syncPlayers(gameState) {
        if (!this.ready || !this.playersGroup) return;
        const phys = Array.isArray(gameState.physicsPlayers) ? gameState.physicsPlayers : [];
        const logic = Array.isArray(gameState.players) ? gameState.players : [];
        const shields = gameState.shields || {};

        const aliveIds = new Set();
        phys.forEach(p => {
            if (!p || typeof p.playerId !== 'number') return;
            const pd = logic.find(gp => gp.id === p.playerId);
            if (pd && pd.eliminated) return;
            aliveIds.add(p.playerId);
        });
        // 逻辑在场但物理尚未建体时也保证 mesh 存在（开局同步间隙）
        logic.forEach(gp => {
            if (gp && !gp.eliminated) aliveIds.add(gp.id);
        });

        // 移除已消失的玩家
        this._playerViews.forEach((view, id) => {
            if (!aliveIds.has(id)) {
                this._disposePlayerView(view);
                this._playerViews.delete(id);
            }
        });

        // 确保视图存在并应用状态
        aliveIds.forEach(id => {
            const view = this._ensurePlayerView(id);
            const pp = phys.find(p => p.playerId === id);
            const pd = logic.find(gp => gp.id === id);
            this._applyPlayerState(view, pp, pd, shields[id]);
        });
    }

    _applyPlayerState(view, pp, pd, hasShield) {
        const t = this.clock ? this.clock.getElapsedTime() : (Date.now() / 1000);
        const invisible = !!(pd && pd.quantumState);
        const isQuantumVisual = invisible; // 与 2D 量子隐身一致

        // 位置：2D (x,y) → 3D (x, R+2, -y)
        let x = 0, z = 0, vx = 0, vy = 0, mass = PLAYER_CONFIG ? PLAYER_CONFIG.MASS : 70;
        if (pp && pp.position) {
            x = pp.position.x;
            z = -pp.position.y;
            vx = pp.velocity ? pp.velocity.x : 0;
            vy = pp.velocity ? pp.velocity.y : 0;
            mass = pp.mass || mass;
        }
        view.root.position.x = x;
        view.root.position.z = z;

        // 朝速度方向轻微倾斜（视觉反馈，不影响物理）
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > 0.2) {
            const lean = Math.min(0.45, speed * 0.04);
            // 2D 速度 → 3D：vy 屏幕向下 = 世界 -z
            view.body.rotation.x = lean * (vy / speed) * -1;
            view.body.rotation.z = lean * (vx / speed);
        } else {
            view.body.rotation.x *= 0.85;
            view.body.rotation.z *= 0.85;
        }
        view.body.rotation.y += 0.01 + Math.min(0.05, speed * 0.002);

        // 质量缩放（相对默认 MASS）
        const baseMass = (typeof PLAYER_CONFIG !== 'undefined' && PLAYER_CONFIG.MASS) || 70;
        const mScale = Math.max(0.55, Math.min(1.6, mass / baseMass));
        view.body.scale.set(mScale, mScale, mScale);
        const bodyY = PLAYER3D_BODY_RADIUS * mScale + 2;
        view.body.position.y = bodyY;
        view.core.position.y = bodyY;
        view.shield.position.y = bodyY;
        view.chargeRing.position.y = bodyY;
        view.heatGroup.position.y = bodyY + PLAYER3D_BODY_RADIUS * mScale + 10;
        view.label.position.y = bodyY + PLAYER3D_BODY_RADIUS * mScale + 28;

        // 量子隐身 / 半透明
        if (isQuantumVisual) {
            view.root.visible = true;
            view.body.material.opacity = 0.15 + 0.05 * Math.sin(t * 4);
            view.body.material.transparent = true;
            view.core.material.opacity = 0.08;
            view.glow.material.opacity = 0.05;
            view.label.material.opacity = 0.2;
        } else {
            view.body.material.opacity = 1;
            view.core.material.opacity = 0.35;
            view.glow.material.opacity = 0.28;
            view.label.material.opacity = 1;
        }

        // 护盾
        const shieldOn = !!(hasShield || (pd && pd.shieldActive));
        view.shield.visible = shieldOn && !isQuantumVisual;
        if (view.shield.visible) {
            const pulse = 1 + Math.sin(t * 3) * 0.04;
            view.shield.scale.set(pulse, pulse, pulse);
            view.shield.material.opacity = 0.14 + 0.06 * Math.sin(t * 5);
        }

        // 定位锚
        const anchored = !!(pd && pd.effects && pd.effects.some(e => e.type === 'anchor'));
        view.anchorGroup.visible = anchored;
        if (anchored) {
            view.anchorGroup.rotation.y = t * 0.6;
        }

        // 电荷
        const charge = pd ? (pd.charge || 0) : 0;
        view.chargeRing.visible = charge !== 0 && !isQuantumVisual;
        if (view.chargeRing.visible) {
            const isPos = charge > 0;
            view.chargeRing.material.color.setHex(isPos ? 0xffff00 : 0x00bfff);
            const r = PLAYER3D_BODY_RADIUS + 6 + Math.abs(charge) * 2;
            if (view._chargeRadius !== r) {
                view._chargeRadius = r;
                view.chargeRing.geometry.dispose();
                view.chargeRing.geometry = new THREE.TorusGeometry(r, 1.4, 8, 32);
            }
            view.chargeRing.rotation.z = t * 2;
            view.chargeRing.material.opacity = 0.55 + 0.25 * Math.sin(t * 4);
        }

        // 质量指示环
        const massEffect = pd && pd.effects ? pd.effects.find(e => e.type === 'massChange') : null;
        view.massRing.visible = !!massEffect;
        if (massEffect) {
            const heavy = massEffect.multiplier > 1;
            view.massRing.material.color.setHex(heavy ? 0xff6666 : 0x66ff66);
            view.massRing.rotation.z = -t * 1.2;
        }

        // 热机（占位：充能点沿轨道）
        const he = pd && pd.heatEngine && pd.heatEngine.active ? pd.heatEngine : null;
        view.heatGroup.visible = !!he;
        if (he) {
            const maxC = Math.max(1, he.maxCharge || 1);
            view.heatDots.forEach((dot, i) => {
                dot.visible = i < (he.charge || 0);
                const a = (i / maxC) * Math.PI * 2 + t * 2;
                const rr = 12 + (he.charge >= maxC ? 2 : 0);
                dot.position.set(Math.cos(a) * rr, Math.sin(t * 3 + i) * 2, Math.sin(a) * rr);
            });
        }

        // 接触光晕呼吸
        view.glow.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
    }

    _disposePlayerView(view) {
        if (!view) return;
        this.playersGroup.remove(view.root);
        view.root.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
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
            this.syncPlayers(gameState);
        }

        // #4 相机跟随 / 轨道
        this.updateCamera(deltaMs, gameState);

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
        this._unbindPointer();
        this.setAimVisual(null);
        this.setTargetHighlight(null);
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
        if (this._playerViews) {
            this._playerViews.forEach(view => this._disposePlayerView(view));
            this._playerViews.clear();
        }
        this.playersGroup = null;
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
