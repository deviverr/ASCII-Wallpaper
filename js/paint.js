/* =====================================================================
   ASCII Studio — Paint Editor
   ===================================================================== */

const CHAR_CATEGORIES = [
  { name: 'Basic', chars: [
    '.', ',', ':', ';', '!', '?', '|', '/', '\\', '(', ')', '[', ']',
    '{', '}', '<', '>', '+', '-', '*', '=', '~', '_', '^', '#', '@',
    '%', '&', '$', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ]},
  { name: 'Letters', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('') },
  { name: 'Dense', chars: ['█','▓','▒','░','■','□','▪','▫','◆','◇','●','○','◉','◎','◈','⬤'] },
  { name: 'Block', chars: ['▀','▄','▐','▌','▝','▗','▖','▘','▟','▙','▛','▜','▞','▚','▬','▭'] },
  { name: 'Box', chars: [
    '─','│','┌','┐','└','┘','├','┤','┬','┴','┼',
    '═','║','╔','╗','╚','╝','╠','╣','╦','╩','╬',
    '╒','╓','╕','╖','╘','╙','╛','╜','╟','╢','╤','╧','╪','╫'
  ]},
  { name: 'Arrows', chars: ['→','←','↑','↓','↗','↘','↙','↖','↔','↕','▶','◀','▲','▼','►','◄','⟵','⟶'] },
  { name: 'Symbols', chars: ['★','☆','✦','✧','♦','♠','♣','♥','✓','✗','✕','×','÷','±','≤','≥','≠','≈','∞','√','π','∑','∏','∆','∇'] },
];

const SHADES = ['#ffffff', '#cccccc', '#999999', '#666666', '#333333'];

const TOOLS = ['pencil','eraser','fill','text','line','rect','select','eyedropper'];

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/* ─── Bresenham line ──────────────────────────────────────────────── */
function bresenham(c0, r0, c1, r1) {
  const pts = [];
  let dc = Math.abs(c1 - c0), dr = Math.abs(r1 - r0);
  let sc = c0 < c1 ? 1 : -1, sr = r0 < r1 ? 1 : -1;
  let err = dc - dr;
  let c = c0, r = r0;
  while (true) {
    pts.push({ col: c, row: r });
    if (c === c1 && r === r1) break;
    const e2 = 2 * err;
    if (e2 > -dr) { err -= dr; c += sc; }
    if (e2 < dc)  { err += dc; r += sr; }
  }
  return pts;
}

function lineChar(dc, dr) {
  if (dc === 0) return '│';
  if (dr === 0) return '─';
  const slope = Math.abs(dr / dc);
  if (slope < 0.5) return '─';
  if (slope > 2)   return '│';
  const goRight = dc > 0, goDown = dr > 0;
  return (goRight === goDown) ? '\\' : '/';
}

/* ─── PaintEditor ─────────────────────────────────────────────────── */
class PaintEditor {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx    = canvasEl.getContext('2d');
    this.dpr    = Math.min(window.devicePixelRatio || 1, 2);

    this.cols = 80;
    this.rows = 30;
    this.zoom = 1;
    this.showGrid = false;
    this.bgColor = '#000000';

    this.fontSize    = 14;
    this.fontFamily  = '"JetBrains Mono","Courier New",Courier,monospace';
    this.cellW = 0;
    this.cellH = 0;

    this.tool    = 'pencil';
    this.char    = '#';
    this.fg      = '#ffffff';

    this.cells    = this.createGrid();
    this.history  = [];
    this.histIdx  = -1;

    this.isDown      = false;
    this.drawStart   = null;   // {col,row} for line/rect start
    this.prevCell    = null;   // last cell drawn (pencil interpolation)
    this.previewGrid = null;   // overlay for line/rect preview
    this.selStart    = null;
    this.selEnd      = null;
    this.selection   = null;   // {c0,r0,c1,r1, cells}
    this.clipboard   = null;   // {cols,rows,cells}
    this.textCursor  = null;   // {col,row}

    this.measureFont();
    this.initCanvas();
    this.pushHistory();
    this.bindEvents();
    this.render();
  }

  /* ── Grid ── */
  createGrid(cols = this.cols, rows = this.rows) {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ char: ' ', fg: '#ffffff' }))
    );
  }

  getCell(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return this.cells[row][col];
  }

  setCell(col, row, ch, fg) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    this.cells[row][col] = { char: ch, fg: fg || this.fg };
  }

  /* ── Font / canvas sizing ── */
  measureFont() {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    this.cellW = ctx.measureText('M').width;
    this.cellH = this.fontSize * 1.3;
  }

  get eCellW() { return this.cellW * this.zoom; }
  get eCellH() { return this.cellH * this.zoom; }
  get eFont()  { return `${this.fontSize * this.zoom}px ${this.fontFamily}`; }

  initCanvas() {
    const { dpr, cols, rows, eCellW, eCellH } = this;
    const logW = cols * eCellW, logH = rows * eCellH;
    this.canvas.width  = Math.ceil(logW * dpr);
    this.canvas.height = Math.ceil(logH * dpr);
    this.canvas.style.width  = `${logW}px`;
    this.canvas.style.height = `${logH}px`;
  }

  /* ── Render ── */
  render() {
    const { ctx, dpr, cols, rows, eCellW, eCellH, bgColor } = this;
    const cw = cols * eCellW, ch = rows * eCellH;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);

    // Grid lines
    if (this.showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath(); ctx.moveTo(c * eCellW, 0); ctx.lineTo(c * eCellW, ch); ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * eCellH); ctx.lineTo(cw, r * eCellH); ctx.stroke();
      }
    }

    ctx.font = this.eFont;
    ctx.textBaseline = 'top';

    // Cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = this.cells[r][c];
        if (cell.char !== ' ') {
          ctx.fillStyle = cell.fg;
          ctx.fillText(cell.char, c * eCellW, r * eCellH);
        }
      }
    }

    // Preview overlay (line/rect during drag)
    if (this.previewGrid) {
      for (const { col, row, char } of this.previewGrid) {
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(char, col * eCellW, row * eCellH);
      }
    }

    // Text cursor
    if (this.textCursor && this.tool === 'text') {
      const { col, row } = this.textCursor;
      if (col < cols && row < rows) {
        const blink = Math.floor(Date.now() / 500) % 2 === 0;
        ctx.fillStyle = blink ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)';
        ctx.fillRect(col * eCellW, row * eCellH, eCellW, eCellH);
        const cell = this.cells[row][col];
        if (cell.char !== ' ') {
          ctx.fillStyle = '#000';
          ctx.fillText(cell.char, col * eCellW, row * eCellH);
        }
      }
    }

    // Selection
    if (this.selStart && this.selEnd) {
      const c0 = Math.min(this.selStart.col, this.selEnd.col);
      const r0 = Math.min(this.selStart.row, this.selEnd.row);
      const c1 = Math.max(this.selStart.col, this.selEnd.col);
      const r1 = Math.max(this.selStart.row, this.selEnd.row);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(c0 * eCellW - 0.5, r0 * eCellH - 0.5, (c1 - c0 + 1) * eCellW + 1, (r1 - r0 + 1) * eCellH + 1);
      ctx.setLineDash([]);
    }

    // Paste preview
    if (this.clipboardPreview) {
      const { col, row } = this.clipboardPreview;
      const clip = this.clipboard;
      if (clip) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(col * eCellW, row * eCellH, clip.cols * eCellW, clip.rows * eCellH);
        ctx.font = this.eFont;
        for (let r = 0; r < clip.rows; r++) {
          for (let c = 0; c < clip.cols; c++) {
            const cell = clip.cells[r][c];
            if (cell.char !== ' ') {
              ctx.fillStyle = 'rgba(255,255,255,0.4)';
              ctx.fillText(cell.char, (col + c) * eCellW, (row + r) * eCellH);
            }
          }
        }
      }
    }

    ctx.restore();
  }

  /* ── Coordinate mapping ── */
  cellFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
    const y = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top;
    return {
      col: Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.eCellW))),
      row: Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.eCellH))),
    };
  }

  /* ── History ── */
  pushHistory() {
    this.history = this.history.slice(0, this.histIdx + 1);
    this.history.push({
      cols: this.cols, rows: this.rows,
      cells: this.cells.map(row => row.map(c => ({ ...c })))
    });
    if (this.history.length > 60) this.history.shift();
    else this.histIdx++;
    this.updateHistoryUI();
  }

  undo() {
    if (this.histIdx <= 0) return;
    this.histIdx--;
    this.restoreHistory(this.history[this.histIdx]);
  }

  redo() {
    if (this.histIdx >= this.history.length - 1) return;
    this.histIdx++;
    this.restoreHistory(this.history[this.histIdx]);
  }

  restoreHistory(snap) {
    this.cols  = snap.cols;
    this.rows  = snap.rows;
    this.cells = snap.cells.map(row => row.map(c => ({ ...c })));
    this.selStart = this.selEnd = this.previewGrid = this.textCursor = null;
    this.initCanvas();
    this.render();
    this.updateHistoryUI();
    this.updateStatus();
  }

  updateHistoryUI() {
    document.getElementById('btn-undo').disabled = this.histIdx <= 0;
    document.getElementById('btn-redo').disabled = this.histIdx >= this.history.length - 1;
    document.getElementById('status-hist').textContent = `undo: ${this.histIdx}/${this.history.length - 1}`;
  }

  /* ── Tools ── */
  applyPencil(col, row, ch, fg) {
    this.setCell(col, row, ch ?? this.char, fg ?? this.fg);
  }

  applyEraser(col, row) {
    this.setCell(col, row, ' ', '#ffffff');
  }

  floodFill(startCol, startRow) {
    const targetChar = this.cells[startRow][startCol].char;
    const newChar    = this.char;
    const newFg      = this.fg;
    if (targetChar === newChar) return;
    const visited = new Uint8Array(this.cols * this.rows);
    const stack   = [startCol + startRow * this.cols];
    while (stack.length) {
      const idx = stack.pop();
      if (visited[idx]) continue;
      visited[idx] = 1;
      const c = idx % this.cols, r = Math.floor(idx / this.cols);
      if (this.cells[r][c].char !== targetChar) continue;
      this.cells[r][c] = { char: newChar, fg: newFg };
      if (c > 0) stack.push(idx - 1);
      if (c < this.cols - 1) stack.push(idx + 1);
      if (r > 0) stack.push(idx - this.cols);
      if (r < this.rows - 1) stack.push(idx + this.cols);
    }
  }

  buildLinePreview(c0, r0, c1, r1) {
    const dc = c1 - c0, dr = r1 - r0;
    const ch = lineChar(dc, dr);
    return bresenham(c0, r0, c1, r1).map(({ col, row }) => ({ col, row, char: ch }));
  }

  buildRectPreview(c0, r0, c1, r1) {
    const minC = Math.min(c0, c1), maxC = Math.max(c0, c1);
    const minR = Math.min(r0, r1), maxR = Math.max(r0, r1);
    const pts  = [];
    for (let c = minC; c <= maxC; c++) {
      pts.push({ col: c, row: minR, char: '─' });
      if (minR !== maxR) pts.push({ col: c, row: maxR, char: '─' });
    }
    for (let r = minR + 1; r < maxR; r++) {
      pts.push({ col: minC, row: r, char: '│' });
      if (minC !== maxC) pts.push({ col: maxC, row: r, char: '│' });
    }
    // Corners
    pts.push({ col: minC, row: minR, char: '┌' });
    if (minC !== maxC) pts.push({ col: maxC, row: minR, char: '┐' });
    if (minR !== maxR) {
      pts.push({ col: minC, row: maxR, char: '└' });
      if (minC !== maxC) pts.push({ col: maxC, row: maxR, char: '┘' });
    }
    return pts;
  }

  commitPreview() {
    if (!this.previewGrid) return;
    for (const { col, row, char } of this.previewGrid) {
      this.setCell(col, row, char, this.fg);
    }
    this.previewGrid = null;
  }

  /* ── Text mode ── */
  typeChar(ch) {
    if (!this.textCursor) return;
    let { col, row } = this.textCursor;
    if (ch === '\n' || ch === 'Enter') {
      row++;
      col = this.drawStart?.col ?? 0;
    } else if (ch === 'Backspace') {
      col--;
      if (col < 0) { col = this.cols - 1; row--; }
      if (row < 0) row = 0;
      this.setCell(col, row, ' ', this.fg);
    } else if (ch === 'Delete') {
      this.setCell(col, row, ' ', this.fg);
    } else if (ch === 'ArrowRight') { col++; }
    else if (ch === 'ArrowLeft')    { col--; }
    else if (ch === 'ArrowDown')    { row++; }
    else if (ch === 'ArrowUp')      { row--;  }
    else if (ch.length === 1) {
      this.setCell(col, row, ch, this.fg);
      col++;
    }
    if (col >= this.cols) { col = 0; row++; }
    if (col < 0) col = this.cols - 1;
    row = Math.max(0, Math.min(this.rows - 1, row));
    this.textCursor = { col, row };
    this.render();
  }

  /* ── Selection ── */
  getSelectionBounds() {
    if (!this.selStart || !this.selEnd) return null;
    return {
      c0: Math.min(this.selStart.col, this.selEnd.col),
      r0: Math.min(this.selStart.row, this.selEnd.row),
      c1: Math.max(this.selStart.col, this.selEnd.col),
      r1: Math.max(this.selStart.row, this.selEnd.row),
    };
  }

  copySelection() {
    const b = this.getSelectionBounds();
    if (!b) return;
    const cols = b.c1 - b.c0 + 1, rows = b.r1 - b.r0 + 1;
    this.clipboard = {
      cols, rows,
      cells: Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => ({ ...this.cells[b.r0 + r][b.c0 + c] }))
      )
    };
  }

  cutSelection() {
    this.copySelection();
    const b = this.getSelectionBounds();
    if (!b) return;
    this.pushHistory();
    for (let r = b.r0; r <= b.r1; r++)
      for (let c = b.c0; c <= b.c1; c++)
        this.cells[r][c] = { char: ' ', fg: '#ffffff' };
    this.selStart = this.selEnd = null;
    this.updateSelectionUI();
    this.render();
  }

  deleteSelection() {
    const b = this.getSelectionBounds();
    if (!b) return;
    this.pushHistory();
    for (let r = b.r0; r <= b.r1; r++)
      for (let c = b.c0; c <= b.c1; c++)
        this.cells[r][c] = { char: ' ', fg: '#ffffff' };
    this.selStart = this.selEnd = null;
    this.updateSelectionUI();
    this.render();
  }

  pasteAt(col, row) {
    if (!this.clipboard) return;
    this.pushHistory();
    for (let r = 0; r < this.clipboard.rows; r++)
      for (let c = 0; c < this.clipboard.cols; c++) {
        const src = this.clipboard.cells[r][c];
        this.setCell(col + c, row + r, src.char, src.fg);
      }
    this.clipboardPreview = null;
    this.render();
  }

  selectAll() {
    this.setTool('select');
    this.selStart = { col: 0, row: 0 };
    this.selEnd   = { col: this.cols - 1, row: this.rows - 1 };
    this.updateSelectionUI();
    this.render();
  }

  updateSelectionUI() {
    const hasSelection = !!(this.selStart && this.selEnd);
    document.getElementById('selection-ops').style.display = hasSelection ? '' : 'none';
  }

  /* ── Mouse handling ── */
  onMouseDown(e) {
    e.preventDefault();
    this.canvas.focus();
    const { col, row } = this.cellFromEvent(e);
    const rightClick = e.button === 2;

    if (this.tool === 'eyedropper') {
      const cell = this.getCell(col, row);
      if (cell && cell.char !== ' ') {
        this.char = cell.char;
        this.fg   = cell.fg;
        this.syncUI();
      }
      return;
    }

    if (this.tool === 'text') {
      this.drawStart  = { col, row };
      this.textCursor = { col, row };
      this.render();
      return;
    }

    if (this.tool === 'select') {
      this.isDown   = true;
      this.selStart = { col, row };
      this.selEnd   = { col, row };
      this.updateSelectionUI();
      this.render();
      return;
    }

    if (this.tool === 'line' || this.tool === 'rect') {
      this.isDown     = true;
      this.drawStart  = { col, row };
      this.previewGrid = [];
      this.render();
      return;
    }

    // Pencil / eraser / fill
    this.isDown = true;
    this.prevCell = { col, row };

    if (this.tool === 'fill') {
      this.pushHistory();
      this.floodFill(col, row);
      this.render();
      return;
    }

    this.pushHistory();
    if (this.tool === 'eraser' || rightClick) {
      this.applyEraser(col, row);
    } else {
      this.applyPencil(col, row);
    }
    this.render();
  }

  onMouseMove(e) {
    const { col, row } = this.cellFromEvent(e);
    document.getElementById('status-pos').textContent = `col:${col + 1} row:${row + 1}`;

    if (!this.isDown) return;

    if (this.tool === 'select') {
      this.selEnd = { col, row };
      this.render();
      return;
    }

    if (this.tool === 'line') {
      this.previewGrid = this.buildLinePreview(
        this.drawStart.col, this.drawStart.row, col, row
      );
      this.render();
      return;
    }

    if (this.tool === 'rect') {
      this.previewGrid = this.buildRectPreview(
        this.drawStart.col, this.drawStart.row, col, row
      );
      this.render();
      return;
    }

    if (this.tool === 'pencil' || this.tool === 'eraser') {
      const prev = this.prevCell;
      const pts  = bresenham(prev.col, prev.row, col, row);
      for (const { col: c, row: r } of pts) {
        if (this.tool === 'eraser') this.applyEraser(c, r);
        else this.applyPencil(c, r);
      }
      this.prevCell = { col, row };
      this.render();
    }
  }

  onMouseUp(e) {
    if (!this.isDown) return;
    this.isDown = false;
    const { col, row } = this.cellFromEvent(e);

    if (this.tool === 'line' || this.tool === 'rect') {
      this.commitPreview();
      this.pushHistory();
      this.render();
      return;
    }

    if (this.tool === 'select') {
      this.selEnd = { col, row };
      this.updateSelectionUI();
      this.render();
    }
  }

  /* ── Keyboard ── */
  onKeyDown(e) {
    const ctrl  = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key   = e.key;

    // Text mode captures most keys
    if (this.tool === 'text' && this.textCursor) {
      if (key === 'Escape') {
        this.textCursor = null;
        this.pushHistory();
        this.render();
        return;
      }
      if (!ctrl) {
        e.preventDefault();
        this.typeChar(key);
        return;
      }
    }

    // Global shortcuts
    if (ctrl) {
      switch (key.toLowerCase()) {
        case 'z': e.preventDefault(); shift ? this.redo() : this.undo(); break;
        case 'y': e.preventDefault(); this.redo(); break;
        case 'a': e.preventDefault(); this.selectAll(); break;
        case 'c': e.preventDefault(); this.copySelection(); break;
        case 'v':
          e.preventDefault();
          if (this.clipboard) {
            this.pasteAt(0, 0);
            this.pushHistory();
          }
          break;
        case 'x': e.preventDefault(); this.cutSelection(); break;
        case 's': e.preventDefault(); exportPNG(this); break;
        case 'n': e.preventDefault(); clearCanvas(this); break;
        case 'o': e.preventDefault(); document.getElementById('file-input').click(); break;
      }
      return;
    }

    // Tool shortcuts
    switch (key.toLowerCase()) {
      case 'p': this.setTool('pencil'); break;
      case 'e': this.setTool('eraser'); break;
      case 'f': this.setTool('fill'); break;
      case 't': this.setTool('text'); break;
      case 'l': this.setTool('line'); break;
      case 'r': this.setTool('rect'); break;
      case 's': this.setTool('select'); break;
      case 'i': this.setTool('eyedropper'); break;
      case 'g': toggleGrid(this); break;
      case '+': case '=': changeZoom(this, 1); break;
      case '-': changeZoom(this, -1); break;
      case '0': setZoom(this, 1); break;
      case 'escape':
        this.selStart = this.selEnd = null;
        this.textCursor = null;
        this.previewGrid = null;
        this.clipboardPreview = null;
        this.updateSelectionUI();
        this.render();
        break;
      case 'delete':
      case 'backspace':
        if (this.selStart) {
          e.preventDefault();
          this.deleteSelection();
        }
        break;
    }
  }

  /* ── Tool switching ── */
  setTool(t) {
    this.tool = t;
    this.textCursor = null;
    this.previewGrid = null;
    this.selStart = this.selEnd = null;
    this.isDown = false;
    this.updateSelectionUI();

    document.querySelectorAll('.tool-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === t);
    });

    const cursors = {
      pencil: 'crosshair', eraser: 'cell', fill: 'copy',
      text: 'text', line: 'crosshair', rect: 'crosshair',
      select: 'default', eyedropper: 'pointer'
    };
    this.canvas.style.cursor = cursors[t] || 'crosshair';
    document.getElementById('status-tool').textContent = t;
    this.render();
  }

  /* ── UI sync ── */
  syncUI() {
    document.getElementById('current-char-display').textContent = this.char;
    document.getElementById('char-input').value = this.char;
    document.getElementById('status-char').textContent = `char: ${this.char}`;
    document.querySelectorAll('.swatch').forEach(s => {
      s.classList.toggle('selected', s.dataset.color === this.fg);
    });
    document.querySelectorAll('.char-cell').forEach(c => {
      c.classList.toggle('selected', c.dataset.char === this.char);
    });
  }

  updateStatus() {
    document.getElementById('status-size').textContent = `${this.cols}×${this.rows}`;
  }

  /* ── Canvas ops ── */
  resize(cols, rows) {
    const newCells = this.createGrid(cols, rows);
    for (let r = 0; r < Math.min(rows, this.rows); r++)
      for (let c = 0; c < Math.min(cols, this.cols); c++)
        newCells[r][c] = { ...this.cells[r][c] };
    this.cols  = cols;
    this.rows  = rows;
    this.cells = newCells;
    this.selStart = this.selEnd = this.previewGrid = this.textCursor = null;
    this.initCanvas();
    this.pushHistory();
    this.updateStatus();
    this.render();
  }

  clear() {
    this.cells = this.createGrid();
    this.selStart = this.selEnd = this.previewGrid = this.textCursor = null;
    this.updateSelectionUI();
    this.pushHistory();
    this.render();
  }

  importTXT(text) {
    const lines = text.split('\n');
    const cols  = Math.max(...lines.map(l => l.length), 10);
    const rows  = lines.length;
    this.cols  = Math.min(cols, 300);
    this.rows  = Math.min(rows, 150);
    this.cells = this.createGrid();
    for (let r = 0; r < this.rows; r++) {
      const line = lines[r] || '';
      for (let c = 0; c < Math.min(line.length, this.cols); c++) {
        const ch = line[c];
        this.cells[r][c] = { char: ch === '\t' ? ' ' : ch, fg: '#ffffff' };
      }
    }
    this.initCanvas();
    this.pushHistory();
    this.updateStatus();
    this.render();
  }

  /* ── Event binding ── */
  bindEvents() {
    const cv = this.canvas;
    cv.addEventListener('mousedown',  e => this.onMouseDown(e));
    cv.addEventListener('mousemove',  e => this.onMouseMove(e));
    cv.addEventListener('mouseup',    e => this.onMouseUp(e));
    cv.addEventListener('mouseleave', e => { if (this.isDown) this.onMouseUp(e); });
    cv.addEventListener('contextmenu', e => e.preventDefault());

    // Touch
    cv.addEventListener('touchstart', e => {
      e.preventDefault();
      this.onMouseDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, button: 0 });
    }, { passive: false });
    cv.addEventListener('touchmove', e => {
      e.preventDefault();
      this.onMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }, { passive: false });
    cv.addEventListener('touchend', e => {
      e.preventDefault();
      this.onMouseUp({});
    }, { passive: false });

    // Keyboard
    cv.addEventListener('keydown', e => this.onKeyDown(e));
    document.addEventListener('keydown', e => {
      if (document.activeElement === cv) return;
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      this.onKeyDown(e);
    });

    // Scroll = wheel on canvas (let default scroll work on the wrapper)
    cv.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        changeZoom(this, e.deltaY < 0 ? 1 : -1);
      }
    }, { passive: false });

    // Blink cursor repaint
    if (this._blinkTimer) clearInterval(this._blinkTimer);
    this._blinkTimer = setInterval(() => {
      if (this.tool === 'text' && this.textCursor) this.render();
    }, 500);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Page-level functions
───────────────────────────────────────────────────────────────────── */
let editor;

function exportPNG(ed) {
  const el = ed || editor;
  const a  = document.createElement('a');
  a.download = 'ascii-art.png';
  a.href = el.canvas.toDataURL('image/png');
  a.click();
}

function exportTXT(ed) {
  const el = ed || editor;
  const lines = [];
  for (let r = 0; r < el.rows; r++) {
    let line = '';
    for (let c = 0; c < el.cols; c++) line += el.cells[r][c].char;
    lines.push(line.trimEnd());
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.download = 'ascii-art.txt';
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function clearCanvas(ed) {
  const el = ed || editor;
  el.clear();
}

function toggleGrid(ed) {
  const el = ed || editor;
  el.showGrid = !el.showGrid;
  document.getElementById('btn-toggle-grid').classList.toggle('active', el.showGrid);
  el.render();
}

function changeZoom(ed, dir) {
  const el = ed || editor;
  const idx = ZOOM_LEVELS.indexOf(el.zoom);
  const nidx = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, idx + dir));
  setZoom(el, ZOOM_LEVELS[nidx]);
}

function setZoom(ed, z) {
  const el = ed || editor;
  el.zoom = z;
  el.initCanvas();
  el.render();
  document.getElementById('zoom-display').textContent = `${Math.round(z * 100)}%`;
}

/* ─── Init ──────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('paint-canvas');
  editor = new PaintEditor(canvas);
  editor.updateStatus();

  /* ── Build char palette ── */
  const tabsEl  = document.getElementById('char-tabs');
  const gridEl  = document.getElementById('char-grid');
  let currentCat = 0;

  function buildPalette(catIdx) {
    currentCat = catIdx;
    gridEl.innerHTML = '';
    tabsEl.querySelectorAll('.char-tab').forEach((t, i) => t.classList.toggle('active', i === catIdx));
    for (const ch of CHAR_CATEGORIES[catIdx].chars) {
      const btn = document.createElement('button');
      btn.className   = 'char-cell';
      btn.textContent = ch;
      btn.dataset.char = ch;
      btn.title = `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
      if (ch === editor.char) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        editor.char = ch;
        editor.syncUI();
      });
      gridEl.appendChild(btn);
    }
  }

  CHAR_CATEGORIES.forEach((cat, i) => {
    const t = document.createElement('button');
    t.className   = 'char-tab' + (i === 0 ? ' active' : '');
    t.textContent = cat.name;
    t.addEventListener('click', () => buildPalette(i));
    tabsEl.appendChild(t);
  });
  buildPalette(0);

  /* ── Color swatches ── */
  const swatchesEl = document.getElementById('color-swatches');
  for (const color of SHADES) {
    const s = document.createElement('div');
    s.className   = 'swatch' + (color === editor.fg ? ' selected' : '');
    s.dataset.color = color;
    s.style.background = color;
    s.title = color;
    s.addEventListener('click', () => {
      editor.fg = color;
      editor.syncUI();
    });
    swatchesEl.appendChild(s);
  }

  /* ── Char input ── */
  const charInput = document.getElementById('char-input');
  charInput.addEventListener('input', () => {
    const v = charInput.value;
    if (v.length > 0) {
      editor.char = [...v].pop(); // last char if multiple
      charInput.value = editor.char;
      editor.syncUI();
    }
  });

  /* ── Tool buttons ── */
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => editor.setTool(btn.dataset.tool));
  });

  /* ── Topbar buttons ── */
  document.getElementById('btn-new').addEventListener('click', () => {
    if (confirm('Clear the canvas? This cannot be undone beyond undo history.')) clearCanvas();
  });
  document.getElementById('btn-undo').addEventListener('click', () => editor.undo());
  document.getElementById('btn-redo').addEventListener('click', () => editor.redo());
  document.getElementById('btn-zoom-in').addEventListener('click', () => changeZoom(editor, 1));
  document.getElementById('btn-zoom-out').addEventListener('click', () => changeZoom(editor, -1));
  document.getElementById('btn-zoom-reset').addEventListener('click', () => setZoom(editor, 1));
  document.getElementById('btn-toggle-grid').addEventListener('click', () => toggleGrid());
  document.getElementById('btn-export-png').addEventListener('click', () => exportPNG());
  document.getElementById('btn-export-txt').addEventListener('click', () => exportTXT());

  /* ── Resize modal ── */
  document.getElementById('btn-resize').addEventListener('click', () => {
    document.getElementById('modal-cols').value = editor.cols;
    document.getElementById('modal-rows').value = editor.rows;
    document.getElementById('modal-resize').classList.remove('hidden');
  });
  document.getElementById('modal-resize-cancel').addEventListener('click', () => {
    document.getElementById('modal-resize').classList.add('hidden');
  });
  document.getElementById('modal-resize-ok').addEventListener('click', () => {
    const c = parseInt(document.getElementById('modal-cols').value, 10);
    const r = parseInt(document.getElementById('modal-rows').value, 10);
    if (c >= 5 && r >= 3) editor.resize(c, r);
    document.getElementById('modal-resize').classList.add('hidden');
  });
  document.getElementById('modal-resize').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  /* Sidebar resize inputs */
  document.getElementById('btn-apply-size').addEventListener('click', () => {
    const c = parseInt(document.getElementById('canvas-cols').value, 10);
    const r = parseInt(document.getElementById('canvas-rows').value, 10);
    if (c >= 5 && r >= 3) editor.resize(c, r);
  });

  /* ── Import ── */
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => editor.importTXT(ev.target.result);
    reader.readAsText(file);
    e.target.value = '';
  });

  /* ── Selection panel buttons ── */
  document.getElementById('btn-copy').addEventListener('click', () => editor.copySelection());
  document.getElementById('btn-cut').addEventListener('click', () => editor.cutSelection());
  document.getElementById('btn-paste').addEventListener('click', () => {
    if (editor.clipboard) { editor.pasteAt(0, 0); editor.pushHistory(); }
  });
  document.getElementById('btn-sel-delete').addEventListener('click', () => editor.deleteSelection());
  document.getElementById('btn-sel-clear').addEventListener('click', () => {
    editor.selStart = editor.selEnd = null;
    editor.updateSelectionUI();
    editor.render();
  });

  /* ── Panel toggle on mobile ── */
  document.getElementById('btn-panel-toggle').addEventListener('click', () => {
    document.getElementById('side-panel').classList.toggle('open');
  });

  /* ── Paste via clipboard API ── */
  document.addEventListener('paste', e => {
    if (['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const text = e.clipboardData?.getData('text');
    if (text) editor.importTXT(text);
  });
});
