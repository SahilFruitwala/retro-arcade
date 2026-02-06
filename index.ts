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
        selectedBackgroundColor: "#006600", // Darker green for contrast
        selectedTextColor: "#FFFFFF"       // White text
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
let tileBoxes: BoxRenderable[] = []; // References for 2048 tiles
let tileTexts: TextRenderable[] = []; // Text nodes inside the tiles

// Space Invaders Component Refs
let siPlayerBox: BoxRenderable;
let siPlayerText: TextRenderable;
let siUfoBox: BoxRenderable;
let siUfoText: TextRenderable;
let siEnemyBoxes: BoxRenderable[] = []; // Pool/List
let siEnemyTexts: TextRenderable[] = []; 
let siBulletBoxes: BoxRenderable[] = []; // Pool
let siBulletTexts: TextRenderable[] = []; 
let siShieldTexts: TextRenderable[] = []; // Pool/Refs
let siExplosionBoxes: BoxRenderable[] = []; // Pool
let siExplosionTexts: TextRenderable[] = []; 
let siGameContainer: BoxRenderable; // Relative container for game world

let statusText: TextRenderable; // Global status text reference
// Flappy Bird Component Refs
let flappyGameContainer: BoxRenderable;
let flappyBirdBox: BoxRenderable;
let flappyPipeBoxes: BoxRenderable[] = []; // Pool

// Snake Component Refs
let snakeGameContainer: BoxRenderable;
let snakeBodyBoxes: BoxRenderable[] = []; // Pool
let snakeBodyTexts: TextRenderable[] = []; 
let snakeFruitBox: BoxRenderable;
let snakeFruitText: TextRenderable;



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

    // Logic: If dead in saved game (lives <= 0), RESET Level to 1 and Score to 0. (Start Fresh)
    // If alive, RESUME exactly where left off.
    
    // Default safe start
    let startLevel = 1;
    let startScore = 0;
    
    // Check if we can resume
    if (savedGame.lives > 0) {
        startLevel = savedGame.currentLevel;
        startScore = savedGame.currentScore;
    } else {
    }
    
    invadersState = createInitialState(
        renderer.width, 
        renderer.height, 
        startLevel, 
        savedGame.highScore
    );
    
    // Apply score/lives if resuming
    if (savedGame.lives > 0) {
        invadersState.lives = savedGame.lives;
        invadersState.score = startScore;
    }
    // Else: createInitialState defaults are used (Level 1, Score 0, Lives 3)
    
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

    // Game World Container (Relative for absolute children)
    // We set a fixed size or use 100% width/height of the available area.
    siGameContainer = new BoxRenderable(renderer, {
        id: "si-world",
        width: "100%",
        height: invadersState.height, // Match game logic height
        borderColor: "#00FF00",
        borderStyle: "single", // Frame around the game world
        // position: "relative" is default for Flex items, but children will be absolute.
    });
    container.add(siGameContainer);

    // Initialize Entity Pools
    siEnemyBoxes = [];
    siEnemyTexts = [];
    siBulletBoxes = [];
    siBulletTexts = [];
    
    // Pre-create Player
    siPlayerBox = new BoxRenderable(renderer, {
        position: "absolute",
        width: 3, // <^>
        height: 1,
        backgroundColor: "#00AA00" // Greenish background
    });
    siPlayerText = new TextRenderable(renderer, { content: "<^>", fg: "#000000" }); // Black text on green
    siPlayerBox.add(siPlayerText);
    siGameContainer.add(siPlayerBox);

    // Pre-create UFO
    siUfoBox = new BoxRenderable(renderer, {
        position: "absolute",
        width: 3,
        height: 1,
        backgroundColor: "#FF0000",
        // Hiding by moving offscreen
        top: -100,
        left: 0
    });
    siUfoText = new TextRenderable(renderer, { content: "<O>", fg: "#FFFFFF" });
    siUfoBox.add(siUfoText);
    siGameContainer.add(siUfoBox);
    
    // Initialize Shields (Fixed number)
    // We can just create them here since they don't move, only update content/color
    siShieldTexts = [];
    if (invadersState.shields) {
        invadersState.shields.forEach(shield => {
            const box = new BoxRenderable(renderer, {
                position: "absolute",
                top: shield.pos.y,
                left: shield.pos.x,
                width: 1,
                height: 1,
                backgroundColor: "transparent"
            });
            const txt = new TextRenderable(renderer, { content: getShieldChar(shield.health), fg: "#00FF00" });
            box.add(txt);
            siGameContainer.add(box);
            siShieldTexts.push(txt);
        });
    }

    // Initialize Explosion Pool
    siExplosionBoxes = [];
    siExplosionTexts = [];

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
  if (renderer.isDestroyed || !invadersState || !siGameContainer) return;
  const state = invadersState;

  const livesStr = "♥".repeat(Math.max(0, state.lives)) + "♡".repeat(Math.max(0, 3 - state.lives));
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

  // Sync Entities
  
  // 1. Player
  siPlayerBox.top = state.player.pos.y;
  siPlayerBox.left = state.player.pos.x;
  siPlayerText.content = state.player.char;

  // 2. UFO
  if (state.ufo.active) {
      siUfoBox.top = state.ufo.pos.y;
      siUfoBox.left = state.ufo.pos.x;
  } else {
      siUfoBox.top = -100; // Hide
  }

  // 3. Enemies (Sync pool size)
  // Ensure we have enough boxes
  const enemies = state.enemies;
  while (siEnemyBoxes.length < enemies.length) {
      const box = new BoxRenderable(renderer, {
          position: "absolute",
          width: 1, // Default, updated below
          height: 1,
          backgroundColor: "#FFFFFF", // Default
      });
      const txt = new TextRenderable(renderer, { content: "", fg: "#000000" });
      box.add(txt);
      siEnemyBoxes.push(box);
      siEnemyTexts.push(txt);
      siGameContainer.add(box);
  }
  
  // Update/Hide enemies
  for (let i = 0; i < siEnemyBoxes.length; i++) {
        const box = siEnemyBoxes[i]!;
        const text = siEnemyTexts[i]!;
        
        if (i < enemies.length) {
            const e = enemies[i]!;
            box.top = e.pos.y;
            box.left = e.pos.x;
            box.width = e.char.length;
            
          
          // Generic Enemy Styling
          box.backgroundColor = "transparent"; // Default transparent
          text.fg = e.color; // Use entity color directly
          text.content = e.char;
      } else {
          box.top = -100; // Hide
      }
  }

  // 4. Bullets
  const allBullets = [...state.bullets, ...state.enemyBullets];
  while (siBulletBoxes.length < allBullets.length) {
       const box = new BoxRenderable(renderer, {
          position: "absolute",
          width: 1,
          height: 1
      });
      const txt = new TextRenderable(renderer, { content: "│" });
      box.add(txt);
      siBulletBoxes.push(box);
      siBulletTexts.push(txt);
      siGameContainer.add(box);
  }

  // Update Bullets
  for (let i = 0; i < siBulletBoxes.length; i++) {
      const box = siBulletBoxes[i]!;
      const text = siBulletTexts[i]!;
      
      if (i < allBullets.length) {
          const b = allBullets[i]!;
          box.top = b.pos.y;
          box.left = b.pos.x;
          box.width = b.char.length; 
          
          box.backgroundColor = "transparent";
          text.content = b.char;
          text.fg = b.color;
      } else {
          box.top = -100;
      }
  }

  // 5. Shields
  if (state.shields && siShieldTexts.length === state.shields.length) {
      for (let i = 0; i < state.shields.length; i++) {
          const s = state.shields[i]!;
          // health 0-4
          siShieldTexts[i]!.content = getShieldChar(s.health);
          if (s.health <= 0) siShieldTexts[i]!.content = " ";
      }
  }

  // 6. Explosions
  const explosions = state.explosions || [];
  while (siExplosionBoxes.length < explosions.length) {
       const box = new BoxRenderable(renderer, {
          position: "absolute",
          width: 1,
          height: 1,
          backgroundColor: "transparent"
      });
      const txt = new TextRenderable(renderer, { content: "*", fg: "#FFFF00" });
      box.add(txt);
      siExplosionBoxes.push(box);
      siExplosionTexts.push(txt);
      siGameContainer.add(box);
  }
  
  for (let i = 0; i < siExplosionBoxes.length; i++) {
        const box = siExplosionBoxes[i]!;
        const text = siExplosionTexts[i]!;
        if (i < explosions.length) {
            const exp = explosions[i]!;
            box.top = exp.pos.y;
            box.left = exp.pos.x;
            text.content = getExplosionChar(exp.frame);
        } else {
            box.top = -100;
        }
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
                currentLevel: 1, // User requested strict reset on loss
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
  // Calculate Safe Dimensions for Logic
  // Root: Border(1) + Padding(1) = 2 top/bottom/left/right
  // Header(2) + Stats(2) + Footer(2) = 6 lines
  // Buffer = ~10 lines
  const safeHeight = Math.max(10, renderer.height - 12); 
  const safeWidth = Math.max(10, renderer.width - 6);

  // Load High Score
  const saved = loadGame(); 
  // Init Logic
  snakeState = initSnake(safeWidth, safeHeight, saved.snakeHighScore || 0);
  hasSavedSnakeScore = false;

  // Header
  const header = new BoxRenderable(renderer, {
      flexDirection: "column",
      alignItems: "center",
      width: "100%",
      marginBottom: 0
  });
  container.add(header);

  titleText = new TextRenderable(renderer, {
      id: "game-title",
      content: "🐍 S N A K E 🐍",
      fg: "#00FF00",
  });
  header.add(titleText);

  // Stats
  const statsBar = new BoxRenderable(renderer, {
      flexDirection: "row",
      justifyContent: "center",
      width: "100%",
      marginBottom: 0
  });
  container.add(statsBar);

  scoreText = new TextRenderable(renderer, {
      id: "score",
      content: "",
      fg: "#FFFFFF",
  });
  statsBar.add(scoreText);
  
  // Game Area Container
  // Use explicit size and borders
  snakeGameContainer = new BoxRenderable(renderer, {
      id: "snake-world",
      width: safeWidth + 2, // +2 for Border
      height: safeHeight + 2, // +2 for Border
      borderStyle: "single",
      borderColor: "#00FF00",
      // Center it
      alignSelf: "center",
  });
  container.add(snakeGameContainer);

  // Pools
  snakeBodyBoxes = [];
  snakeBodyTexts = [];
  
  // Fruit
  snakeFruitBox = new BoxRenderable(renderer, {
      position: "absolute",
      width: 1,
      height: 1,
      backgroundColor: "#FF0000",
      top: -100 
  });
  snakeFruitText = new TextRenderable(renderer, { content: "❤", fg: "#FFFFFF" });
  snakeFruitBox.add(snakeFruitText);
  snakeGameContainer.add(snakeFruitBox);

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

  renderSnake();
}

function renderSnake() {
  if (renderer.isDestroyed || !snakeState || !snakeGameContainer) return;
  const state = snakeState;
  
  scoreText.content = `SCORE ${String(state.score).padStart(5, "0")}    HI ${String(state.highScore).padStart(5, "0")}`;

  if (state.gameOver) {
      statusText.content = `☠ GAME OVER - SCORE: ${state.score} │ R=Restart │ Q=Menu`;
      statusText.fg = "#FF0000";
  } else {
      statusText.content = `ARROWS move │ Q MENU`;
      statusText.fg = "#555555";
  }

  // Sync Fruit
  // Box with Border acts as padding?
  // Usually in Yoga/OpenTUI, if border is present, children at 0,0 are inside border?
  // Let's assume yes. 
  // If not, we might need offsets.
  snakeFruitBox.top = state.food.y;
  snakeFruitBox.left = state.food.x;

  // Sync Body
  while (snakeBodyBoxes.length < state.snake.length) {
      const box = new BoxRenderable(renderer, {
          position: "absolute",
          width: 1,
          height: 1,
          backgroundColor: "#00FF00" 
      });
      const txt = new TextRenderable(renderer, { content: "", fg: "#000000" });
      box.add(txt);
      snakeBodyBoxes.push(box);
      snakeBodyTexts.push(txt);
      snakeGameContainer.add(box);
  }

  for (let i = 0; i < snakeBodyBoxes.length; i++) {
        const box = snakeBodyBoxes[i]!;
        const text = snakeBodyTexts[i]!; 

        if (i < state.snake.length) {
            const segment = state.snake[i]!;
            box.top = segment.y;
            box.left = segment.x;
            
            if (i === 0) { // Head
                box.backgroundColor = "#00FF00"; 
                text.content = "O";
                text.fg = "#004400";
            } else {
                box.backgroundColor = "#00AA00"; 
                text.content = "•"; 
                text.fg = "#002200";
            }
        } else {
            box.top = -100;
        }
  }
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
    flappyGameContainer = new BoxRenderable(renderer, {
        id: "flappy-world",
        width: "100%",
        height: flappyState.height,
        // position: "relative" implied for absolute children
    });
    container.add(flappyGameContainer);

    // Border Top (Static visual)
    flappyGameContainer.add(new TextRenderable(renderer, { id: "border-top", content: "─".repeat(safeWidth) }));

    // Initialize Pools
    flappyPipeBoxes = [];
    
    // Create Bird
    flappyBirdBox = new BoxRenderable(renderer, {
        position: "absolute",
        width: 1, // "O"
        height: 1,
        backgroundColor: "#FFFF00" // Yellow Bird
    });
    flappyBirdBox.add(new TextRenderable(renderer, { content: "O", fg: "#000000" }));
    flappyGameContainer.add(flappyBirdBox);

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
    if (renderer.isDestroyed || !flappyState || !flappyGameContainer) return;
    const state = flappyState;
    const width = state.width;

    scoreText.content = `SCORE ${String(state.score).padStart(5, "0")}    HI ${String(state.highScore).padStart(5, "0")}`;

    if (state.gameOver) {
        statusText.content = `☠ GAME OVER - SCORE: ${state.score} │ R=Restart │ Q=Menu`;
        statusText.fg = "#FF0000";
    } else {
        statusText.content = `SPACE/UP to JUMP │ Q MENU`;
        statusText.fg = "#555555";
    }

    // Update Bird
    // game Y can be float, visual Y integer
    const by = Math.floor(state.birdY);
    // Boundary check for visual purposes (don't draw offscreen if it confuses layout)
    if (by >= 0 && by < state.height) {
        flappyBirdBox.top = by;
        flappyBirdBox.left = Math.floor(state.width / 4);
        flappyBirdBox.width = 1; // Explicit
    } else {
        flappyBirdBox.top = -100; // Hide if out of bounds
    }

    // Update Pipes
    // Pipes come in pairs (Top segment, Bottom segment) logic or just 2 boxes per pipe?
    // The game logic stores `pipes: { x, gapY, gapHeight }`.
    // Effectively a Top Pipe (0 to gapY) and Bottom Pipe (gapY+gapHeight to height).
    // So 2 separate Boxes per logic pipe.
    
    // Pool Logic: We need 2 boxes for every pipe in state.
    const needed = state.pipes.length * 2;
    while (flappyPipeBoxes.length < needed) {
        const box = new BoxRenderable(renderer, {
            position: "absolute",
            width: 1, // "|" width
            backgroundColor: "#00AA00", // Green pipe
        });
        box.add(new TextRenderable(renderer, { content: "║", fg: "#00FF00" }));
        flappyPipeBoxes.push(box);
        flappyGameContainer.add(box);
    }
    
    // Sync
    let boxIdx = 0;
    for (const pipe of state.pipes) {
         // Top Pipe
         const topBox = flappyPipeBoxes[boxIdx]!;
         boxIdx++;
         // Draw from 0 to gapY
         if (pipe.gapY > 0) {
             topBox.top = 0;
             topBox.left = Math.floor(pipe.x);
             topBox.height = Math.floor(pipe.gapY);
             // Should we adjust content? "║\n║..." 
             // Box backgroundColor handles the fill. Text is decorative.
             // Center the text? 
             // Actually, BoxRenderable doesn't repeat content automatically.
             // We can just rely on BG color for solid pipe.
             // Or set height.
         } else {
             topBox.top = -100;
         }

         // Bottom Pipe
         const botBox = flappyPipeBoxes[boxIdx]!;
         boxIdx++;
         const startY = pipe.gapY + pipe.gapHeight;
         if (startY < state.height) {
             botBox.top = Math.floor(startY);
             botBox.left = Math.floor(pipe.x);
             botBox.height = state.height - Math.floor(startY);
         } else {
             botBox.top = -100;
         }
    }
    
    // Hide unused
    for (let i = boxIdx; i < flappyPipeBoxes.length; i++) {
        flappyPipeBoxes[i]!.top = -100;
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