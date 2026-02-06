import { createCliRenderer, TextRenderable, BoxRenderable } from "@opentui/core";
import type { GameState, Entity } from "./src/types";
import { createInitialState, movePlayer, shoot, update } from "./src/game";

const state: GameState = createInitialState();

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 30,
});

// Create a container box - classic look
const container = new BoxRenderable(renderer, {
  id: "game-container",
  flexDirection: "column",
  borderStyle: "double",
  borderColor: "#00FF00",
  padding: 1,
  backgroundColor: "#000000",
});

// Pre-create text renderables for the game grid
const titleText = new TextRenderable(renderer, {
  id: "title",
  content: "╔══════════════════════════════════════════════════╗",
  fg: "#00FF00",
});

const titleLine = new TextRenderable(renderer, {
  id: "title-line",
  content: "║          S P A C E   I N V A D E R S             ║",
  fg: "#00FF00",
});

const titleBottom = new TextRenderable(renderer, {
  id: "title-bottom",
  content: "╚══════════════════════════════════════════════════╝",
  fg: "#00FF00",
});

const scoreText = new TextRenderable(renderer, {
  id: "score",
  content: `  SCORE: ${String(state.score).padStart(6, "0")}                    LIVES: ♥♥♥`,
  fg: "#FFFFFF",
});

const gameLines: TextRenderable[] = [];
for (let i = 0; i < state.height; i++) {
  gameLines.push(
    new TextRenderable(renderer, {
      id: `line-${i}`,
      content: " ".repeat(state.width),
      fg: "#FFFFFF",
    })
  );
}

const groundLine = new TextRenderable(renderer, {
  id: "ground",
  content: "═".repeat(state.width),
  fg: "#00FF00",
});

const helpText = new TextRenderable(renderer, {
  id: "help",
  content: "  [←] [→] MOVE    [SPACE] FIRE    [Ctrl+C] QUIT",
  fg: "#888888",
});

const gameOverText = new TextRenderable(renderer, {
  id: "gameover",
  content: "",
  fg: "#FF0000",
});

// Build the static UI structure once
container.add(titleText);
container.add(titleLine);
container.add(titleBottom);
container.add(scoreText);
for (const line of gameLines) {
  container.add(line);
}
container.add(groundLine);
container.add(helpText);
container.add(gameOverText);
renderer.root.add(container);

function renderGame(): void {
  if (renderer.isDestroyed) return;

  if (state.gameOver) {
    gameOverText.content = "         ╔═══════════════════════╗";
    gameOverText.fg = "#FF0000";
    return;
  }

  if (state.won) {
    gameOverText.content = "         ║    YOU WIN! +1000     ║";
    gameOverText.fg = "#00FF00";
    return;
  }

  // Update score
  scoreText.content = `  SCORE: ${String(state.score).padStart(6, "0")}                    LIVES: ♥♥♥`;

  // Build game grid
  const grid: string[][] = [];
  for (let y = 0; y < state.height; y++) {
    grid[y] = [];
    for (let x = 0; x < state.width; x++) {
      grid[y]![x] = " ";
    }
  }

  // Place entities (multi-character sprites)
  const placeSprite = (e: Entity) => {
    if (e.pos.y >= 0 && e.pos.y < state.height) {
      for (let i = 0; i < e.char.length; i++) {
        const x = e.pos.x + i;
        if (x >= 0 && x < state.width) {
          const row = grid[e.pos.y];
          if (row) row[x] = e.char[i]!;
        }
      }
    }
  };

  state.enemies.forEach(placeSprite);
  state.bullets.forEach(placeSprite);
  placeSprite(state.player);

  // Update text line contents
  for (let i = 0; i < state.height; i++) {
    gameLines[i]!.content = grid[i]!.join("");
  }
}

// Input handling - use prependInputHandler to run before built-in handlers
renderer.prependInputHandler((sequence: string) => {
  if (renderer.isDestroyed) return false;
  if (state.gameOver || state.won) return false;

  // Left arrow
  if (sequence === "\x1b[D" || sequence === "a" || sequence === "A") {
    movePlayer(state, -1);
    renderGame();
    return true;
  }
  // Right arrow
  if (sequence === "\x1b[C" || sequence === "d" || sequence === "D") {
    movePlayer(state, 1);
    renderGame();
    return true;
  }
  // Space bar
  if (sequence === " ") {
    shoot(state);
    renderGame();
    return true;
  }
  return false;
});

// Game loop - faster for smoother gameplay
const gameLoopId = setInterval(() => {
  if (renderer.isDestroyed) {
    clearInterval(gameLoopId);
    return;
  }
  update(state);
  renderGame();
}, 150);

// Initial render
renderGame();