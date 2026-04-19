import React, { useRef, useEffect, useState } from 'react';
import { GRID_SIZE, TICK_INTERVAL, DIRECTIONS } from '../utils/constants';
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

  // Game tick - runs every tick interval
  useEffect(() => {
    if (state.gameOver || state.paused) return;
    const interval = TICK_INTERVAL[state.mode];

    const tick = () => {
      setState(prev => {
        if (prev.gameOver || prev.paused) return prev;

        if (prev.mode === 'classic') {
          return tickClassic(prev);
        } else {
          return tickBattle(prev);
        }
      });
    };

    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [state.gameOver, state.paused, state.mode]);

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

  // Canvas size
  const canvasSize = Math.min(window.innerWidth - 32, window.innerHeight - 200);
  const cellSize = canvasSize / GRID_SIZE;

  // Draw - runs on every state change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { playerSnake, playerAlive, aiSnakes, foods } = state;

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

    function drawSnake(segments, color) {
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i];
        ctx.fillStyle = color;
        ctx.globalAlpha = i === 0 ? 1 : 0.85;
        ctx.fillRect(seg.x * cellSize + 1, seg.y * cellSize + 1, cellSize - 2, cellSize - 2);
        ctx.globalAlpha = 1;
      }
    }

    if (playerAlive) drawSnake(playerSnake, skinData.snakeColor);
    for (const ai of aiSnakes) {
      if (ai.alive) drawSnake(ai.segments, ai.color);
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

  const { score, timeLeft, gameOver, paused, aiSnakes: aiSnakesState, mode: gameMode } = state;
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

  return (
    <div className="game-wrapper">
      <div className="game-header">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <span className="score-display">
          {displayTime ? `${displayTime} | ` : ''}得分：{score}
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
          ranking={gameMode === 'battle' ? getRanking() : null}
          onRestart={handleRestart}
          onBack={onBack}
        />
      )}
    </div>
  );
}

function tickClassic(state) {
  const { playerSnake, playerDir, foods, score } = state;
  const dir = DIRECTIONS[playerDir];
  const head = playerSnake[0];
  const newHead = { x: head.x + dir.x, y: head.y + dir.y };

  if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
    return { ...state, gameOver: true, playerAlive: false };
  }
  if (playerSnake.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
    return { ...state, gameOver: true, playerAlive: false };
  }

  const foodIdx = foods.findIndex(f => f.x === newHead.x && f.y === newHead.y);
  if (foodIdx >= 0) {
    const newFoods = foods.filter((_, i) => i !== foodIdx);
    const spawned = spawnFood([playerSnake], newFoods);
    return {
      ...state,
      playerSnake: [newHead, ...playerSnake],
      foods: spawned ? [...newFoods, spawned] : newFoods,
      score: score + 10,
    };
  }
  return { ...state, playerSnake: [newHead, ...playerSnake.slice(0, -1)] };
}

function tickBattle(state) {
  const { playerSnake, playerDir, playerAlive, aiSnakes, foods, score } = state;
  let np = playerSnake, npa = playerAlive, nf = foods, ns = score;

  // Move player
  if (npa) {
    const dir = DIRECTIONS[playerDir];
    const head = np[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      npa = false;
    } else if (np.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
      npa = false;
    } else {
      const fi = nf.findIndex(f => f.x === newHead.x && f.y === newHead.y);
      if (fi >= 0) {
        np = [newHead, ...np];
        nf = nf.filter((_, i) => i !== fi);
        const spawned = spawnFood([np, ...aiSnakes.filter(a => a.alive).map(a => a.segments)], nf);
        if (spawned) nf = [...nf, spawned];
        ns += 10;
      } else {
        np = [newHead, ...np.slice(0, -1)];
      }
    }
  }

  // Move AI
  const na = aiSnakes.map(ai => {
    if (!ai.alive) return ai;
    const allSnakes = [np, ...aiSnakes.filter(a => a.alive).map(a => a.segments)];
    const dir = getAIMove(ai.segments, allSnakes, nf);
    if (!dir) return ai;

    const head = ai.segments[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    // Wall
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      let newFoods = [...nf];
      for (let j = 0; j < 3; j++) { const f = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments)], newFoods); if (f) newFoods.push(f); }
      nf = newFoods;
      return { ...ai, alive: false };
    }

    // Self
    if (ai.segments.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
      let newFoods = [...nf];
      for (let j = 0; j < 3; j++) { const f = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments)], newFoods); if (f) newFoods.push(f); }
      nf = newFoods;
      return { ...ai, alive: false };
    }

    // Head-to-head with player
    if (npa && newHead.x === np[0].x && newHead.y === np[0].y) {
      let newFoods = [...nf];
      for (let j = 0; j < ai.segments.length; j++) { const f = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments)], newFoods); if (f) newFoods.push(f); }
      nf = newFoods;
      return { ...ai, alive: false };
    }

    // Head-to-head with other AI
    let dead = false;
    for (const other of aiSnakes) {
      if (other.id === ai.id || !other.alive) continue;
      if (newHead.x === other.segments[0].x && newHead.y === other.segments[0].y) {
        let newFoods = [...nf];
        for (let j = 0; j < ai.segments.length; j++) { const f = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments)], newFoods); if (f) newFoods.push(f); }
        nf = newFoods;
        dead = true;
        break;
      }
    }
    if (dead) return { ...ai, alive: false };

    const fi = nf.findIndex(f => f.x === newHead.x && f.y === newHead.y);
    if (fi >= 0) {
      const newSegs = [newHead, ...ai.segments];
      const remainingFoods = nf.filter((_, i) => i !== fi);
      const spawned = spawnFood([np, ...aiSnakes.filter(a => a.alive && a.id !== ai.id).map(a => a.segments), newSegs], remainingFoods);
      nf = [...remainingFoods, ...(spawned ? [spawned] : [])];
      return { ...ai, segments: newSegs };
    }

    return { ...ai, segments: [newHead, ...ai.segments.slice(0, -1)] };
  });

  // Player eats AI head
  if (npa) {
    for (const ai of na) {
      if (!ai.alive) continue;
      if (np[0].x === ai.segments[0].x && np[0].y === ai.segments[0].y) {
        ns += 50;
        let newFoods = [...nf];
        for (let j = 0; j < ai.segments.length; j++) { const f = spawnFood([np, ...na.filter(a => a.alive && a.id !== ai.id).map(a => a.segments)], newFoods); if (f) newFoods.push(f); }
        nf = newFoods;
        ai.alive = false;
      }
    }
  }

  return { ...state, playerSnake: np, playerAlive: npa, aiSnakes: na, foods: nf, score: ns };
}
