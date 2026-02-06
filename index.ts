import { createCliRenderer, TextRenderable, BoxRenderable } from "@opentui/core";
import type { GameState, Entity, SnakeGameState, FlappyGameState, TwentyFortyEightGameState } from "./src/types";
import { createInitialState, movePlayer, shoot, update, getExplosionChar, getShieldChar } from "./src/invaders";
import { initSnake, updateSnake, changeDirection } from "./src/snake";
import { initFlappy, updateFlappy, jump } from "./src/flappy";
import { init2048, move as move2048 } from "./src/2048";
import { loadGame, saveGame, resetProgress, saveSnakeHighScore, saveFlappyHighScore, saveTwentyFortyEightHighScore } from "./src/db";

const renderer = await createCliRenderer({
  exitOnCtrlC: true, // Let OpenTUI handle Ctrl+C to ensure it works in binaries
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
  { id: "flappy", name: "FLAPPY BIRD", enabled: true },
  { id: "2048", name: "2048", enabled: true }
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
let flappyState: FlappyGameState | null = null;
let hasSavedFlappyScore = false;
let twentyFortyEightState: TwentyFortyEightGameState | null = null;
let hasSaved2048Score = false;

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

// Cleanup on exit
process.on("exit", () => {
    if (appMode === "GAME" && currentGameId === "space-invaders") {
        doSaveGame();
    }
});

// Explicitly handle SIGINT/SIGTERM to ensure the exit event fires
process.on("SIGINT", () => {
    process.exit(0);
});
process.on("SIGTERM", () => {
    process.exit(0);
});

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
    } else if (gameId === "flappy") {
        startFlappy();
    } else if (gameId === "2048") {
        start2048();
    }
}

function stopGame() {
    if (currentGameId === "space-invaders") {
        doSaveGame();
        invadersState = null;
    } else if (currentGameId === "snake") {
        snakeState = null;
    } else if (currentGameId === "flappy") {
        flappyState = null;
    } else if (currentGameId === "2048") {
        twentyFortyEightState = null;
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
    initContainer();
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
        if (state.won) {
            saveGame({
                highScore: state.highScore,
                currentLevel: state.level + 1,
                currentScore: state.score,
                lives: 3
            });
        } else {
            saveGame({
                highScore: state.highScore,
                currentLevel: state.level,
                currentScore: 0,
                lives: 3
            });
        }
        startSpaceInvaders();
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
    initContainer();
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
        startSnake();
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
// FLAPPY BIRD
// ----------------------------------------------------------------

function startFlappy() {
    initContainer();
    // Calculate safe dimensions
    // Container: Border(2) + Padding(2) = 4 deduction
    // Header/Footer: Title(1) + Score(1) + BorderTop(1) + Status(1) = 4 lines
    const safeWidth = renderer.width - 6; // Extra safety margin
    const safeHeight = Math.max(10, renderer.height - 10);

    const saved = loadGame();
    flappyState = initFlappy(safeWidth, safeHeight, saved.flappyHighScore);
    hasSavedFlappyScore = false;

    // Build UI
    titleText = new TextRenderable(renderer, {
        id: "game-title",
        content: centerText("🐦 FLAPPY BIRD 🐦", safeWidth),
        fg: "#FFFF00",
    });
    container.add(titleText);

    scoreText = new TextRenderable(renderer, {
        id: "score",
        content: "",
        fg: "#FFFFFF",
    });
    container.add(scoreText);

    // Border Top
    container.add(new TextRenderable(renderer, { id: "border-top", content: "─".repeat(safeWidth) }));

    gameContentLines = [];
    for (let i = 0; i < flappyState.height; i++) {
        const line = new TextRenderable(renderer, {
            id: `line-${i}`,
            content: "",
            fg: "#FFFFFF",
        });
        gameContentLines.push(line);
        container.add(line);
    }

    statusText = new TextRenderable(renderer, {
        id: "status",
        content: "",
        fg: "#555555",
    });
    container.add(statusText);

    renderFlappy();
}

function renderFlappy() {
    if (renderer.isDestroyed || !flappyState) return;
    const state = flappyState;
    const width = state.width;
    const viewHeight = gameContentLines.length;

    scoreText.content = centerText(`SCORE ${String(state.score).padStart(5, "0")}    HI ${String(state.highScore).padStart(5, "0")}`, width);

    if (state.gameOver) {
        statusText.content = centerText(`☠ GAME OVER - SCORE: ${state.score} │ R=Restart │ Q=Menu`, width);
        statusText.fg = "#FF0000";
    } else {
        statusText.content = centerText(`SPACE/UP to JUMP │ Q MENU`, width);
        statusText.fg = "#555555";
    }

    // Render Grid
    const grid: string[] = new Array(viewHeight).fill(" ".repeat(width));

    // Pipes
    state.pipes.forEach(pipe => {
        // Simple rendering: Box for pipes
        const pipeChar = "║";
        for (let y = 0; y < viewHeight; y++) {
            // Need to map game Y to view Y? 
            // Currently game height = renderer height. 
            // But we only have viewHeight lines. 
            // Let's assume game logic uses full height, we truncate top/bottom for display?
            // Actually, best to pass viewHeight to initFlappy if we want exact logic.
            // For now, let's map logic coordinates directly to view lines if they fit.
            // Or better: Let flappy logic use 'viewHeight' as its 'height'.
            // Let's rely on initFlappy receiving the correct height.
            // But waiting... initFlappy got renderer.height.
            // Let's adhere to the grid.
            
            if (y < pipe.gapY || y >= pipe.gapY + pipe.gapHeight) {
                // Draw pipe at pipe.x
                const x = Math.floor(pipe.x);
                if (x >= 0 && x < width) {
                     const line = grid[y]!;
                     grid[y] = line.substring(0, x) + pipeChar + line.substring(x + 1);
                }
                const x2 = x + 1;
                if (x2 >= 0 && x2 < width) {
                     const line = grid[y]!;
                     grid[y] = line.substring(0, x2) + pipeChar + line.substring(x2 + 1);
                }
            }
        }
    });

    // Bird
    const birdChar = "O"; // Or 🐦
    const by = Math.floor(state.birdY);
    const bx = Math.floor(state.width / 4);
    
    if (by >= 0 && by < viewHeight) {
        const line = grid[by]!;
        if (bx >= 0 && bx < width) {
             grid[by] = line.substring(0, bx) + birdChar + line.substring(bx + 1);
        }
    }

    // Update lines
    for (let i = 0; i < viewHeight; i++) {
        gameContentLines[i]!.content = grid[i]!;
    }
}

function handleFlappyInput(sequence: string): boolean {
    if (!flappyState) return false;
    const state = flappyState;

    if (sequence === "q" || sequence === "Q") {
        stopGame();
        return true;
    }

    if ((sequence === "r" || sequence === "R") && state.gameOver) {
        startFlappy();
        return true;
    }

    if (state.gameOver) return false;

    if (sequence === " " || sequence === "\u001b[A") { // Space or Up
        jump(state);
        return true;
    }
    
    return false;
}

// ----------------------------------------------------------------
// 2048
// ----------------------------------------------------------------

function start2048() {
    initContainer();
    const safeWidth = renderer.width - 6;

    const saved = loadGame();
    twentyFortyEightState = init2048(safeWidth, 4, saved.twentyFortyEightHighScore);
    hasSaved2048Score = false;

    titleText = new TextRenderable(renderer, {
        id: "game-title",
        content: centerText("🔢 2 0 4 8 🔢", safeWidth),
        fg: "#FFFFFF",
    });
    container.add(titleText);

    scoreText = new TextRenderable(renderer, {
        id: "score",
        content: "",
        fg: "#FFFFFF",
    });
    container.add(scoreText);

    container.add(new TextRenderable(renderer, { id: "spacer", content: " " }));

    gameContentLines = [];
    for (let i = 0; i < 9; i++) {
        const line = new TextRenderable(renderer, {
            id: `line-${i}`,
            content: "",
            fg: "#FFFFFF",
        });
        gameContentLines.push(line);
        container.add(line);
    }

    statusText = new TextRenderable(renderer, {
        id: "status",
        content: "",
        fg: "#555555",
    });
    container.add(statusText);

    render2048();
}

function render2048() {
    if (renderer.isDestroyed || !twentyFortyEightState) return;
    const state = twentyFortyEightState;
    const width = renderer.width;

    scoreText.content = centerText(`SCORE ${String(state.score).padStart(5, "0")}    HI ${String(state.highScore).padStart(5, "0")}`, width);

    if (state.gameOver) {
        statusText.content = centerText(`☠ GAME OVER - SCORE: ${state.score} │ R=Restart │ Q=Menu`, width);
        statusText.fg = "#FF0000";
    } else if (state.won) {
        statusText.content = centerText(`🎉 YOU REACHED 2048! │ ARROWS CONTINUE │ Q=Menu`, width);
        statusText.fg = "#00FF00";
    } else {
        statusText.content = centerText(`ARROWS TO SLIDE │ Q MENU`, width);
        statusText.fg = "#555555";
    }

    const grid = state.grid;
    const lines: string[] = [];
    
    const border = "+------+------+------+------+";
    lines.push(centerText(border, width));
    
    for (let r = 0; r < 4; r++) {
        let rowStr = "|";
        for (let c = 0; c < 4; c++) {
            const val = grid[r]![c]!;
            const valStr = val === 0 ? "      " : val.toString().padStart(6, " ");
            rowStr += valStr + "|";
        }
        lines.push(centerText(rowStr, width));
        lines.push(centerText(border, width));
    }

    for (let i = 0; i < lines.length; i++) {
        if (gameContentLines[i]) {
            gameContentLines[i]!.content = lines[i]!;
        }
    }
}

function handle2048Input(sequence: string): boolean {
    if (!twentyFortyEightState) return false;
    const state = twentyFortyEightState;

    if (sequence === "q" || sequence === "Q") {
        stopGame();
        return true;
    }

    if ((sequence === "r" || sequence === "R") && state.gameOver) {
        start2048();
        return true;
    }

    if (state.gameOver) return false;

    let moved = false;
    if (sequence === "\u001b[A" || sequence === "w" || sequence === "W") { // Up
        moved = move2048(state, -1, 0);
    } else if (sequence === "\u001b[B" || sequence === "s" || sequence === "S") { // Down
        moved = move2048(state, 1, 0);
    } else if (sequence === "\u001b[D" || sequence === "a" || sequence === "A") { // Left
        moved = move2048(state, 0, -1);
    } else if (sequence === "\u001b[C" || sequence === "d" || sequence === "D") { // Right
        moved = move2048(state, 0, 1);
    }

    if (moved) {
        render2048();
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
         if (currentGameId === "flappy") startGame("flappy");
         if (currentGameId === "2048") startGame("2048");
    }
});

// Input Handler
renderer.prependInputHandler((sequence: string) => {
    if (renderer.isDestroyed) return false;

    // Ctrl+C is handled by renderer now

    if (appMode === "MENU") {
        return handleMenuInput(sequence);
    } else {
        if (currentGameId === "space-invaders") return handleSpaceInvadersInput(sequence);
        if (currentGameId === "snake") return handleSnakeInput(sequence);
        if (currentGameId === "flappy") return handleFlappyInput(sequence);
        if (currentGameId === "2048") return handle2048Input(sequence);
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
      } else if (currentGameId === "flappy" && flappyState) {
          updateFlappy(flappyState);
          if (flappyState.gameOver && !hasSavedFlappyScore) {
              saveFlappyHighScore(flappyState.highScore);
              hasSavedFlappyScore = true;
          }
           renderFlappy();
       } else if (currentGameId === "2048" && twentyFortyEightState) {
           if (twentyFortyEightState.gameOver && !hasSaved2048Score) {
               saveTwentyFortyEightHighScore(twentyFortyEightState.highScore);
               hasSaved2048Score = true;
           }
           render2048();
       }
  }
}, 33);

// Init
initMenuUI();
renderMenu();