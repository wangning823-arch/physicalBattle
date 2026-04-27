# 物理竞技场 3D 技术选型文档

## 1. 项目现状分析

### 当前技术栈
- **渲染引擎**: HTML5 Canvas (2D)
- **物理引擎**: Matter.js (2D)
- **架构模式**: 模块化 ES6 Class 设计

### 核心模块
| 模块 | 职责 |
|------|------|
| `Game` | 游戏逻辑、回合管理、卡牌执行 |
| `PhysicsEngine` | Matter.js 封装、物理世界管理 |
| `Renderer` | Canvas 2D 渲染 |
| `CardSystem` | 卡牌定义与管理 |

---

## 2. 3D 渲染引擎选型

### 候选方案对比

| 特性 | Three.js | Babylon.js | PlayCanvas |
|------|----------|------------|------------|
| **社区规模** | ⭐⭐⭐⭐⭐ 最大 | ⭐⭐⭐⭐ 大 | ⭐⭐⭐ 中等 |
| **学习曲线** | 平缓 | 中等 | 中等 |
| **文档质量** | 优秀 | 优秀 | 良好 |
| **性能** | 优秀 | 优秀 | 优秀 |
| **WebGL 抽象** | 轻量级 | 完整 | 完整 |
| **物理引擎集成** | 需要第三方 | 内置 Ammo.js | 内置 Ammo.js |
| **TypeScript 支持** | 优秀 | 优秀 | 优秀 |
| **授权协议** | MIT | Apache 2.0 | MIT |

### 推荐方案：Three.js

**选择理由**：
1. **生态成熟**：拥有最大的社区和最丰富的资源
2. **轻量灵活**：与现有架构集成难度最低
3. **渐进式迁移**：可以与 2D Canvas 共存，支持分阶段迁移
4. **人才储备**：Three.js 开发者数量最多，便于维护
5. **性能优秀**：针对 WebGL 优化充分，适合实时物理游戏

---

## 3. 3D 物理引擎选型

### 候选方案对比

| 特性 | Cannon.js | Ammo.js | Rapier3D | PhysX.js |
|------|-----------|---------|----------|----------|
| **性能** | 良好 | ⭐⭐⭐⭐ 优秀 | ⭐⭐⭐⭐⭐ 最佳 | ⭐⭐⭐⭐ 优秀 |
| **易用性** | ⭐⭐⭐⭐⭐ 最佳 | ⭐⭐ 困难 | ⭐⭐⭐ 中等 | ⭐⭐⭐ 中等 |
| **功能完整性** | 基础 | 完整 | 完整 | 完整 |
| **与 Three.js 集成** | 原生支持 | 需要适配 | 有封装 | 需要适配 |
| **维护状态** | 已停止 | 活跃 | 活跃 | 活跃 |
| **体积 (minified)** | ~170KB | ~1MB (WASM) | ~300KB | ~1.5MB |
| **授权协议** | MIT | Apache 2.0 | Apache 2.0 | BSD |

### 推荐方案：Rapier3D (备选：Cannon-es)

**主选：Rapier3D**
- **性能优势**：Rust 编写，WebAssembly 编译，性能最佳
- **功能完整**：支持碰撞检测、刚体、关节、触发器等
- **现代架构**：活跃维护，API 设计现代化
- **TypeScript 支持**：类型定义完善

**备选：Cannon-es**
- **平滑迁移**：Cannon.js 的社区维护版，API 风格与 Matter.js 相似
- **轻量级**：体积小，加载快
- **Three.js 集成**：生态完善，有大量示例

---

## 4. 推荐技术组合

### 最终技术栈
```
3D 渲染: Three.js r150+
3D 物理: Rapier3D (或 Cannon-es)
构建工具: Vite (可选)
语言: JavaScript/TypeScript
```

### 选择依据
1. **性能优先**：Rapier3D 物理性能最佳，适合物理对战游戏
2. **开发效率**：Three.js + Rapier3D 组合有良好的 TypeScript 支持
3. **生态兼容**：均有活跃社区和丰富资源
4. **渐进迁移**：可以分阶段引入，不影响现有 2D 版本

---

## 5. 架构设计与集成方案

### 5.1 整体架构

```
┌─────────────────────────────────────────────────┐
│         Game (游戏逻辑层 - 保持不变)            │
├─────────────────────────────────────────────────┤
│  PhysicsEngine (接口抽象层)                      │
│  ├─ MatterPhysics (现有 2D 实现)                │
│  └─ RapierPhysics (新增 3D 实现)                │
├─────────────────────────────────────────────────┤
│  Renderer (接口抽象层)                           │
│  ├─ CanvasRenderer (现有 2D 实现)               │
│  └─ ThreeRenderer (新增 3D 实现)                │
├─────────────────────────────────────────────────┤
│  CardSystem (保持不变 - 数据驱动)               │
└─────────────────────────────────────────────────┘
```

### 5.2 核心接口设计

#### PhysicsEngine 接口统一
```javascript
// 统一的物理引擎接口，2D/3D 实现共同遵守
interface IPhysicsEngine {
    createPlayer(x: number, y: number, z?: number, playerId: number): any;
    applyForce(playerId: number, fx: number, fy: number, fz?: number): void;
    applyImpulse(playerId: number, ix: number, iy: number, iz?: number): void;
    setPlayerMass(playerId: number, mass: number): void;
    update(deltaTime: number): void;
    checkBoundary(playerId: number): boolean;
    getPlayer(playerId: number): any;
    getAllPlayers(): any[];
    addEffect(effect: any): void;
    reset(): void;
}
```

#### Renderer 接口统一
```javascript
interface IRenderer {
    render(gameState: any, aimingTarget?: any, currentPlayerPhysics?: any): void;
    resize(width: number, height: number): void;
}
```

### 5.3 目录结构规划

```
client/
├── js/
│   ├── constants.js          (共享常量 - 新增 3D 常量)
│   ├── physics/
│   │   ├── PhysicsEngine.js  (物理引擎接口抽象)
│   │   ├── MatterPhysics.js  (现有 2D 实现)
│   │   └── RapierPhysics.js  (新增 3D 实现)
│   ├── renderer/
│   │   ├── Renderer.js       (渲染器接口抽象)
│   │   ├── CanvasRenderer.js (现有 2D 实现)
│   │   └── ThreeRenderer.js  (新增 3D 实现)
│   ├── game.js               (修改：支持注入不同的物理/渲染引擎)
│   ├── cardSystem.js         (保持不变)
│   └── main.js               (修改：初始化时选择 2D/3D 模式)
├── lib/
│   ├── three.min.js
│   └── rapier3d.js
└── index.html                (修改：引入 3D 库)
```

### 5.4 Game 类改造方案

```javascript
class Game {
    constructor(canvas, options = { mode: '2d' }) {
        this.canvas = canvas;
        this.mode = options.mode; // '2d' 或 '3d'
        
        // 根据模式选择实现
        if (this.mode === '3d') {
            this.renderer = new ThreeRenderer(canvas);
            this.physics = new RapierPhysics();
        } else {
            this.renderer = new CanvasRenderer(canvas);
            this.physics = new MatterPhysics();
        }
        
        // 其余逻辑保持不变...
    }
}
```

---

## 6. 迁移路线图

### Phase 1: 基础设施 (1-2 周)
- [ ] 引入 Three.js 和 Rapier3D 库
- [ ] 重构为接口抽象架构
- [ ] 创建基础 3D 场景（竞技场、玩家模型）
- [ ] 保持 2D 版本完全可用

### Phase 2: 物理引擎迁移 (2-3 周)
- [ ] 实现 RapierPhysics 类
- [ ] 实现所有卡牌效果的 3D 版本
- [ ] 实现 3D 边界检测
- [ ] 物理参数调整与平衡

### Phase 3: 渲染系统迁移 (2-3 周)
- [ ] 实现 ThreeRenderer 类
- [ ] 3D 玩家模型与动画
- [ ] 3D 特效系统（力场、冲击等）
- [ ] 摄像机控制

### Phase 4: 完善与优化 (2 周)
- [ ] 性能优化
- [ ] 视觉效果增强
- [ ] 2D/3D 模式切换
- [ ] 测试与 Bug 修复

---

## 7. 关键技术实现点

### 7.1 坐标系统映射
```
2D (Canvas) → 3D (Three.js)
- (x, y) → (x, 0, z)  (y 轴向上)
- 距离单位保持比例
```

### 7.2 物理世界设置 (Rapier3D)
```javascript
// 3D 竞技场：圆柱形平台
const world = new RAPIER.World({ x: 0, y: -9.8, z: 0 });
const arenaRadius = 8; // 米
const arenaHeight = 0.5;

// 玩家刚体
const playerBody = world.createRigidBodyDynamic({
    x: 0, y: 2, z: 0
});
const playerCollider = world.createColliderCuboid(
    0.5, 0.5, 0.5, playerBody
);
playerCollider.setMass(70);
```

### 7.3 卡牌效果的 3D 适配
- **动量冲击**: 2D 冲量 (x,y) → 3D 冲量 (x, 0, z)
- **引力场**: 2D 圆形 → 3D 球体区域
- **摩擦区域**: 2D 圆形区域 → 3D 圆柱区域
- **约束连接**: 2D 距离约束 → 3D 距离约束

### 7.4 Three.js 场景基础
```javascript
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, width/height, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas });

// 竞技场：圆柱形平台
const arenaGeometry = new THREE.CylinderGeometry(radius, radius, 0.5, 32);
const arenaMaterial = new THREE.MeshStandardMaterial({ color: 0x444488 });
const arena = new THREE.Mesh(arenaGeometry, arenaMaterial);
scene.add(arena);

// 光照
const light = new THREE.DirectionalLight(0xffffff, 1);
scene.add(light);
```

---

## 8. 风险评估与缓解

| 风险项 | 影响 | 概率 | 缓解措施 |
|--------|------|------|----------|
| 3D 性能不足 | 高 | 中 | 采用 LOD、实例化渲染、限制物理步数 |
| 物理行为不一致 | 高 | 中 | 完善单元测试，保持 2D/3D 参数可配置 |
| 开发周期延长 | 中 | 低 | 采用渐进式迁移，2D/3D 并行开发 |
| 学习曲线陡峭 | 中 | 低 | 分阶段引入，先集成后优化 |
| 第三方库依赖风险 | 低 | 低 | 选择成熟稳定、社区活跃的库 |

---

## 9. 总结

- **渲染引擎**: 推荐 **Three.js**
- **物理引擎**: 推荐 **Rapier3D** (备选 **Cannon-es**)
- **迁移策略**: 采用接口抽象 + 渐进式迁移，保持 2D 版本可用
- **预期收益**: 更强的视觉表现力、更好的游戏体验、技术栈现代化
