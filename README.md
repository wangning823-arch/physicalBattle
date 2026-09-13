# 物理竞技场（3D 化版本）

浏览器端物理卡牌对战：把对手冲出圆盘即可获胜。在 2D Canvas 原版基础上完成 Three.js 3D 竞技场改造，卡牌逻辑与回合规则保持一致，无构建链路。

## 运行

```powershell
cd client
npm start
# 或：node server.js
```

浏览器打开：

| 模式 | 地址 |
|------|------|
| **3D（默认）** | http://localhost:8888/ |
| 2D 经典 | http://localhost:8888/?render=2d |

也可直接用静态服务器托管 `client/` 目录（任意 http server 均可）；本地已 vendoring `three.min.js` 与 `matter.min.js`，离线可玩（加载失败时会尝试 CDN 兜底）。

## 模式

- **双人对战** — 同屏 PvP  
- **人机对战** — 简单 / 普通 / 困难  
- **三人对战** — 三人同屏  

## 3D 操作

| 操作 | 作用 |
|------|------|
| 左键场地 | 瞄准落点 / 确认目标 |
| 右键或中键拖拽 | 旋转视角 |
| 滚轮 | 缩放 |
| `C` | 总览 / 跟随 当前回合玩家 |
| 数字键 `1`–`9` | 选中对应手牌 |
| `E` / `Enter` | 确认出牌 |
| `Esc` | 取消瞄准 / 选择 |

3D 模式下侧栏可点击标题折叠；手牌与状态面板叠在竞技场上层。

## 测试

```powershell
cd client
npm test
# 或：node tests/ai-turn-regression.mjs
```

无头 AI / 回合流程回归（不依赖 DOM / WebGL）。

## 目录结构

```
client/
  index.html          # 入口（含模式弹窗、手牌、规则说明）
  server.js           # 极简静态服务器，端口 8888
  css/style.css
  js/
    constants.js      # 配置与卡表常量
    physics.js        # Matter.js 物理、边界、临时效果
    cardSystem.js     # 抽牌 / 出牌 / 效果结算
    renderer.js       # 2D Canvas 渲染
    scene3d.js        # Three.js 场景 / 相机 / 特效 / 3D 输入
    aiPlayer.js       # AI 出牌
    game.js           # 回合与胜负
    main.js           # UI 与主循环
  vendor/
    three.min.js      # Three.js r128
    matter.min.js     # Matter.js 0.19
  tests/
    ai-turn-regression.mjs
```

## 3D 化里程碑（本分支 `loop/3d-version`）

1. 脚手架 — 本地 vendor + CDN 兜底  
2. 竞技场与地面 3D  
3. 玩家体模型与 physics 同步  
4. 相机跟随与操作映射  
5. 卡牌效果 3D 表现  
6. UI / 手牌与 3D 布局共存  
7. 边界与出界判定 3D  
8. AI / 回合回归  
9. 性能与资源释放  
10. 收尾：死代码清理与运行说明  

## 分支说明

- 远程：`origin` → `https://github.com/wangning823-arch/physicalBattle.git`  
- 本改造在分支 `loop/3d-version`，不覆盖 `main`  
- 代理：本机 GitHub 访问走 `socks5h://127.0.0.1:10808`（见仓库 `AGENTS.md`）  
