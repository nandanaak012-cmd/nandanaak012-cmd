// =============================================
// TRUTHLENS — Deepfake Detector Logic
// =============================================

// --- State ---
let currentFile = null;
let currentMode = 'upload'; // 'upload' | 'url'
let scanHistory = JSON.parse(localStorage.getItem('tl-history') || '[]');

document.addEventListener('DOMContentLoaded', () => {
  setupInputTabs();
  setupDropzone();
  setupFileInput();
  renderRecentScans();
  handleUrlParams();
});

// ── Build compact share data (encoded into URL) ──
function buildShareData() {
  const score   = document.getElementById('scoreNumber').textContent;
  const verdict = document.getElementById('verdictTitle')?.textContent || 'N/A';
  const fname   = currentFile?.name || 'Unknown file';
  const checks  = Array.from(document.querySelectorAll('.check-item')).map(item => ({
    n: item.querySelector('.check-name')?.textContent   || '',
    s: item.querySelector('.check-status')?.textContent || ''
  }));
  return { score, verdict, fname, checks };
}

// ── Decode & render shared URL ──
function handleUrlParams() {
  const params  = new URLSearchParams(window.location.search);
  const encoded = params.get('r');   // base64 report
  const score   = params.get('score');   // legacy
  const verdict = params.get('verdict'); // legacy

  let data = null;

  if (encoded) {
    try { data = JSON.parse(atob(encoded)); } catch {}
  } else if (score && verdict) {
    data = { score, verdict, fname: 'Shared content', checks: [] };
  }

  if (!data) return;

  const resultsPanel = document.getElementById('resultsPanel');
  const inputCard    = document.getElementById('inputCard');
  if (!resultsPanel || !inputCard) return;

  inputCard.style.display = 'none';
  resultsPanel.style.display = 'flex';

  const s = parseInt(data.score, 10) || 0;
  const verdictKey = data.verdict?.toLowerCase().includes('fake') ? 'fake'
    : data.verdict?.toLowerCase().includes('real') ? 'real' : 'suspicious';

  document.getElementById('scoreNumber').textContent = s;
  setTimeout(() => { document.getElementById('meterNeedle').style.left = s + '%'; }, 300);

  const banner = document.getElementById('verdictBanner');
  if (banner) {
    banner.className = 'verdict-banner ' + verdictKey;
    document.getElementById('verdictIcon').textContent =
      verdictKey === 'real' ? '✅' : verdictKey === 'fake' ? '🚨' : '⚠️';
    document.getElementById('verdictTitle').textContent = data.verdict || 'N/A';
    document.getElementById('verdictSubtitle').textContent =
      verdictKey === 'real'
        ? 'Our analysis didn\'t find significant signs of manipulation.'
        : verdictKey === 'fake'
        ? 'Multiple strong signs of AI manipulation detected.'
        : 'Some warning signs found. Proceed with caution.';
  }

  if (document.getElementById('explanationText')) {
    document.getElementById('explanationText').innerHTML =
      `<p>This result was shared with you via TruthLens.<br>
       File analyzed: <strong>${data.fname}</strong></p>`;
  }

  if (data.checks?.length && document.getElementById('checksGrid')) {
    document.getElementById('checksGrid').innerHTML = data.checks.map(c =>
      `<div class="check-item">
        <div class="check-header">
          <span class="check-name">${c.n}</span>
          <span class="check-status ${c.s?.includes('PASS') ? 'pass' : c.s?.includes('FAIL') ? 'fail' : 'warn'}">${c.s}</span>
        </div>
      </div>`
    ).join('');
  }

  // Add a "shared" badge
  const header = document.querySelector('.detector-header');
  if (header && !document.getElementById('sharedBadge')) {
    const badge = document.createElement('div');
    badge.id = 'sharedBadge';
    badge.style.cssText = 'background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.3);border-radius:8px;padding:10px 18px;font-size:0.88rem;color:var(--accent);text-align:center;margin-bottom:16px;';
    badge.textContent = '🔗 You are viewing a shared TruthLens analysis result';
    header.after(badge);
  }

  window.history.replaceState({}, document.title, window.location.pathname);
}

// ============================
// INPUT TABS
// ============================
function setupInputTabs() {
  const tabs = document.querySelectorAll('.input-tab');
  const panels = document.querySelectorAll('.input-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.dataset.input;
      document.getElementById('panel-' + currentMode).classList.add('active');
    });
  });
}

// ============================
// DROPZONE
// ============================
function setupDropzone() {
  const dz = document.getElementById('dropzone');
  if (!dz) return;

  ['dragenter', 'dragover'].forEach(e => {
    dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.add('drag-over'); });
  });
  ['dragleave', 'drop'].forEach(e => {
    dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.remove('drag-over'); });
  });
  dz.addEventListener('drop', ev => {
    const files = ev.dataTransfer.files;
    if (files.length) handleFile(files[0]);
  });
}

function setupFileInput() {
  const inp = document.getElementById('fileInput');
  if (!inp) return;
  inp.addEventListener('change', () => {
    if (inp.files.length) handleFile(inp.files[0]);
  });
}

function handleFile(file) {
  const allowed = ['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/avi','video/x-msvideo'];
  if (!allowed.some(t => file.type.startsWith(t.split('/')[0]))) {
    showToast('Unsupported file type. Please upload an image or video.', 'error');
    return;
  }
  if (file.size > 100 * 1024 * 1024) {
    showToast('File too large. Max 100MB allowed.', 'error');
    return;
  }
  currentFile = file;
  showFilePreview(file);
}

function showFilePreview(file) {
  const inner = document.getElementById('dropzoneInner');
  const preview = document.getElementById('filePreview');
  const img = document.getElementById('previewImg');
  const vid = document.getElementById('previewVid');
  const nameEl = document.getElementById('fileName');
  const sizeEl = document.getElementById('fileSize');

  inner.style.display = 'none';
  preview.style.display = 'flex';

  const url = URL.createObjectURL(file);
  if (file.type.startsWith('image')) {
    img.src = url; img.style.display = 'block';
    vid.style.display = 'none';
  } else {
    vid.src = url; vid.style.display = 'block';
    img.style.display = 'none';
  }
  nameEl.textContent = file.name;
  sizeEl.textContent = formatBytes(file.size);
}

function removeFile() {
  currentFile = null;
  document.getElementById('dropzoneInner').style.display = 'flex';
  document.getElementById('filePreview').style.display = 'none';
  document.getElementById('fileInput').value = '';
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================
// START ANALYSIS
// ============================
function startAnalysis() {
  if (currentMode === 'upload' && !currentFile) {
    showToast('Please select a file to analyze first.', 'error');
    return;
  }
  if (currentMode === 'url') {
    const url = document.getElementById('urlInput').value.trim();
    if (!url || !url.startsWith('http')) {
      showToast('Please enter a valid URL starting with http(s)://', 'error');
      return;
    }
  }

  // Hide input, show scanning
  document.getElementById('inputCard').style.display = 'none';
  document.getElementById('resultsPanel').style.display = 'none';
  document.getElementById('scanningOverlay').style.display = 'block';

  runScanAnimation().then(() => {
    const result = generateAnalysisResult();
    showResults(result);
    saveToHistory(result);
  });
}

// ============================
// SCAN ANIMATION
// ============================
async function runScanAnimation() {
  const steps = document.querySelectorAll('.scan-step');
  const bar = document.getElementById('scanBar');
  const pct = document.getElementById('scanPercent');

  const totalMs = 4000;
  const stepMs = totalMs / steps.length;

  for (let i = 0; i < steps.length; i++) {
    if (i > 0) steps[i - 1].classList.remove('active');
    if (i > 0) steps[i - 1].classList.add('done');
    steps[i].classList.add('active');
    await animateProgress((i / steps.length) * 100, ((i + 1) / steps.length) * 100, bar, pct, stepMs);
  }
  steps[steps.length - 1].classList.remove('active');
  steps[steps.length - 1].classList.add('done');
  bar.style.width = '100%';
  pct.textContent = '100%';
  await sleep(400);
}

function animateProgress(from, to, bar, pct, duration) {
  return new Promise(resolve => {
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const val = from + (to - from) * p;
      bar.style.width = val + '%';
      pct.textContent = Math.round(val) + '%';
      if (p < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================
// ANALYSIS ENGINE (Simulated)
// ============================
function generateAnalysisResult() {
  // In production this calls backend API
  // Here we simulate based on filename/url patterns and some randomness
  const isUrl = currentMode === 'url';
  const name = isUrl ? document.getElementById('urlInput').value : currentFile?.name || '';

  // Seed some fake patterns
  const lowerName = name.toLowerCase();
  let fakeScore;
  let presetType;

  if (lowerName.includes('fake') || lowerName.includes('deep') || lowerName.includes('edit')) {
    fakeScore = 72 + Math.floor(Math.random() * 25);
    presetType = 'fake';
  } else if (lowerName.includes('real') || lowerName.includes('orig') || lowerName.includes('photo')) {
    fakeScore = 5 + Math.floor(Math.random() * 15);
    presetType = 'real';
  } else {
    fakeScore = Math.floor(Math.random() * 100);
    presetType = fakeScore > 65 ? 'fake' : fakeScore > 40 ? 'suspicious' : 'real';
  }

  const isReal = fakeScore < 40;
  const isFake = fakeScore >= 65;
  const isSus = !isReal && !isFake;

  const checks = generateChecks(fakeScore);
  const metadata = generateMetadata(fakeScore);
  const explanation = generateExplanation(fakeScore, checks);

  return {
    score: fakeScore,
    verdict: presetType,
    isReal, isFake, isSus,
    checks, metadata, explanation,
    timestamp: Date.now(),
    name: isUrl ? shortenUrl(name) : (currentFile?.name || 'Unknown'),
    type: isUrl ? 'url' : (currentFile?.type?.startsWith('video') ? 'video' : 'image'),
    thumbnail: currentMode === 'upload' && currentFile?.type?.startsWith('image')
      ? URL.createObjectURL(currentFile) : null
  };
}

function shortenUrl(url) {
  try { return new URL(url).hostname + '...'; } catch { return url.slice(0, 30) + '...'; }
}

function generateChecks(score) {
  const allChecks = [
    {
      name: 'Eye & Blink Pattern',
      getResult: (s) => s > 60 ? 'fail' : s > 35 ? 'warn' : 'pass',
      details: {
        fail: 'The eyes in this content blink at irregular times and don\'t move naturally. Real people blink about 15–20 times per minute in a specific pattern.',
        warn: 'Eye movement is slightly unusual but not conclusive evidence of manipulation.',
        pass: 'Eye blinking and movement looks natural and consistent with a real person.'
      }
    },
    {
      name: 'Lighting & Shadow Check',
      getResult: (s) => s > 65 ? 'fail' : s > 45 ? 'warn' : 'pass',
      details: {
        fail: 'The light on the face doesn\'t match the background. Shadows fall in the wrong direction, which is a classic sign of a face being pasted onto a different background.',
        warn: 'Lighting is slightly inconsistent but could be due to natural conditions.',
        pass: 'Light and shadows are consistent across the entire image — this looks natural.'
      }
    },
    {
      name: 'Skin Texture Analysis',
      getResult: (s) => s > 55 ? 'fail' : s > 30 ? 'warn' : 'pass',
      details: {
        fail: 'Skin texture is too smooth and perfect in places — real skin has pores and imperfections. AI-generated faces often look "airbrushed."',
        warn: 'Skin texture has some unusual smoothness that could indicate AI processing.',
        pass: 'Skin texture looks natural, with normal variations and imperfections.'
      }
    },
    {
      name: 'Edge & Hair Detection',
      getResult: (s) => s > 58 ? 'fail' : s > 38 ? 'warn' : 'pass',
      details: {
        fail: 'The edges around the hair and ears look blurry or unnatural, especially where they meet the background. This often happens when AI places one face onto another body.',
        warn: 'Some edge areas look slightly soft but this could also be from the camera.',
        pass: 'Hair and edge details look crisp and naturally integrated with the background.'
      }
    },
    {
      name: 'Hidden File Information',
      getResult: (s) => s > 50 ? 'fail' : s > 25 ? 'warn' : 'pass',
      details: {
        fail: 'The hidden data inside this file (called EXIF data) has been removed or modified. Every real photo from a camera or phone contains this data automatically.',
        warn: 'Some hidden file data is missing or unusual — could be due to editing software.',
        pass: 'File contains normal hidden data consistent with a standard camera or smartphone.'
      }
    },
    {
      name: 'Facial Symmetry Check',
      getResult: (s) => s > 62 ? 'fail' : s > 42 ? 'warn' : 'pass',
      details: {
        fail: 'The face is too perfectly symmetrical. Real human faces are always slightly asymmetrical — AI often makes faces more "balanced" than nature does.',
        warn: 'Facial symmetry is higher than average but not definitively artificial.',
        pass: 'Facial features show natural, human-like asymmetry — consistent with a real face.'
      }
    },
  ];

  return allChecks.map(c => {
    const result = c.getResult(score);
    return { name: c.name, status: result, detail: c.details[result] };
  });
}

function generateMetadata(score) {
  const isFake = score > 60;
  return [
    { key: 'Camera Make', val: isFake ? 'Missing ⚠️' : 'Apple iPhone 15', suspicious: isFake, missing: isFake },
    { key: 'Date Created', val: isFake ? 'Removed ⚠️' : new Date(Date.now() - Math.random() * 1e10).toLocaleDateString(), suspicious: false, missing: isFake },
    { key: 'GPS Location', val: isFake ? 'Not present' : 'Redacted (privacy)', suspicious: false, missing: false },
    { key: 'Software Used', val: isFake ? 'FaceSwap AI v2.1 ⚠️' : 'Not edited', suspicious: isFake, missing: false },
    { key: 'Image Size', val: currentFile ? `${(currentFile.size / 1024).toFixed(0)} KB` : 'N/A', suspicious: false, missing: false },
    { key: 'Compression Level', val: isFake ? 'Unusual (94%) ⚠️' : 'Normal (85%)', suspicious: isFake, missing: false },
  ];
}

function generateExplanation(score, checks) {
  const failedChecks = checks.filter(c => c.status === 'fail');
  const warnChecks = checks.filter(c => c.status === 'warn');

  if (score < 25) {
    return `<p>Great news — this content <strong>appears to be genuine</strong>. Our analysis didn't find any major signs of tampering or AI manipulation.</p>
    <p>The lighting, facial features, and hidden file data all look consistent with a real, unedited photo or video. The eye movements appear natural, and the edges of the face blend normally with the background.</p>
    <p>While no detection tool is 100% perfect, we're quite confident this content is authentic. You can likely trust it.</p>`;
  }
  if (score < 45) {
    return `<p>This content <strong>mostly looks real</strong>, but we did find a few small things that caught our attention. This doesn't mean it's fake — it could simply mean the image was edited for color or brightness.</p>
    <p>${warnChecks.length > 0 ? `We noticed some minor issues with: <strong>${warnChecks.map(c => c.name).join(', ')}</strong>. These are worth noting but not alarming on their own.` : ''}</p>
    <p>Our overall assessment is that this is likely genuine content. If you have doubts, consider checking the original source where it was posted.</p>`;
  }
  if (score < 70) {
    return `<p>⚠️ This content has <strong>some suspicious signs</strong> that make us cautious. It could be edited, manipulated, or partially AI-generated.</p>
    <p>Specifically, we found issues with: <strong>${[...failedChecks, ...warnChecks].map(c => c.name).join(', ')}</strong>.</p>
    <p>We recommend being careful about sharing this content or believing what it shows. Try to verify it from a trusted news source or the original person it supposedly depicts.</p>`;
  }
  return `<p>🚨 <strong>This content is very likely FAKE</strong>. Our analysis found multiple strong signs that this image or video has been manipulated using AI technology.</p>
    <p>Here's what gave it away: <strong>${failedChecks.map(c => c.name).join(', ')}</strong>. These are not minor issues — they are clear, well-known signs of deepfake technology being used.</p>
    <p><strong>Please do not share this content</strong> as if it were real. Sharing deepfakes — even accidentally — helps spread misinformation and can harm real people. If you found this on social media, consider reporting the post to the platform.</p>`;
}

// ============================
// SHOW RESULTS
// ============================
function showResults(result) {
  document.getElementById('scanningOverlay').style.display = 'none';
  const panel = document.getElementById('resultsPanel');
  panel.style.display = 'flex';

  // Verdict Banner
  const banner = document.getElementById('verdictBanner');
  banner.className = 'verdict-banner ' + result.verdict;
  document.getElementById('verdictIcon').textContent = result.verdict === 'real' ? '✅' : result.verdict === 'fake' ? '🚨' : '⚠️';
  document.getElementById('verdictTitle').textContent = result.verdict === 'real' ? 'This looks REAL' : result.verdict === 'fake' ? 'This is likely FAKE' : 'This is SUSPICIOUS';
  document.getElementById('verdictSubtitle').textContent = result.verdict === 'real'
    ? 'Our analysis didn\'t find significant signs of manipulation.'
    : result.verdict === 'fake'
    ? 'Multiple strong signs of AI manipulation detected.'
    : 'Some warning signs found. Proceed with caution.';
  document.getElementById('scoreNumber').textContent = result.score;

  // Meter needle
  setTimeout(() => {
    document.getElementById('meterNeedle').style.left = result.score + '%';
  }, 300);

  // Explanation
  document.getElementById('explanationText').innerHTML = result.explanation;

  // Checks
  const checksGrid = document.getElementById('checksGrid');
  checksGrid.innerHTML = result.checks.map(c => `
    <div class="check-item">
      <div class="check-header">
        <span class="check-name">${c.name}</span>
        <span class="check-status ${c.status}">${c.status === 'pass' ? '✓ PASS' : c.status === 'fail' ? '✗ FAIL' : '⚠ WARN'}</span>
      </div>
      <p class="check-detail">${c.detail}</p>
    </div>
  `).join('');

  // Metadata
  const metaGrid = document.getElementById('metaGrid');
  metaGrid.innerHTML = result.metadata.map(m => `
    <div class="meta-item">
      <div class="meta-key">${m.key}</div>
      <div class="meta-val ${m.missing ? 'missing' : m.suspicious ? 'suspicious' : ''}">${m.val}</div>
    </div>
  `).join('');

  // Scroll to results
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Trigger fade-in animations
  setTimeout(() => {
    panel.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
  }, 100);
}

// ============================
// HISTORY
// ============================
function saveToHistory(result) {
  const entry = {
    id: Date.now(),
    name: result.name,
    score: result.score,
    verdict: result.verdict,
    thumbnail: result.thumbnail,
    type: result.type,
    timestamp: result.timestamp,
    explanation: result.explanation,
    checks: result.checks
  };
  scanHistory.unshift(entry);
  if (scanHistory.length > 10) scanHistory = scanHistory.slice(0, 10);
  try { localStorage.setItem('tl-history', JSON.stringify(scanHistory.map(h => ({ ...h, thumbnail: null })))); } catch {}
  renderRecentScans();
}

function renderRecentScans() {
  const grid = document.getElementById('recentGrid');
  if (!grid) return;
  if (scanHistory.length === 0) {
    grid.innerHTML = `<div class="empty-state"><span>🕵️</span><p>No scans yet. Upload something to get started!</p></div>`;
    return;
  }
  grid.innerHTML = scanHistory.map((h, index) => `
    <div class="recent-item" onclick="loadRecentScan(${index})" style="cursor:pointer;">
      <div class="recent-thumb">
        ${h.thumbnail ? `<img src="${h.thumbnail}" alt="${h.name}" />` : (h.type === 'video' ? '🎬' : h.type === 'url' ? '🔗' : '🖼️')}
      </div>
      <span class="recent-name" title="${h.name}">${h.name}</span>
      <span class="recent-score ${h.verdict}">${h.verdict === 'real' ? '✅ Real' : h.verdict === 'fake' ? '🚨 Fake' : '⚠️ Suspicious'} · ${h.score}/100</span>
    </div>
  `).join('');
}

function loadRecentScan(index) {
  const scan = scanHistory[index];
  if (!scan) return;
  
  // Show results panel
  const resultsPanel = document.getElementById('resultsPanel');
  const inputCard = document.getElementById('inputCard');
  
  if (resultsPanel && inputCard) {
    inputCard.style.display = 'none';
    resultsPanel.style.display = 'block';
    
    // Update score display
    document.getElementById('scoreNumber').textContent = scan.score;
    
    // Update meter needle
    setTimeout(() => {
      document.getElementById('meterNeedle').style.left = scan.score + '%';
    }, 300);
    
    // Update verdict based on score
    const banner = document.querySelector('.verdict-banner');
    if (banner) {
      banner.className = 'verdict-banner ' + scan.verdict;
      document.getElementById('verdictIcon').textContent = scan.verdict === 'real' ? '✅' : scan.verdict === 'fake' ? '🚨' : '⚠️';
      document.getElementById('verdictTitle').textContent = scan.verdict === 'real' ? 'This looks REAL' : scan.verdict === 'fake' ? 'This is likely FAKE' : 'This is SUSPICIOUS';
      document.getElementById('verdictSubtitle').textContent = scan.verdict === 'real' 
        ? 'Our analysis didn\'t find significant signs of manipulation.' 
        : scan.verdict === 'fake' 
        ? 'Multiple strong signs of AI manipulation detected.' 
        : 'Some warning signs found. Proceed with caution.';
    }
    
    // Update explanation
    if (document.getElementById('explanationText')) {
      document.getElementById('explanationText').innerHTML = scan.explanation || '';
    }
    
    // Update checks if available
    if (scan.checks && document.getElementById('checksGrid')) {
      document.getElementById('checksGrid').innerHTML = scan.checks.map(c => `
        <div class="check-item">
          <span class="check-icon">${c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '!'}</span>
          <div class="check-content">
            <span class="check-name">${c.name}</span>
            <span class="check-status ${c.status}">${c.status === 'pass' ? 'Passed' : c.status === 'fail' ? 'Failed' : 'Warning'}</span>
          </div>
        </div>
      `).join('');
    }
    
    showToast('Loaded: ' + scan.name, 'success');
  }
}

// ============================
// ACTIONS
// ============================
function downloadReport() {
  // Gather report data from the current analysis
  const score = document.getElementById('scoreNumber').textContent;
  const verdict = document.querySelector('.verdict-title')?.textContent || 'N/A';
  const explanation = document.getElementById('explanationText')?.textContent || '';
  const checks = Array.from(document.querySelectorAll('.check-item')).map(item => ({
    name: item.querySelector('.check-name')?.textContent || '',
    status: item.querySelector('.check-status')?.textContent || ''
  }));
  
  // Create report content
  const reportContent = `TRUTHLENS ANALYSIS REPORT
========================
Generated: ${new Date().toLocaleString()}
------------------------

VERDICT: ${verdict}
SCORE: ${score}/100

EXPLANATION:
${explanation}

CHECKS PERFORMED:
${checks.map(c => `- ${c.name}: ${c.status}`).join('\n')}

---
Report generated by TruthLens Deepfake Detector
`;
  
  // Create and trigger download
  const blob = new Blob([reportContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `truthlens-report-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Report downloaded!', 'success');
}

// ── Share result via modal ──
function shareResult() {
  const data    = buildShareData();
  const encoded = btoa(JSON.stringify(data));
  const base    = window.location.origin + window.location.pathname;
  const shareUrl = base + '?r=' + encoded;

  const emoji   = data.verdict.toLowerCase().includes('fake') ? '🚨'
    : data.verdict.toLowerCase().includes('real') ? '✅' : '⚠️';
  const shareText =
    `${emoji} I just analyzed this content with TruthLens Deepfake Detector!\n` +
    `Result: ${data.verdict} — Fake Score: ${data.score}/100\n` +
    `See the full report here:`;

  // Show share modal
  showShareModal(shareUrl, shareText, data);
}

// ── Share Modal ──
function showShareModal(shareUrl, shareText, data) {
  // Remove existing modal
  const existing = document.getElementById('shareModal');
  if (existing) existing.remove();

  const waText  = encodeURIComponent(shareText + '\n' + shareUrl);
  const tgText  = encodeURIComponent(shareText);
  const tgUrl   = encodeURIComponent(shareUrl);
  const twText  = encodeURIComponent(shareText + ' ' + shareUrl);
  const fbUrl   = encodeURIComponent(shareUrl);

  const modal = document.createElement('div');
  modal.id = 'shareModal';
  modal.innerHTML = `
    <div class="share-backdrop" onclick="closeShareModal()"></div>
    <div class="share-dialog">
      <div class="share-header">
        <h3>🔗 Share Analysis Report</h3>
        <button class="share-close" onclick="closeShareModal()">✕</button>
      </div>

      <div class="share-preview">
        <div class="share-preview-label">Report Summary</div>
        <div class="share-preview-row">
          <span>File:</span><strong>${data.fname}</strong>
        </div>
        <div class="share-preview-row">
          <span>Verdict:</span><strong>${data.verdict}</strong>
        </div>
        <div class="share-preview-row">
          <span>Fake Score:</span><strong>${data.score}/100</strong>
        </div>
      </div>

      <div class="share-url-row">
        <input id="shareUrlInput" class="share-url-input" readonly value="${shareUrl}" />
        <button class="share-copy-btn" onclick="copyShareUrl()" id="copyBtn">📋 Copy</button>
      </div>

      <p class="share-hint">Share directly to:</p>

      <div class="share-apps">
        <a class="share-app-btn whatsapp"
           href="https://api.whatsapp.com/send?text=${waText}"
           target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.878L0 24l6.317-1.535C8.083 23.446 9.997 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.944 0-3.77-.538-5.328-1.473l-.38-.225-3.748.91.946-3.654-.249-.39C2.535 15.545 2 13.83 2 12 2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
          WhatsApp
        </a>

        <a class="share-app-btn telegram"
           href="https://t.me/share/url?url=${tgUrl}&text=${tgText}"
           target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
          Telegram
        </a>

        <a class="share-app-btn twitter"
           href="https://twitter.com/intent/tweet?text=${twText}"
           target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Twitter / X
        </a>

        <a class="share-app-btn facebook"
           href="https://www.facebook.com/sharer/sharer.php?u=${fbUrl}"
           target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
          Facebook
        </a>

        <button class="share-app-btn native" onclick="nativeShare('${shareUrl.replace(/'/g, "\\'")}')"
          id="nativeShareBtn" style="display:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          More Apps
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('visible'));

  // Show native share on mobile
  if (navigator.share) {
    document.getElementById('nativeShareBtn').style.display = 'flex';
  }
}

function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (!modal) return;
  modal.classList.remove('visible');
  setTimeout(() => modal.remove(), 300);
}

function copyShareUrl() {
  const input = document.getElementById('shareUrlInput');
  const btn   = document.getElementById('copyBtn');
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => {
    btn.textContent = '✅ Copied!';
    btn.style.background = 'rgba(0,255,140,0.2)';
    setTimeout(() => { btn.textContent = '📋 Copy'; btn.style.background = ''; }, 2000);
  }).catch(() => {
    input.select();
    document.execCommand('copy');
    showToast('Link copied!', 'success');
  });
}

async function nativeShare(url) {
  const data = buildShareData();
  try {
    await navigator.share({
      title: `TruthLens Report — ${data.verdict}`,
      text: `Check this deepfake analysis! Result: ${data.verdict} (Score: ${data.score}/100)`,
      url
    });
  } catch (err) {
    if (err.name !== 'AbortError') showToast('Could not open share sheet', 'error');
  }
}


// Send analysis report to the logged-in user's registered email
async function shareToEmail() {
  // ── Step 1: Get the logged-in user's registered email ──
  let userEmail = '';
  let userName  = '';
  const storedUser = localStorage.getItem('tl-user');
  if (storedUser) {
    try {
      const u = JSON.parse(storedUser);
      userEmail = u.email || '';
      userName  = u.name  || 'User';
    } catch {}
  }

  // If not logged in, don't allow sending
  if (!userEmail) {
    showToast('⚠️ Please log in first to receive the report on your email.', 'error');
    setTimeout(() => { window.location.href = 'index.html'; }, 2000);
    return;
  }

  // Confirm with the user before sending
  const confirmed = confirm(
    `Send this analysis report to your registered email?\n\n📧 ${userEmail}`
  );
  if (!confirmed) return;

  // ── Step 2: Gather current report data ──
  const score       = document.getElementById('scoreNumber').textContent;
  const verdict     = document.getElementById('verdictTitle')?.textContent || 'N/A';
  const explanation = document.getElementById('explanationText')?.textContent || '';
  const checks      = Array.from(document.querySelectorAll('.check-item')).map(item => ({
    name:   item.querySelector('.check-name')?.textContent   || '',
    status: item.querySelector('.check-status')?.textContent || ''
  }));

  const reportData = {
    score,
    verdict,
    explanation,
    checks,
    fileName: currentFile?.name || 'Unknown file',
    userName
  };

  // ── Step 3: mailto fallback (always works, no server needed) ──
  function sendViaMailto() {
    const checksText = checks.map(c => `  * ${c.name}: ${c.status}`).join('\n');
    const mailBody =
`Hello ${userName},

Here is your TruthLens Deepfake Analysis Report.

FILE ANALYZED : ${reportData.fileName}
VERDICT       : ${verdict}
FAKE SCORE    : ${score} / 100
DATE          : ${new Date().toLocaleString()}

─────────────────────────────────────
WHAT THIS MEANS:
${explanation.replace(/<[^>]+>/g, '').trim()}

─────────────────────────────────────
CHECKS PERFORMED:
${checksText}

─────────────────────────────────────
This report was generated by TruthLens Deepfake Detector.
Please do not share deepfake content as if it were real.`;

    const mailtoLink =
      'mailto:' + userEmail +
      '?subject=' + encodeURIComponent(`TruthLens Report — ${verdict} (Score: ${score}/100)`) +
      '&body='    + encodeURIComponent(mailBody);

    window.location.href = mailtoLink;
    showToast('📧 Opening your email app to send the report to ' + userEmail + '…', 'success');
  }

  // ── Step 4: Try backend API if served via HTTP, else mailto ──
  const servedViaHTTP =
    window.location.protocol === 'http:' || window.location.protocol === 'https:';

  if (!servedViaHTTP) {
    sendViaMailto();
    return;
  }

  try {
    showToast('📤 Sending report to ' + userEmail + '…', 'info');

    const response = await fetch('/api/share/email', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('tl-token') || '')
      },
      body: JSON.stringify({ recipientEmail: userEmail, reportData })
    });

    const data = await response.json();

    if (data.success) {
      showToast('✅ Report sent successfully to ' + userEmail + '!', 'success');
    } else {
      console.warn('[Email API]', data.error, data.detail || '');
      showToast('Server error. Opening your email app instead…', 'error');
      setTimeout(sendViaMailto, 1500);
    }
  } catch (err) {
    console.error('[Email fetch error]', err.message);
    showToast('Cannot reach server. Opening your email app…', 'error');
    setTimeout(sendViaMailto, 1500);
  }
}

function resetDetector() {
  currentFile = null;
  document.getElementById('inputCard').style.display = 'block';
  document.getElementById('resultsPanel').style.display = 'none';
  document.getElementById('scanningOverlay').style.display = 'none';
  removeFile();
  document.getElementById('urlInput').value = '';
  // Reset scan steps
  document.querySelectorAll('.scan-step').forEach(s => { s.classList.remove('active', 'done'); });
  document.getElementById('scanBar').style.width = '0%';
  document.getElementById('scanPercent').textContent = '0%';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toast
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}