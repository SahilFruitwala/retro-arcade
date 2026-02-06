import type { TwentyFortyEightGameState } from "./types";

export function init2048(width: number, height: number, highScore: number = 0): TwentyFortyEightGameState {
  const grid: number[][] = Array(4).fill(null).map(() => Array(4).fill(0));
  
  const state: TwentyFortyEightGameState = {
    grid,
    score: 0,
    highScore,
    gameOver: false,
    won: false,
    paused: false,
    width,
    height,
  };

  // Add two initial tiles
  addRandomTile(state);
  addRandomTile(state);

  return state;
}

function addRandomTile(state: TwentyFortyEightGameState): void {
  const emptyCells: { r: number, c: number }[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (state.grid[r]![c] === 0) {
        emptyCells.push({ r, c });
      }
    }
  }

  if (emptyCells.length > 0) {
    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)]!;
    state.grid[r]![c] = Math.random() < 0.9 ? 2 : 4;
  }
}

export function move(state: TwentyFortyEightGameState, dr: number, dc: number): boolean {
  if (state.gameOver) return false;

  let moved = false;
  const newGrid: number[][] = Array(4).fill(null).map(() => Array(4).fill(0));

  // Determine traversal order
  const rowStart = dr === 1 ? 3 : 0;
  const colStart = dc === 1 ? 3 : 0;
  const rowEnd = dr === 1 ? -1 : 4;
  const colEnd = dc === 1 ? -1 : 4;
  const rowStep = dr === 1 ? -1 : 1;
  const colStep = dc === 1 ? -1 : 1;

  // We process row by row or col by col depending on direction
  if (dr !== 0) {
    // Vertical move
    for (let c = 0; c < 4; c++) {
      const colValues: number[] = [];
      for (let r = rowStart; r !== rowEnd; r += rowStep) {
        if (state.grid[r]![c] !== 0) {
          colValues.push(state.grid[r]![c]!);
        }
      }

      const mergedValues: number[] = [];
      for (let i = 0; i < colValues.length; i++) {
        if (i < colValues.length - 1 && colValues[i] === colValues[i + 1]) {
          const newValue = colValues[i]! * 2;
          mergedValues.push(newValue);
          state.score += newValue;
          if (newValue === 2048) state.won = true;
          i++; // Skip next
          moved = true;
        } else {
          mergedValues.push(colValues[i]!);
        }
      }

      // Fill back to newGrid
      let r = rowStart;
      for (const val of mergedValues) {
        newGrid[r]![c] = val;
        if (state.grid[r]![c] !== val) moved = true;
        r += rowStep;
      }
      // Check if anything moved that wasn't a merge
      if (mergedValues.length < colValues.length) moved = true;
    }
  } else if (dc !== 0) {
    // Horizontal move
    for (let r = 0; r < 4; r++) {
      const rowValues: number[] = [];
      for (let c = colStart; c !== colEnd; c += colStep) {
        if (state.grid[r]![c] !== 0) {
          rowValues.push(state.grid[r]![c]!);
        }
      }

      const mergedValues: number[] = [];
      for (let i = 0; i < rowValues.length; i++) {
        if (i < rowValues.length - 1 && rowValues[i] === rowValues[i + 1]) {
          const newValue = rowValues[i]! * 2;
          mergedValues.push(newValue);
          state.score += newValue;
          if (newValue === 2048) state.won = true;
          i++; // Skip next
          moved = true;
        } else {
          mergedValues.push(rowValues[i]!);
        }
      }

      let c = colStart;
      for (const val of mergedValues) {
        newGrid[r]![c] = val;
        if (state.grid[r]![c] !== val) moved = true;
        c += colStep;
      }
      if (mergedValues.length < rowValues.length) moved = true;
    }
  }

  if (moved) {
    state.grid = newGrid;
    addRandomTile(state);
    if (state.score > state.highScore) {
        state.highScore = state.score;
    }
    checkGameOver(state);
  }

  return moved;
}

function checkGameOver(state: TwentyFortyEightGameState): void {
  // Check empty cells
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (state.grid[r]![c] === 0) return;
    }
  }

  // Check horizontal merges
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      if (state.grid[r]![c] === state.grid[r]![c + 1]) return;
    }
  }

  // Check vertical merges
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 3; r++) {
      if (state.grid[r]![c] === state.grid[r + 1]![c]) return;
    }
  }

  state.gameOver = true;
}
