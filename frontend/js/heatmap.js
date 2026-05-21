// =============================================
// TRUTHLENS — Forensic Heatmap Engine
// Real pixel-level forensic analysis:
//   1. Error Level Analysis (ELA)
//   2. Noise Pattern Consistency
//   3. Sobel Edge Anomaly Detection
// =============================================

// === Heatmap State ===
var _hmOpacity  = 0.55;
var _hmVisible  = true;
var _hmCanvas   = null;
var _hmOrigCanvas = null;
var _hmHeatImg  = null;
var _hmAnalysis = null;

// ─────────────────────────────────────────────
// IMAGE LOADER
// ─────────────────────────────────────────────
function loadImageForAnalysis(file) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function() { resolve(img); };
    img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

// ─────────────────────────────────────────────
// 1. ERROR LEVEL ANALYSIS (ELA)
// Detects regions re-encoded at different quality.
// Works best for JPEG. High ELA variance = manipulation.
// ─────────────────────────────────────────────
function performELAAnalysis(canvas, ctx) {
  var w = canvas.width, h = canvas.height;
  var orig = ctx.getImageData(0, 0, w, h);
  var jpegUrl = canvas.toDataURL('image/jpeg', 0.70);

  return new Promise(function(resolve) {
    var reImg = new Image();
    reImg.onload = function() {
      var tc = document.createElement('canvas');
      tc.width = w; tc.height = h;
      var tctx = tc.getContext('2d');
      tctx.drawImage(reImg, 0, 0);
      var recomp = tctx.getImageData(0, 0, w, h);

      var rawMap = new Float32Array(w * h);
      var total = 0, maxVal = 0;

      for (var i = 0; i < orig.data.length; i += 4) {
        var diff = (
          Math.abs(orig.data[i]     - recomp.data[i])   +
          Math.abs(orig.data[i + 1] - recomp.data[i + 1]) +
          Math.abs(orig.data[i + 2] - recomp.data[i + 2])
        ) / 3;
        rawMap[i >> 2] = diff;
        total += diff;
        if (diff > maxVal) maxVal = diff;
      }

      var avg = total / rawMap.length;
      var variance = 0;
      for (var j = 0; j < rawMap.length; j++) variance += (rawMap[j] - avg) * (rawMap[j] - avg);
      var std = Math.sqrt(variance / rawMap.length);

      // Normalize map  (cap at 50% of max to amplify mid-range differences)
      var normCap = maxVal * 0.5 || 1;
      var normalizedMap = new Float32Array(w * h);
      for (var k = 0; k < rawMap.length; k++) {
        normalizedMap[k] = Math.min(rawMap[k] / normCap, 1);
      }

      // Score calibration:
      //   Natural JPEG: avg ≈ 2–8, std ≈ 1–4  → score ≈ 10–35
      //   Manipulated:  avg > 14, std > 10     → score ≈ 60–100
      var score = Math.min(100, Math.max(0, Math.round((avg / 12) * 40 + (std / 10) * 40)));

      resolve({ map: normalizedMap, score: score, avg: avg, std: std, maxVal: maxVal });
    };
    reImg.src = jpegUrl;
  });
}

// ─────────────────────────────────────────────
// 2. NOISE PATTERN CONSISTENCY
// Calculates per-block luminance variance.
// AI-generated faces → unnaturally smooth (low local variance).
// Composited images  → patchwork noise (high inter-block variance).
// ─────────────────────────────────────────────
function analyzeNoisePatterns(imageData, w, h) {
  return new Promise(function(resolve) {
    var data = imageData.data;
    var BLOCK = 6;
    var rawMap   = new Float32Array(w * h);
    var blockArr = [];

    for (var by = 0; by < h; by += BLOCK) {
      for (var bx = 0; bx < w; bx += BLOCK) {
        var lums = [];
        for (var dy = 0; dy < BLOCK && by + dy < h; dy++) {
          for (var dx = 0; dx < BLOCK && bx + dx < w; dx++) {
            var idx = ((by + dy) * w + (bx + dx)) * 4;
            lums.push(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
          }
        }
        var mean = lums.reduce(function(a, b) { return a + b; }, 0) / lums.length;
        var variance = lums.reduce(function(s, v) { return s + (v - mean) * (v - mean); }, 0) / lums.length;
        var noise = Math.sqrt(variance);
        blockArr.push(noise);

        for (var dy2 = 0; dy2 < BLOCK && by + dy2 < h; dy2++) {
          for (var dx2 = 0; dx2 < BLOCK && bx + dx2 < w; dx2++) {
            rawMap[(by + dy2) * w + (bx + dx2)] = noise;
          }
        }
      }
    }

    var gMean = blockArr.reduce(function(a, b) { return a + b; }, 0) / blockArr.length;
    var gVar  = blockArr.reduce(function(s, v) { return s + (v - gMean) * (v - gMean); }, 0) / blockArr.length;
    var gStd  = Math.sqrt(gVar);
    var cv    = gMean > 0 ? gStd / gMean : 0;   // Coefficient of variation

    var maxNoise = Math.max.apply(null, blockArr);
    if (maxNoise === 0) maxNoise = 1;
    var normalizedMap = new Float32Array(w * h);
    var smoothCount = 0;

    for (var i = 0; i < rawMap.length; i++) {
      // Smooth (low-noise) regions score HIGH — they're the suspicious ones
      normalizedMap[i] = 1 - Math.min(rawMap[i] / maxNoise, 1);
      if (rawMap[i] < gMean * 0.25) smoothCount++;
    }

    var smoothRatio = smoothCount / rawMap.length;
    // Natural:     cv ≈ 0.3–0.6, smoothRatio ≈ 0.10–0.20 → score ≈ 25–40
    // AI-generated: cv ≈ 0.7–1.2, smoothRatio ≈ 0.30–0.55 → score ≈ 65–100
    var score = Math.min(100, Math.max(0, Math.round(cv * 60 + smoothRatio * 70)));

    resolve({ map: normalizedMap, score: score, cv: cv, smoothRatio: smoothRatio, gMean: gMean, gStd: gStd });
  });
}

// ─────────────────────────────────────────────
// 3. SOBEL EDGE ANOMALY DETECTION
// Finds unnaturally abrupt gradient transitions.
// Face compositing/splicing → sharp seam boundaries.
// ─────────────────────────────────────────────
function detectEdgeAnomaliesAnalysis(imageData, w, h) {
  return new Promise(function(resolve) {
    var data = imageData.data;
    var rawMap = new Float32Array(w * h);
    var Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    var Gy = [-1, -2, -1,  0, 0, 0,  1, 2, 1];
    var maxG = 0, totalG = 0;

    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var gx = 0, gy = 0;
        for (var ky = -1; ky <= 1; ky++) {
          for (var kx = -1; kx <= 1; kx++) {
            var ii = ((y + ky) * w + (x + kx)) * 4;
            var lum = 0.299 * data[ii] + 0.587 * data[ii + 1] + 0.114 * data[ii + 2];
            var ki  = (ky + 1) * 3 + (kx + 1);
            gx += lum * Gx[ki];
            gy += lum * Gy[ki];
          }
        }
        var g = Math.sqrt(gx * gx + gy * gy);
        rawMap[y * w + x] = g;
        totalG += g;
        if (g > maxG) maxG = g;
      }
    }

    var avgG = totalG / (w * h);
    var threshold = avgG * 3.5;
    var abruptCount = 0;
    var normCap = maxG * 0.5 || 1;
    var normalizedMap = new Float32Array(w * h);

    for (var i = 0; i < rawMap.length; i++) {
      normalizedMap[i] = Math.min(rawMap[i] / normCap, 1);
      if (rawMap[i] > threshold) abruptCount++;
    }

    var abruptRatio = abruptCount / rawMap.length;
    // Natural:      abruptRatio ≈ 0.02–0.05 → score ≈ 8–20
    // Composited:   abruptRatio ≈ 0.12–0.25 → score ≈ 48–100
    var score = Math.min(100, Math.max(0, Math.round(abruptRatio * 400)));

    resolve({ map: normalizedMap, score: score, abruptRatio: abruptRatio, avgG: avgG });
  });
}

// ─────────────────────────────────────────────
// HEATMAP INIT — called from detector.js
// ─────────────────────────────────────────────
function initForensicHeatmap(result, file) {
  var section = document.getElementById('heatmapSection');
  if (!section) return;

  if (!file || !file.type.startsWith('image')) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  document.getElementById('heatmapLoading').style.display  = 'flex';
  document.getElementById('heatmapContent').style.display  = 'none';

  // Scroll into view
  setTimeout(function() {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 400);

  var analysis = result._analysis;
  if (!analysis) { section.style.display = 'none'; return; }

  loadImageForAnalysis(file).then(function(img) {
    _hmAnalysis = analysis;
    document.getElementById('heatmapLoading').style.display = 'none';
    document.getElementById('heatmapContent').style.display = 'block';

    renderHeatmapCanvas(img, analysis);
    renderForensicZones(analysis, result.score);
    renderDNAFingerprint(analysis);

    setTimeout(function() {
      section.querySelectorAll('.fade-in').forEach(function(el) { el.classList.add('visible'); });
    }, 150);
  }).catch(function(err) {
    console.error('[Heatmap]', err);
    section.style.display = 'none';
  });
}

// Reset state (called from resetDetector)
function resetHeatmap() {
  _hmCanvas = null; _hmOrigCanvas = null;
  _hmHeatImg = null; _hmAnalysis = null;
  _hmOpacity = 0.55; _hmVisible = true;
  hideHeatmapTooltip();
}

// ─────────────────────────────────────────────
// CANVAS RENDERING
// ─────────────────────────────────────────────
function renderHeatmapCanvas(img, analysis) {
  var container = document.getElementById('heatmapCanvasContainer');
  if (!container) return;
  container.innerHTML = '';

  var maxW  = container.clientWidth || 700;
  var scale = Math.min(1, maxW / img.width);
  var dispW = Math.max(1, Math.floor(img.width  * scale));
  var dispH = Math.max(1, Math.floor(img.height * scale));

  var canvas = document.createElement('canvas');
  canvas.id = 'theHeatmapCanvas';
  canvas.width  = dispW;
  canvas.height = dispH;
  canvas.style.cssText = 'display:block;width:100%;border-radius:12px;cursor:crosshair;';
  container.appendChild(canvas);
  _hmCanvas = canvas;

  // Save original image to offscreen canvas
  _hmOrigCanvas = document.createElement('canvas');
  _hmOrigCanvas.width = dispW; _hmOrigCanvas.height = dispH;
  _hmOrigCanvas.getContext('2d').drawImage(img, 0, 0, dispW, dispH);

  // Pre-build full-res heatmap
  _hmHeatImg = buildHeatmapImage(analysis, dispW, dispH);

  var ctx = canvas.getContext('2d');
  ctx.drawImage(_hmOrigCanvas, 0, 0);

  // Animated scan reveal
  animateScanReveal(ctx, dispW, dispH);

  // Hover tooltip
  canvas.addEventListener('mousemove', function(e) {
    var rect = canvas.getBoundingClientRect();
    var sx = dispW / rect.width;
    var sy = dispH / rect.height;
    var cx = (e.clientX - rect.left) * sx;
    var cy = (e.clientY - rect.top)  * sy;
    handleHeatmapHover(cx, cy, analysis, dispW, dispH, e.clientX, e.clientY);
  });
  canvas.addEventListener('mouseleave', hideHeatmapTooltip);
}

// Build the heatmap image scaled to display size
function buildHeatmapImage(analysis, dispW, dispH) {
  var mw = analysis.w, mh = analysis.h;
  var map = analysis.combined;

  var raw = document.createElement('canvas');
  raw.width = mw; raw.height = mh;
  var rctx = raw.getContext('2d');
  var imgData = rctx.createImageData(mw, mh);

  for (var i = 0; i < map.length; i++) {
    var c = valueToHeatColor(map[i]);
    imgData.data[i * 4]     = c.r;
    imgData.data[i * 4 + 1] = c.g;
    imgData.data[i * 4 + 2] = c.b;
    imgData.data[i * 4 + 3] = Math.round(map[i] * 200 + 30);  // min alpha 30
  }
  rctx.putImageData(imgData, 0, 0);

  var disp = document.createElement('canvas');
  disp.width = dispW; disp.height = dispH;
  var dctx = disp.getContext('2d');
  dctx.imageSmoothingEnabled = true;
  dctx.imageSmoothingQuality = 'high';
  dctx.drawImage(raw, 0, 0, dispW, dispH);
  return disp;
}

// Animated scan-line reveal
function animateScanReveal(ctx, dispW, dispH) {
  var duration = 2400;
  var start = performance.now();

  function frame(now) {
    var progress = Math.min((now - start) / duration, 1);
    var scanY = Math.floor(progress * dispH);

    ctx.drawImage(_hmOrigCanvas, 0, 0);

    if (_hmVisible && _hmHeatImg) {
      ctx.globalAlpha = _hmOpacity;
      ctx.drawImage(_hmHeatImg, 0, 0, dispW, scanY, 0, 0, dispW, scanY);
      ctx.globalAlpha = 1;
    }

    if (progress < 1) {
      // Glowing cyan scan line
      var grad = ctx.createLinearGradient(0, Math.max(0, scanY - 8), 0, Math.min(dispH, scanY + 8));
      grad.addColorStop(0,   'rgba(0,229,255,0)');
      grad.addColorStop(0.5, 'rgba(0,229,255,0.95)');
      grad.addColorStop(1,   'rgba(0,229,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, Math.max(0, scanY - 8), dispW, 16);
      requestAnimationFrame(frame);
    }
  }
  requestAnimationFrame(frame);
}

// Map 0-1 value to RGB heatmap color
function valueToHeatColor(val) {
  if (val < 0.25) return { r: 0,   g: 220, b: 80  }; // green  — authentic
  if (val < 0.45) return { r: 100, g: 210, b: 0   }; // yellow-green
  if (val < 0.62) return { r: 255, g: 185, b: 0   }; // yellow — suspicious
  if (val < 0.78) return { r: 255, g: 85,  b: 0   }; // orange — manipulated
  return              { r: 255, g: 20,  b: 20  }; // red    — high manipulation
}

// ─────────────────────────────────────────────
// HOVER TOOLTIP
// ─────────────────────────────────────────────
function handleHeatmapHover(cx, cy, analysis, dispW, dispH, clientX, clientY) {
  if (!analysis.combined) return;
  var ax  = Math.floor((cx / dispW) * analysis.w);
  var ay  = Math.floor((cy / dispH) * analysis.h);
  var idx = Math.min(ay * analysis.w + ax, analysis.combined.length - 1);
  if (idx < 0) return;

  var val      = analysis.combined[idx];
  var elaVal   = (analysis.ela   && analysis.ela.map)   ? (analysis.ela.map[idx]   || 0) : 0;
  var noiseVal = (analysis.noise && analysis.noise.map) ? (analysis.noise.map[idx] || 0) : 0;
  var edgeVal  = (analysis.edges && analysis.edges.map) ? (analysis.edges.map[idx] || 0) : 0;

  var level = val < 0.25 ? 'Authentic' : val < 0.50 ? 'Low Risk' : val < 0.70 ? 'Suspicious' : 'Likely Manipulated';
  var color = val < 0.25 ? '#00dc50'   : val < 0.50 ? '#84cc16' : val < 0.70 ? '#fbbf24'    : '#f43f5e';

  var maxSig = Math.max(elaVal, noiseVal, edgeVal);
  var issue;
  if (maxSig < 0.15)                          issue = 'Natural pixel structure — no anomalies detected here';
  else if (maxSig === elaVal && elaVal > 0.3) issue = 'JPEG re-encoding artifact — region may have been selectively edited';
  else if (maxSig === noiseVal && noiseVal > 0.3) issue = 'Unnaturally smooth texture — possible AI-synthesized or airbrushed area';
  else if (maxSig === edgeVal  && edgeVal  > 0.3) issue = 'Abrupt edge boundary — possible face compositing or splicing';
  else                                         issue = 'Minor inconsistencies in this region';

  showHeatmapTooltip(clientX, clientY, { level: level, color: color, issue: issue, elaVal: elaVal, noiseVal: noiseVal, edgeVal: edgeVal });
}

function showHeatmapTooltip(x, y, info) {
  var tip = document.getElementById('heatmapTooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'heatmapTooltip';
    document.body.appendChild(tip);
  }
  var clampX = Math.min(x + 18, window.innerWidth  - 255);
  var clampY = Math.max(y - 10, 10);

  tip.innerHTML =
    '<div class="htip-level" style="color:' + info.color + '">● ' + info.level + '</div>' +
    '<div class="htip-issue">' + info.issue + '</div>' +
    '<div class="htip-bars">' +
      _htipBar('ELA',   '#00e5ff', info.elaVal)   +
      _htipBar('Noise', '#a855f7', info.noiseVal) +
      _htipBar('Edge',  '#f59e0b', info.edgeVal)  +
    '</div>';

  tip.style.left    = clampX + 'px';
  tip.style.top     = clampY + 'px';
  tip.style.display = 'block';
}

function _htipBar(label, color, val) {
  var pct = Math.round(val * 100);
  return '<div class="htip-bar-row">' +
    '<span class="htip-label">' + label + '</span>' +
    '<div class="htip-bar-bg"><div class="htip-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
    '<span class="htip-pct">' + pct + '%</span>' +
  '</div>';
}

function hideHeatmapTooltip() {
  var tip = document.getElementById('heatmapTooltip');
  if (tip) tip.style.display = 'none';
}

// ─────────────────────────────────────────────
// REDRAW (after opacity/toggle changes)
// ─────────────────────────────────────────────
function redrawHeatmap() {
  if (!_hmCanvas || !_hmOrigCanvas || !_hmHeatImg) return;
  var ctx = _hmCanvas.getContext('2d');
  ctx.drawImage(_hmOrigCanvas, 0, 0);
  if (_hmVisible) {
    ctx.globalAlpha = _hmOpacity;
    ctx.drawImage(_hmHeatImg, 0, 0, _hmCanvas.width, _hmCanvas.height);
    ctx.globalAlpha = 1;
  }
}

// ─────────────────────────────────────────────
// CONTROLS (called from HTML attributes)
// ─────────────────────────────────────────────
function toggleHeatmap() {
  _hmVisible = !_hmVisible;
  var btn = document.getElementById('toggleHeatmapBtn');
  if (btn) btn.textContent = _hmVisible ? '👁️ Hide Heatmap' : '👁️ Show Heatmap';
  redrawHeatmap();
}

function updateHeatmapOpacity(val) {
  _hmOpacity = Number(val) / 100;
  var span = document.getElementById('opacityValue');
  if (span) span.textContent = val + '%';
  redrawHeatmap();
}

function downloadAnnotatedImage() {
  if (!_hmCanvas) return;
  var a = document.createElement('a');
  a.href = _hmCanvas.toDataURL('image/png');
  a.download = 'truthlens-forensic-' + Date.now() + '.png';
  a.click();
  if (typeof showToast === 'function') showToast('Annotated image downloaded!', 'success');
}

// ─────────────────────────────────────────────
// FORENSIC ZONES PANEL
// ─────────────────────────────────────────────
function renderForensicZones(analysis, fakeScore) {
  var el = document.getElementById('forensicZones');
  if (!el) return;

  var elaS   = (analysis.ela   && typeof analysis.ela.score   === 'number') ? analysis.ela.score   : 0;
  var noiseS = (analysis.noise && typeof analysis.noise.score === 'number') ? analysis.noise.score : 0;
  var edgeS  = (analysis.edges && typeof analysis.edges.score === 'number') ? analysis.edges.score : 0;

  var elaAvg    = analysis.ela   && analysis.ela.avg   != null ? analysis.ela.avg.toFixed(1)         : '–';
  var elaStd    = analysis.ela   && analysis.ela.std   != null ? analysis.ela.std.toFixed(1)         : '–';
  var noiseCv   = analysis.noise && analysis.noise.cv  != null ? analysis.noise.cv.toFixed(2)        : '–';
  var smoothPct = analysis.noise && analysis.noise.smoothRatio != null ? Math.round(analysis.noise.smoothRatio * 100) : '–';
  var abruptPct = analysis.edges && analysis.edges.abruptRatio != null ? (analysis.edges.abruptRatio * 100).toFixed(1) : '–';

  function badge(score, highLabel, midLabel, lowLabel) {
    return score > 55 ? highLabel : score > 30 ? midLabel : lowLabel;
  }
  function bcolor(score) {
    return score > 55 ? '#f43f5e' : score > 30 ? '#fbbf24' : '#00dc50';
  }

  var zones = [
    {
      icon: '🔬', name: 'Error Level Analysis (ELA)',
      pct: elaS, color: bcolor(elaS), badge: badge(elaS, 'HIGH RISK', 'MODERATE', 'NORMAL'),
      detail: elaS > 55
        ? 'Significant JPEG re-encoding anomalies (avg: ' + elaAvg + ', std: ' + elaStd + '). Different regions were encoded at different quality levels — a clear sign of selective editing or content splicing.'
        : elaS > 30
        ? 'Minor compression inconsistencies found (avg: ' + elaAvg + '). Could indicate format conversion or light editing.'
        : 'JPEG compression is uniform and consistent (avg: ' + elaAvg + '). No re-encoding artifacts detected.'
    },
    {
      icon: '🧬', name: 'Noise & Texture Consistency',
      pct: noiseS, color: bcolor(noiseS), badge: badge(noiseS, 'HIGH RISK', 'MODERATE', 'NATURAL'),
      detail: noiseS > 55
        ? 'High inter-region texture inconsistency (CV: ' + noiseCv + '). ' + smoothPct + '% of the image shows unnaturally smooth areas — a hallmark of AI-generated faces or heavy retouching.'
        : noiseS > 30
        ? 'Some regions appear smoother than expected (CV: ' + noiseCv + '). May be from beauty filters or compression.'
        : 'Natural noise distribution throughout (CV: ' + noiseCv + '). Texture variation is consistent with real photography.'
    },
    {
      icon: '📐', name: 'Edge Boundary Analysis',
      pct: edgeS, color: bcolor(edgeS), badge: badge(edgeS, 'ANOMALOUS', 'IRREGULAR', 'NATURAL'),
      detail: edgeS > 55
        ? abruptPct + '% abrupt edge transitions found. Unnatural sharp seams in smooth areas strongly suggest face compositing, object splicing, or background replacement.'
        : edgeS > 30
        ? 'Some edges are slightly abrupt (' + abruptPct + '%) but within plausible range for real photographs.'
        : 'Edge boundaries are naturally integrated (' + abruptPct + '% abrupt). No significant compositing seams detected.'
    }
  ];

  el.innerHTML = zones.map(function(z) {
    return '<div class="fzone-item">' +
      '<div class="fzone-top">' +
        '<div class="fzone-name">' + z.icon + ' ' + z.name + '</div>' +
        '<div class="fzone-badge" style="background:' + z.color + '22;color:' + z.color + ';border-color:' + z.color + '55">' + z.badge + '</div>' +
      '</div>' +
      '<div class="fzone-bar-bg"><div class="fzone-bar-fill" style="width:' + z.pct + '%;background:' + z.color + '"></div></div>' +
      '<div class="fzone-detail">' + z.detail + '</div>' +
    '</div>';
  }).join('');
}

// ─────────────────────────────────────────────
// DNA FINGERPRINT
// A barcode-style visualization of the combined map.
// Every image produces a unique pattern.
// ─────────────────────────────────────────────
function renderDNAFingerprint(analysis) {
  var canvas = document.getElementById('dnaCanvas');
  if (!canvas || !analysis.combined) return;

  var parent = canvas.parentElement;
  var w = canvas.width  = (parent ? parent.clientWidth - 56 : 660);
  var h = canvas.height = 88;
  var ctx = canvas.getContext('2d');
  var BARS = 100;
  var barW = w / BARS;
  var map  = analysis.combined;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, w, h);

  for (var i = 0; i < BARS; i++) {
    var from = Math.floor((i / BARS) * map.length);
    var to   = Math.floor(((i + 1) / BARS) * map.length);
    var sum = 0, cnt = 0;
    for (var j = from; j < to && j < map.length; j++) { sum += map[j]; cnt++; }
    var val = cnt > 0 ? sum / cnt : 0;

    var barH = Math.max(6, val * h * 0.88);
    var c    = valueToHeatColor(val);
    var x    = i * barW;
    var y    = (h - barH) / 2;

    ctx.shadowColor = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
    ctx.shadowBlur  = 7;
    ctx.fillStyle   = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.88)';
    ctx.fillRect(x + 1, y, Math.max(1, barW - 2), barH);
  }
  ctx.shadowBlur = 0;

  // Centre line
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
  ctx.stroke();

  // Entrance animation
  canvas.style.opacity   = '0';
  canvas.style.transform = 'scaleY(0.4)';
  canvas.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  setTimeout(function() {
    canvas.style.opacity   = '1';
    canvas.style.transform = 'scaleY(1)';
  }, 250);
}
