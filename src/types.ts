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
