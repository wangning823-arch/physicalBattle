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
        // 保存GameUI引用到window，供测试函数使用
        window.gameUI = this;
        
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
        console.log('========== updateUI() 开始 ==========');
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
        console.log('========== updateUI() 完成 ==========');
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
        
        // 更新热机显示
        this.updateHeatEngineDisplay();
        
        this.updateArenaParamsPanel();
    },
    
    // 更新热机显示
    updateHeatEngineDisplay() {
        console.log('>>> updateHeatEngineDisplay() 被调用');
        const self = this;
        
        this.game.players.forEach((player) => {
            console.log(`  检查玩家 ${player.id}:`, player);
            const displayEl = document.getElementById(`player${player.id}-heat-engine`);
            console.log(`  displayElement found:`, !!displayEl);
            if (!displayEl) return;
            
            if (player.heatEngine && player.heatEngine.active) {
                const chargePercent = (player.heatEngine.charge / player.heatEngine.maxCharge) * 100;
                const isCurrentPlayer = this.game.currentPlayerIndex === player.id - 1;
                const canCharge = isCurrentPlayer && 
                                  this.game.turnPhase === 'play' && 
                                  player.energy >= 1 && 
                                  player.heatEngine.charge < player.heatEngine.maxCharge;
                
                // 清空容器
                displayEl.innerHTML = '';
                
                // 创建热机容器
                const container = document.createElement('div');
                container.style.cssText = 'margin-top: 8px; padding: 8px; background: linear-gradient(135deg, #1a0a00, #2a1500); border-radius: 8px; border: 2px solid #FF6B35;';
                
                // 标题
                const title = document.createElement('div');
                title.style.cssText = 'font-weight: bold; color: #FF6B35; font-size: 14px; margin-bottom: 6px;';
                title.textContent = '⚙️🔥 热机';
                container.appendChild(title);
                
                // 进度条区域
                const progressRow = document.createElement('div');
                progressRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';
                
                const progressBg = document.createElement('div');
                progressBg.style.cssText = 'flex-grow: 1; background: #333; border-radius: 4px; overflow: hidden; height: 12px;';
                
                const progressFill = document.createElement('div');
                progressFill.style.cssText = `background: linear-gradient(90deg, #FF6B35, #FFA500, #FFFF00); width: ${chargePercent}%; height: 100%; transition: width 0.3s;`;
                progressBg.appendChild(progressFill);
                progressRow.appendChild(progressBg);
                
                const chargeText = document.createElement('span');
                chargeText.style.cssText = 'color: #FFA500; font-size: 12px; white-space: nowrap;';
                chargeText.textContent = `${player.heatEngine.charge}/${player.heatEngine.maxCharge}`;
                progressRow.appendChild(chargeText);
                container.appendChild(progressRow);
                
                // 剩余回合
                const durationText = document.createElement('div');
                durationText.style.cssText = 'font-size: 11px; color: #aaa; margin-bottom: 8px;';
                durationText.textContent = `剩余回合: ${player.heatEngine.duration}`;
                container.appendChild(durationText);
                
                // 充能按钮
                if (canCharge) {
                    const btn = document.createElement('button');
                    btn.style.cssText = 'width: 100%; padding: 6px 12px; background: linear-gradient(135deg, #FF6B35, #FF4500); border: none; border-radius: 6px; color: white; font-weight: bold; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;';
                    btn.textContent = '⚡ 充能 (-1能量)';
                    btn.addEventListener('click', () => {
                        console.log('充能按钮被点击，玩家ID:', player.id);
                        self.chargeHeatEngine(player.id);
                    });
                    btn.addEventListener('mouseover', () => {
                        btn.style.transform = 'scale(1.05)';
                        btn.style.boxShadow = '0 0 15px rgba(255, 107, 53, 0.6)';
                    });
                    btn.addEventListener('mouseout', () => {
                        btn.style.transform = 'scale(1)';
                        btn.style.boxShadow = 'none';
                    });
                    container.appendChild(btn);
                }
                
                displayEl.appendChild(container);
            } else {
                displayEl.innerHTML = '';
            }
        });
    },
    
    // 手动充能热机
    chargeHeatEngine(playerId) {
        console.log('=== 尝试充能热机 ===');
        console.log('玩家ID:', playerId);
        
        const player = this.game.players.find(p => p.id === playerId);
        console.log('找到玩家:', player);
        
        if (!player) {
            console.log('未找到玩家');
            return;
        }
        if (!player.heatEngine) {
            console.log('玩家没有热机');
            return;
        }
        if (!player.heatEngine.active) {
            console.log('热机未激活');
            return;
        }
        if (player.energy < 1) {
            console.log('能量不足:', player.energy);
            return;
        }
        if (player.heatEngine.charge >= player.heatEngine.maxCharge) {
            console.log('已充满:', player.heatEngine.charge, '/', player.heatEngine.maxCharge);
            return;
        }
        
        console.log('充能前:', player.heatEngine.charge, '能量:', player.energy);
        player.energy -= 1;
        player.heatEngine.charge += 1;
        console.log('充能后:', player.heatEngine.charge, '能量:', player.energy);
        
        this.updateUI();
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

// 全局测试函数
window.testHeatEngine = function() {
    console.log('========================================');
    console.log('=== 测试按钮被点击 ===');
    
    if (!window.gameUI) {
        console.log('❌ window.gameUI 不存在!');
        return;
    }
    
    console.log('window.gameUI:', window.gameUI);
    console.log('window.gameUI.game:', window.gameUI.game);
    
    const game = window.gameUI.game;
    console.log('game.players:', game.players);
    console.log('game.currentPlayerIndex:', game.currentPlayerIndex);
    
    const currentPlayer = game.players[game.currentPlayerIndex];
    console.log('currentPlayer:', currentPlayer);
    
    if (currentPlayer) {
        console.log('currentPlayer.heatEngine (before):', currentPlayer.heatEngine);
        
        if (!currentPlayer.heatEngine || !currentPlayer.heatEngine.active) {
            console.log('>>> 激活热机...');
            currentPlayer.heatEngine = {
                active: true,
                charge: 0,
                maxCharge: 4,
                duration: 2,
                impulseMultiplier: 3,
                ownerId: currentPlayer.id
            };
            console.log('热机已激活:', currentPlayer.heatEngine);
        } else {
            console.log('>>> 充能热机...');
            console.log('能量:', currentPlayer.energy, '充能:', currentPlayer.heatEngine.charge);
            if (currentPlayer.energy >= 1 && currentPlayer.heatEngine.charge < 4) {
                currentPlayer.energy -= 1;
                currentPlayer.heatEngine.charge += 1;
                console.log('✅ 充能成功!');
                console.log('充能后 charge:', currentPlayer.heatEngine.charge, '能量:', currentPlayer.energy);
            } else {
                console.log('❌ 不能充能 - 能量不足或已满');
            }
        }
        
        console.log('currentPlayer.heatEngine (after):', currentPlayer.heatEngine);
        console.log('>>> 调用 updateUI()');
        window.gameUI.updateUI();
        console.log('>>> updateUI() 完成');
    } else {
        console.log('❌ 找不到当前玩家!');
    }
    console.log('========================================');
};
