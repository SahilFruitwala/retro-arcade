import type { Entity, GameState } from "./types";

const GAME_WIDTH = 50;
const GAME_HEIGHT = 22;
const ENEMY_ROWS = 4;
const ENEMY_COLS = 10;

export function createInitialState(): GameState {
  const enemies: Entity[] = [];
  for (let row = 0; row < ENEMY_ROWS; row++) {
    for (let col = 0; col < ENEMY_COLS; col++) {
      // Different alien types based on row
      let char: string;
      let color: string;
      if (row === 0) {
        char = "/o\\";  // Top row - octopus
        color = "#FF5555";
      } else if (row === 1) {
        char = "<O>";   // Second row - crab
        color = "#FFAA00";
      } else {
        char = "^M^";   // Bottom rows - squid
        color = "#55FF55";
      }
      enemies.push({
        pos: { x: 2 + col * 4, y: 2 + row * 2 },
        char,
        color,
      });
    }
  }

  return {
    player: {
      pos: { x: Math.floor(GAME_WIDTH / 2), y: GAME_HEIGHT - 2 },
      char: "_/A\\_",
      color: "#00FF00",
    },
    enemies,
    bullets: [],
    score: 0,
    gameOver: false,
    won: false,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    enemyDirection: 1,
  };
}

export function movePlayer(state: GameState, direction: -1 | 1): void {
  const newX = state.player.pos.x + direction;
  if (newX >= 2 && newX < state.width - 3) {
    state.player.pos.x = newX;
  }
}

export function shoot(state: GameState): void {
  // Limit to 3 bullets on screen
  if (state.bullets.length >= 3) return;
  
  state.bullets.push({
    pos: { x: state.player.pos.x + 2, y: state.player.pos.y - 1 },
    char: "|",
    color: "#FFFFFF",
  });
}

export function update(state: GameState): void {
  if (state.gameOver || state.won) return;

  // Move bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i]!;
    bullet.pos.y -= 1;
    if (bullet.pos.y < 0) {
      state.bullets.splice(i, 1);
    }
  }

  // Check bullet-enemy collisions
  for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
    const bullet = state.bullets[bi]!;
    for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
      const enemy = state.enemies[ei]!;
      // Check if bullet hits enemy (considering enemy width of 3 chars)
      if (
        bullet.pos.y === enemy.pos.y &&
        bullet.pos.x >= enemy.pos.x &&
        bullet.pos.x < enemy.pos.x + 3
      ) {
        state.bullets.splice(bi, 1);
        state.enemies.splice(ei, 1);
        state.score += 10;
        break;
      }
    }
  }

  // Check win condition
  if (state.enemies.length === 0) {
    state.won = true;
    return;
  }

  // Move enemies
  let shouldDescend = false;
  for (const enemy of state.enemies) {
    if (
      (state.enemyDirection === 1 && enemy.pos.x >= state.width - 5) ||
      (state.enemyDirection === -1 && enemy.pos.x <= 1)
    ) {
      shouldDescend = true;
      break;
    }
  }

  if (shouldDescend) {
    state.enemyDirection *= -1;
    for (const enemy of state.enemies) {
      enemy.pos.y += 1;
      // Check game over
      if (enemy.pos.y >= state.height - 3) {
        state.gameOver = true;
        return;
      }
    }
  } else {
    for (const enemy of state.enemies) {
      enemy.pos.x += state.enemyDirection;
    }
  }
}
