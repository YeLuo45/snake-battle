import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GRID_SIZE, TICK_INTERVAL, DIRECTIONS } from '../utils/constants';
import { getSkin } from '../utils/skins';
import { GameOver } from './GameOver';
import { Controls } from './Controls';

export function GameCanvas({ mode, skin, onBack }) {
  const canvasRef = useRef(null);
  const skinData = getSkin(skin);

  // Refs to avoid stale closures in the game loop
  const gameRef = useRef({
    snake: null,
    dir: DIRECTIONS.RIGHT,
    foods: [],
    aiSnakes: [],
    score: 0,
    gameOver: false,
    paused: false,
    playerAlive: true,
    timeLeft: 180,
  });
  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate(n => n + 1), []);

  const aiSnakesRef = useRef([]);
  const playerAliveRef = useRef(true);

  // Calculate canvas size once
  const canvasSize = Math.min(window.innerWidth, window.innerHeight) * 0.9;
  const cellSize = canvasSize / GRID_SIZE;

  function createSnake() {
    const x = Math.floor(GRID_SIZE / 2);
    const y = Math.floor(GRID_SIZE / 2);
    return Array.from({ length: 3 }, (_, i) => ({ x: x - i, y }));
  }

  function spawnFood(game) {
    let attempts = 0;
    while (attempts < 100) {
      const pos = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      const occupied = game.snake.some(s => s.x === pos.x && s.y === pos.y) ||
        game.foods.some(f => f.x === pos.x && f.y === pos.y) ||
        game.aiSnakes.some(ai => ai.alive && ai.segments.some(s => s.x === pos.x && s.y === pos.y));
      if (!occupied) {
        return pos;
      }
      attempts++;
    }
    return null;
  }

  function initGame() {
    console.log('[INIT] starting');
    const snake = createSnake();
    console.log('[INIT] snake created', snake);
    const game = gameRef.current;
    game.snake = snake;
    game.dir = DIRECTIONS.RIGHT;
    game.score = 0;
    game.gameOver = false;
    game.paused = false;
    game.playerAlive = true;
    game.foods = [];
    game.aiSnakes = [];
    game.timeLeft = 180;
    playerAliveRef.current = true;

    if (mode === 'battle') {
      // Spawn 3 AI snakes BEFORE spawning food (so spawnFood can check AI positions)
      const colors = ['#e94560', '#4d96ff', '#ffd93d'];
      for (let c = 0; c < 3; c++) {
        const edge = Math.floor(Math.random() * 4);
        let x, y, dir;
        if (edge === 0) { x = Math.floor(Math.random() * GRID_SIZE); y = 0; dir = DIRECTIONS.DOWN; }
        else if (edge === 1) { x = GRID_SIZE - 1; y = Math.floor(Math.random() * GRID_SIZE); dir = DIRECTIONS.LEFT; }
        else if (edge === 2) { x = Math.floor(Math.random() * GRID_SIZE); y = GRID_SIZE - 1; dir = DIRECTIONS.UP; }
        else { x = 0; y = Math.floor(Math.random() * GRID_SIZE); dir = DIRECTIONS.RIGHT; }
        game.aiSnakes.push({
          id: c,
          color: colors[c],
          segments: Array.from({ length: 3 }, (_, i) => ({ x: x - i * dir.x, y: y - i * dir.y })),
          direction: dir,
          alive: true,
        });
      }
      aiSnakesRef.current = game.aiSnakes;
    }

    // Spawn initial food
    for (let i = 0; i < (mode === 'battle' ? 5 : 1); i++) {
      const food = spawnFood(game);
      if (food) game.foods.push(food);
    }
  }

  // Initialize on mount
  useEffect(() => {
    initGame();
    rerender();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameRef.current.snake) return;
    const ctx = canvas.getContext('2d');
    const game = gameRef.current;

    // Background
    ctx.fillStyle = skinData.background;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Grid
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

    // Foods
    for (const food of game.foods) {
      ctx.fillStyle = skinData.foodColor;
      ctx.beginPath();
      ctx.arc(food.x * cellSize + cellSize / 2, food.y * cellSize + cellSize / 2, cellSize / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player snake
    if (game.snake && game.playerAlive) {
      for (let i = game.snake.length - 1; i >= 0; i--) {
        const seg = game.snake[i];
        const x = seg.x * cellSize;
        const y = seg.y * cellSize;
        ctx.fillStyle = i === 0 ? skinData.snakeColor : skinData.snakeColor;
        ctx.globalAlpha = i === 0 ? 1 : 0.9;
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = skinData.snakeBorderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      }
    }

    // AI snakes
    for (const ai of game.aiSnakes) {
      if (!ai.alive) continue;
      for (let i = ai.segments.length - 1; i >= 0; i--) {
        const seg = ai.segments[i];
        const x = seg.x * cellSize;
        const y = seg.y * cellSize;
        ctx.fillStyle = i === 0 ? ai.color : ai.color;
        ctx.globalAlpha = i === 0 ? 1 : 0.9;
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        ctx.globalAlpha = 1;
      }
    }
  });

  // AI decision
  function getAIMove(aiSnake, allSnakes, foods) {
    const head = aiSnake[0];
    const possible = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];

    const safe = possible.filter(dir => {
      const nx = head.x + dir.x;
      const ny = head.y + dir.y;
      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return false;
      for (const s of allSnakes) {
        for (let i = s === aiSnake ? 1 : 0; i < s.length; i++) {
          if (s[i].x === nx && s[i].y === ny) return false;
        }
      }
      return true;
    });

    if (!safe.length) return null;

    // Find nearest food
    let nearest = null, minDist = Infinity;
    for (const f of foods) {
      const d = Math.abs(head.x - f.x) + Math.abs(head.y - f.y);
      if (d < minDist) { minDist = d; nearest = f; }
    }

    if (!nearest || Math.random() < 0.1) {
      return safe[Math.floor(Math.random() * safe.length)];
    }

    let best = safe[0], bestDist = Infinity;
    for (const dir of safe) {
      const nx = head.x + dir.x;
      const ny = head.y + dir.y;
      const d = Math.abs(nx - nearest.x) + Math.abs(ny - nearest.y);
      if (d < bestDist) { bestDist = d; best = dir; }
    }
    return best;
  }

  // Game tick
  const tickRef = useRef(null);

  const doTick = useCallback(() => {
    const game = gameRef.current;
    console.log('[TICK]', { gameOver: game.gameOver, paused: game.paused, dir: game.dir, snakeHead: game.snake?.[0] });
    if (game.gameOver || game.paused) return;

    if (mode === 'classic') {
      // Move player
      const head = game.snake[0];
      const newHead = { x: head.x + game.dir.x, y: head.y + game.dir.y };
      console.log('[TICK] classic move', { head, newHead, dir: game.dir });

      // Wall collision
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        console.log('[TICK] wall collision');
        game.gameOver = true;
        game.playerAlive = false;
        playerAliveRef.current = false;
        rerender();
        return;
      }

      // Self collision
      if (game.snake.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
        console.log('[TICK] self collision');
        game.gameOver = true;
        game.playerAlive = false;
        playerAliveRef.current = false;
        rerender();
        return;
      }

      // Food collision
      const foodIdx = game.foods.findIndex(f => f.x === newHead.x && f.y === newHead.y);
      if (foodIdx >= 0) {
        game.foods.splice(foodIdx, 1);
        game.snake = [newHead, ...game.snake];
        game.score += 10;
        const newFood = spawnFood(game);
        if (newFood) game.foods.push(newFood);
      } else {
        game.snake = [newHead, ...game.snake.slice(0, -1)];
      }
    } else {
      // Battle mode
      // Move player
      if (game.playerAlive) {
        const head = game.snake[0];
        const newHead = { x: head.x + game.dir.x, y: head.y + game.dir.y };

        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
          game.playerAlive = false;
          playerAliveRef.current = false;
        } else if (game.snake.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
          game.playerAlive = false;
          playerAliveRef.current = false;
        } else {
          const foodIdx = game.foods.findIndex(f => f.x === newHead.x && f.y === newHead.y);
          if (foodIdx >= 0) {
            game.foods.splice(foodIdx, 1);
            game.snake = [newHead, ...game.snake];
            game.score += 10;
            const nf = spawnFood(game);
            if (nf) game.foods.push(nf);
          } else {
            game.snake = [newHead, ...game.snake.slice(0, -1)];
          }
        }
      }

      // Move AI
      for (const ai of game.aiSnakes) {
        if (!ai.alive) continue;
        const allSnakes = [
          ...game.aiSnakes.filter(a => a.alive).map(a => a.segments),
          game.snake,
        ];
        const dir = getAIMove(ai, allSnakes, game.foods);
        if (!dir) continue;

        const head = ai.segments[0];
        const newHead = { x: head.x + dir.x, y: head.y + dir.y };

        // Wall / self
        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE ||
            ai.segments.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
          ai.alive = false;
          for (let j = 0; j < 3; j++) {
            const nf = spawnFood(game);
            if (nf) game.foods.push(nf);
          }
          continue;
        }

        // Head-to-head with player
        if (game.playerAlive && newHead.x === game.snake[0].x && newHead.y === game.snake[0].y) {
          ai.alive = false;
          for (let j = 0; j < 3; j++) {
            const nf = spawnFood(game);
            if (nf) game.foods.push(nf);
          }
          continue;
        }

        // Head-to-head with other AI
        let headHit = false;
        for (const other of game.aiSnakes) {
          if (other.id === ai.id || !other.alive) continue;
          if (newHead.x === other.segments[0].x && newHead.y === other.segments[0].y) {
            ai.alive = false;
            for (let j = 0; j < 3; j++) {
              const nf = spawnFood(game);
              if (nf) game.foods.push(nf);
            }
            headHit = true;
            break;
          }
        }
        if (headHit) continue;

        const foodIdx = game.foods.findIndex(f => f.x === newHead.x && f.y === newHead.y);
        if (foodIdx >= 0) {
          game.foods.splice(foodIdx, 1);
          ai.segments = [newHead, ...ai.segments];
          const nf = spawnFood(game);
          if (nf) game.foods.push(nf);
        } else {
          ai.segments = [newHead, ...ai.segments.slice(0, -1)];
        }
        ai.direction = dir;
      }

      // Player eats AI head
      for (const ai of game.aiSnakes) {
        if (!ai.alive) continue;
        if (game.playerAlive && game.snake[0].x === ai.segments[0].x && game.snake[0].y === ai.segments[0].y) {
          ai.alive = false;
          game.score += 50;
          for (let j = 0; j < ai.segments.length; j++) {
            const nf = spawnFood(game);
            if (nf) game.foods.push(nf);
          }
        }
      }
    }

    rerender();
  }, [mode, rerender]);

  // Game loop
  useEffect(() => {
    if (gameRef.current.gameOver) return;
    const interval = TICK_INTERVAL[mode];
    tickRef.current = setInterval(doTick, interval);
    return () => clearInterval(tickRef.current);
  }, [doTick, mode]);

  // Timer for battle mode
  useEffect(() => {
    if (mode !== 'battle') return;
    const timer = setInterval(() => {
      if (gameRef.current.gameOver || gameRef.current.paused) return;
      gameRef.current.timeLeft--;
      if (gameRef.current.timeLeft <= 0) {
        gameRef.current.gameOver = true;
        rerender();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [rerender, mode]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e) => {
      const game = gameRef.current;
      if (game.gameOver) return;
      const keyMap = {
        ArrowUp: 'UP', KeyW: 'UP',
        ArrowDown: 'DOWN', KeyS: 'DOWN',
        ArrowLeft: 'LEFT', KeyA: 'LEFT',
        ArrowRight: 'RIGHT', KeyD: 'RIGHT',
        Space: 'PAUSE',
      };
      const action = keyMap[e.code];
      if (action === 'PAUSE') {
        game.paused = !game.paused;
        rerender();
      } else if (action) {
        e.preventDefault();
        const newDir = DIRECTIONS[action];
        // Prevent reverse
        if (newDir.x !== -game.dir.x || newDir.y !== -game.dir.y) {
          game.dir = newDir;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleDirection = (dir) => {
    const game = gameRef.current;
    const newDir = DIRECTIONS[dir];
    if (newDir.x !== -game.dir.x || newDir.y !== -game.dir.y) {
      game.dir = newDir;
    }
  };

  const handlePause = () => {
    gameRef.current.paused = !gameRef.current.paused;
    rerender();
  };

  const handleRestart = () => {
    initGame();
    rerender();
  };

  const game = gameRef.current;
  const displayScore = game.score;
  const displayTime = mode === 'battle' ? `${Math.floor(game.timeLeft / 60)}:${String(game.timeLeft % 60).padStart(2, '0')}` : null;

  const getRanking = () => {
    const entries = [
      { name: '你', score: game.score, isPlayer: true },
      ...game.aiSnakes.map((ai, i) => ({
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
          {displayTime ? `${displayTime} | ` : ''}得分：{displayScore}
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

      {game.paused && !game.gameOver && (
        <div className="modal-overlay" onClick={handlePause}>
          <div className="modal">
            <h2>已暂停</h2>
            <button className="modal-btn primary" onClick={handlePause}>继续</button>
          </div>
        </div>
      )}

      {game.gameOver && (
        <GameOver
          score={game.score}
          highScore={0}
          isBattle={mode === 'battle'}
          ranking={mode === 'battle' ? getRanking() : null}
          onRestart={handleRestart}
          onBack={onBack}
        />
      )}
    </div>
  );
}
