import type { FlappyGameState, Pipe } from "./types";

const GRAVITY = 0.15; 
const JUMP_STRENGTH = -0.8; 
const PIPE_SPEED = 0.5;
const PIPE_SPAWN_RATE = 60; // Slightly more space between pipes
const GAP_HEIGHT = 6;

export function initFlappy(width: number, height: number, highScore: number = 0): FlappyGameState {
  return {
    birdY: Math.floor(height / 2),
    velocity: 0,
    pipes: [],
    score: 0,
    highScore,
    gameOver: false,
    paused: false,
    width,
    height: Math.floor(height),
    tickCount: 0,
  };
}

export function jump(state: FlappyGameState): void {
  if (state.gameOver || state.paused) return;
  state.velocity = JUMP_STRENGTH;
}

export function updateFlappy(state: FlappyGameState): void {
  if (state.gameOver || state.paused) return;

  state.tickCount++;

  // Apply gravity
  state.velocity += GRAVITY;
  // Limit fall speed
  if (state.velocity > 1.2) state.velocity = 1.2;

  state.birdY += state.velocity;

  // Pipe Spawning
  if (state.tickCount % PIPE_SPAWN_RATE === 1) { // 1 instead of 0 for slight delay
    const minGapY = 2;
    const maxGapY = state.height - GAP_HEIGHT - 2;
    const gapY = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;
    
    state.pipes.push({
      x: state.width,
      gapY,
      gapHeight: GAP_HEIGHT,
      passed: false
    });
  }

  // Update Pipes
  const birdX = Math.floor(state.width / 4);

  for (let i = state.pipes.length - 1; i >= 0; i--) {
    const pipe = state.pipes[i]!;
    pipe.x -= PIPE_SPEED;

    // Remove if off screen
    if (pipe.x < -4) {
      state.pipes.splice(i, 1);
      continue;
    }

    // Score counting
    if (!pipe.passed && pipe.x < birdX) {
      state.score++;
      if (state.score > state.highScore) state.highScore = state.score;
      pipe.passed = true;
    }

    // Collision Detection
    // Pipe is rendered at Math.floor(pipe.x) and Math.floor(pipe.x) + 1
    const px = Math.floor(pipe.x);
    if (px === birdX || px + 1 === birdX) {
        // We are in the pipe's X.
        // Check Y range. 
        if (state.birdY < pipe.gapY || state.birdY >= pipe.gapY + pipe.gapHeight) {
            state.gameOver = true;
        }
    }
  }

  // Ground/Ceiling Collision
  if (state.birdY < 0 || state.birdY >= state.height) {
    state.gameOver = true;
  }
}
