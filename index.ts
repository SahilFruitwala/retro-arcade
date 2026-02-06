import { createCliRenderer, TextRenderable, BoxRenderable, SelectRenderable, SelectRenderableEvents } from "@opentui/core";
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
// UI Components
let container: BoxRenderable;
let titleText: TextRenderable;
let gameSelect: SelectRenderable; // Replaces menuText
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
    
    // Center layout for menu
    container.justifyContent = "center";
    container.alignItems = "center";

    titleText = new TextRenderable(renderer, {
        id: "title",
        content: "★ RETRO ARCADE ★",
        fg: "#00FF00",
    });
    container.add(titleText);

    // Spacer
    container.add(new TextRenderable(renderer, { id: "spacer1", content: " " }));

    // Subtitle
    container.add(new TextRenderable(renderer, {
        id: "subtitle",
        content: "CHOOSE YOUR GAME",
        fg: "#FFFFFF"
    }));
    container.add(new TextRenderable(renderer, { id: "spacer2", content: " " }));

    const options = GAMES.map(g => ({
        name: g.name,
        description: g.enabled ? "Press Enter" : "Coming Soon",
        value: g.id
    }));

    gameSelect = new SelectRenderable(renderer, {
        id: "game-select",
        width: 40,
        height: 12, // Increased to show all 4 games (2 lines per option)
        options: options,
        // Theme
        backgroundColor: "#111111",
        selectedBackgroundColor: "#00FF00",
        selectedTextColor: "#000000"
    });

    gameSelect.on(SelectRenderableEvents.ITEM_SELECTED, (index, option) => {
        if (option.value) startGame(option.value);
    });

    container.add(gameSelect);
    gameSelect.focus();

    // Instructions
     const instructions = new TextRenderable(renderer, {
        id: "menu-help",
        content: "\n" + "↑/↓ SELECT   ENTER START   CTRL+C EXIT",
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
let tileBoxes: BoxRenderable[] = []; // References for 2048 tiles
let tileTexts: TextRenderable[] = []; // Text nodes inside the tiles

function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}

// ----------------------------------------------------------------
// MENU LOGIC
// ----------------------------------------------------------------

function renderMenu() {
    // No-op: Select component handles its own rendering
}

function handleMenuInput(sequence: string): boolean {
    // Let Select component handle input
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
    initMenuUI();
    // renderMenu(); // Not needed (Select component auto-renders on start/update)
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
    const header = new BoxRenderable(renderer, {
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        marginBottom: 1
    });
    container.add(header);

    titleText = new TextRenderable(renderer, {
        id: "game-title",
        content: "★ S P A C E   I N V A D E R S ★",
        fg: "#00FF00",
    });
    header.add(titleText);

    // Stats Bar
    const statsBar = new BoxRenderable(renderer, {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        paddingLeft: 4,
        paddingRight: 4
    });
    container.add(statsBar);

    scoreText = new TextRenderable(renderer, {
        id: "score",
        content: "",
        fg: "#FFFFFF",
    });
    statsBar.add(scoreText);

    levelText = new TextRenderable(renderer, {
        id: "level",
        content: "",
        fg: "#FFFF00",
    });
    statsBar.add(levelText);
    
    // Spacer
    container.add(new TextRenderable(renderer, { id: "spacer-game", content: " " }));

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

    // Footer (Status)
    const footer = new BoxRenderable(renderer, {
        flexDirection: "row", // or column
        justifyContent: "center",
        width: "100%",
        marginTop: 1
    });
    container.add(footer);

    statusText = new TextRenderable(renderer, {
        id: "status",
        content: "",
        fg: "#FFFF00",
    });
    footer.add(statusText);

    renderSpaceInvaders();
}

function renderSpaceInvaders(): void {
  if (renderer.isDestroyed || !invadersState) return;
  const state = invadersState;

  const livesStr = "♥".repeat(state.lives) + "♡".repeat(Math.max(0, 3 - state.lives));
  scoreText.content = `SCORE ${String(state.score).padStart(5, "0")}    HI ${String(state.highScore).padStart(5, "0")}    ${livesStr}`;

  levelText.content = `LEVEL ${state.level}`;

  const hi = state.highScore;
  if (state.gameOver) {
    statusText.content = `☠ GAME OVER - SCORE: ${state.score} - HI: ${hi} │ R=Restart │ N=New │ Q=Menu`;
    statusText.fg = "#FF0000";
  } else if (state.won) {
    statusText.content = `★ LEVEL COMPLETE! HI: ${hi} - R for next level`;
    statusText.fg = "#00FF00";
  } else if (state.paused) {
    statusText.content = `HI: ${hi} │ ⏸ PAUSED - P=Continue`;
    statusText.fg = "#FFFF00";
  } else {
    statusText.content = `HI: ${hi} │ ← → MOVE │ SPACE FIRE │ P PAUSE │ Q MENU`;
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
    const header = new BoxRenderable(renderer, {
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        marginBottom: 1
    });
    container.add(header);

    titleText = new TextRenderable(renderer, {
        id: "game-title",
        content: "🐍 S N A K E 🐍",
        fg: "#00FF00",
    });
    header.add(titleText);

    const statsBar = new BoxRenderable(renderer, {
        flexDirection: "row",
        justifyContent: "center",
        width: "100%"
    });
    container.add(statsBar);

    scoreText = new TextRenderable(renderer, {
        id: "score",
        content: "",
        fg: "#FFFFFF",
    });
    statsBar.add(scoreText);

    // Game Area (Centered)
    const gameArea = new BoxRenderable(renderer, {
        flexDirection: "column",
        alignItems: "center",
        width: "100%"
    });
    container.add(gameArea);

    borderTopLine = new TextRenderable(renderer, { id: "border-top", content: " " });
    gameArea.add(borderTopLine);
    
    gameContentLines = [];
    for (let i = 0; i < snakeState.height; i++) {
        const line = new TextRenderable(renderer, {
            id: `line-${i}`,
            content: "",
            fg: "#FFFFFF",
        });
        gameContentLines.push(line);
        gameArea.add(line);
    }
    
    borderBottomLine = new TextRenderable(renderer, { id: "border-bottom", content: " " });
    gameArea.add(borderBottomLine);
    
    // Footer
    const footer = new BoxRenderable(renderer, {
        flexDirection: "row",
        justifyContent: "center",
        width: "100%",
        marginTop: 1
    });
    container.add(footer);

    statusText = new TextRenderable(renderer, {
        id: "status",
        content: "ARROWS TO MOVE │ R RESTART │ Q MENU",
        fg: "#555555",
    });
    footer.add(statusText);

    renderSnake();
}

function renderSnake() {
    if (renderer.isDestroyed || !snakeState) return;
    const state = snakeState;
    const width = renderer.width;

    scoreText.content = `SCORE ${String(state.score).padStart(5, "0")}    HI ${String(state.highScore).padStart(5, "0")}`;

    // Status Update
    const hi = state.highScore;
    if (state.gameOver) {
        statusText.content = `☠ GAME OVER - SCORE: ${state.score} - HI: ${hi} │ R=Restart │ Q=Menu`;
        statusText.fg = "#FF0000";
    } else if (state.paused) {
        statusText.content = `HI: ${hi} │ ⏸ PAUSED - P=Continue`;
        statusText.fg = "#FFFF00";
    } else {
        statusText.content = `HI: ${hi} │ ARROWS TO MOVE │ P PAUSE │ R RESTART │ Q MENU`;
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
    // No centerText needed
    const tb = `${cornerTL}${borderChar.repeat(innerWidth)}${cornerTR}`;
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
            // No centerText needed
            gameContentLines[y]!.content = `${sideBorder}${rowStr}${sideBorder}`;
        }
    }
    
    // Bottom Border
    const bb = `${cornerBL}${borderChar.repeat(innerWidth)}${cornerBR}`;
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
    const header = new BoxRenderable(renderer, {
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        marginBottom: 1
    });
    container.add(header);

    titleText = new TextRenderable(renderer, {
        id: "game-title",
        content: "🐦 FLAPPY BIRD 🐦",
        fg: "#FFFF00",
    });
    header.add(titleText);

    const statsBar = new BoxRenderable(renderer, {
        flexDirection: "row",
        justifyContent: "center",
        width: "100%"
    });
    container.add(statsBar);

    scoreText = new TextRenderable(renderer, {
        id: "score",
        content: "",
        fg: "#FFFFFF",
    });
    statsBar.add(scoreText);

    // Game Area
    const gameArea = new BoxRenderable(renderer, {
        flexDirection: "column",
        alignItems: "center", // Center content
        width: "100%"
    });
    container.add(gameArea);

    // Border Top
    gameArea.add(new TextRenderable(renderer, { id: "border-top", content: "─".repeat(safeWidth) }));

    gameContentLines = [];
    for (let i = 0; i < flappyState.height; i++) {
        const line = new TextRenderable(renderer, {
            id: `line-${i}`,
            content: "",
            fg: "#FFFFFF",
        });
        gameContentLines.push(line);
        gameArea.add(line);
    }

    // Footer
    const footer = new BoxRenderable(renderer, {
        flexDirection: "row",
        justifyContent: "center",
        width: "100%",
        marginTop: 1
    });
    container.add(footer);

    statusText = new TextRenderable(renderer, {
        id: "status",
        content: "",
        fg: "#555555",
    });
    footer.add(statusText);

    renderFlappy();
}

function renderFlappy() {
    if (renderer.isDestroyed || !flappyState) return;
    const state = flappyState;
    const width = state.width;
    const viewHeight = gameContentLines.length;

    scoreText.content = `SCORE ${String(state.score).padStart(5, "0")}    HI ${String(state.highScore).padStart(5, "0")}`;

    if (state.gameOver) {
        statusText.content = `☠ GAME OVER - SCORE: ${state.score} │ R=Restart │ Q=Menu`;
        statusText.fg = "#FF0000";
    } else {
        statusText.content = `SPACE/UP to JUMP │ Q MENU`;
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

    // Build UI
    const header = new BoxRenderable(renderer, {
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        marginBottom: 1
    });
    container.add(header);

    titleText = new TextRenderable(renderer, {
        id: "game-title",
        content: "🔢 2 0 4 8 🔢",
        fg: "#FFFFFF",
    });
    header.add(titleText);

    const statsBar = new BoxRenderable(renderer, {
        flexDirection: "row",
        justifyContent: "center",
        width: "100%"
    });
    container.add(statsBar);

    scoreText = new TextRenderable(renderer, {
        id: "score",
        content: "",
        fg: "#FFFFFF",
    });
    statsBar.add(scoreText);

    container.add(new TextRenderable(renderer, { id: "spacer", content: " " }));

    // Game Area (Centered)
    const gameArea = new BoxRenderable(renderer, {
        flexDirection: "column",
        alignItems: "center",
        width: "100%"
    });
    container.add(gameArea);

    // Grid Container
    const gridBox = new BoxRenderable(renderer, {
        width: 40, // 4 * 8 (tiles) + 3 (gaps) + 2 (padding) + 2 (border) = 39. Round to 40.
        flexDirection: "column",
        alignItems: "center",
        padding: 1,
        backgroundColor: "#222222",
        borderStyle: "rounded",
        borderColor: "#555555"
    });
    gameArea.add(gridBox);

    tileBoxes = [];
    tileTexts = [];
    
    // Create 4x4 Grid using Rows
    for (let r = 0; r < 4; r++) {
        const row = new BoxRenderable(renderer, {
            flexDirection: "row",
            gap: 1,
            marginBottom: 1
        });
        gridBox.add(row);
        
        for (let c = 0; c < 4; c++) {
            const tile = new BoxRenderable(renderer, {
                width: 8,
                height: 3,
                backgroundColor: "#333333",
                alignItems: "center",
                justifyContent: "center"
            });
            
            const tileText = new TextRenderable(renderer, {
                content: "",
                fg: "#FFFFFF"
            });
            tile.add(tileText);
            
            row.add(tile);
            tileBoxes.push(tile);
            tileTexts.push(tileText);
        }
    }

    // Footer
    const footer = new BoxRenderable(renderer, {
        flexDirection: "row",
        justifyContent: "center",
        width: "100%",
        marginTop: 1
    });
    container.add(footer);

    statusText = new TextRenderable(renderer, {
        id: "status",
        content: "",
        fg: "#555555",
    });
    footer.add(statusText);

    render2048();
}

function render2048() {
    if (renderer.isDestroyed || !twentyFortyEightState) return;
    const state = twentyFortyEightState;
    const width = renderer.width;

    scoreText.content = `SCORE ${String(state.score).padStart(5, "0")}    HI ${String(state.highScore).padStart(5, "0")}`;

    if (state.gameOver) {
        statusText.content = `☠ GAME OVER - SCORE: ${state.score} │ R=Restart │ Q=Menu`;
        statusText.fg = "#FF0000";
    } else if (state.won) {
        statusText.content = `🎉 YOU REACHED 2048! │ ARROWS CONTINUE │ Q=Menu`;
        statusText.fg = "#00FF00";
    } else {
        statusText.content = `ARROWS TO SLIDE │ Q MENU`;
        statusText.fg = "#555555";
    }

    const grid = state.grid;
    
    // Update existing boxes
    for (let i = 0; i < 16; i++) {
        const r = Math.floor(i / 4);
        const c = i % 4;
        const val = grid[r]![c]!;
        
        const tileBox = tileBoxes[i]!;
        const textNode = tileTexts[i]!;
        
        if (val === 0) {
            tileBox.backgroundColor = "#333333";
            textNode.content = "";
        } else {
            // Colors logic usually in 2048.ts, but we'll do simple mapping here or import it.
             // We'll use getTileColor helper if we add it, or simple switch here.
             const colors: Record<number, string> = {
                 2: "#555555",
                 4: "#555577",
                 8: "#555599",
                 16: "#5555BB",
                 32: "#5555DD",
                 64: "#5555FF",
                 128: "#7755FF",
                 256: "#9955FF",
                 512: "#BB55FF",
                 1024: "#DD55FF",
                 2048: "#FF5500",
             };
             tileBox.backgroundColor = colors[val] || "#FF0000";
             textNode.content = String(val);
             
             // Font color
             textNode.fg = val >= 8 ? "#FFFFFF" : "#EEEEEE";
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
        // Auto-handled by layout
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
// renderMenu() removed.