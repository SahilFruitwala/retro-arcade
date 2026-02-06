import type { Entity, GameState, Shield, Explosion } from "./types";

// Alien sprites - different rows have different aliens
const ALIEN_SPRITES = [
  { chars: ["⟨◉⟩", "⟩◉⟨"], color: "#FF00FF", points: 30 },  // Top - worth most
  { chars: ["⌐█⌐", "¬█¬"], color: "#00FFFF", points: 20 },  // Crab
  { chars: ["⌐█⌐", "¬█¬"], color: "#00FFFF", points: 20 },  // Crab
  { chars: ["/▼\\", "\\▼/"], color: "#00FF00", points: 10 }, // Octopus
  { chars: ["/▼\\", "\\▼/"], color: "#00FF00", points: 10 }, // Octopus
];

const EXPLOSION_FRAMES = ["✦", "✶", "✴", "·"];
const SHIELD_CHARS = ["█", "▓", "▒", "░", " "];

// Difficulty settings per level - LINEAR progression
function getLevelConfig(level: number) {
  return {
    // Start with 3 rows, add 1 every 3 levels, max 5
    enemyRows: Math.min(5, 3 + Math.floor((level - 1) / 3)),
    // Start with 5 columns, add 1 every 2 levels, max 9
    enemyCols: Math.min(10, 5 + Math.floor((level - 1) / 2)),
    // Base enemy speed (higher = slower). Much faster now.
    baseSpeed: Math.max(2, 6 - Math.floor(level / 2)),
    // Enemy shoot chance - significantly increased for more action
    shootChance: Math.min(0.1, 0.02 + level * 0.01),
    // Max enemy bullets on screen
    maxEnemyBullets: Math.min(6, 2 + Math.floor(level / 2)),
  };
}

export function createInitialState(termWidth: number, termHeight: number, level: number = 1, highScore: number = 0): GameState {
  const config = getLevelConfig(level);
  
  // Fixed reasonable game dimensions
  const gameWidth = Math.min(60, Math.max(40, termWidth - 10));
  const gameHeight = Math.min(22, Math.max(16, termHeight - 12));
  
  const enemyCols = Math.min(config.enemyCols, Math.floor((gameWidth - 16) / 5));
  const enemyRows = config.enemyRows;
  
  const enemies: Entity[] = [];
  const startX = Math.floor((gameWidth - enemyCols * 5) / 2);
  
  for (let row = 0; row < enemyRows; row++) {
    const spriteIndex = Math.min(row, ALIEN_SPRITES.length - 1);
    const sprite = ALIEN_SPRITES[spriteIndex]!;
    for (let col = 0; col < enemyCols; col++) {
      enemies.push({
        pos: { x: startX + col * 5, y: 2 + row * 2 },
        char: sprite.chars[0]!,
        color: sprite.color,
      });
    }
  }

  // Create 4 shields - positioned higher up
  const shields: Shield[] = [];
  const shieldSpacing = Math.floor(gameWidth / 5);
  for (let i = 0; i < 4; i++) {
    shields.push({
      pos: { x: shieldSpacing + i * shieldSpacing, y: gameHeight - 7 },
      health: 4,
    });
  }

  return {
    player: {
      pos: { x: Math.floor(gameWidth / 2) - 2, y: gameHeight - 2 },
      char: "╔▲╗",
      color: "#00FF88",
    },
    enemies,
    bullets: [],
    enemyBullets: [],
    shields,
    ufo: { pos: { x: -5, y: 0 }, active: false, points: 0 },
    explosions: [],
    score: 0,
    highScore,
    lives: 3,
    level,
    gameOver: false,
    won: false,
    paused: false,
    width: gameWidth,
    height: gameHeight,
    enemyDirection: 1,
    tickCount: 0,
  };
}

export function movePlayer(state: GameState, direction: -1 | 1): void {
  const newX = state.player.pos.x + direction;
  if (newX >= 1 && newX < state.width - 2) {
    state.player.pos.x = newX;
  }
}

export function shoot(state: GameState): void {
  // Allow up to 3 bullets for rapid fire!
  if (state.bullets.length >= 3) return;
  
  state.bullets.push({
    pos: { x: state.player.pos.x + 1, y: state.player.pos.y - 1 },
    char: "│",
    color: "#FFFF00",
  });
}

function addExplosion(state: GameState, x: number, y: number): void {
  state.explosions.push({ pos: { x, y }, frame: 0 });
}

function spawnUFO(state: GameState): void {
  // UFO appears more often at higher levels
  const ufoChance = 0.001 + state.level * 0.0005;
  if (!state.ufo.active && Math.random() < ufoChance) {
    state.ufo.active = true;
    state.ufo.pos.x = -4;
    state.ufo.points = [50, 100, 150, 300][Math.floor(Math.random() * 4)]!;
  }
}

function enemyShoot(state: GameState): void {
  const config = getLevelConfig(state.level);
  
  if (state.enemyBullets.length >= config.maxEnemyBullets || state.enemies.length === 0) return;
  if (Math.random() > config.shootChance) return;
  
  // Pick from bottom row enemies
  const columns: Map<number, Entity> = new Map();
  for (const enemy of state.enemies) {
    const col = Math.floor(enemy.pos.x / 5);
    const existing = columns.get(col);
    if (!existing || enemy.pos.y > existing.pos.y) {
      columns.set(col, enemy);
    }
  }
  
  const bottomEnemies = Array.from(columns.values());
  if (bottomEnemies.length === 0) return;
  
  const shooter = bottomEnemies[Math.floor(Math.random() * bottomEnemies.length)]!;
  state.enemyBullets.push({
    pos: { x: shooter.pos.x + 1, y: shooter.pos.y + 1 },
    char: "▼",
    color: "#FF4444",
  });
}

// Calculate enemy speed - gets faster as fewer remain
function getEnemyMoveInterval(state: GameState): number {
  const config = getLevelConfig(state.level);
  const totalEnemies = config.enemyRows * config.enemyCols;
  const remaining = state.enemies.length;
  const ratio = remaining / totalEnemies;
  
  // Enemies speed up as they die (classic mechanic)
  // But starting speed depends on level
  return Math.max(3, Math.floor(config.baseSpeed * ratio));
}

export function update(state: GameState): void {
  if (state.gameOver || state.won || state.paused) return;
  
  state.tickCount++;
  const config = getLevelConfig(state.level);
  
  // Calculate enemy grid size for animation
  const enemyCols = Math.min(config.enemyCols, Math.floor((state.width - 16) / 5));
  
  // Animate aliens every 10 ticks
  if (state.tickCount % 10 === 0) {
    const animFrame = Math.floor(state.tickCount / 10) % 2;
    for (let i = 0; i < state.enemies.length; i++) {
      const enemy = state.enemies[i]!;
      const row = Math.floor(i / enemyCols) % ALIEN_SPRITES.length;
      const sprite = ALIEN_SPRITES[row];
      if (sprite) {
        enemy.char = sprite.chars[animFrame]!;
      }
    }
  }
  
  // Update explosions
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    const exp = state.explosions[i]!;
    exp.frame++;
    if (exp.frame >= EXPLOSION_FRAMES.length) {
      state.explosions.splice(i, 1);
    }
  }
  
  // Move UFO every 3 ticks
  if (state.tickCount % 3 === 0) {
    if (state.ufo.active) {
      state.ufo.pos.x += 1;
      if (state.ufo.pos.x > state.width) {
        state.ufo.active = false;
      }
    } else {
      spawnUFO(state);
    }
  }

  // Move player bullets EVERY tick (fast!)
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i]!;
    bullet.pos.y -= 1;
    if (bullet.pos.y < 0) {
      state.bullets.splice(i, 1);
    }
  }
  
  // Move enemy bullets every 3 ticks (slightly faster)
  if (state.tickCount % 3 === 0) {
    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = state.enemyBullets[i]!;
      bullet.pos.y += 1;
      if (bullet.pos.y >= state.height) {
        state.enemyBullets.splice(i, 1);
      }
    }
  }
  
  // Enemy shoots every 8 ticks
  if (state.tickCount % 8 === 0) {
    enemyShoot(state);
  }

  // Check player bullet collisions
  for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
    const bullet = state.bullets[bi]!;
    
    // Check UFO
    if (state.ufo.active &&
        bullet.pos.y === state.ufo.pos.y &&
        bullet.pos.x >= state.ufo.pos.x &&
        bullet.pos.x < state.ufo.pos.x + 3) {
      state.bullets.splice(bi, 1);
      addExplosion(state, state.ufo.pos.x + 1, state.ufo.pos.y);
      state.score += state.ufo.points;
      state.ufo.active = false;
      continue;
    }
    
    // Check enemies
    for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
      const enemy = state.enemies[ei]!;
      if (
        bullet.pos.y === enemy.pos.y &&
        bullet.pos.x >= enemy.pos.x &&
        bullet.pos.x <= enemy.pos.x + 2
      ) {
        state.bullets.splice(bi, 1);
        state.enemies.splice(ei, 1);
        addExplosion(state, enemy.pos.x + 1, enemy.pos.y);
        const row = Math.floor(ei / enemyCols) % ALIEN_SPRITES.length;
        state.score += ALIEN_SPRITES[row]?.points || 10;
        break;
      }
    }
    
    // Check shields
    for (const shield of state.shields) {
      if (shield.health > 0 &&
          bullet.pos.y === shield.pos.y &&
          bullet.pos.x >= shield.pos.x - 2 && bullet.pos.x <= shield.pos.x + 2) {
        state.bullets.splice(bi, 1);
        shield.health--;
        break;
      }
    }
  }
  
  // Check enemy bullet collisions
  for (let bi = state.enemyBullets.length - 1; bi >= 0; bi--) {
    const bullet = state.enemyBullets[bi]!;
    
    // Check player
    if (bullet.pos.y === state.player.pos.y &&
        bullet.pos.x >= state.player.pos.x && bullet.pos.x <= state.player.pos.x + 2) {
      state.enemyBullets.splice(bi, 1);
      state.lives--;
      addExplosion(state, state.player.pos.x, state.player.pos.y);
      state.player.pos.x = Math.floor(state.width / 2);
      
      if (state.lives <= 0) {
        state.gameOver = true;
        if (state.score > state.highScore) {
          state.highScore = state.score;
        }
      }
      continue;
    }
    
    // Check shields
    for (const shield of state.shields) {
      if (shield.health > 0 &&
          bullet.pos.y === shield.pos.y &&
          bullet.pos.x >= shield.pos.x - 2 && bullet.pos.x <= shield.pos.x + 2) {
        state.enemyBullets.splice(bi, 1);
        shield.health--;
        break;
      }
    }
  }

  // Check win
  if (state.enemies.length === 0) {
    state.won = true;
    state.score += 100 * state.level; // Smaller bonus
    if (state.score > state.highScore) {
      state.highScore = state.score;
    }
    return;
  }

  // Move enemies
  const moveInterval = getEnemyMoveInterval(state);
  if (state.tickCount % moveInterval === 0) {
    let shouldDescend = false;
    for (const enemy of state.enemies) {
      if (
        (state.enemyDirection === 1 && enemy.pos.x >= state.width - 4) ||
        (state.enemyDirection === -1 && enemy.pos.x <= 1)
      ) {
        shouldDescend = true;
        break;
      }
    }

    if (shouldDescend) {
      state.enemyDirection *= -1;
      for (const enemy of state.enemies) {
        enemy.pos.y += 1;
        if (enemy.pos.y >= state.height - 4) {
          state.gameOver = true;
          if (state.score > state.highScore) {
            state.highScore = state.score;
          }
          return;
        }
      }
    } else {
      for (const enemy of state.enemies) {
        enemy.pos.x += state.enemyDirection;
      }
    }
  }
}

export function getExplosionChar(frame: number): string {
  return EXPLOSION_FRAMES[frame] || " ";
}

export function getShieldChar(health: number): string {
  return SHIELD_CHARS[4 - health] || " ";
}
