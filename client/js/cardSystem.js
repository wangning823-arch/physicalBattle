const CARDS_DATABASE = [
    {
        id: 'momentum_blast',
        name: '动量冲击',
        type: CARD_TYPES.ATTACK,
        cost: 1,
        icon: '💥',
        description: '向指定方向对敌人施加冲量',
        formula: 'J = Δp = m·Δv',
        effect: { impulse: 180, needsAim: true, targetEnemy: true },
        rarity: 'common'
    },
    {
        id: 'directional_dash',
        name: '定向冲刺',
        type: CARD_TYPES.MOVEMENT,
        cost: 1,
        icon: '💨',
        description: '向指定方向冲刺',
        formula: 'v = v₀ + at',
        effect: { impulse: 200, needsAim: true },
        rarity: 'common'
    },
    {
        id: 'gravity_well',
        name: '引力陷阱',
        type: CARD_TYPES.TERRAIN,
        cost: 2,
        icon: '🌀',
        description: '在指定位置放置引力源，持续3回合',
        formula: 'F = G·M/r²',
        effect: { duration: 3, radius: 150, strength: 200, needsAim: true, placeAnywhere: true },
        rarity: 'rare'
    },
    {
        id: 'repulsion_field',
        name: '排斥力场',
        type: CARD_TYPES.DEFENSE,
        cost: 2,
        icon: '🔄',
        description: '自身周围产生持续排斥力，持续2回合',
        formula: 'F ∝ 1/r²',
        effect: { duration: 2, radius: 120, strength: 600 },
        rarity: 'rare'
    },
            {
                id: 'ice_zone',
                name: '冰霜地带',
                type: CARD_TYPES.TERRAIN,
                cost: 1,
                icon: '🧊',
                description: '指定区域摩擦系数大幅降低，持续1回合',
                formula: 'μ → 0.03',
                effect: { duration: 1, friction: 0.03, radius: 80, needsAim: true, placeAnywhere: true },
                rarity: 'common'
            },
            {
                id: 'mass_increase',
                name: '惯性增强',
                type: CARD_TYPES.UTILITY,
                cost: 1,
                icon: '🏋️',
                description: '自身质量变为3倍，持续2回合',
                formula: 'F = ma',
                effect: { multiplier: 3, duration: 2 },
                rarity: 'common'
            },
            {
                id: 'mass_decrease',
                name: '惯性减弱',
                type: CARD_TYPES.UTILITY,
                cost: 1,
                icon: '🪶',
                description: '自身质量变为0.3倍，持续2回合',
                formula: 'a = F/m',
                effect: { multiplier: 0.3, duration: 2 },
                rarity: 'common'
            },
    {
        id: 'explosive_charge',
        name: '爆裂冲击',
        type: CARD_TYPES.ATTACK,
        cost: 3,
        icon: '💣',
        description: '强力冲量攻击，将敌人推远',
        formula: 'E = ½mv²',
        effect: { impulse: 350, needsAim: true, targetEnemy: true },
        rarity: 'epic'
    },
    {
        id: 'anchor',
        name: '定位锚',
        type: CARD_TYPES.DEFENSE,
        cost: 2,
        icon: '⚓',
        description: '固定自身位置1回合，免疫位移',
        formula: 'v = 0',
        effect: { duration: 1, anchored: true },
        rarity: 'rare'
    },
            {
                id: 'vacuum_zone',
                name: '真空区域',
                type: CARD_TYPES.TERRAIN,
                cost: 1,
                icon: '🌫️',
                description: '区域空气阻力降为0，滑行更远，持续1回合',
                formula: 'F_drag = 0',
                effect: { duration: 1, airFriction: 0, radius: 100, needsAim: true, placeAnywhere: true },
                rarity: 'common'
            },
    {
        id: 'rigid_connection',
        name: '刚性连接',
        type: CARD_TYPES.UTILITY,
        cost: 2,
        icon: '🔗',
        description: '将你与对手刚性连接，距离保持不变，持续2回合',
        formula: 'd = const',
        effect: { duration: 2, type: 'rigid_constraint' },
        rarity: 'rare'
    },
    {
        id: 'soft_rope',
        name: '软绳约束',
        type: CARD_TYPES.UTILITY,
        cost: 1,
        icon: '🪢',
        description: '用软绳连接你与对手，距离可自由变化但超过原长时立即锁定，持续3回合',
        formula: 'F = 0 (d ≤ d₀); d = d₀ (d > d₀)',
        effect: { duration: 3, type: 'soft_rope' },
        rarity: 'rare'
    },
    {
        id: 'damping_field',
        name: '阻尼领域',
        type: CARD_TYPES.DEFENSE,
        cost: 2,
        icon: '🛡️',
        description: '在指定位置放置阻尼领域，区域内运动快速衰减，持续2回合',
        formula: "v' = v·e^(-γt)",
        effect: { duration: 2, radius: 120, type: 'dampingField', needsAim: true, placeAnywhere: true },
        rarity: 'rare'
    },
    {
        id: 'charge_attach',
        name: '正电荷附着',
        type: CARD_TYPES.ATTACK,
        cost: 1,
        icon: '⚛️',
        description: '给敌人附着一个正电荷，持续2回合',
        formula: 'F = k·q₁·q₂/r²',
        effect: { duration: 2, charge: 1, needsAim: false, targetEnemy: true },
        rarity: 'common'
    },
    {
        id: 'charge_attach_negative',
        name: '负电荷附着',
        type: CARD_TYPES.ATTACK,
        cost: 1,
        icon: '⚫',
        description: '给敌人附着一个负电荷，持续2回合',
        formula: 'F = k·q₁·q₂/r²',
        effect: { duration: 2, charge: -1, needsAim: false, targetEnemy: true },
        rarity: 'common'
    },
    {
        id: 'self_charge',
        name: '自身带正电',
        type: CARD_TYPES.UTILITY,
        cost: 1,
        icon: '⚡',
        description: '给自己附着一个正电荷，持续2回合',
        formula: 'F = k·q₁·q₂/r²',
        effect: { duration: 2, charge: 1 },
        rarity: 'common'
    },
    {
        id: 'self_charge_negative',
        name: '自身带负电',
        type: CARD_TYPES.UTILITY,
        cost: 1,
        icon: '🔋',
        description: '给自己附着一个负电荷，持续2回合',
        formula: 'F = k·q₁·q₂/r²',
        effect: { duration: 2, charge: -1 },
        rarity: 'common'
    },
    {
        id: 'quantum_superposition',
        name: '量子叠加',
        type: CARD_TYPES.DEFENSE,
        cost: 4,
        icon: '👻',
        description: '进入量子叠加态：隐身，本回合无法出牌，对手回合免疫一切，下回合随机位置坍缩',
        formula: '|ψ⟩ = α|alive⟩ + β|hidden⟩',
        effect: { superposition: true },
        rarity: 'epic'
    },
    {
        id: 'heat_engine',
        name: '热机',
        type: CARD_TYPES.UTILITY,
        cost: 4,
        icon: '⚙️🔥',
        description: '召唤热机附身，2回合内可充能4点触发3倍动量冲击的强力冲量，被冰冻则能量归零',
        formula: 'W = Q·η',
        effect: { heatEngine: true, duration: 2, maxCharge: 4, impulseMultiplier: 3 },
        rarity: 'epic'
    }
];

class CardSystem {
    constructor() {
        this.deck = [];
        this.discardPile = [];
        this.initDeck();
    }

    initDeck() {
        // 构建基础牌组
        this.deck = [];
        for (let i = 0; i < 3; i++) {
            this.deck.push(...CARDS_DATABASE);
        }
        // 动量冲击添加额外副本，提高30%抽中概率
        const momentumBlast = CARDS_DATABASE.find(c => c.id === 'momentum_blast');
        this.deck.push(momentumBlast);
        
        // 定位锚减少副本，降低30%抽中概率
        const anchorCard = CARDS_DATABASE.find(c => c.id === 'anchor');
        for (let i = this.deck.length - 1; i >= 0; i--) {
            if (this.deck[i].id === 'anchor') {
                this.deck.splice(i, 1);
                break;
            }
        }
        
        // 量子叠加减少副本为原来一半
        const quantumCard = CARDS_DATABASE.find(c => c.id === 'quantum_superposition');
        let quantumRemoved = 0;
        for (let i = this.deck.length - 1; i >= 0 && quantumRemoved < 1; i--) {
            if (this.deck[i].id === 'quantum_superposition') {
                this.deck.splice(i, 1);
                quantumRemoved++;
            }
        }
        
        // 将牌组数量翻倍，保持各卡牌概率不变
        let baseDeck = [...this.deck];
        this.deck = [...baseDeck, ...baseDeck];
        
        // 再次翻倍，使牌组数量增加到原来的2倍
        baseDeck = [...this.deck];
        this.deck = [...baseDeck, ...baseDeck];
        
        // 将电有关的4张卡牌数量都减小到8张
        const electricCardIds = ['charge_attach', 'charge_attach_negative', 'self_charge', 'self_charge_negative'];
        electricCardIds.forEach(cardId => {
            let currentCount = this.deck.filter(c => c.id === cardId).length;
            let toRemove = currentCount - 8;
            if (toRemove > 0) {
                for (let i = this.deck.length - 1; i >= 0 && toRemove > 0; i--) {
                    if (this.deck[i].id === cardId) {
                        this.deck.splice(i, 1);
                        toRemove--;
                    }
                }
            }
        });
        
        // 确保热机卡牌数量适中（史诗卡，6张）
        const heatEngineCount = this.deck.filter(c => c.id === 'heat_engine').length;
        if (heatEngineCount < 6) {
            const heatEngineCard = CARDS_DATABASE.find(c => c.id === 'heat_engine');
            for (let i = heatEngineCount; i < 6; i++) {
                this.deck.push(heatEngineCard);
            }
        }
        
        this.shuffle();
    }

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    draw(count = 2) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (this.deck.length === 0) {
                this.deck = [...this.discardPile];
                this.discardPile = [];
                this.shuffle();
            }
            if (this.deck.length > 0) {
                drawn.push(this.deck.pop());
            }
        }
        return drawn;
    }

    discard(card) {
        this.discardPile.push(card);
    }

    getCard(cardId) {
        return CARDS_DATABASE.find(c => c.id === cardId);
    }

    getAllCards() {
        return CARDS_DATABASE;
    }
}