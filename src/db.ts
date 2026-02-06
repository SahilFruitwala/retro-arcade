import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const DB_DIR = join(homedir(), ".retro-arcade");
const DB_PATH = join(DB_DIR, "game_save.db");

// Ensure directory exists
try {
  mkdirSync(DB_DIR, { recursive: true });
} catch (e) {
  // Ignore error if it already exists or if we can't create it (Database will likely fail then too)
}

// Initialize database
const db = new Database(DB_PATH, { create: true });

// Create tables
db.run(`
  CREATE TABLE IF NOT EXISTS game_save (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    high_score INTEGER NOT NULL DEFAULT 0,
    current_level INTEGER NOT NULL DEFAULT 1,
    current_score INTEGER NOT NULL DEFAULT 0,
    lives INTEGER NOT NULL DEFAULT 3,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// Ensure a row exists
const existing = db.query("SELECT id FROM game_save WHERE id = 1").get();
if (!existing) {
  db.run("INSERT INTO game_save (id, high_score, current_level, current_score, lives) VALUES (1, 0, 1, 0, 3)");
}

// Migration: Add snake_high_score if missing
try {
  db.run("ALTER TABLE game_save ADD COLUMN snake_high_score INTEGER DEFAULT 0");
} catch (e) {
  // Ignore error if column exists
}

// Migration: Add flappy_high_score if missing
try {
  db.run("ALTER TABLE game_save ADD COLUMN flappy_high_score INTEGER DEFAULT 0");
} catch(e) {
   // Ignore
}

export interface SavedGame {
  highScore: number;
  currentLevel: number;
  currentScore: number;
  lives: number;
  snakeHighScore?: number;
  flappyHighScore?: number;
}

export function loadGame(): SavedGame {
  const row = db.query(`
    SELECT high_score, current_level, current_score, lives, snake_high_score, flappy_high_score
    FROM game_save WHERE id = 1
  `).get() as { high_score: number; current_level: number; current_score: number; lives: number; snake_high_score: number; flappy_high_score: number } | null;
  
  if (!row) {
    return { highScore: 0, currentLevel: 1, currentScore: 0, lives: 3, snakeHighScore: 0, flappyHighScore: 0 };
  }
  
  return {
    highScore: row.high_score,
    currentLevel: row.current_level,
    currentScore: row.current_score,
    lives: row.lives,
    snakeHighScore: row.snake_high_score || 0,
    flappyHighScore: row.flappy_high_score || 0,
  };
}

export function saveGame(data: SavedGame): void {
  db.run(`
    UPDATE game_save 
    SET high_score = ?1,
        current_level = ?2,
        current_score = ?3,
        lives = ?4,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `, [data.highScore, data.currentLevel, data.currentScore, data.lives]);
}

export function saveSnakeHighScore(score: number): void {
    db.run(`UPDATE game_save SET snake_high_score = ?1 WHERE id = 1`, [score]);
}

export function saveFlappyHighScore(score: number): void {
    db.run(`UPDATE game_save SET flappy_high_score = ?1 WHERE id = 1`, [score]);
}

export function resetProgress(): void {
  db.run(`
    UPDATE game_save 
    SET current_level = 1, current_score = 0, lives = 3, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `);
}
