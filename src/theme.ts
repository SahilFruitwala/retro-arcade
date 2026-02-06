// Theme System for Retro Arcade

export interface Theme {
  name: string;
  // Core UI
  background: string;
  border: string;
  text: string;
  textMuted: string;
  textHighlight: string;
  // Status
  success: string;
  danger: string;
  warning: string;
  // Game Entities
  player: string;
  playerAccent: string;
  enemy: string;
  enemyAlt: string;
  bullet: string;
  food: string;
  obstacle: string;
}

// Matrix Theme (Greens)
export const MATRIX_THEME: Theme = {
  name: "Matrix",
  background: "#000000",
  border: "#00FF00",
  text: "#00FF00",
  textMuted: "#006600",
  textHighlight: "#88FF88",
  success: "#00FF00",
  danger: "#FF0000",
  warning: "#FFFF00",
  player: "#00FF00",
  playerAccent: "#004400",
  enemy: "#00CC00",
  enemyAlt: "#009900",
  bullet: "#00FF00",
  food: "#00FF00",
  obstacle: "#008800",
};

// Retro Amber Theme
export const RETRO_THEME: Theme = {
  name: "Retro Amber",
  background: "#1A0F00",
  border: "#FF9900",
  text: "#FFBB33",
  textMuted: "#996600",
  textHighlight: "#FFDD88",
  success: "#FF9900",
  danger: "#FF3300",
  warning: "#FFCC00",
  player: "#FF9900",
  playerAccent: "#663300",
  enemy: "#FFAA00",
  enemyAlt: "#CC8800",
  bullet: "#FFCC00",
  food: "#FF6600",
  obstacle: "#AA6600",
};

// Cyberpunk Theme (Neon Pink/Blue)
export const CYBERPUNK_THEME: Theme = {
  name: "Cyberpunk",
  background: "#0D0221",
  border: "#FF00FF",
  text: "#00FFFF",
  textMuted: "#0088AA",
  textHighlight: "#FF88FF",
  success: "#00FF88",
  danger: "#FF0066",
  warning: "#FFFF00",
  player: "#00FFFF",
  playerAccent: "#004466",
  enemy: "#FF00FF",
  enemyAlt: "#FF66FF",
  bullet: "#00FFFF",
  food: "#FF00FF",
  obstacle: "#8800AA",
};

// Classic B&W Theme
export const CLASSIC_THEME: Theme = {
  name: "Classic",
  background: "#000000",
  border: "#FFFFFF",
  text: "#FFFFFF",
  textMuted: "#888888",
  textHighlight: "#FFFFFF",
  success: "#00FF00",
  danger: "#FF0000",
  warning: "#FFFF00",
  player: "#00FF00",
  playerAccent: "#004400",
  enemy: "#FFFFFF",
  enemyAlt: "#AAAAAA",
  bullet: "#FFFFFF",
  food: "#FF0000",
  obstacle: "#666666",
};

// All available themes
export const THEMES: Theme[] = [
  MATRIX_THEME,
  RETRO_THEME,
  CYBERPUNK_THEME,
  CLASSIC_THEME,
];

// Current theme state
let currentThemeIndex = 0;

export function getCurrentTheme(): Theme {
  return THEMES[currentThemeIndex]!;
}

export function setTheme(index: number): void {
  if (index >= 0 && index < THEMES.length) {
    currentThemeIndex = index;
  }
}

export function nextTheme(): Theme {
  currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
  return THEMES[currentThemeIndex]!;
}

export function getThemeNames(): string[] {
  return THEMES.map(t => t.name);
}
