// cover.js — Neon Coast Cover Studio: the cover renderer (v3).
//
// Draws GTA-style multi-panel poster covers on a canvas. Every piece of
// lettering is rendered by the procedural bitmap font in this file — no
// font files, no network, no downloads. The font is a hand-authored 5x7
// pixel alphabet (A-Z, 0-9 and punctuation), drawn as bold condensed
// blocks with gradient fill, outline and shadow, so the title reads as
// a poster headline. Six layouts, six colour grades (including the
// signature "Vice Ink"), a synthwave sun, skyline and palms, halftone
// title backing, grain and vignette.
//
// Exports: GRADE_ORDER, LAYOUT_ORDER, drawCover.

// ------------------------------------------------------------------
// Procedural bitmap font: a 5-wide by 7-tall pixel alphabet.
// Each glyph is 7 rows; each row is a 5-bit number, bit 4 = leftmost
// pixel. Lowercase maps to uppercase (poster titles are uppercase).
// ------------------------------------------------------------------
const FONT_ROWS = {
  'A': [14, 17, 17, 31, 17, 17, 17],
  'B': [30, 17, 17, 30, 17, 17, 30],
  'C': [14, 17, 16, 16, 16, 17, 14],
  'D': [30, 17, 17, 17, 17, 17, 30],
  'E': [31, 16, 16, 30, 16, 16, 31],
  'F': [31, 16, 16, 30, 16, 16, 16],
  'G': [14, 17, 16, 23, 17, 17, 15],
  'H': [17, 17, 17, 31, 17, 17, 17],
  'I': [14, 4, 4, 4, 4, 4, 14],
  'J': [7, 2, 2, 2, 2, 18, 12],
  'K': [17, 18, 20, 24, 20, 18, 17],
  'L': [16, 16, 16, 16, 16, 16, 31],
  'M': [17, 27, 21, 21, 17, 17, 17],
  'N': [17, 25, 21, 19, 17, 17, 17],
  'O': [14, 17, 17, 17, 17, 17, 14],
  'P': [30, 17, 17, 30, 16, 16, 16],
  'Q': [14, 17, 17, 17, 21, 18, 13],
  'R': [30, 17, 17, 30, 20, 18, 17],
  'S': [15, 16, 16, 14, 1, 1, 30],
  'T': [31, 4, 4, 4, 4, 4, 4],
  'U': [17, 17, 17, 17, 17, 17, 14],
  'V': [17, 17, 17, 17, 17, 10, 4],
  'W': [17, 17, 17, 21, 21, 21, 10],
  'X': [17, 17, 10, 4, 10, 17, 17],
  'Y': [17, 17, 10, 4, 4, 4, 4],
  'Z': [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [14, 16, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 1, 14],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0],
  ':': [0, 12, 12, 0, 12, 12, 0],
  '&': [12, 18, 20, 8, 21, 18, 13],
  '/': [1, 1, 2, 4, 8, 16, 16],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '+': [0, 4, 4, 14, 4, 4, 0],
  '=': [0, 0, 14, 0, 14, 0, 0],
  '%': [19, 19, 2, 4, 8, 25, 25],
  '$': [4, 15, 20, 14, 5, 30, 4],
  '#': [10, 10, 31, 10, 10, 31, 10],
  '*': [0, 4, 21, 14, 21, 4, 0],
  '_': [0, 0, 0, 0, 0, 0, 31],
  '"': [10, 10, 10, 0, 0, 0, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  '<': [2, 4, 8, 16, 8, 4, 2],
  '>': [8, 4, 2, 1, 2, 4, 8],
  '[': [14, 8, 8, 8, 8, 8, 14],
  ']': [14, 2, 2, 2, 2, 2, 14],
};

const FONT_W = 5; // glyph columns
const FONT_H = 7; // glyph rows

function glyphRows(ch) {
  const up = ch.toUpperCase();
  return FONT_ROWS[up] || FONT_ROWS['?'];
}

// Width of a string in grid cells at the given letter tracking
// (tracking is extra cells between glyphs).
function textCells(text, tracking) {
  if (!text) return 0;
  const n = [...text].length;
  return n * FONT_W + Math.max(0, n - 1) * tracking;
}

// Rebuild an rgba() colour string with a new alpha (0-1).
function withAlpha(rgba, alpha) {
  const m = rgba.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/);
  if (!m) return rgba;
  return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;
}

// Draw one glyph's filled pixels at grid position (gx, gy) in pixels.
// Each pixel is a rect of (cell, cell) slightly overlapped (boldOverlap)
// so the letterforms read bold and condensed.
function drawGlyphPixels(ctx, rows, gx, gy, cell, boldOverlap) {
  const px = cell + boldOverlap;
  for (let r = 0; r < FONT_H; r++) {
    const bits = rows[r];
    for (let c = 0; c < FONT_W; c++) {
      if (bits & (1 << (FONT_W - 1 - c))) {
        ctx.fillRect(gx + c * cell, gy + r * cell, px, px);
      }
    }
  }
}

// Draw text with the bitmap font. (x, y) is the top-left of the text
// block. `cell` is the pixel size of one grid cell. Returns the drawn
// width in px. `fill` may be a colour string or a CanvasGradient.
// `outline` draws a dark halo first (offset copies), `shadow` draws a
// soft offset copy beneath. `tracking` is extra grid cells between glyphs.
// `skew` slants the text (for the subtitle script feel).
function drawBitmapText(ctx, text, x, y, cell, opts = {}) {
  const {
    fill = '#ffffff',
    outline = null,
    outlineWidth = 0,
    shadow = null,
    shadowDx = 0,
    shadowDy = 0,
    tracking = 1,
    boldOverlap = 0,
    skew = 0,
    align = 'left',
  } = opts;
  if (!text) return 0;
  const chars = [...text];
  const totalCells = textCells(text, tracking);
  const totalW = totalCells * cell;
  let startX = x;
  if (align === 'center') startX = x - totalW / 2;
  else if (align === 'right') startX = x - totalW;

  const paint = (fillStyle, dx, dy, extraSkew) => {
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.translate(startX + dx, y + dy);
    if (extraSkew) ctx.transform(1, 0, extraSkew, 1, 0, 0);
    let gx = 0;
    for (const ch of chars) {
      drawGlyphPixels(ctx, glyphRows(ch), gx, 0, cell, boldOverlap);
      gx += (FONT_W + tracking) * cell;
    }
    ctx.restore();
  };

  // Shadow first, then outline halo, then the fill on top.
  if (shadow) paint(shadow, shadowDx, shadowDy, skew);
  if (outline && outlineWidth > 0) {
    const steps = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [ox, oy] of steps) {
      paint(outline, ox * outlineWidth, oy * outlineWidth, skew);
    }
  }
  paint(fill, 0, 0, skew);
  return totalW;
}

// Fit text to a max width: shrink the cell size until it fits.
// Returns the cell size to use.
function fitCellForWidth(text, maxWidth, startCell, tracking) {
  let cell = startCell;
  while (cell > 2 && textCells(text, tracking) * cell > maxWidth) {
    cell -= 1;
  }
  return cell;
}

// ------------------------------------------------------------------
// Colour grades. Each grade is a full poster palette: sky gradient,
// sun, shadows, accent, panel tint and the title gradient. The
// signature grade is Vice Ink: high-contrast ink with posterised
// sunset, heavy halftone in the shadows and a neon accent.
// ------------------------------------------------------------------
const GRADES = {
  sunset: {
    label: 'Sunset',
    skyTop: '#2b1055', skyMid: '#7597de', skyBottom: '#ff7e5f',
    skyGlow: '#feb47b', sun: '#ffd76a', sunCore: '#fff3c4',
    shadow: '#1c0b2e', accent: '#ff2e88', accent2: '#ff9e00',
    panelTint: 'rgba(255,126,95,0.16)', panelShade: 'rgba(43,16,85,0.30)',
    titleTop: '#fff7d6', titleBottom: '#ff5e8a', sub: '#ffe9a8',
    eyebrow: '#ffd76a', ink: '#160a24',
  },
  neon: {
    label: 'Neon Nights',
    skyTop: '#050816', skyMid: '#0b2a6b', skyBottom: '#b5179e',
    skyGlow: '#4cc9f0', sun: '#f72585', sunCore: '#ff8fd1',
    shadow: '#03071a', accent: '#4cc9f0', accent2: '#f72585',
    panelTint: 'rgba(76,201,240,0.16)', panelShade: 'rgba(3,7,26,0.34)',
    titleTop: '#e8fbff', titleBottom: '#4cc9f0', sub: '#ffb3e2',
    eyebrow: '#4cc9f0', ink: '#020617',
  },
  vice: {
    label: 'Vice',
    skyTop: '#0f2027', skyMid: '#2c5364', skyBottom: '#ff6a88',
    skyGlow: '#ff9a8b', sun: '#ffcf5c', sunCore: '#fff6c9',
    shadow: '#0a1a24', accent: '#00e5c7', accent2: '#ff6a88',
    panelTint: 'rgba(0,229,199,0.14)', panelShade: 'rgba(10,26,36,0.30)',
    titleTop: '#ffffff', titleBottom: '#00e5c7', sub: '#ffd6e0',
    eyebrow: '#00e5c7', ink: '#08131a',
  },
  noir: {
    label: 'Noir',
    skyTop: '#0a0a0a', skyMid: '#3d3d3d', skyBottom: '#9a9a9a',
    skyGlow: '#e8e8e8', sun: '#ffffff', sunCore: '#ffffff',
    shadow: '#000000', accent: '#e8e8e8', accent2: '#ff3b30',
    panelTint: 'rgba(255,255,255,0.10)', panelShade: 'rgba(0,0,0,0.42)',
    titleTop: '#ffffff', titleBottom: '#c9c9c9', sub: '#e8e8e8',
    eyebrow: '#e8e8e8', ink: '#000000',
  },
  gold: {
    label: 'Palm Gold',
    skyTop: '#3a1c00', skyMid: '#b45309', skyBottom: '#fbbf24',
    skyGlow: '#fde68a', sun: '#fff1a8', sunCore: '#fffbe6',
    shadow: '#2a1503', accent: '#f59e0b', accent2: '#dc2626',
    panelTint: 'rgba(251,191,36,0.16)', panelShade: 'rgba(42,21,3,0.32)',
    titleTop: '#fffbe6', titleBottom: '#f59e0b', sub: '#fde68a',
    eyebrow: '#fbbf24', ink: '#221103',
  },
  viceink: {
    label: 'Vice Ink',
    skyTop: '#0d0217', skyMid: '#4a1042', skyBottom: '#ff2e63',
    skyGlow: '#ff7a18', sun: '#ffe259', sunCore: '#fffbe6',
    shadow: '#05010a', accent: '#00f5d4', accent2: '#ff2e63',
    panelTint: 'rgba(0,245,212,0.12)', panelShade: 'rgba(5,1,10,0.46)',
    titleTop: '#ffffff', titleBottom: '#00f5d4', sub: '#ffe259',
    eyebrow: '#00f5d4', ink: '#05010a',
  },
};
const GRADE_ORDER = ['sunset', 'neon', 'vice', 'noir', 'gold', 'viceink'];

// ------------------------------------------------------------------
// Layouts. Each layout is a function of (w, h, gutter) returning an
// array of panel rects {x, y, w, h, tilt} in cover coordinates. The
// title block sits in the band the layout leaves free (see titleBand).
// ------------------------------------------------------------------
function rect(x, y, w, h, tilt = 0) {
  return { x, y, w, h, tilt };
}
const LAYOUTS = {
  heroStrip: {
    label: 'Hero Strip',
    panels(w, h, g) {
      const heroH = Math.round(h * 0.58);
      const stripY = heroH + g;
      const stripH = h - stripY - g;
      const sw = Math.round((w - g * 4) / 3);
      return [
        rect(g, g, w - g * 2, heroH),
        rect(g, stripY, sw, stripH),
        rect(g * 2 + sw, stripY, sw, stripH),
        rect(g * 3 + sw * 2, stripY, sw, stripH),
      ];
    },
    titleBand(w, h) { return { x: 0, y: Math.round(h * 0.60), w, h: Math.round(h * 0.40) }; },
  },
  viceGrid: {
    label: 'Vice Grid',
    panels(w, h, g) {
      const cw = Math.round((w - g * 3) / 2);
      const ch = Math.round((h - g * 3) / 2);
      return [
        rect(g, g, cw, ch), rect(g * 2 + cw, g, cw, ch),
        rect(g, g * 2 + ch, cw, ch), rect(g * 2 + cw, g * 2 + ch, cw, ch),
      ];
    },
    titleBand(w, h) { return { x: 0, y: Math.round(h * 0.34), w, h: Math.round(h * 0.32) }; },
  },
  fullBleed: {
    label: 'Full Bleed',
    panels(w, h, g) { return [rect(0, 0, w, h)]; },
    titleBand(w, h) { return { x: 0, y: Math.round(h * 0.62), w, h: Math.round(h * 0.38) }; },
  },
  splitDuo: {
    label: 'Split Duo',
    panels(w, h, g) {
      const cw = Math.round((w - g * 3) / 2);
      return [
        rect(g, g, cw, h - g * 2),
        rect(g * 2 + cw, g, cw, h - g * 2),
      ];
    },
    titleBand(w, h) { return { x: 0, y: Math.round(h * 0.36), w, h: Math.round(h * 0.28) }; },
  },
  filmStrip: {
    label: 'Film Strip',
    panels(w, h, g) {
      const n = 5;
      const pw = Math.round((w - g * (n + 1)) / n);
      const ph = Math.round(h * 0.52);
      const y = Math.round(h * 0.10);
      const out = [];
      for (let i = 0; i < n; i++) out.push(rect(g + i * (pw + g), y, pw, ph));
      return out;
    },
    titleBand(w, h) { return { x: 0, y: Math.round(h * 0.64), w, h: Math.round(h * 0.36) }; },
  },
  tiltedTrio: {
    label: 'Tilted Trio',
    panels(w, h, g) {
      const pw = Math.round((w - g * 4) / 3);
      const ph = Math.round(h * 0.60);
      const y = Math.round(h * 0.08);
      return [
        rect(g, y, pw, ph, -0.03),
        rect(g * 2 + pw, y + Math.round(h * 0.04), pw, ph, 0.0),
        rect(g * 3 + pw * 2, y, pw, ph, 0.03),
      ];
    },
    titleBand(w, h) { return { x: 0, y: Math.round(h * 0.66), w, h: Math.round(h * 0.34) }; },
  },
};
const LAYOUT_ORDER = ['heroStrip', 'viceGrid', 'fullBleed', 'splitDuo', 'filmStrip', 'tiltedTrio'];

// Deterministic pseudo-random from a seed (mulberry32).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------
// Background: Vice City sunset sky, slatted synthwave sun, skyline
// with lit windows, palm silhouettes, and a warm horizon glow.
// Everything is drawn procedurally from the grade palette.
// ------------------------------------------------------------------
function drawSky(ctx, w, h, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(0.42, grade.skyMid);
  sky.addColorStop(0.72, grade.skyBottom);
  sky.addColorStop(1, grade.skyGlow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Horizon glow band.
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.66, 0, w * 0.5, h * 0.66, w * 0.55);
  glow.addColorStop(0, grade.skyGlow + '55');
  glow.addColorStop(1, grade.skyGlow + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  // Faint stars in the upper sky.
  const rnd = mulberry32(20261119);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 46; i++) {
    const sx = rnd() * w;
    const sy = rnd() * h * 0.30;
    const a = 0.12 + rnd() * 0.5;
    ctx.globalAlpha = a * (1 - sy / (h * 0.34));
    const r = 0.6 + rnd() * 1.4;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSun(ctx, w, h, grade) {
  const cx = w * 0.5;
  const cy = h * 0.60;
  const r = Math.min(w, h) * 0.185;
  // Outer glow.
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.1);
  glow.addColorStop(0, grade.sunCore + 'cc');
  glow.addColorStop(0.45, grade.sun + '44');
  glow.addColorStop(1, grade.sun + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  // Slatted synthwave disc: horizontal slices with growing gaps.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const disc = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  disc.addColorStop(0, grade.sunCore);
  disc.addColorStop(0.55, grade.sun);
  disc.addColorStop(1, grade.accent);
  ctx.fillStyle = disc;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = grade.skyBottom;
  let y = cy + r * 0.08;
  let gap = Math.max(2, r * 0.022);
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, gap);
    y += gap + Math.max(3, r * 0.055);
    gap *= 1.45;
  }
  ctx.restore();
}

function drawSkyline(ctx, w, h, grade, seed) {
  const rnd = mulberry32(seed);
  const base = h * 0.66;
  const dark = grade.shadow;
  ctx.fillStyle = dark;
  let x = 0;
  while (x < w) {
    const bw = w * (0.05 + rnd() * 0.075);
    const bh = h * (0.06 + rnd() * 0.16);
    const top = base - bh;
    ctx.fillRect(x, top, bw, bh + (h - base));
    // Rooftop antenna on some towers.
    if (rnd() < 0.30) {
      ctx.fillRect(x + bw * 0.5 - 1, top - h * 0.035, 2, h * 0.035);
      ctx.beginPath();
      ctx.arc(x + bw * 0.5, top - h * 0.038, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = grade.accent;
      ctx.fill();
      ctx.fillStyle = dark;
    }
    x += bw + w * 0.006;
  }
  // Lit windows: warm dots scattered across the towers.
  const win = mulberry32(seed + 7);
  ctx.fillStyle = grade.sunCore;
  for (let i = 0; i < 130; i++) {
    const wx = win() * w;
    const wy = base - win() * h * 0.20;
    if (wy < base - h * 0.02 && wy > h * 0.42) {
      ctx.globalAlpha = 0.25 + win() * 0.65;
      ctx.fillRect(wx, wy, 2.4, 3.2);
    }
  }
  ctx.globalAlpha = 1;
  // Ocean reflection strip beneath the skyline.
  const refl = ctx.createLinearGradient(0, base, 0, h);
  refl.addColorStop(0, grade.accent + '30');
  refl.addColorStop(1, grade.shadow + '00');
  ctx.fillStyle = refl;
  ctx.fillRect(0, base, w, h - base);
  ctx.strokeStyle = grade.sunCore + '55';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const ry = base + (h - base) * (0.12 + i * 0.075);
    const rw = w * (0.10 + ((i * 37) % 40) / 100);
    const rx = ((i * 173) % 100) / 100 * (w - rw);
    ctx.globalAlpha = 0.35 - i * 0.02;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + rw, ry);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPalm(ctx, x, y, s, lean, grade) {
  // One palm silhouette: curved trunk and drooping fronds.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(s, s);
  ctx.strokeStyle = grade.shadow;
  ctx.fillStyle = grade.shadow;
  ctx.lineCap = 'round';
  // Trunk: gentle S-curve.
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(4, -52, -2, -104);
  ctx.stroke();
  // Fronds: tapered drooping beziers fanning from the crown.
  const fronds = [
    [-58, -118, -96, -96], [-38, -132, -70, -128],
    [-12, -140, -26, -148], [14, -140, 30, -150],
    [40, -130, 74, -126], [58, -116, 98, -92],
    [-70, -104, -104, -70], [70, -102, 104, -68],
  ];
  ctx.lineWidth = 5;
  for (const [cx, cy, tx, ty] of fronds) {
    ctx.beginPath();
    ctx.moveTo(-2, -104);
    ctx.quadraticCurveTo(cx, cy, tx, ty);
    ctx.stroke();
  }
  // Coconuts at the crown.
  ctx.beginPath();
  ctx.arc(-7, -100, 4, 0, Math.PI * 2);
  ctx.arc(3, -98, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPalms(ctx, w, h, grade) {
  drawPalm(ctx, w * 0.055, h * 0.99, Math.min(w, h) * 0.0032, 0.06, grade);
  drawPalm(ctx, w * 0.945, h * 0.99, Math.min(w, h) * 0.0038, -0.07, grade);
  drawPalm(ctx, w * 0.86, h * 1.0, Math.min(w, h) * 0.0022, -0.12, grade);
}

// ------------------------------------------------------------------
// Panels: draw a photo cover-fit into a rect, with the grade tint,
// a dark shade, and a crisp poster border. `photos` maps id -> Image.
// ------------------------------------------------------------------
function drawPhotoCover(ctx, img, rect, panel, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = panel.zoom || 1;
  const baseScale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * baseScale;
  const dh = ih * baseScale;
  const px = panel.px || 0;
  const py = panel.py || 0;
  const dx = x + (w - dw) / 2 + px * w * 0.4;
  const dy = y + (h - dh) / 2 + py * h * 0.4;
  ctx.drawImage(img, dx, dy, dw, dh);
  // Grade tint and shade so the panels read as one poster.
  ctx.fillStyle = grade.panelTint;
  ctx.fillRect(x, y, w, h);
  const shade = ctx.createLinearGradient(0, y, 0, y + h);
  shade.addColorStop(0, withAlpha(grade.panelShade, 0));
  shade.addColorStop(1, grade.panelShade);
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  // Poster border.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.006);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawPanels(ctx, w, h, state, photos, grade) {
  const layout = LAYOUTS[state.layout] || LAYOUTS.heroStrip;
  const g = Math.max(8, Math.round(Math.min(w, h) * 0.016));
  const rects = layout.panels(w, h, g);
  state.panels.forEach((panel, i) => {
    const r = rects[i % rects.length];
    ctx.save();
    if (r.tilt) {
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate(r.tilt);
      ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    }
    const img = panel.photo ? photos[panel.photo] : null;
    if (img) {
      drawPhotoCover(ctx, img, r, panel, grade);
    } else {
      ctx.fillStyle = grade.shadow;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
  return rects;
}

// ------------------------------------------------------------------
// Title block: halftone backing, eyebrow, big gradient title,
// subtitle, and a Launch Week ribbon. All lettering uses the
// procedural bitmap font — bold, condensed, poster-like.
// ------------------------------------------------------------------
function drawHalftone(ctx, x, y, w, h, grade, spacing, maxR) {
  ctx.save();
  ctx.fillStyle = grade.ink;
  for (let yy = y + spacing / 2; yy < y + h; yy += spacing) {
    for (let xx = x + spacing / 2; xx < x + w; xx += spacing) {
      const t = (yy - y) / h; // dots grow toward the bottom
      const r = Math.max(0.6, maxR * (0.35 + t * 0.9));
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawTitleBlock(ctx, w, h, state, grade) {
  const layout = LAYOUTS[state.layout] || LAYOUTS.heroStrip;
  const band = layout.titleBand(w, h);
  const pad = Math.round(Math.min(w, h) * 0.02);
  const cx = w / 2;
  const title = (state.title || 'VICE CITY').toUpperCase();
  const eyebrow = (state.eyebrow || 'GRAND THEFT AUTO VI').toUpperCase();
  const subtitle = state.subtitle || 'Welcome back to Leonida';

  // Halftone backing panel behind the title.
  const backH = band.h * 0.92;
  const backY = band.y + (band.h - backH) / 2;
  const backX = pad;
  const backW = w - pad * 2;
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = grade.ink;
  ctx.fillRect(backX, backY, backW, backH);
  ctx.restore();
  const spacing = Math.max(7, Math.round(Math.min(w, h) * 0.012));
  drawHalftone(ctx, backX, backY, backW, backH, grade, spacing, spacing * 0.30);
  // Neon edge on the backing panel.
  ctx.save();
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.004);
  ctx.globalAlpha = 0.9;
  ctx.strokeRect(backX, backY, backW, backH);
  ctx.restore();

  // Eyebrow: wide-tracked, accent colour, fitted so it never runs
  // under the ribbon. Small cell, generous side margins.
  let ebCell = Math.max(3, Math.round(Math.min(w, h) * 0.008));
  ebCell = fitCellForWidth(eyebrow, backW * 0.62, ebCell, 2);
  const ebY = backY + backH * 0.07;
  drawBitmapText(ctx, eyebrow, cx, ebY, ebCell, {
    fill: grade.eyebrow, tracking: 2, boldOverlap: 1, align: 'center',
    shadow: grade.ink, shadowDx: 2, shadowDy: 2,
  });

  // Title: the dominant element. Gradient fill, dark outline, shadow.
  // Fitted to 86% of the backing width so it always has breathing room.
  const titleTop = backY + backH * 0.27;
  const titleH = backH * 0.44;
  let cell = Math.max(4, Math.floor(titleH / FONT_H));
  cell = fitCellForWidth(title, backW * 0.86, cell, 1);
  const grad = ctx.createLinearGradient(0, titleTop, 0, titleTop + titleH);
  grad.addColorStop(0, grade.titleTop);
  grad.addColorStop(0.55, grade.titleBottom);
  grad.addColorStop(1, grade.accent2);
  drawBitmapText(ctx, title, cx, titleTop, cell, {
    fill: grad, tracking: 1, boldOverlap: Math.max(1, Math.round(cell * 0.14)),
    align: 'center', outline: grade.ink, outlineWidth: Math.max(2, Math.round(cell * 0.16)),
    shadow: grade.ink, shadowDx: Math.round(cell * 0.22), shadowDy: Math.round(cell * 0.28),
  });

  // Subtitle: smaller, warm, slightly slanted for a script feel.
  const subCell = Math.max(3, Math.round(cell * 0.30));
  const subY = titleTop + titleH + backH * 0.05;
  drawBitmapText(ctx, subtitle, cx, subY, subCell, {
    fill: grade.sub, tracking: 1, boldOverlap: 1, align: 'center',
    skew: -0.10, shadow: grade.ink, shadowDx: 2, shadowDy: 2,
  });

  // Launch Week ribbon, bottom-right of the backing panel, clear of
  // the centred subtitle.
  if (state.ribbon !== false) {
    const rw = Math.round(backW * 0.20);
    const rh = Math.round(backH * 0.14);
    const rx = backX + backW - rw - pad;
    const ry = backY + backH - rh - pad * 0.5;
    ctx.save();
    ctx.fillStyle = grade.accent;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + rw, ry);
    ctx.lineTo(rx + rw - rh * 0.5, ry + rh);
    ctx.lineTo(rx, ry + rh);
    ctx.closePath();
    ctx.fill();
    const ribCell = fitCellForWidth('LAUNCH WEEK', rw * 0.88, Math.max(2, Math.round(rh * 0.28)), 1);
    drawBitmapText(ctx, 'LAUNCH WEEK', rx + rw / 2, ry + rh * 0.22, ribCell, {
      fill: '#ffffff', tracking: 1, boldOverlap: 0, align: 'center',
    });
    ctx.restore();
  }
}

// ------------------------------------------------------------------
// Grain and vignette: print texture over the whole cover.
// ------------------------------------------------------------------
function drawGrain(ctx, w, h, seed, amount) {
  const rnd = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < Math.round(w * h * amount); i++) {
    const gx = rnd() * w;
    const gy = rnd() * h;
    ctx.globalAlpha = rnd() * 0.16;
    ctx.fillStyle = rnd() < 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(gx, gy, 1.4, 1.4);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawVignette(ctx, w, h) {
  const v = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------
// drawCover: the whole poster. state carries layout, grade, title,
// subtitle, eyebrow, panels, grain, vignette and ribbon. photos maps
// panel photo ids to loaded Images.
// ------------------------------------------------------------------
function drawCover(ctx, w, h, state, photos) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  drawSky(ctx, w, h, grade);
  drawSun(ctx, w, h, grade);
  drawSkyline(ctx, w, h, grade, 20261119);
  drawPalms(ctx, w, h, grade);
  drawPanels(ctx, w, h, state, photos || {}, grade);
  drawTitleBlock(ctx, w, h, state, grade);
  if (state.grain !== false) drawGrain(ctx, w, h, 20261120, 0.00012);
  if (state.vignette !== false) drawVignette(ctx, w, h);
  ctx.restore();
}

export { GRADES, GRADE_ORDER, LAYOUTS, LAYOUT_ORDER, drawCover, drawBitmapText, fitCellForWidth, textCells };
