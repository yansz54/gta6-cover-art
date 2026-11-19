// shots.js — fixed scenes for the screenshots.
//
// Reads the page's query string and sets the studio up for one shot:
//   ?shot=cover&size=wide|square|story&layout=..&grade=..&photo=..&title=..&subtitle=..
//       hides the editor chrome and shows only the cover, filling the
//       window, so the screenshot IS the exported cover at that size.
//   ?shot=editor&layout=..&grade=..&photo=..
//       shows the editor with a photo loaded.
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
  const params = {
    shot,
    size: q.get('size') || 'wide',
    layout: pick('layout', LAYOUT_ORDER, studio.state.layout),
    grade: pick('grade', GRADE_ORDER, studio.state.grade),
    photo: photo && studio.library.some((p) => p.id === photo) ? photo : null,
    title: q.get('title') || null,
    subtitle: q.get('subtitle') || null,
    eyebrow: q.get('eyebrow') || null,
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
  if (params.photo) {
    state.panels = state.panels.map((panel) => ({ ...panel, photo: params.photo }));
  }
  state.selectedPanel = 0;
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
