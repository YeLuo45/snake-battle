export const GRID_SIZE = 20;

export const TICK_INTERVAL = {
  classic: 150,
  battle: 120,
  endless: 150,
};

export const INITIAL_SNAKE_LENGTH = 3;

export const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

// Item system
export const ITEM_TYPES = {
  SPEED_UP: {
    id: 'SPEED_UP',
    name: '加速',
    color: '#00ff88',
    icon: '▲',
    duration: 5000,
    effectDesc: '+50% 速度',
  },
  SPEED_DOWN: {
    id: 'SPEED_DOWN',
    name: '减速',
    color: '#4488ff',
    icon: '▼',
    duration: 5000,
    effectDesc: '-40% 速度',
  },
  SHIELD: {
    id: 'SHIELD',
    name: '护盾',
    color: '#ffd700',
    icon: '●',
    duration: null, // single-use
    effectDesc: '免疫一次碰撞',
  },
  GHOST: {
    id: 'GHOST',
    name: '穿墙',
    color: '#ffffff',
    icon: '👻',
    duration: 4000,
    effectDesc: '穿越墙壁',
  },
  MAGNET: {
    id: 'MAGNET',
    name: '磁铁',
    color: '#ff4444',
    icon: '⚡',
    duration: 6000,
    effectDesc: '食物自动吸附',
  },
  GROWTH: {
    id: 'GROWTH',
    name: '猛长',
    color: '#aa44ff',
    icon: '+',
    duration: null, // instant
    effectDesc: '+3 节长度',
  },
};

export const MAX_ITEMS_ON_MAP = 2;
export const ITEM_SPAWN_MIN_MS = 8000;
export const ITEM_SPAWN_MAX_MS = 12000;

// Endless mode
export const ENDLESS_MAX_WAVE = 20;
export const ENDLESS_SPEED_INCREASE_PER_WAVE = 0.05; // +5% per wave
export const ENDLESS_FOOD_DELAY_INCREASE_PER_WAVE = 0.10; // +10% food spawn interval per wave
export const ENDLESS_TOP5_KEY = 'snake_battle_endless_top5';
