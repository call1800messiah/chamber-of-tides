# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Kammer der Gezeiten" (Chamber of Tides) is a browser-based board game tracker/helper for a tabletop game. It is a static frontend-only app (vanilla HTML/CSS/JS, no build system or dependencies). Game state persists in `localStorage`.

The UI language is **German**.

## Running

Open `index.html` directly in a browser. No server, build step, or package manager required.

## Architecture

The entire app is three files:

- **`index.html`** — Layout with sidebar controls, chamber container, ritual overlay, and tooltip
- **`js/app.js`** — All game logic, state management, and DOM rendering (~740 lines, single file)
- **`css/style.css`** — Styling with CSS custom properties, animations (caustics, flow rotation, glow pulses)

### Game Model (`js/app.js`)

- **Config constants** (top of file): 9 symbol types, 4 players, 9 rings × 9 slots grid, 3 phases with 3 types each
- **State object**: round, phase, symbols array, activeSymbols map, players (with positions and items), itemPositions, completedSymbols, removedItems, history stack for undo
- **Symbol positioning**: `computePosition()` maps (ring, slot) to (x, y) pixel coordinates in a circular layout with alternating ring angle offsets
- **Phase progression**: Each phase unlocks 3 symbol types. `advancePhase()` checks for matched symbols (player on active symbol with matching item), marks them completed, removes used items, then advances
- **Rendering**: Full DOM rebuild each `render()` call — symbols, player tokens, item tokens, sidebar lists, legend. No virtual DOM or diffing
- **Distance tracking**: SVG overlay showing distance line from selected player to cursor, with void/blocked-zone intersection detection via `lineIntersectsCircle()` and `lineCrossesBlockedZone()`
- **Blocked zones**: Four quadrants (NW/NE/SW/SE) can be toggled; movement lines crossing them show as blocked
