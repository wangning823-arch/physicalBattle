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
        this.createArena();
    }

    /**
     * 更新效果的剩余回合数（每回合调用一次）
     */
    updateEffectsTurn() {
        // 处理普通效果
        this.effects = this.effects.filter(effect => {
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
        
        // 检查是否有刚性约束效果需要处理
        const rigidEffect = this.effects.find(e => e.type === 'rigid_constraint');
        if (!rigidEffect && this.rigidConstraint) {
            // 没有刚性约束效果了，移除约束
            Matter.World.remove(this.world, this.rigidConstraint);
            this.rigidConstraint = null;
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
        return player;
    }

    applyForce(playerId, forceX, forceY) {
        const player = this.getPlayer(playerId);
        if (player) {
            Matter.Body.applyForce(player, player.position, {
                x: forceX,
                y: forceY
            });
        }
    }

    applyImpulse(playerId, impulseX, impulseY) {
        const player = this.getPlayer(playerId);
        if (player) {
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
        this.processEffects();
        
        // 更新临时特效
        this.tempEffects = this.tempEffects.filter(effect => {
            effect.life -= deltaTime;
            return effect.life > 0;
        });
        
        Matter.Engine.update(this.engine, deltaTime);
    }

    processEffects() {
        this.effects.forEach(effect => {
            if (effect.type === 'gravityField' || effect.type === 'repulsionField') {
                this.players.forEach(player => {
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
        // 移除玩家
        this.players.forEach(p => Matter.World.remove(this.world, p));
        this.players = [];
        this.effects = [];
        this.tempEffects = [];
    }
}