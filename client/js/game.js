class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.physics = new PhysicsEngine();
        this.cardSystem = new CardSystem();
        this.state = GAME_STATES.WAITING;
        this.currentTurn = 1;
        this.currentPlayerIndex = 0;
        this.players = [
            { id: 1, energy: GAME_CONFIG.STARTING_ENERGY, cards: [], eliminated: false, effects: [], quantumState: null, heatEngine: null, turnsPlayed: 0 },
            { id: 2, energy: GAME_CONFIG.STARTING_ENERGY, cards: [], eliminated: false, effects: [], quantumState: null, heatEngine: null, turnsPlayed: 0 }
        ];
        this.selectedCard = null;
        this.aimingState = { active: false, card: null, cardIndex: -1, playerId: 0 };
        this.turnPhase = 'discard'; // discard, play
        this.lastPlayedCard = null;
        this.discardState = {
            active: false,
            playerIndex: 0,
            requiredDiscards: 0,
            selectedIndices: []
        };
        this.isNewRound = false;
    }

    initGame() {
        this.physics.createPlayer(-160, 0, 1);
        this.physics.createPlayer(160, 0, 2);
        this.players[0].charge = 0; // 初始化玩家1电荷为0
        this.players[0].chargeDuration = 0; // 电荷持续回合数
        this.players[1].charge = 0; // 初始化玩家2电荷为0
        this.players[1].chargeDuration = 0;
        this.dealCards();
        this.state = GAME_STATES.PLAYING;
        this.currentTurn = 1;
        this.currentPlayerIndex = 0;
        this.turnPhase = 'discard';
        this.isNewRound = false;
    }

    dealCards() {
        console.log('Dealing cards...');
        this.players.forEach((player, index) => {
            const drawn = this.cardSystem.draw(GAME_CONFIG.CARDS_PER_TURN);
            player.cards = drawn;
            console.log(`Player ${player.id} got ${drawn.length} cards`, drawn);
        });
    }

    playCard(playerId, cardIndex) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.eliminated) return false;
        if (cardIndex < 0 || cardIndex >= player.cards.length) return false;
        const card = player.cards[cardIndex];
        if (player.energy < card.cost) return false;
        
        if (card.effect.needsAim) {
            this.aimingState = { active: true, card, cardIndex, playerId };
            return 'aiming';
        }
        
        player.energy -= card.cost;
        this.lastPlayedCard = card;
        this.executeCard(card, playerId, null);
        player.cards.splice(cardIndex, 1);
        
        // 如果是量子叠加卡牌，结束当前玩家的出牌阶段
        if (card.id === 'quantum_superposition') {
            this.advanceGamePhase();
            return 'end_turn';
        }
        
        return true;
    }

    confirmAim(targetX, targetY) {
        if (!this.aimingState.active) return false;
        
        const { card, cardIndex, playerId } = this.aimingState;
        const player = this.players.find(p => p.id === playerId);
        
        // 检查目标位置是否在圆形场地内
        // 如果是领域类卡牌，还要考虑领域自身的半径
        let maxAllowedRadius = GAME_CONFIG.ARENA_RADIUS;
        if (card.effect.radius) {
            // 确保领域完全在场地内
            maxAllowedRadius = GAME_CONFIG.ARENA_RADIUS - card.effect.radius;
            // 防止负数
            maxAllowedRadius = Math.max(0, maxAllowedRadius);
        }
        
        const targetDist = Math.sqrt(targetX ** 2 + targetY ** 2);
        if (targetDist > maxAllowedRadius) {
            console.log('目标位置在场地外，无法放置！');
            return false;
        }
        
        player.energy -= card.cost;
        this.lastPlayedCard = card;
        this.executeCard(card, playerId, { x: targetX, y: targetY });
        player.cards.splice(cardIndex, 1);
        
        this.aimingState = { active: false, card: null, cardIndex: -1, playerId: 0 };
        return true;
    }

    cancelAim() {
        this.aimingState = { active: false, card: null, cardIndex: -1, playerId: 0 };
    }

    executeCard(card, playerId, aimTarget) {
        const selfPlayer = this.players.find(p => p.id === playerId);
        const selfPhysics = this.physics.getPlayer(playerId);
        const targetId = playerId === 1 ? 2 : 1;
        const targetPhysics = this.physics.getPlayer(targetId);
        const targetPlayer = this.players.find(p => p.id === targetId);
        
        // 热机充能功能：使用卡牌时（非热机本身）自动充能
        if (card.id !== 'heat_engine' && selfPlayer.heatEngine && selfPlayer.heatEngine.active) {
            selfPlayer.heatEngine.charge = Math.min(selfPlayer.heatEngine.maxCharge, selfPlayer.heatEngine.charge + 1);
        }
        
        // 如果目标处于量子叠加态，卡牌无效
        if (targetPlayer && targetPlayer.quantumState !== null && 
            (card.effect.targetEnemy || ['momentum_blast', 'explosive_charge', 'charge_attach', 'charge_attach_negative'].includes(card.id))) {
            return; // 卡牌对量子态目标无效
        }

        // 卡牌飞行轨迹特效（有瞄准目标的卡牌）
        if (aimTarget && selfPhysics) {
            this.physics.addTempEffect({
                type: 'card_fly',
                startX: selfPhysics.position.x,
                startY: selfPhysics.position.y,
                endX: aimTarget.x,
                endY: aimTarget.y,
                cardType: card.type,
                life: 300,
                maxLife: 300,
                _seed: Date.now()
            });
        }

        switch (card.id) {
            case 'momentum_blast':
                if (targetPhysics && aimTarget && selfPhysics) {
                    const targetPlayer = this.players.find(p => p.id === targetId);
                    const hasAnchor = targetPlayer && targetPlayer.effects.some(e => e.type === 'anchor');

                    if (!hasAnchor) {
                        // 计算激光路径（从自身到瞄准点的线段）到对手的最近距离
                        const lx = aimTarget.x - selfPhysics.position.x;
                        const ly = aimTarget.y - selfPhysics.position.y;
                        const lLenSq = lx * lx + ly * ly;
                        let t = 0;
                        if (lLenSq > 0) {
                            t = Math.max(0, Math.min(1,
                                ((targetPhysics.position.x - selfPhysics.position.x) * lx +
                                 (targetPhysics.position.y - selfPhysics.position.y) * ly) / lLenSq
                            ));
                        }
                        const closestX = selfPhysics.position.x + t * lx;
                        const closestY = selfPhysics.position.y + t * ly;
                        const hitDist = Math.sqrt(
                            (targetPhysics.position.x - closestX) ** 2 +
                            (targetPhysics.position.y - closestY) ** 2
                        );
                        const HIT_RADIUS = 30; // 玩家碰撞半径

                        if (hitDist <= HIT_RADIUS) {
                            // 激光击中对手，施加冲量（方向：从自身指向对手）
                            const dx = targetPhysics.position.x - selfPhysics.position.x;
                            const dy = targetPhysics.position.y - selfPhysics.position.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > 0) {
                                const impulseX = (dx / dist) * card.effect.impulse;
                                const impulseY = (dy / dist) * card.effect.impulse;
                                this.physics.applyImpulse(targetId, impulseX, impulseY);
                            }

                            // 激光特效：从自身到击中点
                            this.physics.addTempEffect({
                                type: 'laser',
                                startX: selfPhysics.position.x,
                                startY: selfPhysics.position.y,
                                endX: closestX,
                                endY: closestY,
                                life: 500,
                                maxLife: 500,
                                _seed: Date.now() + playerId * 1000
                            });
                        }
                        // 未击中则不出效果
                    }
                }
                break;
            case 'directional_dash':
                if (selfPhysics && aimTarget) {
                    const dx = aimTarget.x - selfPhysics.position.x;
                    const dy = aimTarget.y - selfPhysics.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        const impulseX = (dx / dist) * card.effect.impulse;
                        const impulseY = (dy / dist) * card.effect.impulse;
                        this.physics.applyImpulse(playerId, impulseX, impulseY);
                        // 冲刺残影特效
                        const angle = Math.atan2(dy, dx);
                        this.physics.addTempEffect({
                            type: 'dash_trail',
                            x: selfPhysics.position.x,
                            y: selfPhysics.position.y,
                            angle: angle,
                            life: 400,
                            maxLife: 400,
                            _seed: Date.now() + playerId * 3000
                        });
                    }
                }
                break;
            case 'gravity_well':
                if (aimTarget) {
                    this.physics.addEffect({
                        type: 'gravityField',
                        x: aimTarget.x,
                        y: aimTarget.y,
                        radius: card.effect.radius,
                        strength: card.effect.strength,
                        duration: card.effect.duration,
                        _seed: Date.now() + 1111
                    });
                }
                break;
            case 'repulsion_field':
                if (selfPhysics) {
                    this.physics.addEffect({
                        type: 'repulsionField',
                        x: selfPhysics.position.x,
                        y: selfPhysics.position.y,
                        radius: card.effect.radius,
                        strength: -card.effect.strength,
                        duration: card.effect.duration,
                        _seed: Date.now() + 2222
                    });
                }
                break;

            case 'mass_increase':
            case 'mass_decrease':
                if (selfPlayer && selfPhysics) {
                    const currentMass = this.physics.getPlayer(playerId)?.mass || PLAYER_CONFIG.MASS;
                    const originalMass = selfPlayer.originalMass || PLAYER_CONFIG.MASS;
                    if (!selfPlayer.originalMass) selfPlayer.originalMass = originalMass;
                    const newMass = originalMass * card.effect.multiplier;
                    this.physics.setPlayerMass(playerId, newMass);
                    selfPlayer.effects.push({
                        type: 'massChange',
                        multiplier: card.effect.multiplier,
                        remainingTurns: card.effect.duration,
                        originalMass: originalMass,
                        startTurn: selfPlayer.turnsPlayed
                    });
                    // 质量变化特效
                    this.physics.addTempEffect({
                        type: 'mass_change',
                        x: selfPhysics.position.x,
                        y: selfPhysics.position.y,
                        massMultiplier: card.effect.multiplier,
                        life: 600,
                        maxLife: 600,
                        _seed: Date.now() + 6666
                    });
                }
                break;
            case 'explosive_charge':
                if (targetPhysics && aimTarget && selfPhysics) {
                    const targetPlayer = this.players.find(p => p.id === targetId);
                    const hasAnchor = targetPlayer && targetPlayer.effects.some(e => e.type === 'anchor');

                    if (!hasAnchor) {
                        // 计算激光路径到对手的最近距离
                        const lx = aimTarget.x - selfPhysics.position.x;
                        const ly = aimTarget.y - selfPhysics.position.y;
                        const lLenSq = lx * lx + ly * ly;
                        let t = 0;
                        if (lLenSq > 0) {
                            t = Math.max(0, Math.min(1,
                                ((targetPhysics.position.x - selfPhysics.position.x) * lx +
                                 (targetPhysics.position.y - selfPhysics.position.y) * ly) / lLenSq
                            ));
                        }
                        const closestX = selfPhysics.position.x + t * lx;
                        const closestY = selfPhysics.position.y + t * ly;
                        const hitDist = Math.sqrt(
                            (targetPhysics.position.x - closestX) ** 2 +
                            (targetPhysics.position.y - closestY) ** 2
                        );
                        const HIT_RADIUS = 30;

                        if (hitDist <= HIT_RADIUS) {
                            const dx = targetPhysics.position.x - selfPhysics.position.x;
                            const dy = targetPhysics.position.y - selfPhysics.position.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > 0) {
                                const impulseX = (dx / dist) * card.effect.impulse;
                                const impulseY = (dy / dist) * card.effect.impulse;
                                this.physics.applyImpulse(targetId, impulseX, impulseY);
                            }

                            // 爆裂冲击特效在击中点
                            this.physics.addTempEffect({
                                type: 'momentum_blast',
                                x: closestX,
                                y: closestY,
                                life: 700,
                                maxLife: 700,
                                _seed: Date.now() + playerId * 2000
                            });
                        }
                    }
                }
                break;
            case 'anchor':
                if (selfPlayer) {
                    // 保存使用定位锚时的位置
                    if (selfPhysics) {
                        selfPlayer.anchorPosition = {
                            x: selfPhysics.position.x,
                            y: selfPhysics.position.y
                        };
                        // 同时在物理体上也保存一份
                        selfPhysics._anchorPos = {
                            x: selfPhysics.position.x,
                            y: selfPhysics.position.y
                        };
                        // 设为静态体：完全不动，不受任何力、冲量或碰撞影响
                        Matter.Body.setStatic(selfPhysics, true);
                        Matter.Body.setVelocity(selfPhysics, { x: 0, y: 0 });
                    }
                    selfPlayer.effects.push({
                        type: 'anchor',
                        remainingTurns: card.effect.duration,
                        startTurn: selfPlayer.turnsPlayed
                    });
                    console.log(`[Anchor] 玩家${playerId}使用定位锚, startTurn=${selfPlayer.turnsPlayed}, duration=${card.effect.duration}, effects=`, selfPlayer.effects);
                    // 立即告诉物理引擎这个玩家有定位锚了
                    if (this.physics.anchoredPlayerIds.indexOf(playerId) === -1) {
                        this.physics.anchoredPlayerIds.push(playerId);
                    }
                }
                break;
            case 'rigid_connection':
                if (selfPlayer) {
                    this.physics.createRigidConnection(card.effect.duration);
                }
                break;
            case 'soft_rope':
                if (selfPlayer) {
                    this.physics.createSoftRope(card.effect.duration);
                }
                break;
            case 'damping_field':
                if (aimTarget) {
                    this.physics.addEffect({
                        type: 'dampingField',
                        x: aimTarget.x,
                        y: aimTarget.y,
                        radius: card.effect.radius,
                        duration: card.effect.duration,
                        _seed: Date.now() + 9999
                    });
                }
                break;
            case 'charge_attach':
            case 'charge_attach_negative':
                // 给目标（敌人）累加电荷
                if (targetPlayer && !targetPlayer.eliminated) {
                    targetPlayer.charge += card.effect.charge;
                    targetPlayer.chargeDuration = card.effect.duration;
                    // 电荷附加特效
                    if (targetPhysics) {
                        this.physics.addTempEffect({
                            type: 'charge_apply',
                            x: targetPhysics.position.x,
                            y: targetPhysics.position.y,
                            charge: card.effect.charge,
                            life: 500,
                            maxLife: 500,
                            _seed: Date.now() + 4444
                        });
                    }
                }
                break;
            case 'self_charge':
            case 'self_charge_negative':
                // 给自己累加电荷
                selfPlayer.charge += card.effect.charge;
                selfPlayer.chargeDuration = card.effect.duration;
                // 自身电荷特效
                if (selfPhysics) {
                    this.physics.addTempEffect({
                        type: 'charge_apply',
                        x: selfPhysics.position.x,
                        y: selfPhysics.position.y,
                        charge: card.effect.charge,
                        life: 500,
                        maxLife: 500,
                        _seed: Date.now() + 5555
                    });
                }
                break;
            case 'ice_zone':
                // 冰霜地带 - 重置对方热机能量
                if (targetPlayer && targetPlayer.heatEngine && targetPlayer.heatEngine.active) {
                    targetPlayer.heatEngine.charge = 0;
                    // 添加冰冻特效
                    if (targetPhysics) {
                        this.physics.addTempEffect({
                            type: 'ice_reset',
                            x: targetPhysics.position.x,
                            y: targetPhysics.position.y,
                            life: 800,
                            maxLife: 800,
                            _seed: Date.now() + 3333
                        });
                    }
                }
                // 原有的摩擦区域功能
                if (aimTarget) {
                    this.physics.addEffect({
                        type: 'frictionZone',
                        x: aimTarget.x,
                        y: aimTarget.y,
                        radius: card.effect.radius,
                        friction: card.effect.friction,
                        duration: card.effect.duration,
                        _seed: Date.now() + 6666
                    });
                }
                break;
            case 'heat_engine':
                // 激活热机
                selfPlayer.heatEngine = {
                    active: true,
                    charge: 0,
                    maxCharge: 3,
                    duration: 3, // 3个回合有效期：使用回合 + 2个完整回合
                    ownerTurnsRemaining: 3, // 明确跟踪属于热机拥有者的剩余回合数
                    ownerId: playerId,
                    impulseMultiplier: 3
                };
                // 添加热机特效
                if (selfPhysics) {
                    this.physics.addTempEffect({
                        type: 'heat_engine',
                        x: selfPhysics.position.x,
                        y: selfPhysics.position.y,
                        life: 500,
                        maxLife: 500,
                        _seed: Date.now() + 5555
                    });
                }
                break;
            case 'mass_energy':
                // 质能方程：质量降低50%，获得2点能量（可超上限）
                if (selfPlayer && selfPhysics) {
                    const currentMass = this.physics.getPlayer(playerId)?.mass || PLAYER_CONFIG.MASS;
                    const originalMass = selfPlayer.originalMass || PLAYER_CONFIG.MASS;
                    if (!selfPlayer.originalMass) selfPlayer.originalMass = originalMass;
                    const newMass = originalMass * card.effect.massMultiplier;
                    this.physics.setPlayerMass(playerId, newMass);
                    // 能量超过上限也保留
                    selfPlayer.energy += card.effect.energyGain;
                    selfPlayer.effects.push({
                        type: 'massChange',
                        multiplier: card.effect.massMultiplier,
                        remainingTurns: card.effect.duration,
                        originalMass: originalMass,
                        startTurn: selfPlayer.turnsPlayed
                    });
                    // 特效
                    this.physics.addTempEffect({
                        type: 'mass_change',
                        x: selfPhysics.position.x,
                        y: selfPhysics.position.y,
                        massMultiplier: card.effect.massMultiplier,
                        life: 600,
                        maxLife: 600,
                        _seed: Date.now() + 7777
                    });
                }
                break;
            case 'quantum_superposition':
                // 进入量子叠加态
                console.log('=== 使用量子叠加卡牌 ===');
                console.log('当前 physics.effects:', this.physics.effects.map(e => ({ type: e.type, duration: e.duration })));
                selfPlayer.quantumState = 'superposition';
                // 添加特效
                if (selfPhysics) {
                    this.physics.addTempEffect({
                        type: 'quantum',
                        x: selfPhysics.position.x,
                        y: selfPhysics.position.y,
                        life: 1000,
                        maxLife: 1000,
                        _seed: Date.now() + 7777
                    });
                }
                console.log('使用量子叠加后 physics.effects:', this.physics.effects.map(e => ({ type: e.type, duration: e.duration })));
                break;
        }
        this.cardSystem.discard(card);
        this.checkGameOver();
    }

    // 核心流程：玩家一弃→玩家一出→玩家二弃→玩家二出
    advanceGamePhase() {
        if (this.turnPhase === 'discard') {
            // ===== 弃牌阶段开始 = 玩家回合开始 =====
            // 在这里处理该玩家的效果过期（从上一次出牌到这次出牌之间）
            const currentPlayer = this.players[this.currentPlayerIndex];
            currentPlayer.turnsPlayed++;
            this.processPlayerEffects(currentPlayer);
            if (currentPlayer.chargeDuration > 0) {
                currentPlayer.chargeDuration--;
                if (currentPlayer.chargeDuration < 0) {
                    currentPlayer.charge = 0;
                    currentPlayer.chargeDuration = 0;
                }
            }

            // 弃牌阶段结束，进入该玩家的出牌阶段
            this.turnPhase = 'play';
        } else {
            // 出牌阶段结束
            const currentPlayer = this.players[this.currentPlayerIndex];

            // 热机拥有者的回合结束处理
            if (currentPlayer.heatEngine && currentPlayer.heatEngine.active) {
                currentPlayer.heatEngine.ownerTurnsRemaining--;
                currentPlayer.heatEngine.duration = currentPlayer.heatEngine.ownerTurnsRemaining;
                if (currentPlayer.heatEngine.ownerTurnsRemaining <= 0) {
                    this.settleHeatEngine(currentPlayer);
                }
            }

            if (this.currentPlayerIndex === 0) {
                // 玩家一出牌结束，轮到玩家二
                this.currentPlayerIndex = 1;
                this.turnPhase = 'discard';

                // 玩家一出完，减少持久效果持续时间
                this.physics.updateEffectsTurn();

                // 检查玩家2是否需要在对手回合结束时坍缩
                const player2 = this.players[1];
                if (player2 && !player2.eliminated && player2.quantumState === 'superposition') {
                    this.collapseQuantumState(player2);
                }
            } else {
                // 玩家二出牌结束，新回合开始
                this.currentPlayerIndex = 0;
                this.currentTurn++;
                this.isNewRound = true;
                this.turnPhase = 'discard';

                // 检查玩家1是否需要在对手回合结束时坍缩
                const player1 = this.players[0];
                if (player1 && !player1.eliminated && player1.quantumState === 'superposition') {
                    this.collapseQuantumState(player1);
                }

                // 新回合：所有玩家补充能量
                this.physics.updateEffectsTurn();
                for (let i = 0; i < this.players.length; i++) {
                    const player = this.players[i];
                    if (!player.eliminated) {
                        player.energy = Math.min(
                            GAME_CONFIG.MAX_ENERGY,
                            player.energy + GAME_CONFIG.ENERGY_PER_TURN
                        );
                    }
                }
            }
        }
    }
    
    // 量子态坍缩
    collapseQuantumState(player) {
        // 坍缩：随机位置传送
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * (GAME_CONFIG.ARENA_RADIUS - 50);
        const newX = Math.cos(angle) * radius;
        const newY = Math.sin(angle) * radius;
        const physics = this.physics.getPlayer(player.id);
        if (physics) {
            Matter.Body.setPosition(physics, { x: newX, y: newY });
            Matter.Body.setVelocity(physics, { x: 0, y: 0 });
            
            // 添加坍缩特效
            this.physics.addTempEffect({
                type: 'quantum',
                x: newX,
                y: newY,
                life: 800,
                maxLife: 800,
                _seed: Date.now() + 8888
            });
        }
        player.quantumState = null; // 恢复正常
    }
    
    // 手动发射热机
    fireHeatEngine(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.heatEngine || !player.heatEngine.active) return false;
        if (player.heatEngine.charge < player.heatEngine.maxCharge) return false;

        const heatEngine = player.heatEngine;
        const selfPhysics = this.physics.getPlayer(player.id);
        const targetId = player.id === 1 ? 2 : 1;
        const targetPhysics = this.physics.getPlayer(targetId);

        // 检查目标是否有定位锚效果
        const targetPlayer = this.players.find(p => p.id === targetId);
        const hasAnchor = targetPlayer && targetPlayer.effects.some(e => e.type === 'anchor');

        // 释放3倍动量冲击（只对无定位锚的目标）
        if (targetPhysics && selfPhysics && !hasAnchor) {
            const dx = targetPhysics.position.x - selfPhysics.position.x;
            const dy = targetPhysics.position.y - selfPhysics.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                const impulse = 180 * heatEngine.impulseMultiplier; // 3×动量冲击
                const impulseX = (dx / dist) * impulse;
                const impulseY = (dy / dist) * impulse;
                this.physics.applyImpulse(targetId, impulseX, impulseY);

                // 添加热机爆发特效 - 预生成粒子
                this.physics.addTempEffect({
                    type: 'heat_engine_blast',
                    x: targetPhysics.position.x,
                    y: targetPhysics.position.y,
                    life: 1500,
                    maxLife: 1500,
                    _seed: Date.now() + 9999,
                    _startTime: Date.now()
                });
            }
        }

        // 发射后移除热机
        player.heatEngine = null;
        return true;
    }

    // 热机结算
    settleHeatEngine(player) {
        const heatEngine = player.heatEngine;
        if (!heatEngine) return;

        const selfPhysics = this.physics.getPlayer(player.id);
        const targetId = player.id === 1 ? 2 : 1;
        const targetPhysics = this.physics.getPlayer(targetId);

        // 检查目标是否有定位锚效果
        const targetPlayer = this.players.find(p => p.id === targetId);
        const hasAnchor = targetPlayer && targetPlayer.effects.some(e => e.type === 'anchor');

        if (heatEngine.charge >= heatEngine.maxCharge) {
            // 充满能量，释放3倍动量冲击（只对无定位锚的目标）
            if (targetPhysics && selfPhysics && !hasAnchor) {
                const dx = targetPhysics.position.x - selfPhysics.position.x;
                const dy = targetPhysics.position.y - selfPhysics.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    const impulse = 180 * heatEngine.impulseMultiplier; // 3×动量冲击
                    const impulseX = (dx / dist) * impulse;
                    const impulseY = (dy / dist) * impulse;
                    this.physics.applyImpulse(targetId, impulseX, impulseY);

                    // 添加热机爆发特效 - 预生成粒子
                    this.physics.addTempEffect({
                        type: 'heat_engine_blast',
                        x: targetPhysics.position.x,
                        y: targetPhysics.position.y,
                        life: 1500,
                        maxLife: 1500,
                        _seed: Date.now() + 11111
                    });
                }
            }
        }

        // 无论是否充满，热机都消失
        player.heatEngine = null;
    }

    processPlayerEffects(player) {
        if (!player.effects || player.effects.length === 0) return;

        // 效果过期规则：从使用的那一刻起，持续 N 个该玩家自己的回合
        // 例如 duration=1：在该玩家第 turnsPlayed=k 时使用，到第 turnsPlayed=k+1 的弃牌阶段就过期
        // 即从出牌到再到自己时算一轮，效果结束
        player.effects = player.effects.filter(effect => {
            const elapsed = player.turnsPlayed - effect.startTurn;
            if (elapsed >= effect.remainingTurns) {
                // 效果过期，执行清理
                if (effect.type === 'massChange' && player.originalMass) {
                    this.physics.setPlayerMass(player.id, player.originalMass);
                    player.originalMass = null;
                }
                if (effect.type === 'anchor') {
                    player.anchorPosition = null;
                    const physics = this.physics.getPlayer(player.id);
                    if (physics) {
                        physics._anchorPos = null;
                        Matter.Body.setStatic(physics, false);
                        physics.collisionFilter.mask = 0x0001;
                    }
                }
                return false;
            }
            return true;
        });
    }

    // 给两位玩家都发新牌（仅当大回合结束后的新回合）
    drawCardsForAllPlayers() {
        if (this.isNewRound) {
            for (let i = 0; i < this.players.length; i++) {
                const player = this.players[i];
                if (!player.eliminated) {
                    const newCards = this.cardSystem.draw(GAME_CONFIG.CARDS_PER_TURN);
                    player.cards.push(...newCards);
                }
            }
            this.isNewRound = false;
        }
    }

    // 检查玩家是否需要弃牌
    checkNeedDiscard(playerIndex) {
        const player = this.players[playerIndex];
        if (player && player.cards.length > GAME_CONFIG.MAX_HAND_SIZE) {
            return player.cards.length - GAME_CONFIG.MAX_HAND_SIZE;
        }
        return 0;
    }

    // 初始化弃牌状态
    startDiscardPhase(playerIndex, requiredCount, reason = 'phaseDiscard') {
        this.discardState = {
            active: true,
            playerIndex: playerIndex,
            requiredDiscards: requiredCount,
            selectedIndices: [],
            reason: reason
        };
    }

    // 切换选择要弃掉的牌
    toggleDiscardSelection(index) {
        const idx = this.discardState.selectedIndices.indexOf(index);
        if (idx > -1) {
            this.discardState.selectedIndices.splice(idx, 1);
        } else {
            this.discardState.selectedIndices.push(index);
        }
    }

    // 确认弃牌
    confirmDiscard() {
        if (this.discardState.selectedIndices.length !== this.discardState.requiredDiscards) {
            return false;
        }
        
        const player = this.players[this.discardState.playerIndex];
        // 从大到小排序索引，避免删除时索引错位
        const sortedIndices = [...this.discardState.selectedIndices].sort((a, b) => b - a);
        
        sortedIndices.forEach(index => {
            const discardedCard = player.cards.splice(index, 1)[0];
            this.cardSystem.discard(discardedCard);
        });
        
        this.discardState.active = false;
        return true;
    }

    checkGameOver() {
        this.players.forEach(player => {
            if (!player.eliminated && this.physics.checkBoundary(player.id)) {
                player.eliminated = true;
            }
        });
        const alive = this.players.filter(p => !p.eliminated);
        if (alive.length === 1) {
            this.state = GAME_STATES.GAME_OVER;
            return alive[0];
        }
        if (alive.length === 0) {
            this.state = GAME_STATES.GAME_OVER;
            return { id: 0 };
        }
        return null;
    }

    update(deltaTime) {
        if (this.state === GAME_STATES.PLAYING) {
            // 检查哪些玩家有定位锚效果
            const hasAnchor = [
                this.players[0].effects.some(e => e.type === 'anchor'),
                this.players[1].effects.some(e => e.type === 'anchor')
            ];

            // ========== 关键：物理更新前先把有定位锚的玩家完全锁住 ==========
            for (let i = 0; i < this.players.length; i++) {
                if (hasAnchor[i] && this.players[i].anchorPosition) {
                    const playerPhysics = this.physics.getPlayer(i + 1);
                    if (playerPhysics) {
                        Matter.Body.setPosition(playerPhysics, {
                            x: this.players[i].anchorPosition.x,
                            y: this.players[i].anchorPosition.y
                        });
                        Matter.Body.setVelocity(playerPhysics, { x: 0, y: 0 });
                        Matter.Body.setAngularVelocity(playerPhysics, 0);
                    }
                }
            }

            // ========== 告诉物理引擎哪些玩家有定位锚 ==========
            this.physics.anchoredPlayerIds = [];
            for (let i = 0; i < this.players.length; i++) {
                if (hasAnchor[i]) {
                    this.physics.anchoredPlayerIds.push(i + 1);
                }
            }

            // ========== 处理电荷之间的库仑力（只对无定位锚的玩家） ==========
            if (!this.players[0].eliminated && !this.players[1].eliminated) {
                const p1Physics = this.physics.getPlayer(1);
                const p2Physics = this.physics.getPlayer(2);
                const q1 = this.players[0].charge;
                const q2 = this.players[1].charge;

                if (q1 !== 0 && q2 !== 0) {
                    const dx = p2Physics.position.x - p1Physics.position.x;
                    const dy = p2Physics.position.y - p1Physics.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const MIN_DIST = 50; // 最小距离，防止近距离力爆炸

                    if (dist > MIN_DIST) {
                        const k = 5000;
                        // 用 MIN_DIST 限制最大力，防止近距离震荡
                        const effectiveDist = Math.max(dist, MIN_DIST);
                        let impulseMagnitude = k * q1 * q2 / (effectiveDist * effectiveDist) * 15;
                        // 限制最大力
                        const MAX_IMPULSE = 8;
                        impulseMagnitude = Math.max(-MAX_IMPULSE, Math.min(MAX_IMPULSE, impulseMagnitude));
                        const angle = Math.atan2(dy, dx);

                        // 只对没有定位锚的玩家施加冲量
                        if (!hasAnchor[0]) {
                            this.physics.applyImpulse(1, -Math.cos(angle) * impulseMagnitude, -Math.sin(angle) * impulseMagnitude);
                        }
                        if (!hasAnchor[1]) {
                            this.physics.applyImpulse(2, Math.cos(angle) * impulseMagnitude, Math.sin(angle) * impulseMagnitude);
                        }
                    }

                    // 异性电荷近距离阻尼：防止吸在一起后抖动
                    if (q1 * q2 < 0 && dist < 80) {
                        const dampFactor = 0.85;
                        Matter.Body.setVelocity(p1Physics, {
                            x: p1Physics.velocity.x * dampFactor,
                            y: p1Physics.velocity.y * dampFactor
                        });
                        Matter.Body.setVelocity(p2Physics, {
                            x: p2Physics.velocity.x * dampFactor,
                            y: p2Physics.velocity.y * dampFactor
                        });
                    }
                }
            }

            this.physics.update(deltaTime);

            // ========== 物理更新后再次强制把有定位锚的玩家按回去 ==========
            for (let i = 0; i < this.players.length; i++) {
                if (hasAnchor[i] && this.players[i].anchorPosition) {
                    const playerPhysics = this.physics.getPlayer(i + 1);
                    if (playerPhysics) {
                        Matter.Body.setPosition(playerPhysics, {
                            x: this.players[i].anchorPosition.x,
                            y: this.players[i].anchorPosition.y
                        });
                        Matter.Body.setVelocity(playerPhysics, { x: 0, y: 0 });
                        Matter.Body.setAngularVelocity(playerPhysics, 0);
                    }
                }
            }

            this.checkGameOver();
        }
    }

    render(gameState = null, aimingTarget = null, currentPlayerPhysics = null) {
        // 总是创建完整的 gameState，确保不会出错
        const completeGameState = {
            arenaRadius: this.physics.arenaRadius,
            players: this.physics.getAllPlayers(),
            effects: this.physics.effects,
            tempEffects: this.physics.tempEffects,
            shields: {
                1: this.players[0]?.shieldActive || false,
                2: this.players[1]?.shieldActive || false
            },
            playersData: this.players,
            quantumInvisible: {
                1: this.players[0]?.quantumState !== null,
                2: this.players[1]?.quantumState !== null
            }
        };
        this.renderer.render(completeGameState, aimingTarget, currentPlayerPhysics);
    }

    getState() {
        const physicsPlayers = this.physics.getAllPlayers().map(p => ({
            playerId: p.playerId,
            position: { x: p.position.x, y: p.position.y },
            velocity: { x: p.velocity.x, y: p.velocity.y },
            mass: p.mass
        }));
        
        return {
            state: this.state,
            turn: this.currentTurn,
            players: this.players,
            currentPlayerIndex: this.currentPlayerIndex,
            physicsPlayers,
            lastPlayedCard: this.lastPlayedCard,
            arenaRadius: this.physics.arenaRadius,
            effects: this.physics.effects,
            tempEffects: this.physics.tempEffects,
            shields: {
                1: this.players[0]?.shieldActive || false,
                2: this.players[1]?.shieldActive || false
            }
        };
    }

    restart() {
        this.physics.reset();
        this.physics.createPlayer(-160, 0, 1);
        this.physics.createPlayer(160, 0, 2);
        this.players = [
            { id: 1, energy: GAME_CONFIG.STARTING_ENERGY, cards: [], eliminated: false, shieldActive: false, effects: [], charge: 0, chargeDuration: 0, quantumState: null, heatEngine: null, turnsPlayed: 0 },
            { id: 2, energy: GAME_CONFIG.STARTING_ENERGY, cards: [], eliminated: false, shieldActive: false, effects: [], charge: 0, chargeDuration: 0, quantumState: null, heatEngine: null, turnsPlayed: 0 }
        ];
        this.currentTurn = 1;
        this.currentPlayerIndex = 0;
        this.turnPhase = 'discard';
        this.discardState = {
            active: false,
            playerIndex: 0,
            requiredDiscards: 0,
            selectedIndices: []
        };
        this.state = GAME_STATES.PLAYING;
        this.isNewRound = false;
        this.dealCards();
    }
}
