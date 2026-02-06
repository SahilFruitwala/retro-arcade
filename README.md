# Retro Arcade

A terminal-based arcade collection built with Bun and OpenTUI. Currently features **Space Invaders** and **Snake**.

## How to Play

Download the `retro-arcade` binary for your system.

### Controls

**General**
- `↑ / ↓`: Navigate Menu
- `Enter`: Select Game
- `Q`: Quit to Menu (in-game)
- `Ctrl+C`: Exit App (saves progress)

**Space Invaders**
- `← / →`: Move Ship
- `Space`: Fire
- `P`: Pause

**Snake**
- `Arrow Keys`: Move
- `P`: Pause
- `R`: Restart

## Installation

No installation required! This is a standalone executable.
1. Download the `retro-arcade` file.
2. Open your terminal.
3. Run the game:
   ```bash
   ./retro-arcade
   ```
   *(On macOS/Linux, you may need to run `chmod +x retro-arcade` first)*

## Development

To build the project effectively:

1. **Install Dependencies**:
   ```bash
   bun install
   ```

2. **Run Locally**:
   ```bash
   bun run index.ts
   ```

3. **Build Binary**:
   This compiles the app into a single executable file for your current OS.
   ```bash
   bun run build
   ```
   To build for other platforms (Windows/Linux), run this command on that system.

