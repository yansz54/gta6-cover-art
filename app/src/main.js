// main.js — Neon Coast Cover Studio: the editor (v3).
//
// Wires the page into a cover maker: photo upload and the two built-in
// kit sample photos, drag to pan, scroll to zoom, double-click to swap
// panels, layout and grade pickers, title editing, Shuffle, undo/redo
// (50 steps), grain and vignette toggles, and PNG export in the three
// post sizes. The preview is the live cover drawn by cover.js.
// No network requests, no font files: all lettering is drawn by the
// procedural bitmap font in cover.js.
//
// Exports: studio, renderCoverNow.

import { GRADES, GRADE_ORDER, LAYOUTS, LAYOUT_ORDER, drawCover } from './cover.js';

const SAMPLE_PHOTOS = [
  { id: 'boulevard', src: 'samples/boulevard.jpg', label: 'Boulevard' },
  { id: 'pier', src: 'samples/pier.jpg', label: 'Pier' },
];

const EXPORT_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080' },
  story: { w: 1080, h: 1350, label: '1080 × 1350' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080' },
};

function defaultPanels(layout) {
  const count = layout === 'fullBleed' ? 1 : layout === 'splitDuo' ? 2
    : layout === 'filmStrip' ? 5 : layout === 'tiltedTrio' ? 3 : 4;
  const photos = ['boulevard', 'pier', 'boulevard', 'pier', 'boulevard'];
  return Array.from({ length: count }, (_, i) => ({
    photo: photos[i % photos.length], px: 0, py: 0, zoom: 1,
  }));
}

function defaultState() {
  return {
    layout: 'heroStrip',
    grade: 'viceink',
    title: 'VICE CITY',
    subtitle: 'Welcome back to Leonida',
    eyebrow: 'GRAND THEFT AUTO VI',
    panels: defaultPanels('heroStrip'),
    selectedPanel: 0,
    previewSize: 'wide',
    grain: true,
    vignette: true,
    ribbon: true,
  };
}

const studio = {
  state: defaultState(),
  library: SAMPLE_PHOTOS,
  photos: {},
  ready: null,
  _history: [],
  _future: [],
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load ' + src));
    img.src = src;
  });
}

studio.ready = (async () => {
  for (const p of SAMPLE_PHOTOS) {
    try {
      studio.photos[p.id] = await loadImage(p.src);
    } catch (e) {
      // A missing sample just leaves that panel empty.
    }
  }
})();

function snapshotState() {
  return JSON.parse(JSON.stringify(studio.state));
}

function pushHistory() {
  studio._history.push(snapshotState());
  if (studio._history.length > 50) studio._history.shift();
  studio._future = [];
  syncUndoRedoButtons();
}

function undo() {
  if (!studio._history.length) return;
  studio._future.push(snapshotState());
  studio.state = studio._history.pop();
  syncUndoRedoButtons();
  renderCoverNow();
  syncInputs();
}

function redo() {
  if (!studio._future.length) return;
  studio._history.push(snapshotState());
  studio.state = studio._future.pop();
  syncUndoRedoButtons();
  renderCoverNow();
  syncInputs();
}

function setLayout(layout) {
  if (!LAYOUTS[layout]) return;
  pushHistory();
  const old = studio.state.panels;
  studio.state.layout = layout;
  studio.state.panels = defaultPanels(layout).map((p, i) => ({
    ...p,
    photo: old[i] ? old[i].photo : p.photo,
    px: old[i] ? old[i].px : 0,
    py: old[i] ? old[i].py : 0,
    zoom: old[i] ? old[i].zoom : 1,
  }));
  studio.state.selectedPanel = 0;
  renderCoverNow();
  syncPickers();
}

function setGrade(grade) {
  if (!GRADES[grade]) return;
  pushHistory();
  studio.state.grade = grade;
  renderCoverNow();
  syncPickers();
}

function shuffle() {
  pushHistory();
  const rnd = Math.random;
  const layout = LAYOUT_ORDER[Math.floor(rnd() * LAYOUT_ORDER.length)];
  const grade = GRADE_ORDER[Math.floor(rnd() * GRADE_ORDER.length)];
  const titles = [
    ['VICE CITY', 'Welcome back to Leonida'],
    ['LEONIDA', 'Sunshine, sins and sirens'],
    ['VICE CITY', 'Two outlaws. One last score.'],
    ['NEON COAST', 'The city never sleeps'],
    ['VICE CITY', 'Chase the sunset'],
  ];
  const [title, subtitle] = titles[Math.floor(rnd() * titles.length)];
  studio.state.layout = layout;
  studio.state.grade = grade;
  studio.state.title = title;
  studio.state.subtitle = subtitle;
  studio.state.panels = defaultPanels(layout);
  studio.state.selectedPanel = 0;
  renderCoverNow();
  syncPickers();
  syncInputs();
}

function previewDims() {
  const size = EXPORT_SIZES[studio.state.previewSize] || EXPORT_SIZES.wide;
  return { w: size.w, h: size.h };
}

function renderCoverNow() {
  const canvas = document.getElementById('coverCanvas');
  if (!canvas) return;
  const { w, h } = previewDims();
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, w, h, studio.state, studio.photos);
  const overlay = document.getElementById('coverOverlay');
  if (overlay) {
    overlay.width = w;
    overlay.height = h;
    overlay.style.display = 'none';
  }
  updateStatus();
}

function exportPNG(sizeKey) {
  const size = EXPORT_SIZES[sizeKey];
  if (!size) return;
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  const ctx = off.getContext('2d');
  drawCover(ctx, size.w, size.h, studio.state, studio.photos);
  const a = document.createElement('a');
  a.download = `neon-coast-cover-${sizeKey}-${size.w}x${size.h}.png`;
  a.href = off.toDataURL('image/png');
  a.click();
  updateStatus(`Exported ${size.label} PNG`);
}

function updateStatus(msg) {
  const el = document.getElementById('statusLine');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    return;
  }
  const size = EXPORT_SIZES[studio.state.previewSize] || EXPORT_SIZES.wide;
  el.textContent = `${LAYOUTS[studio.state.layout].label} · ${GRADES[studio.state.grade].label} · preview ${size.label}`;
}

// ---- UI sync -------------------------------------------------------
function syncPickers() {
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === studio.state.layout);
    b.setAttribute('aria-pressed', b.dataset.layout === studio.state.layout ? 'true' : 'false');
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === studio.state.grade);
    b.setAttribute('aria-pressed', b.dataset.grade === studio.state.grade ? 'true' : 'false');
  });
  document.querySelectorAll('[data-preview]').forEach((b) => {
    b.classList.toggle('active', b.dataset.preview === studio.state.previewSize);
  });
  const grain = document.getElementById('grainToggle');
  if (grain) grain.checked = studio.state.grain !== false;
  const vig = document.getElementById('vignetteToggle');
  if (vig) vig.checked = studio.state.vignette !== false;
}

function syncInputs() {
  const t = document.getElementById('titleInput');
  if (t) t.value = studio.state.title;
  const s = document.getElementById('subtitleInput');
  if (s) s.value = studio.state.subtitle;
  const e = document.getElementById('eyebrowInput');
  if (e) e.value = studio.state.eyebrow;
}

function syncUndoRedoButtons() {
  const u = document.getElementById('undoBtn');
  if (u) u.disabled = studio._history.length === 0;
  const r = document.getElementById('redoBtn');
  if (r) r.disabled = studio._future.length === 0;
}

function buildPickers() {
  const layoutBox = document.getElementById('layoutPicker');
  if (layoutBox) {
    layoutBox.innerHTML = '';
    for (const id of LAYOUT_ORDER) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.dataset.layout = id;
      b.textContent = LAYOUTS[id].label;
      b.addEventListener('click', () => setLayout(id));
      layoutBox.appendChild(b);
    }
  }
  const gradeBox = document.getElementById('gradePicker');
  if (gradeBox) {
    gradeBox.innerHTML = '';
    for (const id of GRADE_ORDER) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick grade-swatch';
      b.dataset.grade = id;
      b.textContent = GRADES[id].label;
      b.style.setProperty('--sw', GRADES[id].accent);
      b.addEventListener('click', () => setGrade(id));
      gradeBox.appendChild(b);
    }
  }
  const sizeBox = document.getElementById('previewPicker');
  if (sizeBox) {
    sizeBox.innerHTML = '';
    for (const key of Object.keys(EXPORT_SIZES)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.dataset.preview = key;
      b.textContent = EXPORT_SIZES[key].label;
      b.addEventListener('click', () => {
        studio.state.previewSize = key;
        renderCoverNow();
        syncPickers();
      });
      sizeBox.appendChild(b);
    }
  }
}

// ---- Photo upload / pan / zoom / swap -------------------------------
function handleUpload(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  loadImage(url).then((img) => {
    const id = 'user-' + Date.now();
    studio.photos[id] = img;
    studio.library.push({ id, src: url, label: file.name });
    pushHistory();
    studio.state.panels[studio.state.selectedPanel].photo = id;
    renderCoverNow();
    updateStatus(`Loaded ${file.name}`);
  });
}

function panelRects() {
  const layout = LAYOUTS[studio.state.layout] || LAYOUTS.heroStrip;
  const canvas = document.getElementById('coverCanvas');
  const g = Math.max(8, Math.round(Math.min(canvas.width, canvas.height) * 0.016));
  return layout.panels(canvas.width, canvas.height, g);
}

function panelAtPoint(mx, my) {
  const canvas = document.getElementById('coverCanvas');
  const rect = canvas.getBoundingClientRect();
  const x = (mx - rect.left) * (canvas.width / rect.width);
  const y = (my - rect.top) * (canvas.height / rect.height);
  const rects = panelRects();
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function wireCanvas() {
  const canvas = document.getElementById('coverCanvas');
  if (!canvas) return;
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const idx = panelAtPoint(e.clientX, e.clientY);
    if (idx < 0) return;
    studio.state.selectedPanel = idx;
    drag = { idx, x: e.clientX, y: e.clientY, px: studio.state.panels[idx].px, py: studio.state.panels[idx].py };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const panel = studio.state.panels[drag.idx];
    panel.px = drag.px + (e.clientX - drag.x) / rect.width;
    panel.py = drag.py + (e.clientY - drag.y) / rect.height;
    renderCoverNow();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag) { pushHistory(); drag = null; }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const idx = panelAtPoint(e.clientX, e.clientY);
    if (idx < 0) return;
    const panel = studio.state.panels[idx];
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    panel.zoom = Math.min(3, Math.max(0.6, (panel.zoom || 1) * factor));
    renderCoverNow();
  }, { passive: false });
  canvas.addEventListener('dblclick', (e) => {
    const idx = panelAtPoint(e.clientX, e.clientY);
    if (idx < 0 || studio.state.panels.length < 2) return;
    pushHistory();
    const next = (idx + 1) % studio.state.panels.length;
    const a = studio.state.panels[idx].photo;
    studio.state.panels[idx].photo = studio.state.panels[next].photo;
    studio.state.panels[next].photo = a;
    renderCoverNow();
    updateStatus('Swapped two panels');
  });
}

// ---- Boot ----------------------------------------------------------
function init() {
  buildPickers();
  syncPickers();
  syncInputs();
  syncUndoRedoButtons();

  const titleInput = document.getElementById('titleInput');
  if (titleInput) titleInput.addEventListener('input', () => {
    studio.state.title = titleInput.value;
    renderCoverNow();
  });
  const subtitleInput = document.getElementById('subtitleInput');
  if (subtitleInput) subtitleInput.addEventListener('input', () => {
    studio.state.subtitle = subtitleInput.value;
    renderCoverNow();
  });
  const eyebrowInput = document.getElementById('eyebrowInput');
  if (eyebrowInput) eyebrowInput.addEventListener('input', () => {
    studio.state.eyebrow = eyebrowInput.value;
    renderCoverNow();
  });
  const shuffleBtn = document.getElementById('shuffleBtn');
  if (shuffleBtn) shuffleBtn.addEventListener('click', shuffle);
  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) undoBtn.addEventListener('click', undo);
  const redoBtn = document.getElementById('redoBtn');
  if (redoBtn) redoBtn.addEventListener('click', redo);
  const grain = document.getElementById('grainToggle');
  if (grain) grain.addEventListener('change', () => {
    studio.state.grain = grain.checked;
    renderCoverNow();
  });
  const vig = document.getElementById('vignetteToggle');
  if (vig) vig.addEventListener('change', () => {
    studio.state.vignette = vig.checked;
    renderCoverNow();
  });
  const upload = document.getElementById('uploadInput');
  if (upload) upload.addEventListener('change', () => {
    handleUpload(upload.files[0]);
    upload.value = '';
  });
  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn && upload) uploadBtn.addEventListener('click', () => upload.click());
  document.querySelectorAll('[data-export]').forEach((b) => {
    b.addEventListener('click', () => exportPNG(b.dataset.export));
  });
  wireCanvas();
  studio.ready.then(() => {
    renderCoverNow();
    updateStatus('Ready — pick a photo, a layout and a grade, then export');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { studio, renderCoverNow, exportPNG, setLayout, setGrade, shuffle, undo, redo };
