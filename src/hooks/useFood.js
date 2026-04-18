import { useState, useCallback } from 'react';
import { GRID_SIZE } from '../utils/constants';

export function useFood() {
  const [foods, setFoods] = useState([]);

  const spawnFood = useCallback((snakes = []) => {
    setFoods(prev => {
      if (prev.length >= 5) return prev; // Max 5 food items on screen

      let newFood;
      let attempts = 0;
      do {
        newFood = {
          x: Math.floor(Math.random() * GRID_SIZE),
          y: Math.floor(Math.random() * GRID_SIZE),
        };
        attempts++;
      } while (
        attempts < 100 &&
        (isOccupied(newFood, prev) || isOccupiedBySnakes(newFood, snakes))
      );

      return [...prev, newFood];
    });
  }, []);

  const removeFood = useCallback((x, y) => {
    setFoods(prev => prev.filter(f => !(f.x === x && f.y === y)));
  }, []);

  const clearFoods = useCallback(() => {
    setFoods([]);
  }, []);

  return { foods, spawnFood, removeFood, clearFoods };
}

function isOccupied(pos, foods) {
  return foods.some(f => f.x === pos.x && f.y === pos.y);
}

function isOccupiedBySnakes(pos, snakes) {
  return snakes.some(snake => snake.some(seg => seg.x === pos.x && seg.y === pos.y));
}
