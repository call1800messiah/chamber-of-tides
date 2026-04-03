// === Config ===
const SYMBOL_TYPES = [
  { glyph: '\u273F', name: 'Anemone',   color: '#ff6b9d' },
  { glyph: '\u2605', name: 'Starfish',  color: '#ffa654' },
  { glyph: '\u25C6', name: 'Crystal',   color: '#54d4ff' },
  { glyph: '\u25B2', name: 'Fin',       color: '#7dff54' },
  { glyph: '\u25CF', name: 'Pearl',     color: '#e8e8ff' },
  { glyph: '\u2B1F', name: 'Shell',     color: '#ffde54' },
  { glyph: '\u2726', name: 'Urchin',    color: '#d154ff' },
  { glyph: '\u26A1', name: 'Eel',       color: '#54ffcc' },
  { glyph: '\u263D', name: 'Moonjelly', color: '#8899ff' },
];

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'];
const PLAYER_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
const RINGS = 9;
const SLOTS = 9;
const ACTIVE_PER_TYPE = 2;
const TYPES_PER_PHASE = 3;
const MAX_PHASES = 3;

// === State ===
let state = null;
let selectedPlayerId = null;

// === Utility ===
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// === Symbol Positioning ===
function computePosition(ring, slot, chamberSize) {
  const cx = chamberSize / 2;
  const cy = chamberSize / 2;
  const minR = chamberSize * 0.225;
  const maxR = chamberSize * 0.45;
  const ringRadius = minR + (maxR - minR) * (ring / (RINGS - 1));
  const angleOffset = (ring % 2) * 20;
  const angleDeg = slot * (360 / SLOTS) + angleOffset;
  const angleRad = angleDeg * Math.PI / 180;
  return {
    x: cx + ringRadius * Math.cos(angleRad),
    y: cy + ringRadius * Math.sin(angleRad),
  };
}

// === State Creation ===
function createNewGame() {
  const symbols = [];
  let id = 0;
  for (let ring = 0; ring < RINGS; ring++) {
    const typeOrder = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (let slot = 0; slot < SLOTS; slot++) {
      symbols.push({ id: id++, type: typeOrder[slot], ring, slot });
    }
  }

  // Distribute 9 items evenly: players get 2, 2, 2, 3
  const itemOrder = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const itemDistribution = [
    itemOrder.slice(0, 3).sort((a, b) => a - b),
    itemOrder.slice(3, 5).sort((a, b) => a - b),
    itemOrder.slice(5, 7).sort((a, b) => a - b),
    itemOrder.slice(7, 9).sort((a, b) => a - b),
  ];
  // Shuffle which player gets 3 items
  const playerOrder = shuffle([0, 1, 2, 3]);

  const players = PLAYER_NAMES.map((name, i) => ({
    id: i,
    name,
    color: PLAYER_COLORS[i],
    ring: Math.floor(RINGS / 2),
    slot: i * 2,
    items: itemDistribution[playerOrder[i]],
  }));

  state = {
    round: 0,
    phase: 1,
    symbols,
    activeSymbols: generateActiveSymbols(symbols, 1),
    players,
    history: [],
  };

  selectedPlayerId = null;
  saveState();
  render();
}

function generateActiveSymbols(symbols, phase) {
  const active = {};
  const maxType = phase * TYPES_PER_PHASE;
  for (let type = 0; type < 9; type++) {
    if (type < maxType) {
      const ofType = symbols.filter(s => s.type === type);
      const picked = shuffle(ofType).slice(0, ACTIVE_PER_TYPE);
      active[type] = picked.map(s => s.id);
    } else {
      active[type] = [];
    }
  }
  return active;
}

// === Actions ===
function nextRound() {
  state.history.push({
    round: state.round,
    phase: state.phase,
    activeSymbols: deepCopy(state.activeSymbols),
    players: deepCopy(state.players),
  });
  state.round++;
  state.activeSymbols = generateActiveSymbols(state.symbols, state.phase);
  saveState();
  render();
}

function undo() {
  if (state.history.length === 0) return;
  const prev = state.history.pop();
  state.round = prev.round;
  state.phase = prev.phase;
  state.activeSymbols = prev.activeSymbols;
  state.players = prev.players;
  saveState();
  render();
}

function advancePhase() {
  if (state.phase >= MAX_PHASES) return;
  state.history.push({
    round: state.round,
    phase: state.phase,
    activeSymbols: deepCopy(state.activeSymbols),
    players: deepCopy(state.players),
  });
  state.phase++;
  state.activeSymbols = generateActiveSymbols(state.symbols, state.phase);
  saveState();
  render();
}

function movePlayer(playerId, ring, slot) {
  const p = state.players[playerId];
  p.ring = ring;
  p.slot = slot;
  saveState();
  render();
}

function assignItem(typeIndex, playerId) {
  // Remove from any current holder
  state.players.forEach(p => {
    p.items = p.items.filter(i => i !== typeIndex);
  });
  if (playerId !== null) {
    state.players[playerId].items.push(typeIndex);
    state.players[playerId].items.sort((a, b) => a - b);
  }
  saveState();
  render();
}

// === Persistence ===
function saveState() {
  try {
    localStorage.setItem('chamberOfTides', JSON.stringify(state));
  } catch (e) { /* silently fail */ }
}

function loadState() {
  try {
    const saved = localStorage.getItem('chamberOfTides');
    if (saved) {
      state = JSON.parse(saved);
      if (!state.phase) state.phase = 1;
      return true;
    }
  } catch (e) { /* fall through */ }
  return false;
}

// === Active set helpers ===
function isUnlocked(symbolType) {
  return symbolType < state.phase * TYPES_PER_PHASE;
}

function isActive(symbolId) {
  for (const ids of Object.values(state.activeSymbols)) {
    if (ids.includes(symbolId)) return true;
  }
  return false;
}

function playerAtPosition(ring, slot) {
  return state.players.find(p => p.ring === ring && p.slot === slot);
}

function isMatched(symbol) {
  if (!isActive(symbol.id)) return false;
  const player = playerAtPosition(symbol.ring, symbol.slot);
  return player && player.items.includes(symbol.type);
}

// === Rendering ===
function render() {
  const chamber = document.getElementById('chamber');
  const chamberSize = chamber.offsetWidth;
  chamber.innerHTML = '<div class="chamber-void"></div>';

  // Render symbols
  state.symbols.forEach(sym => {
    const pos = computePosition(sym.ring, sym.slot, chamberSize);
    const el = document.createElement('span');
    el.className = 'symbol';
    const unlocked = isUnlocked(sym.type);
    const active = unlocked && isActive(sym.id);
    const matched = isMatched(sym);
    if (!unlocked) {
      el.classList.add('locked');
    } else {
      el.classList.add(active ? 'active' : 'inactive');
    }
    if (matched) el.classList.add('matched');
    el.textContent = SYMBOL_TYPES[sym.type].glyph;
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.style.color = SYMBOL_TYPES[sym.type].color;
    if (active) {
      el.style.textShadow = `0 0 8px ${SYMBOL_TYPES[sym.type].color}`;
    }

    // Click to move selected player here
    el.addEventListener('click', () => {
      if (selectedPlayerId !== null) {
        movePlayer(selectedPlayerId, sym.ring, sym.slot);
      }
    });

    // Tooltip
    el.addEventListener('mouseenter', (e) => {
      const tooltip = document.getElementById('tooltip');
      tooltip.textContent = `${SYMBOL_TYPES[sym.type].name} (Ring ${sym.ring + 1}, Slot ${sym.slot + 1})${active ? ' \u2014 ACTIVE' : ''}`;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY - 8) + 'px';
    });
    el.addEventListener('mousemove', (e) => {
      const tooltip = document.getElementById('tooltip');
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY - 8) + 'px';
    });
    el.addEventListener('mouseleave', () => {
      document.getElementById('tooltip').style.display = 'none';
    });

    chamber.appendChild(el);
  });

  // Render player tokens
  state.players.forEach(p => {
    const pos = computePosition(p.ring, p.slot, chamberSize);
    const el = document.createElement('div');
    el.className = 'player-token';
    el.textContent = (p.id + 1);
    el.style.backgroundColor = p.color;
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.style.boxShadow = `0 0 8px ${p.color}88`;
    // Offset slightly so multiple players at same position don't fully overlap
    const offset = state.players.filter(pp => pp.ring === p.ring && pp.slot === p.slot && pp.id < p.id).length;
    if (offset > 0) {
      el.style.transform = `translate(calc(-50% + ${offset * 14}px), calc(-50% - 14px))`;
    }
    chamber.appendChild(el);
  });

  // Round and phase display
  document.getElementById('roundNum').textContent = state.round;
  document.getElementById('phaseNum').textContent = state.phase;
  document.getElementById('btnUndo').disabled = state.history.length === 0;
  document.getElementById('btnAdvancePhase').disabled = state.phase >= MAX_PHASES;

  // Player list
  renderPlayerList();
  // Unassigned items
  renderUnassignedItems();
  // Legend
  renderLegend();
}

function renderPlayerList() {
  const container = document.getElementById('playerList');
  container.innerHTML = '';
  state.players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'player-card' + (selectedPlayerId === p.id ? ' selected' : '');
    card.addEventListener('click', () => {
      selectedPlayerId = selectedPlayerId === p.id ? null : p.id;
      renderPlayerList();
    });

    const header = document.createElement('div');
    header.className = 'player-header';
    const dot = document.createElement('div');
    dot.className = 'player-dot';
    dot.style.backgroundColor = p.color;
    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = p.name;
    header.appendChild(dot);
    header.appendChild(name);
    card.appendChild(header);

    if (p.items.length > 0) {
      const items = document.createElement('div');
      items.className = 'player-items';
      p.items.forEach(typeIdx => {
        const chip = document.createElement('span');
        chip.className = 'item-chip on-player';
        chip.style.color = SYMBOL_TYPES[typeIdx].color;
        chip.textContent = SYMBOL_TYPES[typeIdx].glyph + ' ' + SYMBOL_TYPES[typeIdx].name;
        chip.title = 'Click to unassign';
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          assignItem(typeIdx, null);
        });
        items.appendChild(chip);
      });
      card.appendChild(items);
    }

    container.appendChild(card);
  });
}

function renderUnassignedItems() {
  const container = document.getElementById('unassignedItems');
  container.innerHTML = '';
  const assigned = new Set(state.players.flatMap(p => p.items));
  SYMBOL_TYPES.forEach((st, idx) => {
    if (assigned.has(idx)) return;
    const chip = document.createElement('span');
    chip.className = 'item-chip';
    chip.style.color = st.color;
    chip.textContent = st.glyph + ' ' + st.name;
    chip.title = selectedPlayerId !== null
      ? `Click to give to ${state.players[selectedPlayerId].name}`
      : 'Select a player first';
    chip.addEventListener('click', () => {
      if (selectedPlayerId !== null) {
        assignItem(idx, selectedPlayerId);
      }
    });
    container.appendChild(chip);
  });
}

function renderLegend() {
  const container = document.getElementById('legend');
  container.innerHTML = '';
  SYMBOL_TYPES.forEach((st, idx) => {
    const row = document.createElement('div');
    row.className = 'legend-item';
    const glyph = document.createElement('span');
    glyph.className = 'legend-glyph';
    glyph.textContent = st.glyph;
    glyph.style.color = st.color;
    const name = document.createElement('span');
    name.textContent = st.name;
    const count = document.createElement('span');
    count.className = 'legend-count';
    const activeCount = (state.activeSymbols[idx] || []).length;
    count.textContent = `${activeCount} active`;
    row.appendChild(glyph);
    row.appendChild(name);
    row.appendChild(count);
    container.appendChild(row);
  });
}

// === Event Handlers ===
document.getElementById('btnNextRound').addEventListener('click', nextRound);
document.getElementById('btnAdvancePhase').addEventListener('click', advancePhase);
document.getElementById('btnUndo').addEventListener('click', undo);
document.getElementById('btnNewGame').addEventListener('click', () => {
  if (state.round > 0 && !confirm('Start a new game? Current progress will be lost.')) return;
  createNewGame();
});

// Re-render on resize
window.addEventListener('resize', () => {
  if (state) render();
});

// === Init ===
if (!loadState()) {
  createNewGame();
} else {
  render();
}
