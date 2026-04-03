// === Config ===
const SYMBOL_TYPES = [
  { glyph: '\u273F', name: 'Anemone',    color: '#ff6b9d' },
  { glyph: '\u2605', name: 'Seestern',  color: '#ffa654' },
  { glyph: '\u25C6', name: 'Kristall',  color: '#54d4ff' },
  { glyph: '\u25B2', name: 'Flosse',    color: '#7dff54' },
  { glyph: '\u25CF', name: 'Perle',     color: '#e8e8ff' },
  { glyph: '\u2B1F', name: 'Muschel',   color: '#ffde54' },
  { glyph: '\u2726', name: 'Seeigel',   color: '#d154ff' },
  { glyph: '\u26A1', name: 'Aal',       color: '#54ffcc' },
  { glyph: '\u263D', name: 'Mondqualle', color: '#8899ff' },
];

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'];
const PLAYER_NAMES = ['Spieler 1', 'Spieler 2', 'Spieler 3', 'Spieler 4'];
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
    completedSymbols: [],
    removedItems: [],
    history: [],
  };

  selectedPlayerId = null;
  document.getElementById('ritualOverlay').classList.remove('visible');
  saveState();
  render();
}

function generateActiveSymbols(symbols, phase) {
  const active = {};
  const minType = (phase - 1) * TYPES_PER_PHASE;
  const maxType = phase * TYPES_PER_PHASE;
  for (let type = 0; type < 9; type++) {
    if (type >= minType && type < maxType) {
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
    completedSymbols: [...state.completedSymbols],
    removedItems: [...state.removedItems],
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
  state.completedSymbols = prev.completedSymbols;
  state.removedItems = prev.removedItems;
  state.ritualComplete = prev.ritualComplete || false;
  document.getElementById('ritualOverlay').classList.remove('visible');
  saveState();
  render();
}

function advancePhase() {
  // Final phase: complete the ritual
  if (state.phase >= MAX_PHASES) {
    completeRitual();
    return;
  }
  state.history.push({
    round: state.round,
    phase: state.phase,
    activeSymbols: deepCopy(state.activeSymbols),
    players: deepCopy(state.players),
    completedSymbols: [...state.completedSymbols],
    removedItems: [...state.removedItems],
  });

  // Find symbols completed this phase (player on active symbol with matching item)
  const completedItemTypes = new Set();
  state.symbols.forEach(sym => {
    if (isActive(sym.id) && isMatched(sym)) {
      state.completedSymbols.push(sym.id);
      completedItemTypes.add(sym.type);
    }
  });

  // Remove completed items from players and mark as removed
  completedItemTypes.forEach(type => {
    state.removedItems.push(type);
    state.players.forEach(p => {
      p.items = p.items.filter(i => i !== type);
    });
  });

  state.phase++;
  state.activeSymbols = generateActiveSymbols(state.symbols, state.phase);
  saveState();
  render();
}

function completeRitual() {
  // Mark final phase matched symbols as completed
  state.history.push({
    round: state.round,
    phase: state.phase,
    activeSymbols: deepCopy(state.activeSymbols),
    players: deepCopy(state.players),
    completedSymbols: [...state.completedSymbols],
    removedItems: [...state.removedItems],
    ritualComplete: state.ritualComplete || false,
  });

  state.symbols.forEach(sym => {
    if (isActive(sym.id) && isMatched(sym)) {
      state.completedSymbols.push(sym.id);
    }
  });

  state.ritualComplete = true;
  saveState();
  render();
  document.getElementById('ritualOverlay').classList.add('visible');
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
      if (!state.completedSymbols) state.completedSymbols = [];
      if (!state.removedItems) state.removedItems = [];
      return true;
    }
  } catch (e) { /* fall through */ }
  return false;
}

// === Active set helpers ===
function isUnlocked(symbolType) {
  const minType = (state.phase - 1) * TYPES_PER_PHASE;
  const maxType = state.phase * TYPES_PER_PHASE;
  return symbolType >= minType && symbolType < maxType;
}

function isCompleted(symbolId) {
  return state.completedSymbols.includes(symbolId);
}

function isPhaseComplete() {
  const minType = (state.phase - 1) * TYPES_PER_PHASE;
  const maxType = state.phase * TYPES_PER_PHASE;
  for (let type = minType; type < maxType; type++) {
    const activeIds = state.activeSymbols[type] || [];
    const matched = activeIds.some(id => {
      const sym = state.symbols[id];
      const player = playerAtPosition(sym.ring, sym.slot);
      return player && player.items.includes(sym.type);
    });
    if (!matched) return false;
  }
  return true;
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
  chamber.innerHTML = '<div class="chamber-void"></div>' +
    '<svg class="distance-overlay" id="distanceOverlay"></svg>' +
    '<div class="distance-label" id="distanceLabel"></div>';

  // Render symbols
  state.symbols.forEach(sym => {
    const pos = computePosition(sym.ring, sym.slot, chamberSize);
    const el = document.createElement('span');
    el.className = 'symbol';
    const completed = isCompleted(sym.id);
    const unlocked = isUnlocked(sym.type);
    const active = unlocked && isActive(sym.id);
    const matched = isMatched(sym);
    if (completed) {
      el.classList.add('completed');
    } else if (!unlocked) {
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
      const statusText = completed ? ' \u2014 ABGESCHLOSSEN' : (active ? ' \u2014 AKTIV' : '');
      tooltip.textContent = `${SYMBOL_TYPES[sym.type].name} (Ring ${sym.ring + 1}, Platz ${sym.slot + 1})${statusText}`;
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

  const advanceBtn = document.getElementById('btnAdvancePhase');
  const phaseComplete = isPhaseComplete();
  if (state.phase >= MAX_PHASES) {
    advanceBtn.textContent = 'Ritual beenden';
    advanceBtn.disabled = state.ritualComplete || !phaseComplete;
  } else {
    advanceBtn.textContent = 'Ritualphase voranschreiten';
    advanceBtn.disabled = !phaseComplete;
  }

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
        chip.title = 'Klicken zum Entfernen';
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
  const removed = new Set(state.removedItems || []);
  SYMBOL_TYPES.forEach((st, idx) => {
    if (assigned.has(idx) || removed.has(idx)) return;
    const chip = document.createElement('span');
    chip.className = 'item-chip';
    chip.style.color = st.color;
    chip.textContent = st.glyph + ' ' + st.name;
    chip.title = selectedPlayerId !== null
      ? `Klicken, um an ${state.players[selectedPlayerId].name} zu geben`
      : 'Zuerst einen Spieler ausw\u00E4hlen';
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
    const isRemoved = (state.removedItems || []).includes(idx);
    if (isRemoved) {
      count.textContent = 'abgeschlossen';
      count.style.color = '#7dff54';
    } else {
      const activeCount = (state.activeSymbols[idx] || []).length;
      count.textContent = `${activeCount} aktiv`;
    }
    row.appendChild(glyph);
    row.appendChild(name);
    row.appendChild(count);
    container.appendChild(row);
  });
}

// === Geometry Helpers ===
function lineIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
  // Check if line segment from (x1,y1) to (x2,y2) intersects circle at (cx,cy) with radius r
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

// === Distance Line ===
const SPHERE_DIAMETER_M = 100;

function setupDistanceTracking() {
  const chamber = document.getElementById('chamber');

  chamber.addEventListener('mousemove', (e) => {
    const overlay = document.getElementById('distanceOverlay');
    const label = document.getElementById('distanceLabel');
    if (selectedPlayerId === null || !state) {
      overlay.innerHTML = '';
      label.style.display = 'none';
      return;
    }

    const rect = chamber.getBoundingClientRect();
    const chamberSize = rect.width;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = chamberSize / 2;
    const cy = chamberSize / 2;
    const radius = chamberSize / 2;

    // Check if mouse is within the sphere
    const distFromCenter = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
    if (distFromCenter > radius) {
      overlay.innerHTML = '';
      label.style.display = 'none';
      return;
    }

    const player = state.players[selectedPlayerId];
    const playerPos = computePosition(player.ring, player.slot, chamberSize);

    // Pixel distance
    const dx = mx - playerPos.x;
    const dy = my - playerPos.y;
    const pixelDist = Math.sqrt(dx * dx + dy * dy);

    // Convert to meters (chamber diameter in pixels = SPHERE_DIAMETER_M meters)
    const meters = (pixelDist / chamberSize) * SPHERE_DIAMETER_M;

    // Check if line crosses the central void (15% radius = 30% diameter div)
    const voidRadius = chamberSize * 0.15;
    const crossesVoid = lineIntersectsCircle(playerPos.x, playerPos.y, mx, my, cx, cy, voidRadius);

    const lineClass = crossesVoid ? 'class="illegal"' : '';
    const strokeColor = crossesVoid ? '#ff4444' : player.color;

    overlay.innerHTML = `<line ${lineClass} x1="${playerPos.x}" y1="${playerPos.y}" x2="${mx}" y2="${my}"
      stroke="${strokeColor}" stroke-width="2" stroke-dasharray="6,4" stroke-opacity="0.7"/>`;

    label.style.display = 'block';
    label.style.left = mx + 'px';
    label.style.top = my + 'px';
    label.style.borderColor = crossesVoid ? '#ff4444' : player.color;
    label.textContent = crossesVoid ? `${meters.toFixed(1)}m \u2014 BLOCKIERT` : `${meters.toFixed(1)}m`;
  });

  chamber.addEventListener('mouseleave', () => {
    const overlay = document.getElementById('distanceOverlay');
    const label = document.getElementById('distanceLabel');
    overlay.innerHTML = '';
    label.style.display = 'none';
  });
}

// === Event Handlers ===
document.getElementById('btnNextRound').addEventListener('click', nextRound);
document.getElementById('btnAdvancePhase').addEventListener('click', advancePhase);
document.getElementById('btnUndo').addEventListener('click', undo);
document.getElementById('btnNewGame').addEventListener('click', () => {
  if (state.round > 0 && !confirm('Neues Spiel starten? Der aktuelle Fortschritt geht verloren.')) return;
  createNewGame();
});

// Re-render on resize
window.addEventListener('resize', () => {
  if (state) render();
});

setupDistanceTracking();

// === Init ===
if (!loadState()) {
  createNewGame();
} else {
  render();
  if (state.ritualComplete) {
    document.getElementById('ritualOverlay').classList.add('visible');
  }
}
