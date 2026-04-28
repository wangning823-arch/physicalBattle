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
            { id: 1, energy: GAME_CONFIG.STARTING_ENERGY, cards: [], eliminated: false, effects: [], quantumState: null, heatEngine: null },
            { id: 2, energy: GAME_CONFIG.STARTING_ENERGY, cards: [], eliminated: false, effects: [], quantumState: null, heatEngine: null }
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
        
        switch (card.id) {
            case 'momentum_blast':
                if (targetPhysics && aimTarget && selfPhysics) {
                    const dx = aimTarget.x - selfPhysics.position.x;
                    const dy = aimTarget.y - selfPhysics.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        const impulseX = (dx / dist) * card.effect.impulse;
                        const impulseY = (dy / dist) * card.effect.impulse;
                        this.physics.applyImpulse(targetId, impulseX, impulseY);
                        
                        // 添加动量冲击激光特效
                        this.physics.addTempEffect({
                            type: 'laser',
                            startX: selfPhysics.position.x,
                            startY: selfPhysics.position.y,
                            endX: targetPhysics.position.x,
                            endY: targetPhysics.position.y,
                            life: 500,
                            maxLife: 500
                        });
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
                        duration: card.effect.duration
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
                        duration: card.effect.duration
                    });
                }
                break;

            case 'vacuum_zone':
                if (aimTarget) {
                    this.physics.addEffect({
                        type: 'airFrictionZone',
                        x: aimTarget.x,
                        y: aimTarget.y,
                        radius: card.effect.radius,
                        airFriction: card.effect.airFriction,
                        duration: card.effect.duration
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
                        originalMass: originalMass
                    });
                }
                break;
            case 'explosive_charge':
                if (targetPhysics && aimTarget) {
                    const dx = aimTarget.x - selfPhysics.position.x;
                    const dy = aimTarget.y - selfPhysics.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        const impulseX = (dx / dist) * card.effect.impulse;
                        const impulseY = (dy / dist) * card.effect.impulse;
                        this.physics.applyImpulse(targetId, impulseX, impulseY);
                        
                        // 添加爆裂冲击特效（更大更持久）
                        this.physics.addTempEffect({
                            type: 'momentum_blast',
                            x: targetPhysics.position.x,
                            y: targetPhysics.position.y,
                            life: 700,
                            maxLife: 700
                        });
                    }
                }
                break;
            case 'anchor':
                if (selfPlayer) {
                    selfPlayer.effects.push({
                        type: 'anchor',
                        remainingTurns: card.effect.duration
                    });
                    if (selfPhysics) {
                        Matter.Body.setVelocity(selfPhysics, { x: 0, y: 0 });
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
                        duration: card.effect.duration
                    });
                }
                break;
            case 'charge_attach':
            case 'charge_attach_negative':
                // 给目标（敌人）累加电荷
                if (targetPlayer && !targetPlayer.eliminated) {
                    targetPlayer.charge += card.effect.charge;
                    targetPlayer.chargeDuration = card.effect.duration;
                }
                break;
            case 'self_charge':
            case 'self_charge_negative':
                // 给自己累加电荷
                selfPlayer.charge += card.effect.charge;
                selfPlayer.chargeDuration = card.effect.duration;
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
                            maxLife: 800
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
                        duration: card.effect.duration
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
                        maxLife: 500
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
                        maxLife: 1000
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
            // 弃牌阶段结束，进入该玩家的出牌阶段
            this.turnPhase = 'play';
        } else {
            // 出牌阶段结束，先检查是否是热机拥有者的回合结束
            const currentPlayer = this.players[this.currentPlayerIndex];
            if (currentPlayer.heatEngine && currentPlayer.heatEngine.active) {
                // 热机拥有者的回合结束了，减少剩余回合数
                currentPlayer.heatEngine.ownerTurnsRemaining--;
                currentPlayer.heatEngine.duration = currentPlayer.heatEngine.ownerTurnsRemaining;
                
                if (currentPlayer.heatEngine.ownerTurnsRemaining <= 0) {
                    // 热机持续时间结束，结算
                    this.settleHeatEngine(currentPlayer);
                }
            }
            
            if (this.currentPlayerIndex === 0) {
                // 玩家一出牌结束，轮到玩家二
                this.currentPlayerIndex = 1;
                this.turnPhase = 'discard';
                
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
                
                // 新回合更新效果
                this.physics.updateEffectsTurn();
                
                for (let i = 0; i < this.players.length; i++) {
                    const player = this.players[i];
                    if (!player.eliminated) {
                        player.energy = Math.min(
                            GAME_CONFIG.MAX_ENERGY,
                            player.energy + GAME_CONFIG.ENERGY_PER_TURN
                        );
                    }
                    this.processPlayerEffects(player);
                    
                    // 更新电荷持续时间
                    if (player.chargeDuration > 0) {
                        player.chargeDuration--;
                        if (player.chargeDuration <= 0) {
                            player.charge = 0; // 电荷消失
                        }
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
                maxLife: 800
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
        
        // 释放3倍动量冲击
        if (targetPhysics && selfPhysics) {
            const dx = targetPhysics.position.x - selfPhysics.position.x;
            const dy = targetPhysics.position.y - selfPhysics.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                const impulse = 180 * heatEngine.impulseMultiplier; // 3×动量冲击
                const impulseX = (dx / dist) * impulse;
                const impulseY = (dy / dist) * impulse;
                this.physics.applyImpulse(targetId, impulseX, impulseY);
                
                // 添加热机爆发特效 - 更壮观的特效！
                this.physics.addTempEffect({
                    type: 'heat_engine_blast',
                    x: targetPhysics.position.x,
                    y: targetPhysics.position.y,
                    life: 1500,
                    maxLife: 1500
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
        
        if (heatEngine.charge >= heatEngine.maxCharge) {
            // 充满能量，释放3倍动量冲击
            if (targetPhysics && selfPhysics) {
                const dx = targetPhysics.position.x - selfPhysics.position.x;
                const dy = targetPhysics.position.y - selfPhysics.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    const impulse = 180 * heatEngine.impulseMultiplier; // 3×动量冲击
                    const impulseX = (dx / dist) * impulse;
                    const impulseY = (dy / dist) * impulse;
                    this.physics.applyImpulse(targetId, impulseX, impulseY);
                    
                    // 添加热机爆发特效 - 更壮观的特效！
                    this.physics.addTempEffect({
                        type: 'heat_engine_blast',
                        x: targetPhysics.position.x,
                        y: targetPhysics.position.y,
                        life: 1500,
                        maxLife: 1500
                    });
                }
            }
        }
        
        // 无论是否充满，热机都消失
        player.heatEngine = null;
    }

    processPlayerEffects(player) {
        if (!player.effects || player.effects.length === 0) return;
        
        player.effects = player.effects.filter(effect => {
            effect.remainingTurns--;
            if (effect.remainingTurns <= 0) {
                if (effect.type === 'massChange' && player.originalMass) {
                    this.physics.setPlayerMass(player.id, player.originalMass);
                    player.originalMass = null;
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
            // 处理电荷之间的库仑力
            if (!this.players[0].eliminated && !this.players[1].eliminated) {
                const p1Physics = this.physics.getPlayer(1);
                const p2Physics = this.physics.getPlayer(2);
                const q1 = this.players[0].charge;
                const q2 = this.players[1].charge;
                
                if (q1 !== 0 && q2 !== 0) {
                    const dx = p2Physics.position.x - p1Physics.position.x;
                    const dy = p2Physics.position.y - p1Physics.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 20) {
                        const k = 5000;
                        const impulseMagnitude = k * q1 * q2 / (dist * dist) * 15; // 减小系数以适应累加电荷
                        const angle = Math.atan2(dy, dx);
                        
                        console.log(`库仑力生效: q1=${q1}, q2=${q2}, dist=${dist.toFixed(2)}, impulse=${impulseMagnitude.toFixed(4)}`);
                        
                        this.physics.applyImpulse(1, -Math.cos(angle) * impulseMagnitude, -Math.sin(angle) * impulseMagnitude);
                        this.physics.applyImpulse(2, Math.cos(angle) * impulseMagnitude, Math.sin(angle) * impulseMagnitude);
                    }
                }
            }
            
            this.physics.update(deltaTime);
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
            { id: 1, energy: GAME_CONFIG.STARTING_ENERGY, cards: [], eliminated: false, shieldActive: false, effects: [], charge: 0, chargeDuration: 0, quantumState: null, heatEngine: null },
            { id: 2, energy: GAME_CONFIG.STARTING_ENERGY, cards: [], eliminated: false, shieldActive: false, effects: [], charge: 0, chargeDuration: 0, quantumState: null, heatEngine: null }
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
