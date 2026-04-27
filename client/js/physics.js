class PhysicsEngine {
    constructor() {
        // 这里我们模拟 Cannon.js 的 API 风格，保持与现有代码兼容
        this.world = {
            gravity: { x: 0, y: 0, z: 0 }
        };
        this.arenaRadius = GAME_CONFIG.ARENA_RADIUS;
        this.players = [];
        this.effects = [];
        this.tempEffects = [];
        this.rigidConstraint = null;
        this.softRopeConstraint = null;
        this.softRopeOriginalLength = 0;
        this.isSoftRopeLocked = false;
        this.createArena();
    }

    /**
     * 更新效果的剩余回合数（每回合调用一次）
     */
    updateEffectsTurn() {
        console.log('=== updateEffectsTurn 被调用 ===');
        console.log('当前 effects:', this.effects.map(e => ({ type: e.type, duration: e.duration })));
        
        this.effects = this.effects.filter(effect => {
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
            
            if (effect.duration > 0) {
                effect.duration--;
                if (effect.duration <= 0) {
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
        
        const rigidEffect = this.effects.find(e => e.type === 'rigid_constraint');
        if (!rigidEffect && this.rigidConstraint) {
            console.log('移除刚性约束，因为 effects 中没有了');
            this.rigidConstraint = null;
        }
        
        const softRopeEffect = this.effects.find(e => e.type === 'soft_rope');
        if (!softRopeEffect) {
            if (this.softRopeConstraint) {
                console.log('移除软绳约束，因为 effects 中没有了');
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
        
        if (this.rigidConstraint) {
            this.rigidConstraint = null;
        }
        
        const dx = this.players[1].position.x - this.players[0].position.x;
        const dy = this.players[1].position.y - this.players[0].position.y;
        const dz = this.players[1].position.z - this.players[0].position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        this.rigidConstraint = {
            bodyA: this.players[0],
            bodyB: this.players[1],
            stiffness: 0.95,
            length: distance,
            damping: 0.1
        };
        
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
        
        if (this.softRopeConstraint) {
            this.softRopeConstraint = null;
        }
        
        const dx = this.players[1].position.x - this.players[0].position.x;
        const dy = this.players[1].position.y - this.players[0].position.y;
        const dz = this.players[1].position.z - this.players[0].position.z;
        this.softRopeOriginalLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
        this.isSoftRopeLocked = false;
        
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

    createPlayer(x, y, z, playerId) {
        const player = {
            position: { x, y, z },
            velocity: { x: 0, y: 0, z: 0 },
            mass: PLAYER_CONFIG.MASS,
            friction: PLAYER_CONFIG.FRICTION,
            frictionAir: PLAYER_CONFIG.AIR_FRICTION,
            restitution: 0.7,
            inertia: Infinity,
            playerId: playerId
        };
        this.players.push(player);
        return player;
    }

    applyForce(playerId, forceX, forceY, forceZ = 0) {
        const player = this.getPlayer(playerId);
        if (player) {
            // 简单的力应用：直接根据质量调整速度
            player.velocity.x += forceX / player.mass;
            player.velocity.y += forceY / player.mass;
            player.velocity.z += forceZ / player.mass;
        }
    }

    applyImpulse(playerId, impulseX, impulseY, impulseZ = 0) {
        const player = this.getPlayer(playerId);
        if (player) {
            const mass = player.mass;
            player.velocity.x += impulseX / mass;
            player.velocity.y += impulseY / mass;
            player.velocity.z += impulseZ / mass;
        }
    }

    setPlayerMass(playerId, mass) {
        const player = this.getPlayer(playerId);
        if (player) {
            player.mass = mass;
        }
    }

    setPlayerPosition(playerId, x, y, z) {
        const player = this.getPlayer(playerId);
        if (player) {
            player.position.x = x;
            player.position.y = y;
            player.position.z = z;
        }
    }

    setPlayerVelocity(playerId, vx, vy, vz) {
        const player = this.getPlayer(playerId);
        if (player) {
            player.velocity.x = vx;
            player.velocity.y = vy;
            player.velocity.z = vz;
        }
    }

    update(deltaTime) {
        this.processEffects();
        
        this.tempEffects = this.tempEffects.filter(effect => {
            effect.life -= deltaTime;
            return effect.life > 0;
        });
        
        // 更新玩家位置
        this.players.forEach(player => {
            // 应用空气摩擦
            player.velocity.x *= (1 - player.frictionAir * 0.1);
            player.velocity.y *= (1 - player.frictionAir * 0.1);
            player.velocity.z *= (1 - player.frictionAir * 0.1);
            
            // 限制最大速度
            const speed = Math.sqrt(
                player.velocity.x ** 2 +
                player.velocity.y ** 2 +
                player.velocity.z ** 2
            );
            if (speed > PLAYER_CONFIG.MAX_VELOCITY) {
                const scale = PLAYER_CONFIG.MAX_VELOCITY / speed;
                player.velocity.x *= scale;
                player.velocity.y *= scale;
                player.velocity.z *= scale;
            }
            
            // 更新位置
            const dt = deltaTime / 1000; // 转换为秒
            player.position.x += player.velocity.x * dt;
            player.position.y += player.velocity.y * dt;
            player.position.z += player.velocity.z * dt;
        });
        
        // 处理玩家碰撞和刚性约束
        this.processConstraints();
    }

    processConstraints() {
        // 处理刚性约束
        if (this.rigidConstraint && this.players.length >= 2) {
            const p1 = this.players[0];
            const p2 = this.players[1];
            const dx = p2.position.x - p1.position.x;
            const dy = p2.position.y - p1.position.y;
            const dz = p2.position.z - p1.position.z;
            const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (currentDist > 0 && currentDist !== this.rigidConstraint.length) {
                const correction = (this.rigidConstraint.length - currentDist) / 2;
                const nx = dx / currentDist;
                const ny = dy / currentDist;
                const nz = dz / currentDist;
                
                p1.position.x -= nx * correction;
                p1.position.y -= ny * correction;
                p1.position.z -= nz * correction;
                p2.position.x += nx * correction;
                p2.position.y += ny * correction;
                p2.position.z += nz * correction;
            }
        }
        
        // 处理玩家间碰撞
        if (this.players.length >= 2) {
            const p1 = this.players[0];
            const p2 = this.players[1];
            const dx = p2.position.x - p1.position.x;
            const dy = p2.position.y - p1.position.y;
            const dz = p2.position.z - p1.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const minDist = PLAYER_CONFIG.RADIUS * 2;
            
            if (dist < minDist && dist > 0) {
                const overlap = minDist - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                const nz = dz / dist;
                
                // 分离玩家
                p1.position.x -= nx * overlap / 2;
                p1.position.y -= ny * overlap / 2;
                p1.position.z -= nz * overlap / 2;
                p2.position.x += nx * overlap / 2;
                p2.position.y += ny * overlap / 2;
                p2.position.z += nz * overlap / 2;
                
                // 弹性碰撞
                const dvx = p2.velocity.x - p1.velocity.x;
                const dvy = p2.velocity.y - p1.velocity.y;
                const dvz = p2.velocity.z - p1.velocity.z;
                
                const dvDotN = dvx * nx + dvy * ny + dvz * nz;
                const restitution = PLAYER_CONFIG.RESTITUTION;
                
                const totalMass = p1.mass + p2.mass;
                const impulse = (-(1 + restitution) * dvDotN) / totalMass;
                
                p1.velocity.x -= impulse * p2.mass * nx;
                p1.velocity.y -= impulse * p2.mass * ny;
                p1.velocity.z -= impulse * p2.mass * nz;
                p2.velocity.x += impulse * p1.mass * nx;
                p2.velocity.y += impulse * p1.mass * ny;
                p2.velocity.z += impulse * p1.mass * nz;
            }
        }
    }

    processEffects() {
        this.effects.forEach(effect => {
            if (effect.type === 'soft_rope' && this.players.length >= 2) {
                const dx = this.players[1].position.x - this.players[0].position.x;
                const dy = this.players[1].position.y - this.players[0].position.y;
                const dz = this.players[1].position.z - this.players[0].position.z;
                const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (currentDist > this.softRopeOriginalLength && !this.isSoftRopeLocked) {
                    this.isSoftRopeLocked = true;
                    this.softRopeConstraint = {
                        bodyA: this.players[0],
                        bodyB: this.players[1],
                        stiffness: 0.95,
                        length: this.softRopeOriginalLength,
                        damping: 0.1
                    };
                }
            } else if (effect.type === 'gravityField' || effect.type === 'repulsionField') {
                this.players.forEach(player => {
                    const dx = effect.x - player.position.x;
                    const dy = effect.y - player.position.y;
                    const dz = effect.z - player.position.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (dist < effect.radius && dist > 10) {
                        const force = effect.strength / (dist * 0.5);
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const nz = dz / dist;
                        
                        player.velocity.x += nx * force * 0.001;
                        player.velocity.y += ny * force * 0.001;
                        player.velocity.z += nz * force * 0.001;
                    }
                });
            } else if (effect.type === 'frictionZone') {
                this.players.forEach(player => {
                    const dx = effect.x - player.position.x;
                    const dy = effect.y - player.position.y;
                    const dz = effect.z - player.position.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
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
                    const dz = effect.z - player.position.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (dist < effect.radius) {
                        player.frictionAir = effect.airFriction;
                    } else {
                        player.frictionAir = PLAYER_CONFIG.AIR_FRICTION;
                    }
                });
            } else if (effect.type === 'dampingField') {
                this.players.forEach(player => {
                    const dx = effect.x - player.position.x;
                    const dy = effect.y - player.position.y;
                    const dz = effect.z - player.position.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (dist < effect.radius) {
                        player.velocity.x *= 0.9;
                        player.velocity.y *= 0.9;
                        player.velocity.z *= 0.9;
                    }
                });
            }
        });
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
                player.position.x ** 2 +
                player.position.y ** 2 +
                player.position.z ** 2
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
        this.rigidConstraint = null;
        this.softRopeConstraint = null;
        this.softRopeOriginalLength = 0;
        this.isSoftRopeLocked = false;
        this.players = [];
        this.effects = [];
        this.tempEffects = [];
    }
}