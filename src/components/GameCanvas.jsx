import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GRID_SIZE, CANVAS_SIZE, CELL_SIZE, TICK_INTERVAL, DIRECTIONS } from '../utils/constants';
import { getSkin } from '../utils/skins';
import { useGameLoop } from '../hooks/useGameLoop';
import { useAI } from '../hooks/useAI';
import { useStorage } from '../hooks/useStorage';
import { GameOver } from './GameOver';
import { Controls } from './Controls';

export function GameCanvas({ mode, skin, onBack }) {
  const canvasRef = useRef(null);
  const skinData = getSkin(skin);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes for battle

  // Player snake state
  const [playerSnake, setPlayerSnake] = useState(() => createSnake());
  const [playerDir, setPlayerDir] = useState(DIRECTIONS.RIGHT);
  const [playerAlive, setPlayerAlive] = useState(true);

  // Battle mode state
  const [aiSnakes, setAiSnakes] = useState([]);
  const [foods, setFoods] = useState([]);

  // High score
  const [highScore, setHighScore] = useStorage(
    mode === 'classic' ? 'snake-classic-highscore' : 'snake-battle-highscore',
    0
  );

  const { getAIMove } = useAI();

  function createSnake() {
    const x = Math.floor(GRID_SIZE / 2);
    const y = Math.floor(GRID_SIZE / 2);
    return Array.from({ length: 3 }, (_, i) => ({ x: x - i, y }));
  }

  // Initialize game
  useEffect(() => {
    if (mode === 'battle') {
      // Spawn 3 AI snakes
      const ais = [
        createAISnake('red'),
        createAISnake('blue'),
        createAISnake('yellow'),
      ];
      setAiSnakes(ais);
      setFoods([]);
      // Spawn initial foods
      for (let i = 0; i < 5; i++) {
        spawnFood([...ais, { segments: playerSnake }], setFoods);
      }
      setTimeLeft(180);
    } else {
      // Classic mode - one food
      spawnFood([{ segments: playerSnake }], setFoods);
    }
    setScore(0);
    setGameOver(false);
    setPlayerAlive(true);
  }, [mode]);

  function createAISnake(color) {
    const edge = Math.floor(Math.random() * 4);
    let x, y, dir;
    if (edge === 0) { x = Math.floor(Math.random() * GRID_SIZE); y = 0; dir = DIRECTIONS.DOWN; }
    else if (edge === 1) { x = GRID_SIZE - 1; y = Math.floor(Math.random() * GRID_SIZE); dir = DIRECTIONS.LEFT; }
    else if (edge === 2) { x = Math.floor(Math.random() * GRID_SIZE); y = GRID_SIZE - 1; dir = DIRECTIONS.UP; }
    else { x = 0; y = Math.floor(Math.random() * GRID_SIZE); dir = DIRECTIONS.RIGHT; }
    return {
      id: Math.random(),
      color,
      segments: Array.from({ length: 3 }, (_, i) => ({ x: x - i * dir.x, y: y - i * dir.y })),
      direction: dir,
      alive: true,
    };
  }

  function spawnFood(allSnakes, setFoodsFn) {
    setFoodsFn(prev => {
      if (prev.length >= 8) return prev;
      let attempts = 0;
      let pos;
      do {
        pos = {
          x: Math.floor(Math.random() * GRID_SIZE),
          y: Math.floor(Math.random() * GRID_SIZE),
        };
        attempts++;
      } while (attempts < 100 && (
        prev.some(f => f.x === pos.x && f.y === pos.y) ||
        allSnakes.some(s => s.segments?.some(seg => seg.x === pos.x && seg.y === pos.y))
      ));
      return [...prev, pos];
    });
  }

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = CANVAS_SIZE;

    // Background
    ctx.fillStyle = skinData.background;
    ctx.fillRect(0, 0, size, size);

    // Grid
    ctx.strokeStyle = skinData.gridColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(size, i * CELL_SIZE);
      ctx.stroke();
    }

    // Foods
    for (const food of foods) {
      ctx.fillStyle = skinData.foodColor;
      ctx.beginPath();
      ctx.arc(
        food.x * CELL_SIZE + CELL_SIZE / 2,
        food.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Player snake
    if (playerAlive) {
      drawSnake(ctx, playerSnake, skinData.snakeColor, skinData.snakeBorderColor);
    }

    // AI snakes
    for (const ai of aiSnakes) {
      if (ai.alive) {
        drawSnake(ctx, ai.segments, ai.color, darken(ai.color));
      }
    }
  }, [playerSnake, aiSnakes, foods, skinData, playerAlive]);

  function drawSnake(ctx, segments, color, borderColor) {
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      const x = seg.x * CELL_SIZE;
      const y = seg.y * CELL_SIZE;

      ctx.fillStyle = i === 0 ? lighten(color) : color;
      ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

      // Border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  }

  function lighten(color) {
    return color + 'cc';
  }

  function darken(color) {
    // Simple darken by reducing brightness
    return color;
  }

  // Game tick
  const tickRef = useRef(null);

  const doTick = useCallback(() => {
    if (paused || gameOver) return;

    if (mode === 'classic') {
      // Move player
      setPlayerSnake(prev => {
        const head = prev[0];
        const newHead = { x: head.x + playerDir.x, y: head.y + playerDir.y };

        // Wall collision
        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
          setPlayerAlive(false);
          setGameOver(true);
          return prev;
        }

        // Self collision
        if (prev.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
          setPlayerAlive(false);
          setGameOver(true);
          return prev;
        }

        const eaten = foods.some(f => f.x === newHead.x && f.y === newHead.y);
        if (eaten) {
          setFoods(prev => prev.filter(f => !(f.x === newHead.x && f.y === newHead.y)));
          spawnFood([{ segments: [...prev] }], setFoods);
          setScore(s => s + 10);
          return [newHead, ...prev];
        }

        return [newHead, ...prev.slice(0, -1)];
      });
    } else {
      // Battle mode
      // Move player
      if (playerAlive) {
        setPlayerSnake(prev => {
          const head = prev[0];
          const newHead = { x: head.x + playerDir.x, y: head.y + playerDir.y };

          if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
            setPlayerAlive(false);
            return prev;
          }
          if (prev.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
            setPlayerAlive(false);
            return prev;
          }

          const eaten = foods.some(f => f.x === newHead.x && f.y === newHead.y);
          if (eaten) {
            setFoods(prev => prev.filter(f => !(f.x === newHead.x && f.y === newHead.y)));
            setScore(s => s + 10);
            spawnFood([], setFoods);
            return [newHead, ...prev];
          }
          return [newHead, ...prev.slice(0, -1)];
        });
      }

      // Move AI
      setAiSnakes(prev => {
        return prev.map(ai => {
          if (!ai.alive) return ai;

          const allSnakes = [...prev.filter(a => a.alive).map(a => a.segments), playerSnake];
          const dir = getAIMove(ai.segments, allSnakes, foods);
          if (!dir) return ai;

          const head = ai.segments[0];
          const newHead = { x: head.x + dir.x, y: head.y + dir.y };

          // Wall
          if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
            return { ...ai, alive: false };
          }

          // Self
          if (ai.segments.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
            return { ...ai, alive: false };
          }

          // Player collision
          if (playerAlive && newHead.x === playerSnake[0].x && newHead.y === playerSnake[0].y) {
            return { ...ai, alive: false };
          }

          // Other AI head-to-head
          for (const other of prev) {
            if (other.id !== ai.id && other.alive) {
              if (newHead.x === other.segments[0].x && newHead.y === other.segments[0].y) {
                return { ...ai, alive: false };
              }
            }
          }

          const eaten = foods.some(f => f.x === newHead.x && f.y === newHead.y);
          if (eaten) {
            setFoods(prev => prev.filter(f => !(f.x === newHead.x && f.y === newHead.y)));
            spawnFood([], setFoods);
            return { ...ai, segments: [newHead, ...ai.segments], direction: dir };
          }

          return { ...ai, segments: [newHead, ...ai.segments.slice(0, -1)], direction: dir };
        });
      });

      // Check player eating AI
      setAiSnakes(prev => {
        const newAISnakes = [...prev];
        let playerAte = false;

        for (let i = 0; i < newAISnakes.length; i++) {
          const ai = newAISnakes[i];
          if (!ai.alive) continue;

          if (playerSnake[0].x === ai.segments[0].x && playerSnake[0].y === ai.segments[0].y) {
            newAISnakes[i] = { ...ai, alive: false };
            playerAte = true;
            // Drop food
            for (let j = 0; j < ai.segments.length; j++) {
              spawnFood([], setFoods);
            }
          }
        }

        if (playerAte) {
          setScore(s => s + 50);
        }

        return newAISnakes;
      });
    }
  }, [mode, paused, gameOver, playerDir, playerSnake, foods, playerAlive, aiSnakes, getAIMove]);

  // Game loop
  const running = !paused && !gameOver;
  const interval = TICK_INTERVAL[mode];

  useEffect(() => {
    if (running) {
      const id = setInterval(doTick, interval);
      return () => clearInterval(id);
    }
  }, [doTick, running, interval]);

  // Timer for battle mode
  useEffect(() => {
    if (mode !== 'battle' || !running) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [mode, running]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e) => {
      if (gameOver) return;
      const keyMap = {
        ArrowUp: 'UP', KeyW: 'UP',
        ArrowDown: 'DOWN', KeyS: 'DOWN',
        ArrowLeft: 'LEFT', KeyA: 'LEFT',
        ArrowRight: 'RIGHT', KeyD: 'RIGHT',
        Space: 'PAUSE',
      };
      const action = keyMap[e.code];
      if (action === 'PAUSE') {
        setPaused(p => !p);
      } else if (action) {
        e.preventDefault();
        setPlayerDir(DIRECTIONS[action]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [gameOver]);

  // Check game over conditions
  useEffect(() => {
    if (gameOver) {
      if (score > highScore) {
        setHighScore(score);
      }
    }
  }, [gameOver, score]);

  const handleRestart = () => {
    setPlayerSnake(createSnake());
    setPlayerDir(DIRECTIONS.RIGHT);
    setPlayerAlive(true);
    setScore(0);
    setFoods([]);
    if (mode === 'battle') {
      setAiSnakes([
        createAISnake('red'),
        createAISnake('blue'),
        createAISnake('yellow'),
      ]);
      setTimeLeft(180);
    }
    setGameOver(false);
    setPaused(false);
    // Re-spawn food
    if (mode === 'classic') {
      spawnFood([{ segments: createSnake() }], setFoods);
    } else {
      for (let i = 0; i < 5; i++) spawnFood([], setFoods);
    }
  };

  const handleDirection = (dir) => {
    setPlayerDir(DIRECTIONS[dir]);
  };

  // Ranking for battle mode
  const getRanking = () => {
    const entries = [
      { name: '你', score, isPlayer: true },
      ...aiSnakes.map((ai, i) => ({
        name: `AI ${['红', '蓝', '黄'][i]}`,
        score: (ai.segments.length - 3) * 10,
        isPlayer: false,
      })).filter(e => e.score >= 0),
    ];
    return entries.sort((a, b) => b.score - a.score);
  };

  return (
    <div className="game-wrapper">
      <div className="game-header">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <span className="score-display">
          {mode === 'battle' ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')} | ` : ''}
          得分：{score}
        </span>
        <div />
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ background: skinData.background }}
      />

      <Controls onDirection={handleDirection} onPause={() => setPaused(p => !p)} />

      {paused && (
        <div className="modal-overlay" onClick={() => setPaused(false)}>
          <div className="modal">
            <h2>已暂停</h2>
            <button className="modal-btn primary" onClick={() => setPaused(false)}>继续</button>
          </div>
        </div>
      )}

      {gameOver && (
        <GameOver
          score={score}
          highScore={highScore}
          isBattle={mode === 'battle'}
          ranking={mode === 'battle' ? getRanking() : null}
          onRestart={handleRestart}
          onBack={onBack}
        />
      )}
    </div>
  );
}
