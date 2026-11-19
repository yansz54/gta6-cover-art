// shots.js — fixed scenes for the screenshots (v3).
//
// Reads the page's query string and sets the studio up for one shot:
//   ?shot=cover&size=wide|square|story&layout=..&grade=..&photo=..&title=..&subtitle=..
//       hides the editor chrome and shows only the cover, filling the
//       window, so the screenshot IS the exported cover at that size.
//   ?shot=editor&layout=..&grade=..&photo=..
//       shows the editor with a photo loaded.
//   Optional flags: &grain=0|1 &vignette=0|1 &ribbon=0|1.
// Without a ?shot param the editor opens with its defaults.

import { GRADE_ORDER, LAYOUT_ORDER } from './cover.js';
import { studio } from './main.js';

function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  const pick = (key, list, fallback) => {
    const v = q.get(key);
    return v && list.includes(v) ? v : fallback;
  };
  const photo = q.get('photo');
  const flag = (key, fallback) => {
    const v = q.get(key);
    if (v === '0' || v === 'false') return false;
    if (v === '1' || v === 'true') return true;
    return fallback;
  };
  const params = {
    shot,
    size: q.get('size') || 'wide',
    layout: pick('layout', LAYOUT_ORDER, studio.state.layout),
    grade: pick('grade', GRADE_ORDER, studio.state.grade),
    photo: photo && studio.library.some((p) => p.id === photo) ? photo : null,
    title: q.get('title') || null,
    subtitle: q.get('subtitle') || null,
    eyebrow: q.get('eyebrow') || null,
    grain: flag('grain', studio.state.grain),
    vignette: flag('vignette', studio.state.vignette),
    ribbon: flag('ribbon', studio.state.ribbon),
  };
  return params;
}

async function applyShotScene() {
  await studio.ready;
  const params = readShotParams();
  if (!params) return;
  const state = studio.state;
  state.layout = params.layout;
  state.grade = params.grade;
  if (params.title) state.title = params.title;
  if (params.subtitle) state.subtitle = params.subtitle;
  if (params.eyebrow) state.eyebrow = params.eyebrow;
  state.grain = params.grain;
  state.vignette = params.vignette;
  state.ribbon = params.ribbon;
  if (params.photo) {
    state.panels = state.panels.map((panel) => ({ ...panel, photo: params.photo }));
  }
  state.selectedPanel = 0;
  // Sync the editor inputs and pickers with the shot's state, after the
  // editor has built them (init runs on DOMContentLoaded).
  setTimeout(() => {
    const titleInput = document.getElementById('titleInput');
    if (titleInput) titleInput.value = state.title;
    const subtitleInput = document.getElementById('subtitleInput');
    if (subtitleInput) subtitleInput.value = state.subtitle;
    const eyebrowInput = document.getElementById('eyebrowInput');
    if (eyebrowInput) eyebrowInput.value = state.eyebrow;
    document.querySelectorAll('[data-layout]').forEach((b) => {
      b.classList.toggle('active', b.dataset.layout === state.layout);
    });
    document.querySelectorAll('[data-grade]').forEach((b) => {
      b.classList.toggle('active', b.dataset.grade === state.grade);
    });
    document.querySelectorAll('[data-preview]').forEach((b) => {
      b.classList.toggle('active', b.dataset.preview === state.previewSize);
    });
  }, 60);
  if (params.shot === 'cover') {
    document.body.classList.add('cover-shot');
    const canvas = document.getElementById('coverCanvas');
    const overlay = document.getElementById('coverOverlay');
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    overlay.width = w;
    overlay.height = h;
    overlay.style.display = 'none';
    const { drawCover } = await import('./cover.js');
    const ctx = canvas.getContext('2d');
    drawCover(ctx, w, h, state, studio.photos);
  } else {
    // Editor shot: keep the normal preview, sized by the scene.
    if (params.size === 'square') state.previewSize = 'square';
    else if (params.size === 'story') state.previewSize = 'story';
    else state.previewSize = 'wide';
    const { renderCoverNow } = await import('./main.js');
    renderCoverNow();
  }
}

applyShotScene();
