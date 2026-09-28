/**
 * game.js — 2048 tile-slider
 *
 * Architecture
 * ────────────
 *  • State lives in a flat 16-element array (index = row*4 + col).
 *  • Every move is computed purely on the state array; the DOM is
 *    then reconciled from the new state to produce animations.
 *  • CSS Grid columns/rows are 1-indexed; the tile's grid position
 *    is set via inline style so CSS transitions animate the slide.
 *
 * Public surface (called from HTML buttons / keyboard / touch):
 *   newGame()   – restart
 *   keepPlaying() – dismiss win overlay, continue
 */

'use strict';

/* ══════════════════════════════════════════════════════
   Constants
══════════════════════════════════════════════════════ */
const GRID_SIZE   = 4;
const CELL_COUNT  = GRID_SIZE * GRID_SIZE;
const WIN_VALUE   = 2048;
const LS_BEST_KEY = 'game2048_best';

/* ══════════════════════════════════════════════════════
   State
══════════════════════════════════════════════════════ */
/**
 * @type {number[]} 16-element board; 0 = empty.
 */
let board        = [];
let score        = 0;
let best         = 0;
let won          = false;   // true once 2048 tile was created
let keepPlaying  = false;   // true after user clicked "Keep Playing"
let gameOver     = false;
let tileIdCounter = 0;      // unique id for each tile element

/** Parallel array — tracks which DOM tile id sits at each cell */
let tileIds      = [];      // length 16, value = tile DOM id or null

/* ══════════════════════════════════════════════════════
   DOM references
══════════════════════════════════════════════════════ */
const scoreEl    = document.getElementById('score-display');
const bestEl     = document.getElementById('best-display');
const container  = document.getElementById('tile-container');
const overlay    = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');
const btnKeep    = document.getElementById('btn-keep-playing');
const btnTryAgain= document.getElementById('btn-try-again');
const btnNew     = document.getElementById('btn-new');
const announcer  = document.getElementById('status-announce');

/* ══════════════════════════════════════════════════════
   Utility helpers
══════════════════════════════════════════════════════ */
const idx  = (r, c)  => r * GRID_SIZE + c;
const row  = (i)     => Math.floor(i / GRID_SIZE);
const col  = (i)     => i % GRID_SIZE;
const rand = (n)     => Math.floor(Math.random() * n);
const pick = (...a)  => a[rand(a.length)];

function announce(msg) {
  announcer.textContent = '';
  // Force a DOM flush so the re-assignment triggers the live region.
  requestAnimationFrame(() => { announcer.textContent = msg; });
}

/* ══════════════════════════════════════════════════════
   Score
══════════════════════════════════════════════════════ */
function loadBest() {
  const stored = parseInt(localStorage.getItem(LS_BEST_KEY), 10);
  best = isNaN(stored) ? 0 : stored;
  bestEl.textContent = best;
}

function addScore(n) {
  score += n;
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    try { localStorage.setItem(LS_BEST_KEY, best); } catch (_) {}
  }
  // Pop-up animation on the score card
  const card  = scoreEl.parentElement;
  const bump  = document.createElement('span');
  bump.className   = 'score-bump';
  bump.textContent = `+${n}`;
  bump.setAttribute('aria-hidden', 'true');
  card.appendChild(bump);
  bump.addEventListener('animationend', () => bump.remove());
}

/* ══════════════════════════════════════════════════════
   Board logic (pure — no DOM)
══════════════════════════════════════════════════════ */
function emptyBoard() {
  board   = new Array(CELL_COUNT).fill(0);
  tileIds = new Array(CELL_COUNT).fill(null);
}

/**
 * Spawn a new tile (2 with 90% probability, 4 with 10%) at a
 * random empty cell. Returns the cell index, or -1 if board full.
 */
function spawnTile() {
  const empty = board.reduce((acc, v, i) => { if (!v) acc.push(i); return acc; }, []);
  if (!empty.length) return -1;
  const i     = empty[rand(empty.length)];
  board[i]    = pick(2, 2, 2, 2, 2, 2, 2, 2, 2, 4); // 90 / 10 ratio
  tileIds[i]  = null; // will be assigned by renderNewTile
  return i;
}

/* ── Slide one row/column (left-to-right logic) ──────── */
/**
 * Slides a 4-element array to the left, merging equal neighbours.
 * Returns { line, gained, mergedAt } where mergedAt is the index
 * (in the result) of the tile that was just merged.
 */
function slideLine(line) {
  // Filter non-zero
  const nums = line.filter(v => v);
  const result = [0, 0, 0, 0];
  let gained = 0;
  const mergedAt = [];
  let ri = 0;
  for (let ni = 0; ni < nums.length; ni++) {
    if (ni + 1 < nums.length && nums[ni] === nums[ni + 1]) {
      result[ri] = nums[ni] * 2;
      gained += result[ri];
      mergedAt.push(ri);
      ri++;
      ni++; // skip paired tile
    } else {
      result[ri] = nums[ni];
      ri++;
    }
  }
  return { line: result, gained, mergedAt };
}

/* ── Apply a move to the full board ─────────────────── */
/**
 * direction: 'left' | 'right' | 'up' | 'down'
 * Returns { moved: boolean, gained: number, newMerges: Set<cellIdx> }
 */
function applyMove(direction) {
  const prevBoard = board.slice();
  let totalGained = 0;
  const mergedCells = new Set();

  // Normalise every move to "slide left" on a transformed board
  const transforms = getTransform(direction);

  for (let primary = 0; primary < GRID_SIZE; primary++) {
    // Extract line
    const lineIdx = transforms.extractIdx(primary);
    const lineVals = lineIdx.map(i => board[i]);
    const lineIds  = lineIdx.map(i => tileIds[i]);

    const { line: newVals, gained, mergedAt } = slideLine(lineVals);
    totalGained += gained;

    // Map old ids along the slide
    // Build new id positions:
    const srcIds = lineIds.filter((id, j) => lineVals[j] !== 0);
    const newIds = [null, null, null, null];

    // Walk through newVals; wherever a merge happened, keep the
    // "surviving" tile id and drop the other.
    let si = 0; // index into srcIds
    for (let ni = 0; ni < GRID_SIZE; ni++) {
      if (newVals[ni] === 0) continue;
      if (mergedAt.includes(ni)) {
        // Two source tiles merged into ni; keep second id, remove first
        newIds[ni] = srcIds[si + 1];
        si += 2;
      } else {
        newIds[ni] = srcIds[si];
        si++;
      }
    }

    // Write back
    lineIdx.forEach((cellIdx, pos) => {
      board[cellIdx]   = newVals[pos];
      tileIds[cellIdx] = newIds[pos];
    });

    // Record merged cell indices (absolute)
    mergedAt.forEach(pos => {
      if (newVals[pos]) mergedCells.add(lineIdx[pos]);
    });
  }

  const moved = !board.every((v, i) => v === prevBoard[i]);
  return { moved, gained: totalGained, mergedCells };
}

/**
 * Returns functions to extract / write a row or column for each direction,
 * always in "left-to-right" (low→high index) order so slideLine works uniformly.
 */
function getTransform(direction) {
  switch (direction) {
    case 'left':
      return {
        extractIdx: r => [idx(r,0), idx(r,1), idx(r,2), idx(r,3)],
      };
    case 'right':
      return {
        extractIdx: r => [idx(r,3), idx(r,2), idx(r,1), idx(r,0)],
      };
    case 'up':
      return {
        extractIdx: c => [idx(0,c), idx(1,c), idx(2,c), idx(3,c)],
      };
    case 'down':
      return {
        extractIdx: c => [idx(3,c), idx(2,c), idx(1,c), idx(0,c)],
      };
  }
}

/* ── Win / game-over detection ───────────────────────── */
function hasMoves() {
  // Any empty cell?
  if (board.includes(0)) return true;
  // Any adjacent equal pair?
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = board[idx(r, c)];
      if (c < GRID_SIZE - 1 && board[idx(r, c+1)] === v) return true;
      if (r < GRID_SIZE - 1 && board[idx(r+1, c)] === v) return true;
    }
  }
  return false;
}

function hasWon() {
  return board.includes(WIN_VALUE);
}

/* ══════════════════════════════════════════════════════
   DOM rendering
══════════════════════════════════════════════════════ */

/** Map of tile id → <div> element currently in the DOM */
const tileEls = new Map();

/**
 * Create a brand-new tile element and add it to the container.
 * Returns the generated id.
 */
function createTileEl(value, r, c, isNew = true) {
  const id  = ++tileIdCounter;
  const el  = document.createElement('div');
  el.id     = `tile-${id}`;
  el.className = 'tile' + (isNew ? ' is-new' : '');
  el.dataset.value = value;
  el.textContent   = value;
  el.setAttribute('aria-label', `Tile ${value}`);
  setTilePosition(el, r, c);
  container.appendChild(el);
  tileEls.set(id, el);
  return id;
}

function setTilePosition(el, r, c) {
  el.style.gridColumn = c + 1;
  el.style.gridRow    = r + 1;
}

/**
 * Full re-render after a new game — clear container, rebuild all tiles.
 */
function renderFullBoard() {
  // Remove all existing tile elements
  tileEls.forEach(el => el.remove());
  tileEls.clear();
  tileIdCounter = 0;

  for (let i = 0; i < CELL_COUNT; i++) {
    if (board[i]) {
      const id = createTileEl(board[i], row(i), col(i), false);
      tileIds[i] = id;
    }
  }
}

/**
 * After applyMove, update the DOM:
 *  1. Move surviving tiles to their new grid positions (CSS transition).
 *  2. Add merge animation to merged tiles.
 *  3. Spawn + animate the new tile.
 *  4. Remove tiles that were consumed by a merge.
 */
function renderMove(mergedCells, spawnIdx, prevTileIds) {
  // Step 1 & 2 — move / merge existing tiles
  const consumed = new Set();

  for (let i = 0; i < CELL_COUNT; i++) {
    const id = tileIds[i];
    if (!id) continue;
    const el = tileEls.get(id);
    if (!el) continue;

    // Update position (CSS transition handles the slide animation)
    setTilePosition(el, row(i), col(i));

    // Update value & color (may have changed due to merge)
    el.dataset.value = board[i];
    el.textContent   = board[i];
    el.setAttribute('aria-label', `Tile ${board[i]}`);

    if (mergedCells.has(i)) {
      // Restart merge animation
      el.classList.remove('is-merged');
      // Force reflow
      void el.offsetWidth;
      el.classList.add('is-merged');
      el.addEventListener('animationend', () => el.classList.remove('is-merged'), { once: true });
    }
  }

  // Determine tiles that are no longer referenced by tileIds
  const currentIds = new Set(tileIds.filter(Boolean));
  prevTileIds.forEach(id => {
    if (id && !currentIds.has(id)) {
      consumed.add(id);
    }
  });

  // Step 3 — render the newly spawned tile
  if (spawnIdx !== -1 && board[spawnIdx]) {
    const id = createTileEl(board[spawnIdx], row(spawnIdx), col(spawnIdx), true);
    tileIds[spawnIdx] = id;
  }

  // Step 4 — remove consumed tiles after slide animation finishes
  setTimeout(() => {
    consumed.forEach(id => {
      const el = tileEls.get(id);
      if (el) { el.remove(); tileEls.delete(id); }
    });
  }, 120);
}

/* ── Overlay ─────────────────────────────────────────── */
function showOverlay(msg, showKeep = false) {
  overlayMsg.textContent = msg;
  btnKeep.classList.toggle('hidden', !showKeep);
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

/* ══════════════════════════════════════════════════════
   Game flow
══════════════════════════════════════════════════════ */
function newGame() {
  score       = 0;
  won         = false;
  keepPlaying = false;
  gameOver    = false;
  scoreEl.textContent = 0;

  emptyBoard();
  hideOverlay();

  // Spawn two starting tiles
  const i1 = spawnTile();
  const i2 = spawnTile();

  renderFullBoard();
  announce('New game started. Good luck!');
}

function keepPlayingFn() {
  keepPlaying = true;
  hideOverlay();
  announce('Keep playing — aim for 4096!');
}

/* ── Process one move ────────────────────────────────── */
function move(direction) {
  if (gameOver) return;
  if (won && !keepPlaying) return;

  const prevTileIds = tileIds.slice();

  const { moved, gained, mergedCells } = applyMove(direction);
  if (!moved) return;

  if (gained) addScore(gained);

  const spawnIdx = spawnTile();

  renderMove(mergedCells, spawnIdx, prevTileIds);

  // Check win
  if (!won && hasWon()) {
    won = true;
    setTimeout(() => {
      showOverlay('🎉 You reached 2048!', true);
      announce('You win! You reached 2048. You can keep playing or start a new game.');
    }, 220);
    return;
  }

  // Check game over
  if (!hasMoves()) {
    gameOver = true;
    setTimeout(() => {
      showOverlay('Game Over');
      announce(`Game over. Final score: ${score}.`);
    }, 220);
    return;
  }

  // Announce score for screen readers
  if (gained) announce(`Merged tiles. Score: ${score}.`);
}

/* ══════════════════════════════════════════════════════
   Input handling
══════════════════════════════════════════════════════ */

/* ── Keyboard ─────────────────────────────────────────── */
const KEY_MAP = {
  ArrowLeft : 'left',  ArrowRight: 'right',
  ArrowUp   : 'up',   ArrowDown : 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  A: 'left', D: 'right', W: 'up', S: 'down',
};

document.addEventListener('keydown', e => {
  const dir = KEY_MAP[e.key];
  if (dir) {
    e.preventDefault(); // prevent page scroll
    move(dir);
  }
});

/* ── Touch / swipe ────────────────────────────────────── */
let touchStartX = null;
let touchStartY = null;
const SWIPE_THRESHOLD = 30; // px

document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  touchStartX = null;
  touchStartY = null;

  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    move(dx > 0 ? 'right' : 'left');
  } else {
    move(dy > 0 ? 'down' : 'up');
  }
}, { passive: true });

/* ── Buttons ──────────────────────────────────────────── */
btnNew.addEventListener('click',      newGame);
btnTryAgain.addEventListener('click', newGame);
btnKeep.addEventListener('click',     keepPlayingFn);

/* ══════════════════════════════════════════════════════
   Bootstrap
══════════════════════════════════════════════════════ */
loadBest();
newGame();
