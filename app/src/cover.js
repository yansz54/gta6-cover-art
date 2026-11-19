// cover.js — the cover rendering engine for Neon Coast Cover Studio.
//
// Draws a GTA-style multi-panel poster on a 2D canvas: a Vice City sunset
// sky with a slatted sun and palm silhouettes, gradient-map graded photo
// panels, a halftone title block with Anton lettering, film grain and a
// vignette. Everything is drawn from code and local files; no network,
// no dependencies, no Rockstar artwork or fonts.

/* ------------------------------------------------------------------ */
/* Grades: a gradient map is a list of [t, r, g, b] stops. A photo     */
/* pixel's luminance is pushed through the map, so shadows, mids and   */
/* highlights each take the grade's own colour. `mix` blends the      */
/* graded pixel back toward the original; `contrast` bends the        */
/* luminance before the lookup. `halftone` adds print dots in the     */
/* shadows, the signature grade's mark.                                */
/* ------------------------------------------------------------------ */

export const GRADES = {
  sunset: {
    label: 'Sunset',
    mix: 0.85,
    contrast: 1.12,
    halftone: false,
    stops: [
      [0.0, 26, 8, 54],
      [0.25, 96, 22, 96],
      [0.5, 214, 48, 92],
      [0.75, 255, 122, 60],
      [1.0, 255, 214, 140],
    ],
  },
  neonNights: {
    label: 'Neon Nights',
    mix: 0.85,
    contrast: 1.15,
    halftone: false,
    stops: [
      [0.0, 4, 8, 32],
      [0.3, 16, 40, 120],
      [0.55, 190, 30, 160],
      [0.8, 0, 220, 255],
      [1.0, 220, 255, 250],
    ],
  },
  vice: {
    label: 'Vice',
    mix: 0.8,
    contrast: 1.12,
    halftone: false,
    stops: [
      [0.0, 20, 4, 40],
      [0.3, 110, 20, 130],
      [0.6, 255, 60, 140],
      [0.85, 255, 150, 80],
      [1.0, 255, 240, 180],
    ],
  },
  noir: {
    label: 'Noir',
    mix: 0.9,
    contrast: 1.25,
    halftone: false,
    stops: [
      [0.0, 10, 8, 8],
      [0.35, 70, 64, 60],
      [0.7, 150, 140, 128],
      [1.0, 255, 246, 230],
    ],
  },
  palmGold: {
    label: 'Palm Gold',
    mix: 0.85,
    contrast: 1.22,
    halftone: false,
    stops: [
      [0.0, 16, 10, 4],
      [0.35, 110, 60, 16],
      [0.65, 225, 140, 45],
      [1.0, 255, 220, 140],
    ],
  },
  viceInk: {
    label: 'Vice Ink',
    mix: 0.95,
    contrast: 1.35,
    halftone: true,
    stops: [
      [0.0, 2, 2, 6],
      [0.2, 12, 6, 28],
      [0.45, 150, 10, 90],
      [0.7, 255, 90, 40],
      [0.9, 255, 210, 90],
      [1.0, 255, 250, 220],
    ],
  },
};

export const GRADE_ORDER = ['sunset', 'neonNights', 'vice', 'noir', 'palmGold', 'viceInk'];

// A 256-entry lookup table per grade, built once and cached.
const gradeLutCache = new Map();

export function buildGradeLut(gradeName) {
  if (gradeLutCache.has(gradeName)) return gradeLutCache.get(gradeName);
  const grade = GRADES[gradeName];
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = grade.stops[0];
    let b = grade.stops[grade.stops.length - 1];
    for (let s = 0; s < grade.stops.length - 1; s++) {
      if (t >= grade.stops[s][0] && t <= grade.stops[s + 1][0]) {
        a = grade.stops[s];
        b = grade.stops[s + 1];
        break;
      }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    lut[i * 3] = Math.round(a[1] + (b[1] - a[1]) * f);
    lut[i * 3 + 1] = Math.round(a[2] + (b[2] - a[2]) * f);
    lut[i * 3 + 2] = Math.round(a[3] + (b[3] - a[3]) * f);
  }
  gradeLutCache.set(gradeName, lut);
  return lut;
}

// CSS gradient string for a grade swatch in the editor.
export function gradeSwatchCss(gradeName) {
  const grade = GRADES[gradeName];
  const parts = grade.stops.map(
    ([t, r, g, b]) => `rgb(${r},${g},${b}) ${Math.round(t * 100)}%`,
  );
  return `linear-gradient(135deg, ${parts.join(', ')})`;
}

/* ------------------------------------------------------------------ */
/* Layouts: every rect is relative (0..1) so one layout renders at    */
/* any export size. `titleAlpha` is how see-through the title block's  */
/* backing is — over the sunset sky it glows, over a photo it stays   */
/* solid. `tilt` is degrees; `ribbon` puts the Launch Week tag on.    */
/* ------------------------------------------------------------------ */

export const LAYOUTS = {
  heroStrip: {
    label: 'Hero Strip',
    titleAlpha: 0.5,
    ribbon: true,
    // A hero and a tall side panel on top, a band of open sunset sky
    // with the sun and palms, the title band, and a three-panel strip.
    panels: [
      { x: 0.02, y: 0.025, w: 0.58, h: 0.4, tilt: 0 },
      { x: 0.62, y: 0.025, w: 0.36, h: 0.4, tilt: 0 },
      { x: 0.02, y: 0.715, w: 0.312, h: 0.26, tilt: 0 },
      { x: 0.344, y: 0.715, w: 0.312, h: 0.26, tilt: 0 },
      { x: 0.668, y: 0.715, w: 0.312, h: 0.26, tilt: 0 },
    ],
    title: { x: 0.02, y: 0.565, w: 0.96, h: 0.13 },
  },
  viceGrid: {
    label: 'Vice Grid',
    titleAlpha: 0.7,
    ribbon: false,
    panels: [
      { x: 0.02, y: 0.025, w: 0.312, h: 0.3, tilt: 0 },
      { x: 0.344, y: 0.025, w: 0.312, h: 0.3, tilt: 0 },
      { x: 0.668, y: 0.025, w: 0.312, h: 0.3, tilt: 0 },
      { x: 0.02, y: 0.337, w: 0.312, h: 0.3, tilt: 0 },
      { x: 0.668, y: 0.337, w: 0.312, h: 0.3, tilt: 0 },
      { x: 0.02, y: 0.649, w: 0.312, h: 0.3, tilt: 0 },
      { x: 0.344, y: 0.649, w: 0.312, h: 0.3, tilt: 0 },
      { x: 0.668, y: 0.649, w: 0.312, h: 0.3, tilt: 0 },
    ],
    title: { x: 0.344, y: 0.337, w: 0.312, h: 0.3 },
  },
  fullBleed: {
    label: 'Full Bleed',
    titleAlpha: 0.88,
    ribbon: true,
    panels: [{ x: 0, y: 0, w: 1, h: 1, tilt: 0 }],
    title: { x: 0.05, y: 0.6, w: 0.64, h: 0.32 },
  },
  splitDuo: {
    label: 'Split Duo',
    titleAlpha: 0.7,
    ribbon: false,
    panels: [
      { x: 0.02, y: 0.025, w: 0.474, h: 0.72, tilt: 0 },
      { x: 0.506, y: 0.025, w: 0.474, h: 0.72, tilt: 0 },
    ],
    title: { x: 0.02, y: 0.765, w: 0.96, h: 0.21 },
  },
  filmStrip: {
    label: 'Film Strip',
    titleAlpha: 0.7,
    ribbon: false,
    panels: [
      { x: 0.02, y: 0.245, w: 0.184, h: 0.73, tilt: 0 },
      { x: 0.216, y: 0.245, w: 0.184, h: 0.73, tilt: 0 },
      { x: 0.412, y: 0.245, w: 0.184, h: 0.73, tilt: 0 },
      { x: 0.608, y: 0.245, w: 0.184, h: 0.73, tilt: 0 },
      { x: 0.804, y: 0.245, w: 0.176, h: 0.73, tilt: 0 },
    ],
    title: { x: 0.02, y: 0.025, w: 0.96, h: 0.2 },
  },
  tiltedTrio: {
    label: 'Tilted Trio',
    titleAlpha: 0.66,
    ribbon: true,
    panels: [
      { x: 0.03, y: 0.05, w: 0.3, h: 0.56, tilt: -7 },
      { x: 0.35, y: 0.05, w: 0.3, h: 0.56, tilt: 0 },
      { x: 0.67, y: 0.05, w: 0.3, h: 0.56, tilt: 7 },
    ],
    title: { x: 0.08, y: 0.68, w: 0.84, h: 0.26 },
  },
};

export const LAYOUT_ORDER = ['heroStrip', 'viceGrid', 'fullBleed', 'splitDuo', 'filmStrip', 'tiltedTrio'];

// Panel rects in pixels, with the title rect, for one layout at W x H.
export function layoutGeometry(layoutName, W, H) {
  const layout = LAYOUTS[layoutName];
  const panels = layout.panels.map((p) => ({
    x: p.x * W,
    y: p.y * H,
    w: p.w * W,
    h: p.h * H,
    tilt: p.tilt,
  }));
  const t = layout.title;
  const title = { x: t.x * W, y: t.y * H, w: t.w * W, h: t.h * H };
  return { panels, title, titleAlpha: layout.titleAlpha, ribbon: layout.ribbon };
}

/* ------------------------------------------------------------------ */
/* Deterministic noise: the grain must look the same on every load,    */
/* so the seeded generator below replaces Math.random for textures.   */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainTileCache = null;
function grainTile() {
  if (grainTileCache) return grainTileCache;
  const size = 160;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d');
  const image = tctx.createImageData(size, size);
  const rnd = mulberry32(20261119);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.floor(rnd() * 256);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 16;
  }
  tctx.putImageData(image, 0, 0);
  grainTileCache = tile;
  return tile;
}

let halftoneTileCache = null;
function halftoneTile(dotGap, dotMax) {
  const key = `${dotGap}:${dotMax}`;
  if (halftoneTileCache && halftoneTileCache.key === key) return halftoneTileCache.tile;
  const size = dotGap * 2;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d');
  tctx.fillStyle = 'rgba(255,255,255,0.55)';
  const spots = [
    [0.25, 0.25, 0.9],
    [0.75, 0.25, 0.55],
    [0.25, 0.75, 0.55],
    [0.75, 0.75, 0.9],
    [0.5, 0.5, 0.35],
  ];
  for (const [fx, fy, f] of spots) {
    tctx.beginPath();
    tctx.arc(fx * size, fy * size, Math.max(0.6, dotMax * f), 0, Math.PI * 2);
    tctx.fill();
  }
  halftoneTileCache = { key, tile };
  return tile;
}

/* ------------------------------------------------------------------ */
/* Sunset sky: gradient, slatted sun, skyline, palms.                  */
/* ------------------------------------------------------------------ */

function drawSunsetSky(ctx, W, H) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#160a33');
  sky.addColorStop(0.35, '#7a1e6b');
  sky.addColorStop(0.6, '#d6336c');
  sky.addColorStop(0.8, '#ff7a3d');
  sky.addColorStop(1, '#ffc46b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Slatted synthwave sun, centred low so it rises behind the title
  // band and shows in the open sky band of the hero layout.
  const sunX = W * 0.5;
  const sunY = H * 0.485;
  const sunR = Math.min(W, H) * 0.13;
  const sun = ctx.createRadialGradient(sunX, sunY, sunR * 0.1, sunX, sunY, sunR);
  sun.addColorStop(0, '#fff3b0');
  sun.addColorStop(0.55, '#ff9a3d');
  sun.addColorStop(1, '#ff2e88');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Slats: bars of sky gradient cut across the sun's lower half.
  const slatGrad = ctx.createLinearGradient(0, sunY, 0, sunY + sunR);
  slatGrad.addColorStop(0, '#ff7a3d');
  slatGrad.addColorStop(1, '#ffc46b');
  ctx.fillStyle = slatGrad;
  let slatY = sunY + sunR * 0.08;
  let slatH = sunR * 0.035;
  while (slatY < sunY + sunR) {
    ctx.fillRect(sunX - sunR - 2, slatY, sunR * 2 + 4, slatH);
    slatY += slatH + sunR * 0.09;
    slatH *= 1.55;
  }

  // Distant skyline, low and dark, with a few lit windows.
  const baseY = H * 0.97;
  ctx.fillStyle = '#1a0b2e';
  const rnd = mulberry32(7);
  let bx = 0;
  while (bx < W) {
    const bw = W * (0.04 + rnd() * 0.07);
    const bh = H * (0.05 + rnd() * 0.12);
    ctx.fillRect(bx, baseY - bh, bw, bh);
    bx += bw + W * 0.008;
  }
  ctx.fillStyle = 'rgba(255,209,102,0.75)';
  for (let i = 0; i < 26; i++) {
    const wx = rnd() * W;
    const wy = baseY - H * (0.05 + rnd() * 0.12);
    ctx.fillRect(wx, wy, Math.max(2, W * 0.003), Math.max(2, H * 0.006));
  }
}

// One palm silhouette: a leaning, gently S-curved trunk and a crown of
// tapered fronds. Each frond is a filled blade built by sampling a
// quadratic spine and tapering its width toward the tip, so the crown
// reads as arching leaves: the top fronds reach up, the outer ones
// droop below the crown, the way a real palm's fronds do.
function drawPalmSilhouette(ctx, x, y, s, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#0d0618';
  ctx.strokeStyle = '#0d0618';
  ctx.lineCap = 'round';
  // Trunk: an S-curve leaning by `lean` (fractions of s).
  const topX = lean * s;
  const topY = -s;
  ctx.lineWidth = Math.max(2.5, s * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(lean * s * 0.15, -s * 0.35, lean * s * 0.75, -s * 0.6, topX, topY);
  ctx.stroke();
  // One tapered frond: a blade along a quadratic spine from the crown
  // (cx, cy) through control (qx, qy) to tip (tx, ty), wide at the
  // crown and narrowing to a point at the tip.
  const drawFrond = (cx, cy, qx, qy, tx, ty, w0) => {
    const steps = 12;
    const left = [];
    const right = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const px = mt * mt * cx + 2 * mt * t * qx + t * t * tx;
      const py = mt * mt * cy + 2 * mt * t * qy + t * t * ty;
      const txv = 2 * mt * (qx - cx) + 2 * t * (tx - qx);
      const tyv = 2 * mt * (qy - cy) + 2 * t * (ty - qy);
      const len = Math.hypot(txv, tyv) || 1;
      const w = w0 * (1 - t * 0.9);
      left.push([px - (tyv / len) * w, py + (txv / len) * w]);
      right.push([px + (tyv / len) * w, py - (txv / len) * w]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i <= steps; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = steps; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
  };
  // Fronds: [tipX, tipY, ctrlX, ctrlY] in fractions of s from the crown.
  const fronds = [
    [-0.5, -0.78, -0.55, -0.5],
    [0.05, -0.92, 0.1, -0.65],
    [0.55, -0.75, 0.6, -0.48],
    [-0.92, -0.22, -0.85, -0.58],
    [0.92, -0.16, 0.85, -0.52],
    [-0.82, 0.38, -0.95, -0.18],
    [0.82, 0.42, 0.95, -0.12],
  ];
  for (const [tx, ty, qx, qy] of fronds) {
    drawFrond(
      topX, topY,
      topX + qx * s * 0.85, topY + qy * s * 0.85,
      topX + tx * s * 0.85, topY + ty * s * 0.85,
      s * 0.07,
    );
  }
  // Two coconuts at the crown.
  ctx.beginPath();
  ctx.arc(topX - s * 0.03, topY + s * 0.02, s * 0.035, 0, Math.PI * 2);
  ctx.arc(topX + s * 0.04, topY + s * 0.03, s * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Photo grading: cover-fit with pan/zoom, then the gradient map.     */
/* ------------------------------------------------------------------ */

function gradePhotoOnto(ctx, img, rect, panel, gradeName) {
  const { x, y, w, h } = rect;
  const grade = GRADES[gradeName];
  const lut = buildGradeLut(gradeName);
  const pw = Math.max(2, Math.round(w));
  const ph = Math.max(2, Math.round(h));
  const temp = document.createElement('canvas');
  temp.width = pw;
  temp.height = ph;
  const tctx = temp.getContext('2d');
  // Cover-fit, then pan and zoom around the centre.
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = panel.zoom || 1;
  const scale = Math.max(pw / iw, ph / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  // Clamp the pan so the photo always covers the panel: a wide panel
  // can be panned further than a square one before a gap shows.
  const maxPanX = Math.max(0, (dw - pw) / 2 / pw);
  const maxPanY = Math.max(0, (dh - ph) / 2 / ph);
  const panX = Math.max(-maxPanX, Math.min(maxPanX, panel.panX || 0));
  const panY = Math.max(-maxPanY, Math.min(maxPanY, panel.panY || 0));
  const dx = (pw - dw) / 2 + panX * pw;
  const dy = (ph - dh) / 2 + panY * ph;
  tctx.drawImage(img, dx, dy, dw, dh);
  // Gradient map through the lookup table.
  const image = tctx.getImageData(0, 0, pw, ph);
  const d = image.data;
  const mix = grade.mix;
  const contrast = grade.contrast;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    let l = Math.round((lum - 128) * contrast + 128);
    if (l < 0) l = 0;
    else if (l > 255) l = 255;
    const li = l * 3;
    d[i] += (lut[li] - d[i]) * mix;
    d[i + 1] += (lut[li + 1] - d[i + 1]) * mix;
    d[i + 2] += (lut[li + 2] - d[i + 2]) * mix;
  }
  tctx.putImageData(image, 0, 0);
  // Signature grade: print dots in the shadows.
  if (grade.halftone) {
    tctx.globalCompositeOperation = 'overlay';
    tctx.globalAlpha = 0.32;
    tctx.fillStyle = tctx.createPattern(halftoneTile(9, 2.6), 'repeat');
    tctx.fillRect(0, 0, pw, ph);
    tctx.globalAlpha = 1;
    tctx.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(temp, x, y, w, h);
}

/* ------------------------------------------------------------------ */
/* Title block: halftone backing, eyebrow, Anton title, subtitle.     */
/* ------------------------------------------------------------------ */

function drawHalftoneTitleBlock(ctx, rect, state, titleAlpha) {
  const { x, y, w, h } = rect;
  const unit = Math.min(w, h);
  // Backing: dark, see-through over the sky, solid over a photo.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = `rgba(12,5,26,${titleAlpha})`;
  ctx.fillRect(x, y, w, h);
  // Warm sunset glow behind the lettering, so the band reads as a
  // sunset even where the sky itself is covered by panels.
  const glow = ctx.createRadialGradient(
    x + w / 2, y + h * 0.55, 0,
    x + w / 2, y + h * 0.55, w * 0.42,
  );
  glow.addColorStop(0, 'rgba(255,150,60,0.5)');
  glow.addColorStop(0.6, 'rgba(255,46,136,0.22)');
  glow.addColorStop(1, 'rgba(255,46,136,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  // Halftone dots drift across the backing.
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(halftoneTile(Math.max(10, unit * 0.09), Math.max(1.6, unit * 0.02)), 'repeat');
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  // Neon hairlines top and bottom.
  ctx.fillStyle = '#ff2e88';
  ctx.fillRect(x, y, w, Math.max(2, h * 0.03));
  ctx.fillStyle = '#00dcff';
  ctx.fillRect(x, y + h - Math.max(2, h * 0.03), w, Math.max(2, h * 0.03));

  const padX = w * 0.045;
  const cx = x + w / 2;
  const maxW = w - padX * 2;
  // Eyebrow in Bebas Neue, wide-tracked, shrunk until it fits the band:
  // a narrow title block (the grid's centre cell) must never clip it.
  let eyebrowSize = Math.max(8, h * 0.13);
  const eyebrowText = (state.eyebrow || '').toUpperCase();
  const setEyebrowFont = (size) => {
    ctx.font = `${size}px "Bebas Neue", sans-serif`;
    try {
      ctx.letterSpacing = `${Math.max(1, size * 0.32)}px`;
    } catch {
      /* letterSpacing is optional */
    }
  };
  setEyebrowFont(eyebrowSize);
  while (eyebrowSize > 8 && ctx.measureText(eyebrowText).width > maxW) {
    eyebrowSize *= 0.9;
    setEyebrowFont(eyebrowSize);
  }
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(eyebrowText, cx, y + h * 0.13);
  try {
    ctx.letterSpacing = '0px';
  } catch {
    /* reset */
  }
  // Anton title: shrink to fit, gradient fill, dark outline, drop shadow.
  let titleSize = h * 0.52;
  const titleText = (state.title || 'SUNSET HEIST').toUpperCase();
  ctx.font = `${titleSize}px Anton, sans-serif`;
  const measured = ctx.measureText(titleText).width;
  if (measured > maxW) titleSize *= maxW / measured;
  titleSize = Math.max(10, titleSize);
  ctx.font = `${titleSize}px Anton, sans-serif`;
  const titleY = y + h * 0.56;
  const titleGrad = ctx.createLinearGradient(0, titleY - titleSize * 0.55, 0, titleY + titleSize * 0.5);
  titleGrad.addColorStop(0, '#ffe29a');
  titleGrad.addColorStop(0.45, '#ff7a3d');
  titleGrad.addColorStop(0.75, '#ff2e88');
  titleGrad.addColorStop(1, '#b537f2');
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.max(2, titleSize * 0.06);
  ctx.shadowOffsetY = Math.max(2, titleSize * 0.045);
  ctx.lineWidth = Math.max(2, titleSize * 0.055);
  ctx.strokeStyle = '#160a24';
  ctx.lineJoin = 'round';
  ctx.strokeText(titleText, cx, titleY);
  ctx.fillStyle = titleGrad;
  ctx.fillText(titleText, cx, titleY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // Pacifico subtitle under the title, shrunk until it fits the band.
  let subSize = Math.max(9, h * 0.19);
  const subtitleText = state.subtitle || '';
  ctx.font = `${subSize}px Pacifico, cursive`;
  while (subSize > 9 && ctx.measureText(subtitleText).width > maxW) {
    subSize *= 0.9;
    ctx.font = `${subSize}px Pacifico, cursive`;
  }
  ctx.fillStyle = '#ffe9f4';
  ctx.fillText(subtitleText, cx, y + h * 0.86);
  ctx.restore();
}

function drawLaunchWeekRibbon(ctx, W, H, text) {
  const label = (text || 'LAUNCH WEEK').toUpperCase();
  const fontSize = Math.max(12, H * 0.032);
  ctx.save();
  ctx.font = `${fontSize}px "Bebas Neue", sans-serif`;
  try {
    ctx.letterSpacing = `${Math.max(2, fontSize * 0.22)}px`;
  } catch {
    /* optional */
  }
  const textW = ctx.measureText(label).width;
  const ribbonW = textW + fontSize * 1.6;
  const ribbonH = fontSize * 1.7;
  // Anchor by the ribbon's own width, so its right end never runs off
  // the cover, whatever the aspect ratio.
  ctx.translate(W - ribbonW / 2 - 14, H * 0.08);
  ctx.rotate((-8 * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ff2e88';
  ctx.fillRect(-ribbonW / 2, -ribbonH / 2, ribbonW, ribbonH);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* The whole cover, in order: sky, panels, title, ribbon, grain.      */
/* ------------------------------------------------------------------ */

export function drawCover(ctx, W, H, state, photoImages) {
  ctx.clearRect(0, 0, W, H);
  drawSunsetSky(ctx, W, H);
  const geo = layoutGeometry(state.layout, W, H);

  // Photo panels, in layout order, with their grade.
  geo.panels.forEach((rect, i) => {
    const panel = state.panels[i];
    if (!panel) return;
    const img = photoImages.get(panel.photo);
    if (!img) return;
    ctx.save();
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.translate(cx, cy);
    if (rect.tilt) ctx.rotate((rect.tilt * Math.PI) / 180);
    ctx.translate(-cx, -cy);
    const radius = Math.max(2, Math.min(rect.w, rect.h) * 0.02);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
    } else {
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.clip();
    gradePhotoOnto(ctx, img, rect, panel, state.grade);
    ctx.restore();
    // Crisp panel border, drawn untilted so the frame stays square.
    ctx.save();
    ctx.translate(cx, cy);
    if (rect.tilt) ctx.rotate((rect.tilt * Math.PI) / 180);
    ctx.translate(-cx, -cy);
    ctx.lineWidth = Math.max(2, Math.min(W, H) * 0.004);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
    } else {
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.stroke();
    ctx.restore();
  });

  drawHalftoneTitleBlock(ctx, geo.title, state, geo.titleAlpha);
  // Palms last among the art, so their crowns are never hidden behind
  // a panel or the title band: the hero layout's palms rise from the
  // title band's top edge into the open sky band, and the tilted
  // layout's stand at the bottom corners.
  if (state.layout === 'heroStrip') {
    const palmH = H * 0.22;
    drawPalmSilhouette(ctx, W * 0.09, H * 0.565, palmH, 0.3);
    drawPalmSilhouette(ctx, W * 0.91, H * 0.565, palmH * 0.9, -0.3);
  } else if (state.layout === 'tiltedTrio') {
    const palmH = H * 0.18;
    drawPalmSilhouette(ctx, W * 0.04, H * 0.985, palmH, 0.3);
    drawPalmSilhouette(ctx, W * 0.96, H * 0.985, palmH * 0.88, -0.3);
  }
  if (geo.ribbon) drawLaunchWeekRibbon(ctx, W, H, state.ribbon);
  if (state.vignette) {
    const vg = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75,
    );
    vg.addColorStop(0, 'rgba(8,3,18,0)');
    vg.addColorStop(1, 'rgba(8,3,18,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
  if (state.grain) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
