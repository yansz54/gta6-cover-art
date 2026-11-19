// Neon Coast Cover Studio — cover engine.
// Pure canvas 2D, no dependencies, no network. Renders GTA 6-style multi-panel
// cover art from any photos: layouts, gradient-map grades, halftone title block,
// Anton title lettering with a Pacifico subtitle, grain and vignette.
'use strict';

window.CoverEngine = (function () {
  // ---------------------------------------------------------------- grades
  // A grade is a gradient map: a photo's luminance is remapped through these
  // colour stops, which is what gives the Vice City neon-sunset look.
  var GRADES = [
    {
      id: 'sunset',
      name: 'Sunset',
      stops: [[0, '#160a2e'], [0.25, '#7b2d8b'], [0.5, '#e8446c'], [0.75, '#ff7a3d'], [1, '#ffd166']],
    },
    {
      id: 'neon',
      name: 'Neon Nights',
      stops: [[0, '#03101c'], [0.25, '#0b3d5c'], [0.5, '#0ea5a5'], [0.75, '#ff2e88'], [1, '#ffe66d']],
    },
    {
      id: 'vice',
      name: 'Vice',
      stops: [[0, '#12041f'], [0.25, '#4c1d95'], [0.5, '#c026d3'], [0.75, '#fb7185'], [1, '#fde68a']],
    },
    {
      id: 'noir',
      name: 'Noir',
      stops: [[0, '#000000'], [0.25, '#1f2937'], [0.5, '#6b7280'], [0.75, '#d1d5db'], [1, '#ffffff']],
    },
    {
      id: 'palm',
      name: 'Palm Gold',
      stops: [[0, '#022c22'], [0.25, '#065f46'], [0.5, '#b45309'], [0.75, '#fbbf24'], [1, '#fef3c7']],
    },
  ];

  function gradeById(id) {
    for (var i = 0; i < GRADES.length; i++) if (GRADES[i].id === id) return GRADES[i];
    return GRADES[0];
  }

  function hexRgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  // A 256-entry lookup table for one grade: luminance 0..255 -> [r, g, b].
  function buildGradeLut(grade) {
    var lut = new Array(256);
    var stops = grade.stops;
    for (var i = 0; i < 256; i++) {
      var t = i / 255;
      var a = stops[0];
      var b = stops[stops.length - 1];
      for (var s = 0; s < stops.length - 1; s++) {
        if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
      }
      var span = b[0] - a[0] || 1;
      var f = (t - a[0]) / span;
      var ca = hexRgb(a[1]);
      var cb = hexRgb(b[1]);
      lut[i] = [
        Math.round(ca[0] + (cb[0] - ca[0]) * f),
        Math.round(ca[1] + (cb[1] - ca[1]) * f),
        Math.round(ca[2] + (cb[2] - ca[2]) * f),
      ];
    }
    return lut;
  }

  var lutCache = {};
  function gradeLut(grade) {
    if (!lutCache[grade.id]) lutCache[grade.id] = buildGradeLut(grade);
    return lutCache[grade.id];
  }

  // ---------------------------------------------------------------- photos
  // A graded copy of a photo, cached per photo id + grade, capped at 1200 px
  // on its long side so grading stays fast at export size.
  var gradedCache = {};
  function gradedPhoto(photoId, img, grade) {
    var key = photoId + '|' + grade.id;
    if (gradedCache[key]) return gradedCache[key];
    var maxSide = 1200;
    var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    var w = Math.max(2, Math.round(img.naturalWidth * scale));
    var h = Math.max(2, Math.round(img.naturalHeight * scale));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    var image = ctx.getImageData(0, 0, w, h);
    var data = image.data;
    var lut = gradeLut(grade);
    for (var i = 0; i < data.length; i += 4) {
      var lum = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
      var c = lut[lum];
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
    ctx.putImageData(image, 0, 0);
    gradedCache[key] = canvas;
    return canvas;
  }

  // Draws a photo cover-fitting a rect, with per-panel pan and zoom.
  function drawCoverFit(ctx, img, x, y, w, h, zoom, panX, panY) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var scale = Math.max(w / iw, h / ih) * (zoom || 1);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = x + (w - dw) / 2 + (panX || 0) * w * 0.45;
    var dy = y + (h - dh) / 2 + (panY || 0) * h * 0.45;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // ---------------------------------------------------------------- layouts
  // Every layout is a function of the cover size returning panel rects
  // (fractions of width/height, plus an optional rotation) and a title rect.
  // Panels are drawn in order; the title block is drawn last, on top.
  function rect(x, y, w, h, rot) {
    return { x: x, y: y, w: w, h: h, rot: rot || 0 };
  }

  var LAYOUTS = [
    {
      id: 'vice-grid',
      name: 'Vice Grid',
      panelCount: 8,
      geometry: function (W, H) {
        var gap = 0.014 * Math.min(W, H);
        var cw = (W - gap * 4) / 3;
        var ch = (H - gap * 4) / 3;
        var panels = [];
        var slots = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
        for (var i = 0; i < slots.length; i++) {
          panels.push(rect(gap + slots[i][0] * (cw + gap), gap + slots[i][1] * (ch + gap), cw, ch));
        }
        return {
          panels: panels,
          title: rect(gap + cw + gap, gap + ch + gap, cw, ch),
          background: 'sky',
        };
      },
    },
    {
      id: 'hero-three',
      name: 'Hero & Three',
      panelCount: 4,
      geometry: function (W, H) {
        var gap = 0.014 * Math.min(W, H);
        var heroW = W * 0.66 - gap;
        var sideX = W * 0.66 + gap / 2;
        var sideW = W - sideX - gap;
        var sh = (H - gap * 4) / 3;
        return {
          panels: [
            rect(gap, gap, heroW, H - gap * 2),
            rect(sideX, gap, sideW, sh),
            rect(sideX, gap * 2 + sh, sideW, sh),
            rect(sideX, gap * 3 + sh * 2, sideW, sh),
          ],
          title: rect(gap * 2, H - gap * 2 - H * 0.2, heroW - gap * 2, H * 0.2),
          background: 'sky',
        };
      },
    },
    {
      id: 'full-bleed',
      name: 'Full Bleed',
      panelCount: 1,
      geometry: function (W, H) {
        return {
          panels: [rect(0, 0, W, H)],
          title: rect(W * 0.05, H - H * 0.32, W * 0.82, H * 0.26),
          background: 'photo',
        };
      },
    },
    {
      id: 'tilted',
      name: 'Tilted Snapshots',
      panelCount: 3,
      geometry: function (W, H) {
        var pw = W * 0.42;
        var ph = H * 0.52;
        return {
          panels: [
            rect(W * 0.05, H * 0.3, pw, ph, -6),
            rect(W * 0.3, H * 0.24, pw, ph, 2),
            rect(W * 0.55, H * 0.32, pw, ph, 6),
          ],
          title: rect(W * 0.08, H * 0.04, W * 0.84, H * 0.17),
          background: 'sky',
        };
      },
    },
    {
      id: 'split-duo',
      name: 'Split Duo',
      panelCount: 2,
      geometry: function (W, H) {
        var gap = 0.014 * Math.min(W, H);
        return {
          panels: [rect(gap, gap, W / 2 - gap * 1.5, H - gap * 2), rect(W / 2 + gap / 2, gap, W / 2 - gap * 1.5, H - gap * 2)],
          title: rect(W * 0.12, H * 0.42, W * 0.76, H * 0.17),
          background: 'sky',
        };
      },
    },
    {
      id: 'film-strip',
      name: 'Film Strip',
      panelCount: 5,
      geometry: function (W, H) {
        var gap = 0.014 * Math.min(W, H);
        var heroH = H * 0.6 - gap;
        var stripY = H * 0.6 + gap;
        var stripH = H - stripY - gap;
        var sw = (W - gap * 5) / 4;
        var panels = [rect(gap, gap, W - gap * 2, heroH)];
        for (var i = 0; i < 4; i++) panels.push(rect(gap + i * (sw + gap), stripY, sw, stripH));
        return {
          panels: panels,
          title: rect(gap * 2, gap * 2, W * 0.6, H * 0.16),
          background: 'sky',
        };
      },
    },
  ];

  function layoutById(id) {
    for (var i = 0; i < LAYOUTS.length; i++) if (LAYOUTS[i].id === id) return LAYOUTS[i];
    return LAYOUTS[0];
  }

  // ---------------------------------------------------------------- drawing
  function drawSkyBackground(ctx, W, H, grade) {
    var stops = grade.stops;
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, stops[0][1]);
    sky.addColorStop(0.45, stops[1][1]);
    sky.addColorStop(0.75, stops[2][1]);
    sky.addColorStop(1, stops[3][1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // Low sun glow on the horizon.
    var sunX = W * 0.72;
    var sunY = H * 0.62;
    var glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(W, H) * 0.45);
    glow.addColorStop(0, stops[4][1]);
    glow.addColorStop(0.35, stops[3][1]);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    // Palm silhouettes along the bottom edge.
    ctx.fillStyle = 'rgba(8,4,18,0.5)';
    var baseY = H;
    for (var i = 0; i < 7; i++) {
      var px = (i / 6) * W + (i % 2 === 0 ? W * 0.02 : -W * 0.02);
      var ph = H * (0.05 + (i % 3) * 0.02);
      ctx.beginPath();
      ctx.moveTo(px - W * 0.012, baseY);
      ctx.quadraticCurveTo(px - W * 0.02, baseY - ph * 0.7, px, baseY - ph);
      ctx.quadraticCurveTo(px + W * 0.02, baseY - ph * 0.7, px + W * 0.012, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawHalftoneBlock(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(10,5,22,0.88)';
    ctx.fillRect(x, y, w, h);
    var gap = Math.max(9, Math.min(16, w / 34));
    ctx.fillStyle = 'rgba(255,122,61,0.55)';
    for (var yy = y + gap / 2; yy < y + h; yy += gap) {
      for (var xx = x + gap / 2; xx < x + w; xx += gap) {
        var t = ((xx - x) / w) * 0.65 + ((yy - y) / h) * 0.35;
        var r = 0.8 + t * gap * 0.22;
        ctx.beginPath();
        ctx.arc(xx, yy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.strokeRect(x, y, w, h);
  }

  // Shrinks the font until the text fits maxWidth. Leaves ctx.font and
  // ctx.letterSpacing set to the fitted values, so the caller draws at once.
  // useSpacing adds a little tracking (Anton titles only, never script).
  function fitFont(ctx, text, maxWidth, startPx, family, useSpacing) {
    var px = startPx;
    var spacing = 0;
    while (px > 10) {
      ctx.font = px + 'px ' + family;
      spacing = useSpacing ? Math.max(1, Math.round(px * 0.02)) : 0;
      try { ctx.letterSpacing = spacing + 'px'; } catch (e) { /* older canvas */ }
      var w = ctx.measureText(text).width + spacing * Math.max(0, text.length - 1);
      if (w <= maxWidth) break;
      px -= 1;
    }
    return px;
  }

  function drawTitleBlock(ctx, titleRect, state, W, H) {
    var x = titleRect.x;
    var y = titleRect.y;
    var w = titleRect.w;
    var h = titleRect.h;
    drawHalftoneBlock(ctx, x, y, w, h);
    var pad = Math.max(10, w * 0.05);
    var innerW = w - pad * 2;
    var title = (state.title || 'VICE CITY').toUpperCase();
    var titlePx = fitFont(ctx, title, innerW, Math.min(h * 0.42, w * 0.16), 'Anton, sans-serif', true);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    var grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, '#ffd166');
    grad.addColorStop(0.5, '#ff7a3d');
    grad.addColorStop(1, '#ff2e88');
    ctx.fillStyle = grad;
    ctx.fillText(title, x + pad, y + h * 0.52);
    if (state.subtitle) {
      fitFont(ctx, state.subtitle, innerW, Math.min(h * 0.2, w * 0.07), 'Pacifico, cursive', false);
      ctx.fillStyle = '#ffe66d';
      ctx.fillText(state.subtitle, x + pad, y + h * 0.86);
    }
    var eyePx = Math.max(11, Math.min(h * 0.09, w * 0.035));
    ctx.font = eyePx + 'px "Bebas Neue", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('GTA VI  •  LEONIDA  •  VICE CITY', x + pad, y + h * 0.16);
  }

  function drawRibbon(ctx, W, H, text) {
    if (!text) return;
    var size = Math.min(W, H) * 0.085;
    var cx = W - size * 0.62;
    var cy = size * 0.62;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ff2e88';
    ctx.fillRect(-size * 1.15, -size * 0.32, size * 2.3, size * 0.64);
    ctx.fillStyle = '#ffffff';
    ctx.font = Math.round(size * 0.3) + 'px "Bebas Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), 0, size * 0.02);
    ctx.restore();
  }

  var grainTile = null;
  function grainPattern(ctx) {
    if (grainTile) return grainTile;
    var tile = document.createElement('canvas');
    tile.width = 140;
    tile.height = 140;
    var g = tile.getContext('2d');
    var image = g.createImageData(140, 140);
    for (var i = 0; i < image.data.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
    g.putImageData(image, 0, 0);
    grainTile = ctx.createPattern(tile, 'repeat');
    return grainTile;
  }

  function drawGrainAndVignette(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    var vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(5,2,12,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  // Renders one cover into a canvas of W x H pixels.
  // state: { layout, grade, title, subtitle, ribbon, grain, vignette,
  //          panels: [{ photo, zoom, panX, panY }] }
  // photos: a map from photo id to a loaded HTMLImageElement (or canvas).
  // opts: { highlight: panelIndex | -1 } draws a dashed outline in the editor.
  function renderCover(canvas, state, photos, opts) {
    var W = canvas.width;
    var H = canvas.height;
    var ctx = canvas.getContext('2d');
    var layout = layoutById(state.layout);
    var grade = gradeById(state.grade);
    var geo = layout.geometry(W, H);
    if (geo.background === 'sky') drawSkyBackground(ctx, W, H, grade);
    else ctx.fillStyle = '#160a2e', ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < geo.panels.length; i++) {
      var p = geo.panels[i];
      var slot = state.panels[i] || {};
      var img = photos[slot.photo];
      var x = p.x * (geo.background === 'sky' ? 1 : 1);
      var px = p.x;
      var py = p.y;
      var pw = p.w;
      var ph = p.h;
      ctx.save();
      if (p.rot) {
        ctx.translate(px + pw / 2, py + ph / 2);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.translate(-pw / 2, -ph / 2);
        px = 0;
        py = 0;
      }
      if (layout.id === 'tilted') {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = Math.max(8, W * 0.015);
        ctx.shadowOffsetY = Math.max(4, H * 0.008);
        ctx.fillStyle = '#fdf6ec';
        ctx.fillRect(px - pw * 0.03, py - ph * 0.03, pw * 1.06, ph * 1.12);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      if (img) {
        var graded = gradedPhoto(slot.photo, img, grade);
        drawCoverFit(ctx, graded, px, py, pw, ph, slot.zoom || 1, slot.panX || 0, slot.panY || 0);
      } else {
        ctx.fillStyle = '#2a1548';
        ctx.fillRect(px, py, pw, ph);
      }
      ctx.restore();
      // Panel frame.
      ctx.save();
      if (p.rot) {
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.translate(-p.w / 2, -p.h / 2);
        ctx.strokeStyle = layout.id === 'tilted' ? 'rgba(0,0,0,0)' : 'rgba(5,2,12,0.85)';
        ctx.lineWidth = Math.max(2, W * 0.002);
        ctx.strokeRect(0, 0, p.w, p.h);
      } else {
        ctx.strokeStyle = 'rgba(5,2,12,0.85)';
        ctx.lineWidth = Math.max(2, W * 0.002);
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      }
      ctx.restore();
      if (opts && opts.highlight === i) {
        ctx.save();
        ctx.setLineDash([12, 8]);
        ctx.strokeStyle = '#ffe66d';
        ctx.lineWidth = Math.max(3, W * 0.004);
        ctx.strokeRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
        ctx.restore();
      }
    }
    drawTitleBlock(ctx, geo.title, state, W, H);
    if (state.ribbon) drawRibbon(ctx, W, H, state.ribbon);
    if (state.grain) drawGrainAndVignette(ctx, W, H);
    else if (state.vignette) {
      var vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(5,2,12,0.42)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    }
    return canvas;
  }

  // The panel rects of the current layout, in cover pixels (for hit-testing).
  function panelRects(state, W, H) {
    var geo = layoutById(state.layout).geometry(W, H);
    return geo.panels.map(function (p) {
      return { x: p.x, y: p.y, w: p.w, h: p.h, rot: p.rot || 0 };
    });
  }

  // A fresh default state for a layout, filled with the sample photos.
  function defaultState(layoutId, sampleIds) {
    var layout = layoutById(layoutId || 'vice-grid');
    var panels = [];
    for (var i = 0; i < layout.panelCount; i++) {
      panels.push({ photo: sampleIds[i % sampleIds.length], zoom: 1, panX: 0, panY: 0 });
    }
    return {
      layout: layout.id,
      grade: 'sunset',
      title: 'Sunset Heist',
      subtitle: 'welcome back to vice city',
      ribbon: 'Launch Week',
      grain: true,
      vignette: true,
      panels: panels,
    };
  }

  return {
    GRADES: GRADES,
    LAYOUTS: LAYOUTS,
    layoutById: layoutById,
    gradeById: gradeById,
    renderCover: renderCover,
    panelRects: panelRects,
    defaultState: defaultState,
  };
})();
