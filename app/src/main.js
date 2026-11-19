// main.js — the Neon Coast Cover Studio editor.
//
// State, history, gestures and export for the cover maker. The cover
// itself is drawn by cover.js; this file wires the controls, keeps a
// 50-step undo stack, and exports PNGs in the three post sizes. All
// photos stay on the maker's own machine: uploads are read with a
// FileReader and never sent anywhere.

import { GRADES, GRADE_ORDER, LAYOUTS, LAYOUT_ORDER, drawCover, gradeSwatchCss, layoutGeometry } from './cover.js';

export const EXPORT_SIZES = [
  { label: '1080 × 1080', w: 1080, h: 1080, file: 'gta6-cover-1080x1080.png' },
  { label: '1080 × 1350', w: 1080, h: 1350, file: 'gta6-cover-1080x1350.png' },
  { label: '1920 × 1080', w: 1920, h: 1080, file: 'gta6-cover-1920x1080.png' },
];

const PREVIEW_SIZES = {
  wide: { w: 960, h: 540 },
  square: { w: 900, h: 900 },
  story: { w: 768, h: 960 },
};

const SHUFFLE_TITLES = [
  ['SUNSET HEIST', 'Vice City, 2026'],
  ['NEON NIGHTS', 'Leonida after dark'],
  ['BOULEVARD QUEEN', 'Ocean Drive, 6 PM'],
  ['PALM DUSK', 'A Leonida story'],
  ['VICE CITY HEAT', 'Summer never ends'],
  ['OCEAN DRIVE', 'Chase the sunset'],
];

const PHOTO_LIBRARY = [
  { id: 'pier', label: 'Pier sunset', src: 'samples/pier.jpg' },
  { id: 'boulevard', label: 'Boulevard', src: 'samples/boulevard.jpg' },
];

function defaultPanels() {
  // Nine slots (the grid's maximum). Panels take them in order. The
  // photos alternate between the two samples, and every slot starts
  // cropped toward the top of its photo, where the faces are, so a
  // wide panel still shows a face instead of a torso.
  const photos = ['pier', 'boulevard', 'pier', 'boulevard', 'pier', 'boulevard', 'pier', 'boulevard', 'pier'];
  const crops = [
    { panX: 0, panY: 0.7, zoom: 1.0 },
    { panX: 0.05, panY: 0.2, zoom: 1.05 },
    { panX: 0.03, panY: 0.5, zoom: 1.1 },
    { panX: 0.04, panY: 0.5, zoom: 1.15 },
    { panX: -0.04, panY: 0.45, zoom: 1.12 },
    { panX: 0.02, panY: 0.4, zoom: 1.1 },
    { panX: -0.02, panY: 0.45, zoom: 1.18 },
    { panX: 0, panY: 0.4, zoom: 1.05 },
    { panX: 0.03, panY: 0.35, zoom: 1.1 },
  ];
  return photos.map((photo, i) => ({ photo, ...crops[i] }));
}

function defaultState() {
  return {
    layout: 'heroStrip',
    grade: 'viceInk',
    title: 'SUNSET HEIST',
    subtitle: 'Vice City, 2026',
    eyebrow: 'LEONIDA • VICE CITY',
    ribbon: 'LAUNCH WEEK',
    grain: true,
    vignette: true,
    previewSize: 'wide',
    selectedPanel: 0,
    panels: defaultPanels(),
  };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export const studio = {
  state: defaultState(),
  photos: new Map(), // photo id -> loaded HTMLImageElement
  library: [...PHOTO_LIBRARY],
  ready: null,
  _history: [],
  _historyIndex: -1,
  _renderTimer: 0,
};

export function snapshotState() {
  const { previewSize, selectedPanel, ...rest } = studio.state;
  return { ...cloneState(rest), previewSize, selectedPanel };
}

function pushHistory() {
  studio._history = studio._history.slice(0, studio._historyIndex + 1);
  studio._history.push(JSON.stringify(snapshotState()));
  if (studio._history.length > 50) studio._history.shift();
  studio._historyIndex = studio._history.length - 1;
  refreshUndoButtons();
}

function applySnapshot(json) {
  const saved = JSON.parse(json);
  const keepPreview = studio.state.previewSize;
  studio.state = { ...defaultState(), ...saved };
  studio.state.previewSize = keepPreview;
  syncControlsFromState();
  renderCoverSoon();
}

export function undoCover() {
  if (studio._historyIndex <= 0) return;
  studio._historyIndex -= 1;
  applySnapshot(studio._history[studio._historyIndex]);
  refreshUndoButtons();
}

export function redoCover() {
  if (studio._historyIndex >= studio._history.length - 1) return;
  studio._historyIndex += 1;
  applySnapshot(studio._history[studio._historyIndex]);
  refreshUndoButtons();
}

function refreshUndoButtons() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (!undoBtn || !redoBtn) return;
  undoBtn.disabled = studio._historyIndex <= 0;
  redoBtn.disabled = studio._historyIndex >= studio._history.length - 1;
}

// Load every photo in the library, then render once.
function loadLibraryPhotos() {
  const jobs = studio.library.map(
    (entry) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          studio.photos.set(entry.id, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = entry.src;
      }),
  );
  return Promise.all(jobs);
}

export function renderCoverNow() {
  const canvas = document.getElementById('coverCanvas');
  const overlay = document.getElementById('coverOverlay');
  if (!canvas || !overlay) return;
  const size = PREVIEW_SIZES[studio.state.previewSize] || PREVIEW_SIZES.wide;
  canvas.width = size.w;
  canvas.height = size.h;
  overlay.width = size.w;
  overlay.height = size.h;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, size.w, size.h, studio.state, studio.photos);
  drawSelectedPanelOutline();
}

export function renderCoverSoon() {
  window.clearTimeout(studio._renderTimer);
  studio._renderTimer = window.setTimeout(renderCoverNow, 120);
}

// The selection outline lives on its own canvas so selecting a panel
// never forces a full re-render of the cover.
export function drawSelectedPanelOutline() {
  const canvas = document.getElementById('coverCanvas');
  const overlay = document.getElementById('coverOverlay');
  if (!canvas || !overlay) return;
  const octx = overlay.getContext('2d');
  octx.clearRect(0, 0, overlay.width, overlay.height);
  const geo = layoutGeometry(studio.state.layout, overlay.width, overlay.height);
  const i = studio.state.selectedPanel;
  const rect = geo.panels[i];
  if (!rect) return;
  octx.save();
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  octx.translate(cx, cy);
  if (rect.tilt) octx.rotate((rect.tilt * Math.PI) / 180);
  octx.translate(-cx, -cy);
  octx.lineWidth = 3;
  octx.strokeStyle = '#00dcff';
  octx.setLineDash([10, 6]);
  octx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  octx.setLineDash([]);
  const label = `Panel ${i + 1} — ${panelPhotoLabel(i)}`;
  const labelSize = Math.max(13, overlay.height * 0.028);
  octx.font = `bold ${labelSize}px sans-serif`;
  const labelW = octx.measureText(label).width;
  const labelY = rect.y - 6 < 16 ? rect.y + 20 : rect.y - 6;
  octx.fillStyle = 'rgba(10,4,20,0.72)';
  octx.fillRect(rect.x + 4, labelY - labelSize - 4, labelW + 10, labelSize + 8);
  octx.fillStyle = '#00dcff';
  octx.font = `bold ${labelSize}px sans-serif`;
  octx.textAlign = 'left';
  octx.textBaseline = 'bottom';
  octx.fillText(label, rect.x + 9, labelY);
  octx.restore();
}

function panelPhotoLabel(i) {
  const panel = studio.state.panels[i];
  if (!panel) return '';
  const entry = studio.library.find((p) => p.id === panel.photo);
  return entry ? entry.label : panel.photo;
}

// Which panel, if any, sits under a point on the overlay canvas.
function panelAtPoint(px, py) {
  const overlay = document.getElementById('coverOverlay');
  const geo = layoutGeometry(studio.state.layout, overlay.width, overlay.height);
  for (let i = geo.panels.length - 1; i >= 0; i--) {
    const r = geo.panels[i];
    let lx = px;
    let ly = py;
    if (r.tilt) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const a = (-r.tilt * Math.PI) / 180;
      const dx = px - cx;
      const dy = py - cy;
      lx = cx + dx * Math.cos(a) - dy * Math.sin(a);
      ly = cy + dx * Math.sin(a) + dy * Math.cos(a);
    }
    if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) return i;
  }
  return -1;
}

function overlayPoint(event) {
  const overlay = document.getElementById('coverOverlay');
  const box = overlay.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * overlay.width,
    y: ((event.clientY - box.top) / box.height) * overlay.height,
  };
}

function wireGestures() {
  const overlay = document.getElementById('coverOverlay');
  let drag = null;
  overlay.addEventListener('pointerdown', (event) => {
    const p = overlayPoint(event);
    const hit = panelAtPoint(p.x, p.y);
    if (hit < 0) return;
    studio.state.selectedPanel = hit;
    syncControlsFromState();
    drawSelectedPanelOutline();
    const panel = studio.state.panels[hit];
    drag = { startX: p.x, startY: p.y, panX: panel.panX, panY: panel.panY };
    overlay.setPointerCapture(event.pointerId);
  });
  overlay.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const p = overlayPoint(event);
    const panel = studio.state.panels[studio.state.selectedPanel];
    const geo = layoutGeometry(studio.state.layout, overlay.width, overlay.height);
    const rect = geo.panels[studio.state.selectedPanel];
    if (!rect) return;
    panel.panX = Math.max(-0.8, Math.min(0.8, drag.panX + (p.x - drag.startX) / rect.w));
    panel.panY = Math.max(-0.8, Math.min(0.8, drag.panY + (p.y - drag.startY) / rect.h));
    syncPanelSliders();
    renderCoverSoon();
  });
  const endDrag = () => {
    if (drag) {
      drag = null;
      pushHistory();
    }
  };
  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', endDrag);
  overlay.addEventListener('wheel', (event) => {
    event.preventDefault();
    const p = overlayPoint(event);
    const hit = panelAtPoint(p.x, p.y);
    if (hit < 0) return;
    studio.state.selectedPanel = hit;
    const panel = studio.state.panels[hit];
    panel.zoom = Math.max(1, Math.min(4, panel.zoom * Math.exp(-event.deltaY * 0.0012)));
    syncControlsFromState();
    renderCoverSoon();
  }, { passive: false });
  overlay.addEventListener('dblclick', (event) => {
    const p = overlayPoint(event);
    const hit = panelAtPoint(p.x, p.y);
    if (hit < 0) return;
    cyclePanelPhoto(hit);
  });
}

function cyclePanelPhoto(i) {
  const panel = studio.state.panels[i];
  const at = studio.library.findIndex((p) => p.id === panel.photo);
  const next = studio.library[(at + 1) % studio.library.length];
  panel.photo = next.id;
  pushHistory();
  syncControlsFromState();
  renderCoverSoon();
}

export function shuffleCover() {
  const state = studio.state;
  state.layout = LAYOUT_ORDER[Math.floor(Math.random() * LAYOUT_ORDER.length)];
  state.grade = GRADE_ORDER[Math.floor(Math.random() * GRADE_ORDER.length)];
  const [title, subtitle] = SHUFFLE_TITLES[Math.floor(Math.random() * SHUFFLE_TITLES.length)];
  state.title = title;
  state.subtitle = subtitle;
  state.panels = state.panels.map((panel) => ({
    photo: studio.library[Math.floor(Math.random() * studio.library.length)].id,
    panX: (Math.random() - 0.5) * 0.16,
    panY: (Math.random() - 0.5) * 0.12,
    zoom: 1.05 + Math.random() * 0.25,
  }));
  state.selectedPanel = 0;
  pushHistory();
  syncControlsFromState();
  renderCoverSoon();
}

// Render the cover at an exact export size and download it as a PNG.
export function exportCoverPng(size) {
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  const ctx = off.getContext('2d');
  drawCover(ctx, size.w, size.h, studio.state, studio.photos);
  off.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = size.file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}

export function exportAllSizes() {
  EXPORT_SIZES.forEach((size, i) => {
    window.setTimeout(() => exportCoverPng(size), i * 350);
  });
}

/* ------------------------------------------------------------------ */
/* Controls: build the pickers, keep them in sync with the state.     */
/* ------------------------------------------------------------------ */

function buildLayoutPicker() {
  const host = document.getElementById('layoutPicker');
  host.innerHTML = '';
  for (const name of LAYOUT_ORDER) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-btn layout-btn';
    btn.dataset.layout = name;
    btn.innerHTML = `<span class="layout-glyph" data-layout="${name}"></span><span>${LAYOUTS[name].label}</span>`;
    btn.addEventListener('click', () => {
      studio.state.layout = name;
      studio.state.selectedPanel = 0;
      pushHistory();
      syncControlsFromState();
      renderCoverSoon();
    });
    host.appendChild(btn);
  }
}

function buildGradePicker() {
  const host = document.getElementById('gradePicker');
  host.innerHTML = '';
  for (const name of GRADE_ORDER) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-btn grade-btn';
    btn.dataset.grade = name;
    const swatch = document.createElement('span');
    swatch.className = 'grade-swatch';
    swatch.style.background = gradeSwatchCss(name);
    btn.appendChild(swatch);
    const label = document.createElement('span');
    label.textContent = GRADES[name].label;
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      studio.state.grade = name;
      pushHistory();
      syncControlsFromState();
      renderCoverSoon();
    });
    host.appendChild(btn);
  }
}

function buildPreviewSizePicker() {
  const host = document.getElementById('previewSizePicker');
  host.innerHTML = '';
  for (const [key, size] of Object.entries(PREVIEW_SIZES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-btn size-btn';
    btn.dataset.size = key;
    btn.textContent = `${size.w} × ${size.h}`;
    btn.addEventListener('click', () => {
      studio.state.previewSize = key;
      syncControlsFromState();
      renderCoverNow();
    });
    host.appendChild(btn);
  }
}

function buildExportButtons() {
  const host = document.getElementById('exportButtons');
  host.innerHTML = '';
  for (const size of EXPORT_SIZES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'export-btn';
    btn.textContent = `PNG ${size.label}`;
    btn.addEventListener('click', () => exportCoverPng(size));
    host.appendChild(btn);
  }
  const all = document.createElement('button');
  all.type = 'button';
  all.className = 'export-btn export-all-btn';
  all.textContent = 'Export all three';
  all.addEventListener('click', exportAllSizes);
  host.appendChild(all);
}

function buildPanelList() {
  const host = document.getElementById('panelList');
  const geo = layoutGeometry(studio.state.layout, 100, 100);
  host.innerHTML = '';
  geo.panels.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'panel-chip';
    btn.dataset.panel = String(i);
    btn.textContent = `Panel ${i + 1} · ${panelPhotoLabel(i)}`;
    btn.addEventListener('click', () => {
      studio.state.selectedPanel = i;
      syncControlsFromState();
      drawSelectedPanelOutline();
    });
    host.appendChild(btn);
  });
}

function syncPanelSliders() {
  const panel = studio.state.panels[studio.state.selectedPanel];
  if (!panel) return;
  const zoom = document.getElementById('zoomSlider');
  const panX = document.getElementById('panXSlider');
  const panY = document.getElementById('panYSlider');
  if (zoom) zoom.value = String(panel.zoom);
  if (panX) panX.value = String(panel.panX);
  if (panY) panY.value = String(panel.panY);
  const zoomVal = document.getElementById('zoomValue');
  if (zoomVal) zoomVal.textContent = `${panel.zoom.toFixed(2)}×`;
}

function syncControlsFromState() {
  const s = studio.state;
  document.querySelectorAll('#layoutPicker .picker-btn').forEach((b) => {
    b.classList.toggle('selected', b.dataset.layout === s.layout);
  });
  document.querySelectorAll('#gradePicker .picker-btn').forEach((b) => {
    b.classList.toggle('selected', b.dataset.grade === s.grade);
  });
  document.querySelectorAll('#previewSizePicker .picker-btn').forEach((b) => {
    b.classList.toggle('selected', b.dataset.size === s.previewSize);
  });
  const titleInput = document.getElementById('titleInput');
  if (titleInput && document.activeElement !== titleInput) titleInput.value = s.title;
  const subtitleInput = document.getElementById('subtitleInput');
  if (subtitleInput && document.activeElement !== subtitleInput) subtitleInput.value = s.subtitle;
  const eyebrowInput = document.getElementById('eyebrowInput');
  if (eyebrowInput && document.activeElement !== eyebrowInput) eyebrowInput.value = s.eyebrow;
  const ribbonInput = document.getElementById('ribbonInput');
  if (ribbonInput && document.activeElement !== ribbonInput) ribbonInput.value = s.ribbon;
  const grain = document.getElementById('grainToggle');
  if (grain) grain.checked = s.grain;
  const vignette = document.getElementById('vignetteToggle');
  if (vignette) vignette.checked = s.vignette;
  buildPanelList();
  document.querySelectorAll('#panelList .panel-chip').forEach((b) => {
    b.classList.toggle('selected', Number(b.dataset.panel) === s.selectedPanel);
  });
  syncPanelSliders();
  refreshUndoButtons();
}

function wireControls() {
  buildLayoutPicker();
  buildGradePicker();
  buildPreviewSizePicker();
  buildExportButtons();
  const titleInput = document.getElementById('titleInput');
  titleInput.addEventListener('input', () => {
    studio.state.title = titleInput.value;
    renderCoverSoon();
  });
  titleInput.addEventListener('change', pushHistory);
  const subtitleInput = document.getElementById('subtitleInput');
  subtitleInput.addEventListener('input', () => {
    studio.state.subtitle = subtitleInput.value;
    renderCoverSoon();
  });
  subtitleInput.addEventListener('change', pushHistory);
  const eyebrowInput = document.getElementById('eyebrowInput');
  eyebrowInput.addEventListener('input', () => {
    studio.state.eyebrow = eyebrowInput.value;
    renderCoverSoon();
  });
  eyebrowInput.addEventListener('change', pushHistory);
  const ribbonInput = document.getElementById('ribbonInput');
  ribbonInput.addEventListener('input', () => {
    studio.state.ribbon = ribbonInput.value;
    renderCoverSoon();
  });
  ribbonInput.addEventListener('change', pushHistory);
  document.getElementById('grainToggle').addEventListener('change', (e) => {
    studio.state.grain = e.target.checked;
    pushHistory();
    renderCoverSoon();
  });
  document.getElementById('vignetteToggle').addEventListener('change', (e) => {
    studio.state.vignette = e.target.checked;
    pushHistory();
    renderCoverSoon();
  });
  document.getElementById('zoomSlider').addEventListener('input', (e) => {
    studio.state.panels[studio.state.selectedPanel].zoom = Number(e.target.value);
    syncPanelSliders();
    renderCoverSoon();
  });
  document.getElementById('zoomSlider').addEventListener('change', pushHistory);
  document.getElementById('panXSlider').addEventListener('input', (e) => {
    studio.state.panels[studio.state.selectedPanel].panX = Number(e.target.value);
    renderCoverSoon();
  });
  document.getElementById('panXSlider').addEventListener('change', pushHistory);
  document.getElementById('panYSlider').addEventListener('input', (e) => {
    studio.state.panels[studio.state.selectedPanel].panY = Number(e.target.value);
    renderCoverSoon();
  });
  document.getElementById('panYSlider').addEventListener('change', pushHistory);
  document.getElementById('shuffleBtn').addEventListener('click', shuffleCover);
  document.getElementById('undoBtn').addEventListener('click', undoCover);
  document.getElementById('redoBtn').addEventListener('click', redoCover);
  document.getElementById('swapBtn').addEventListener('click', () => {
    cyclePanelPhoto(studio.state.selectedPanel);
  });
  document.getElementById('uploadInput').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = `upload-${Date.now()}`;
      const entry = { id, label: file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Your photo', src: reader.result };
      studio.library.push(entry);
      const img = new Image();
      img.onload = () => {
        studio.photos.set(id, img);
        studio.state.panels[studio.state.selectedPanel].photo = id;
        pushHistory();
        syncControlsFromState();
        renderCoverSoon();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  });
  document.getElementById('usePierBtn').addEventListener('click', () => {
    studio.state.panels[studio.state.selectedPanel].photo = 'pier';
    pushHistory();
    syncControlsFromState();
    renderCoverSoon();
  });
  document.getElementById('useBoulevardBtn').addEventListener('click', () => {
    studio.state.panels[studio.state.selectedPanel].photo = 'boulevard';
    pushHistory();
    syncControlsFromState();
    renderCoverSoon();
  });
  wireGestures();
}

// Wait for the vendored fonts, then load the photos and paint.
export async function startStudio() {
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.load('20px "Bebas Neue"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* fonts are local; a failure still leaves the fallback stack */
  }
  wireControls();
  syncControlsFromState();
  pushHistory();
  await loadLibraryPhotos();
  renderCoverNow();
}

studio.ready = startStudio();
