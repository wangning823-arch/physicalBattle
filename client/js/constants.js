const GAME_CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    ARENA_RADIUS: 300,
    GRAVITY: 0,
    MAX_ENERGY: 5,
    ENERGY_PER_TURN: 2,
    CARDS_PER_TURN: 2,
    STARTING_ENERGY: 2,
    MAX_HAND_SIZE: 6,
    // 性能优化相关配置
    MAX_PARTICLES: 30,
    ENABLE_PERFORMANCE_MONITOR: true
};

const PLAYER_CONFIG = {
    MASS: 70,
    WIDTH: 40,
    HEIGHT: 40,
    DEPTH: 40,
    RADIUS: 20,
    MAX_VELOCITY: 15,
    FRICTION: 4.5,
    AIR_FRICTION: 0.05,
    RESTITUTION: 0.3
};

const GAME_STATES = {
    WAITING: 'waiting',
    PLAYING: 'playing',
    PHYSICS_UPDATE: 'physics_update',
    GAME_OVER: 'game_over'
};

const CARD_TYPES = {
    ATTACK: 'attack',
    DEFENSE: 'defense',
    TERRAIN: 'terrain',
    MOVEMENT: 'movement',
    UTILITY: 'utility'
};

const CHARACTER_CONFIG = {
    SCALE: 1.0,
    HEIGHT: 70,

    HEAD_RADIUS: 10,
    TORSO_WIDTH: 20,
    TORSO_HEIGHT: 25,
    TORSO_DEPTH: 10,

    UPPER_ARM_WIDTH: 6,
    UPPER_ARM_HEIGHT: 18,
    UPPER_ARM_DEPTH: 6,

    LOWER_ARM_WIDTH: 5,
    LOWER_ARM_HEIGHT: 16,
    LOWER_ARM_DEPTH: 5,

    UPPER_LEG_WIDTH: 8,
    UPPER_LEG_HEIGHT: 20,
    UPPER_LEG_DEPTH: 8,

    LOWER_LEG_WIDTH: 7,
    LOWER_LEG_HEIGHT: 18,
    LOWER_LEG_DEPTH: 7,

    PLAYER_COLORS: {
        1: { main: 0xFF6B35, secondary: 0xFFA07A, emissive: 0xFF4500 },
        2: { main: 0x1E90FF, secondary: 0x87CEEB, emissive: 0x0066CC }
    }
};