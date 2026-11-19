// Neon Coast Cover Studio — editor UI.
// Wires the controls to the cover engine: photos, layouts, grades, captions,
// per-panel drag/zoom/crop, undo/redo and PNG export in three post sizes.
'use strict';

(function () {
  var engine = window.CoverEngine;
  var SAMPLE_IDS = ['boulevard', 'pier'];
  var SAMPLE_SRC = { boulevard: 'samples/boulevard.jpg', pier: 'samples/pier.jpg' };
  var EXPORT_SIZES = [
    { id: 'square', name: 'Square 1080 × 1080', w: 1080, h: 1080 },
    { id: 'story', name: 'Story 1080 × 1350', w: 1080, h: 1350 },
    { id: 'wide', name: 'Wide 1920 × 1080', w: 1920, h: 1080 },
  ];

  var photos = {}; // id -> loaded image element
  var photoOrder = []; // ids in the order added
  var uploadCount = 0;
  var state = engine.defaultState('vice-grid', SAMPLE_IDS);
  var selectedPanel = 0;
  var exportSize = EXPORT_SIZES[0];
  var history = [];
  var historyIndex = -1;

  var preview = document.getElementById('preview');
  var previewCtx = preview.getContext('2d');

  // ------------------------------------------------------------ state
  function snapshot() {
    return JSON.stringify(state);
  }

  function pushHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot());
    if (history.length > 50) history.shift();
    historyIndex = history.length - 1;
    updateUndoButtons();
  }

  function restoreFromHistory(index) {
    state = JSON.parse(history[index]);
    historyIndex = index;
    selectedPanel = Math.min(selectedPanel, state.panels.length - 1);
    syncControls();
    renderPreview();
    updateUndoButtons();
  }

  function updateUndoButtons() {
    document.getElementById('undo-btn').disabled = historyIndex <= 0;
    document.getElementById('redo-btn').disabled = historyIndex >= history.length - 1;
  }

  function changeState(mutator) {
    mutator(state);
    pushHistory();
    renderPreview();
  }

  // ------------------------------------------------------------ photos
  function loadPhoto(id, src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        photos[id] = img;
        if (photoOrder.indexOf(id) < 0) photoOrder.push(id);
        resolve(img);
      };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function loadSamplePhotos() {
    return Promise.all(SAMPLE_IDS.map(function (id) { return loadPhoto(id, SAMPLE_SRC[id]); }));
  }

  function addUploads(files) {
    var readers = [];
    for (var i = 0; i < files.length; i++) {
      (function (file) {
        readers.push(new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () {
            var id = 'upload-' + (++uploadCount);
            loadPhoto(id, reader.result).then(resolve);
          };
          reader.onerror = function () { resolve(null); };
          reader.readAsDataURL(file);
        }));
      })(files[i]);
    }
    return Promise.all(readers).then(function () {
      renderPhotoStrip();
      renderPreview();
    });
  }

  function renderPhotoStrip() {
    var strip = document.getElementById('photo-strip');
    strip.innerHTML = '';
    photoOrder.forEach(function (id) {
      var img = photos[id];
      if (!img) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'thumb';
      button.title = 'Use this photo in the selected panel';
      var thumb = document.createElement('img');
      thumb.src = img.src;
      thumb.alt = id;
      button.appendChild(thumb);
      button.addEventListener('click', function () {
        changeState(function (s) {
          s.panels[selectedPanel].photo = id;
          s.panels[selectedPanel].zoom = 1;
          s.panels[selectedPanel].panX = 0;
          s.panels[selectedPanel].panY = 0;
        });
        renderPhotoStrip();
      });
      strip.appendChild(button);
    });
  }

  // ------------------------------------------------------------ rendering
  function previewSize() {
    var ratio = exportSize.w / exportSize.h;
    var maxSide = 720;
    if (ratio >= 1) return { w: maxSide, h: Math.round(maxSide / ratio) };
    return { w: Math.round(maxSide * ratio), h: maxSide };
  }

  function renderPreview() {
    var size = previewSize();
    if (preview.width !== size.w || preview.height !== size.h) {
      preview.width = size.w;
      preview.height = size.h;
    }
    engine.renderCover(preview, state, photos, { highlight: selectedPanel });
    document.getElementById('panel-label').textContent =
      'Panel ' + (selectedPanel + 1) + ' of ' + state.panels.length;
    var slot = state.panels[selectedPanel];
    document.getElementById('zoom-range').value = String(slot.zoom || 1);
    document.getElementById('panx-range').value = String(slot.panX || 0);
    document.getElementById('pany-range').value = String(slot.panY || 0);
  }

  // ------------------------------------------------------------ export
  function exportCover(size) {
    var canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    engine.renderCover(canvas, state, photos, {});
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, 'image/png');
    });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
  }

  // ------------------------------------------------------------ controls
  function buildPickers() {
    var layoutRow = document.getElementById('layout-row');
    engine.LAYOUTS.forEach(function (layout) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'pick';
      button.textContent = layout.name;
      button.dataset.layout = layout.id;
      button.addEventListener('click', function () {
        changeState(function (s) {
          var old = s.panels;
          s.layout = layout.id;
          var next = [];
          for (var i = 0; i < layout.panelCount; i++) {
            next.push(old[i] || { photo: SAMPLE_IDS[i % SAMPLE_IDS.length], zoom: 1, panX: 0, panY: 0 });
          }
          s.panels = next;
        });
        selectedPanel = 0;
        syncControls();
        renderPreview();
      });
      layoutRow.appendChild(button);
    });

    var gradeRow = document.getElementById('grade-row');
    engine.GRADES.forEach(function (grade) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'pick grade-pick';
      button.dataset.grade = grade.id;
      var stops = grade.stops.map(function (s) { return s[1] + ' ' + Math.round(s[0] * 100) + '%'; }).join(', ');
      button.style.background = 'linear-gradient(135deg, ' + stops + ')';
      button.title = grade.name;
      button.setAttribute('aria-label', grade.name);
      button.addEventListener('click', function () {
        changeState(function (s) { s.grade = grade.id; });
        syncControls();
      });
      gradeRow.appendChild(button);
    });

    var sizeRow = document.getElementById('size-row');
    EXPORT_SIZES.forEach(function (size) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'pick';
      button.textContent = size.name;
      button.dataset.size = size.id;
      button.addEventListener('click', function () {
        exportSize = size;
        syncControls();
        renderPreview();
      });
      sizeRow.appendChild(button);
    });
  }

  function syncControls() {
    document.querySelectorAll('#layout-row .pick').forEach(function (b) {
      b.classList.toggle('active', b.dataset.layout === state.layout);
    });
    document.querySelectorAll('#grade-row .pick').forEach(function (b) {
      b.classList.toggle('active', b.dataset.grade === state.grade);
    });
    document.querySelectorAll('#size-row .pick').forEach(function (b) {
      b.classList.toggle('active', b.dataset.size === exportSize.id);
    });
    document.getElementById('title-input').value = state.title;
    document.getElementById('subtitle-input').value = state.subtitle;
    document.getElementById('ribbon-check').checked = !!state.ribbon;
    document.getElementById('grain-check').checked = !!state.grain;
    document.getElementById('grade-name').textContent = engine.gradeById(state.grade).name;
    document.getElementById('layout-name').textContent = engine.layoutById(state.layout).name;
  }

  function bindControls() {
    document.getElementById('upload-input').addEventListener('change', function (event) {
      if (event.target.files.length) addUploads(event.target.files);
      event.target.value = '';
    });
    document.getElementById('shuffle-btn').addEventListener('click', function () {
      changeState(function (s) {
        var ids = photoOrder.slice();
        for (var i = ids.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
        }
        s.panels.forEach(function (panel, index) {
          panel.photo = ids[index % ids.length];
        });
      });
    });
    document.getElementById('title-input').addEventListener('input', function (event) {
      state.title = event.target.value;
      renderPreview();
    });
    document.getElementById('title-input').addEventListener('change', pushHistory);
    document.getElementById('subtitle-input').addEventListener('input', function (event) {
      state.subtitle = event.target.value;
      renderPreview();
    });
    document.getElementById('subtitle-input').addEventListener('change', pushHistory);
    document.getElementById('ribbon-check').addEventListener('change', function (event) {
      changeState(function (s) { s.ribbon = event.target.checked ? 'Launch Week' : ''; });
    });
    document.getElementById('grain-check').addEventListener('change', function (event) {
      changeState(function (s) { s.grain = event.target.checked; });
    });
    document.getElementById('zoom-range').addEventListener('input', function (event) {
      state.panels[selectedPanel].zoom = parseFloat(event.target.value);
      renderPreview();
    });
    document.getElementById('zoom-range').addEventListener('change', pushHistory);
    document.getElementById('panx-range').addEventListener('input', function (event) {
      state.panels[selectedPanel].panX = parseFloat(event.target.value);
      renderPreview();
    });
    document.getElementById('panx-range').addEventListener('change', pushHistory);
    document.getElementById('pany-range').addEventListener('input', function (event) {
      state.panels[selectedPanel].panY = parseFloat(event.target.value);
      renderPreview();
    });
    document.getElementById('pany-range').addEventListener('change', pushHistory);
    document.getElementById('undo-btn').addEventListener('click', function () {
      if (historyIndex > 0) restoreFromHistory(historyIndex - 1);
    });
    document.getElementById('redo-btn').addEventListener('click', function () {
      if (historyIndex < history.length - 1) restoreFromHistory(historyIndex + 1);
    });
    document.getElementById('export-btn').addEventListener('click', function () {
      exportCover(exportSize).then(function (blob) {
        downloadBlob(blob, 'neon-coast-' + slug(state.title) + '-' + exportSize.id + '.png');
      });
    });
    document.getElementById('export-all-btn').addEventListener('click', function () {
      var chain = Promise.resolve();
      EXPORT_SIZES.forEach(function (size, index) {
        chain = chain.then(function () {
          return exportCover(size).then(function (blob) {
            downloadBlob(blob, 'neon-coast-' + slug(state.title) + '-' + size.id + '.png');
            return new Promise(function (resolve) { setTimeout(resolve, index === EXPORT_SIZES.length - 1 ? 0 : 350); });
          });
        });
      });
    });
    bindCanvasGestures();
  }

  // Drag pans the selected panel, the wheel zooms it, a click selects a panel.
  function bindCanvasGestures() {
    var dragging = false;
    var moved = false;
    var lastX = 0;
    var lastY = 0;

    function canvasPoint(event) {
      var rect = preview.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (preview.width / rect.width),
        y: (event.clientY - rect.top) * (preview.height / rect.height),
      };
    }

    function hitPanel(point) {
      var rects = engine.panelRects(state, preview.width, preview.height);
      for (var i = rects.length - 1; i >= 0; i--) {
        var r = rects[i];
        if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) return i;
      }
      return -1;
    }

    preview.addEventListener('pointerdown', function (event) {
      var point = canvasPoint(event);
      var hit = hitPanel(point);
      if (hit >= 0) {
        selectedPanel = hit;
        dragging = true;
        moved = false;
        lastX = point.x;
        lastY = point.y;
        preview.setPointerCapture(event.pointerId);
        renderPreview();
      }
    });
    preview.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var point = canvasPoint(event);
      var dx = point.x - lastX;
      var dy = point.y - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
      lastX = point.x;
      lastY = point.y;
      var panel = state.panels[selectedPanel];
      panel.panX = Math.max(-1, Math.min(1, (panel.panX || 0) + (dx / preview.width) * 2.2));
      panel.panY = Math.max(-1, Math.min(1, (panel.panY || 0) + (dy / preview.height) * 2.2));
      renderPreview();
    });
    preview.addEventListener('pointerup', function () {
      if (dragging && moved) pushHistory();
      dragging = false;
    });
    preview.addEventListener('wheel', function (event) {
      event.preventDefault();
      var panel = state.panels[selectedPanel];
      var next = (panel.zoom || 1) * (event.deltaY < 0 ? 1.08 : 0.93);
      panel.zoom = Math.max(1, Math.min(3, next));
      renderPreview();
    }, { passive: false });
    preview.addEventListener('dblclick', function () {
      changeState(function (s) {
        var current = photoOrder.indexOf(s.panels[selectedPanel].photo);
        var next = photoOrder[(current + 1) % photoOrder.length];
        s.panels[selectedPanel].photo = next;
        s.panels[selectedPanel].zoom = 1;
        s.panels[selectedPanel].panX = 0;
        s.panels[selectedPanel].panY = 0;
      });
    });
  }

  // ------------------------------------------------------------ boot
  function boot() {
    // In cover-shot mode shots.js owns the canvas; the editor stays out.
    if (new URLSearchParams(window.location.search).get('shot') === 'cover') return;
    buildPickers();
    bindControls();
    // Fonts must be ready before the first render, or the title falls back.
    var fontReady = Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('100px Pacifico'),
      document.fonts.load('100px "Bebas Neue"'),
    ]).catch(function () { return null; });
    loadSamplePhotos().then(function () {
      return fontReady;
    }).then(function () {
      renderPhotoStrip();
      syncControls();
      pushHistory();
      renderPreview();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
