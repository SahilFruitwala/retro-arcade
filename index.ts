import { createCliRenderer, TextRenderable, BoxRenderable } from "@opentui/core";
import type { GameState, Entity, SnakeGameState } from "./src/types";
import { createInitialState, movePlayer, shoot, update, getExplosionChar, getShieldChar } from "./src/game";
import { initSnake, updateSnake, changeDirection } from "./src/snake";
import { loadGame, saveGame, resetProgress, saveSnakeHighScore } from "./src/db";

const renderer = await createCliRenderer({
  exitOnCtrlC: false, // We'll handle it ourselves
  targetFps: 30,
});

// App Types
type AppMode = "MENU" | "GAME";

interface GameOption {
  id: string;
  name: string;
  enabled: boolean;
}

const GAMES: GameOption[] = [
  { id: "space-invaders", name: "SPACE INVADERS", enabled: true },
  { id: "snake", name: "SNAKE", enabled: true },
  { id: "tetris", name: "TETRIS (Coming Soon)", enabled: false },
];

// App State
let appMode: AppMode = "MENU";
let menuSelection = 0;
let currentGameId = "";

// Game States
let invadersState: GameState | null = null;
let hasSavedInvadersScore = false;
let snakeState: SnakeGameState | null = null;
let hasSavedSnakeScore = false;

// Helper to save game state (only for Space Invaders currently)
function doSaveGame(): void {
  if (invadersState) {
    saveGame({
      highScore: invadersState.highScore,
      currentLevel: invadersState.level,
      currentScore: invadersState.score,
      lives: invadersState.lives,
    });
  }
}

// Handle Ctrl+C properly
const handleExit = () => {
  if (appMode === "GAME" && currentGameId === "space-invaders") {
    doSaveGame();
  }
  renderer.destroy();
  process.exit(0);
};

process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);

// UI Components
let container: BoxRenderable;
let titleText: TextRenderable;
let menuText: TextRenderable; // For the menu list
let gameContentLines: TextRenderable[] = []; // Replaces individual text lines for flexibility

// Initialize Global UI Wrapper
function initContainer() {
    if (container) container.destroy();

    container = new BoxRenderable(renderer, {
        id: "app-container",
        flexDirection: "column",
        borderStyle: "double",
        borderColor: "#00FF00",
        padding: 1,
        backgroundColor: "#000000",
    });

    // We'll add children dynamically based on mode
     renderer.root.add(container);
}

function initMenuUI() {
    initContainer();

    titleText = new TextRenderable(renderer, {
        id: "title",
        content: centerText("★ RETRO ARCADE ★", renderer.width),
        fg: "#00FF00",
    });
    container.add(titleText);

    // Spacer
    container.add(new TextRenderable(renderer, { id: "spacer1", content: " " }));

    menuText = new TextRenderable(renderer, {
        id: "menu-list",
        content: "",
        fg: "#FFFFFF",
    });
    container.add(menuText);

    // Instructions
     const instructions = new TextRenderable(renderer, {
        id: "menu-help",
        content: "\n" + centerText("↑/↓ SELECT   ENTER START   CTRL+C EXIT", renderer.width),
        fg: "#555555"
    });
    container.add(instructions);
}

// Original UI refs for Space Invaders
let scoreText: TextRenderable;
let levelText: TextRenderable;
let groundLine: TextRenderable;
let helpText: TextRenderable;
let statusText: TextRenderable;

function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}

// ----------------------------------------------------------------
// MENU LOGIC
// ----------------------------------------------------------------

function renderMenu() {
    // Update Title
    titleText.content = centerText("★ RETRO ARCADE ★", renderer.width);

    // Update Menu List
    const lines: string[] = [];
    lines.push(centerText("CHOOSE YOUR GAME", renderer.width));
    lines.push("");

    GAMES.forEach((game, index) => {
        const prefix = index === menuSelection ? " > " : "   ";
        const suffix = index === menuSelection ? " < " : "   ";
        const name = `${prefix}${game.name}${suffix}`;
        lines.push(centerText(name, renderer.width));
    });

    menuText.content = lines.join("\n");
}

function handleMenuInput(sequence: string): boolean {
    if (sequence === "\u001b[A" || sequence === "w" || sequence === "W") { // Up
        menuSelection--;
        if (menuSelection < 0) menuSelection = GAMES.length - 1;
        renderMenu();
        return true;
    }
    if (sequence === "\u001b[B" || sequence === "s" || sequence === "S") { // Down
        menuSelection++;
        if (menuSelection >= GAMES.length) menuSelection = 0;
        renderMenu();
        return true;
    }
    if (sequence === "\r" || sequence === "\n") { // Enter
        const selected = GAMES[menuSelection];
        if (selected && selected.enabled) {
            startGame(selected.id);
        }
        return true;
    }
    return false;
}

// ----------------------------------------------------------------
// GAME LOGIC WRAPPER
// ----------------------------------------------------------------

function startGame(gameId: string) {
    currentGameId = gameId;
    appMode = "GAME";
    initContainer(); // Clear UI

    if (gameId === "space-invaders") {
        startSpaceInvaders();
    } else if (gameId === "snake") {
        startSnake();
    }
}

function stopGame() {
    if (currentGameId === "space-invaders") {
        doSaveGame();
        invadersState = null;
    } else if (currentGameId === "snake") {
        snakeState = null;
    }
    
    appMode = "MENU";
    currentGameId = "";
    initMenuUI();
    renderMenu();
}

// ----------------------------------------------------------------
// SPACE INVADERS
// ----------------------------------------------------------------

function startSpaceInvaders() {
    const savedGame = loadGame();
    invadersState = createInitialState(
        renderer.width, 
        renderer.height, 
        savedGame.currentLevel, 
        savedGame.highScore
    );
    invadersState.score = savedGame.currentScore;
    invadersState.lives = savedGame.lives;
    hasSavedInvadersScore = false;

    // Build UI
    titleText = new TextRenderable(renderer, {
        id: "game-title",
        content: centerText("★ S P A C E   I N V A D E R S ★", invadersState.width),
        fg: "#00FF00",
    });
    container.add(titleText);

    scoreText = new TextRenderable(renderer, {
        id: "score",
        content: "",
        fg: "#FFFFFF",
    });
    container.add(scoreText);

    levelText = new TextRenderable(renderer, {
        id: "level",
        content: "",
        fg: "#FFFF00",
    });
    container.add(levelText);

    gameContentLines = [];
    for (let i = 0; i < invadersState.height; i++) {
        const line = new TextRenderable(renderer, {
            id: `line-${i}`,
            content: " ".repeat(invadersState.width),
            fg: "#FFFFFF",
        });
        gameContentLines.push(line);
        container.add(line);
    }

    groundLine = new TextRenderable(renderer, {
        id: "ground",
        content: "═".repeat(invadersState.width),
        fg: "#00FF00",
    });
    container.add(groundLine);

    // helpText removed to merge with statusText for consistency

    statusText = new TextRenderable(renderer, {
        id: "status",
        content: "",
        fg: "#FFFF00",
    });
    container.add(statusText);

    renderSpaceInvaders();
}

function renderSpaceInvaders(): void {
  if (renderer.isDestroyed || !invadersState) return;
  const state = invadersState;

  const livesStr = "♥".repeat(state.lives) + "♡".repeat(Math.max(0, 3 - state.lives));
  scoreText.content = centerText(`SCORE ${String(state.score).padStart(5, "0")}    HI ${String(state.highScore).padStart(5, "0")}    ${livesStr}`, state.width);

  levelText.content = centerText(`═══ LEVEL ${state.level} ═══`, state.width);

  const hi = state.highScore;
  if (state.gameOver) {
    statusText.content = centerText(`☠ GAME OVER - SCORE: ${state.score} - HI: ${hi} │ R=Restart │ N=New │ Q=Menu`, state.width);
    statusText.fg = "#FF0000";
  } else if (state.won) {
    statusText.content = centerText(`★ LEVEL COMPLETE! HI: ${hi} - R for next level`, state.width);
    statusText.fg = "#00FF00";
  } else if (state.paused) {
    statusText.content = centerText(`HI: ${hi} │ ⏸ PAUSED - P=Continue`, state.width);
    statusText.fg = "#FFFF00";
  } else {
    statusText.content = centerText(`HI: ${hi} │ ← → MOVE │ SPACE FIRE │ P PAUSE │ Q MENU`, state.width);
    statusText.fg = "#555555";
  }

  const grid: string[][] = [];
  for (let y = 0; y < state.height; y++) {
    grid[y] = [];
    for (let x = 0; x < state.width; x++) {
      grid[y]![x] = " ";
    }
  }

  if (state.ufo.active) {
    const ufoChars = "<O>";
    for (let i = 0; i < ufoChars.length; i++) {
      const x = state.ufo.pos.x + i;
      if (x >= 0 && x < state.width) {
        grid[state.ufo.pos.y]![x] = ufoChars[i]!;
      }
    }
  }

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
  
  for (const exp of state.explosions) {
    if (exp.pos.y >= 0 && exp.pos.y < state.height && exp.pos.x >= 0 && exp.pos.x < state.width) {
      grid[exp.pos.y]![exp.pos.x] = getExplosionChar(exp.frame);
    }
  }
  
  state.bullets.forEach(placeSprite);
  state.enemyBullets.forEach(placeSprite);

  for (let i = 0; i < Math.min(state.height, gameContentLines.length); i++) {
    gameContentLines[i]!.content = grid[i]!.join("");
  }
}

function handleSpaceInvadersInput(sequence: string): boolean {
    if (!invadersState) return false;
    const state = invadersState;

    if (sequence === "q" || sequence === "Q") {
        stopGame();
        return true;
    }
    if (sequence === "n" || sequence === "N") {
        resetProgress();
        invadersState = createInitialState(renderer.width, renderer.height, 1, state.highScore);
        doSaveGame();
        renderSpaceInvaders();
        return true;
    }
    if ((sequence === "r" || sequence === "R") && (state.gameOver || state.won)) {
        const hs = state.highScore;
        const nextLevel = state.won ? state.level + 1 : state.level;
        const nextScore = state.won ? state.score : 0;
        invadersState = createInitialState(renderer.width, renderer.height, nextLevel, hs);
        invadersState.score = nextScore;
        doSaveGame();
        renderSpaceInvaders();
        return true;
    }
    if (sequence === "p" || sequence === "P") {
        state.paused = !state.paused;
        if (state.paused) doSaveGame();
        renderSpaceInvaders();
        return true;
    }
    if (state.gameOver || state.won || state.paused) return false;

    if (sequence === "\x1b[D" || sequence === "a" || sequence === "A") {
        movePlayer(state, -1);
        return true;
    }
    if (sequence === "\x1b[C" || sequence === "d" || sequence === "D") {
        movePlayer(state, 1);
        return true;
    }
    if (sequence === " ") {
        shoot(state);
        return true;
    }
    return false;
}

// ----------------------------------------------------------------
// SNAKE
// ----------------------------------------------------------------

function startSnake() {
    // Snake setup: width is half of renderer width (minus borders) because of double-width chars
    const availableWidth = Math.floor((renderer.width - 2) / 2); // 2 chars per cell
    const availableHeight = renderer.height - 6; // Title + Score + Border = ~6 lines
    
    // Load High Score
    const saved = loadGame();
    snakeState = initSnake(availableWidth, availableHeight, saved.snakeHighScore); 
    hasSavedSnakeScore = false;

    // Build UI
    titleText = new TextRenderable(renderer, {
        id: "game-title",
        content: centerText("🐍 S N A K E 🐍", renderer.width),
        fg: "#00FF00",
    });
    container.add(titleText);

    scoreText = new TextRenderable(renderer, {
        id: "score",
        content: "",
        fg: "#FFFFFF",
    });
    container.add(scoreText);

    // Border Top
    borderTopLine = new TextRenderable(renderer, { id: "border-top", content: " " });
    container.add(borderTopLine);
    
    gameContentLines = [];
    // We need 'height' lines for the game grid
    for (let i = 0; i < snakeState.height; i++) {
        const line = new TextRenderable(renderer, {
            id: `line-${i}`,
            content: "",
            fg: "#FFFFFF",
        });
        gameContentLines.push(line);
        container.add(line);
    }
    
    // Border Bottom
    borderBottomLine = new TextRenderable(renderer, { id: "border-bottom", content: " " });
    container.add(borderBottomLine);
    
    // Status text (instructions)
    statusText = new TextRenderable(renderer, {
        id: "status",
        content: centerText("ARROWS TO MOVE │ R RESTART │ Q MENU", renderer.width),
        fg: "#555555",
    });
    container.add(statusText);

    // Initial render call
    renderSnake();
}

function renderSnake() {
    if (renderer.isDestroyed || !snakeState) return;
    const state = snakeState;
    const width = renderer.width;

    scoreText.content = centerText(`SCORE ${String(state.score).padStart(5, "0")}    HI ${String(state.highScore).padStart(5, "0")}`, width);

    // Status Update
    const hi = state.highScore;
    if (state.gameOver) {
        statusText.content = centerText(`☠ GAME OVER - SCORE: ${state.score} - HI: ${hi} │ R=Restart │ Q=Menu`, width);
        statusText.fg = "#FF0000";
    } else if (state.paused) {
        statusText.content = centerText(`HI: ${hi} │ ⏸ PAUSED - P=Continue`, width);
        statusText.fg = "#FFFF00";
    } else {
        statusText.content = centerText(`HI: ${hi} │ ARROWS TO MOVE │ P PAUSE │ R RESTART │ Q MENU`, width);
        statusText.fg = "#555555";
    }

    // Grid Rendering
    // Reverting ANSI colors as they break the renderer layout.
    // Using distinct characters for visibility.
    // Double width '[]' for snake, '@@' for food.

    const borderChar = "═";
    const sideBorder = "║";
    const cornerTL = "╔";
    const cornerTR = "╗";
    const cornerBL = "╚";
    const cornerBR = "╝";

    // Prepare grid strings
    // Calculate total border width based on snake logical width
    // Each logical cell is 2 chars wide.
    const innerWidth = state.width * 2; 

    // Top Border
    const tb = centerText(`${cornerTL}${borderChar.repeat(innerWidth)}${cornerTR}`, width);
    if (borderTopLine) borderTopLine.content = tb;
    
    // Main Rows
    for (let y = 0; y < state.height; y++) {
        let rowStr = "";
        for (let x = 0; x < state.width; x++) {
            let isSnake = false;
            let isHead = false;
            
            for (let i = 0; i < state.snake.length; i++) {
                if (state.snake[i]!.x === x && state.snake[i]!.y === y) {
                    isSnake = true;
                    if (i === 0) isHead = true;
                    break;
                }
            }
            
            if (isSnake) {
                rowStr += isHead ? "██" : "▒▒"; // Solid block for head, shaded for body
            } else if (state.food.x === x && state.food.y === y) {
                rowStr += "@@"; 
            } else {
                rowStr += " ."; 
            }
        }
        
        if (gameContentLines[y]) {
            gameContentLines[y]!.content = centerText(`${sideBorder}${rowStr}${sideBorder}`, width);
        }
    }
    
    // Bottom Border
    const bb = centerText(`${cornerBL}${borderChar.repeat(innerWidth)}${cornerBR}`, width);
    if (borderBottomLine) borderBottomLine.content = bb;
}

// Helper Refs for Snake
let borderTopLine: TextRenderable;
let borderBottomLine: TextRenderable;

function handleSnakeInput(sequence: string): boolean {
    if (!snakeState) return false;
    const state = snakeState;

    if (sequence === "q" || sequence === "Q") {
        stopGame();
        return true;
    }
    if (sequence === "r" || sequence === "R") {
        snakeState = initSnake(state.width, state.height, state.highScore);
        renderSnake();
        return true;
    }
     if (sequence === "p" || sequence === "P") {
        state.paused = !state.paused;
        renderSnake();
        return true;
    }

    if (state.gameOver || state.paused) return false;

    if (sequence === "\u001b[A" || sequence === "w" || sequence === "W") {
        changeDirection(state, 0, -1);
        return true;
    }
    if (sequence === "\u001b[B" || sequence === "s" || sequence === "S") {
        changeDirection(state, 0, 1);
        return true;
    }
    if (sequence === "\u001b[D" || sequence === "a" || sequence === "A") {
        changeDirection(state, -1, 0);
        return true;
    }
    if (sequence === "\u001b[C" || sequence === "d" || sequence === "D") {
        changeDirection(state, 1, 0);
        return true;
    }
    return false;
}

// ----------------------------------------------------------------
// MAIN LOOPS & HANDLERS
// ----------------------------------------------------------------

// Handle resize
renderer.on("resize", () => {
    if (appMode === "MENU") {
        renderMenu();
    } else if (appMode === "GAME") {
        // Simple restart on resize for now to avoid broken state
         if (currentGameId === "space-invaders") startGame("space-invaders");
         if (currentGameId === "snake") startGame("snake");
    }
});

// Input Handler
renderer.prependInputHandler((sequence: string) => {
    if (renderer.isDestroyed) return false;

    // Global Force Exit
    if (sequence === "\u0003") { // Ctrl+C
        handleExit();
        return true;
    }

    if (appMode === "MENU") {
        return handleMenuInput(sequence);
    } else {
        if (currentGameId === "space-invaders") return handleSpaceInvadersInput(sequence);
        if (currentGameId === "snake") return handleSnakeInput(sequence);
    }
    return false;
});

// Auto-save Loop
setInterval(() => {
  if (!renderer.isDestroyed && appMode === "GAME" && currentGameId === "space-invaders" && invadersState && !invadersState.gameOver && !invadersState.won) {
    doSaveGame();
  }
}, 30000);

// Main Game Loop
let snakeTick = 0;
const gameLoopId = setInterval(() => {
  if (renderer.isDestroyed) {
    clearInterval(gameLoopId);
    return;
  }
  
  if (appMode === "GAME") {
      if (currentGameId === "space-invaders" && invadersState) {
          if (invadersState.score > invadersState.highScore) {
            invadersState.highScore = invadersState.score;
          }
          update(invadersState);
          if (invadersState.gameOver && !hasSavedInvadersScore) {
              doSaveGame();
              hasSavedInvadersScore = true;
          }
          renderSpaceInvaders();
      } else if (currentGameId === "snake" && snakeState) {
          // Snake Loop (slower tick)
          snakeTick++;
          if (snakeTick >= 3) { // Adjust speed
              snakeTick = 0;
              updateSnake(snakeState);
              if (snakeState.gameOver && !hasSavedSnakeScore) {
                  saveSnakeHighScore(snakeState.highScore);
                  hasSavedSnakeScore = true;
              }
          }
          renderSnake();
      }
  }
}, 50);

// Init
initMenuUI();
renderMenu();