const GameUI = {
    game: null,
    lastTime: 0,

    init() {
        console.log('=== Game Initializing ===');
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('Canvas not found');
            return;
        }
        
        this.game = new Game(canvas);
        console.log('Game instance created');
        
        this.setupEventListeners();
        console.log('Event listeners set up');
        
        this.game.initGame();
        console.log('Game initialized');
        
        this.updateUI();
        
        // 初始化后，先处理玩家一的弃牌检查
        this.handleCurrentPhase();
        
        this.gameLoop();
        console.log('Game loop started');
    },

    setupEventListeners() {
        document.getElementById('end-turn-btn').addEventListener('click', () => {
            console.log('End turn button clicked');
            if (this.game.aimingState.active) {
                this.game.cancelAim();
                this.updateUI();
            } else {
                this.endTurn();
            }
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.game.restart();
            document.getElementById('game-over-modal').classList.add('hidden');
            this.updateUI();
            this.handleCurrentPhase();
        });

        document.getElementById('cards-hand').addEventListener('click', (e) => {
            console.log('Cards area clicked');
            if (this.game.aimingState.active) return;
            if (this.game.turnPhase !== 'play') return; // 只能在出牌阶段出牌
            const card = e.target.closest('.card');
            if (card && !card.classList.contains('disabled')) {
                const index = parseInt(card.dataset.index);
                const currentPlayer = this.game.players[this.game.currentPlayerIndex];
                console.log('Playing card index:', index, 'for player:', currentPlayer);
                const result = this.game.playCard(currentPlayer.id, index);
                if (result === 'aiming') {
                    this.updateUI();
                } else if (result) {
                    this.updateUI();
                }
            }
        });

        const canvas = document.getElementById('game-canvas');
        canvas.addEventListener('click', (e) => {
            if (this.game.aimingState.active) {
                const rect = canvas.getBoundingClientRect();
                const scaleX = 800 / rect.width;
                const scaleY = 600 / rect.height;
                const x = (e.clientX - rect.left) * scaleX - 400;
                const y = (e.clientY - rect.top) * scaleY - 300;
                this.game.confirmAim(x, y);
                this.updateUI();
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (this.game.aimingState.active) {
                const rect = canvas.getBoundingClientRect();
                const scaleX = 800 / rect.width;
                const scaleY = 600 / rect.height;
                this.aimingTarget = {
                    x: (e.clientX - rect.left) * scaleX - 400,
                    y: (e.clientY - rect.top) * scaleY - 300
                };
            } else {
                this.aimingTarget = null;
            }
        });
        
        document.getElementById('cards-hand').addEventListener('mouseover', (e) => {
            const cardEl = e.target.closest('.card');
            if (cardEl) {
                const index = parseInt(cardEl.dataset.index);
                const currentPlayer = this.game.players[this.game.currentPlayerIndex];
                if (currentPlayer && currentPlayer.cards[index]) {
                    this.previewCard(currentPlayer.cards[index]);
                }
            }
        });
        
        document.getElementById('cards-hand').addEventListener('mouseout', () => {
            this.updateCardParamsPanel();
        });

        document.getElementById('confirm-discard-btn').addEventListener('click', () => {
            if (this.game.confirmDiscard()) {
                document.getElementById('discard-modal').classList.add('hidden');
                // 弃牌完成，进入下一阶段
                this.game.advanceGamePhase();
                if (this.game.isNewRound) {
                    this.game.drawCardsForAllPlayers();
                }
                this.updateUI();
                this.handleCurrentPhase();
            }
        });
    },

    // 处理当前阶段
    handleCurrentPhase() {
        if (this.game.turnPhase === 'discard') {
            // 弃牌阶段，检查是否需要弃牌
            const needDiscard = this.game.checkNeedDiscard(this.game.currentPlayerIndex);
            if (needDiscard > 0) {
                this.game.startDiscardPhase(this.game.currentPlayerIndex, needDiscard, 'phaseDiscard');
                this.showDiscardModal();
                return;
            } else {
                // 不需要弃牌，直接进入出牌阶段
                this.game.advanceGamePhase();
                this.updateUI();
            }
        }
    },

    updateUI() {
        console.log('=== Updating UI ===');
        this.updateEnergyBars();
        this.updateHand();
        this.updateTurnIndicator();
        this.updatePhysicsParamsPanel();
        this.updateCardParamsPanel();
        
        const endTurnBtn = document.getElementById('end-turn-btn');
        if (this.game.aimingState.active) {
            endTurnBtn.textContent = '取消瞄准';
        } else {
            endTurnBtn.textContent = '结束回合';
        }
        console.log('UI updated');
    },
    
    updatePhysicsParamsPanel() {
        const state = this.game.getState();
        if (!state.physicsPlayers) return;
        
        state.physicsPlayers.forEach((player) => {
            const prefix = `p${player.playerId}`;
            
            const posEl = document.getElementById(`${prefix}-position`);
            if (posEl) {
                posEl.textContent = `(${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)})`;
            }
            
            const velEl = document.getElementById(`${prefix}-velocity`);
            if (velEl) {
                velEl.textContent = `(${player.velocity.x.toFixed(1)}, ${player.velocity.y.toFixed(1)})`;
            }
            
            const massEl = document.getElementById(`${prefix}-mass`);
            if (massEl) {
                massEl.textContent = `${player.mass.toFixed(1)} kg`;
            }
            
            const distEl = document.getElementById(`${prefix}-distance`);
            if (distEl) {
                const distance = Math.sqrt(player.position.x ** 2 + player.position.y ** 2);
                distEl.textContent = distance.toFixed(1);
            }
        });
        
        this.updateArenaParamsPanel();
    },
    
    updateArenaParamsPanel() {
        const state = this.game.getState();
        const effects = this.game.physics.effects || [];
        
        let arenaStatus = '正常';
        let arenaEffectsText = '无';
        let currentFriction = PLAYER_CONFIG.FRICTION;
        
        const terrainEffects = effects.filter(e => e.type === 'oilZone' || e.type === 'iceSurface' || e.type === 'gravityField' || e.type === 'repulsionField');
        
        if (terrainEffects.length > 0) {
            const effectNames = terrainEffects.map(e => {
                switch(e.type) {
                    case 'oilZone': return '润滑油地带';
                    case 'iceSurface': return '冰面';
                    case 'gravityField': return '引力场';
                    case 'repulsionField': return '排斥力场';
                    default: return e.type;
                }
            });
            arenaEffectsText = effectNames.join(', ');
            arenaStatus = '有特效';
            
            const frictionEffects = terrainEffects.filter(e => e.friction !== undefined);
            if (frictionEffects.length > 0) {
                currentFriction = Math.min(...frictionEffects.map(e => e.friction));
            }
        }
        
        const statusEl = document.getElementById('arena-status');
        const frictionEl = document.getElementById('arena-friction');
        const effectsEl = document.getElementById('arena-effects');
        
        if (statusEl) statusEl.textContent = arenaStatus;
        if (frictionEl) frictionEl.textContent = currentFriction.toFixed(2);
        if (effectsEl) effectsEl.textContent = arenaEffectsText;
    },
    
    updateCardParamsPanel() {
        const state = this.game.getState();
        const card = state.lastPlayedCard;
        
        const nameEl = document.getElementById('current-card-name');
        const typeEl = document.getElementById('current-card-type');
        const formulaEl = document.getElementById('current-card-formula');
        const effectEl = document.getElementById('current-card-effect');
        
        if (card) {
            if (nameEl) nameEl.textContent = card.icon + ' ' + card.name;
            if (typeEl) typeEl.textContent = this.getCardTypeName(card.type);
            if (formulaEl) formulaEl.textContent = card.formula || '-';
            if (effectEl) effectEl.textContent = card.description;
        } else {
            if (nameEl) nameEl.textContent = '-';
            if (typeEl) typeEl.textContent = '-';
            if (formulaEl) formulaEl.textContent = '-';
            if (effectEl) effectEl.textContent = '请使用卡片查看效果';
        }
    },
    
    getCardTypeName(type) {
        const typeNames = {
            'attack': '攻击',
            'defense': '防御',
            'terrain': '地形',
            'movement': '移动',
            'utility': '辅助'
        };
        return typeNames[type] || type;
    },

    endTurn() {
        console.log('Ending turn...');
        
        if (this.game.turnPhase === 'discard') {
            // 已经在弃牌阶段的话，直接处理
            this.handleCurrentPhase();
        } else {
            // 出牌阶段结束，前进
            this.game.advanceGamePhase();
            
            if (this.game.isNewRound) {
                this.game.drawCardsForAllPlayers();
            }
            
            this.updateUI();
            this.handleCurrentPhase();
        }
    },
    
    previewCard(card) {
        const nameEl = document.getElementById('current-card-name');
        const typeEl = document.getElementById('current-card-type');
        const formulaEl = document.getElementById('current-card-formula');
        const effectEl = document.getElementById('current-card-effect');
        
        if (nameEl) nameEl.textContent = card.icon + ' ' + card.name;
        if (typeEl) typeEl.textContent = this.getCardTypeName(card.type);
        if (formulaEl) formulaEl.textContent = card.formula || '-';
        if (effectEl) effectEl.textContent = card.description;
    },

    updateEnergyBars() {
        this.game.players.forEach((player, index) => {
            const statusEl = document.getElementById(`player${index + 1}-status`);
            if (statusEl) {
                const fillEl = statusEl.querySelector('.energy-fill');
                const textEl = statusEl.querySelector('.energy-text');
                if (fillEl) {
                    fillEl.style.width = `${(player.energy / GAME_CONFIG.MAX_ENERGY) * 100}%`;
                }
                if (textEl) {
                    textEl.textContent = `${player.energy} / ${GAME_CONFIG.MAX_ENERGY}`;
                }
            }
        });
    },

    updateHand() {
        console.log('Updating hand display...');
        const container = document.getElementById('cards-hand');
        if (!container) {
            console.error('cards-hand element not found!');
            return;
        }
        
        container.innerHTML = '';
        console.log('Cleared container');

        const currentPlayer = this.game.players[this.game.currentPlayerIndex];
        console.log('Current player index:', this.game.currentPlayerIndex);
        console.log('Current player:', currentPlayer);
        
        if (!currentPlayer || currentPlayer.eliminated) {
            console.log('Player eliminated or not found');
            return;
        }

        console.log('Number of cards:', currentPlayer.cards.length);
        
        if (currentPlayer.cards.length === 0) {
            container.innerHTML = '<div style="color: white; padding: 10px;">没有手牌</div>';
            return;
        }

        currentPlayer.cards.forEach((card, index) => {
            console.log('Rendering card', index, card.name);
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.dataset.index = index;
            if (currentPlayer.energy < card.cost || this.game.turnPhase !== 'play') {
                cardEl.classList.add('disabled');
            }
            cardEl.innerHTML = `
                <span class="card-cost">${card.cost}</span>
                <span class="card-icon">${card.icon}</span>
                <span class="card-name">${card.name}</span>
            `;
            container.appendChild(cardEl);
        });
        
        console.log('Cards rendered:', container.children.length);
    },

    updateTurnIndicator() {
        const indicator = document.getElementById('turn-indicator');
        const currentPlayerId = this.game.players[this.game.currentPlayerIndex]?.id;
        const phaseText = this.game.turnPhase === 'discard' ? '弃牌阶段' : '出牌阶段';
        if (indicator) {
            indicator.textContent = `回合 ${this.game.currentTurn} - 玩家 ${currentPlayerId} - ${phaseText}`;
        }
        
        this.game.players.forEach((player, index) => {
            const statusEl = document.getElementById(`player${index + 1}-status`);
            if (statusEl) {
                if (index === this.game.currentPlayerIndex) {
                    statusEl.classList.add('current-turn');
                } else {
                    statusEl.classList.remove('current-turn');
                }
            }
        });
    },

    showGameOver(winner) {
        const modal = document.getElementById('game-over-modal');
        const winnerText = document.getElementById('winner-text');
        if (modal && winnerText) {
            if (winner.id === 0) {
                winnerText.textContent = '平局!';
            } else {
                winnerText.textContent = `玩家 ${winner.id} 获胜!`;
            }
            modal.classList.remove('hidden');
        }
    },

    showDiscardModal() {
        const modal = document.getElementById('discard-modal');
        const title = document.getElementById('discard-title');
        const requiredSpan = document.getElementById('discard-required');
        const player = this.game.players[this.game.discardState.playerIndex];
        
        title.textContent = `玩家 ${player.id}：请选择要弃掉的牌`;
        requiredSpan.textContent = this.game.discardState.requiredDiscards;
        
        this.updateDiscardModal();
        modal.classList.remove('hidden');
    },

    updateDiscardModal() {
        const container = document.getElementById('discard-cards-area');
        const selectedCountSpan = document.getElementById('discard-selected-count');
        const confirmBtn = document.getElementById('confirm-discard-btn');
        const player = this.game.players[this.game.discardState.playerIndex];
        
        container.innerHTML = '';
        selectedCountSpan.textContent = this.game.discardState.selectedIndices.length;
        confirmBtn.disabled = this.game.discardState.selectedIndices.length !== this.game.discardState.requiredDiscards;
        
        player.cards.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            if (this.game.discardState.selectedIndices.includes(index)) {
                cardEl.classList.add('selected');
            }
            
            cardEl.innerHTML = `
                <span class="card-cost">${card.cost}</span>
                <span class="card-icon">${card.icon}</span>
                <span class="card-name">${card.name}</span>
            `;
            
            cardEl.addEventListener('click', () => {
                this.game.toggleDiscardSelection(index);
                this.updateDiscardModal();
            });
            
            container.appendChild(cardEl);
        });
    },

    gameLoop(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.game.update(deltaTime || 16.67);
        
        const state = this.game.getState();
        const currentPlayerPhysics = state.physicsPlayers.find(p => 
            p.playerId === this.game.players[this.game.currentPlayerIndex].id
        );
        this.game.render(state, this.aimingTarget, currentPlayerPhysics);
        
        this.updatePhysicsParamsPanel();

        if (this.game.state === GAME_STATES.GAME_OVER) {
            const alive = this.game.players.filter(p => !p.eliminated);
            if (alive.length === 1 || alive.length === 0) {
                this.showGameOver(alive[0] || { id: 0 });
            }
        }

        requestAnimationFrame((time) => this.gameLoop(time));
    }
};

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    GameUI.init();
});
