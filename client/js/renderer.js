class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.canvas.width = GAME_CONFIG.CANVAS_WIDTH;
        this.canvas.height = GAME_CONFIG.CANVAS_HEIGHT;
        this.centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
        this.centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;
    }

    clear() {
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawArena(radius) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.centerX, this.centerY);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.7, '#252540');
        gradient.addColorStop(1, '#3a3a5a');
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = '#1E90FF';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }

    drawGrid(radius) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.centerX, this.centerY);
        ctx.strokeStyle = 'rgba(30, 144, 255, 0.2)';
        ctx.lineWidth = 1;
        for (let r = 50; r < radius; r += 50) {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawPlayer(player, hasShield, playerData = null, isInvisible = false) {
        const ctx = this.ctx;
        const x = this.centerX + player.position.x;
        const y = this.centerY + player.position.y;
        const w = 40;
        const h = 40;
        ctx.save();
        ctx.translate(x, y);
        
        // 如果处于量子隐身状态，只画一个淡淡的轮廓
        if (isInvisible) {
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, Math.PI * 2);
            ctx.strokeStyle = '#9400D3';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 添加量子效果文字
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#9400D3';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('|ψ⟩', 0, 0);
            ctx.restore();
            return;
        }
        
        if (hasShield) {
            ctx.beginPath();
            ctx.arc(0, 0, 35, 0, Math.PI * 2);
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        // 如果玩家带电荷，显示电荷光环和电荷量
        if (playerData && playerData.charge !== 0) {
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            if (playerData.charge > 0) {
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // 正电荷：黄色
                ctx.fillStyle = 'rgba(255, 255, 0, 0.15)';
            } else {
                ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)'; // 负电荷：蓝色
                ctx.fillStyle = 'rgba(0, 0, 255, 0.15)';
            }
            ctx.lineWidth = 3;
            ctx.fill();
            ctx.stroke();
            
            // 显示电荷量数值
            ctx.fillStyle = playerData.charge > 0 ? '#FFFF00' : '#00BFFF';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${playerData.charge > 0 ? '+' : ''}${playerData.charge}`, 0, -35);
        }
        
        // 如果玩家有定位锚效果，绘制锚定特效
        const hasAnchor = playerData && playerData.effects && playerData.effects.some(e => e.type === 'anchor');
        if (playerData && playerData.effects && playerData.effects.length > 0) {
            console.log(`[Renderer] 玩家${player.playerId} effects:`, playerData.effects.map(e => e.type));
        }
        if (hasAnchor) {
            // 锚定光环 - 旋转的锁链环
            const time = Date.now() / 1000;
            ctx.beginPath();
            ctx.arc(0, 0, 32, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(205, 133, 63, 0.8)';
            ctx.lineWidth = 4;
            ctx.setLineDash([8, 4]);
            ctx.lineDashOffset = time * 20;
            ctx.stroke();
            ctx.setLineDash([]);

            // 锚定锁链 - 四条链从中心向外延伸
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + time * 0.5;
                const innerR = 22;
                const outerR = 34;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
                ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
                ctx.strokeStyle = 'rgba(205, 133, 63, 0.9)';
                ctx.lineWidth = 3;
                ctx.stroke();
                // 链节端点
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * outerR, Math.sin(angle) * outerR, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#CD853F';
                ctx.fill();
            }

            // 锚定图标
            ctx.fillStyle = '#CD853F';
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚓', 0, 32);
        }

        ctx.fillStyle = player.playerId === 1 ? '#FF6B35' : '#1E90FF';
        ctx.fillRect(-w/2, -h/2, w, h);
        ctx.strokeStyle = hasAnchor ? '#CD853F' : '#fff';
        ctx.lineWidth = hasAnchor ? 3 : 2;
        ctx.strokeRect(-w/2, -h/2, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${player.playerId}`, 0, 0);
        ctx.restore();
    }

    drawEffects(effects, players) {
        effects.forEach(effect => {
            const ctx = this.ctx;
            const x = this.centerX + (effect.x || 0);
            const y = this.centerY + (effect.y || 0);
            ctx.save();
            if (effect.type === 'gravityField') {
                ctx.beginPath();
                ctx.arc(x, y, effect.radius, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(128, 0, 128, 0.6)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.fillStyle = 'rgba(128, 0, 128, 0.15)';
                ctx.fill();
                ctx.fillStyle = 'rgba(128, 0, 128, 0.8)';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🌀', x, y);
            } else if (effect.type === 'repulsionField') {
                ctx.beginPath();
                ctx.arc(x, y, effect.radius, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
                ctx.fill();
                ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔄', x, y);
            } else if (effect.type === 'frictionZone') {
                ctx.beginPath();
                ctx.arc(x, y, effect.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(200, 230, 255, 0.35)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(150, 200, 255, 0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = 'rgba(150, 200, 255, 0.8)';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🧊', x, y);
            } else if (effect.type === 'airFrictionZone') {
                ctx.beginPath();
                ctx.arc(x, y, effect.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(180, 180, 200, 0.25)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(150, 150, 170, 0.4)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = 'rgba(150, 150, 170, 0.8)';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🌫️', x, y);
            } else if (effect.type === 'dampingField') {
                ctx.beginPath();
                ctx.arc(x, y, effect.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(100, 150, 100, 0.3)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(80, 180, 80, 0.6)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.fillStyle = 'rgba(80, 180, 80, 0.8)';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🛡️', x, y);
            } else if (effect.type === 'rigid_constraint' && players && players.length >= 2) {
                // 绘制刚性连接效果
                const p1 = players[0];
                const p2 = players[1];
                const x1 = this.centerX + p1.position.x;
                const y1 = this.centerY + p1.position.y;
                const x2 = this.centerX + p2.position.x;
                const y2 = this.centerY + p2.position.y;
                
                // 绘制连接线
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 4;
                ctx.setLineDash([10, 5]);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 绘制连接点
                ctx.beginPath();
                ctx.arc(x1, y1, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#FFD700';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x2, y2, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // 在中间绘制链条图标
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                ctx.font = '20px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔗', midX, midY);
            } else if (effect.type === 'soft_rope' && players && players.length >= 2) {
                // 绘制软绳约束效果
                const p1 = players[0];
                const p2 = players[1];
                const x1 = this.centerX + p1.position.x;
                const y1 = this.centerY + p1.position.y;
                const x2 = this.centerX + p2.position.x;
                const y2 = this.centerY + p2.position.y;
                
                // 检查游戏状态是否有软绳锁定信息
                // 这里我们通过距离来判断
                const currentDist = Math.sqrt((p2.position.x - p1.position.x) ** 2 + (p2.position.y - p1.position.y) ** 2);
                const originalLength = effect.originalLength || 100;
                const isLocked = currentDist >= originalLength * 0.99; // 接近或超过原长视为锁定
                
                // 绘制连接线
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                
                if (isLocked) {
                    // 锁定状态：金色实线
                    ctx.strokeStyle = '#FFD700';
                    ctx.lineWidth = 5;
                    ctx.setLineDash([]);
                } else {
                    // 未锁定状态：浅蓝色虚线
                    ctx.strokeStyle = '#87CEEB';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([8, 8]);
                }
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 绘制连接点
                const pointColor = isLocked ? '#FFD700' : '#87CEEB';
                ctx.beginPath();
                ctx.arc(x1, y1, 8, 0, Math.PI * 2);
                ctx.fillStyle = pointColor;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x2, y2, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // 在中间绘制图标
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                ctx.font = isLocked ? '22px sans-serif' : '20px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(isLocked ? '🔗' : '🪢', midX, midY);
                
                // 未锁定时，显示原长距离指示器（虚线圆）
                if (!isLocked) {
                    ctx.beginPath();
                    ctx.arc(x1, y1, originalLength, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(135, 206, 235, 0.4)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 10]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
            ctx.restore();
        });
    }

    drawTempEffects(tempEffects) {
        tempEffects.forEach(effect => {
            const ctx = this.ctx;
            const progress = effect.life / effect.maxLife;
            ctx.save();
            
            if (effect.type === 'laser') {
                const startX = this.centerX + effect.startX;
                const startY = this.centerY + effect.startY;
                const endX = this.centerX + effect.endX;
                const endY = this.centerY + effect.endY;
                
                // 绘制激光
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                
                // 外层发光
                ctx.strokeStyle = `rgba(255, 0, 0, ${progress * 0.3})`;
                ctx.lineWidth = 12;
                ctx.stroke();
                
                // 中层
                ctx.strokeStyle = `rgba(255, 100, 100, ${progress * 0.6})`;
                ctx.lineWidth = 6;
                ctx.stroke();
                
                // 核心亮线
                ctx.strokeStyle = `rgba(255, 255, 255, ${progress})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // 起点发光
                ctx.beginPath();
                ctx.arc(startX, startY, 8, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 0, 0, ${progress})`;
                ctx.fill();
                
                // 终点爆炸
                const endRadius = 20 * (1 - progress);
                ctx.beginPath();
                ctx.arc(endX, endY, endRadius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 165, 0, ${progress * 0.5})`;
                ctx.fill();
                ctx.strokeStyle = `rgba(255, 69, 0, ${progress})`;
                ctx.lineWidth = 3;
                ctx.stroke();
            } else if (effect.type === 'momentum_blast') {
                // 保留原来的爆炸特效给explosive_charge用
                const x = this.centerX + (effect.x || 0);
                const y = this.centerY + (effect.y || 0);
                const radius = 50 * (1 - progress);
                const alpha = progress;
                
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 165, 0, ${alpha * 0.5})`;
                ctx.fill();
                ctx.strokeStyle = `rgba(255, 69, 0, ${alpha})`;
                ctx.lineWidth = 4;
                ctx.stroke();
                
                // 绘制粒子
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const dist = 30 * (1 - progress);
                    const px = x + Math.cos(angle) * dist;
                    const py = y + Math.sin(angle) * dist;
                    ctx.beginPath();
                    ctx.arc(px, py, 3 * progress, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
                    ctx.fill();
                }
            } else if (effect.type === 'quantum') {
                // 量子特效
                const x = this.centerX + (effect.x || 0);
                const y = this.centerY + (effect.y || 0);
                const alpha = progress;
                
                // 外层闪烁光环
                ctx.beginPath();
                ctx.arc(x, y, 40 * (1 - progress * 0.5), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(148, 0, 211, ${alpha * 0.8})`;
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // 内层发光
                ctx.beginPath();
                ctx.arc(x, y, 20 * progress, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(186, 85, 211, ${alpha * 0.5})`;
                ctx.fill();
                
                // 粒子效果
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2 + Date.now() / 200;
                    const dist = 35 * (1 - progress);
                    const px = x + Math.cos(angle) * dist;
                    const py = y + Math.sin(angle) * dist;
                    ctx.beginPath();
                    ctx.arc(px, py, 4 * progress, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(238, 130, 238, ${alpha})`;
                    ctx.fill();
                }
            } else if (effect.type === 'heat_engine_blast') {
                // 🔥 热机超级爆炸特效！
                const x = this.centerX + (effect.x || 0);
                const y = this.centerY + (effect.y || 0);
                const alpha = progress;
                
                // 1. 超亮的核心白光
                const coreRadius = 60 * progress;
                const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, coreRadius);
                coreGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
                coreGradient.addColorStop(0.3, `rgba(255, 200, 100, ${alpha * 0.8})`);
                coreGradient.addColorStop(1, `rgba(255, 100, 0, 0)`);
                ctx.beginPath();
                ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
                ctx.fillStyle = coreGradient;
                ctx.fill();
                
                // 2. 多层冲击波环
                for (let wave = 0; wave < 4; wave++) {
                    const waveRadius = 40 + wave * 40 + (1 - progress) * 80;
                    const waveAlpha = alpha * (1 - wave * 0.2);
                    const waveWidth = 8 - wave * 1.5;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, waveRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(255, ${150 - wave * 30}, 0, ${waveAlpha})`;
                    ctx.lineWidth = waveWidth;
                    ctx.stroke();
                }
                
                // 3. 火焰粒子 - 40个粒子！
                for (let i = 0; i < 40; i++) {
                    const angle = (i / 40) * Math.PI * 2;
                    const speed = 150 + Math.random() * 100;
                    const dist = speed * (1 - progress);
                    const px = x + Math.cos(angle) * dist;
                    const py = y + Math.sin(angle) * dist;
                    const particleSize = 4 + Math.random() * 4;
                    
                    // 随机颜色：黄色 -> 橙色 -> 红色 -> 暗红
                    const colors = [
                        `rgba(255, 255, 0, ${alpha})`,
                        `rgba(255, 200, 0, ${alpha})`,
                        `rgba(255, 100, 0, ${alpha})`,
                        `rgba(255, 50, 0, ${alpha * 0.8})`
                    ];
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    
                    ctx.beginPath();
                    ctx.arc(px, py, particleSize * progress, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                }
                
                // 4. 火花粒子 - 20个快速移动的小火花
                for (let i = 0; i < 20; i++) {
                    const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.5;
                    const speed = 200 + Math.random() * 150;
                    const dist = speed * (1 - progress);
                    const px = x + Math.cos(angle) * dist;
                    const py = y + Math.sin(angle) * dist;
                    
                    ctx.beginPath();
                    ctx.arc(px, py, 2 * progress, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.8})`;
                    ctx.fill();
                }
                
                // 5. 地面灼烧效果
                if (progress > 0.5) {
                    const burnRadius = 100 * progress;
                    const burnGradient = ctx.createRadialGradient(x, y, 0, x, y, burnRadius);
                    burnGradient.addColorStop(0, `rgba(100, 0, 0, ${(progress - 0.5) * 0.5})`);
                    burnGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.beginPath();
                    ctx.arc(x, y, burnRadius, 0, Math.PI * 2);
                    ctx.fillStyle = burnGradient;
                    ctx.fill();
                }
            }
            
            ctx.restore();
        });
    }

    drawAimingLine(player, target, gameState = null) {
        if (!player || !target) return;
        const ctx = this.ctx;
        const startX = this.centerX + player.position.x;
        const startY = this.centerY + player.position.y;
        const endX = this.centerX + target.x;
        const endY = this.centerY + target.y;
        
        // 检查目标位置是否在场地内
        let isValid = true;
        if (gameState && gameState.arenaRadius) {
            const targetDist = Math.sqrt(target.x ** 2 + target.y ** 2);
            // 默认最大半径
            let maxAllowedRadius = gameState.arenaRadius;
            
            // 如果我们知道正在放置领域类卡牌，应该考虑领域半径
            // 这里我们通过 gameState 暂时无法获取卡牌信息，先做简单检查
            // 至少保证中心在场地内
            isValid = targetDist <= maxAllowedRadius;
        }
        
        ctx.save();
        ctx.setLineDash([10, 5]);
        ctx.strokeStyle = isValid ? '#FFD700' : '#FF0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(endX, endY, 15, 0, Math.PI * 2);
        ctx.fillStyle = isValid ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
        ctx.fill();
        ctx.strokeStyle = isValid ? '#FFD700' : '#FF0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
        
        // 如果无效，显示提示文字
        if (!isValid) {
            ctx.fillStyle = '#FF0000';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('不能放在场地外！', endX, endY - 25);
        }
        
        ctx.restore();
    }

    drawFallWarning(player, arenaRadius) {
        const dist = Math.sqrt(player.position.x ** 2 + player.position.y ** 2);
        if (dist > arenaRadius * 0.7) {
            const ctx = this.ctx;
            const intensity = (dist - arenaRadius * 0.7) / (arenaRadius * 0.3);
            ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.3})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    render(gameState, aimingTarget = null, currentPlayerPhysics = null) {
        this.clear();
        this.drawArena(gameState.arenaRadius);
        this.drawGrid(gameState.arenaRadius);
        if (gameState.effects) {
            this.drawEffects(gameState.effects, gameState.players || gameState.physicsPlayers);
        }
        let playersToDraw = gameState.players;
        if (!playersToDraw || playersToDraw.length === 0) {
            playersToDraw = gameState.physicsPlayers;
        }
        if (playersToDraw && playersToDraw.length > 0) {
            playersToDraw.forEach(p => {
                let playerData = null;
                if (gameState.playersData) {
                    playerData = gameState.playersData.find(gp => gp.id === p.playerId);
                } else if (gameState.players) {
                    playerData = gameState.players.find(gp => gp.id === p.playerId);
                }
                const isInvisible = gameState.quantumInvisible && gameState.quantumInvisible[p.playerId];
                this.drawPlayer(p, gameState.shields && gameState.shields[p.playerId], playerData, isInvisible);
            });
        }
        if (gameState.tempEffects) {
            this.drawTempEffects(gameState.tempEffects);
        }
        if (aimingTarget && currentPlayerPhysics) {
            this.drawAimingLine(currentPlayerPhysics, aimingTarget, gameState);
        }
        if (playersToDraw && playersToDraw[0]) {
            this.drawFallWarning(playersToDraw[0], gameState.arenaRadius);
        }
    }
}