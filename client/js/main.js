const GameUI = {
    game: null,
    lastTime: 0,
    gameStarted: false,

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

        this.showModeSelect();
        console.log('Mode select shown');
    },

    showModeSelect() {
        const modal = document.getElementById('mode-select-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    startGame(mode) {
        const modal = document.getElementById('mode-select-modal');
        if (modal) {
            modal.classList.add('hidden');
        }

        this.game.initGame(mode);
        console.log('Game initialized with mode:', mode);

        const p2Name = document.querySelector('#player2-status .player-name');
        if (p2Name) {
            p2Name.textContent = mode === 'pve' ? 'AI 对手' : '玩家 2';
        }

        const p2Avatar = document.querySelector('#player2-status .player-avatar');
        if (p2Avatar) {
            p2Avatar.textContent = mode === 'pve' ? 'AI' : 'P2';
        }

        this.gameStarted = true;
        this.updateUI();
        this.handleCurrentPhase();
        this.gameLoop();
        console.log('Game loop started');
    },

    setupEventListeners() {
        document.getElementById('mode-pvp-btn').addEventListener('click', () => {
            this.startGame('pvp');
        });

        document.getElementById('mode-pve-btn').addEventListener('click', () => {
            this.startGame('pve');
        });

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
            document.getElementById('game-over-modal').classList.add('hidden');
            this.showModeSelect();
        });

        document.getElementById('back-to-menu-btn').addEventListener('click', () => {
            document.getElementById('game-over-modal').classList.add('hidden');
            this.showModeSelect();
        });

        document.getElementById('cards-hand').addEventListener('click', (e) => {
            console.log('Cards area clicked');
            if (this.game.isAITurn()) return;
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

        // 触摸事件支持（平板瞄准）
        canvas.addEventListener('touchmove', (e) => {
            if (this.game.aimingState.active) {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                const scaleX = 800 / rect.width;
                const scaleY = 600 / rect.height;
                this.aimingTarget = {
                    x: (touch.clientX - rect.left) * scaleX - 400,
                    y: (touch.clientY - rect.top) * scaleY - 300
                };
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            if (this.game.aimingState.active && this.aimingTarget) {
                e.preventDefault();
                this.game.confirmAim(this.aimingTarget.x, this.aimingTarget.y);
                this.aimingTarget = null;
                this.updateUI();
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
        if (!this.gameStarted) return;

        if (this.game.isAITurn()) {
            this.triggerAITurn();
            return;
        }

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

    async triggerAITurn() {
        if (!this.game.aiPlayer || this.game.aiPlayer.isThinking) return;

        this.updateUI();

        await this.game.aiPlayer.playTurn(this.game.players[1].id);

        if (this.game.isNewRound) {
            this.game.drawCardsForAllPlayers();
        }

        this.updateUI();
        this.handleCurrentPhase();
    },

    updateUI() {
        console.log('========== updateUI() 开始 ==========');
        this.updateEnergyBars();
        this.updateHand();
        this.updateTurnIndicator();
        this.updatePlayerEffects();
        this.updatePhysicsParamsPanel();
        this.updateCardParamsPanel();

        const endTurnBtn = document.getElementById('end-turn-btn');
        const cardsHand = document.getElementById('cards-hand');
        const aiThinking = document.getElementById('ai-thinking');

        if (this.game.isAITurn()) {
            endTurnBtn.disabled = true;
            endTurnBtn.textContent = 'AI 回合中...';
            if (cardsHand) cardsHand.style.display = 'none';
            if (aiThinking) aiThinking.style.display = 'flex';
        } else {
            endTurnBtn.disabled = false;
            if (cardsHand) cardsHand.style.display = 'flex';
            if (aiThinking) aiThinking.style.display = 'none';

            if (this.game.aimingState.active) {
                endTurnBtn.textContent = '取消瞄准';
            } else {
                endTurnBtn.textContent = '完成出牌';
            }
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
                posEl.className = 'param-value position';
            }

            const velEl = document.getElementById(`${prefix}-velocity`);
            if (velEl) {
                velEl.textContent = `(${player.velocity.x.toFixed(1)}, ${player.velocity.y.toFixed(1)})`;
                velEl.className = 'param-value velocity';
            }

            const massEl = document.getElementById(`${prefix}-mass`);
            if (massEl) {
                massEl.textContent = `${player.mass.toFixed(1)} kg`;
                massEl.className = 'param-value mass';
            }

            const distEl = document.getElementById(`${prefix}-distance`);
            if (distEl) {
                const distance = Math.sqrt(player.position.x ** 2 + player.position.y ** 2);
                distEl.textContent = distance.toFixed(1);
                distEl.className = 'param-value distance';
            }
        });

        // 更新热机显示
        this.updateHeatEngineDisplay();

        this.updateArenaParamsPanel();
    },
    
    // 更新热机显示
    updateHeatEngineDisplay() {
        const self = this;
        
        this.game.players.forEach((player) => {
            const displayEl = document.getElementById(`player${player.id}-heat-engine`);
            if (!displayEl) return;
            
            if (player.heatEngine && player.heatEngine.active) {
                const chargePercent = (player.heatEngine.charge / player.heatEngine.maxCharge) * 100;
                const isCurrentPlayer = this.game.currentPlayerIndex === player.id - 1;
                const canCharge = isCurrentPlayer && 
                                  player.energy >= 1 && 
                                  player.heatEngine.charge < player.heatEngine.maxCharge;
                const canFire = isCurrentPlayer &&
                                player.heatEngine.charge >= 1;
                
                // 检查是否需要创建新的热机容器，或者只更新现有内容
                let container = displayEl.querySelector('.heat-engine-container');
                if (!container) {
                    // 清空容器
                    displayEl.innerHTML = '';
                    
                    // 创建热机容器
                    container = document.createElement('div');
                    container.className = 'heat-engine-container';
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
                    progressFill.className = 'heat-engine-progress';
                    progressFill.style.cssText = `background: linear-gradient(90deg, #FF6B35, #FFA500, #FFFF00); width: ${chargePercent}%; height: 100%; transition: width 0.3s;`;
                    progressBg.appendChild(progressFill);
                    progressRow.appendChild(progressBg);
                    
                    const chargeText = document.createElement('span');
                    chargeText.className = 'heat-engine-charge-text';
                    chargeText.style.cssText = 'color: #FFA500; font-size: 12px; white-space: nowrap;';
                    chargeText.textContent = `${player.heatEngine.charge}/${player.heatEngine.maxCharge}`;
                    progressRow.appendChild(chargeText);
                    container.appendChild(progressRow);
                    
                    // 剩余回合
                    const durationText = document.createElement('div');
                    durationText.className = 'heat-engine-duration';
                    durationText.style.cssText = 'font-size: 11px; color: #aaa; margin-bottom: 8px;';
                    durationText.textContent = `剩余回合: ${player.heatEngine.duration}`;
                    container.appendChild(durationText);
                    
                    // 充能按钮
                    const chargeBtn = document.createElement('button');
                    chargeBtn.className = 'heat-engine-charge-btn';
                    chargeBtn.style.cssText = 'width: 100%; padding: 6px 12px; background: linear-gradient(135deg, #FF6B35, #FF4500); border: none; border-radius: 6px; color: white; font-weight: bold; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s; display: none;';
                    chargeBtn.textContent = '⚡ 充能 (-1能量)';
                    chargeBtn.dataset.playerId = player.id;
                    chargeBtn.addEventListener('click', (e) => {
                        const pid = parseInt(e.target.dataset.playerId);
                        console.log('充能按钮被点击，玩家ID:', pid);
                        self.chargeHeatEngine(pid);
                    });
                    chargeBtn.addEventListener('mouseover', (e) => {
                        if (!e.target.disabled) {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 0 15px rgba(255, 107, 53, 0.6)';
                        }
                    });
                    chargeBtn.addEventListener('mouseout', (e) => {
                        e.target.style.transform = 'scale(1)';
                        e.target.style.boxShadow = 'none';
                    });
                    container.appendChild(chargeBtn);
                    
                    // 发射按钮
                    const fireBtn = document.createElement('button');
                    fireBtn.className = 'heat-engine-fire-btn';
                    fireBtn.style.cssText = 'width: 100%; padding: 6px 12px; background: linear-gradient(135deg, #FFD700, #FF8C00); border: none; border-radius: 6px; color: white; font-weight: bold; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s; display: none;';
                    fireBtn.textContent = '🔥 发射！';
                    fireBtn.dataset.playerId = player.id;
                    fireBtn.addEventListener('click', (e) => {
                        const pid = parseInt(e.target.dataset.playerId);
                        console.log('发射按钮被点击，玩家ID:', pid);
                        self.fireHeatEngine(pid);
                    });
                    fireBtn.addEventListener('mouseover', (e) => {
                        if (!e.target.disabled) {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.8)';
                        }
                    });
                    fireBtn.addEventListener('mouseout', (e) => {
                        e.target.style.transform = 'scale(1)';
                        e.target.style.boxShadow = 'none';
                    });
                    container.appendChild(fireBtn);
                    
                    displayEl.appendChild(container);
                }
                
                // 更新现有内容
                const progressFill = container.querySelector('.heat-engine-progress');
                const chargeText = container.querySelector('.heat-engine-charge-text');
                const durationText = container.querySelector('.heat-engine-duration');
                const chargeBtn = container.querySelector('.heat-engine-charge-btn');
                const fireBtn = container.querySelector('.heat-engine-fire-btn');
                
                if (progressFill) {
                    progressFill.style.width = `${chargePercent}%`;
                }
                if (chargeText) {
                    chargeText.textContent = `${player.heatEngine.charge}/${player.heatEngine.maxCharge}`;
                }
                if (durationText) {
                    durationText.textContent = `剩余回合: ${player.heatEngine.duration}`;
                }
                if (chargeBtn) {
                    if (canCharge) {
                        chargeBtn.style.display = 'block';
                        chargeBtn.disabled = false;
                        chargeBtn.style.opacity = '1';
                    } else {
                        chargeBtn.style.display = 'none';
                    }
                }
                if (fireBtn) {
                    if (canFire) {
                        fireBtn.style.display = 'block';
                        fireBtn.disabled = false;
                        fireBtn.style.opacity = '1';
                    } else {
                        fireBtn.style.display = 'none';
                    }
                }
            } else {
                displayEl.innerHTML = '';
            }
        });
    },
    
    // 手动充能热机
    chargeHeatEngine(playerId) {
        const player = this.game.players.find(p => p.id === playerId);
        
        if (!player || !player.heatEngine || !player.heatEngine.active) return;
        if (player.energy < 1 || player.heatEngine.charge >= player.heatEngine.maxCharge) return;
        
        player.energy -= 1;
        player.heatEngine.charge += 1;
        
        this.updateUI();
    },

    // 手动发射热机
    fireHeatEngine(playerId) {
        const success = this.game.fireHeatEngine(playerId);
        if (success) {
            this.updateUI();
        }
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
            if (typeEl) {
                typeEl.textContent = this.getCardTypeName(card.type);
                typeEl.dataset.type = card.type;
            }
            if (formulaEl) formulaEl.textContent = card.formula || '-';
            if (effectEl) effectEl.textContent = card.description;
        } else {
            if (nameEl) nameEl.textContent = '-';
            if (typeEl) {
                typeEl.textContent = '-';
                typeEl.dataset.type = '';
            }
            if (formulaEl) formulaEl.textContent = '-';
            if (effectEl) effectEl.textContent = '请使用卡片查看效果';
        }
    },
    
    getCardTypeName(type) {
        const typeNames = {
            'force': '力',
            'electric': '电',
            'heat': '热',
            'light': '光',
            'melee': '近'
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
        if (typeEl) {
            typeEl.textContent = this.getCardTypeName(card.type);
            typeEl.dataset.type = card.type;
        }
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
            cardEl.dataset.type = card.type;
            cardEl.dataset.rarity = card.rarity;
            cardEl.dataset.cost = card.cost;
            const noCharge = card.id === 'electromagnetic_cannon' && (!currentPlayer.charge || currentPlayer.charge === 0);
            if (currentPlayer.energy < card.cost || this.game.turnPhase !== 'play' || noCharge) {
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
        const phaseEl = document.getElementById('game-phase');
        const currentPlayerId = this.game.players[this.game.currentPlayerIndex]?.id;
        const phaseText = this.game.turnPhase === 'discard' ? '弃牌阶段' : '出牌阶段';

        let playerLabel = `玩家 ${currentPlayerId}`;
        if (this.game.gameMode === 'pve' && currentPlayerId === 2) {
            playerLabel = 'AI';
        }

        if (indicator) {
            indicator.textContent = this.game.currentTurn;
        }
        if (phaseEl) {
            phaseEl.textContent = `${playerLabel} - ${phaseText}`;
            phaseEl.classList.toggle('active', this.game.turnPhase === 'play');
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

    updatePlayerEffects() {
        this.game.players.forEach((player, index) => {
            const effectsEl = document.getElementById(`player${index + 1}-effects`);
            if (!effectsEl) return;

            let badges = '';

            // 质量效果
            if (player.effects) {
                const massEffect = player.effects.find(e => e.type === 'massChange');
                if (massEffect) {
                    const isHeavy = massEffect.multiplier > 1;
                    badges += `<span class="effect-badge ${isHeavy ? 'mass-up' : 'mass-down'}">${isHeavy ? '▲' : '▼'} ${massEffect.multiplier}x</span>`;
                }

                // 定位锚
                const anchorEffect = player.effects.find(e => e.type === 'anchor');
                if (anchorEffect) {
                    badges += `<span class="effect-badge anchor">⚓ 锚定</span>`;
                }
            }

            // 护盾
            if (this.game.shields && this.game.shields[player.id]) {
                badges += `<span class="effect-badge shield">🛡️ 护盾</span>`;
            }

            // 电荷
            if (player.charge !== 0) {
                const isPos = player.charge > 0;
                badges += `<span class="effect-badge ${isPos ? 'charge-pos' : 'charge-neg'}">${isPos ? '+' : ''}${player.charge} ⚡</span>`;
            }

            effectsEl.innerHTML = badges;

            // 更新质量显示
            const massEl = document.getElementById(`p${index + 1}-mass-hud`);
            if (massEl) {
                const physicsPlayer = this.game.physics.getPlayer(player.id);
                const mass = physicsPlayer ? Math.round(physicsPlayer.mass) : 70;
                massEl.textContent = `${mass} kg`;
            }
        });
    },

    showGameOver(winner) {
        const modal = document.getElementById('game-over-modal');
        const winnerText = document.getElementById('winner-text');
        if (modal && winnerText) {
            if (winner.id === 0) {
                winnerText.textContent = '平局!';
            } else if (this.game.gameMode === 'pve' && winner.id === 2) {
                winnerText.textContent = 'AI 获胜!';
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
            cardEl.dataset.type = card.type;
            cardEl.dataset.rarity = card.rarity;
            cardEl.dataset.cost = card.cost;
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
        try {
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
        } catch (e) {
            console.error('Game loop error:', e);
        }
        // finally 确保无论是否出错，游戏循环都不会中断
        requestAnimationFrame((time) => this.gameLoop(time));
    }
};

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    GameUI.init();
});
