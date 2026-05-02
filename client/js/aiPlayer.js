class AIPlayer {
    constructor(game) {
        this.game = game;
        this.isThinking = false;
        this.thinkingDelay = 800;
        this.cardPlayDelay = 500;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async playTurn(playerId) {
        if (this.isThinking) return;
        this.isThinking = true;

        await this.delay(this.thinkingDelay);

        let cardsPlayed = 0;
        const maxCardsPerTurn = 3;

        while (cardsPlayed < maxCardsPerTurn) {
            const player = this.game.players.find(p => p.id === playerId);
            if (!player || player.eliminated) break;

            const decision = this.chooseCard(playerId);
            if (!decision) break;

            if (decision.needDiscard) {
                this.autoDiscard(playerId);
                await this.delay(300);
                continue;
            }

            if (decision.needsAim) {
                const target = this.chooseAimTarget(decision.card, playerId);
                if (target) {
                    this.game.playCard(playerId, decision.cardIndex);
                    this.game.confirmAim(target.x, target.y);
                    cardsPlayed++;
                    await this.delay(this.cardPlayDelay);
                } else {
                    break;
                }
            } else {
                const result = this.game.playCard(playerId, decision.cardIndex);
                if (result === 'end_turn') {
                    break;
                }
                cardsPlayed++;
                await this.delay(this.cardPlayDelay);
            }
        }

        this.isThinking = false;

        this.game.advanceGamePhase();
        if (this.game.isNewRound) {
            this.game.drawCardsForAllPlayers();
        }
    }

    chooseCard(playerId) {
        const player = this.game.players.find(p => p.id === playerId);
        if (!player || player.eliminated) return null;

        const needDiscard = this.game.checkNeedDiscard(this.game.currentPlayerIndex);
        if (needDiscard > 0) {
            return { needDiscard: true };
        }

        if (this.game.turnPhase !== 'play') return null;

        const playableCards = player.cards
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => {
                if (player.energy < card.cost) return false;
                if (card.id === 'electromagnetic_cannon' && (!player.charge || player.charge === 0)) return false;
                return true;
            });

        if (playableCards.length === 0) return null;

        const scored = playableCards.map(({ card, index }) => ({
            card,
            cardIndex: index,
            score: this.scoreCard(card, playerId)
        }));

        scored.sort((a, b) => b.score - a.score);

        const topScore = scored[0].score;
        const candidates = scored.filter(s => s.score >= topScore * 0.7);
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];

        return {
            card: chosen.card,
            cardIndex: chosen.cardIndex,
            needsAim: chosen.card.effect.needsAim || false
        };
    }

    scoreCard(card, playerId) {
        const player = this.game.players.find(p => p.id === playerId);
        const targetId = playerId === 1 ? 2 : 1;
        const targetPlayer = this.game.players.find(p => p.id === targetId);
        const selfPhysics = this.game.physics.getPlayer(playerId);
        const targetPhysics = this.game.physics.getPlayer(targetId);

        let score = 50;

        const distance = selfPhysics && targetPhysics
            ? Math.sqrt(
                (selfPhysics.position.x - targetPhysics.position.x) ** 2 +
                (selfPhysics.position.y - targetPhysics.position.y) ** 2
            )
            : 300;

        const distFromCenter = selfPhysics
            ? Math.sqrt(selfPhysics.position.x ** 2 + selfPhysics.position.y ** 2)
            : 0;

        const isNearEdge = distFromCenter > GAME_CONFIG.ARENA_RADIUS * 0.65;

        switch (card.id) {
            case 'momentum_blast':
                score = isNearEdge ? 30 : 75;
                if (distance < 200) score += 20;
                break;
            case 'explosive_charge':
                score = isNearEdge ? 25 : 85;
                if (distance < 200) score += 20;
                break;
            case 'directional_dash':
                if (isNearEdge) {
                    score = 90;
                } else if (distance > 250) {
                    score = 70;
                } else {
                    score = 40;
                }
                break;
            case 'brownian_motion':
                score = isNearEdge ? 60 : 35;
                break;
            case 'anchor':
                score = isNearEdge ? 85 : 20;
                break;
            case 'repulsion_field':
                score = isNearEdge ? 70 : 55;
                if (distance < 150) score += 15;
                break;
            case 'damping_field':
                score = 50;
                if (distance < 200) score += 10;
                break;
            case 'gravity_well':
                score = 55;
                break;
            case 'rigid_connection':
                score = 45;
                break;
            case 'soft_rope':
                score = 45;
                break;
            case 'ice_zone':
                score = 55;
                if (targetPlayer && targetPlayer.heatEngine && targetPlayer.heatEngine.active) {
                    score = 80;
                }
                break;
            case 'charge_attach':
            case 'charge_attach_negative':
                score = 60;
                if (targetPlayer && targetPlayer.charge === 0) score += 10;
                break;
            case 'self_charge':
            case 'self_charge_negative':
                score = player.charge === 0 ? 65 : 25;
                break;
            case 'electromagnetic_cannon':
                score = (player.charge && player.charge !== 0) ? 80 : 0;
                break;
            case 'heat_engine':
                score = player.heatEngine && player.heatEngine.active ? 10 : 70;
                break;
            case 'mass_energy':
                score = 60;
                if (player.energy < 3) score += 15;
                break;
            case 'mass_increase':
                score = isNearEdge ? 25 : 45;
                break;
            case 'mass_decrease':
                score = isNearEdge ? 65 : 40;
                break;
            case 'momentum_conservation':
                score = 50;
                if (isNearEdge) score += 10;
                break;
            case 'radiation':
                score = 65;
                if (targetPlayer && targetPlayer.cards.length > 3) score += 10;
                break;
            case 'quantum_superposition':
                score = isNearEdge ? 75 : 40;
                break;
            case 'magnetic_field':
                score = 55;
                // 有电荷的敌人在场时更有价值
                if (targetPlayer && targetPlayer.charge !== 0) score += 20;
                // 自己带电时风险较高
                if (player.charge !== 0) score -= 10;
                break;
            default:
                score = 40;
        }

        score += (Math.random() - 0.5) * 15;

        return score;
    }

    chooseAimTarget(card, playerId) {
        const selfPhysics = this.game.physics.getPlayer(playerId);
        const targetId = playerId === 1 ? 2 : 1;
        const targetPhysics = this.game.physics.getPlayer(targetId);

        if (!selfPhysics) return null;

        const toTarget = targetPhysics ? {
            x: targetPhysics.position.x - selfPhysics.position.x,
            y: targetPhysics.position.y - selfPhysics.position.y
        } : { x: 100, y: 0 };

        const toTargetDist = Math.sqrt(toTarget.x ** 2 + toTarget.y ** 2);
        const toTargetDir = toTargetDist > 0
            ? { x: toTarget.x / toTargetDist, y: toTarget.y / toTargetDist }
            : { x: 1, y: 0 };

        const awayFromTarget = { x: -toTargetDir.x, y: -toTargetDir.y };

        const distFromCenter = Math.sqrt(selfPhysics.position.x ** 2 + selfPhysics.position.y ** 2);
        const toCenter = distFromCenter > 0
            ? { x: -selfPhysics.position.x / distFromCenter, y: -selfPhysics.position.y / distFromCenter }
            : { x: 0, y: 0 };

        switch (card.id) {
            case 'momentum_blast':
            case 'explosive_charge': {
                const spread = (Math.random() - 0.5) * 0.3;
                const cos = Math.cos(spread);
                const sin = Math.sin(spread);
                return {
                    x: selfPhysics.position.x + (toTargetDir.x * cos - toTargetDir.y * sin) * 300,
                    y: selfPhysics.position.y + (toTargetDir.x * sin + toTargetDir.y * cos) * 300
                };
            }

            case 'directional_dash': {
                const distFromCenter2 = Math.sqrt(selfPhysics.position.x ** 2 + selfPhysics.position.y ** 2);
                if (distFromCenter2 > GAME_CONFIG.ARENA_RADIUS * 0.55) {
                    return {
                        x: selfPhysics.position.x + toCenter.x * 200,
                        y: selfPhysics.position.y + toCenter.y * 200
                    };
                }
                const perpX = -toTargetDir.y;
                const perpY = toTargetDir.x;
                const side = Math.random() > 0.5 ? 1 : -1;
                return {
                    x: selfPhysics.position.x + (toTargetDir.x * 0.5 + perpX * side * 0.5) * 200,
                    y: selfPhysics.position.y + (toTargetDir.y * 0.5 + perpY * side * 0.5) * 200
                };
            }

            case 'gravity_well': {
                const offsetX = (Math.random() - 0.5) * 100;
                const offsetY = (Math.random() - 0.5) * 100;
                const gx = targetPhysics
                    ? targetPhysics.position.x + offsetX
                    : selfPhysics.position.x + toTargetDir.x * 150;
                const gy = targetPhysics
                    ? targetPhysics.position.y + offsetY
                    : selfPhysics.position.y + toTargetDir.y * 150;
                const gDist = Math.sqrt(gx * gx + gy * gy);
                const maxR = GAME_CONFIG.ARENA_RADIUS - (card.effect.radius || 0);
                if (gDist > maxR) {
                    const scale = maxR / gDist;
                    return { x: gx * scale, y: gy * scale };
                }
                return { x: gx, y: gy };
            }

            case 'damping_field': {
                const dx = targetPhysics
                    ? targetPhysics.position.x + (Math.random() - 0.5) * 60
                    : selfPhysics.position.x + toTargetDir.x * 120;
                const dy = targetPhysics
                    ? targetPhysics.position.y + (Math.random() - 0.5) * 60
                    : selfPhysics.position.y + toTargetDir.y * 120;
                const dDist = Math.sqrt(dx * dx + dy * dy);
                const dMaxR = GAME_CONFIG.ARENA_RADIUS - (card.effect.radius || 0);
                if (dDist > dMaxR) {
                    const scale = dMaxR / dDist;
                    return { x: dx * scale, y: dy * scale };
                }
                return { x: dx, y: dy };
            }

            case 'ice_zone': {
                const ix = targetPhysics
                    ? targetPhysics.position.x + (Math.random() - 0.5) * 40
                    : selfPhysics.position.x + toTargetDir.x * 100;
                const iy = targetPhysics
                    ? targetPhysics.position.y + (Math.random() - 0.5) * 40
                    : selfPhysics.position.y + toTargetDir.y * 100;
                const iDist = Math.sqrt(ix * ix + iy * iy);
                const iMaxR = GAME_CONFIG.ARENA_RADIUS - (card.effect.radius || 0);
                if (iDist > iMaxR) {
                    const scale = iMaxR / iDist;
                    return { x: ix * scale, y: iy * scale };
                }
                return { x: ix, y: iy };
            }

            case 'electromagnetic_cannon': {
                const spread = (Math.random() - 0.5) * 0.2;
                const cos = Math.cos(spread);
                const sin = Math.sin(spread);
                return {
                    x: selfPhysics.position.x + (toTargetDir.x * cos - toTargetDir.y * sin) * 400,
                    y: selfPhysics.position.y + (toTargetDir.x * sin + toTargetDir.y * cos) * 400
                };
            }

            default:
                return {
                    x: selfPhysics.position.x + toTargetDir.x * 150,
                    y: selfPhysics.position.y + toTargetDir.y * 150
                };
        }
    }

    autoDiscard(playerId) {
        const player = this.game.players.find(p => p.id === playerId);
        if (!player) return;

        const needDiscard = this.game.checkNeedDiscard(this.game.currentPlayerIndex);
        if (needDiscard <= 0) return;

        this.game.startDiscardPhase(this.game.currentPlayerIndex, needDiscard, 'phaseDiscard');

        const sortedCards = player.cards
            .map((card, index) => ({ card, index }))
            .sort((a, b) => {
                const priority = { common: 0, rare: 1, epic: 2 };
                return (priority[a.card.rarity] || 0) - (priority[b.card.rarity] || 0)
                    || a.card.cost - b.card.cost;
            });

        for (let i = 0; i < needDiscard && i < sortedCards.length; i++) {
            this.game.toggleDiscardSelection(sortedCards[i].index);
        }

        this.game.confirmDiscard();
    }
}
