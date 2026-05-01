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
        this.softRopeOriginalLength = 0; // 软绳原长
        this.isSoftRopeLocked = false; // 软绳是否已锁定
        this.anchoredPlayerIds = []; // 有定位锚的玩家ID列表
        this.projectiles = []; // 电磁炮炮弹
        this._setupProjectileCollisions();
        this.createArena();
    }

    // 检查玩家是否有定位锚
    isPlayerAnchored(playerId) {
        return this.anchoredPlayerIds.indexOf(playerId) !== -1;
    }

    _setupProjectileCollisions() {
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            for (const pair of event.pairs) {
                const { bodyA, bodyB } = pair;
                let projectile = null;
                let player = null;

                if (bodyA.label === 'projectile' && bodyB.playerId) {
                    projectile = bodyA;
                    player = bodyB;
                } else if (bodyB.label === 'projectile' && bodyA.playerId) {
                    projectile = bodyB;
                    player = bodyA;
                }

                if (projectile && player) {
                    // 找到对应的炮弹数据
                    const projIndex = this.projectiles.findIndex(p => p.body === projectile);
                    if (projIndex === -1) continue;
                    const projData = this.projectiles[projIndex];

                    // 跳过发射者（保护期10帧）
                    if (projData.graceFrames <= 10) continue;

                    // 非弹性碰撞：炮弹动量完全转移给玩家
                    const vel = projectile.velocity;
                    const momentum = projectile.mass * Math.sqrt(vel.x * vel.x + vel.y * vel.y);
                    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
                    if (speed > 0) {
                        this.applyImpulse(player.playerId,
                            (vel.x / speed) * momentum,
                            (vel.y / speed) * momentum
                        );
                    }

                    // 命中特效
                    const pos = projectile.position;
                    this.addTempEffect({
                        type: 'momentum_blast',
                        x: pos.x,
                        y: pos.y,
                        life: 700,
                        maxLife: 700,
                        _seed: Date.now() + 99999
                    });

                    // 移除炮弹
                    this.removeProjectile(projIndex);
                }
            }
        });
    }

    /**
     * 更新效果的剩余回合数（每回合调用一次）
     */
    updateEffectsTurn() {
        // 每个玩家出牌结束时调用，减少所有效果的 duration
        this.effects.forEach(effect => {
            if (effect.duration > 0) {
                effect.duration--;
            }
        });

        // 第二步：再过滤掉 duration <= 0 的效果
        this.effects = this.effects.filter(effect => {
            if (effect.duration <= 0) {
                // 效果结束，恢复玩家属性
                if (effect.type === 'frictionZone') {
                    this.players.forEach(player => {
                        player.friction = PLAYER_CONFIG.FRICTION;
                        player.groundFriction = PLAYER_CONFIG.GROUND_FRICTION;
                    });
                }
                if (effect.type === 'airFrictionZone') {
                    this.players.forEach(player => {
                        player.frictionAir = PLAYER_CONFIG.AIR_FRICTION;
                    });
                }
                return false;
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
            this.softRopeOriginalLength = 0;
            this.isSoftRopeLocked = false;
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
                mask: 0x0005 // 玩家之间碰撞(0x0001) + 与炮弹碰撞(0x0004)
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

        // ========== 应用地面摩擦力 ==========
        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            const vx = player.velocity.x;
            const vy = player.velocity.y;
            const speed = Math.sqrt(vx * vx + vy * vy);

            if (speed > 0.01) {
                // 获取当前玩家的地面摩擦系数
                const friction = player.groundFriction || PLAYER_CONFIG.GROUND_FRICTION;
                // 按比例减速
                const factor = 1 - friction;
                Matter.Body.setVelocity(player, {
                    x: vx * factor,
                    y: vy * factor
                });
            } else {
                // 速度很小时直接停止
                Matter.Body.setVelocity(player, { x: 0, y: 0 });
            }
        }

        // ========== 更新炮弹 ==========
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.life--;
            proj.graceFrames = (proj.graceFrames || 0) + 1;

            // 检查是否飞出场外或超时
            const pos = proj.body.position;
            const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
            if (dist > this.arenaRadius || proj.life <= 0) {
                this.removeProjectile(i);
                continue;
            }
        }

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
                    const p1 = this.players[0];
                    const p2 = this.players[1];
                    const dx = p2.position.x - p1.position.x;
                    const dy = p2.position.y - p1.position.y;
                    const currentDist = Math.sqrt(dx * dx + dy * dy);

                    // 锁定状态：超过原长时锁定（视觉和行为切换）
                    if (currentDist > this.softRopeOriginalLength && !this.isSoftRopeLocked) {
                        this.isSoftRopeLocked = true;
                    }

                    // 超过原长时施加拉力（只阻止增大，不阻止缩小）
                    if (currentDist > this.softRopeOriginalLength) {
                        const overshoot = currentDist - this.softRopeOriginalLength;
                        const forceMag = overshoot * 0.0008;
                        const nx = dx / currentDist;
                        const ny = dy / currentDist;
                        // 把两个玩家往中间拉
                        Matter.Body.applyForce(p1, p1.position, { x: nx * forceMag, y: ny * forceMag });
                        Matter.Body.applyForce(p2, p2.position, { x: -nx * forceMag, y: -ny * forceMag });
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
                        // 冰霜地带：大幅降低地面摩擦力，让玩家滑得更远
                        player.groundFriction = effect.friction;
                    } else {
                        player.friction = PLAYER_CONFIG.FRICTION;
                        player.groundFriction = PLAYER_CONFIG.GROUND_FRICTION;
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
                            x: player.velocity.x * 0.92,
                            y: player.velocity.y * 0.92
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

    removeProjectile(index) {
        const proj = this.projectiles[index];
        Matter.Composite.remove(this.engine.world, proj.body);
        this.projectiles.splice(index, 1);
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
        this.softRopeOriginalLength = 0;
        this.isSoftRopeLocked = false;
        // 移除玩家
        this.players.forEach(p => Matter.World.remove(this.world, p));
        this.players = [];
        this.effects = [];
        this.tempEffects = [];
        // 清除炮弹
        this.projectiles.forEach(p => Matter.Composite.remove(this.engine.world, p.body));
        this.projectiles = [];
    }
}