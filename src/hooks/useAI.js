import { useCallback } from 'react';
import { DIRECTIONS, GRID_SIZE } from '../utils/constants';
import { isWallCollision, isSnakeCollision } from '../utils/collision';

// AI personality types
export const AI_PERSONALITIES = {
  GREEDY: 'greedy',     // Default - chase nearest food
  AGGRESSIVE: 'aggressive', // Chase player head when longer, food when shorter
  RANDOM: 'random',     // Pure random safe moves
};

function findNearestFood(head, foods) {
  if (!foods?.length) return null;
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

function findNearestOpponentHead(aiSnake, allSnakes) {
  const aiHead = aiSnake[0];
  let nearest = null;
  let minDist = Infinity;
  for (const snake of allSnakes) {
    if (!snake || snake === aiSnake || !snake.length) continue;
    const head = snake[0];
    // Exclude own head already excluded
    const dist = Math.abs(head.x - aiHead.x) + Math.abs(head.y - aiHead.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = head;
    }
  }
  return nearest;
}

function getSafeDirections(head, allSnakes) {
  const possibleDirections = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];
  return possibleDirections.filter(dir => {
    const nextX = head.x + dir.x;
    const nextY = head.y + dir.y;
    if (isWallCollision(nextX, nextY)) return false;
    for (const snake of allSnakes) {
      if (isSnakeCollision(snake, nextX, nextY, snake === aiSnake)) {
        return false;
      }
    }
    return true;
  });
}

export function useAI() {
  const getAIMove = useCallback((aiSnake, allSnakes, foods, personality = AI_PERSONALITIES.GREEDY) => {
    const head = aiSnake[0];
    const safeDirections = getSafeDirections(head, allSnakes);

    if (safeDirections.length === 0) return null;

    // RANDOM: pure random among safe directions
    if (personality === AI_PERSONALITIES.RANDOM) {
      return safeDirections[Math.floor(Math.random() * safeDirections.length)];
    }

    const nearestFood = findNearestFood(head, foods);

    // GREEDY (default): chase nearest food
    if (personality === AI_PERSONALITIES.GREEDY) {
      if (!nearestFood) {
        return safeDirections[Math.floor(Math.random() * safeDirections.length)];
      }
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
    }

    // AGGRESSIVE: hunt player when longer, chase food when shorter or equal
    if (personality === AI_PERSONALITIES.AGGRESSIVE) {
      const aiLength = aiSnake.length;
      // Find longest opponent
      let longestOpponentLength = 0;
      let targetHead = null;
      for (const snake of allSnakes) {
        if (!snake || snake === aiSnake || !snake.length) continue;
        if (snake.length > longestOpponentLength) {
          longestOpponentLength = snake.length;
          targetHead = snake[0];
        }
      }

      // If we're longest, hunt the player head
      const huntPlayer = targetHead && aiLength >= longestOpponentLength;
      const target = huntPlayer ? targetHead : nearestFood;

      if (!target) {
        return safeDirections[Math.floor(Math.random() * safeDirections.length)];
      }

      let bestDir = safeDirections[0];
      let bestDist = Infinity;
      for (const dir of safeDirections) {
        const nextX = head.x + dir.x;
        const nextY = head.y + dir.y;
        const dist = Math.abs(nextX - target.x) + Math.abs(nextY - target.y);
        // 5% random for aggression variety
        if (Math.random() < 0.05) {
          return dir;
        }
        if (dist < bestDist) {
          bestDist = dist;
          bestDir = dir;
        }
      }
      return bestDir;
    }

    // Fallback: random safe
    return safeDirections[Math.floor(Math.random() * safeDirections.length)];
  }, []);

  return { getAIMove, AI_PERSONALITIES };
}
