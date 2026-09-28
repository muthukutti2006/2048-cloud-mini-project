(() => {
  const SIZE = 4;
  const boardEl = document.querySelector('#board');
  const scoreEl = document.querySelector('#score');
  const bestEl = document.querySelector('#best');
  const messageEl = document.querySelector('#message');
  let grid, score, over, won, touchStart;
  let best = Number(localStorage.getItem('2048-best') || 0);
  bestEl.textContent = best;

  function start() {
    grid = Array.from({length: SIZE}, () => Array(SIZE).fill(0));
    score = 0; over = false; won = false;
    messageEl.textContent = '';
    addTile(); addTile(); render();
  }
  function addTile() {
    const empty = [];
    grid.forEach((row, r) => row.forEach((value, c) => { if (!value) empty.push([r,c]); }));
    if (!empty.length) return;
    const [r,c] = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = Math.random() < .9 ? 2 : 4;
  }
  function render() {
    boardEl.replaceChildren();
    grid.flat().forEach(value => {
      const cell = document.createElement('div');
      cell.className = 'cell'; cell.setAttribute('role','gridcell');
      cell.dataset.value = value || ''; cell.textContent = value || '';
      cell.setAttribute('aria-label', value ? String(value) : 'empty');
      boardEl.append(cell);
    });
    scoreEl.textContent = score;
    if (score > best) { best = score; localStorage.setItem('2048-best', best); bestEl.textContent = best; }
  }
  function compress(line) {
    const values = line.filter(Boolean), result = [];
    for (let i=0; i<values.length; i++) {
      if (values[i] === values[i+1]) { result.push(values[i] * 2); score += values[i] * 2; i++; }
      else result.push(values[i]);
    }
    while (result.length < SIZE) result.push(0);
    return result;
  }
  function move(direction) {
    if (over) return;
    const before = JSON.stringify(grid);
    for (let i=0; i<SIZE; i++) {
      let line;
      if (direction === 'left' || direction === 'right') line = [...grid[i]];
      else line = grid.map(row => row[i]);
      if (direction === 'right' || direction === 'down') line.reverse();
      line = compress(line);
      if (direction === 'right' || direction === 'down') line.reverse();
      for (let j=0; j<SIZE; j++) {
        if (direction === 'left' || direction === 'right') grid[i][j] = line[j];
        else grid[j][i] = line[j];
      }
    }
    if (before === JSON.stringify(grid)) return;
    addTile(); render();
    if (!won && grid.flat().includes(2048)) { won = true; messageEl.textContent = 'You reached 2048! Keep going or start a new game.'; }
    if (!canMove()) { over = true; messageEl.textContent = 'Game over. Start a new game to try again.'; }
  }
  function canMove() {
    if (grid.flat().includes(0)) return true;
    for (let r=0; r<SIZE; r++) for (let c=0; c<SIZE; c++)
      if ((r<SIZE-1 && grid[r][c]===grid[r+1][c]) || (c<SIZE-1 && grid[r][c]===grid[r][c+1])) return true;
    return false;
  }
  document.addEventListener('keydown', event => {
    const directions = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
    if (directions[event.key]) { event.preventDefault(); move(directions[event.key]); }
  });
  document.querySelector('#new-game').addEventListener('click', start);
  boardEl.addEventListener('touchstart', e => { touchStart = [e.changedTouches[0].clientX,e.changedTouches[0].clientY]; }, {passive:true});
  boardEl.addEventListener('touchend', e => {
    if (!touchStart) return;
    const dx=e.changedTouches[0].clientX-touchStart[0], dy=e.changedTouches[0].clientY-touchStart[1];
    if (Math.max(Math.abs(dx),Math.abs(dy))>25) move(Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up'));
    touchStart=null;
  }, {passive:true});
  start();
})();
