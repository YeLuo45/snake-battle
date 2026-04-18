import { GRID_SIZE } from './constants';

export function isWallCollision(x, y) {
  return x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE;
}

export function isSnakeCollision(snake, x, y, excludeHead = false) {
  const body = excludeHead ? snake.slice(1) : snake;
  return body.some(seg => seg.x === x && seg.y === y);
}

export function isHeadToHeadCollision(head1, head2) {
  return head1.x === head2.x && head1.y === head2.y;
}

export function willCollide(snake, direction) {
  const head = snake[0];
  const nextX = head.x + direction.x;
  const nextY = head.y + direction.y;

  if (isWallCollision(nextX, nextY)) return true;
  if (isSnakeCollision(snake, nextX, nextY, true)) return true;

  return false;
}
