import { useState, useCallback } from 'react';
import { GRID_SIZE, INITIAL_SNAKE_LENGTH, DIRECTIONS } from '../utils/constants';
import { isWallCollision, isSnakeCollision } from '../utils/collision';

export function useSnake() {
  const [snake, setSnake] = useState(() => createInitialSnake());
  const [direction, setDirection] = useState(DIRECTIONS.RIGHT);
  const [alive, setAlive] = useState(true);

  function createInitialSnake() {
    const x = Math.floor(GRID_SIZE / 2);
    const y = Math.floor(GRID_SIZE / 2);
    const snake = [];
    for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
      snake.push({ x: x - i, y });
    }
    return snake;
  }

  const resetSnake = useCallback(() => {
    setSnake(createInitialSnake());
    setDirection(DIRECTIONS.RIGHT);
    setAlive(true);
  }, []);

  const move = useCallback((grow = false) => {
    setSnake(prev => {
      if (!prev.length) return prev;
      const head = prev[0];
      const newHead = {
        x: head.x + direction.x,
        y: head.y + direction.y,
      };

      // Wall collision
      if (isWallCollision(newHead.x, newHead.y)) {
        setAlive(false);
        return prev;
      }

      // Self collision (skip head)
      if (isSnakeCollision(prev, newHead.x, newHead.y, true)) {
        setAlive(false);
        return prev;
      }

      const newSnake = [newHead, ...prev];
      if (!grow) {
        newSnake.pop();
      }
      return newSnake;
    });
  }, [direction]);

  const setDirectionSafe = useCallback((newDir) => {
    // Prevent reversing direction
    if (newDir.x === -direction.x && newDir.y === -direction.y) return;
    if (newDir.x === direction.x && newDir.y === direction.y) return;
    setDirection(newDir);
  }, [direction]);

  return { snake, direction, alive, move, resetSnake, setDirection: setDirectionSafe, setAlive };
}
