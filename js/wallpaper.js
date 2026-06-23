/* =====================================================================
   ASCII Studio — Wallpaper Maker
   ===================================================================== */

const CHARSETS = {
  ascii:   ['.', ':', '-', '=', '+', '*', '#', '@', '%', '&', '$', '?', '!', '^', '~'],
  blocks:  ['░', '▒', '▓', '█', '▄', '▀', '▌', '▐', '▟', '▙', '▛', '▜'],
  box:     ['─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼', '═', '║'],
  dense:   ['@', '#', '%', '&', '$', '?', '!', '8', 'B', 'M', 'W', 'G'],
  minimal: ['.', '·', '°', '\'', '`', '·'],
};

/* seeded PRNG (mulberry32) */
function makeRNG(seed) {
  let s = seed | 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ─── WallpaperMaker ─────────────────────────────────────────────── */
class WallpaperMaker {
  constructor() {
    this.resolution  = { w: 1920, h: 1080 };
    this.pattern     = 'noise';
    this.charsetKey  = 'ascii';
    this.customChars = '.:-=+*#@';
    this.fontSize    = 14;
    this.fontFamily  = '"JetBrains Mono","Courier New",Courier,monospace';
    this.bgColor     = '#000000';
    this.fgColor     = '#ffffff';
    this.density     = 0.80;
    this.overlays    = [];   // [{text, size, align}]
    this.cells       = [];
    this.seed        = Math.random() * 0xFFFFFFFF | 0;

    this.cellW = 0;
    this.cellH = 0;
    this.cols  = 0;
    this.rows  = 0;

    this.previewCanvas = document.getElementById('wp-canvas');
    this.previewCtx    = this.previewCanvas.getContext('2d');

    this.measureFont();
  }

  /* ── Font measurement ─────────────────────────────────── */
  measureFont() {
    const tmp = document.createElement('canvas').getContext('2d');
    tmp.font = `${this.fontSize}px ${this.fontFamily}`;
    this.cellW = tmp.measureText('M').width;
    this.cellH = this.fontSize * 1.3;
    this.cols  = Math.floor(this.resolution.w / this.cellW);
    this.rows  = Math.floor(this.resolution.h / this.cellH);
  }

  get chars() {
    if (this.charsetKey === 'custom') {
      return [...new Set([...this.customChars])].filter(c => c.trim());
    }
    return CHARSETS[this.charsetKey] || CHARSETS.ascii;
  }

  /* ── Generate ─────────────────────────────────────────── */
  generate() {
    this.seed = Math.random() * 0xFFFFFFFF | 0;
    this.measureFont();
    const rng   = makeRNG(this.seed);
    const chars = this.chars;
    if (!chars.length) return;

    switch (this.pattern) {
      case 'noise':     this.cells = this.genNoise(rng, chars); break;
      case 'gradient':  this.cells = this.genGradient(rng, chars); break;
      case 'matrix':    this.cells = this.genMatrix(rng, chars); break;
      case 'scanlines': this.cells = this.genScanlines(rng, chars); break;
      case 'grid':      this.cells = this.genGrid(rng); break;
      case 'border':    this.cells = this.genBorder(rng, chars); break;
      case 'wave':      this.cells = this.genWave(rng, chars); break;
      case 'diagonal':  this.cells = this.genDiagonal(rng, chars); break;
      case 'spiral':    this.cells = this.genSpiral(rng, chars); break;
      default:          this.cells = this.genNoise(rng, chars);
    }

    this.renderPreview();
    this.updateInfo();
  }

  /* ── Patterns ─────────────────────────────────────────── */
  genNoise(rng, chars) {
    return Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () =>
        rng() < this.density ? chars[Math.floor(rng() * chars.length)] : ' '
      )
    );
  }

  genGradient(rng, chars) {
    // Left-to-right density gradient using char density
    const sorted = [...chars].sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0));
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => {
        const t = c / (this.cols - 1);          // 0 → 1 left to right
        const d = this.density * (1 - t * 0.7); // dense left, sparse right
        if (rng() > d) return ' ';
        const cIdx = Math.floor(t * sorted.length);
        return sorted[Math.min(cIdx, sorted.length - 1)];
      })
    );
  }

  genMatrix(rng, chars) {
    // Vertical "falling" columns, dense at top, sparse at bottom
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => {
        const t = r / (this.rows - 1); // 0 top, 1 bottom
        const inStream = rng() < (1 - t * 0.6) * this.density;
        if (!inStream) return ' ';
        // Chance of bright char at top of stream
        const bright = rng() < 0.1;
        return bright ? chars[0] : chars[Math.floor(rng() * chars.length)];
      })
    );
  }

  genScanlines(rng, chars) {
    // Alternating filled/empty rows
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, () => {
        if (r % 2 === 0 && rng() < this.density) return chars[Math.floor(rng() * chars.length)];
        return ' ';
      })
    );
  }

  genGrid(rng) {
    // Box-drawing grid pattern with content inside cells
    const gapC = 4, gapR = 3;
    const chars = this.chars;
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => {
        const onH  = r % (gapR + 1) === 0;
        const onV  = c % (gapC + 1) === 0;
        if (onH && onV) return '┼';
        if (onH) return '─';
        if (onV) return '│';
        if (rng() < this.density * 0.3) return chars[Math.floor(rng() * chars.length)];
        return ' ';
      })
    );
  }

  genBorder(rng, chars) {
    // Double-border frame with noise inside
    const cells = Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => {
        const edge = r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1;
        const inner = r === 1 || r === this.rows - 2 || c === 1 || c === this.cols - 2;
        if (edge) {
          if (r === 0 && c === 0) return '╔';
          if (r === 0 && c === this.cols - 1) return '╗';
          if (r === this.rows - 1 && c === 0) return '╚';
          if (r === this.rows - 1 && c === this.cols - 1) return '╝';
          if (r === 0 || r === this.rows - 1) return '═';
          return '║';
        }
        if (inner) {
          if (r === 1 && c === 1) return '┌';
          if (r === 1 && c === this.cols - 2) return '┐';
          if (r === this.rows - 2 && c === 1) return '└';
          if (r === this.rows - 2 && c === this.cols - 2) return '┘';
          if (r === 1 || r === this.rows - 2) return '─';
          return '│';
        }
        if (rng() < this.density * 0.4) return chars[Math.floor(rng() * chars.length)];
        return ' ';
      })
    );
    return cells;
  }

  genWave(rng, chars) {
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => {
        const freq   = 2;
        const amp    = this.rows * 0.12;
        const center = this.rows / 2;
        const wave   = center + Math.sin((c / this.cols) * Math.PI * freq * 2) * amp;
        const dist   = Math.abs(r - wave);
        const d      = Math.exp(-dist * dist / (2 * 3 * 3));
        if (rng() < d * this.density) return chars[Math.floor(rng() * chars.length)];
        if (rng() < this.density * 0.1) return chars[Math.floor(rng() * chars.length)];
        return ' ';
      })
    );
  }

  genDiagonal(rng, chars) {
    const stripe = 5;
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => {
        const diag = (r + c) % (stripe * 2);
        if (diag < stripe && rng() < this.density) return chars[Math.floor(rng() * chars.length)];
        return ' ';
      })
    );
  }

  genSpiral(rng, chars) {
    const cells = Array.from({ length: this.rows }, () => Array(this.cols).fill(' '));
    const cx = this.cols / 2, cy = this.rows / 2;
    const maxR = Math.min(this.cols, this.rows) / 2;
    const turns = 4;
    const steps = 8000;
    for (let i = 0; i < steps; i++) {
      const t   = i / steps;
      const ang = t * Math.PI * 2 * turns;
      const r   = t * maxR;
      const c   = Math.round(cx + Math.cos(ang) * r);
      const row = Math.round(cy + Math.sin(ang) * r * (this.cellW / this.cellH));
      if (c >= 0 && c < this.cols && row >= 0 && row < this.rows) {
        if (rng() < this.density) {
          cells[row][c] = chars[Math.floor(rng() * chars.length)];
        }
      }
    }
    return cells;
  }

  /* ── Text overlays ─────────────────────────────────────── */
  applyOverlays() {
    for (const ov of this.overlays) {
      this.applyTextOverlay(ov);
    }
  }

  applyTextOverlay({ text, size, align }) {
    const scale = size || 2;
    // Simple block letter rendering using a tiny 5x7 pixel font
    const glyphs = getBlockGlyphs(text.toUpperCase(), scale);
    if (!glyphs) return;

    const textW = glyphs[0].length;
    const textH = glyphs.length;
    let startC, startR;

    startC = Math.floor((this.cols - textW) / 2);
    if (align === 'top')    startR = Math.floor(this.rows * 0.1);
    else if (align === 'bottom') startR = Math.floor(this.rows * 0.85) - textH;
    else                    startR = Math.floor((this.rows - textH) / 2);

    for (let r = 0; r < textH; r++) {
      for (let c = 0; c < textW; c++) {
        const tr = startR + r;
        const tc = startC + c;
        if (tr >= 0 && tr < this.rows && tc >= 0 && tc < this.cols) {
          if (glyphs[r][c]) this.cells[tr][tc] = '█';
          else if (this.cells[tr]) this.cells[tr][tc] = ' ';
        }
      }
    }
  }

  /* ── Render preview ────────────────────────────────────── */
  renderPreview() {
    if (!this.cells.length) return;

    const { resolution, cellW, cellH, fontSize, fontFamily, bgColor, fgColor } = this;
    const canvas  = this.previewCanvas;
    const ctx     = this.previewCtx;
    const dpr     = window.devicePixelRatio || 1;

    // Fit preview in the available space
    const wrap    = canvas.parentElement;
    const maxW    = wrap.clientWidth  - 48;
    const maxH    = wrap.clientHeight - 48;
    const srcW    = this.cols * cellW;
    const srcH    = this.rows * cellH;
    const scale   = Math.min(maxW / srcW, maxH / srcH, 1);
    const dispW   = srcW * scale;
    const dispH   = srcH * scale;

    canvas.width        = Math.round(dispW * dpr);
    canvas.height       = Math.round(dispH * dpr);
    canvas.style.width  = `${dispW}px`;
    canvas.style.height = `${dispH}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, dispW, dispH);

    // Characters
    const scaledFS  = fontSize * scale;
    const scaledCW  = cellW * scale;
    const scaledCH  = cellH * scale;
    ctx.font         = `${scaledFS}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle    = fgColor;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = this.cells[r]?.[c];
        if (ch && ch !== ' ') {
          ctx.fillText(ch, c * scaledCW, r * scaledCH);
        }
      }
    }

    ctx.restore();
  }

  /* ── Export PNG at full resolution ────────────────────── */
  async exportPNG() {
    if (!this.cells.length) { this.generate(); }

    const { resolution, cellW, cellH, fontSize, fontFamily, bgColor, fgColor } = this;
    const exp = document.createElement('canvas');
    exp.width  = resolution.w;
    exp.height = resolution.h;
    const ctx  = exp.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, resolution.w, resolution.h);

    ctx.font         = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle    = fgColor;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = this.cells[r]?.[c];
        if (ch && ch !== ' ') {
          ctx.fillText(ch, c * cellW, r * cellH);
        }
      }
    }

    const a = document.createElement('a');
    a.download = `ascii-wallpaper-${resolution.w}x${resolution.h}.png`;
    a.href     = exp.toDataURL('image/png');
    a.click();
  }

  exportTXT() {
    if (!this.cells.length) return;
    const lines = this.cells.map(row => row.join('').trimEnd());
    const blob  = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a     = document.createElement('a');
    a.download  = `ascii-wallpaper-${this.resolution.w}x${this.resolution.h}.txt`;
    a.href      = URL.createObjectURL(blob);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  updateInfo() {
    const el = document.getElementById('wp-info');
    if (el) {
      el.textContent =
        `${this.cols} cols × ${this.rows} rows\n` +
        `${this.resolution.w}×${this.resolution.h}px  ${this.fontSize}px font`;
    }
  }
}

/* ─── Tiny block-letter renderer ──────────────────────────────────── */
// 5-wide × 7-tall pixel glyphs for A-Z, 0-9, space, some punctuation
const FONT5 = {
  ' ': [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
  'A': [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1],
  'B': [1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,0],
  'C': [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,1, 0,1,1,1,0],
  'D': [1,1,1,0,0, 1,0,0,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,1,0, 1,1,1,0,0],
  'E': [1,1,1,1,1, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,0, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,1],
  'F': [1,1,1,1,1, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0],
  'G': [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,0, 1,0,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
  'H': [1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1],
  'I': [1,1,1,1,1, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 1,1,1,1,1],
  'J': [0,0,1,1,1, 0,0,0,1,0, 0,0,0,1,0, 0,0,0,1,0, 1,0,0,1,0, 1,0,0,1,0, 0,1,1,0,0],
  'K': [1,0,0,0,1, 1,0,0,1,0, 1,0,1,0,0, 1,1,0,0,0, 1,0,1,0,0, 1,0,0,1,0, 1,0,0,0,1],
  'L': [1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,1],
  'M': [1,0,0,0,1, 1,1,0,1,1, 1,0,1,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1],
  'N': [1,0,0,0,1, 1,1,0,0,1, 1,0,1,0,1, 1,0,0,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1],
  'O': [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
  'P': [1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0],
  'Q': [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,1,0,1, 1,0,0,1,0, 0,1,1,0,1],
  'R': [1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,0, 1,0,1,0,0, 1,0,0,1,0, 1,0,0,0,1],
  'S': [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,0, 0,1,1,1,0, 0,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
  'T': [1,1,1,1,1, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0],
  'U': [1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
  'V': [1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,0,1,0, 0,1,0,1,0, 0,0,1,0,0],
  'W': [1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,1,0,1, 1,1,0,1,1, 1,1,0,1,1, 1,0,0,0,1],
  'X': [1,0,0,0,1, 0,1,0,1,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,1,0,1,0, 1,0,0,0,1],
  'Y': [1,0,0,0,1, 0,1,0,1,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0],
  'Z': [1,1,1,1,1, 0,0,0,0,1, 0,0,0,1,0, 0,0,1,0,0, 0,1,0,0,0, 1,0,0,0,0, 1,1,1,1,1],
  '0': [0,1,1,1,0, 1,0,0,1,1, 1,0,1,0,1, 1,0,1,0,1, 1,1,0,0,1, 1,1,0,0,1, 0,1,1,1,0],
  '1': [0,0,1,0,0, 0,1,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,1,1,1,0],
  '2': [0,1,1,1,0, 1,0,0,0,1, 0,0,0,0,1, 0,0,0,1,0, 0,0,1,0,0, 0,1,0,0,0, 1,1,1,1,1],
  '3': [0,1,1,1,0, 1,0,0,0,1, 0,0,0,0,1, 0,0,1,1,0, 0,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
  '4': [0,0,0,1,0, 0,0,1,1,0, 0,1,0,1,0, 1,0,0,1,0, 1,1,1,1,1, 0,0,0,1,0, 0,0,0,1,0],
  '5': [1,1,1,1,1, 1,0,0,0,0, 1,1,1,1,0, 0,0,0,0,1, 0,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
  '6': [0,1,1,1,0, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
  '7': [1,1,1,1,1, 0,0,0,0,1, 0,0,0,1,0, 0,0,1,0,0, 0,1,0,0,0, 0,1,0,0,0, 0,1,0,0,0],
  '8': [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
  '9': [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,1, 0,0,0,0,1, 0,0,0,0,1, 0,1,1,1,0],
  '!': [0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,0,0,0, 0,0,1,0,0],
  '?': [0,1,1,1,0, 1,0,0,0,1, 0,0,0,0,1, 0,0,0,1,0, 0,0,1,0,0, 0,0,0,0,0, 0,0,1,0,0],
  '.': [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,1,0,0],
  '-': [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 1,1,1,1,1, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
  '_': [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 1,1,1,1,1],
};

function getBlockGlyphs(text, scale) {
  const GH = 7, GW = 5, GAP = 1;
  const chars = [...text];
  const glyphsPerChar = chars.map(ch => {
    const g = FONT5[ch] || FONT5[' '];
    return Array.from({ length: GH }, (_, r) =>
      Array.from({ length: GW }, (_, c) => g[r * GW + c])
    );
  });

  const totalW = chars.length * (GW + GAP) * scale - GAP * scale;
  const totalH = GH * scale;
  const out = Array.from({ length: totalH }, () => Array(totalW).fill(0));

  chars.forEach((_, ci) => {
    const glyph = glyphsPerChar[ci];
    for (let r = 0; r < GH; r++) {
      for (let c = 0; c < GW; c++) {
        if (glyph[r][c]) {
          for (let sr = 0; sr < scale; sr++) {
            for (let sc = 0; sc < scale; sc++) {
              const or = r * scale + sr;
              const oc = ci * (GW + GAP) * scale + c * scale + sc;
              if (or < totalH && oc < totalW) out[or][oc] = 1;
            }
          }
        }
      }
    }
  });
  return out;
}

/* ─────────────────────────────────────────────────────────────────────
   Page init
───────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const maker = new WallpaperMaker();

  /* ── Resolution buttons ── */
  document.querySelectorAll('.res-btn[data-w]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.res-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('custom-res').style.display = 'none';
      maker.resolution = { w: +btn.dataset.w, h: +btn.dataset.h };
      maker.measureFont();
    });
  });

  document.getElementById('res-custom-btn').addEventListener('click', () => {
    document.querySelectorAll('.res-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('res-custom-btn').classList.add('active');
    document.getElementById('custom-res').style.display = '';
  });

  document.getElementById('btn-apply-custom').addEventListener('click', () => {
    const w = parseInt(document.getElementById('custom-w').value, 10);
    const h = parseInt(document.getElementById('custom-h').value, 10);
    if (w >= 100 && h >= 100) {
      maker.resolution = { w, h };
      maker.measureFont();
    }
  });

  /* ── Pattern buttons ── */
  document.querySelectorAll('.pattern-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      maker.pattern = btn.dataset.pattern;
    });
  });

  /* ── Charset pills ── */
  document.querySelectorAll('.charset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.charset-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      maker.charsetKey = pill.dataset.cs;
      const customInput = document.getElementById('custom-charset');
      customInput.style.display = pill.dataset.cs === 'custom' ? '' : 'none';
    });
  });

  document.getElementById('custom-charset').addEventListener('input', e => {
    maker.customChars = e.target.value;
  });

  /* ── Settings ── */
  document.getElementById('font-size-select').addEventListener('change', e => {
    maker.fontSize = +e.target.value;
    maker.measureFont();
  });

  document.getElementById('density-range').addEventListener('input', e => {
    maker.density = +e.target.value / 100;
  });

  document.getElementById('bg-color-select').addEventListener('change', e => {
    maker.bgColor = e.target.value;
  });

  document.getElementById('fg-color-select').addEventListener('change', e => {
    maker.fgColor = e.target.value;
  });

  /* ── Text overlays ── */
  function renderOverlayList() {
    const list = document.getElementById('overlay-list');
    list.innerHTML = '';
    maker.overlays.forEach((ov, i) => {
      const item = document.createElement('div');
      item.className = 'overlay-item';
      item.innerHTML = `
        <span class="oi-text" title="${ov.text}">"${ov.text}" ×${ov.size} ${ov.align}</span>
        <button class="oi-del" data-idx="${i}" title="Remove">✕</button>
      `;
      item.querySelector('.oi-del').addEventListener('click', () => {
        maker.overlays.splice(i, 1);
        renderOverlayList();
      });
      list.appendChild(item);
    });
  }

  document.getElementById('btn-add-overlay').addEventListener('click', () => {
    const text  = document.getElementById('overlay-text').value.trim();
    const size  = +document.getElementById('overlay-size').value;
    const align = document.getElementById('overlay-align').value;
    if (!text) return;
    maker.overlays.push({ text, size, align });
    document.getElementById('overlay-text').value = '';
    renderOverlayList();
  });

  /* ── Generate ── */
  function doGenerate() {
    maker.generate();
    if (maker.overlays.length) maker.applyOverlays();
    maker.renderPreview();
  }

  document.getElementById('btn-generate').addEventListener('click',  doGenerate);
  document.getElementById('btn-generate2').addEventListener('click', doGenerate);
  document.getElementById('btn-export-png').addEventListener('click', () => maker.exportPNG());
  document.getElementById('btn-export-txt').addEventListener('click', () => maker.exportTXT());

  /* ── Auto-generate on load ── */
  doGenerate();

  /* ── Re-render preview on resize ── */
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (maker.cells.length) maker.renderPreview();
    }, 150);
  });
});
