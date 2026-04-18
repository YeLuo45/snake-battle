export const GRID_SIZE = 20;
export const CANVAS_SIZE = Math.min(window.innerWidth, window.innerHeight) * 0.9;
export const CELL_SIZE = CANVAS_SIZE / GRID_SIZE;

export const TICK_INTERVAL = {
  classic: 150,
  battle: 120,
};

export const INITIAL_SNAKE_LENGTH = 3;

export const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};
