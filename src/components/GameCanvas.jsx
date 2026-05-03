import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  GRID_SIZE, TICK_INTERVAL, DIRECTIONS,
  ITEM_TYPES, MAX_ITEMS_ON_MAP, ITEM_SPAWN_MIN_MS, ITEM_SPAWN_MAX_MS,
  ENDLESS_MAX_WAVE, ENDLESS_SPEED_INCREASE_PER_WAVE, ENDLESS_FOOD_DELAY_INCREASE_PER_WAVE, ENDLESS_TOP5_KEY,
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

function spawnFood(allSnakes, existingFoods) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const pos = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
    const occupied = allSnakes.some(snake => snake.some(seg => seg.x === pos.x && seg.y === pos.y))
      || existingFoods.some(f => f.x === pos.x && f.y === pos.y);
    if (!occupied) return pos;
  }
  return null;
}

function spawnItem(allSnakes, existingFoods, existingItems) {
  if (existingItems.length >= MAX_ITEMS_ON_MAP) return null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const pos = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
    const occupied = allSnakes.some(snake => snake.some(seg => seg.x === pos.x && seg.y === pos.y))
      || existingFoods.some(f => f.x === pos.x && f.y === pos.y)
      || existingItems.some(i => i.x === pos.x && i.y === pos.y);
    if (!occupied) {
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

function initState(mode) {
  const playerSnake = createSnake(Math.floor(GRID_SIZE / 2), Math.floor(GRID_SIZE / 2), 3, DIRECTIONS.RIGHT);
  const aiSnakes = mode === 'battle' ? [
    { id: 0, color: '#e94560', segments: createSnake(...Object.values(randomEdge()), 3), alive: true },
    { id: 1, color: '#4d96ff', segments: createSnake(...Object.values(randomEdge()), 3), alive: true },
    { id: 2, color: '#ffd93d', segments: createSnake(...Object.values(randomEdge()), 3), alive: true },
  ] : [];

  const allSnakes = [playerSnake, ...aiSnakes.filter(a => a.alive).map(a => a.segments)];
  const foods = [];
  for (let i = 0; i < (mode === 'battle' ? 5 : 1); i++) {
    const f = spawnFood(allSnakes, foods);
    if (f) foods.push(f);
  }

  return {
    mode,
    playerSnake,
    playerDir: 'RIGHT',
    playerAlive: true,
    aiSnakes,
    foods,
    score: 0,
    gameOver: false,
    paused: false,
    timeLeft: 180,
    initialized: true,
    // Endless mode
    wave: 1,
    waveProgress: 0, // 0 = food remaining, 1 = next wave triggered
    waveAnnounceTimer: 0,
    // Items
    items: [],
    activeItems: [], // { id, endTime, speedMultiplier, isShield, isGhost, isMagnet }
    nextItemSpawn: getRandomSpawnDelay(),
    // Tick speed for endless (base 150)
    baseTickInterval: mode === 'endless' ? 150 : (TICK_INTERVAL[mode] || 150),
  };
}

function getAIMove(aiSnake, allSnakes, foods) {
  if (!aiSnake?.length || !aiSnake[0]) return null;
  const head = aiSnake[0];
  const possible = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];

  const safe = possible.filter(dir => {
    const nx = head.x + dir.x, ny = head.y + dir.y;
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return false;
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

// Apply item effect to state
function applyItemEffect(state, item) {
  const newActive = [...state.activeItems];
  if (item.id === 'SPEED_UP') {
    newActive.push({ id: item.id, endTime: Date.now() + item.duration, speedMultiplier: 1.5, isShield: false, isGhost: false, isMagnet: false });
  } else if (item.id === 'SPEED_DOWN') {
    newActive.push({ id: item.id, endTime: Date.now() + item.duration, speedMultiplier: 0.6, isShield: false, isGhost: false, isMagnet: false });
  } else if (item.id === 'SHIELD') {
    newActive.push({ id: item.id, endTime: null, speedMultiplier: 1.0, isShield: true, isGhost: false, isMagnet: false });
  } else if (item.id === 'GHOST') {
    newActive.push({ id: item.id, endTime: Date.now() + item.duration, speedMultiplier: 1.0, isShield: false, isGhost: true, isMagnet: false });
  } else if (item.id === 'MAGNET') {
    newActive.push({ id: item.id, endTime: Date.now() + item.duration, speedMultiplier: 1.0, isShield: false, isGhost: false, isMagnet: true });
  } else if (item.id === 'GROWTH') {
    // Instant growth +3 segments
    const added = Array.from({ length: 3 }, () => ({ ...state.playerSnake[state.playerSnake.length - 1] }));
    return {
      ...state,
      playerSnake: [...state.playerSnake, ...added],
    };
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
    const spawned = spawnFood([playerSnake], newFoods);
    const waveCoeff = wave;
    // Wave complete?
    if (newFoods.length === 0) {
      const nextWave = Math.min(wave + 1, ENDLESS_MAX_WAVE);
      const newBaseInterval = TICK_INTERVAL.endless * Math.pow(1 - ENDLESS_SPEED_INCREASE_PER_WAVE, wave - 1);
      return {
        ...state,
        playerSnake: [newHead, ...playerSnake],
        foods: spawned ? [spawned] : [],
        score: score + 10 * waveCoeff,
        wave: nextWave,
        waveAnnounceTimer: 60, // 1 second at 60fps
        baseTickInterval: TICK_INTERVAL.endless * Math.pow(1 - ENDLESS_SPEED_INCREASE_PER_WAVE, nextWave - 1),
        waveProgress: 0,
      };
    }
    return {
      ...state,
      playerSnake: [newHead, ...playerSnake],
      foods: spawned ? [...newFoods, spawned] : newFoods,
      score: score + 10 * waveCoeff,
    };
  }

  return { ...state, playerSnake: [newHead, ...playerSnake.slice(0, -1)] };
}

export function GameCanvas({ mode, skin, onBack }) {
  const canvasRef = useRef(null);
  const skinData = getSkin(skin);
  const [state, setState] = useState(() => initState(mode));

  // Sync to mode prop changes (restart)
  useEffect(() => {
    setState(initState(mode));
  }, [mode]);

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
        const updated = prev.activeItems.filter(a => a.endTime === null || a.endTime > now);
        return { ...prev, activeItems: updated };
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

    function drawSnake(segments, color, isGhost = false) {
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i];
        ctx.fillStyle = isGhost ? 'rgba(255,255,255,0.5)' : color;
        ctx.globalAlpha = i === 0 ? 1 : 0.85;
        ctx.fillRect(seg.x * cellSize + 1, seg.y * cellSize + 1, cellSize - 2, cellSize - 2);
        ctx.globalAlpha = 1;
      }
    }

    const ghostActive = isGhostActive(state.activeItems);
    if (playerAlive) drawSnake(playerSnake, skinData.snakeColor, ghostActive);
    for (const ai of aiSnakes) {
      if (ai.alive) drawSnake(ai.segments, ai.color);
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
        <span className="score-display">
          {gameMode === 'endless'
            ? `WAVE ${wave} | 得分：${score}`
            : `${displayTime ? `${displayTime} | ` : ''}得分：${score}`}
        </span>
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
  const { playerSnake, playerDir, foods, score, activeItems } = state;
  const dir = DIRECTIONS[playerDir];
  const head = playerSnake[0];
  const newHead = { x: head.x + dir.x, y: head.y + dir.y };
  const ghostActive = isGhostActive(activeItems);
  const shieldActive = hasShield(activeItems);

  let wallHit = false;
  if (!ghostActive) {
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) wallHit = true;
  } else {
    newHead.x = (newHead.x + GRID_SIZE) % GRID_SIZE;
    newHead.y = (newHead.y + GRID_SIZE) % GRID_SIZE;
  }

  if (wallHit) {
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
    const spawned = spawnFood([nextState.playerSnake], newFoods);
    return {
      ...nextState,
      playerSnake: [newHead, ...nextState.playerSnake],
      foods: spawned ? [...newFoods, spawned] : newFoods,
      score: nextState.score + 10,
    };
  }
  return { ...nextState, playerSnake: [newHead, ...nextState.playerSnake.slice(0, -1)] };
}

function tickBattle(state) {
  const { playerSnake, playerDir, playerAlive, aiSnakes, foods, score } = state;
  let np = playerSnake, npa = playerAlive, nf = foods, ns = score;

  if (npa && np?.length) {
    const dir = DIRECTIONS[playerDir];
    const head = np[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      npa = false;
    } else if (np.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
      npa = false;
    } else {
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

  const na = aiSnakes.map(ai => {
    if (!ai?.alive || !ai?.segments?.length) return ai;
    const allSnakes = [np, ...aiSnakes.filter(a => a.alive).map(a => a.segments)];
    const dir = getAIMove(ai.segments, allSnakes, nf);
    if (!dir) return ai;

    const head = ai.segments[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

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

  return { ...state, playerSnake: np, playerAlive: npa, aiSnakes: na, foods: nf, score: ns };
}
