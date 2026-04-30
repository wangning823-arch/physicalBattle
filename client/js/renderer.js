// ============ Seeded PRNG (mulberry32) ============
function _seededRandom(seed) {
    let s = seed | 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function _makeParticles(seed, count, opts) {
    const rng = _seededRandom(seed);
    const ps = [];
    for (let i = 0; i < count; i++) {
        ps.push({
            angle: rng() * Math.PI * 2,
            speed: opts.minSpeed + rng() * (opts.maxSpeed - opts.minSpeed),
            size: opts.minSize + rng() * (opts.maxSize - opts.minSize),
            hueShift: opts.hueShift ? (rng() - 0.5) * opts.hueShift : 0,
            phase: rng() * Math.PI * 2
        });
    }
    return ps;
}

// ============ Screen Shake State ============
let _shakeIntensity = 0;
let _shakeDuration = 0;
let _shakeStart = 0;

function triggerShake(intensity) {
    _shakeIntensity = intensity;
    _shakeDuration = 200 + intensity * 3;
    _shakeStart = Date.now();
}

// ============ Main Renderer ============
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

    // ========== Utility Drawing Methods ==========

    drawGlowCircle(ctx, x, y, r, color, alpha, lineWidth) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth || 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }

    drawEnergyRing(ctx, x, y, radius, time, color, width) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width || 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(x, y, radius, time, time + Math.PI * 1.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, radius, time + Math.PI, time + Math.PI * 2.2);
        ctx.stroke();
        ctx.restore();
    }

    drawElectricArc(ctx, x1, y1, x2, y2, color, jitter, seed) {
        const rng = _seededRandom(seed);
        const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const segments = Math.max(4, Math.floor(dist / 8));
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const mx = x1 + (x2 - x1) * t + (rng() - 0.5) * jitter;
            const my = y1 + (y2 - y1) * t + (rng() - 0.5) * jitter;
            ctx.lineTo(mx, my);
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    drawSpiral(ctx, x, y, r, turns, time, color, alpha) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        const steps = 80;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const angle = t * turns * Math.PI * 2 + time;
            const cr = t * r;
            const px = x + Math.cos(angle) * cr;
            const py = y + Math.sin(angle) * cr;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
    }

    drawFrostCrystal(ctx, x, y, size, time, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#B0E0FF';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#87CEFA';
        ctx.shadowBlur = 8;
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + time * 0.3;
            const len = size * (0.6 + 0.4 * Math.sin(time * 2 + i));
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.stroke();
            // 侧枝
            const bx = x + Math.cos(angle) * len * 0.5;
            const by = y + Math.sin(angle) * len * 0.5;
            const bAngle1 = angle + 0.5;
            const bAngle2 = angle - 0.5;
            const bLen = len * 0.4;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(bAngle1) * bLen, by + Math.sin(bAngle1) * bLen);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(bAngle2) * bLen, by + Math.sin(bAngle2) * bLen);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawParticleBurst(ctx, x, y, particles, progress, colorBase, maxDist) {
        const alpha = progress > 0.1 ? progress : 0;
        particles.forEach(p => {
            const dist = p.speed * maxDist * (1 - progress);
            const px = x + Math.cos(p.angle + progress * 0.5) * dist;
            const py = y + Math.sin(p.angle + progress * 0.5) * dist;
            const sz = p.size * (1 - progress * 0.7);
            const a = alpha * (1 - p.hueShift * 0.5);
            ctx.beginPath();
            ctx.arc(px, py, sz, 0, Math.PI * 2);
            ctx.fillStyle = colorBase.replace('A', Math.max(0, a).toFixed(2));
            ctx.fill();
        });
    }

    // ========== Arena ==========

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

        // 边界光环动画
        const t = Date.now() / 1000;
        ctx.shadowColor = '#1E90FF';
        ctx.shadowBlur = 15 + 5 * Math.sin(t * 2);
        ctx.strokeStyle = '#1E90FF';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 赛场边缘能量环
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#4488FF';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, 0, radius - 4, t * 0.3, t * 0.3 + Math.PI * 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, radius - 4, t * 0.3 + Math.PI, t * 0.3 + Math.PI * 2.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
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

    // ========== Player ==========

    drawPlayer(player, hasShield, playerData = null, isInvisible = false) {
        const ctx = this.ctx;
        const x = this.centerX + player.position.x;
        const y = this.centerY + player.position.y;
        const w = 40, h = 40;
        const time = Date.now() / 1000;

        ctx.save();
        ctx.translate(x, y);

        // 量子隐身
        if (isInvisible) {
            ctx.globalAlpha = 0.15 + 0.05 * Math.sin(time * 4);
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, Math.PI * 2);
            ctx.strokeStyle = '#9400D3';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = time * 10;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#9400D3';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('|ψ⟩', 0, 0);
            ctx.restore();
            return;
        }

        // 护盾 - 能量泡泡
        if (hasShield) {
            ctx.save();
            const pulse = Math.sin(time * 3) * 3;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 15 + pulse;
            ctx.beginPath();
            ctx.arc(0, 0, 35 + pulse, 0, Math.PI * 2);
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.8;
            ctx.stroke();
            // 内层半透明
            ctx.globalAlpha = 0.08 + 0.03 * Math.sin(time * 5);
            ctx.fillStyle = '#FFD700';
            ctx.fill();
            // 旋转能量环
            ctx.globalAlpha = 0.5;
            this.drawEnergyRing(ctx, 0, 0, 38, time * 1.5, '#FFD700', 2);
            ctx.restore();
        }

        // 电荷光环 + 电弧
        if (playerData && playerData.charge !== 0) {
            const isPos = playerData.charge > 0;
            const color = isPos ? '#FFFF00' : '#00BFFF';
            const chargeAbs = Math.abs(playerData.charge);

            // 能量光环
            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 10 + chargeAbs * 3;
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fillStyle = isPos ? 'rgba(255,255,0,0.1)' : 'rgba(0,191,255,0.1)';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6 + 0.2 * Math.sin(time * 4);
            ctx.stroke();
            ctx.restore();

            // 电弧 - 从中心向边缘放电
            for (let i = 0; i < chargeAbs; i++) {
                const a1 = time * 3 + i * 2.1;
                const a2 = a1 + 1.2 + Math.sin(time * 5 + i) * 0.8;
                const r1 = 15;
                const r2 = 28 + Math.sin(time * 4 + i * 1.3) * 5;
                this.drawElectricArc(ctx,
                    Math.cos(a1) * r1, Math.sin(a1) * r1,
                    Math.cos(a2) * r2, Math.sin(a2) * r2,
                    color, 12, (i + 1) * 7919 + Math.floor(time * 10)
                );
            }

            // 电荷量
            ctx.fillStyle = color;
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${isPos ? '+' : ''}${playerData.charge}`, 0, -40);
        }

        // 定位锚 - 锁链和地面裂纹
        const hasAnchor = playerData && playerData.effects && playerData.effects.some(e => e.type === 'anchor');
        if (hasAnchor) {
            ctx.save();
            // 旋转锁链环
            ctx.beginPath();
            ctx.arc(0, 0, 32, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(205,133,63,0.8)';
            ctx.lineWidth = 4;
            ctx.setLineDash([8, 4]);
            ctx.lineDashOffset = time * 20;
            ctx.stroke();
            ctx.setLineDash([]);

            // 四条锚链
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + time * 0.5;
                const innerR = 22, outerR = 34;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
                ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
                ctx.strokeStyle = 'rgba(205,133,63,0.9)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * outerR, Math.sin(angle) * outerR, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#CD853F';
                ctx.fill();
            }

            // 地面裂纹
            ctx.globalAlpha = 0.4;
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const len = 15 + 10 * Math.sin(time * 2 + i);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
                ctx.strokeStyle = '#CD853F';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // 锚定图标
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#CD853F';
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚓', 0, 35);
            ctx.restore();
        }

        // 质量变化指示器
        if (playerData && playerData.effects) {
            const massEffect = playerData.effects.find(e => e.type === 'massChange');
            if (massEffect) {
                const isHeavy = massEffect.multiplier > 1;
                const glow = Math.sin(time * 3) * 5;
                ctx.save();
                ctx.shadowColor = isHeavy ? '#FF4444' : '#44FF44';
                ctx.shadowBlur = 10 + glow;
                ctx.beginPath();
                ctx.arc(0, 0, 24, 0, Math.PI * 2);
                ctx.strokeStyle = isHeavy ? '#FF6666' : '#66FF66';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.lineDashOffset = time * 15;
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }
        }

        // 热机状态指示器
        if (playerData && playerData.heatEngine && playerData.heatEngine.active) {
            const he = playerData.heatEngine;
            const isFull = he.charge >= he.maxCharge;
            const yOff = -50;

            ctx.save();

            // 背景面板
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#1a0a00';
            const bx = -30, by = yOff - 12, bw = 60, bh = 24, br = 6;
            ctx.beginPath();
            ctx.moveTo(bx + br, by);
            ctx.lineTo(bx + bw - br, by);
            ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
            ctx.lineTo(bx + bw, by + bh - br);
            ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
            ctx.lineTo(bx + br, by + bh);
            ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
            ctx.lineTo(bx, by + br);
            ctx.quadraticCurveTo(bx, by, bx + br, by);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = isFull ? '#FF4400' : '#FF8800';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = isFull ? 0.9 : 0.6;
            ctx.stroke();

            // 火焰图标
            ctx.globalAlpha = 1;
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔥', -18, yOff);

            // 充能格子
            for (let i = 0; i < he.maxCharge; i++) {
                const px = -4 + i * 12;
                const filled = i < he.charge;
                ctx.beginPath();
                ctx.arc(px, yOff, 4, 0, Math.PI * 2);
                ctx.fillStyle = filled ? '#FF6600' : '#333';
                ctx.fill();
                if (filled) {
                    ctx.shadowColor = '#FF4400';
                    ctx.shadowBlur = 6;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }

            // 满充能时的脉动光环
            if (isFull) {
                ctx.globalAlpha = 0.4 + 0.3 * Math.sin(time * 6);
                ctx.beginPath();
                ctx.arc(0, 0, 35, 0, Math.PI * 2);
                ctx.strokeStyle = '#FF4400';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#FF2200';
                ctx.shadowBlur = 20;
                ctx.stroke();

                // 火焰粒子
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2 + time * 3;
                    const r = 30 + Math.sin(time * 5 + i * 2) * 5;
                    const fx = Math.cos(angle) * r;
                    const fy = Math.sin(angle) * r;
                    ctx.beginPath();
                    ctx.arc(fx, fy, 2 + Math.sin(time * 8 + i) * 1, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,${100 + i * 20},0,${0.5 + 0.3 * Math.sin(time * 6 + i)})`;
                    ctx.fill();
                }
            }

            ctx.restore();
        }

        // 玩家本体
        const pColor = player.playerId === 1 ? '#FF6B35' : '#1E90FF';
        ctx.fillStyle = pColor;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = hasAnchor ? '#CD853F' : '#fff';
        ctx.lineWidth = hasAnchor ? 3 : 2;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${player.playerId}`, 0, 0);

        ctx.restore();
    }

    // ========== Persistent Effects ==========

    drawEffects(effects, players) {
        const time = Date.now() / 1000;
        effects.forEach(effect => {
            const ctx = this.ctx;
            const x = this.centerX + (effect.x || 0);
            const y = this.centerY + (effect.y || 0);
            ctx.save();

            if (effect.type === 'gravityField') {
                // 重力井 - 旋转漩涡 + 向内粒子
                ctx.save();
                ctx.shadowColor = '#800080';
                ctx.shadowBlur = 15;

                // 底层半透明
                ctx.beginPath();
                ctx.arc(x, y, effect.radius, 0, Math.PI * 2);
                const grad = ctx.createRadialGradient(x, y, 0, x, y, effect.radius);
                grad.addColorStop(0, 'rgba(128,0,128,0.3)');
                grad.addColorStop(0.5, 'rgba(128,0,128,0.15)');
                grad.addColorStop(1, 'rgba(128,0,128,0)');
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.restore();

                // 旋转漩涡线
                this.drawSpiral(ctx, x, y, effect.radius * 0.9, 3, time * 1.5, '#9932CC', 0.5);
                this.drawSpiral(ctx, x, y, effect.radius * 0.9, 3, time * 1.5 + Math.PI / 3, '#BA55D3', 0.4);

                // 向内流动粒子
                const rng = _seededRandom(effect._seed || 12345);
                for (let i = 0; i < 12; i++) {
                    const baseAngle = rng() * Math.PI * 2;
                    const baseR = effect.radius * (0.3 + rng() * 0.7);
                    const anim = (time * 0.8 + rng() * 5) % 3 / 3;
                    const r = baseR * (1 - anim);
                    const angle = baseAngle + anim * 2;
                    const px = x + Math.cos(angle) * r;
                    const py = y + Math.sin(angle) * r;
                    const sz = 2 + rng() * 2;
                    ctx.beginPath();
                    ctx.arc(px, py, sz * (1 - anim), 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(200,100,255,${0.7 * (1 - anim)})`;
                    ctx.fill();
                }

                // 中心标记
                ctx.fillStyle = '#BA55D3';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🌀', x, y);

            } else if (effect.type === 'repulsionField') {
                // 排斥场 - 向外扩散波纹 + 箭头
                ctx.save();
                ctx.shadowColor = '#00FFFF';
                ctx.shadowBlur = 15;

                ctx.beginPath();
                ctx.arc(x, y, effect.radius, 0, Math.PI * 2);
                const grad = ctx.createRadialGradient(x, y, 0, x, y, effect.radius);
                grad.addColorStop(0, 'rgba(0,255,255,0)');
                grad.addColorStop(0.7, 'rgba(0,255,255,0.08)');
                grad.addColorStop(1, 'rgba(0,255,255,0.15)');
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.restore();

                // 扩散波纹
                for (let w = 0; w < 3; w++) {
                    const waveR = effect.radius * ((time * 0.4 + w * 0.33) % 1);
                    const waveAlpha = 1 - waveR / effect.radius;
                    ctx.beginPath();
                    ctx.arc(x, y, waveR, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(0,255,255,${waveAlpha * 0.4})`;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                // 向外箭头
                ctx.globalAlpha = 0.5;
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2 + time * 0.3;
                    const r1 = effect.radius * 0.3;
                    const r2 = effect.radius * 0.7;
                    ctx.beginPath();
                    ctx.moveTo(x + Math.cos(angle) * r1, y + Math.sin(angle) * r1);
                    ctx.lineTo(x + Math.cos(angle) * r2, y + Math.sin(angle) * r2);
                    ctx.strokeStyle = '#00FFFF';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    // 箭头
                    const ax = x + Math.cos(angle) * r2;
                    const ay = y + Math.sin(angle) * r2;
                    ctx.beginPath();
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(ax - Math.cos(angle - 0.3) * 8, ay - Math.sin(angle - 0.3) * 8);
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(ax - Math.cos(angle + 0.3) * 8, ay - Math.sin(angle + 0.3) * 8);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;

                ctx.fillStyle = '#00FFFF';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔄', x, y);

            } else if (effect.type === 'frictionZone') {
                // 冰霜地带 - 霜冻结晶 + 冷气
                ctx.save();
                ctx.shadowColor = '#87CEFA';
                ctx.shadowBlur = 12;

                ctx.beginPath();
                ctx.arc(x, y, effect.radius, 0, Math.PI * 2);
                const grad = ctx.createRadialGradient(x, y, 0, x, y, effect.radius);
                grad.addColorStop(0, 'rgba(200,230,255,0.35)');
                grad.addColorStop(1, 'rgba(150,200,255,0.05)');
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.strokeStyle = 'rgba(150,200,255,0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();

                // 霜冻结晶
                const rng = _seededRandom(effect._seed || 54321);
                for (let i = 0; i < 5; i++) {
                    const cx = x + (rng() - 0.5) * effect.radius * 1.4;
                    const cy = y + (rng() - 0.5) * effect.radius * 1.4;
                    const d = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2);
                    if (d < effect.radius) {
                        this.drawFrostCrystal(ctx, cx, cy, 10 + rng() * 8, time + i, 0.5 + 0.2 * Math.sin(time + i));
                    }
                }

                // 冷气粒子
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2 + time * 0.2;
                    const r = effect.radius * 0.6 + Math.sin(time * 2 + i) * 10;
                    const px = x + Math.cos(angle) * r;
                    const py = y + Math.sin(angle) * r;
                    ctx.globalAlpha = 0.3;
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#B0E0FF';
                    ctx.fill();
                }
                ctx.globalAlpha = 1;

                ctx.fillStyle = '#87CEFA';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🧊', x, y);

            } else if (effect.type === 'dampingField') {
                // 阻尼场 - 减速波纹 + 黏稠质感
                ctx.save();
                ctx.shadowColor = '#50AA50';
                ctx.shadowBlur = 12;

                ctx.beginPath();
                ctx.arc(x, y, effect.radius, 0, Math.PI * 2);
                const grad = ctx.createRadialGradient(x, y, 0, x, y, effect.radius);
                grad.addColorStop(0, 'rgba(80,180,80,0.2)');
                grad.addColorStop(0.5, 'rgba(80,180,80,0.12)');
                grad.addColorStop(1, 'rgba(80,180,80,0)');
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.strokeStyle = 'rgba(80,180,80,0.6)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.restore();

                // 阻尼波纹 - 向内收缩
                for (let w = 0; w < 3; w++) {
                    const waveR = effect.radius * (1 - ((time * 0.3 + w * 0.33) % 1));
                    const waveAlpha = waveR / effect.radius;
                    ctx.beginPath();
                    ctx.arc(x, y, waveR, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(100,200,100,${waveAlpha * 0.35})`;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }

                // 黏稠粒子 - 缓慢移动
                const rng = _seededRandom(effect._seed || 99999);
                for (let i = 0; i < 8; i++) {
                    const angle = rng() * Math.PI * 2;
                    const r = rng() * effect.radius * 0.8;
                    const anim = (time * 0.2 + rng() * 5) % 3 / 3;
                    const px = x + Math.cos(angle + anim) * r;
                    const py = y + Math.sin(angle + anim) * r;
                    ctx.beginPath();
                    ctx.arc(px, py, 4 + Math.sin(time + i) * 2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(100,200,100,${0.3 + 0.1 * Math.sin(time + i)})`;
                    ctx.fill();
                }

                ctx.fillStyle = '#50AA50';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🛡️', x, y);

            } else if (effect.type === 'rigid_constraint' && players && players.length >= 2) {
                // 刚性连接 - 能量锁链 + 电弧
                const p1 = players[0], p2 = players[1];
                const x1 = this.centerX + p1.position.x;
                const y1 = this.centerY + p1.position.y;
                const x2 = this.centerX + p2.position.x;
                const y2 = this.centerY + p2.position.y;

                ctx.save();
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 10;

                // 能量锁链
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 4;
                ctx.setLineDash([10, 5]);
                ctx.lineDashOffset = time * 15;
                ctx.stroke();
                ctx.setLineDash([]);

                // 沿连线的流动粒子
                const dx = x2 - x1, dy = y2 - y1;
                const len = Math.sqrt(dx * dx + dy * dy);
                for (let i = 0; i < 6; i++) {
                    const t = ((time * 0.5 + i / 6) % 1);
                    const px = x1 + dx * t;
                    const py = y1 + dy * t;
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,215,0,${0.7 * Math.sin(t * Math.PI)})`;
                    ctx.fill();
                }

                // 电弧
                this.drawElectricArc(ctx, x1, y1, x2, y2, '#FFD700', 15, Math.floor(time * 8));

                // 连接点光晕
                ctx.beginPath();
                ctx.arc(x1, y1, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#FFD700';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x2, y2, 8, 0, Math.PI * 2);
                ctx.fill();

                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                ctx.font = '20px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔗', midX, midY);
                ctx.restore();

            } else if (effect.type === 'soft_rope' && players && players.length >= 2) {
                const p1 = players[0], p2 = players[1];
                const x1 = this.centerX + p1.position.x;
                const y1 = this.centerY + p1.position.y;
                const x2 = this.centerX + p2.position.x;
                const y2 = this.centerY + p2.position.y;

                const currentDist = Math.sqrt((p2.position.x - p1.position.x) ** 2 + (p2.position.y - p1.position.y) ** 2);
                const originalLength = effect.originalLength || 100;
                const isLocked = currentDist >= originalLength * 0.99;

                ctx.save();
                if (isLocked) {
                    // 锁定 - 蓝色拉伸绳 + 张力可视化
                    const stretch = Math.max(0, currentDist / originalLength - 1);
                    const tension = Math.min(1, stretch * 3);

                    ctx.shadowColor = `rgb(${Math.floor(135 + tension * 120)}, ${Math.floor(206 - tension * 100)}, ${Math.floor(235 - tension * 150)})`;
                    ctx.shadowBlur = 8 + tension * 10;

                    // 绘制带张力的绳子（微微弯曲）
                    const dx = x2 - x1, dy = y2 - y1;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const nx = -dy / len, ny = dx / len;
                    const sagAmp = Math.max(2, 15 * (1 - tension)) * Math.sin(time * 2);

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    const steps = 16;
                    for (let i = 1; i < steps; i++) {
                        const t = i / steps;
                        const sag = Math.sin(t * Math.PI) * sagAmp;
                        const px = x1 + dx * t + nx * sag;
                        const py = y1 + dy * t + ny * sag;
                        ctx.lineTo(px, py);
                    }
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = tension > 0.5
                        ? `rgb(${Math.floor(255)}, ${Math.floor(100 - tension * 60)}, ${Math.floor(100 - tension * 60)})`
                        : '#5BA3D9';
                    ctx.lineWidth = 4;
                    ctx.stroke();

                    // 张力越大，绳子越细的内芯线
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = `rgba(200,230,255,${0.3 + tension * 0.3})`;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // 张力标记点
                    if (tension > 0.3) {
                        for (let i = 0; i < 3; i++) {
                            const t = 0.3 + i * 0.2;
                            const px = x1 + dx * t;
                            const py = y1 + dy * t;
                            ctx.beginPath();
                            ctx.arc(px, py, 2 + tension * 2, 0, Math.PI * 2);
                            ctx.fillStyle = `rgba(255,${Math.floor(150 - tension * 100)},${Math.floor(150 - tension * 100)},${tension * 0.6})`;
                            ctx.fill();
                        }
                    }
                } else {
                    // 未锁定 - 柔性绳 + 弹性波动
                    ctx.shadowColor = '#87CEEB';
                    ctx.shadowBlur = 8;

                    // 绘制弹性曲线
                    const dx = x2 - x1, dy = y2 - y1;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const nx = -dy / len, ny = dx / len;
                    const waveAmp = 5 * Math.sin(time * 4);

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    const steps = 20;
                    for (let i = 1; i < steps; i++) {
                        const t = i / steps;
                        const wave = Math.sin(t * Math.PI * 3 + time * 3) * waveAmp * Math.sin(t * Math.PI);
                        const px = x1 + dx * t + nx * wave;
                        const py = y1 + dy * t + ny * wave;
                        ctx.lineTo(px, py);
                    }
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = '#87CEEB';
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    // 原长虚线圆
                    ctx.beginPath();
                    ctx.arc(x1, y1, originalLength, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(135,206,235,0.3)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 10]);
                    ctx.lineDashOffset = time * 5;
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // 连接点
                const pointColor = isLocked ? '#FFD700' : '#87CEEB';
                ctx.beginPath();
                ctx.arc(x1, y1, 8, 0, Math.PI * 2);
                ctx.fillStyle = pointColor;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x2, y2, 8, 0, Math.PI * 2);
                ctx.fill();

                const midX2 = (x1 + x2) / 2;
                const midY2 = (y1 + y2) / 2;
                ctx.font = isLocked ? '22px sans-serif' : '20px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(isLocked ? '🔗' : '🪢', midX2, midY2);
                ctx.restore();
            }

            ctx.restore();
        });
    }

    // ========== Temp Effects ==========

    drawTempEffects(tempEffects) {
        const now = Date.now();
        tempEffects.forEach(effect => {
            try {
            const ctx = this.ctx;
            // 备用进度计算：如果 effect 有 _startTime，用真实时间计算 progress
            // 防止 life 没正常递减导致特效卡住
            let progress;
            if (effect._startTime) {
                const elapsed = now - effect._startTime;
                progress = Math.max(0, 1 - elapsed / effect.maxLife);
            } else {
                progress = effect.life / effect.maxLife;
            }
            const t = Date.now() / 1000;
            ctx.save();

            if (effect.type === 'laser') {
                // 激光 - 闪烁 + 能量溢出
                const startX = this.centerX + effect.startX;
                const startY = this.centerY + effect.startY;
                const endX = this.centerX + effect.endX;
                const endY = this.centerY + effect.endY;

                const flicker = 0.85 + 0.15 * Math.sin(t * 60);

                // 外层发光
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = `rgba(255,0,0,${progress * 0.3 * flicker})`;
                ctx.lineWidth = 14;
                ctx.stroke();

                // 中层
                ctx.strokeStyle = `rgba(255,100,100,${progress * 0.6 * flicker})`;
                ctx.lineWidth = 7;
                ctx.stroke();

                // 核心亮线
                ctx.strokeStyle = `rgba(255,255,255,${progress * flicker})`;
                ctx.lineWidth = 2;
                ctx.stroke();

                // 起点发光
                ctx.beginPath();
                ctx.arc(startX, startY, 10 + (1 - progress) * 5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,100,50,${progress * 0.6})`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(startX, startY, 5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${progress})`;
                ctx.fill();

                // 终点爆炸
                const endR = 25 * (1 - progress);
                ctx.beginPath();
                ctx.arc(endX, endY, endR, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,165,0,${progress * 0.5})`;
                ctx.fill();
                ctx.strokeStyle = `rgba(255,69,0,${progress})`;
                ctx.lineWidth = 3;
                ctx.stroke();

                // 爆炸碎片粒子
                const seed = effect._seed || 42;
                const particles = _makeParticles(seed, 8, { minSpeed: 30, maxSpeed: 60, minSize: 1, maxSize: 3 });
                this.drawParticleBurst(ctx, endX, endY, particles, 1 - progress, 'rgba(255,200,50,A)', 1);

                // 触发屏幕震动
                if (progress > 0.9) triggerShake(3);

            } else if (effect.type === 'momentum_blast') {
                // 爆裂冲击 - 预生成粒子 + 冲击波
                const x = this.centerX + (effect.x || 0);
                const y = this.centerY + (effect.y || 0);
                const alpha = progress;

                // 核心闪光
                if (progress > 0.7) {
                    ctx.beginPath();
                    ctx.arc(x, y, 30 * (1 - progress), 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,255,200,${(progress - 0.7) * 3})`;
                    ctx.fill();
                }

                // 冲击波环
                const ringR = 50 * (1 - progress);
                ctx.beginPath();
                ctx.arc(x, y, ringR, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,165,0,${alpha * 0.4})`;
                ctx.fill();
                ctx.strokeStyle = `rgba(255,69,0,${alpha})`;
                ctx.lineWidth = 4;
                ctx.stroke();

                // 预生成粒子
                const seed = effect._seed || 42;
                const particles = _makeParticles(seed, 12, { minSpeed: 40, maxSpeed: 80, minSize: 2, maxSize: 5 });
                this.drawParticleBurst(ctx, x, y, particles, 1 - progress, 'rgba(255,220,50,A)', 1);

                if (progress > 0.9) triggerShake(5);

            } else if (effect.type === 'quantum') {
                // 量子特效 - 波函数坍缩
                const x = this.centerX + (effect.x || 0);
                const y = this.centerY + (effect.y || 0);
                const alpha = progress;

                // 紫色能量波
                ctx.beginPath();
                ctx.arc(x, y, 40 * (1 - progress * 0.5), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(148,0,211,${alpha * 0.8})`;
                ctx.lineWidth = 3;
                ctx.shadowColor = '#9400D3';
                ctx.shadowBlur = 15;
                ctx.stroke();

                // 内层能量
                ctx.beginPath();
                ctx.arc(x, y, 20 * progress, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(186,85,211,${alpha * 0.5})`;
                ctx.fill();

                // 预生成粒子
                const seed = effect._seed || 7777;
                const particles = _makeParticles(seed, 16, { minSpeed: 20, maxSpeed: 50, minSize: 2, maxSize: 5, hueShift: 60 });
                this.drawParticleBurst(ctx, x, y, particles, 1 - progress, 'rgba(200,100,255,A)', 1);

                // |ψ⟩ 符号
                if (progress > 0.3) {
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = '#BA55D3';
                    ctx.font = 'bold 16px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('|ψ⟩', x, y);
                }

            } else if (effect.type === 'heat_engine_blast') {
                try {
                // 🔥 热机超级爆炸 - 全屏闪光 + 多层冲击波 + 大量粒子
                const x = this.centerX + (effect.x || 0);
                const y = this.centerY + (effect.y || 0);
                const alpha = progress;
                const seed = effect._seed || 8888;

                // 0. 全屏闪光（爆炸瞬间）
                if (progress > 0.85) {
                    const flashAlpha = (progress - 0.85) / 0.15 * 0.35;
                    ctx.fillStyle = `rgba(255,200,100,${flashAlpha})`;
                    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                }

                // 1. 超大核心白光
                const coreR = 80 * Math.max(0, 1 - progress * 0.5);
                const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
                coreGrad.addColorStop(0, `rgba(255,255,255,${alpha})`);
                coreGrad.addColorStop(0.2, `rgba(255,220,120,${alpha * 0.9})`);
                coreGrad.addColorStop(0.5, `rgba(255,120,0,${alpha * 0.5})`);
                coreGrad.addColorStop(1, 'rgba(255,50,0,0)');
                ctx.beginPath();
                ctx.arc(x, y, coreR, 0, Math.PI * 2);
                ctx.fillStyle = coreGrad;
                ctx.fill();

                // 2. 多层冲击波环（6层）
                for (let wave = 0; wave < 6; wave++) {
                    const waveR = 30 + wave * 35 + (1 - progress) * 120;
                    const waveA = alpha * (1 - wave * 0.15);
                    const waveW = 10 - wave * 1.2;
                    ctx.beginPath();
                    ctx.arc(x, y, waveR, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(255,${Math.max(0, 180 - wave * 30)},0,${waveA})`;
                    ctx.lineWidth = Math.max(1, waveW);
                    ctx.stroke();
                }

                // 3. 旋转火焰环
                ctx.save();
                ctx.globalAlpha = alpha * 0.5;
                for (let ring = 0; ring < 2; ring++) {
                    const ringR = 50 + ring * 30 + (1 - progress) * 60;
                    const ringAlpha = alpha * (0.4 - ring * 0.15);
                    this.drawEnergyRing(ctx, x, y, ringR, time * (4 + ring * 2), `rgba(255,${150 - ring * 50},0,${ringAlpha})`, 3);
                }
                ctx.restore();

                // 4. 大量火焰粒子（60个）
                const fireParticles = _makeParticles(seed, 60, { minSpeed: 80, maxSpeed: 300, minSize: 3, maxSize: 10 });
                fireParticles.forEach(p => {
                    const dist = p.speed * (1 - progress * progress);
                    const px = x + Math.cos(p.angle + progress * 0.4) * dist;
                    const py = y + Math.sin(p.angle + progress * 0.4) * dist;
                    const sz = p.size * (0.3 + progress * 0.7);
                    const hue = p.hueShift;
                    const g = Math.floor(150 + hue * 105);
                    const b = Math.floor(hue * 80);
                    ctx.beginPath();
                    ctx.arc(px, py, sz, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,${g},${b},${alpha * 0.85})`;
                    ctx.fill();
                });

                // 5. 高速火花粒子（30个）
                const sparkParticles = _makeParticles(seed + 1, 30, { minSpeed: 200, maxSpeed: 500, minSize: 1, maxSize: 3 });
                sparkParticles.forEach(p => {
                    const dist = p.speed * (1 - progress);
                    const px = x + Math.cos(p.angle + progress * 0.6) * dist;
                    const py = y + Math.sin(p.angle + progress * 0.6) * dist;
                    ctx.beginPath();
                    ctx.arc(px, py, p.size * progress, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,255,200,${alpha * 0.9})`;
                    ctx.fill();
                });

                // 6. 烟雾粒子（向上升腾）
                const smokeParticles = _makeParticles(seed + 2, 15, { minSpeed: 10, maxSpeed: 40, minSize: 8, maxSize: 20 });
                smokeParticles.forEach(p => {
                    const dist = p.speed * (1 - progress);
                    const rise = (1 - progress) * 80;
                    const px = x + Math.cos(p.angle) * dist * 0.5;
                    const py = y - rise + Math.sin(p.angle) * dist * 0.3;
                    const sz = p.size * (1 + (1 - progress) * 1.5);
                    ctx.beginPath();
                    ctx.arc(px, py, sz, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(80,80,80,${alpha * 0.25})`;
                    ctx.fill();
                });

                // 7. 地面灼烧 + 熔岩裂纹
                if (progress > 0.4) {
                    const burnR = 120 * progress;
                    const burnGrad = ctx.createRadialGradient(x, y, 0, x, y, burnR);
                    burnGrad.addColorStop(0, `rgba(150,30,0,${(progress - 0.4) * 0.6})`);
                    burnGrad.addColorStop(0.5, `rgba(80,0,0,${(progress - 0.4) * 0.3})`);
                    burnGrad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.beginPath();
                    ctx.arc(x, y, burnR, 0, Math.PI * 2);
                    ctx.fillStyle = burnGrad;
                    ctx.fill();

                    // 熔岩裂纹
                    ctx.globalAlpha = (progress - 0.4) * 0.7;
                    const rng = _seededRandom(seed + 3);
                    for (let i = 0; i < 8; i++) {
                        const angle = rng() * Math.PI * 2;
                        const len = 20 + rng() * 60;
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
                        ctx.strokeStyle = `rgba(255,${80 + rng() * 100},0,0.6)`;
                        ctx.lineWidth = 1 + rng() * 2;
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                }

                // 强烈屏幕震动
                if (progress > 0.9) triggerShake(15);

                } catch (e) { console.error('heat_engine_blast render error:', e); }
            } else if (effect.type === 'ice_reset') {
                // ❄️ 冰冻重置 - 冰爆 + 冰晶扩散
                const x = this.centerX + (effect.x || 0);
                const y = this.centerY + (effect.y || 0);
                const alpha = progress;

                // 核心冰蓝闪光
                if (progress > 0.7) {
                    const flashR = 40 * (1 - progress);
                    ctx.beginPath();
                    ctx.arc(x, y, flashR, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(150,220,255,${(progress - 0.7) * 3})`;
                    ctx.fill();
                }

                // 冰冻冲击波
                const waveR = 60 * (1 - progress);
                ctx.beginPath();
                ctx.arc(x, y, waveR, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(100,200,255,${alpha * 0.7})`;
                ctx.lineWidth = 4;
                ctx.shadowColor = '#87CEFA';
                ctx.shadowBlur = 12;
                ctx.stroke();

                // 第二层波纹
                const wave2R = 40 * (1 - progress);
                ctx.beginPath();
                ctx.arc(x, y, wave2R, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(200,230,255,${alpha * 0.5})`;
                ctx.lineWidth = 3;
                ctx.stroke();

                // 预生成冰晶粒子
                const seed = effect._seed || 3333;
                const particles = _makeParticles(seed, 10, { minSpeed: 30, maxSpeed: 70, minSize: 3, maxSize: 7 });
                particles.forEach(p => {
                    const dist = p.speed * (1 - progress);
                    const px = x + Math.cos(p.angle + progress * 0.2) * dist;
                    const py = y + Math.sin(p.angle + progress * 0.2) * dist;
                    // 每个粒子画一个小冰晶
                    ctx.save();
                    ctx.translate(px, py);
                    ctx.rotate(p.angle + progress * 2);
                    const sz = p.size * (0.5 + progress * 0.5);
                    ctx.strokeStyle = `rgba(180,220,255,${alpha * 0.8})`;
                    ctx.lineWidth = 1.5;
                    for (let j = 0; j < 6; j++) {
                        const a = (j / 6) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(Math.cos(a) * sz, Math.sin(a) * sz);
                        ctx.stroke();
                    }
                    ctx.restore();
                });

                if (progress > 0.9) triggerShake(4);

            } else if (effect.type === 'heat_engine') {
                // ⚡ 热机激活 - 能量汇聚
                const x = this.centerX + (effect.x || 0);
                const y = this.centerY + (effect.y || 0);
                const alpha = progress;

                // 能量汇聚环
                for (let i = 0; i < 3; i++) {
                    const ringR = 20 + i * 15 + (1 - progress) * 30;
                    ctx.beginPath();
                    ctx.arc(x, y, ringR, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(255,${150 + i * 30},0,${alpha * (0.8 - i * 0.2)})`;
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#FF8800';
                    ctx.shadowBlur = 10;
                    ctx.stroke();
                }

                // 中心火焰
                ctx.beginPath();
                ctx.arc(x, y, 15 * progress, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,200,0,${alpha * 0.6})`;
                ctx.fill();

                // 火花粒子
                const seed = effect._seed || 5555;
                const particles = _makeParticles(seed, 12, { minSpeed: 20, maxSpeed: 50, minSize: 1, maxSize: 3 });
                this.drawParticleBurst(ctx, x, y, particles, 1 - progress, 'rgba(255,180,50,A)', 1);

            } else if (effect.type === 'charge_apply') {
                // ⚡ 电荷附加 - 电弧爆发
                const x = this.centerX + (effect.x || 0);
                const y = this.centerY + (effect.y || 0);
                const alpha = progress;
                const color = effect.charge > 0 ? '#FFFF00' : '#00BFFF';

                // 电弧爆发
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2 + t * 3;
                    const len = 30 * (1 - progress);
                    this.drawElectricArc(ctx, x, y,
                        x + Math.cos(angle) * len,
                        y + Math.sin(angle) * len,
                        color, 10, (i + 1) * 3571 + Math.floor(t * 10)
                    );
                }

                // 中心闪光
                ctx.beginPath();
                ctx.arc(x, y, 20 * (1 - progress), 0, Math.PI * 2);
                ctx.fillStyle = color.replace(')', `,${alpha * 0.3})`).replace('rgb', 'rgba');
                ctx.fill();

                if (progress > 0.9) triggerShake(2);

            } else if (effect.type === 'dash_trail') {
                // 💨 冲刺残影
                const x = this.centerX + (effect.x || 0);
                const y = this.centerY + (effect.y || 0);
                const alpha = progress;

                // 残影圆
                for (let i = 0; i < 5; i++) {
                    const r = 15 + i * 5;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.15 * (1 - i * 0.15)})`;
                    ctx.fill();
                }

                // 速度线
                const angle = effect.angle || 0;
                for (let i = 0; i < 8; i++) {
                    const spread = (i / 7 - 0.5) * 1.2;
                    const lineAngle = angle + Math.PI + spread;
                    const len = 30 + i * 5;
                    const off = 10 * Math.sin(t * 10 + i);
                    ctx.beginPath();
                    ctx.moveTo(x + Math.cos(lineAngle) * 10, y + Math.sin(lineAngle) * 10);
                    ctx.lineTo(x + Math.cos(lineAngle) * len, y + Math.sin(lineAngle) * len);
                    ctx.strokeStyle = `rgba(200,220,255,${alpha * 0.4})`;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

            } else if (effect.type === 'mass_change') {
                // 质量变化 - 压缩/膨胀波
                const x = this.centerX + (effect.x || 0);
                const y = this.centerY + (effect.y || 0);
                const alpha = progress;
                const isIncrease = effect.massMultiplier > 1;
                const color = isIncrease ? '#FF6666' : '#66FF66';

                // 向外扩散环
                for (let w = 0; w < 3; w++) {
                    const waveR = 25 + w * 15 + (1 - progress) * 40;
                    ctx.beginPath();
                    ctx.arc(x, y, waveR, 0, Math.PI * 2);
                    ctx.strokeStyle = color.replace(')', `,${alpha * (0.6 - w * 0.15)})`).replace('#', 'rgba(').replace(/([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/, (m, r, g, b) =>
                        `${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)}`
                    );
                    // 简化：用颜色+alpha
                    ctx.strokeStyle = isIncrease ? `rgba(255,100,100,${alpha * (0.6 - w * 0.15)})` : `rgba(100,255,100,${alpha * (0.6 - w * 0.15)})`;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }

                // 中心标记
                ctx.fillStyle = isIncrease ? '#FF6666' : '#66FF66';
                ctx.font = 'bold 16px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.globalAlpha = alpha;
                ctx.fillText(isIncrease ? '▲' : '▼', x, y);

            } else if (effect.type === 'charge_transfer') {
                // 电荷转移 - 能量流
                const startX = this.centerX + (effect.startX || 0);
                const startY = this.centerY + (effect.startY || 0);
                const endX = this.centerX + (effect.endX || 0);
                const endY = this.centerY + (effect.endY || 0);
                const alpha = progress;

                // 能量流线
                const dx = endX - startX, dy = endY - startY;
                const len = Math.sqrt(dx * dx + dy * dy);
                const nx = -dy / len, ny = dx / len;

                for (let i = 0; i < 8; i++) {
                    const tt = ((1 - progress) * 0.8 + i / 8 * 0.2);
                    const wave = Math.sin(tt * Math.PI * 4 + t * 5) * 5;
                    const px = startX + dx * tt + nx * wave;
                    const py = startY + dy * tt + ny * wave;
                    ctx.beginPath();
                    ctx.arc(px, py, 3 * alpha, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,215,0,${alpha * 0.8})`;
                    ctx.fill();
                }

                // 起点和终点光晕
                ctx.beginPath();
                ctx.arc(startX, startY, 8 * alpha, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,215,0,${alpha * 0.5})`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(endX, endY, 8 * alpha, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
            } catch (e) { console.error('Temp effect render error:', e); }
        });
    }

    // ========== Aiming Line ==========

    drawAimingLine(player, target, gameState = null) {
        if (!player || !target) return;
        const ctx = this.ctx;
        const startX = this.centerX + player.position.x;
        const startY = this.centerY + player.position.y;
        const endX = this.centerX + target.x;
        const endY = this.centerY + target.y;
        const t = Date.now() / 1000;

        let isValid = true;
        if (gameState && gameState.arenaRadius) {
            const targetDist = Math.sqrt(target.x ** 2 + target.y ** 2);
            let maxAllowedRadius = gameState.arenaRadius;
            isValid = targetDist <= maxAllowedRadius;
        }

        ctx.save();

        // 瞄准线 - 动画虚线
        ctx.setLineDash([10, 5]);
        ctx.lineDashOffset = -t * 20;
        ctx.strokeStyle = isValid ? '#FFD700' : '#FF0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 目标点
        ctx.beginPath();
        ctx.arc(endX, endY, 15 + Math.sin(t * 4) * 3, 0, Math.PI * 2);
        ctx.fillStyle = isValid ? 'rgba(255,215,0,0.3)' : 'rgba(255,0,0,0.3)';
        ctx.fill();
        ctx.strokeStyle = isValid ? '#FFD700' : '#FF0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();

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
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
            ctx.fillStyle = `rgba(255,0,0,${intensity * 0.3 * pulse})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    // ========== Main Render ==========

    render(gameState, aimingTarget = null, currentPlayerPhysics = null) {
        this.clear();

        // Screen shake
        const ctx = this.ctx;
        if (_shakeIntensity > 0) {
            const elapsed = Date.now() - _shakeStart;
            if (elapsed < _shakeDuration) {
                const decay = 1 - elapsed / _shakeDuration;
                const sx = (Math.random() - 0.5) * _shakeIntensity * decay * 2;
                const sy = (Math.random() - 0.5) * _shakeIntensity * decay * 2;
                ctx.save();
                ctx.translate(sx, sy);
            } else {
                _shakeIntensity = 0;
            }
        }

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

        // End screen shake
        if (_shakeIntensity > 0) {
            ctx.restore();
        }
    }
}
