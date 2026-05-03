import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  GRID_SIZE, TICK_INTERVAL, DIRECTIONS,
  ITEM_TYPES, MAX_ITEMS_ON_MAP, ITEM_SPAWN_MIN_MS, ITEM_SPAWN_MAX_MS,
  ENDLESS_MAX_WAVE, ENDLESS_SPEED_INCREASE_PER_WAVE, ENDLESS_FOOD_DELAY_INCREASE_PER_WAVE, ENDLESS_TOP5_KEY,
  MAP_CONFIGS,
} from '../utils/constants';
import { getSkin } from '../utils/skins';
import { GameOver } from './GameOver';
import { Controls } from './Controls';

function createSnake(x, y, length, dir) {
  return Array.from({ length }, (_, i) => ({
    x: x - i * dir.x,
    y: y - i * dir.y,
  }));
}

function randomEdge() {
  const edge = Math.floor(Math.random() * 4);
  let x, y, dir;
  if (edge === 0) { x = Math.floor(Math.random() * GRID_SIZE); y = 0; dir = DIRECTIONS.DOWN; }
  else if (edge === 1) { x = GRID_SIZE - 1; y = Math.floor(Math.random() * GRID_SIZE); dir = DIRECTIONS.LEFT; }
  else if (edge === 2) { x = Math.floor(Math.random() * GRID_SIZE); y = GRID_SIZE - 1; dir = DIRECTIONS.UP; }
  else { x = 0; y = Math.floor(Math.random() * GRID_SIZE); dir = DIRECTIONS.RIGHT; }
  return { x, y, dir };
}

function spawnFood(allSnakes, existingFoods, mapType = 'classic_map') {
  const mapConfig = MAP_CONFIGS[mapType] || MAP_CONFIGS.classic_map;
  const { obstacles } = mapConfig;
  for (let attempt = 0; attempt < 200; attempt++) {
    const pos = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
    const occupied = allSnakes.some(snake => snake.some(seg => seg.x === pos.x && seg.y === pos.y))
      || existingFoods.some(f => f.x === pos.x && f.y === pos.y)
      || obstacles.some(o => o.x === pos.x && o.y === pos.y);
    if (!occupied) return pos;
  }
  return null;
}

function spawnItem(allSnakes, existingFoods, existingItems, mapType = 'classic_map') {
  const mapConfig = MAP_CONFIGS[mapType] || MAP_CONFIGS.classic_map;
  const { obstacles, safeZones } = mapConfig;
  if (existingItems.length >= MAX_ITEMS_ON_MAP) return null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const pos = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
    const inSafeZone = safeZones.some(s => pos.x >= s.x && pos.x < s.x + s.w && pos.y >= s.y && pos.y < s.y + s.h);
    const occupied = allSnakes.some(snake => snake.some(seg => seg.x === pos.x && seg.y === pos.y))
      || existingFoods.some(f => f.x === pos.x && f.y === pos.y)
      || existingItems.some(i => i.x === pos.x && i.y === pos.y)
      || obstacles.some(o => o.x === pos.x && o.y === pos.y);
    if (!occupied && !inSafeZone) {
      const typeKeys = Object.keys(ITEM_TYPES);
      const randomType = ITEM_TYPES[typeKeys[Math.floor(Math.random() * typeKeys.length)]];
      return { ...pos, ...randomType, uid: Date.now() + Math.random() };
    }
  }
  return null;
}

function getRandomSpawnDelay() {
  return ITEM_SPAWN_MIN_MS + Math.random() * (ITEM_SPAWN_MAX_MS - ITEM_SPAWN_MIN_MS);
}

function initState(mode, mapType = 'classic_map', aiPersonality = null) {
  const playerSnake = createSnake(Math.floor(GRID_SIZE / 2), Math.floor(GRID_SIZE / 2), 3, DIRECTIONS.RIGHT);
  const aiSnakes = mode === 'battle' ? [
    { id: 0, color: '#e94560', segments: createSnake(...Object.values(randomEdge()), 3), alive: true },
    { id: 1, color: '#4d96ff', segments: createSnake(...Object.values(randomEdge()), 3), alive: true },
    { id: 2, color: '#ffd93d', segments: createSnake(...Object.values(randomEdge()), 3), alive: true },
  ] : [];

  // BOSS snake - long, spawned from an edge
  const bossSnake = mode === 'boss' ? [
    { id: 'boss', color: '#ff2222', segments: createBossSnake(), alive: true },
  ] : [];

  const allSnakes = [playerSnake, ...aiSnakes.filter(a => a.alive).map(a => a.segments)];
  const foods = [];
  for (let i = 0; i < (mode === 'battle' ? 5 : 1); i++) {
    const f = spawnFood(allSnakes, foods, mapType);
    if (f) foods.push(f);
  }

  // Get map elements from config
  const mapConfig = MAP_CONFIGS[mapType] || MAP_CONFIGS.classic_map;

  return {
    mode,
    mapType,
    playerSnake,
    playerDir: 'RIGHT',
    playerAlive: true,
    aiSnakes,
    bossSnake,
    foods,
    score: 0,
    gameOver: false,
    paused: false,
    timeLeft: 180,
    initialized: true,
    // Endless mode
    wave: 1,
    waveProgress: 0,
    waveAnnounceTimer: 0,
    // Items
    items: [],
    activeItems: [],
    nextItemSpawn: getRandomSpawnDelay(),
    // Tick speed for endless (base 150)
    baseTickInterval: mode === 'endless' ? 150 : (TICK_INTERVAL[mode] || 150),
    // BOSS mode
    bossHp: mode === 'boss' ? BOSS_MAX_HP : 0,
    bossSprintTimer: 0,
    bossSprintCooldown: BOSS_SPRINT_INTERVAL, // start with full cooldown
    bossSprinting: false,
    bossSprintDir: null,
    victory: false,
    // Map elements (V3 M3)
    obstacles: mapConfig.obstacles,
    safeZones: mapConfig.safeZones,
    portals: mapConfig.portals,
    // Player placed items
    placedMines: [],
    portalPair: null,
    isReverseControls: false,
  };
}

function createBossSnake() {
  // Spawn a 10-segment boss snake from a random edge
  const edge = Math.floor(Math.random() * 4);
  let x, y, dir;
  if (edge === 0) { x = Math.floor(GRID_SIZE / 2); y = 0; dir = DIRECTIONS.DOWN; }
  else if (edge === 1) { x = GRID_SIZE - 1; y = Math.floor(GRID_SIZE / 2); dir = DIRECTIONS.LEFT; }
  else if (edge === 2) { x = Math.floor(GRID_SIZE / 2); y = GRID_SIZE - 1; dir = DIRECTIONS.UP; }
  else { x = 0; y = Math.floor(GRID_SIZE / 2); dir = DIRECTIONS.RIGHT; }
  return createSnake(x, y, 10, dir);
}

function getAIMove(aiSnake, allSnakes, foods, obstacles = [], safeZones = []) {
  if (!aiSnake?.length || !aiSnake[0]) return null;
  const head = aiSnake[0];
  const possible = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];

  const isInSafeZone = (x, y) => safeZones.some(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);

  const safe = possible.filter(dir => {
    const nx = head.x + dir.x, ny = head.y + dir.y;
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return false;
    // Avoid obstacles
    if (obstacles.some(o => o.x === nx && o.y === ny)) return false;
    // Avoid safe zones (AI doesn't enter)
    if (isInSafeZone(nx, ny)) return false;
    for (const snake of allSnakes) {
      if (!snake?.length) continue;
      const startIdx = snake === aiSnake ? 1 : 0;
      for (let i = startIdx; i < snake.length; i++) {
        if (snake[i]?.x === nx && snake[i]?.y === ny) return false;
      }
    }
    return true;
  });

  if (!safe.length) return null;
  if (Math.random() < 0.1) return safe[Math.floor(Math.random() * safe.length)];

  let nearest = null, minDist = Infinity;
  for (const f of foods ?? []) {
    if (!f) continue;
    const d = Math.abs(head.x - f.x) + Math.abs(head.y - f.y);
    if (d < minDist) { minDist = d; nearest = f; }
  }
  if (!nearest) return safe[Math.floor(Math.random() * safe.length)];

  let best = safe[0], bestDist = Infinity;
  for (const dir of safe) {
    const nx = head.x + dir.x, ny = head.y + dir.y;
    const d = Math.abs(nx - nearest.x) + Math.abs(ny - nearest.y);
    if (d < bestDist) { bestDist = d; best = dir; }
  }
  return best;
}

// Compute active speed multiplier from active items
function getSpeedMultiplier(activeItems) {
  let mult = 1.0;
  for (const item of activeItems) {
    if (item.speedMultiplier) mult *= item.speedMultiplier;
  }
  return mult;
}

// Check if ghost mode active
function isGhostActive(activeItems) {
  return activeItems.some(a => a.isGhost);
}

// Check if magnet active
function isMagnetActive(activeItems) {
  return activeItems.some(a => a.isMagnet);
}

// Check if shield active
function hasShield(activeItems) {
  return activeItems.some(a => a.isShield);
}

// Check if reverse controls active
function isReverseControlsActive(activeItems) {
  return activeItems.some(a => a.isReverse);
}

// Check if invisible active
function isInvisibleActive(activeItems) {
  return activeItems.some(a => a.isInvisible);
}

// Get opposite direction for reverse effect
function getReverseDirection(dir) {
  const opposite = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
  return opposite[dir] || dir;
}

// Check if position is occupied by any snake (helper)
function isOccupiedByAnySnake(pos, snakes) {
  return snakes.some(snake => snake.some(seg => seg.x === pos.x && seg.y === pos.y));
}

// Place a mine at position
function placeMine(state, x, y) {
  return {
    ...state,
    placedMines: [...state.placedMines, { x, y, uid: Date.now() }],
  };
}

// Teleport through portal pair
function teleportThroughPortal(state, head) {
  const pair = state.portalPair;
  if (!pair || pair.length < 2) return head;
  if (head.x === pair[0].x && head.y === pair[0].y) {
    return { ...pair[1] };
  } else if (head.x === pair[1].x && head.y === pair[1].y) {
    return { ...pair[0] };
  }
  return head;
}

// Create portal pair (consumes 2 PORTAL items, creates linked pair)
function createPortalPair(state) {
  // Spawn two portal positions near each other
  const baseX = Math.floor(Math.random() * (GRID_SIZE - 4)) + 2;
  const baseY = Math.floor(Math.random() * (GRID_SIZE - 4)) + 2;
  const offset = Math.floor(Math.random() * 2) === 0 ? 2 : -2;
  const pair = Math.random() < 0.5
    ? [{ x: baseX, y: baseY }, { x: baseX + offset, y: baseY }]
    : [{ x: baseX, y: baseY }, { x: baseX, y: baseY + offset }];
  return { ...state, portalPair: pair };
}

// Apply item effect to state
function applyItemEffect(state, item) {
  const newActive = [...state.activeItems];
  if (item.id === 'SPEED_UP') {
    newActive.push({ id: item.id, endTime: Date.now() + item.duration, speedMultiplier: 1.5, isShield: false, isGhost: false, isMagnet: false, isInvisible: false, isReverse: false });
  } else if (item.id === 'SPEED_DOWN') {
    newActive.push({ id: item.id, endTime: Date.now() + item.duration, speedMultiplier: 0.6, isShield: false, isGhost: false, isMagnet: false, isInvisible: false, isReverse: false });
  } else if (item.id === 'SHIELD') {
    newActive.push({ id: item.id, endTime: null, speedMultiplier: 1.0, isShield: true, isGhost: false, isMagnet: false, isInvisible: false, isReverse: false });
  } else if (item.id === 'GHOST') {
    newActive.push({ id: item.id, endTime: Date.now() + item.duration, speedMultiplier: 1.0, isShield: false, isGhost: true, isMagnet: false, isInvisible: false, isReverse: false });
  } else if (item.id === 'MAGNET') {
    newActive.push({ id: item.id, endTime: Date.now() + item.duration, speedMultiplier: 1.0, isShield: false, isGhost: false, isMagnet: true, isInvisible: false, isReverse: false });
  } else if (item.id === 'GROWTH') {
    // Instant growth +3 segments
    const added = Array.from({ length: 3 }, () => ({ ...state.playerSnake[state.playerSnake.length - 1] }));
    return {
      ...state,
      playerSnake: [...state.playerSnake, ...added],
    };
  } else if (item.id === 'INVISIBLE') {
    newActive.push({ id: item.id, endTime: Date.now() + item.duration, speedMultiplier: 1.0, isShield: false, isGhost: false, isMagnet: false, isInvisible: true, isReverse: false });
    return { ...state, activeItems: newActive, isInvisible: true };
  } else if (item.id === 'CLONE') {
    // Create a decoy that follows a slightly delayed path
    const decoySegments = state.playerSnake.slice(0, Math.max(3, Math.floor(state.playerSnake.length * 0.6)));
    return {
      ...state,
      cloneDecoy: { segments: decoySegments, endTime: Date.now() + 8000 },
    };
  } else if (item.id === 'MINE') {
    // Place mine at current head position
    return placeMine(state, state.playerSnake[0].x, state.playerSnake[0].y);
  } else if (item.id === 'PORTAL') {
    if (!state.portalPair) {
      // First portal - remember this position (will be replaced when second is collected)
      return { ...state, portalPair: [{ x: state.playerSnake[0].x, y: state.playerSnake[0].y }] };
    } else {
      // Second portal - complete the pair
      const newPair = [...state.portalPair, { x: state.playerSnake[0].x, y: state.playerSnake[0].y }];
      return { ...state, portalPair: newPair.length >= 2 ? newPair.slice(-2) : newPair };
    }
  } else if (item.id === 'SHRINK') {
    // Instant shrink -3 segments (minimum length 3)
    const newLength = Math.max(3, state.playerSnake.length - 3);
    const removed = state.playerSnake.length - newLength;
    return {
      ...state,
      playerSnake: state.playerSnake.slice(0, newLength),
    };
  } else if (item.id === 'REVERSE') {
    newActive.push({ id: item.id, endTime: Date.now() + item.duration, speedMultiplier: 1.0, isShield: false, isGhost: false, isMagnet: false, isInvisible: false, isReverse: true });
    return { ...state, activeItems: newActive, isReverseControls: true };
  }
  return { ...state, activeItems: newActive };
}

function tickEndless(state) {
  const { playerSnake, playerDir, foods, score, wave, baseTickInterval, activeItems } = state;
  const dir = DIRECTIONS[playerDir];
  const head = playerSnake[0];
  const newHead = { x: head.x + dir.x, y: head.y + dir.y };

  const ghostActive = isGhostActive(activeItems);
  const shieldActive = hasShield(activeItems);

  // Wall collision
  let wallHit = false;
  if (!ghostActive) {
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) wallHit = true;
  } else {
    // Wrap around
    newHead.x = (newHead.x + GRID_SIZE) % GRID_SIZE;
    newHead.y = (newHead.y + GRID_SIZE) % GRID_SIZE;
  }

  if (wallHit) {
    if (shieldActive) {
      // Consume shield, survive
      const newActive = activeItems.filter(a => !a.isShield);
      return { ...state, activeItems: newActive, playerDir: playerDir };
    }
    return { ...state, gameOver: true, playerAlive: false };
  }

  // Check obstacle collision (rock = instant death unless ghost)
  const obstacleHit = !ghostActive && (state.obstacles ?? []).some(o => o.x === newHead.x && o.y === newHead.y);
  if (obstacleHit) {
    if (shieldActive) {
      const newActive = activeItems.filter(a => !a.isShield);
      return { ...state, activeItems: newActive, playerDir: playerDir };
    }
    return { ...state, gameOver: true, playerAlive: false };
  }

  // Self collision
  if (playerSnake.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
    if (shieldActive) {
      const newActive = activeItems.filter(a => !a.isShield);
      return { ...state, activeItems: newActive, playerDir: playerDir };
    }
    return { ...state, gameOver: true, playerAlive: false };
  }

  // Food collision
  const foodIdx = (foods ?? []).findIndex(f => f.x === newHead.x && f.y === newHead.y);
  if (foodIdx >= 0) {
    const newFoods = foods.filter((_, i) => i !== foodIdx);
    const spawned = spawnFood([playerSnake], newFoods, state.mapType);
    const waveCoeff = wave;
    // Wave complete?
    if (newFoods.length === 0) {
      const nextWave = Math.min(wave + 1, ENDLESS_MAX_WAVE);
      const newBaseInterval = TICK_INTERVAL.endless * Math.pow(1 - ENDLESS_SPEED_INCREASE_PER_WAVE, wave - 1);
      // Safe zone 1.5x score
      const inSafeZone = (state.safeZones ?? []).some(s => newHead.x >= s.x && newHead.x < s.x + s.w && newHead.y >= s.y && newHead.y < s.y + s.h);
      const scoreGain = (inSafeZone ? 15 : 10) * waveCoeff;
      return {
        ...state,
        playerSnake: [newHead, ...playerSnake],
        foods: spawned ? [spawned] : [],
        score: score + scoreGain,
        wave: nextWave,
        waveAnnounceTimer: 60, // 1 second at 60fps
        baseTickInterval: TICK_INTERVAL.endless * Math.pow(1 - ENDLESS_SPEED_INCREASE_PER_WAVE, nextWave - 1),
        waveProgress: 0,
      };
    }
    // Safe zone 1.5x score
    const inSafeZone = (state.safeZones ?? []).some(s => newHead.x >= s.x && newHead.x < s.x + s.w && newHead.y >= s.y && newHead.y < s.y + s.h);
    const scoreGain = (inSafeZone ? 15 : 10) * waveCoeff;
    return {
      ...state,
      playerSnake: [newHead, ...playerSnake],
      foods: spawned ? [...newFoods, spawned] : newFoods,
      score: score + scoreGain,
    };
  }

  return { ...state, playerSnake: [newHead, ...playerSnake.slice(0, -1)] };
}

export function GameCanvas({ mode, mapType, skin, aiPersonality, onBack }) {
  const canvasRef = useRef(null);
  const skinData = getSkin(skin);
  const [state, setState] = useState(() => initState(mode, mapType));

  // Sync to mode prop changes (restart)
  useEffect(() => {
    setState(initState(mode, mapType));
  }, [mode, mapType]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e) => {
      const keyMap = {
        ArrowUp: 'UP', KeyW: 'UP',
        ArrowDown: 'DOWN', KeyS: 'DOWN',
        ArrowLeft: 'LEFT', KeyA: 'LEFT',
        ArrowRight: 'RIGHT', KeyD: 'RIGHT',
        Space: 'PAUSE',
      };
      const action = keyMap[e.code];
      if (action === 'PAUSE') { e.preventDefault(); setState(s => ({ ...s, paused: !s.paused })); }
      else if (action) {
        e.preventDefault();
        setState(s => {
          const opposite = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
          if (opposite[action] === s.playerDir) return s;
          return { ...s, playerDir: action };
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Effective tick interval (with speed item modifier + endless wave modifier)
  const effectiveTickInterval = React.useMemo(() => {
    let interval = state.baseTickInterval || TICK_INTERVAL[state.mode] || 150;
    if (state.mode === 'endless') {
      const wave = state.wave || 1;
      interval = TICK_INTERVAL.endless * Math.pow(1 - ENDLESS_SPEED_INCREASE_PER_WAVE, wave - 1);
    }
    const speedMult = getSpeedMultiplier(state.activeItems);
    return interval / speedMult;
  }, [state.baseTickInterval, state.mode, state.wave, state.activeItems]);

  // Game tick
  useEffect(() => {
    if (state.gameOver || state.paused || !state.initialized) return;

    const tick = () => {
      setState(prev => {
        if (prev.gameOver || prev.paused) return prev;

        if (prev.mode === 'classic') return tickClassic(prev);
        if (prev.mode === 'endless') return tickEndless(prev);
        if (prev.mode === 'boss') return tickBoss(prev);
        return tickBattle(prev);
      });
    };

    const id = setInterval(tick, effectiveTickInterval);
    return () => clearInterval(id);
  }, [state.gameOver, state.paused, state.mode, effectiveTickInterval]);

  // Timer for battle mode
  useEffect(() => {
    if (state.mode !== 'battle' || state.gameOver || state.paused) return;
    const id = setInterval(() => {
      setState(prev => {
        if (prev.gameOver || prev.paused) return prev;
        const newTime = prev.timeLeft - 1;
        const allDead = !prev.playerAlive && !prev.aiSnakes.some(a => a.alive);
        return { ...prev, timeLeft: newTime, gameOver: newTime <= 0 || allDead };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state.mode, state.gameOver, state.paused, state.timeLeft]);

  // Item spawn timer
  useEffect(() => {
    if (state.mode === 'classic' || state.gameOver || state.paused) return;

    const scheduleNextSpawn = (delay) => {
      return setTimeout(() => {
        setState(prev => {
          if (prev.gameOver || prev.paused) return prev;
          const allSnakes = [prev.playerSnake, ...(prev.aiSnakes || []).filter(a => a.alive).map(a => a.segments)];
          const newItem = spawnItem(allSnakes, prev.foods, prev.items);
          if (!newItem) return prev;
          return { ...prev, items: [...prev.items, newItem], nextItemSpawn: getRandomSpawnDelay() };
        });
      }, delay);
    };

    const timer = scheduleNextSpawn(state.nextItemSpawn);
    return () => clearTimeout(timer);
  }, [state.mode, state.nextItemSpawn, state.gameOver, state.paused]);

  // Active item expiry
  useEffect(() => {
    if (state.mode === 'classic' || !state.activeItems.length) return;

    const interval = setInterval(() => {
      setState(prev => {
        const now = Date.now();
        let updated = prev.activeItems.filter(a => a.endTime === null || a.endTime > now);
        const expired = prev.activeItems.filter(a => a.endTime !== null && a.endTime <= now);
        let next = { ...prev, activeItems: updated };
        // Reset states for expired items
        for (const ex of expired) {
          if (ex.isInvisible) next.isInvisible = false;
          if (ex.isReverse) next.isReverseControls = false;
        }
        // Clone decoy expiry
        if (prev.cloneDecoy && prev.cloneDecoy.endTime <= now) {
          next = { ...next, cloneDecoy: null };
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [state.mode, state.activeItems.length]);

  // Wave announce timer countdown
  useEffect(() => {
    if (state.mode !== 'endless' || state.waveAnnounceTimer <= 0) return;
    const id = setInterval(() => {
      setState(prev => {
        if (prev.waveAnnounceTimer <= 1) return { ...prev, waveAnnounceTimer: 0 };
        return { ...prev, waveAnnounceTimer: prev.waveAnnounceTimer - 1 };
      });
    }, 1000 / 60);
    return () => clearInterval(id);
  }, [state.mode, state.waveAnnounceTimer]);

  // Item collection check during tick — handled in tickClassic/tickBattle/tickEndless
  // Magnet effect: move food toward snake head each tick
  useEffect(() => {
    if (state.mode === 'classic' || !isMagnetActive(state.activeItems)) return;
    setState(prev => {
      if (!prev.playerSnake?.length || !prev.foods?.length) return prev;
      const head = prev.playerSnake[0];
      let changed = false;
      const newFoods = prev.foods.map(f => {
        const dx = head.x - f.x;
        const dy = head.y - f.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist <= 4 && dist > 0) {
          changed = true;
          const step = Math.min(1, dist);
          return {
            ...f,
            x: f.x + Math.sign(dx) * step,
            y: f.y + Math.sign(dy) * step,
          };
        }
        return f;
      });
      return changed ? { ...prev, foods: newFoods } : prev;
    });
  }, [state.mode, state.activeItems, state.playerSnake]);

  // Canvas size
  const canvasSize = Math.min(window.innerWidth - 32, window.innerHeight - 200);
  const cellSize = canvasSize / GRID_SIZE;

  // Draw - runs on every state change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { playerSnake, playerAlive, aiSnakes, foods, items, mode: gMode } = state;

    ctx.fillStyle = skinData.background;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.strokeStyle = skinData.gridColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvasSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvasSize, i * cellSize);
      ctx.stroke();
    }

    // Draw safe zones (green areas, AI avoids, 1.5x score)
    for (const zone of state.safeZones) {
      ctx.fillStyle = 'rgba(0, 255, 100, 0.15)';
      ctx.fillRect(zone.x * cellSize, zone.y * cellSize, zone.w * cellSize, zone.h * cellSize);
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(zone.x * cellSize, zone.y * cellSize, zone.w * cellSize, zone.h * cellSize);
      // Label
      ctx.fillStyle = 'rgba(0, 255, 100, 0.5)';
      ctx.font = `${Math.floor(cellSize * 0.6)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('安全区', (zone.x + zone.w / 2) * cellSize, (zone.y + zone.h / 2) * cellSize);
    }

    // Draw obstacles (rocks)
    for (const obs of state.obstacles) {
      ctx.fillStyle = '#666666';
      ctx.shadowColor = '#333333';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(obs.x * cellSize + cellSize / 2, obs.y * cellSize + cellSize / 2, cellSize / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Rock texture
      ctx.fillStyle = '#888888';
      ctx.beginPath();
      ctx.arc(obs.x * cellSize + cellSize / 2 - 2, obs.y * cellSize + cellSize / 2 - 2, cellSize / 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw map portals (from MAP_CONFIGS, not player-placed)
    for (const pair of state.portals) {
      // Portal A
      ctx.fillStyle = '#8800ff';
      ctx.shadowColor = '#8800ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(pair.a.x * cellSize + cellSize / 2, pair.a.y * cellSize + cellSize / 2, cellSize / 2, 0, Math.PI * 2);
      ctx.fill();
      // Portal B
      ctx.beginPath();
      ctx.arc(pair.b.x * cellSize + cellSize / 2, pair.b.y * cellSize + cellSize / 2, cellSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Connecting line
      ctx.strokeStyle = 'rgba(136, 0, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pair.a.x * cellSize + cellSize / 2, pair.a.y * cellSize + cellSize / 2);
      ctx.lineTo(pair.b.x * cellSize + cellSize / 2, pair.b.y * cellSize + cellSize / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const food of foods) {
      ctx.fillStyle = skinData.foodColor;
      ctx.beginPath();
      ctx.arc(food.x * cellSize + cellSize / 2, food.y * cellSize + cellSize / 2, cellSize / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw items
    for (const item of items) {
      const cx = item.x * cellSize + cellSize / 2;
      const cy = item.y * cellSize + cellSize / 2;
      const r = cellSize / 2 - 1;
      // Glow
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Icon
      ctx.fillStyle = '#000';
      ctx.font = `${Math.floor(cellSize * 0.6)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.icon, cx, cy);
    }

    // Draw portal pair
    if (state.portalPair && state.portalPair.length === 2) {
      for (const p of state.portalPair) {
        ctx.fillStyle = '#8800ff';
        ctx.shadowColor = '#8800ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x * cellSize + cellSize / 2, p.y * cellSize + cellSize / 2, cellSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // Draw connecting line between portals
      ctx.strokeStyle = 'rgba(136, 0, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(state.portalPair[0].x * cellSize + cellSize / 2, state.portalPair[0].y * cellSize + cellSize / 2);
      ctx.lineTo(state.portalPair[1].x * cellSize + cellSize / 2, state.portalPair[1].y * cellSize + cellSize / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw placed mines
    for (const mine of state.placedMines) {
      ctx.fillStyle = '#ff2200';
      ctx.shadowColor = '#ff2200';
      ctx.shadowBlur = 6;
      ctx.font = `${Math.floor(cellSize * 0.8)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✸', mine.x * cellSize + cellSize / 2, mine.y * cellSize + cellSize / 2);
      ctx.shadowBlur = 0;
    }

    function drawSnake(segments, color, isGhost = false, isInvisibleSnake = false) {
      if (isInvisibleSnake) return; // Don't draw invisible snake
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i];
        ctx.fillStyle = isGhost ? 'rgba(255,255,255,0.5)' : color;
        ctx.globalAlpha = i === 0 ? 1 : 0.85;
        ctx.fillRect(seg.x * cellSize + 1, seg.y * cellSize + 1, cellSize - 2, cellSize - 2);
        ctx.globalAlpha = 1;
      }
    }

    const ghostActive = isGhostActive(state.activeItems);
    const invisibleActive = isInvisibleActive(state.activeItems);
    if (playerAlive) drawSnake(playerSnake, skinData.snakeColor, ghostActive, invisibleActive);
    // Draw clone decoy
    if (state.cloneDecoy && state.cloneDecoy.segments?.length) {
      drawSnake(state.cloneDecoy.segments, 'rgba(255,136,255,0.6)', false, false);
    }
    for (const ai of aiSnakes) {
      if (ai.alive) drawSnake(ai.segments, ai.color);
    }

    // Draw BOSS snake
    if (gMode === 'boss' && state.bossSnake) {
      for (const boss of state.bossSnake) {
        if (boss?.alive && boss?.segments?.length) {
          // Draw boss with glow effect when sprinting
          const isSprinting = state.bossSprinting;
          for (let i = boss.segments.length - 1; i >= 0; i--) {
            const seg = boss.segments[i];
            const isHead = i === 0;
            if (isSprinting) {
              ctx.shadowColor = '#ff0000';
              ctx.shadowBlur = 12;
            }
            ctx.fillStyle = isHead ? '#ff4444' : (isSprinting ? '#ff2222' : '#cc0000');
            ctx.globalAlpha = i === 0 ? 1 : 0.9;
            ctx.fillRect(seg.x * cellSize + 1, seg.y * cellSize + 1, cellSize - 2, cellSize - 2);
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
          }
        }
      }
    }

    // BOSS HP bar drawn in header, not overlay
    // Sprint warning flash overlay
    if (gMode === 'boss' && state.bossSprinting) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvasSize, canvasSize);
    }

    // Wave announce overlay
    if (gMode === 'endless' && state.waveAnnounceTimer > 0) {
      const alpha = Math.min(1, state.waveAnnounceTimer / 30);
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.6})`;
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.font = `bold ${Math.floor(canvasSize / 10)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`WAVE ${state.wave}`, canvasSize / 2, canvasSize / 2);
    }
  }, [state, skinData, canvasSize, cellSize]);

  const handleDirection = (dir) => {
    setState(s => {
      const opposite = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
      if (opposite[dir] === s.playerDir) return s;
      return { ...s, playerDir: dir };
    });
  };

  const handlePause = () => setState(s => ({ ...s, paused: !s.paused }));
  const handleRestart = () => setState(initState(state.mode));

  const { score, timeLeft, gameOver, paused, aiSnakes: aiSnakesState, mode: gameMode, wave, activeItems } = state;
  const displayTime = gameMode === 'battle' ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` : null;

  const getRanking = () => {
    const entries = [
      { name: '你', score, isPlayer: true },
      ...aiSnakesState.map((ai, i) => ({
        name: `AI ${['红', '蓝', '黄'][i]}`,
        score: Math.max(0, (ai.segments.length - 3) * 10),
        isPlayer: false,
      })),
    ];
    return entries.sort((a, b) => b.score - a.score);
  };

  // Endless mode top5
  const getEndlessTop5 = useCallback(() => {
    try {
      const raw = localStorage.getItem(ENDLESS_TOP5_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }, []);

  const saveEndlessScore = useCallback((finalWave, finalScore) => {
    try {
      const top5 = getEndlessTop5();
      top5.push({ wave: finalWave, score: finalScore, date: new Date().toLocaleDateString() });
      top5.sort((a, b) => b.wave - a.wave || b.score - a.score);
      const trimmed = top5.slice(0, 5);
      localStorage.setItem(ENDLESS_TOP5_KEY, JSON.stringify(trimmed));
      return trimmed;
    } catch { return []; }
  }, [getEndlessTop5]);

  // On game over for endless, save score
  React.useEffect(() => {
    if (gameOver && gameMode === 'endless') {
      saveEndlessScore(wave, score);
    }
  }, [gameOver, gameMode, wave, score, saveEndlessScore]);

  return (
    <div className="game-wrapper">
      <div className="game-header">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <div className="score-display boss-header">
          {gameMode === 'boss' && (
            <div className="boss-hp-bar">
              <span className="boss-hp-label">BOSS</span>
              <div className="boss-hp-track">
                <div
                  className="boss-hp-fill"
                  style={{ width: `${(state.bossHp / BOSS_MAX_HP) * 100}%` }}
                />
              </div>
              <span className="boss-hp-num">{state.bossHp}/{BOSS_MAX_HP}</span>
            </div>
          )}
          <span className="score-text">
            {gameMode === 'endless'
              ? `WAVE ${wave} | 得分：${score}`
              : gameMode === 'boss'
              ? `得分：${score}`
              : `${displayTime ? `${displayTime} | ` : ''}得分：${score}`}
          </span>
        </div>
        <div />
      </div>

      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        style={{ background: skinData.background }}
      />

      <Controls onDirection={handleDirection} onPause={handlePause} />

      {paused && !gameOver && (
        <div className="modal-overlay" onClick={handlePause}>
          <div className="modal">
            <h2>已暂停</h2>
            <button className="modal-btn primary" onClick={handlePause}>继续</button>
          </div>
        </div>
      )}

      {gameOver && (
        <GameOver
          score={score}
          highScore={0}
          isBattle={gameMode === 'battle'}
          isEndless={gameMode === 'endless'}
          isBoss={gameMode === 'boss'}
          victory={state.victory}
          wave={gameMode === 'endless' ? wave : null}
          endlessTop5={gameMode === 'endless' ? getEndlessTop5() : null}
          ranking={gameMode === 'battle' ? getRanking() : null}
          onRestart={handleRestart}
          onBack={onBack}
        />
      )}
    </div>
  );
}

function tickClassic(state) {
  const { playerSnake, playerDir, foods, score, activeItems, isReverseControls } = state;
  let dir = DIRECTIONS[playerDir];
  // Apply reverse controls
  if (isReverseControls) {
    dir = getReverseDirection(playerDir);
    dir = DIRECTIONS[dir];
  } else {
    dir = DIRECTIONS[playerDir];
  }
  const head = playerSnake[0];
  let newHead = { x: head.x + dir.x, y: head.y + dir.y };
  const ghostActive = isGhostActive(activeItems);
  const shieldActive = hasShield(activeItems);

  let wallHit = false;
  if (!ghostActive) {
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) wallHit = true;
  } else {
    newHead.x = (newHead.x + GRID_SIZE) % GRID_SIZE;
    newHead.y = (newHead.y + GRID_SIZE) % GRID_SIZE;
  }

  // Check map portal teleportation (portals from MAP_CONFIGS)
  for (const pair of state.portals) {
    if (newHead.x === pair.a.x && newHead.y === pair.a.y) {
      newHead = { ...pair.b };
    } else if (newHead.x === pair.b.x && newHead.y === pair.b.y) {
      newHead = { ...pair.a };
    }
  }

  // Check portal teleportation (player-placed portal pair)
  const portalPair = state.portalPair;
  if (portalPair && portalPair.length === 2) {
    if (newHead.x === portalPair[0].x && newHead.y === portalPair[0].y) {
      newHead = { ...portalPair[1] };
    } else if (newHead.x === portalPair[1].x && newHead.y === portalPair[1].y) {
      newHead = { ...portalPair[0] };
    }
  }

  // Check mine collision (before wall check)
  const mineHit = state.placedMines?.some(m => m.x === newHead.x && m.y === newHead.y);
  if (mineHit) {
    if (shieldActive) {
      // Consume shield, survive, remove mine
      const newActive = activeItems.filter(a => !a.isShield);
      const newMines = state.placedMines.filter(m => !(m.x === newHead.x && m.y === newHead.y));
      return { ...state, activeItems: newActive, placedMines: newMines };
    }
    return { ...state, gameOver: true, playerAlive: false };
  }

  if (wallHit) {
    if (shieldActive) {
      const newActive = activeItems.filter(a => !a.isShield);
      return { ...state, activeItems: newActive };
    }
    return { ...state, gameOver: true, playerAlive: false };
  }
  // Check obstacle collision (rock = instant death unless ghost)
  const obstacleHit = !ghostActive && (state.obstacles ?? []).some(o => o.x === newHead.x && o.y === newHead.y);
  if (obstacleHit) {
    if (shieldActive) {
      const newActive = activeItems.filter(a => !a.isShield);
      return { ...state, activeItems: newActive };
    }
    return { ...state, gameOver: true, playerAlive: false };
  }
  if (playerSnake.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
    if (shieldActive) {
      const newActive = activeItems.filter(a => !a.isShield);
      return { ...state, activeItems: newActive };
    }
    return { ...state, gameOver: true, playerAlive: false };
  }

  // Check item collision first
  const itemIdx = (state.items ?? []).findIndex(item => item.x === newHead.x && item.y === newHead.y);
  let nextState = state;
  if (itemIdx >= 0) {
    const item = state.items[itemIdx];
    const newItems = state.items.filter((_, i) => i !== itemIdx);
    nextState = applyItemEffect({ ...state, items: newItems }, item);
  }

  const foodIdx = (nextState.foods ?? []).findIndex(f => f.x === newHead.x && f.y === newHead.y);
  if (foodIdx >= 0) {
    const newFoods = nextState.foods.filter((_, i) => i !== foodIdx);
    const spawned = spawnFood([nextState.playerSnake], newFoods, state.mapType);
    // Safe zone 1.5x score multiplier
    const inSafeZone = (state.safeZones ?? []).some(s => newHead.x >= s.x && newHead.x < s.x + s.w && newHead.y >= s.y && newHead.y < s.y + s.h);
    const scoreGain = inSafeZone ? 15 : 10;
    return {
      ...nextState,
      playerSnake: [newHead, ...nextState.playerSnake],
      foods: spawned ? [...newFoods, spawned] : newFoods,
      score: nextState.score + scoreGain,
    };
  }
  return { ...nextState, playerSnake: [newHead, ...nextState.playerSnake.slice(0, -1)] };
}

function tickBattle(state) {
  const { playerSnake, playerDir, playerAlive, aiSnakes, foods, score, activeItems, isReverseControls } = state;
  let np = playerSnake, npa = playerAlive, nf = foods, ns = score;

  if (npa && np?.length) {
    let dir = DIRECTIONS[playerDir];
    if (isReverseControls) {
      dir = DIRECTIONS[getReverseDirection(playerDir)];
    }
    const head = np[0];
    let newHead = { x: head.x + dir.x, y: head.y + dir.y };

    // Map portal teleportation
    for (const pair of state.portals) {
      if (newHead.x === pair.a.x && newHead.y === pair.a.y) {
        newHead = { ...pair.b };
      } else if (newHead.x === pair.b.x && newHead.y === pair.b.y) {
        newHead = { ...pair.a };
      }
    }

    // Portal teleportation (player-placed)
    const portalPair = state.portalPair;
    if (portalPair && portalPair.length === 2) {
      if (newHead.x === portalPair[0].x && newHead.y === portalPair[0].y) {
        newHead = { ...portalPair[1] };
      } else if (newHead.x === portalPair[1].x && newHead.y === portalPair[1].y) {
        newHead = { ...portalPair[0] };
      }
    }

    // Mine collision for player
    const mineHit = state.placedMines?.some(m => m.x === newHead.x && m.y === newHead.y);
    const shieldActive = hasShield(activeItems);
    if (mineHit) {
      if (shieldActive) {
        const newActive = activeItems.filter(a => !a.isShield);
        const newMines = state.placedMines.filter(m => !(m.x === newHead.x && m.y === newHead.y));
        state = { ...state, activeItems: newActive, placedMines: newMines };
      } else {
        npa = false;
      }
    }

    if (npa && (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE)) {
      npa = false;
    } else if (npa && np.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
      npa = false;
    } else if (npa && (state.obstacles ?? []).some(o => o.x === newHead.x && o.y === newHead.y)) {
      // Obstacle collision
      if (shieldActive) {
        const newActive = activeItems.filter(a => !a.isShield);
        const newMines = state.placedMines.filter(m => !(m.x === newHead.x && m.y === newHead.y));
        state = { ...state, activeItems: newActive, placedMines: newMines };
      } else {
        npa = false;
      }
    } else if (npa) {
      const fi = nf?.findIndex ? nf.findIndex(f => f.x === newHead.x && f.y === newHead.y) : -1;
      if (fi >= 0 && nf) {
        np = [newHead, ...np];
        nf = nf.filter((_, i) => i !== fi);
        const spawned = spawnFood([np, ...aiSnakes.filter(a => a.alive).map(a => a.segments)], nf);
        if (spawned) nf = [...nf, spawned];
        ns += 10;
      } else {
        np = [newHead, ...np.slice(0, -1)];
      }
    }
  } else if (npa) {
    npa = false;
  }

  // AI mine collision check helper
  const checkMineHitForSnake = (segments) => {
    if (!segments?.length) return false;
    return state.placedMines?.some(m => m.x === segments[0].x && m.y === segments[0].y);
  };

  const na = aiSnakes.map(ai => {
    if (!ai?.alive || !ai?.segments?.length) return ai;
    const allSnakes = [np, ...aiSnakes.filter(a => a.alive).map(a => a.segments)];
    const dir = getAIMove(ai.segments, allSnakes, nf, state.obstacles, state.safeZones);
    if (!dir) return ai;

    const head = ai.segments[0];
    let newHead = { x: head.x + dir.x, y: head.y + dir.y };

    // Portal for AI (map portals)
    for (const pair of state.portals) {
      if (newHead.x === pair.a.x && newHead.y === pair.a.y) {
        newHead = { ...pair.b };
      } else if (newHead.x === pair.b.x && newHead.y === pair.b.y) {
        newHead = { ...pair.a };
      }
    }

    // Portal for AI (player-placed)
    const portalPair = state.portalPair;
    if (portalPair && portalPair.length === 2) {
      if (newHead.x === portalPair[0].x && newHead.y === portalPair[0].y) {
        newHead = { ...portalPair[1] };
      } else if (newHead.x === portalPair[1].x && newHead.y === portalPair[1].y) {
        newHead = { ...portalPair[0] };
      }
    }

    // AI mine collision
    if (checkMineHitForSnake([newHead])) {
      let newFoods = [...(nf || [])];
      for (let j = 0; j < 3; j++) { const f = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments)], newFoods); if (f) newFoods.push(f); }
      return { ...ai, alive: false };
    }

    // AI obstacle collision
    if ((state.obstacles ?? []).some(o => o.x === newHead.x && o.y === newHead.y)) {
      // Treat obstacle like wall - AI dies
      let newFoods = [...(nf || [])];
      for (let j = 0; j < 3; j++) { const f = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments)], newFoods); if (f) newFoods.push(f); }
      return { ...ai, alive: false };
    }

    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      let newFoods = [...(nf || [])];
      for (let j = 0; j < 3; j++) { const f = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments)], newFoods); if (f) newFoods.push(f); }
      return { ...ai, alive: false };
    }
    if (ai.segments.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
      let newFoods = [...(nf || [])];
      for (let j = 0; j < 3; j++) { const f = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments)], newFoods); if (f) newFoods.push(f); }
      return { ...ai, alive: false };
    }
    if (npa && np?.length && newHead.x === np[0].x && newHead.y === np[0].y) {
      let newFoods = [...(nf || [])];
      for (let j = 0; j < ai.segments.length; j++) { const f = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments)], newFoods); if (f) newFoods.push(f); }
      return { ...ai, alive: false };
    }
    let dead = false;
    for (const other of aiSnakes) {
      if (other.id === ai.id || !other.alive) continue;
      if (newHead.x === other.segments[0].x && newHead.y === other.segments[0].y) {
        let newFoods = [...(nf || [])];
        for (let j = 0; j < ai.segments.length; j++) { const f = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments)], newFoods); if (f) newFoods.push(f); }
        dead = true;
        break;
      }
    }
    if (dead) return { ...ai, alive: false };

    const fi = nf?.findIndex ? nf.findIndex(f => f.x === newHead.x && f.y === newHead.y) : -1;
    if (fi >= 0 && nf) {
      const newSegs = [newHead, ...ai.segments];
      const remainingFoods = nf.filter((_, i) => i !== fi);
      const spawned = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments), newSegs], remainingFoods);
      return { ...ai, segments: newSegs };
    }
    return { ...ai, segments: [newHead, ...ai.segments.slice(0, -1)] };
  });

  if (npa && np?.length) {
    for (const ai of na) {
      if (!ai?.alive) continue;
      if (np[0].x === ai.segments[0].x && np[0].y === ai.segments[0].y) {
        ns += 50;
        ai.alive = false;
      }
    }
  }

  // Check player-item collision after movement
  if (npa && np?.length) {
    const itemIdx = (state.items ?? []).findIndex(item => item.x === np[0].x && item.y === np[0].y);
    if (itemIdx >= 0) {
      const item = state.items[itemIdx];
      const newItems = state.items.filter((_, i) => i !== itemIdx);
      const afterItem = applyItemEffect({ ...state, items: newItems }, item);
      return { ...afterItem, playerSnake: np, playerAlive: npa, aiSnakes: na, foods: nf, score: ns };
    }
  }

  return { ...state, playerSnake: np, playerAlive: npa, aiSnakes: na, foods: nf, score: ns };
}

// BOSS battle tick
function tickBoss(state) {
  const { playerSnake, playerDir, playerAlive, bossSnake, foods, score, bossHp, bossSprinting, bossSprintDir, bossSprintTimer, bossSprintCooldown, activeItems } = state;

  // Player movement
  let np = playerSnake, npa = playerAlive, ns = score, nf = foods;
  const ghostActive = isGhostActive(activeItems);
  const shieldActive = hasShield(activeItems);

  if (npa && np?.length) {
    const dir = DIRECTIONS[playerDir];
    const head = np[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    let wallHit = false;
    if (!ghostActive) {
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) wallHit = true;
    } else {
      newHead.x = (newHead.x + GRID_SIZE) % GRID_SIZE;
      newHead.y = (newHead.y + GRID_SIZE) % GRID_SIZE;
    }

    // Check obstacle collision for player
    const playerObstacleHit = !ghostActive && (state.obstacles ?? []).some(o => o.x === newHead.x && o.y === newHead.y);

    if (wallHit || playerObstacleHit) {
      if (shieldActive) {
        np = [newHead, ...np.slice(0, -1)];
        const newActive = activeItems.filter(a => !a.isShield);
        return { ...state, playerSnake: np, playerDir, activeItems: newActive };
      }
      npa = false;
    } else if (np.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
      if (shieldActive) {
        np = [newHead, ...np.slice(0, -1)];
        const newActive = activeItems.filter(a => !a.isShield);
        return { ...state, playerSnake: np, playerDir, activeItems: newActive };
      }
      npa = false;
    } else {
      const fi = nf?.findIndex ? nf.findIndex(f => f.x === newHead.x && f.y === newHead.y) : -1;
      if (fi >= 0 && nf) {
        np = [newHead, ...np];
        nf = nf.filter((_, i) => i !== fi);
        const spawned = spawnFood([np, ...(bossSnake || []).filter(b => b.alive).map(b => b.segments)], nf);
        if (spawned) nf = [...nf, spawned];
        ns += 10;
      } else {
        np = [newHead, ...np.slice(0, -1)];
      }
    }
  } else if (npa) {
    npa = false;
  }

  // BOSS AI movement
  const nb = bossSnake.map(boss => {
    if (!boss?.alive || !boss?.segments?.length) return boss;
    const allSnakes = [np, ...bossSnake.filter(b => b.alive).map(b => b.segments)];

    // BOSS AI: chase player with sprint
    let bossDir = bossSprintDir;
    if (!bossSprinting) {
      // Normal tracking AI: move toward player
      if (np?.length && boss.segments.length) {
        const bossHead = boss.segments[0];
        const playerHead = np[0];
        // Decide direction toward player
        const dx = playerHead.x - bossHead.x;
        const dy = playerHead.y - bossHead.y;
        // Pick dominant axis
        const dirs = [];
        if (dx > 0) dirs.push(DIRECTIONS.RIGHT);
        else if (dx < 0) dirs.push(DIRECTIONS.LEFT);
        if (dy > 0) dirs.push(DIRECTIONS.DOWN);
        else if (dy < 0) dirs.push(DIRECTIONS.UP);
        // Filter safe
        const safe = dirs.filter(dir => {
          const nx = bossHead.x + dir.x, ny = bossHead.y + dir.y;
          if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return false;
          // Check self collision (skip head)
          for (let i = 1; i < boss.segments.length; i++) {
            if (boss.segments[i].x === nx && boss.segments[i].y === ny) return false;
          }
          return true;
        });
        if (safe.length > 0) {
          bossDir = safe[Math.floor(Math.random() * safe.length)];
        } else {
          // Fallback: pick any safe direction
          const allDirs = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];
          const fallback = allDirs.filter(dir => {
            const nx = bossHead.x + dir.x, ny = bossHead.y + dir.y;
            if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return false;
            for (let i = 1; i < boss.segments.length; i++) {
              if (boss.segments[i].x === nx && boss.segments[i].y === ny) return false;
            }
            return true;
          });
          if (fallback.length > 0) bossDir = fallback[Math.floor(Math.random() * fallback.length)];
        }
      }
    }

    if (!bossDir) return boss;

    const head = boss.segments[0];
    // Sprint: move extra fast (extra segment per tick)
    const moveSteps = bossSprinting ? 2 : 1;
    let newSegs = boss.segments;
    for (let step = 0; step < moveSteps; step++) {
      const newHead = { x: head.x + bossDir.x * (step + 1), y: head.y + bossDir.y * (step + 1) };
      // Wall: boss doesn't wrap, just stops at edge
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) break;
      // Self collision: boss shrinks and loses HP
      const selfHit = newSegs.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y);
      if (selfHit) break;
      // Obstacle collision for boss
      if ((state.obstacles ?? []).some(o => o.x === newHead.x && o.y === newHead.y)) break;
      // Head-on collision with player costs HP
      if (npa && np?.length && newHead.x === np[0].x && newHead.y === np[0].y) {
        // Boss hits player head - player dies or loses segment
        npa = false;
      }
      newSegs = [newHead, ...newSegs.slice(0, -1)];
    }
    return { ...boss, segments: newSegs, dir: bossDir };
  });

  // Check player head collision with boss body segments (deal damage to boss)
  let newBossHp = bossHp;
  let newScore = ns;
  let newVictory = false;
  if (npa && np?.length && nb.length > 0) {
    const boss = nb[0];
    if (boss?.alive && boss?.segments?.length) {
      const playerHead = np[0];
      // If player head collides with boss body (not head), boss takes damage
      for (let i = 1; i < boss.segments.length; i++) {
        if (boss.segments[i].x === playerHead.x && boss.segments[i].y === playerHead.y) {
          // Player ate a boss segment - boss loses HP, snake shrinks
          newBossHp = Math.max(0, newBossHp - 1);
          newScore += 100;
          // Shrink boss
          if (boss.segments.length > 1) {
            boss.segments = boss.segments.slice(0, -1);
          }
          if (newBossHp <= 0) {
            newVictory = true;
          }
          break;
        }
      }
      // Player head hits boss head
      if (boss.segments[0].x === playerHead.x && boss.segments[0].y === playerHead.y) {
        npa = false;
      }
    }
  }

  // BOSS sprint logic (cooldown timer tracked in state)
  let newSprintCooldown = bossSprintCooldown;
  let newSprintTimer = bossSprintTimer;
  let newSprinting = bossSprinting;
  let newSprintDir = bossSprintDir;

  if (bossSprinting) {
    newSprintTimer -= TICK_INTERVAL.boss;
    if (newSprintTimer <= 0) {
      newSprinting = false;
      newSprintTimer = 0;
      newSprintCooldown = BOSS_SPRINT_INTERVAL;
    }
  } else {
    newSprintCooldown -= TICK_INTERVAL.boss;
    if (newSprintCooldown <= 0) {
      // Start sprint toward player
      newSprinting = true;
      newSprintTimer = BOSS_SPRINT_DURATION;
      newSprintCooldown = 0;
      if (np?.length && nb[0]?.segments?.length) {
        const bossHead = nb[0].segments[0];
        const playerHead = np[0];
        const dx = playerHead.x - bossHead.x;
        const dy = playerHead.y - bossHead.y;
        if (Math.abs(dx) >= Math.abs(dy)) {
          newSprintDir = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        } else {
          newSprintDir = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        }
      }
    }
  }

  return {
    ...state,
    playerSnake: np,
    playerAlive: npa,
    bossSnake: nb,
    foods: nf,
    score: newScore,
    bossHp: newBossHp,
    bossSprinting: newSprinting,
    bossSprintDir: newSprintDir,
    bossSprintTimer: newSprintTimer,
    bossSprintCooldown: newSprintCooldown,
    victory: newVictory,
    gameOver: !npa || newVictory,
  };
}
