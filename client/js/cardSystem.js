const CARDS_DATABASE = [
    {
        id: 'momentum_blast',
        name: '动量冲击',
        type: CARD_TYPES.FORCE,
        cost: 1,
        icon: '💥',
        description: '向指定方向对敌人施加冲量',
        formula: 'J = Δp = m·Δv',
        effect: { impulse: 200, needsAim: true, targetEnemy: true },
        rarity: 'common'
    },
    {
        id: 'directional_dash',
        name: '定向冲刺',
        type: CARD_TYPES.FORCE,
        cost: 1,
        icon: '🏃',
        description: '向指定方向冲刺',
        formula: 'v = v₀ + at',
        effect: { impulse: 250, needsAim: true },
        rarity: 'common'
    },
    {
        id: 'gravity_well',
        name: '引力陷阱',
        type: CARD_TYPES.FORCE,
        cost: 2,
        icon: '🕳️',
        description: '在指定位置放置引力源，持续2回合',
        formula: 'F = G·M/r²',
        effect: { duration: 4, radius: 150, strength: 400, needsAim: true, placeAnywhere: true },
        rarity: 'rare'
    },
    {
        id: 'repulsion_field',
        name: '排斥力场',
        type: CARD_TYPES.FORCE,
        cost: 2,
        icon: '💫',
        description: '自身周围产生持续排斥力，持续2回合',
        formula: 'F ∝ 1/r²',
        effect: { duration: 4, radius: 120, strength: 600 },
        rarity: 'rare'
    },
            {
                id: 'ice_zone',
                name: '冰霜地带',
                type: CARD_TYPES.FORCE,
                cost: 1,
                icon: '🧊',
                description: '指定区域摩擦系数大幅降低，持续1回合',
                formula: 'μ → 0.03',
                effect: { duration: 2, friction: 0.03, radius: 80, needsAim: true, placeAnywhere: true },
                rarity: 'common'
            },
            {
                id: 'mass_increase',
                name: '惯性增强',
                type: CARD_TYPES.FORCE,
                cost: 2,
                icon: '⬛',
                description: '自身质量变为2倍，持续2回合',
                formula: 'F = ma',
                effect: { multiplier: 2, duration: 2 },
                rarity: 'common'
            },
            {
                id: 'mass_decrease',
                name: '惯性减弱',
                type: CARD_TYPES.FORCE,
                cost: 1,
                icon: '🔲',
                description: '自身质量变为0.5倍，持续2回合',
                formula: 'a = F/m',
                effect: { multiplier: 0.5, duration: 2 },
                rarity: 'common'
            },
    {
        id: 'explosive_charge',
        name: '爆裂冲击',
        type: CARD_TYPES.FORCE,
        cost: 3,
        icon: '☄️',
        description: '强力冲量攻击，将敌人推远',
        formula: 'E = ½mv²',
        effect: { impulse: 400, needsAim: true, targetEnemy: true },
        rarity: 'epic'
    },
    {
        id: 'anchor',
        name: '定位锚',
        type: CARD_TYPES.FORCE,
        cost: 3,
        icon: '⚓',
        description: '固定自身位置1回合，免疫位移',
        formula: 'v = 0',
        effect: { duration: 1, anchored: true },
        rarity: 'rare'
    },
    {
        id: 'rigid_connection',
        name: '刚性连接',
        type: CARD_TYPES.FORCE,
        cost: 2,
        icon: '⛓️',
        description: '将你与对手刚性连接，距离保持不变，持续2回合',
        formula: 'd = const',
        effect: { duration: 4, type: 'rigid_constraint' },
        rarity: 'rare'
    },
    {
        id: 'soft_rope',
        name: '软绳约束',
        type: CARD_TYPES.FORCE,
        cost: 1,
        icon: '🪢',
        description: '用软绳连接你与对手，距离可自由变化但超过原长时立即锁定，持续3回合',
        formula: 'F = 0 (d ≤ d₀); d = d₀ (d > d₀)',
        effect: { duration: 6, type: 'soft_rope' },
        rarity: 'rare'
    },
    {
        id: 'damping_field',
        name: '阻尼领域',
        type: CARD_TYPES.FORCE,
        cost: 2,
        icon: '🫧',
        description: '在指定位置放置阻尼领域，区域内运动快速衰减，持续2回合',
        formula: "v' = v·e^(-γt)",
        effect: { duration: 4, radius: 80, type: 'dampingField', needsAim: true, placeAnywhere: true },
        rarity: 'rare'
    },
    {
        id: 'charge_attach',
        name: '正电荷附着',
        type: CARD_TYPES.ELECTRIC,
        cost: 1,
        icon: '🧲',
        description: '给敌人附着一个正电荷，持续2回合',
        formula: 'F = k·q₁·q₂/r²',
        effect: { duration: 2, charge: 1, needsAim: false, targetEnemy: true },
        rarity: 'common'
    },
    {
        id: 'charge_attach_negative',
        name: '负电荷附着',
        type: CARD_TYPES.ELECTRIC,
        cost: 1,
        icon: '🪩',
        description: '给敌人附着一个负电荷，持续2回合',
        formula: 'F = k·q₁·q₂/r²',
        effect: { duration: 2, charge: -1, needsAim: false, targetEnemy: true },
        rarity: 'common'
    },
    {
        id: 'self_charge',
        name: '自身带正电',
        type: CARD_TYPES.ELECTRIC,
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
        type: CARD_TYPES.ELECTRIC,
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
        type: CARD_TYPES.MELEE,
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
        type: CARD_TYPES.HEAT,
        cost: 4,
        icon: '🔥',
        description: '召唤热机附身，2回合内可充能（最多6点），充几点就造成几倍动量冲击，被冰冻则能量归零',
        formula: 'W = Q·η',
        effect: { heatEngine: true, duration: 2, maxCharge: 6, impulseMultiplier: 1 },
        rarity: 'epic'
    },
    {
        id: 'mass_energy',
        name: '质能方程',
        type: CARD_TYPES.MELEE,
        cost: 0,
        icon: '✨',
        description: '质量转化为能量：质量降低50%持续2轮，立即获得2点能量（可超过上限）',
        formula: 'E = mc²',
        effect: { duration: 2, massMultiplier: 0.5, energyGain: 2 },
        rarity: 'rare'
    },
    {
        id: 'radiation',
        name: '辐射',
        type: CARD_TYPES.LIGHT,
        cost: 3,
        icon: '☢️',
        description: '烧毁对方价值最高的一张牌',
        formula: 'E辐射 > E结合能',
        effect: { targetEnemy: true },
        rarity: 'rare'
    },
    {
        id: 'brownian_motion',
        name: '布朗运动',
        type: CARD_TYPES.FORCE,
        cost: 1,
        icon: '🎲',
        description: '随机方向移动80冲量',
        formula: '⟨x²⟩ = 2Dt',
        effect: { impulse: 500 },
        rarity: 'common'
    },
    {
        id: 'electromagnetic_cannon',
        name: '电磁炮',
        type: CARD_TYPES.ELECTRIC,
        cost: 3,
        icon: '🔫',
        description: '消耗自身10%质量发射带电炮弹，速度与电荷量成正比，命中造成750冲量',
        formula: 'F = qvB, a = F/m',
        effect: { needsAim: true, targetEnemy: true, massRatio: 0.1, speedPerCharge: 100, baseImpulse: 400 },
        rarity: 'epic'
    },
    {
        id: 'momentum_conservation',
        name: '动量守恒',
        type: CARD_TYPES.FORCE,
        cost: 2,
        icon: '⚖️',
        description: '2回合内使用冲量卡牌时，自身获得反方向等大小冲量',
        formula: 'p₁ + p₂ = const',
        effect: { duration: 2 },
        rarity: 'rare'
    },
    {
        id: 'magnetic_field',
        name: '磁场',
        type: CARD_TYPES.ELECTRIC,
        cost: 3,
        icon: '🔮',
        description: '全场产生磁场，带电玩家移动时受到洛伦兹力偏转，持续2回合',
        formula: 'F = qv × B',
        effect: { duration: 2, strength: 0.15 },
        rarity: 'rare'
    }
];

class CardSystem {
    constructor() {
        this.deck = [];
        this.discardPile = [];
        this.initDeck();
    }

    initDeck() {
        // 每种卡牌的直接数量规定
        const DECK_QUANTITIES = {
            'momentum_blast': 16,
            'directional_dash': 12,
            'gravity_well': 12,
            'repulsion_field': 12,
            'ice_zone': 10,
            'mass_increase': 12,
            'mass_decrease': 12,
            'explosive_charge': 10,
            'anchor': 8,
            'rigid_connection': 12,
            'soft_rope': 12,
            'damping_field': 12,
            'charge_attach': 8,
            'charge_attach_negative': 8,
            'self_charge': 8,
            'self_charge_negative': 8,
            'quantum_superposition': 5,
            'heat_engine': 7,
            'mass_energy': 12,
            'radiation': 9,
            'brownian_motion': 12,
            'electromagnetic_cannon': 7,
            'momentum_conservation': 10,
            'magnetic_field': 8
        };

        this.deck = [];
        for (const card of CARDS_DATABASE) {
            const qty = DECK_QUANTITIES[card.id] || 0;
            for (let i = 0; i < qty; i++) {
                this.deck.push(card);
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