import { createCliRenderer, TextRenderable, BoxRenderable } from "@opentui/core";
import type { GameState, Entity } from "./src/types";
import { createInitialState, movePlayer, shoot, update, getExplosionChar, getShieldChar } from "./src/game";
import { loadGame, saveGame, resetProgress } from "./src/db";

const renderer = await createCliRenderer({
  exitOnCtrlC: false, // We'll handle it ourselves
  targetFps: 30,
});

// Helper to save game state
function doSaveGame(): void {
  if (state) {
    saveGame({
      highScore: state.highScore,
      currentLevel: state.level,
      currentScore: state.score,
      lives: state.lives,
    });
  }
}

// Handle Ctrl+C properly
const handleExit = () => {
  doSaveGame();
  renderer.destroy();
  process.exit(0);
};

process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);

// Load saved game state
const savedGame = loadGame();

// Initialize state from saved game
let state: GameState = createInitialState(
  renderer.width, 
  renderer.height, 
  savedGame.currentLevel, 
  savedGame.highScore
);
state.score = savedGame.currentScore;
state.lives = savedGame.lives;

// Dynamic text lines storage
let gameLines: TextRenderable[] = [];
let container: BoxRenderable;
let titleText: TextRenderable;
let scoreText: TextRenderable;
let levelText: TextRenderable;
let groundLine: TextRenderable;
let helpText: TextRenderable;
let statusText: TextRenderable;

function buildUI(): void {
  // Clear existing
  if (container) {
    container.destroy();
  }
  
  container = new BoxRenderable(renderer, {
    id: "game-container",
    flexDirection: "column",
    borderStyle: "double",
    borderColor: "#00FF00",
    padding: 1,
    backgroundColor: "#000000",
  });

  titleText = new TextRenderable(renderer, {
    id: "title",
    content: centerText("★ S P A C E   I N V A D E R S ★", state.width),
    fg: "#00FF00",
  });

  scoreText = new TextRenderable(renderer, {
    id: "score",
    content: "",
    fg: "#FFFFFF",
  });

  levelText = new TextRenderable(renderer, {
    id: "level",
    content: "",
    fg: "#FFFF00",
  });

  // Create game lines
  gameLines = [];
  for (let i = 0; i < state.height; i++) {
    gameLines.push(
      new TextRenderable(renderer, {
        id: `line-${i}`,
        content: " ".repeat(state.width),
        fg: "#FFFFFF",
      })
    );
  }

  groundLine = new TextRenderable(renderer, {
    id: "ground",
    content: "═".repeat(state.width),
    fg: "#00FF00",
  });

  helpText = new TextRenderable(renderer, {
    id: "help",
    content: centerText("← → MOVE │ SPACE FIRE │ P PAUSE │ R RESTART │ N NEW GAME", state.width),
    fg: "#555555",
  });

  statusText = new TextRenderable(renderer, {
    id: "status",
    content: "",
    fg: "#FFFF00",
  });

  // Build UI
  container.add(titleText);
  container.add(scoreText);
  container.add(levelText);
  for (const line of gameLines) {
    container.add(line);
  }
  container.add(groundLine);
  container.add(helpText);
  container.add(statusText);
  renderer.root.add(container);
}

function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}



function renderGame(): void {
  if (renderer.isDestroyed) return;

  // Score display
  const livesStr = "♥".repeat(state.lives) + "♡".repeat(Math.max(0, 3 - state.lives));
  scoreText.content = centerText(`SCORE ${String(state.score).padStart(5, "0")}    HI ${String(state.highScore).padStart(5, "0")}    ${livesStr}`, state.width);

  // Level display
  levelText.content = centerText(`═══ LEVEL ${state.level} ═══`, state.width);

  if (state.gameOver) {
    statusText.content = centerText("☠ GAME OVER - R=Continue │ N=New Game", state.width);
    statusText.fg = "#FF0000";
  } else if (state.won) {
    statusText.content = centerText(`★ LEVEL ${state.level} COMPLETE! - Press R for next level`, state.width);
    statusText.fg = "#00FF00";
  } else if (state.paused) {
    statusText.content = centerText("⏸ PAUSED (auto-saved) - Press P to continue", state.width);
    statusText.fg = "#FFFF00";
  } else {
    statusText.content = "";
  }

  // Build game grid
  const grid: string[][] = [];
  for (let y = 0; y < state.height; y++) {
    grid[y] = [];
    for (let x = 0; x < state.width; x++) {
      grid[y]![x] = " ";
    }
  }

  // Place UFO
  if (state.ufo.active) {
    const ufoChars = "<O>";
    for (let i = 0; i < ufoChars.length; i++) {
      const x = state.ufo.pos.x + i;
      if (x >= 0 && x < state.width) {
        grid[state.ufo.pos.y]![x] = ufoChars[i]!;
      }
    }
  }

  // Place shields
  for (const shield of state.shields) {
    if (shield.health > 0) {
      const shieldChar = getShieldChar(shield.health);
      for (let col = -2; col <= 2; col++) {
        const x = shield.pos.x + col;
        if (x >= 0 && x < state.width && shield.pos.y < state.height) {
          grid[shield.pos.y]![x] = shieldChar;
        }
      }
    }
  }

  // Place entities
  const placeSprite = (e: Entity) => {
    if (e.pos.y >= 0 && e.pos.y < state.height) {
      for (let i = 0; i < e.char.length; i++) {
        const x = e.pos.x + i;
        if (x >= 0 && x < state.width) {
          grid[e.pos.y]![x] = e.char[i]!;
        }
      }
    }
  };

  state.enemies.forEach(placeSprite);
  placeSprite(state.player);
  
  // Place explosions
  for (const exp of state.explosions) {
    if (exp.pos.y >= 0 && exp.pos.y < state.height && exp.pos.x >= 0 && exp.pos.x < state.width) {
      grid[exp.pos.y]![exp.pos.x] = getExplosionChar(exp.frame);
    }
  }
  
  // Draw bullets LAST so they appear on top of everything
  state.bullets.forEach(placeSprite);
  state.enemyBullets.forEach(placeSprite);

  // Update text lines
  for (let i = 0; i < Math.min(state.height, gameLines.length); i++) {
    gameLines[i]!.content = grid[i]!.join("");
  }
}

// Handle resize
renderer.on("resize", () => {
  const hs = state.highScore;
  const lvl = state.level;
  const lives = state.lives;
  const score = state.score;
  
  state = createInitialState(renderer.width, renderer.height, lvl, hs);
  state.score = score;
  state.lives = lives;
  
  buildUI();
  renderGame();
});

// Input handling
renderer.prependInputHandler((sequence: string) => {
  if (renderer.isDestroyed) return false;

  // Manual exit handler for Ctrl+C
  if (sequence === "\u0003") {
    handleExit();
    return true;
  }

  // New game (reset progress)
  if (sequence === "n" || sequence === "N") {
    resetProgress();
    state = createInitialState(renderer.width, renderer.height, 1, state.highScore);
    doSaveGame();
    renderGame();
    return true;
  }

  // Restart/Continue
  if ((sequence === "r" || sequence === "R") && (state.gameOver || state.won)) {
    const hs = state.highScore;
    const nextLevel = state.won ? state.level + 1 : state.level;
    const nextScore = state.won ? state.score : 0;
    state = createInitialState(renderer.width, renderer.height, nextLevel, hs);
    state.score = nextScore;
    doSaveGame();
    renderGame();
    return true;
  }
  
  // Pause - also saves game
  if (sequence === "p" || sequence === "P") {
    state.paused = !state.paused;
    if (state.paused) {
      doSaveGame();
    }
    renderGame();
    return true;
  }

  if (state.gameOver || state.won || state.paused) return false;

  // Movement
  if (sequence === "\x1b[D" || sequence === "a" || sequence === "A") {
    movePlayer(state, -1);
    return true;
  }
  if (sequence === "\x1b[C" || sequence === "d" || sequence === "D") {
    movePlayer(state, 1);
    return true;
  }
  // Fire
  if (sequence === " ") {
    shoot(state);
    return true;
  }
  return false;
});

// Build initial UI
buildUI();

// Auto-save every 30 seconds
setInterval(() => {
  if (!renderer.isDestroyed && !state.gameOver && !state.won) {
    doSaveGame();
  }
}, 30000);

// Game loop
const gameLoopId = setInterval(() => {
  if (renderer.isDestroyed) {
    clearInterval(gameLoopId);
    doSaveGame(); // Save on exit
    return;
  }
  
  // Update high score
  if (state.score > state.highScore) {
    state.highScore = state.score;
  }
  
  update(state);
  renderGame();
}, 50);

// Initial render
renderGame();