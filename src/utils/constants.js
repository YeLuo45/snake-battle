export const GRID_SIZE = 20;

export const TICK_INTERVAL = {
  classic: 150,
  battle: 120,
  endless: 150,
  boss: 100,
};

export const BOSS_SPRINT_INTERVAL = 4000; // ms between sprints
export const BOSS_SPRINT_DURATION = 400;   // ms of sprint
export const BOSS_HP = 10;
export const BOSS_MAX_HP = 10;
export const BOSS_DAMAGE_ON_COLLISION = 1; // player loses 1 segment per hit (or we handle as damage to boss)
export const BOSS_SPRINT_DAMAGE_RADIUS = 2; // grid cells

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
  INVISIBLE: {
    id: 'INVISIBLE',
    name: '隐形',
    color: '#cccccc',
    icon: '◐',
    duration: 6000,
    effectDesc: '隐身6秒',
  },
  CLONE: {
    id: 'CLONE',
    name: '分身',
    color: '#ff88ff',
    icon: '♊',
    duration: 8000,
    effectDesc: '召唤分身诱饵',
  },
  MINE: {
    id: 'MINE',
    name: '地雷',
    color: '#ff2200',
    icon: '✸',
    duration: null, // placed item
    effectDesc: '放置地雷',
  },
  PORTAL: {
    id: 'PORTAL',
    name: '传送门',
    color: '#8800ff',
    icon: '◯',
    duration: null, // placed in pairs
    effectDesc: '成对传送',
  },
  SHRINK: {
    id: 'SHRINK',
    name: '萎缩',
    color: '#88ff00',
    icon: '−',
    duration: null, // instant
    effectDesc: '-3 节长度',
  },
  REVERSE: {
    id: 'REVERSE',
    name: '逆转',
    color: '#ff8800',
    icon: '↺',
    duration: 5000,
    effectDesc: '方向反转5秒',
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

// Map types
export const MAP_TYPES = {
  CLASSIC: 'classic_map',
  OBSTACLE: 'obstacle_map',
  HAVEN: 'haven_map',
  PORTAL: 'portal_map',
  MIXED: 'mixed_map',
};

// Generate map elements based on type
function generateMapElements(mapType) {
  const obstacles = [];
  const safeZones = [];
  const portals = []; // pairs of {a:{x,y}, b:{x,y}}

  const rng = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Helper to check if position is too close to center (spawn area)
  const tooCloseToCenter = (x, y) => {
    const cx = Math.floor(GRID_SIZE / 2), cy = Math.floor(GRID_SIZE / 2);
    return Math.abs(x - cx) <= 3 && Math.abs(y - cy) <= 3;
  };

  // Helper to check if position overlaps existing elements
  const overlaps = (x, y) => {
    for (const o of obstacles) if (o.x === x && o.y === y) return true;
    for (const s of safeZones) if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true;
    for (const p of portals) if (p.a.x === x && p.a.y === y || p.b.x === x && p.b.y === y) return true;
    return false;
  };

  if (mapType === MAP_TYPES.OBSTACLE) {
    // Scatter rocks, avoiding center
    for (let i = 0; i < 15; i++) {
      const x = rng(0, GRID_SIZE - 1), y = rng(0, GRID_SIZE - 1);
      if (!tooCloseToCenter(x, y) && !overlaps(x, y)) {
        obstacles.push({ x, y, type: 'rock' });
      }
    }
  } else if (mapType === MAP_TYPES.HAVEN) {
    // 3 safe zones in corners/edges
    const havenConfigs = [
      { x: 1, y: 1, w: 4, h: 4 },
      { x: GRID_SIZE - 5, y: 1, w: 4, h: 4 },
      { x: 1, y: GRID_SIZE - 5, w: 4, h: 4 },
    ];
    for (const h of havenConfigs) {
      safeZones.push(h);
    }
    // Some obstacles too
    for (let i = 0; i < 8; i++) {
      const x = rng(0, GRID_SIZE - 1), y = rng(0, GRID_SIZE - 1);
      if (!tooCloseToCenter(x, y) && !overlaps(x, y)) {
        obstacles.push({ x, y, type: 'rock' });
      }
    }
  } else if (mapType === MAP_TYPES.PORTAL) {
    // 2-3 portal pairs
    const portalPairs = [
      { a: { x: 3, y: 3 }, b: { x: GRID_SIZE - 4, y: GRID_SIZE - 4 } },
      { a: { x: GRID_SIZE - 4, y: 3 }, b: { x: 3, y: GRID_SIZE - 4 } },
    ];
    for (const p of portalPairs) {
      portals.push(p);
    }
  } else if (mapType === MAP_TYPES.MIXED) {
    // Mix of everything
    for (let i = 0; i < 10; i++) {
      const x = rng(0, GRID_SIZE - 1), y = rng(0, GRID_SIZE - 1);
      if (!tooCloseToCenter(x, y) && !overlaps(x, y)) {
        obstacles.push({ x, y, type: 'rock' });
      }
    }
    safeZones.push({ x: GRID_SIZE - 5, y: 1, w: 4, h: 4 });
    safeZones.push({ x: 1, y: GRID_SIZE - 5, w: 4, h: 4 });
    portals.push({
      a: { x: Math.floor(GRID_SIZE / 2) - 1, y: 2 },
      b: { x: Math.floor(GRID_SIZE / 2) + 1, y: GRID_SIZE - 3 },
    });
  }
  // CLASSIC has no special elements

  return { obstacles, safeZones, portals };
}

export const MAP_CONFIGS = Object.fromEntries(
  Object.values(MAP_TYPES).map(type => [type, generateMapElements(type)])
);
