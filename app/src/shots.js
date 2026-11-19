// Neon Coast Cover Studio — screenshot scenes.
// When the page loads with ?shot=, it renders one fixed scene and sets
// document.title to 'ready' so a headless screenshot can capture it.
//   ?shot=cover&layout=hero-three&grade=sunset&photo=boulevard
//     &caption=Sunset%20Heist&sub=welcome%20back%20to%20vice%20city
//     renders one exported cover filling the viewport.
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen
//     shows the editor with a sample photo loaded.
'use strict';

(function () {
  var params = new URLSearchParams(window.location.search);
  if (!params.has('shot')) return;
  var engine = window.CoverEngine;
  var SAMPLE_SRC = { boulevard: 'samples/boulevard.jpg', pier: 'samples/pier.jpg' };

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function waitForFonts() {
    return Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('100px Pacifico'),
      document.fonts.load('100px "Bebas Neue"'),
    ]).catch(function () { return null; });
  }

  function stateFromParams() {
    var layoutId = params.get('layout') || 'vice-grid';
    var layout = engine.layoutById(layoutId);
    var photoId = params.get('photo') || 'boulevard';
    var panels = [];
    for (var i = 0; i < layout.panelCount; i++) {
      panels.push({ photo: photoId, zoom: 1, panX: 0, panY: 0 });
    }
    // Alternate the two samples across panels so grids look varied.
    var alt = photoId === 'boulevard' ? 'pier' : 'boulevard';
    for (var j = 1; j < panels.length; j += 2) panels[j].photo = alt;
    return {
      layout: layout.id,
      grade: params.get('grade') || 'sunset',
      title: params.get('caption') || 'Sunset Heist',
      subtitle: params.get('sub') || 'welcome back to vice city',
      ribbon: 'Launch Week',
      grain: true,
      vignette: true,
      panels: panels,
    };
  }

  function renderCoverShot() {
    document.body.classList.add('shot');
    var canvas = document.getElementById('preview');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var state = stateFromParams();
    var needed = {};
    state.panels.forEach(function (panel) { needed[panel.photo] = true; });
    var loads = Object.keys(needed).map(function (id) {
      return loadImage(SAMPLE_SRC[id] || SAMPLE_SRC.boulevard).then(function (img) {
        return [id, img];
      });
    });
    Promise.all(loads).then(function (pairs) {
      var photos = {};
      pairs.forEach(function (pair) { if (pair[1]) photos[pair[0]] = pair[1]; });
      return waitForFonts().then(function () {
        engine.renderCover(canvas, state, photos, {});
        document.title = 'ready';
      });
    });
  }

  function renderEditorShot() {
    // The normal editor boot already loads the samples and renders; this
    // scene only presets the caption and layout, then signals readiness.
    var title = params.get('caption') || 'Boulevard Queen';
    var tries = 0;
    var timer = setInterval(function () {
      var input = document.getElementById('title-input');
      var canvas = document.getElementById('preview');
      tries++;
      if (input && input.value && canvas && canvas.width > 0) {
        clearInterval(timer);
        input.value = title;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        document.title = 'ready';
      } else if (tries > 100) {
        clearInterval(timer);
        document.title = 'ready';
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (params.get('shot') === 'cover') renderCoverShot();
      else renderEditorShot();
    });
  } else if (params.get('shot') === 'cover') renderCoverShot();
  else renderEditorShot();
})();
