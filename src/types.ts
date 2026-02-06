export interface Position {
  x: number;
  y: number;
}

export interface Entity {
  pos: Position;
  char: string;
  color: string;
}

export interface GameState {
  player: Entity;
  enemies: Entity[];
  bullets: Entity[];
  score: number;
  gameOver: boolean;
  won: boolean;
  width: number;
  height: number;
  enemyDirection: 1 | -1;
}
