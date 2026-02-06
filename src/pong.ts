import type { PongGameState } from "./types";

export const WINNING_SCORE = 3;
const AI_SPEED = 1; // Integer movement for smoothness

export function initPong(width: number, height: number): PongGameState {
  const paddleHeight = Math.max(5, Math.floor(height / 5));
  
  return {
    playerY: Math.floor(height / 2) - Math.floor(paddleHeight / 2),
    aiY: Math.floor(height / 2) - Math.floor(paddleHeight / 2),
    paddleHeight,
    paddleWidth: 1,
    ballX: Math.floor(width / 2),
    ballY: Math.floor(height / 2),
    ballVX: Math.random() > 0.5 ? 1 : -1,
    ballVY: Math.random() > 0.5 ? 1 : -1, // Integer velocity
    playerScore: 0,
    aiScore: 0,
    paused: false,
    gameOver: false,
    width,
    height,
  };
}

export function movePlayerPaddle(state: PongGameState, direction: number): void {
  if (state.paused || state.gameOver) return;
  
  const newY = Math.round(state.playerY + direction);
  if (newY >= 0 && newY + state.paddleHeight <= state.height) {
    state.playerY = newY;
  }
}

export function updatePong(state: PongGameState): void {
  if (state.paused || state.gameOver) return;

  // Move ball (integer movement)
  state.ballX = Math.round(state.ballX + state.ballVX);
  state.ballY = Math.round(state.ballY + state.ballVY);

  // Ball collision with top/bottom walls
  if (state.ballY <= 0) {
    state.ballY = 0;
    state.ballVY = Math.abs(state.ballVY);
  } else if (state.ballY >= state.height - 1) {
    state.ballY = state.height - 1;
    state.ballVY = -Math.abs(state.ballVY);
  }

  // Ball collision with AI paddle (left side)
  if (state.ballX <= 2 && state.ballX >= 1) {
    if (state.ballY >= state.aiY && state.ballY < state.aiY + state.paddleHeight) {
      state.ballVX = Math.abs(state.ballVX); // Bounce right
      state.ballX = 2; // Prevent sticking
    }
  }

  // Ball collision with player paddle (right side)
  if (state.ballX >= state.width - 3 && state.ballX <= state.width - 2) {
    if (state.ballY >= state.playerY && state.ballY < state.playerY + state.paddleHeight) {
      state.ballVX = -Math.abs(state.ballVX); // Bounce left
      state.ballX = state.width - 3; // Prevent sticking
    }
  }

  // Score detection
  if (state.ballX <= 0) {
    // Ball passed AI - Player scores
    state.playerScore++;
    resetBall(state, 1); // Ball goes toward player
  } else if (state.ballX >= state.width - 1) {
    // Ball passed Player - AI scores
    state.aiScore++;
    resetBall(state, -1); // Ball goes toward AI
  }

  // Check win condition
  if (state.playerScore >= WINNING_SCORE || state.aiScore >= WINNING_SCORE) {
    state.gameOver = true;
  }

  // AI movement - follows ball with integer steps
  const aiCenter = state.aiY + Math.floor(state.paddleHeight / 2);
  const diff = state.ballY - aiCenter;
  
  if (Math.abs(diff) > 1) {
    const move = Math.sign(diff) * AI_SPEED;
    const newAiY = state.aiY + move;
    if (newAiY >= 0 && newAiY + state.paddleHeight <= state.height) {
      state.aiY = Math.round(newAiY);
    }
  }
}

function resetBall(state: PongGameState, direction: number): void {
  state.ballX = Math.floor(state.width / 2);
  state.ballY = Math.floor(state.height / 2);
  state.ballVX = direction;
  state.ballVY = Math.random() > 0.5 ? 1 : -1;
}
