# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**物理竞技场 (Physics Arena)** - A 2-player physics-based battle game where players use physics-themed cards to push each other out of a circular arena. Built with HTML5 Canvas and Matter.js.

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

### Core Files

| File | Purpose |
|------|---------|
| `client/js/constants.js` | Game config (canvas size, energy, gravity, etc.) |
| `client/js/physics.js` | Physics engine wrapper using Matter.js |
| `client/js/cardSystem.js` | Card definitions, deck management |
| `client/js/game.js` | Main game logic, turn management, card execution |
| `client/js/renderer.js` | Canvas rendering for arena, players, effects |
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
│   │   ├── physics.js      # Physics engine wrapper
│   │   ├── cardSystem.js   # Card definitions and deck
│   │   ├── renderer.js     # Canvas rendering
│   │   ├── game.js         # Game logic and state
│   │   └── main.js         # UI initialization and events
│   ├── server.js           # Static file server
│   └── start-server.sh     # Server startup script
└── PHYSICS_ARENA_PLAN.md   # Original design document
```
