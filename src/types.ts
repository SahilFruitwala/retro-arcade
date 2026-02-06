export interface Position {
  x: number;
  y: number;
}

export interface Entity {
  pos: Position;
  char: string;
  color: string;
}

export interface Shield {
  pos: Position;
  health: number; // 0-4, different visual states
}

export interface UFO {
  pos: Position;
  active: boolean;
  points: number;
}

export interface Explosion {
  pos: Position;
  frame: number; // Animation frame
}

export interface GameState {
  player: Entity;
  enemies: Entity[];
  bullets: Entity[];
  enemyBullets: Entity[];
  shields: Shield[];
  ufo: UFO;
  explosions: Explosion[];
  score: number;
  highScore: number;
  lives: number;
  level: number;
  gameOver: boolean;
  won: boolean;
  paused: boolean;
  width: number;
  height: number;
  enemyDirection: 1 | -1;
  tickCount: number;
}


export interface SnakeGameState {
  snake: Position[]; // index 0 is head
  direction: Position;
  food: Position;
  score: number;
  highScore: number;
  gameOver: boolean;
  paused: boolean;
  width: number;
  height: number;
}

export interface Pipe {
  x: number;
  gapY: number; // Top Y of the gap
  gapHeight: number;
  passed: boolean;
}

export interface FlappyGameState {
  birdY: number;
  velocity: number;
  pipes: Pipe[];
  score: number;
  highScore: number;
  gameOver: boolean;
  paused: boolean;
  width: number;
  height: number;
  tickCount: number;
}

export interface TwentyFortyEightGameState {
  grid: number[][]; // 4x4 grid
  score: number;
  highScore: number;
  gameOver: boolean;
  won: boolean;
  paused: boolean;
  width: number; // For rendering
  height: number;
}

export interface PongGameState {
  // Paddles
  playerY: number;      // Right paddle (player)
  aiY: number;          // Left paddle (AI)
  paddleHeight: number;
  paddleWidth: number;
  // Ball
  ballX: number;
  ballY: number;
  ballVX: number;       // Velocity X
  ballVY: number;       // Velocity Y
  // Scores
  playerScore: number;
  aiScore: number;
  highScore: number;    // Total player wins
  // Game state
  paused: boolean;
  gameOver: boolean;
  width: number;
  height: number;
}
