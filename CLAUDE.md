# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**物理竞技场 (Physics Arena)** - A 2-player physics-based battle game where players use physics-themed cards to push each other out of a circular arena. Built with Three.js for 3D rendering and a custom 3D physics engine.

## Quick Start

```bash
# Start the development server
cd client && ./start-server.sh

# Then open http://localhost:8888 in your browser
```

## Key Architecture

### Game States
- `discard` phase: Player must discard cards if hand exceeds `MAX_HAND_SIZE` (6)
- `play` phase: Player can play cards using energy
- Turn order: Player 1 discard → Player 1 play → Player 2 discard → Player 2 play → New round

### 3D Architecture
The game uses a 3D stack:
- **Renderer**: Three.js WebGL rendering (see `renderer.js`)
- **Physics Engine**: Custom 3D physics with:
  - Player position/velocity updates
  - Collision detection and response
  - Constraints (rigid and soft rope)
  - Effect zones (gravity, friction, damping)

### Core Files

| File | Purpose |
|------|---------|
| `client/js/constants.js` | Game config (canvas size, energy, gravity, etc.) |
| `client/js/physics.js` | Custom 3D physics engine |
| `client/js/cardSystem.js` | Card definitions, deck management |
| `client/js/game.js` | Main game logic, turn management, card execution |
| `client/js/renderer.js` | Three.js 3D rendering |
| `client/js/main.js` | Game UI initialization, event handlers |
| `client/server.js` | Simple static HTTP server (port 8888) |

### Adding a New Card

1. Add card definition to `CARDS_DATABASE` in `cardSystem.js`
2. Add case to `executeCard()` switch in `game.js`
3. Add rendering for any new effects in `renderer.js` if needed
4. Update `index.html` card guide if needed

### Game Config

Edit constants in `client/js/constants.js`:
- `GAME_CONFIG`: Canvas size, arena radius, energy settings
- `PLAYER_CONFIG`: Mass, size, friction
- New constants can be added here

### Development Server

The server is a simple Node.js HTTP server serving static files.
- Port: 8888
- Directory: `client/`
- Start: `./start-server.sh`
- Stop: `pkill -f "node server.js"`

## Common Tasks

### Running the Game
```bash
cd client
./start-server.sh
# Open http://localhost:8888
```

### Checking Git Status
```bash
git status
git diff
```

## Project Structure

```
physicalBattle/
├── client/
│   ├── index.html          # Main HTML file with UI structure
│   ├── css/style.css       # Styles
│   ├── js/
│   │   ├── constants.js    # Game configuration
│   │   ├── physics.js      # Custom 3D physics engine
│   │   ├── cardSystem.js   # Card definitions and deck
│   │   ├── renderer.js     # Three.js 3D rendering
│   │   ├── game.js         # Game logic and state
│   │   └── main.js         # UI initialization and events
│   ├── server.js           # Static file server
│   └── start-server.sh     # Server startup script
├── PHYSICS_ARENA_PLAN.md   # Original 2D design document
└── 3D_TECHNOLOGY_SELECTION.md  # 3D architecture planning document
```
