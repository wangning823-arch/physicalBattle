class PhysicsEngine {
    constructor() {
        this.engine = Matter.Engine.create({
            gravity: { x: 0, y: 0 }
        });
        this.world = this.engine.world;
        this.arenaRadius = GAME_CONFIG.ARENA_RADIUS;
        this.walls = [];
        this.players = [];
        this.effects = [];
        this.tempEffects = []; // 临时特效（短时间，如攻击特效）
        this.rigidConstraint = null; // 保存刚性约束
        this.softRopeConstraint = null; // 保存软绳约束
        this.softRopeOriginalLength = 0; // 软绳原长
        this.isSoftRopeLocked = false; // 软绳是否已锁定
        this.anchoredPlayerIds = []; // 有定位锚的玩家ID列表
        this.createArena();
    }

    // 检查玩家是否有定位锚
    isPlayerAnchored(playerId) {
        return this.anchoredPlayerIds.indexOf(playerId) !== -1;
    }

    /**
     * 更新效果的剩余回合数（每回合调用一次）
     */
    updateEffectsTurn() {
        console.log('=== updateEffectsTurn 被调用 ===');
        console.log('当前 effects:', this.effects.map(e => ({ type: e.type, duration: e.duration })));
        
        // 处理普通效果，但要保留约束效果，只减少它们的duration
        this.effects = this.effects.filter(effect => {
            // 如果是约束效果，只减少 duration，不过滤
            if (effect.type === 'rigid_constraint' || effect.type === 'soft_rope') {
                if (effect.duration > 0) {
                    effect.duration--;
                    console.log(`约束 ${effect.type} duration 减到 ${effect.duration}`);
                    if (effect.duration <= 0) {
                        console.log(`约束 ${effect.type} 结束了`);
                        return false;
                    }
                }
                return true;
            }
            
            // 处理普通效果
            if (effect.duration > 0) {
                effect.duration--;
                if (effect.duration <= 0) {
                    // 效果结束，恢复玩家属性
                    this.players.forEach(player => {
                        player.friction = PLAYER_CONFIG.FRICTION;
                        player.frictionAir = PLAYER_CONFIG.AIR_FRICTION;
                    });
                    return false;
                }
            }
            return true;
        });
        
        console.log('过滤后的 effects:', this.effects.map(e => ({ type: e.type, duration: e.duration })));
        
        // 检查是否有刚性约束效果需要处理
        const rigidEffect = this.effects.find(e => e.type === 'rigid_constraint');
        if (!rigidEffect && this.rigidConstraint) {
            console.log('移除刚性约束，因为 effects 中没有了');
            Matter.World.remove(this.world, this.rigidConstraint);
            this.rigidConstraint = null;
        }
        
        // 检查是否有软绳约束效果需要处理
        const softRopeEffect = this.effects.find(e => e.type === 'soft_rope');
        if (!softRopeEffect) {
            if (this.softRopeConstraint) {
                console.log('移除软绳约束，因为 effects 中没有了');
                Matter.World.remove(this.world, this.softRopeConstraint);
                this.softRopeConstraint = null;
            }
            this.softRopeOriginalLength = 0;
            this.isSoftRopeLocked = false;
        } else {
            console.log('软绳约束仍然存在，duration:', softRopeEffect.duration);
        }
    }

    /**
     * 创建刚性连接，连接两个玩家
     */
    createRigidConnection(duration) {
        if (this.players.length < 2) return;
        
        // 如果已经有约束，先移除
        if (this.rigidConstraint) {
            Matter.World.remove(this.world, this.rigidConstraint);
        }
        
        // 计算当前两个玩家之间的距离
        const dx = this.players[1].position.x - this.players[0].position.x;
        const dy = this.players[1].position.y - this.players[0].position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 创建刚性约束
        this.rigidConstraint = Matter.Constraint.create({
            bodyA: this.players[0],
            bodyB: this.players[1],
            stiffness: 0.95, // 高刚度保证刚性
            length: distance, // 使用当前实际距离
            damping: 0.1
        });
        
        Matter.World.add(this.world, this.rigidConstraint);
        
        // 添加到效果列表
        this.effects.push({
            type: 'rigid_constraint',
            duration: duration
        });
    }

    /**
     * 创建软绳约束
     */
    createSoftRope(duration) {
        console.log('=== createSoftRope 被调用，duration:', duration);
        if (this.players.length < 2) return;
        
        // 如果已经有软绳约束，先移除
        if (this.softRopeConstraint) {
            Matter.World.remove(this.world, this.softRopeConstraint);
            this.softRopeConstraint = null;
        }
        
        // 计算并保存初始距离（原长）
        const dx = this.players[1].position.x - this.players[0].position.x;
        const dy = this.players[1].position.y - this.players[0].position.y;
        this.softRopeOriginalLength = Math.sqrt(dx * dx + dy * dy);
        this.isSoftRopeLocked = false;
        
        // 添加到效果列表
        const newEffect = {
            type: 'soft_rope',
            duration: duration,
            originalLength: this.softRopeOriginalLength
        };
        this.effects.push(newEffect);
        console.log('添加软绳约束到 effects，当前 effects:', this.effects.map(e => ({ type: e.type, duration: e.duration })));
    }

    createArena() {
    }

    createPlayer(x, y, playerId) {
        const player = Matter.Bodies.rectangle(x, y, PLAYER_CONFIG.WIDTH, PLAYER_CONFIG.HEIGHT, {
            label: `player_${playerId}`,
            mass: PLAYER_CONFIG.MASS,
            friction: PLAYER_CONFIG.FRICTION,
            frictionAir: PLAYER_CONFIG.AIR_FRICTION,
            restitution: 0.7, // 提高弹性系数，让碰撞更有弹性
            inertia: Infinity,
            collisionFilter: {
                category: 0x0001,
                mask: 0x0001 // 让玩家可以互相碰撞
            }
        });
        player.playerId = playerId;
        this.players.push(player);
        Matter.World.add(this.world, player);

        // 添加碰撞监听，处理有定位锚的玩家碰撞问题
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            const pairs = event.pairs;
            for (let i = 0; i < pairs.length; i++) {
                const bodyA = pairs[i].bodyA;
                const bodyB = pairs[i].bodyB;

                // 检查碰撞双方是否是玩家
                if (bodyA.playerId && bodyB.playerId) {
                    const aAnchored = this.isPlayerAnchored(bodyA.playerId);
                    const bAnchored = this.isPlayerAnchored(bodyB.playerId);

                    // 如果任意一方有定位锚，碰撞后立即重置有锚玩家的位置和速度
                    if (aAnchored && bodyA._startPos) {
                        Matter.Body.setPosition(bodyA, { x: bodyA._startPos.x, y: bodyA._startPos.y });
                        Matter.Body.setVelocity(bodyA, { x: 0, y: 0 });
                    }
                    if (bAnchored && bodyB._startPos) {
                        Matter.Body.setPosition(bodyB, { x: bodyB._startPos.x, y: bodyB._startPos.y });
                        Matter.Body.setVelocity(bodyB, { x: 0, y: 0 });
                    }
                }
            }
        });

        return player;
    }

    applyForce(playerId, forceX, forceY) {
        const player = this.getPlayer(playerId);
        // 有定位锚的玩家完全不受力
        if (player && !this.isPlayerAnchored(playerId)) {
            Matter.Body.applyForce(player, player.position, {
                x: forceX,
                y: forceY
            });
        }
    }

    applyImpulse(playerId, impulseX, impulseY) {
        const player = this.getPlayer(playerId);
        // 有定位锚的玩家完全不受冲量
        if (player && !this.isPlayerAnchored(playerId)) {
            const mass = player.mass;
            const velocityChange = {
                x: impulseX / mass,
                y: impulseY / mass
            };
            Matter.Body.setVelocity(player, {
                x: player.velocity.x + velocityChange.x,
                y: player.velocity.y + velocityChange.y
            });
        }
    }

    setPlayerMass(playerId, mass) {
        const player = this.getPlayer(playerId);
        if (player) {
            Matter.Body.setMass(player, mass);
        }
    }

    update(deltaTime) {
        // ========== 物理更新前先强制重置有定位锚的玩家 ==========
        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            if (player._anchorPos && this.isPlayerAnchored(player.playerId)) {
                Matter.Body.setPosition(player, { x: player._anchorPos.x, y: player._anchorPos.y });
                Matter.Body.setVelocity(player, { x: 0, y: 0 });
                Matter.Body.setAngularVelocity(player, 0);
            }
        }

        this.processEffects();

        // 更新临时特效
        const now = Date.now();
        this.tempEffects = this.tempEffects.filter(effect => {
            effect.life -= deltaTime;
            // 双重保险：如果 _startTime 存在，用真实时间判断是否过期
            if (effect._startTime && (now - effect._startTime) > effect.maxLife) {
                return false;
            }
            return effect.life > 0;
        });

        // ========== 在 Matter 更新期间，我们分步更新并多次重置 ==========
        const steps = 5; // 分5小步更新，每步后都重置
        const stepDelta = deltaTime / steps;
        for (let s = 0; s < steps; s++) {
            Matter.Engine.update(this.engine, stepDelta);

            // 每次小更新后立即强制重置
            for (let i = 0; i < this.players.length; i++) {
                const player = this.players[i];
                if (player._anchorPos && this.isPlayerAnchored(player.playerId)) {
                    Matter.Body.setPosition(player, { x: player._anchorPos.x, y: player._anchorPos.y });
                    Matter.Body.setVelocity(player, { x: 0, y: 0 });
                    Matter.Body.setAngularVelocity(player, 0);
                }
            }
        }

        // ========== 最后再强制重置一次 ==========
        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            if (player._anchorPos && this.isPlayerAnchored(player.playerId)) {
                Matter.Body.setPosition(player, { x: player._anchorPos.x, y: player._anchorPos.y });
                Matter.Body.setVelocity(player, { x: 0, y: 0 });
                Matter.Body.setAngularVelocity(player, 0);
            }
        }
    }

    processEffects() {
        this.effects.forEach(effect => {
            // 处理软绳约束
            if (effect.type === 'soft_rope' && this.players.length >= 2) {
                // 如果任意一个玩家有定位锚，不处理软绳约束
                const p1Anchored = this.isPlayerAnchored(1);
                const p2Anchored = this.isPlayerAnchored(2);
                if (!p1Anchored && !p2Anchored) {
                    const dx = this.players[1].position.x - this.players[0].position.x;
                    const dy = this.players[1].position.y - this.players[0].position.y;
                    const currentDist = Math.sqrt(dx * dx + dy * dy);

                    // 检查是否超过原长
                    if (currentDist > this.softRopeOriginalLength && !this.isSoftRopeLocked) {
                        // 超过原长，立即锁定为刚性约束
                        this.isSoftRopeLocked = true;

                        // 创建约束
                        this.softRopeConstraint = Matter.Constraint.create({
                            bodyA: this.players[0],
                            bodyB: this.players[1],
                            stiffness: 0.95,
                            length: this.softRopeOriginalLength,
                            damping: 0.1
                        });

                        Matter.World.add(this.world, this.softRopeConstraint);
                    }
                }
            }
            else if (effect.type === 'gravityField' || effect.type === 'repulsionField') {
                this.players.forEach(player => {
                    // 有定位锚的玩家不受力场影响
                    if (this.isPlayerAnchored(player.playerId)) return;

                    const dx = effect.x - player.position.x;
                    const dy = effect.y - player.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < effect.radius && dist > 10) {
                        const force = effect.strength / (dist * 0.5);
                        const angle = Math.atan2(dy, dx);
                        Matter.Body.applyForce(player, player.position, {
                            x: Math.cos(angle) * force * 0.001,
                            y: Math.sin(angle) * force * 0.001
                        });
                    }
                });
            } else if (effect.type === 'frictionZone') {
                this.players.forEach(player => {
                    const dx = effect.x - player.position.x;
                    const dy = effect.y - player.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < effect.radius) {
                        player.friction = effect.friction;
                    } else {
                        player.friction = PLAYER_CONFIG.FRICTION;
                    }
                });
            } else if (effect.type === 'airFrictionZone') {
                this.players.forEach(player => {
                    const dx = effect.x - player.position.x;
                    const dy = effect.y - player.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < effect.radius) {
                        player.frictionAir = effect.airFriction;
                    } else {
                        player.frictionAir = PLAYER_CONFIG.AIR_FRICTION;
                    }
                });
            } else if (effect.type === 'dampingField') {
                // 阻尼领域：以施法者为中心，范围内速度快速衰减
                this.players.forEach(player => {
                    // 有定位锚的玩家不受阻尼影响
                    if (this.isPlayerAnchored(player.playerId)) return;

                    const dx = effect.x - player.position.x;
                    const dy = effect.y - player.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < effect.radius) {
                        // 每帧减少一定比例的速度
                        Matter.Body.setVelocity(player, {
                            x: player.velocity.x * 0.9,
                            y: player.velocity.y * 0.9
                        });
                    }
                });
            }
        });
        
        // 处理电荷之间的库仑力
        if (this.players.length === 2) {
            const p1 = this.players[0];
            const p2 = this.players[1];
            
            // 从 game.js 获取玩家的电荷信息（我们需要一种方式传递电荷，暂时先在 game.js 处理）
        }
    }

    addEffect(effect) {
        this.effects.push(effect);
    }

    addTempEffect(effect) {
        this.tempEffects.push(effect);
    }

    checkBoundary(playerId) {
        const player = this.getPlayer(playerId);
        if (player) {
            const dist = Math.sqrt(
                player.position.x ** 2 + player.position.y ** 2
            );
            return dist > this.arenaRadius;
        }
        return false;
    }

    getPlayer(playerId) {
        return this.players.find(p => p.playerId === playerId);
    }

    getAllPlayers() {
        return this.players;
    }

    reset() {
        // 移除刚性约束
        if (this.rigidConstraint) {
            Matter.World.remove(this.world, this.rigidConstraint);
            this.rigidConstraint = null;
        }
        // 移除软绳约束
        if (this.softRopeConstraint) {
            Matter.World.remove(this.world, this.softRopeConstraint);
            this.softRopeConstraint = null;
        }
        this.softRopeOriginalLength = 0;
        this.isSoftRopeLocked = false;
        // 移除玩家
        this.players.forEach(p => Matter.World.remove(this.world, p));
        this.players = [];
        this.effects = [];
        this.tempEffects = [];
    }
}