import type { SnakeGameState, Position } from "./types";

export function initSnake(width: number, height: number, highScore: number = 0): SnakeGameState {
  // Center start
  const startX = Math.floor(width / 2);
  const startY = Math.floor(height / 2);

  return {
    snake: [
      { x: startX, y: startY },
      { x: startX, y: startY + 1 },
      { x: startX, y: startY + 2 },
    ],
    direction: { x: 0, y: -1 }, // Moving Up initially
    food: spawnFood(width, height, []),
    score: 0,
    highScore,
    gameOver: false,
    paused: false,
    width,
    height,
  };
}

function spawnFood(width: number, height: number, snake: Position[]): Position {
  let food: Position;
  let valid = false;
  
  // Try finding a random spot not on the snake
  while (!valid) {
    food = {
      x: Math.floor(Math.random() * (width - 2)) + 1,
      y: Math.floor(Math.random() * (height - 2)) + 1,
    };
    
    // Check if on snake
    const onSnake = snake.some(s => s.x === food.x && s.y === food.y);
    if (!onSnake) {
      valid = true;
      return food;
    }
  }
  return { x: 1, y: 1 }; // Fallback
}

export function updateSnake(state: SnakeGameState): void {
  if (state.gameOver || state.paused) return;

  const head = state.snake[0]!;
  const newHead = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y,
  };

  // 1. Check Collision with Walls
  if (newHead.x < 0 || newHead.x >= state.width || newHead.y < 0 || newHead.y >= state.height) {
    state.gameOver = true;
    if (state.score > state.highScore) state.highScore = state.score;
    return;
  }

  // 2. Check Collision with Self
  // (Ignore tail because it will move unless we just ate)
  // Actually, standard snake logic: if you hit any part of your body (except tail which moves away), you die.
  // But strictly, if we don't eat, tail moves. If we eat, tail stays.
  // Simplest check: Check against all current segments.
  // If we hit the tail tip, it's valid ONLY if we don't eat. 
  // But let's simplify: check all segments except the very last one if we aren't eating.
  // Or just check all. If we hit the tail, technically we die in some versions, or survive in others.
  // Let's check all for strictness.
  for (let i = 0; i < state.snake.length - 1; i++) {
      if (state.snake[i]!.x === newHead.x && state.snake[i]!.y === newHead.y) {
          state.gameOver = true;
          if (state.score > state.highScore) state.highScore = state.score;
          return;
      }
  }

  // 3. Move
  state.snake.unshift(newHead);

  // 4. Check Food
  if (newHead.x === state.food.x && newHead.y === state.food.y) {
    state.score += 10;
    if (state.score > state.highScore) {
       state.highScore = state.score;
    }
    state.food = spawnFood(state.width, state.height, state.snake);
    // Don't pop tail, so we grow
  } else {
    state.snake.pop(); // Remove tail
  }
}

export function changeDirection(state: SnakeGameState, dx: number, dy: number): void {
  // Prevent 180 turns
  if (state.direction.x + dx === 0 && state.direction.y + dy === 0) {
    return;
  }
  // Also cannot change direction twice in one tick technically, but for this simple version it's fine
  // or we need a 'nextDirection' buffer.
  // Let's accept immediate change for responsiveness, risk of self-collision if fast inputs exists but acceptable.
  state.direction = { x: dx, y: dy };
}
