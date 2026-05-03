class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.physics = new PhysicsEngine();
        this.cardSystem = new CardSystem();
        this.state = GAME_STATES.WAITING;
        this.currentTurn = 1;
        this.currentPlayerIndex = 0;
        this.players = [];
        this.playerCount = 2;
        this.selectedCard = null;
        this.aimingState = { active: false, card: null, cardIndex: -1, playerId: 0 };
        this.targetingState = { active: false, card: null, cardIndex: -1, playerId: 0 };
        this.turnPhase = 'discard'; // discard, play
        this.lastPlayedCard = null;
        this.discardState = {
            active: false,
            playerIndex: 0,
            requiredDiscards: 0,
            selectedIndices: []
        };
        this.isNewRound = false;
        this.gameMode = 'pvp';
        this.aiPlayer = null;
    }

    initGame(mode = 'pvp') {
        this.gameMode = mode;
        this.playerCount = mode === '3pvp' ? 3 : 2;

        if (mode === 'pve') {
            this.aiPlayer = new AIPlayer(this);
        } else {
            this.aiPlayer = null;
        }

        this.physics.reset();
        if (this.playerCount === 3) {
            const r = 140;
            this.physics.createPlayer(0, -r, 1);
            this.physics.createPlayer(Math.round(r * Math.cos(Math.PI / 6)), Math.round(r * Math.sin(Math.PI / 6)), 2);
            this.physics.createPlayer(Math.round(r * Math.cos(5 * Math.PI / 6)), Math.round(r * Math.sin(5 * Math.PI / 6)), 3);
        } else {
            this.physics.createPlayer(-160, 0, 1);
            this.physics.createPlayer(160, 0, 2);
        }

        this.players = [];
        for (let i = 1; i <= this.playerCount; i++) {
            this.players.push({
                id: i, energy: GAME_CONFIG.STARTING_ENERGY, cards: [],
                eliminated: false, effects: [], quantumState: null, heatEngine: null,
                turnsPlayed: 0, charge: 0, chargeDuration: 0
            });
        }

        this.selectedCard = null;
        this.aimingState = { active: false, card: null, cardIndex: -1, playerId: 0 };
        this.targetingState = { active: false, card: null, cardIndex: -1, playerId: 0 };
        this.turnPhase = 'discard';
        this.lastPlayedCard = null;
        this.discardState = { active: false, playerIndex: 0, requiredDiscards: 0, selectedIndices: [] };
        this.isNewRound = false;
        this.state = GAME_STATES.PLAYING;
        this.currentTurn = 1;
        this.currentPlayerIndex = 0;
        this.dealCards();
    }

    isAITurn() {
        return this.gameMode === 'pve' && this.currentPlayerIndex === 1 && this.aiPlayer;
    }

    dealCards() {
        console.log('Dealing cards...');
        this.players.forEach((player, index) => {
            const drawn = this.cardSystem.draw(GAME_CONFIG.CARDS_PER_TURN);
            player.cards = drawn.sort((a, b) => a.cost - b.cost);
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

        // 3人模式：需要选择目标玩家的卡牌
        const needsTarget = (card.effect.targetEnemy || card.id === 'rigid_connection' || card.id === 'soft_rope');
        if (needsTarget && this.playerCount > 2) {
            const opponents = this.players.filter(p => p.id !== playerId && !p.eliminated);
            if (opponents.length > 1) {
                this.targetingState = { active: true, card, cardIndex, playerId };
                return 'targeting';
            }
        }

        player.energy -= card.cost;
        this.lastPlayedCard = card;
        this.executeCard(card, playerId, null, null);
        player.cards.splice(cardIndex, 1);

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

        // 电磁炮：无电荷时不能使用
        if (card.id === 'electromagnetic_cannon' && (!player.charge || player.charge === 0)) {
            return false;
        }

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

    confirmTarget(targetPlayerId) {
        if (!this.targetingState.active) return false;
        const { card, cardIndex, playerId } = this.targetingState;
        const player = this.players.find(p => p.id === playerId);
        if (!player) return false;

        const target = this.players.find(p => p.id === targetPlayerId);
        if (!target || target.eliminated || target.id === playerId) return false;

        player.energy -= card.cost;
        this.lastPlayedCard = card;
        this.executeCard(card, playerId, null, targetPlayerId);
        player.cards.splice(cardIndex, 1);

        this.targetingState = { active: false, card: null, cardIndex: -1, playerId: 0 };
        return true;
    }

    cancelTarget() {
        this.targetingState = { active: false, card: null, cardIndex: -1, playerId: 0 };
    }

    executeCard(card, playerId, aimTarget, targetPlayerId = null) {
        const selfPlayer = this.players.find(p => p.id === playerId);
        const selfPhysics = this.physics.getPlayer(playerId);

        // 确定目标玩家
        let targetPlayer = null;
        let targetPhysics = null;
        if (targetPlayerId) {
            targetPlayer = this.players.find(p => p.id === targetPlayerId);
            targetPhysics = this.physics.getPlayer(targetPlayerId);
        } else if (this.playerCount === 2) {
            const tid = playerId === 1 ? 2 : 1;
            targetPlayer = this.players.find(p => p.id === tid);
            targetPhysics = this.physics.getPlayer(tid);
        }
        
        // 热机充能功能：使用卡牌时（非热机本身）自动充能
        if (card.id !== 'heat_engine' && selfPlayer.heatEngine && selfPlayer.heatEngine.active) {
            selfPlayer.heatEngine.charge = Math.min(selfPlayer.heatEngine.maxCharge, selfPlayer.heatEngine.charge + 1);
        }
        
        // 如果目标处于量子叠加态，卡牌无效
        if (targetPlayer && targetPlayer.quantumState !== null &&
            (card.effect.targetEnemy || ['charge_attach', 'charge_attach_negative'].includes(card.id))) {
            return;
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
                if (aimTarget && selfPhysics) {
                    const lx = aimTarget.x - selfPhysics.position.x;
                    const ly = aimTarget.y - selfPhysics.position.y;
                    const lLenSq = lx * lx + ly * ly;
                    const HIT_RADIUS = 30;

                    for (let i = 0; i < this.players.length; i++) {
                        const opp = this.players[i];
                        if (opp.id === playerId || opp.eliminated) continue;
                        if (opp.quantumState !== null) continue;
                        const oppPhysics = this.physics.getPlayer(opp.id);
                        if (!oppPhysics) continue;
                        if (opp.effects.some(e => e.type === 'anchor')) continue;

                        let t = 0;
                        if (lLenSq > 0) {
                            t = Math.max(0, Math.min(1,
                                ((oppPhysics.position.x - selfPhysics.position.x) * lx +
                                 (oppPhysics.position.y - selfPhysics.position.y) * ly) / lLenSq
                            ));
                        }
                        const closestX = selfPhysics.position.x + t * lx;
                        const closestY = selfPhysics.position.y + t * ly;
                        const hitDist = Math.sqrt(
                            (oppPhysics.position.x - closestX) ** 2 +
                            (oppPhysics.position.y - closestY) ** 2
                        );

                        if (hitDist <= HIT_RADIUS) {
                            const dx = oppPhysics.position.x - selfPhysics.position.x;
                            const dy = oppPhysics.position.y - selfPhysics.position.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > 0) {
                                this.physics.applyImpulse(opp.id, (dx / dist) * card.effect.impulse, (dy / dist) * card.effect.impulse);
                            }
                            this.physics.addTempEffect({
                                type: 'laser',
                                startX: selfPhysics.position.x,
                                startY: selfPhysics.position.y,
                                endX: closestX,
                                endY: closestY,
                                life: 500,
                                maxLife: 500,
                                _seed: Date.now() + opp.id * 1000
                            });
                        }
                    }
                    const aimLen = Math.sqrt(lx * lx + ly * ly);
                    if (aimLen > 0) {
                        this.applyRecoil(playerId, (lx / aimLen) * card.effect.impulse, (ly / aimLen) * card.effect.impulse);
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
                        expiryRound: this.currentTurn + card.effect.duration,
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
                        expiryRound: this.currentTurn + card.effect.duration,
                        _seed: Date.now() + 2222
                    });
                }
                break;

            case 'mass_increase':
            case 'mass_decrease':
                if (selfPlayer && selfPhysics) {
                    const currentMass = this.physics.getPlayer(playerId)?.mass || PLAYER_CONFIG.MASS;
                    if (!selfPlayer.originalMass) selfPlayer.originalMass = PLAYER_CONFIG.MASS;
                    // 基于当前质量计算，可叠加
                    const newMass = currentMass * card.effect.multiplier;
                    this.physics.setPlayerMass(playerId, newMass);
                    selfPlayer.effects.push({
                        type: 'massChange',
                        multiplier: card.effect.multiplier,
                        expiryRound: this.currentTurn + card.effect.duration,
                        currentMass: newMass
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
                if (aimTarget && selfPhysics) {
                    const lx = aimTarget.x - selfPhysics.position.x;
                    const ly = aimTarget.y - selfPhysics.position.y;
                    const lLenSq = lx * lx + ly * ly;
                    const HIT_RADIUS = 30;

                    for (let i = 0; i < this.players.length; i++) {
                        const opp = this.players[i];
                        if (opp.id === playerId || opp.eliminated) continue;
                        if (opp.quantumState !== null) continue;
                        const oppPhysics = this.physics.getPlayer(opp.id);
                        if (!oppPhysics) continue;
                        if (opp.effects.some(e => e.type === 'anchor')) continue;

                        let t = 0;
                        if (lLenSq > 0) {
                            t = Math.max(0, Math.min(1,
                                ((oppPhysics.position.x - selfPhysics.position.x) * lx +
                                 (oppPhysics.position.y - selfPhysics.position.y) * ly) / lLenSq
                            ));
                        }
                        const closestX = selfPhysics.position.x + t * lx;
                        const closestY = selfPhysics.position.y + t * ly;
                        const hitDist = Math.sqrt(
                            (oppPhysics.position.x - closestX) ** 2 +
                            (oppPhysics.position.y - closestY) ** 2
                        );

                        if (hitDist <= HIT_RADIUS) {
                            const dx = oppPhysics.position.x - selfPhysics.position.x;
                            const dy = oppPhysics.position.y - selfPhysics.position.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > 0) {
                                this.physics.applyImpulse(opp.id, (dx / dist) * card.effect.impulse, (dy / dist) * card.effect.impulse);
                            }
                            this.physics.addTempEffect({
                                type: 'momentum_blast',
                                x: closestX,
                                y: closestY,
                                life: 700,
                                maxLife: 700,
                                _seed: Date.now() + opp.id * 2000
                            });
                        }
                    }
                    const aimLen = Math.sqrt(lx * lx + ly * ly);
                    if (aimLen > 0) {
                        this.applyRecoil(playerId, (lx / aimLen) * card.effect.impulse, (ly / aimLen) * card.effect.impulse);
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
                        expiryRound: this.currentTurn + card.effect.duration
                    });
                    // 立即告诉物理引擎这个玩家有定位锚了
                    if (this.physics.anchoredPlayerIds.indexOf(playerId) === -1) {
                        this.physics.anchoredPlayerIds.push(playerId);
                    }
                }
                break;
            case 'rigid_connection':
                if (selfPlayer) {
                    const rigidTargetId = targetPlayerId || (playerId === 1 ? 2 : 1);
                    this.physics.createRigidConnection(card.effect.duration, playerId, rigidTargetId, this.currentTurn);
                }
                break;
            case 'soft_rope':
                if (selfPlayer) {
                    const ropeTargetId = targetPlayerId || (playerId === 1 ? 2 : 1);
                    this.physics.createSoftRope(card.effect.duration, playerId, ropeTargetId, this.currentTurn);
                }
                break;
            case 'damping_field':
                if (aimTarget) {
                    this.physics.addEffect({
                        type: 'dampingField',
                        x: aimTarget.x,
                        y: aimTarget.y,
                        radius: card.effect.radius,
                        expiryRound: this.currentTurn + card.effect.duration,
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
                        expiryRound: this.currentTurn + card.effect.duration,
                        _seed: Date.now() + 6666
                    });
                }
                break;
            case 'heat_engine':
                // 激活热机
                selfPlayer.heatEngine = {
                    active: true,
                    charge: 0,
                    maxCharge: 6,
                    duration: 3, // 3个回合有效期：使用回合 + 2个完整回合
                    ownerTurnsRemaining: 3, // 明确跟踪属于热机拥有者的剩余回合数
                    ownerId: playerId,
                    impulseMultiplier: 1 // 现在倍数等于充能点数
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
            case 'momentum_conservation':
                // 动量守恒：2回合内使用冲量卡时自身获得反冲
                selfPlayer.momentumConservation = {
                    active: true,
                    duration: card.effect.duration
                };
                this.physics.addTempEffect({
                    type: 'charge_apply',
                    x: selfPhysics.position.x,
                    y: selfPhysics.position.y,
                    charge: 0,
                    life: 400,
                    maxLife: 400,
                    _seed: Date.now() + 7777
                });
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
                        expiryRound: this.currentTurn + card.effect.duration,
                        originalMass: originalMass
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
                console.log('当前 physics.effects:', this.physics.effects.map(e => ({ type: e.type, expiryRound: e.expiryRound })));
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
                console.log('使用量子叠加后 physics.effects:', this.physics.effects.map(e => ({ type: e.type, expiryRound: e.expiryRound })));
                break;
            case 'radiation':
                // 辐射：烧毁对方价值最高的一张牌
                if (targetPlayer && targetPlayer.cards.length > 0) {
                    // 价值评估：cost * 10 + rarity权重(common=1, rare=2, epic=3)
                    const rarityWeight = { common: 1, rare: 2, epic: 3 };
                    let bestIndex = 0;
                    let bestValue = -1;
                    targetPlayer.cards.forEach((c, i) => {
                        const val = c.cost * 10 + (rarityWeight[c.rarity] || 1);
                        if (val > bestValue) {
                            bestValue = val;
                            bestIndex = i;
                        }
                    });
                    const burnedCard = targetPlayer.cards.splice(bestIndex, 1)[0];
                    this.cardSystem.discard(burnedCard);
                    // 辐射特效
                    if (targetPhysics) {
                        this.physics.addTempEffect({
                            type: 'radiation',
                            x: targetPhysics.position.x,
                            y: targetPhysics.position.y,
                            burnedCardName: burnedCard.name,
                            life: 1000,
                            maxLife: 1000,
                            _seed: Date.now() + 12345
                        });
                    }
                }
                break;
            case 'brownian_motion':
                // 布朗运动：随机方向移动
                if (selfPhysics) {
                    const angle = Math.random() * Math.PI * 2;
                    const impulseX = Math.cos(angle) * card.effect.impulse;
                    const impulseY = Math.sin(angle) * card.effect.impulse;
                    this.physics.applyImpulse(playerId, impulseX, impulseY);
                    // 冲刺残影特效
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
                break;
            case 'electromagnetic_cannon':
                // 电磁炮：自身必须带电才能使用
                if (selfPlayer.charge && selfPlayer.charge !== 0 && selfPhysics && aimTarget) {
                    const charge = selfPlayer.charge;
                    const speed = Math.abs(charge) * card.effect.speedPerCharge;
                    const projectileMass = selfPhysics.mass * card.effect.massRatio;

                    // 计算方向（从自身指向瞄准点）
                    const dx = aimTarget.x - selfPhysics.position.x;
                    const dy = aimTarget.y - selfPhysics.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 0) {
                        // 创建炮弹物理体
                        const projectile = Matter.Bodies.circle(
                            selfPhysics.position.x, selfPhysics.position.y,
                            6,
                            {
                                mass: projectileMass,
                                frictionAir: 0,
                                friction: 0,
                                restitution: 0.5,
                                collisionFilter: {
                                    category: 0x0004,
                                    mask: 0x0001
                                },
                                label: 'projectile'
                            }
                        );

                        // 设置初始速度
                        const vx = (dx / dist) * speed;
                        const vy = (dy / dist) * speed;
                        Matter.Body.setVelocity(projectile, { x: vx, y: vy });

                        // 电磁炮反冲：发射瞬间获得反方向冲量
                        const recoilImpulse = projectileMass * speed;
                        this.applyRecoil(playerId, (dx / dist) * recoilImpulse, (dy / dist) * recoilImpulse);

                        // 添加到世界
                        Matter.Composite.add(this.physics.engine.world, projectile);

                        // 存储炮弹信息
                        this.physics.projectiles.push({
                            body: projectile,
                            charge: charge,
                            ownerId: playerId,
                            life: 120,
                            maxLife: 120,
                            baseImpulse: card.effect.baseImpulse
                        });

                        // 发射特效
                        this.physics.addTempEffect({
                            type: 'charge_apply',
                            x: selfPhysics.position.x,
                            y: selfPhysics.position.y,
                            charge: charge,
                            life: 300,
                            maxLife: 300,
                            _seed: Date.now() + 11111
                        });
                    }
                }
                break;
            case 'magnetic_field':
                // 磁场：全场产生磁场，带电玩家受到洛伦兹力偏转
                this.physics.addEffect({
                    type: 'magneticField',
                    strength: card.effect.strength,
                    expiryRound: this.currentTurn + card.effect.duration,
                    _seed: Date.now() + 13333
                });
                break;
        }
        this.cardSystem.discard(card);
        this.checkGameOver();
    }

    // 核心流程：按玩家顺序轮流弃牌→出牌
    advanceGamePhase() {
        if (this.turnPhase === 'discard') {
            const currentPlayer = this.players[this.currentPlayerIndex];
            currentPlayer.turnsPlayed++;
            this.processPlayerEffects(currentPlayer);
            if (currentPlayer.chargeDuration > 0) {
                currentPlayer.chargeDuration--;
                if (currentPlayer.chargeDuration <= 0) {
                    currentPlayer.charge = 0;
                    currentPlayer.chargeDuration = 0;
                }
            }
            if (currentPlayer.momentumConservation && currentPlayer.momentumConservation.active) {
                currentPlayer.momentumConservation.duration--;
                if (currentPlayer.momentumConservation.duration <= 0) {
                    currentPlayer.momentumConservation = null;
                }
            }
            this.turnPhase = 'play';
        } else {
            const currentPlayer = this.players[this.currentPlayerIndex];

            if (currentPlayer.heatEngine && currentPlayer.heatEngine.active) {
                currentPlayer.heatEngine.ownerTurnsRemaining--;
                currentPlayer.heatEngine.duration = currentPlayer.heatEngine.ownerTurnsRemaining;
                if (currentPlayer.heatEngine.ownerTurnsRemaining <= 0) {
                    this.settleHeatEngine(currentPlayer);
                }
            }

            // 找下一个存活的玩家
            let nextIndex = this.currentPlayerIndex + 1;
            while (nextIndex < this.players.length && this.players[nextIndex].eliminated) {
                nextIndex++;
            }

            if (nextIndex < this.players.length) {
                this.currentPlayerIndex = nextIndex;
                this.turnPhase = 'discard';

                const nextPlayer = this.players[this.currentPlayerIndex];
                if (nextPlayer && !nextPlayer.eliminated && nextPlayer.quantumState === 'superposition') {
                    this.collapseQuantumState(nextPlayer);
                }
            } else {
                // 所有玩家都出完，新回合
                this.currentPlayerIndex = 0;
                while (this.currentPlayerIndex < this.players.length && this.players[this.currentPlayerIndex].eliminated) {
                    this.currentPlayerIndex++;
                }
                this.currentTurn++;
                this.isNewRound = true;
                this.turnPhase = 'discard';

                const firstPlayer = this.players[this.currentPlayerIndex];
                if (firstPlayer && !firstPlayer.eliminated && firstPlayer.quantumState === 'superposition') {
                    this.collapseQuantumState(firstPlayer);
                }

                this.physics.updateEffectsTurn(this.currentTurn);
                for (let i = 0; i < this.players.length; i++) {
                    const player = this.players[i];
                    if (!player.eliminated) {
                        player.energy = Math.min(GAME_CONFIG.MAX_ENERGY, player.energy + GAME_CONFIG.ENERGY_PER_TURN);
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

    // 动量守恒反冲：施加反方向等大小冲量
    applyRecoil(playerId, impulseX, impulseY) {
        const player = this.players.find(p => p.id === playerId);
        if (player && player.momentumConservation && player.momentumConservation.active) {
            this.physics.applyImpulse(playerId, -impulseX, -impulseY);
        }
    }

    // 手动发射热机
    // 找到最近的活着的对手
    findClosestOpponent(playerId) {
        const selfPhysics = this.physics.getPlayer(playerId);
        if (!selfPhysics) return null;
        let closest = null;
        let minDist = Infinity;
        for (const p of this.players) {
            if (p.id === playerId || p.eliminated) continue;
            const op = this.physics.getPlayer(p.id);
            if (!op) continue;
            const dx = op.position.x - selfPhysics.position.x;
            const dy = op.position.y - selfPhysics.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                closest = p;
            }
        }
        return closest;
    }

    fireHeatEngine(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.heatEngine || !player.heatEngine.active) return false;
        // 只要有充能就可以发射
        if (player.heatEngine.charge <= 0) return false;

        const heatEngine = player.heatEngine;
        const selfPhysics = this.physics.getPlayer(player.id);
        const targetPlayer = this.findClosestOpponent(player.id);
        if (!targetPlayer) return false;
        const targetId = targetPlayer.id;
        const targetPhysics = this.physics.getPlayer(targetId);

        // 检查目标是否有定位锚效果
        const hasAnchor = targetPlayer && targetPlayer.effects.some(e => e.type === 'anchor');

        // 释放充能点数倍的动量冲击（只对无定位锚的目标）
        if (targetPhysics && selfPhysics && !hasAnchor) {
            const dx = targetPhysics.position.x - selfPhysics.position.x;
            const dy = targetPhysics.position.y - selfPhysics.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                const impulse = 200 * heatEngine.charge; // 充能点数 × 基础动量
                const impulseX = (dx / dist) * impulse;
                const impulseY = (dy / dist) * impulse;
                this.physics.applyImpulse(targetId, impulseX, impulseY);
                this.applyRecoil(player.id, impulseX, impulseY);

                // 添加热机爆发特效
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

    // 热机结算（超时自动释放）
    settleHeatEngine(player) {
        const heatEngine = player.heatEngine;
        if (!heatEngine) return;

        const selfPhysics = this.physics.getPlayer(player.id);
        const targetPlayer = this.findClosestOpponent(player.id);
        if (!targetPlayer) { player.heatEngine = null; return; }
        const targetId = targetPlayer.id;
        const targetPhysics = this.physics.getPlayer(targetId);

        // 检查目标是否有定位锚效果
        const hasAnchor = targetPlayer && targetPlayer.effects.some(e => e.type === 'anchor');

        // 只要有充能就释放
        if (heatEngine.charge > 0) {
            // 释放充能点数倍的动量冲击（只对无定位锚的目标）
            if (targetPhysics && selfPhysics && !hasAnchor) {
                const dx = targetPhysics.position.x - selfPhysics.position.x;
                const dy = targetPhysics.position.y - selfPhysics.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    const impulse = 200 * heatEngine.charge; // 充能点数 × 基础动量
                    const impulseX = (dx / dist) * impulse;
                    const impulseY = (dy / dist) * impulse;
                    this.physics.applyImpulse(targetId, impulseX, impulseY);
                    this.applyRecoil(player.id, impulseX, impulseY);

                    // 添加热机爆发特效
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

        // 热机消失
        player.heatEngine = null;
    }

    processPlayerEffects(player) {
        if (!player.effects || player.effects.length === 0) return;

        // 使用绝对回合数判断效果是否过期
        player.effects = player.effects.filter(effect => {
            if (effect.expiryRound !== undefined && this.currentTurn >= effect.expiryRound) {
                // 效果过期，执行清理
                if (effect.type === 'anchor') {
                    player.anchorPosition = null;
                    const physics = this.physics.getPlayer(player.id);
                    if (physics) {
                        physics._anchorPos = null;
                        Matter.Body.setStatic(physics, false);
                        physics.collisionFilter.mask = 0x0005;
                    }
                }
                return false;
            }
            return true;
        });

        // 检查是否还有质量变化效果，没有则恢复原始质量
        const hasMassEffect = player.effects.some(e => e.type === 'massChange');
        if (!hasMassEffect && player.originalMass) {
            this.physics.setPlayerMass(player.id, player.originalMass);
            player.originalMass = null;
        }
    }

    // 给两位玩家都发新牌（仅当大回合结束后的新回合）
    drawCardsForAllPlayers() {
        if (this.isNewRound) {
            for (let i = 0; i < this.players.length; i++) {
                const player = this.players[i];
                if (!player.eliminated) {
                    const newCards = this.cardSystem.draw(GAME_CONFIG.CARDS_PER_TURN);
                    player.cards.push(...newCards);
                    player.cards.sort((a, b) => a.cost - b.cost);
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
            const hasAnchor = this.players.map(p => p.effects.some(e => e.type === 'anchor'));

            for (let i = 0; i < this.players.length; i++) {
                if (hasAnchor[i] && this.players[i].anchorPosition) {
                    const pp = this.physics.getPlayer(this.players[i].id);
                    if (pp) {
                        Matter.Body.setPosition(pp, { x: this.players[i].anchorPosition.x, y: this.players[i].anchorPosition.y });
                        Matter.Body.setVelocity(pp, { x: 0, y: 0 });
                        Matter.Body.setAngularVelocity(pp, 0);
                    }
                }
            }

            this.physics.anchoredPlayerIds = [];
            for (let i = 0; i < this.players.length; i++) {
                if (hasAnchor[i]) {
                    this.physics.anchoredPlayerIds.push(this.players[i].id);
                }
            }

            // ========== 库仑力：两两计算 ==========
            const MIN_DIST = 50;
            const k = 5000;
            const MAX_IMPULSE = 8;
            for (let i = 0; i < this.players.length; i++) {
                for (let j = i + 1; j < this.players.length; j++) {
                    const pi = this.players[i];
                    const pj = this.players[j];
                    if (pi.eliminated || pj.eliminated) continue;
                    const qi = pi.charge;
                    const qj = pj.charge;
                    if (qi === 0 || qj === 0) continue;

                    const piPhysics = this.physics.getPlayer(pi.id);
                    const pjPhysics = this.physics.getPlayer(pj.id);
                    if (!piPhysics || !pjPhysics) continue;

                    const dx = pjPhysics.position.x - piPhysics.position.x;
                    const dy = pjPhysics.position.y - piPhysics.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > MIN_DIST) {
                        const effectiveDist = Math.max(dist, MIN_DIST);
                        let impulseMag = k * qi * qj / (effectiveDist * effectiveDist) * 15;
                        impulseMag = Math.max(-MAX_IMPULSE, Math.min(MAX_IMPULSE, impulseMag));
                        const angle = Math.atan2(dy, dx);

                        if (!hasAnchor[i] && !pi.quantumState) {
                            this.physics.applyImpulse(pi.id, -Math.cos(angle) * impulseMag, -Math.sin(angle) * impulseMag);
                        }
                        if (!hasAnchor[j] && !pj.quantumState) {
                            this.physics.applyImpulse(pj.id, Math.cos(angle) * impulseMag, Math.sin(angle) * impulseMag);
                        }
                    }

                    if (qi * qj < 0 && dist < 80) {
                        const dampFactor = 0.85;
                        if (!pi.quantumState) {
                            Matter.Body.setVelocity(piPhysics, { x: piPhysics.velocity.x * dampFactor, y: piPhysics.velocity.y * dampFactor });
                        }
                        if (!pj.quantumState) {
                            Matter.Body.setVelocity(pjPhysics, { x: pjPhysics.velocity.x * dampFactor, y: pjPhysics.velocity.y * dampFactor });
                        }
                    }
                }
            }

            // ========== 洛伦兹力 ==========
            const magneticField = this.physics.effects.find(e => e.type === 'magneticField');
            if (magneticField) {
                for (let i = 0; i < this.players.length; i++) {
                    const player = this.players[i];
                    const physics = this.physics.getPlayer(player.id);
                    if (!physics || player.eliminated || !player.charge || player.charge === 0) continue;
                    if (hasAnchor[i]) continue;
                    if (player.quantumState) continue;
                    const vx = physics.velocity.x;
                    const vy = physics.velocity.y;
                    if (Math.sqrt(vx * vx + vy * vy) < 0.01) continue;
                    const B = magneticField.strength;
                    const q = player.charge;
                    Matter.Body.applyForce(physics, physics.position, { x: q * vy * B, y: -q * vx * B });
                }
            }

            this.physics.update(deltaTime);

            for (let i = 0; i < this.players.length; i++) {
                if (hasAnchor[i] && this.players[i].anchorPosition) {
                    const pp = this.physics.getPlayer(this.players[i].id);
                    if (pp) {
                        Matter.Body.setPosition(pp, { x: this.players[i].anchorPosition.x, y: this.players[i].anchorPosition.y });
                        Matter.Body.setVelocity(pp, { x: 0, y: 0 });
                        Matter.Body.setAngularVelocity(pp, 0);
                    }
                }
            }

            this.checkGameOver();
        }
    }

    render(gameState = null, aimingTarget = null, currentPlayerPhysics = null) {
        const shields = {};
        const quantumInvisible = {};
        this.players.forEach(p => {
            shields[p.id] = p.shieldActive || false;
            quantumInvisible[p.id] = p.quantumState !== null;
        });

        const completeGameState = {
            arenaRadius: this.physics.arenaRadius,
            players: this.physics.getAllPlayers(),
            effects: this.physics.effects,
            tempEffects: this.physics.tempEffects,
            shields,
            playersData: this.players,
            quantumInvisible,
            projectiles: this.physics.projectiles,
            targetingActive: this.targetingState.active,
            currentPlayerId: this.players[this.currentPlayerIndex]?.id
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
        const shields = {};
        this.players.forEach(p => { shields[p.id] = p.shieldActive || false; });

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
            shields,
            projectiles: this.physics.projectiles
        };
    }

    restart() {
        const savedMode = this.gameMode;
        const savedPlayerCount = this.playerCount;
        this.physics.reset();

        if (savedPlayerCount === 3) {
            const r = 140;
            this.physics.createPlayer(0, -r, 1);
            this.physics.createPlayer(Math.round(r * Math.cos(Math.PI / 6)), Math.round(r * Math.sin(Math.PI / 6)), 2);
            this.physics.createPlayer(Math.round(r * Math.cos(5 * Math.PI / 6)), Math.round(r * Math.sin(5 * Math.PI / 6)), 3);
        } else {
            this.physics.createPlayer(-160, 0, 1);
            this.physics.createPlayer(160, 0, 2);
        }

        this.players = [];
        for (let i = 1; i <= savedPlayerCount; i++) {
            this.players.push({
                id: i, energy: GAME_CONFIG.STARTING_ENERGY, cards: [],
                eliminated: false, shieldActive: false, effects: [],
                charge: 0, chargeDuration: 0, quantumState: null,
                heatEngine: null, turnsPlayed: 0
            });
        }

        this.currentTurn = 1;
        this.currentPlayerIndex = 0;
        this.turnPhase = 'discard';
        this.discardState = { active: false, playerIndex: 0, requiredDiscards: 0, selectedIndices: [] };
        this.aimingState = { active: false, card: null, cardIndex: -1, playerId: 0 };
        this.targetingState = { active: false, card: null, cardIndex: -1, playerId: 0 };
        this.state = GAME_STATES.PLAYING;
        this.isNewRound = false;
        this.gameMode = savedMode;
        this.playerCount = savedPlayerCount;
        if (savedMode === 'pve') {
            this.aiPlayer = new AIPlayer(this);
        } else {
            this.aiPlayer = null;
        }
        this.dealCards();
    }
}
