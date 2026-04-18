import { useCallback } from 'react';
import { DIRECTIONS, GRID_SIZE } from '../utils/constants';
import { isWallCollision, isSnakeCollision } from '../utils/collision';

export function useAI() {
  const getAIMove = useCallback((aiSnake, allSnakes, foods) => {
    const head = aiSnake[0];
    const possibleDirections = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];

    // Filter out directions that would cause immediate collision
    const safeDirections = possibleDirections.filter(dir => {
      const nextX = head.x + dir.x;
      const nextY = head.y + dir.y;

      if (isWallCollision(nextX, nextY)) return false;
      // Check collision with any snake body (exclude own head)
      for (const snake of allSnakes) {
        if (isSnakeCollision(snake, nextX, nextY, snake === aiSnake)) {
          return false;
        }
      }
      return true;
    });

    if (safeDirections.length === 0) return null;

    // Find nearest food
    const nearestFood = findNearestFood(head, foods);
    if (!nearestFood) {
      // Random safe move
      return safeDirections[Math.floor(Math.random() * safeDirections.length)];
    }

    // Move towards food (greedy)
    let bestDir = safeDirections[0];
    let bestDist = Infinity;

    for (const dir of safeDirections) {
      const nextX = head.x + dir.x;
      const nextY = head.y + dir.y;
      const dist = Math.abs(nextX - nearestFood.x) + Math.abs(nextY - nearestFood.y);

      // 10% random chance for variety
      if (Math.random() < 0.1) {
        return dir;
      }

      if (dist < bestDist) {
        bestDist = dist;
        bestDir = dir;
      }
    }

    return bestDir;
  }, []);

  return { getAIMove };
}

function findNearestFood(head, foods) {
  if (!foods.length) return null;
  let nearest = null;
  let minDist = Infinity;
  for (const food of foods) {
    const dist = Math.abs(head.x - food.x) + Math.abs(head.y - food.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = food;
    }
  }
  return nearest;
}
