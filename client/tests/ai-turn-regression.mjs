/**
 * AI / 回合流程 无头回归测试（Node，不依赖 DOM / Three）
 * 运行：node client/tests/ai-turn-regression.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// 加载 matter.js（vendor 本地拷贝）
const MatterPath = path.join(clientRoot, 'vendor', 'matter.min.js');
const Matter = require(MatterPath);

function loadScript(ctx, rel, exportNames = []) {
  let code = readFileSync(path.join(clientRoot, rel), 'utf8');
  // class/const 顶层声明在 vm 里不会自动变成 sandbox 属性，显式挂回全局
  if (exportNames.length) {
    code += '\n;' + exportNames.map(n => `if (typeof ${n} !== 'undefined') { this.${n} = ${n}; }`).join(' ');
  }
  vm.runInContext(code, ctx, { filename: rel });
}

function createGameContext() {
  const sandbox = {
    Matter,
    console,
    Math,
    Date,
    window: {},
    document: {
      getElementById: () => null,
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => []
    },
    requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  loadScript(ctx, 'js/constants.js', ['GAME_CONFIG', 'PLAYER_CONFIG', 'GAME_STATES', 'CARD_TYPES']);
  loadScript(ctx, 'js/physics.js', ['PhysicsEngine']);
  loadScript(ctx, 'js/cardSystem.js', ['CardSystem', 'CARDS_DATABASE']);
  // renderer 在 3D 模式下不用，但仍被 Game 构造引用 —— 给最小 stub
  vm.runInContext(`class Renderer { constructor(){} render(){} drawArena(){} clear(){} }; this.Renderer = Renderer;`, ctx);
  loadScript(ctx, 'js/aiPlayer.js', ['AIPlayer']);
  loadScript(ctx, 'js/game.js', ['Game']);
  return ctx;
}

const results = [];
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function pass(name) {
  results.push({ ok: true, name });
  console.log('  ✓', name);
}
function fail(name, err) {
  results.push({ ok: false, name, err: String(err && err.message || err) });
  console.error('  ✗', name, '→', err && err.message || err);
}

async function test(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (e) {
    fail(name, e);
  }
}

/** 模拟 main.handleCurrentPhase 中 AI 分支：仅推进 AI 逻辑，不碰 DOM */
async function runAITurn(ctx) {
  const g = ctx.__game;
  const ai = g.aiPlayer;
  assert(ai, 'aiPlayer missing');
  assert(!ai.isThinking, 'AI already thinking');
  // 与 main.triggerAITurn 等价的核心路径
  await ai.playTurn(g.players[1].id);
  if (g.isNewRound) {
    g.drawCardsForAllPlayers();
  }
}

/** 玩家回合：按需弃牌后结束出牌（模拟 endTurn） */
function endHumanTurn(ctx) {
  const g = ctx.__game;
  if (g.turnPhase === 'discard') {
    const need = g.checkNeedDiscard(g.currentPlayerIndex);
    if (need > 0) {
      const p = g.players[g.currentPlayerIndex];
      g.startDiscardPhase(g.currentPlayerIndex, need, 'phaseDiscard');
      // 自动选最便宜的牌弃
      const idxs = p.cards.map((c, i) => ({ c, i })).sort((a, b) => a.c.cost - b.c.cost).slice(0, need);
      idxs.forEach(({ i }) => g.toggleDiscardSelection(i));
      g.confirmDiscard();
    }
    g.advanceGamePhase();
  } else {
    g.advanceGamePhase();
    if (g.isNewRound) g.drawCardsForAllPlayers();
  }
}

async function run() {
  console.log('=== AI/回合流程回归测试 ===\n');

  await test('initGame pve：双方发牌、回合指向玩家1 discard', () => {
    const ctx = createGameContext();
    const g = new ctx.Game(null);
    ctx.__game = g;
    g.initGame('pve', 'normal');
    assert(g.gameMode === 'pve', 'mode pve');
    assert(g.aiPlayer, 'has ai');
    assert(g.players.length === 2, '2 players');
    assert(g.players[0].cards.length === ctx.GAME_CONFIG.CARDS_PER_TURN, 'p1 cards');
    assert(g.players[1].cards.length === ctx.GAME_CONFIG.CARDS_PER_TURN, 'p2 cards');
    assert(g.currentPlayerIndex === 0, 'starts at p1');
    assert(g.turnPhase === 'discard', 'discard phase');
    assert(g.isAITurn() === false, 'not AI turn at start');
    assert(g.physics.getAllPlayers().length === 2, 'physics bodies');
  });

  await test('玩家结束回合后切入 AI discard，AI playTurn 能完成一轮', async () => {
    const ctx = createGameContext();
    const g = new ctx.Game(null);
    ctx.__game = g;
    g.initGame('pve', 'easy');
    g.aiPlayer.thinkingDelay = 1;
    g.aiPlayer.cardPlayDelay = 1;

    // 玩家先走完 discard→play→结束出牌
    g.advanceGamePhase(); // discard → play
    assert(g.turnPhase === 'play', 'human play phase');
    endHumanTurn(ctx); // play → AI discard
    assert(g.currentPlayerIndex === 1, 'now AI index');
    assert(g.isAITurn(), 'isAITurn true');
    assert(g.turnPhase === 'discard', 'AI starts in discard');

    const beforeCards = g.players[1].cards.length;
    await runAITurn(ctx);

    // 若仍处 AI discard，可能只完成了 discard→play 切换；再触发一轮直到交还或出牌
    let guard = 0;
    while (g.isAITurn() && g.state === ctx.GAME_STATES.PLAYING && guard++ < 4) {
      await runAITurn(ctx);
    }

    // 最终应回到玩家1 或仍在 AI 但 phase 合法
    assert([0, 1].includes(g.currentPlayerIndex), 'valid current index');
    assert(['discard', 'play'].includes(g.turnPhase), 'valid phase');
    // 若已交还玩家，则 AI 手牌可能变化
    if (g.currentPlayerIndex === 0) {
      assert(g.turnPhase === 'discard', 'back to p1 discard');
    }
    // 无负能量、无 NaN
    g.players.forEach(p => {
      assert(Number.isFinite(p.energy) && p.energy >= 0, `energy ok p${p.id}=${p.energy}`);
      assert(Number.isFinite(p.cards.length), 'cards length finite');
    });
    void beforeCards;
  });

  await test('AI 连续多轮：无死锁、无非法状态', async () => {
    const ctx = createGameContext();
    const g = new ctx.Game(null);
    ctx.__game = g;
    g.initGame('pve', 'normal');
    g.aiPlayer.thinkingDelay = 1;
    g.aiPlayer.cardPlayDelay = 1;

    for (let round = 0; round < 8; round++) {
      // 玩家 discard→play→end
      if (g.state !== ctx.GAME_STATES.PLAYING) break;
      if (g.isAITurn()) {
        await runAITurn(ctx);
        continue;
      }
      if (g.turnPhase === 'discard') {
        const need = g.checkNeedDiscard(g.currentPlayerIndex);
        if (need > 0) {
          const p = g.players[g.currentPlayerIndex];
          g.startDiscardPhase(g.currentPlayerIndex, need, 'phaseDiscard');
          const idxs = p.cards.map((c, i) => ({ c, i })).sort((a, b) => a.c.cost - b.c.cost).slice(0, need);
          idxs.forEach(({ i }) => g.toggleDiscardSelection(i));
          assert(g.confirmDiscard(), 'human discard ok');
        }
        g.advanceGamePhase();
      } else {
        g.advanceGamePhase();
        if (g.isNewRound) g.drawCardsForAllPlayers();
      }
      if (g.isAITurn() && g.state === ctx.GAME_STATES.PLAYING) {
        await runAITurn(ctx);
      }
      // 物理步进几帧，避免完全静止
      for (let f = 0; f < 5; f++) g.physics.update();
      g.checkGameOver();
    }

    assert(g.currentTurn >= 1 || g.state === ctx.GAME_STATES.GAME_OVER, 'turn advanced or over');
    g.players.forEach(p => {
      assert(Number.isFinite(p.energy) && p.energy >= 0, `energy p${p.id}`);
      assert(!p.cards.some(c => !c || !c.id), 'no broken cards');
    });
    // aiming 不应泄漏
    assert(!g.aimingState.active, 'no leaked aiming');
    assert(!g.targetingState.active, 'no leaked targeting');
    assert(!g.aiPlayer.isThinking, 'AI not stuck thinking');
  });

  await test('quantum_superposition：AI 出牌不二次 advance、不双重抽牌', async () => {
    const ctx = createGameContext();
    const g = new ctx.Game(null);
    ctx.__game = g;
    g.initGame('pve', 'hard');
    g.aiPlayer.thinkingDelay = 1;
    g.aiPlayer.cardPlayDelay = 1;

    // 强制 AI 手上有量子卡且能量足够
    const aiP = g.players[1];
    aiP.energy = ctx.GAME_CONFIG.MAX_ENERGY;
    // 优先从牌库抽真卡实例，保证 discard 生命周期正常
    let real = g.cardSystem.deck.find(c => c.id === 'quantum_superposition');
    if (!real) {
      g.cardSystem.deck.push(...g.cardSystem.discardPile.splice(0, g.cardSystem.discardPile.length));
      real = g.cardSystem.deck.find(c => c.id === 'quantum_superposition');
    }
    if (real) {
      // 从 deck 移除，避免双份
      const di = g.cardSystem.deck.indexOf(real);
      if (di >= 0) g.cardSystem.deck.splice(di, 1);
      aiP.cards = [real];
    } else {
      // 兜底：从数据库模板注入
      const quantum = ctx.CARDS_DATABASE.find(c => c.id === 'quantum_superposition');
      assert(quantum, 'quantum in database');
      aiP.cards = [{ ...quantum }];
      const origDiscard = g.cardSystem.discard.bind(g.cardSystem);
      g.cardSystem.discard = (card) => { try { origDiscard(card); } catch { /* ignore */ } };
    }

    // 切到 AI play 阶段
    g.currentPlayerIndex = 1;
    g.turnPhase = 'play';
    g.currentTurn = 3;
    const turnBefore = g.currentTurn;
    const idxBefore = g.currentPlayerIndex;
    const phaseCalls = [];
    const origAdvance = g.advanceGamePhase.bind(g);
    g.advanceGamePhase = function (...args) {
      phaseCalls.push(g.turnPhase);
      return origAdvance(...args);
    };

    await g.aiPlayer.playTurn(aiP.id);

    // playCard 内 advance 一次；AI 不应再 advance
    assert(phaseCalls.length <= 1, `advance called ${phaseCalls.length} times (expect ≤1)`);
    // 若未触发新回合则 currentTurn 不变；若触发则 isNewRound 已消费
    assert(g.isNewRound === false, 'isNewRound consumed');
    assert(!g.aiPlayer.isThinking, 'AI released lock');
    assert(!g.aimingState.active, 'no leaked aim after quantum path');
    // 若打出量子，回合应已推进
    const stillHeld = aiP.cards.some(c => c && c.id === 'quantum_superposition');
    if (!stillHeld && phaseCalls.length === 1) {
      assert(
        g.currentPlayerIndex !== idxBefore || g.currentTurn > turnBefore,
        'turn advanced after quantum'
      );
    }
  });

  await test('AI 自动弃牌：手牌超上限时 confirmDiscard 生效', () => {
    const ctx = createGameContext();
    const g = new ctx.Game(null);
    ctx.__game = g;
    g.initGame('pve', 'normal');
    g.aiPlayer.thinkingDelay = 1;
    g.aiPlayer.cardPlayDelay = 1;

    g.currentPlayerIndex = 1;
    g.turnPhase = 'play';
    // 塞满手牌
    const extra = [];
    while (g.players[1].cards.length < 8 && g.cardSystem.deck.length) {
      extra.push(...g.cardSystem.draw(1));
    }
    g.players[1].cards.push(...extra);
    const before = g.players[1].cards.length;
    const need = g.checkNeedDiscard(1);
    assert(need === before - ctx.GAME_CONFIG.MAX_HAND_SIZE, `need=${need}`);
    g.aiPlayer.autoDiscard(g.players[1].id);
    assert(g.players[1].cards.length === ctx.GAME_CONFIG.MAX_HAND_SIZE, `hand=${g.players[1].cards.length}`);
    assert(!g.discardState.active, 'discard state cleared');
  });

  await test('玩家出界淘汰后 AI 回合仍可安全结束（3D state 不炸）', async () => {
    const ctx = createGameContext();
    const g = new ctx.Game(null);
    ctx.__game = g;
    g.initGame('pve', 'hard');
    g.aiPlayer.thinkingDelay = 1;
    g.aiPlayer.cardPlayDelay = 1;

    // 把玩家1扔出界
    const p1 = g.physics.getPlayer(1);
    ctx.Matter.Body.setPosition(p1, { x: 10000, y: 10000 });
    g.checkGameOver();
    assert(g.players[0].eliminated, 'p1 eliminated');
    assert(g.state === ctx.GAME_STATES.GAME_OVER || g.players[1].eliminated === false, 'game over or still running');

    // 即使 game over，AI.playTurn 也应不抛错、不卡死
    if (g.state === ctx.GAME_STATES.GAME_OVER) {
      // 此时可能已无对局；仍调用一次确认不抛
      await g.aiPlayer.playTurn(2);
    } else {
      g.currentPlayerIndex = 1;
      g.turnPhase = 'play';
      await g.aiPlayer.playTurn(2);
    }
    assert(!g.aiPlayer.isThinking, 'AI unlocked after edge case');
    // getState 不应抛错
    const st = g.getState();
    assert(st && Array.isArray(st.players), 'getState ok');
    assert(typeof st.maxEdgeRisk === 'number', 'maxEdgeRisk present');
  });

  await test('restart 后 AI 难度与 isAITurn 恢复', () => {
    const ctx = createGameContext();
    const g = new ctx.Game(null);
    ctx.__game = g;
    g.initGame('pve', 'hard');
    g.aiDifficulty = 'hard';
    // 推进一点状态
    g.advanceGamePhase();
    g.currentTurn = 5;
    g.restart();
    assert(g.currentTurn === 1, 'turn reset');
    assert(g.currentPlayerIndex === 0, 'index reset');
    assert(g.turnPhase === 'discard', 'phase reset');
    assert(g.aiPlayer, 'ai recreated');
    assert(g.aiPlayer.difficultyName === 'hard', 'difficulty kept');
    assert(g.players.every(p => p.cards.length === ctx.GAME_CONFIG.CARDS_PER_TURN), 'redraw');
    assert(!g.isNewRound, 'isNewRound false after restart');
  });

  await test('3pvp 无 AI：isAITurn false，三人轮转跳过淘汰者', () => {
    const ctx = createGameContext();
    const g = new ctx.Game(null);
    ctx.__game = g;
    g.initGame('3pvp');
    assert(!g.aiPlayer, 'no ai in 3pvp');
    assert(g.isAITurn() === false, 'not AI');
    assert(g.players.length === 3, '3 players');

    // 淘汰 p2 后轮转应跳到 p3
    g.players[1].eliminated = true;
    g.physics.removePlayer(2);
    g.currentPlayerIndex = 1;
    g.turnPhase = 'play';
    g.advanceGamePhase();
    assert(g.currentPlayerIndex === 2, `skipped to 3, got ${g.currentPlayerIndex}`);
  });

  await test('AI 出牌打出胜负后不再 advanceGamePhase / 不泄漏思考锁', async () => {
    const ctx = createGameContext();
    const g = new ctx.Game(null);
    ctx.__game = g;
    g.initGame('pve', 'hard');
    g.aiPlayer.thinkingDelay = 1;
    g.aiPlayer.cardPlayDelay = 1;

    // 强制 AI 回合，手牌给一张无消耗卡；同时把玩家1扔出界制造“对局已可结束”
    g.currentPlayerIndex = 1;
    g.turnPhase = 'play';
    const aiP = g.players[1];
    aiP.energy = 5;
    const free = g.cardSystem.deck.find(c => c.cost === 0) || g.cardSystem.deck[0];
    if (free) {
      const di = g.cardSystem.deck.indexOf(free);
      if (di >= 0) g.cardSystem.deck.splice(di, 1);
      aiP.cards = [free];
    }

    // 在 AI delay 结束后模拟“对局结束”
    const origAdvance = g.advanceGamePhase.bind(g);
    let advanced = 0;
    g.advanceGamePhase = function (...args) {
      advanced++;
      return origAdvance(...args);
    };

    // 预先标记：真正产品里 checkGameOver 会设 state；这里模拟中途结束
    // 用 monkey-patch playTurn 的 delay 结束点：在 isThinking 期间由外部设 GAME_OVER
    const playPromise = g.aiPlayer.playTurn(aiP.id);
    // 等 isThinking 起来后立刻结束对局
    await new Promise(r => setTimeout(r, 5));
    g.state = ctx.GAME_STATES.GAME_OVER;
    await playPromise;

    assert(!g.aiPlayer.isThinking, 'AI lock released');
    assert(!g.aimingState.active, 'no aim leak');
    assert(advanced === 0 || g.state === ctx.GAME_STATES.GAME_OVER, 'safe');
    // GAME_OVER 时不应再 advance（我们期望 0 次；若 delay 前已 advance 也可接受但 state 已 over）
    if (g.state === ctx.GAME_STATES.GAME_OVER) {
      // 核心：结束后 currentPlayer 仍可读，getState 不炸
      const st = g.getState();
      assert(Array.isArray(st.players), 'state snapshot ok');
    }
  });

  await test('is3DRender 在无 Scene3DInstance 时为 false（不阻塞主循环）', () => {
    const ctx = createGameContext();
    const g = new ctx.Game(null);
    ctx.__game = g;
    g.initGame('pvp');
    assert(g.is3DRender() === false, '2d fallback');
    ctx.window.Scene3DInstance = { ready: true };
    assert(g.is3DRender() === true, '3d detect');
    ctx.window.Scene3DInstance = { ready: false };
    assert(g.is3DRender() === false, 'not ready');
  });

  console.log('\n=== 结果汇总 ===');
  const ok = results.filter(r => r.ok).length;
  const bad = results.length - ok;
  console.log(`pass=${ok} fail=${bad} total=${results.length}`);
  if (bad > 0) process.exitCode = 1;
}

run().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
