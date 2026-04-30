const GAME_CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    ARENA_RADIUS: 300,
    GRAVITY: 0.5,
    MAX_ENERGY: 5,
    ENERGY_PER_TURN: 2,
    CARDS_PER_TURN: 2,
    STARTING_ENERGY: 2,
    MAX_HAND_SIZE: 6
};

const PLAYER_CONFIG = {
    MASS: 70,
    WIDTH: 40,
    HEIGHT: 40,
    MAX_VELOCITY: 15,
    FRICTION: 4.5,
    AIR_FRICTION: 0, // 无空气阻力，改为地面摩擦力
    GROUND_FRICTION: 0.10, // 地面摩擦系数，每帧减速比例
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