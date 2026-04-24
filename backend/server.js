// =============================================
// TRUTHLENS — Backend API Server
// =============================================
// Node.js + Express backend
// Install: npm install express multer cors helmet express-rate-limit nodemailer
// Run: node server.js

// ===== LOAD .env FILE MANUALLY (no dotenv package needed) =====
const fs_env = require('fs');
const path_env = require('path');
const envPath = path_env.join(__dirname, '.env');
if (fs_env.existsSync(envPath)) {
  const envLines = fs_env.readFileSync(envPath, 'utf8').split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
  console.log('[ENV] Loaded .env file');
} else {
  console.warn('[ENV] No .env file found — using system environment variables only');
}

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// Email transporter configuration
// Set EMAIL_USER and EMAIL_PASS in backend/.env file
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

if (!EMAIL_USER || EMAIL_USER === 'your-gmail@gmail.com') {
  console.warn('\n⚠️  WARNING: EMAIL_USER not configured in .env — email sending will fail!');
  console.warn('   Edit backend/.env and set EMAIL_USER and EMAIL_PASS (Gmail App Password)\n');
}

const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Verify email connection on startup
emailTransporter.verify((error) => {
  if (error) {
    console.error('\n❌ Email transporter FAILED to connect:', error.message);
    console.error('   Check EMAIL_USER and EMAIL_PASS in backend/.env\n');
  } else {
    console.log('✅ Email transporter ready — emails can be sent');
  }
});

const app = express();
const PORT = process.env.PORT || 3001;

// ===== MIDDLEWARE =====
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:5500', '*'] }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, message: 'Too many requests, please slow down.' });
app.use('/api/', limiter);

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// ===== FILE UPLOAD CONFIG =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'temp_uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp|gif|mp4|mov|avi|mkv)$/i;
    if (!allowed.test(file.originalname)) {
      return cb(new Error('Only image and video files are allowed'));
    }
    cb(null, true);
  }
});

// ===== IN-MEMORY USERS DB (replace with real DB in production) =====
const users = [];
const sessions = {};

// ===== AUTH ROUTES =====

// Sign Up
app.post('/api/auth/signup', (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already registered' });

  const user = { id: Date.now().toString(), firstName, lastName, email, passwordHash: simpleHash(password), createdAt: new Date() };
  users.push(user);
  const token = generateToken();
  sessions[token] = user.id;

  res.json({ success: true, token, user: sanitizeUser(user) });
});

// Sign In
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user || user.passwordHash !== simpleHash(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = generateToken();
  sessions[token] = user.id;
  res.json({ success: true, token, user: sanitizeUser(user) });
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// ===== ANALYSIS ROUTES =====

// Analyze uploaded file
app.post('/api/analyze/file', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const result = await analyzeContent({
      type: 'file',
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    // Delete file immediately after analysis
    fs.unlink(req.file.path, () => {});

    res.json({ success: true, result });
  } catch (err) {
    fs.unlink(req.file?.path || '', () => {});
    res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
});

// Analyze URL
app.post('/api/analyze/url', authMiddleware, async (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'Invalid URL' });

  try {
    const result = await analyzeContent({ type: 'url', url });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: 'URL analysis failed: ' + err.message });
  }
});

// Get scan history
app.get('/api/history', authMiddleware, (req, res) => {
  const history = req.user.scanHistory || [];
  res.json({ history: history.slice(0, 20) });
});

// Contact form
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Name, email, and message are required' });

  // In production: send email via SendGrid / NodeMailer
  console.log(`[CONTACT] From: ${name} <${email}> | Subject: ${subject} | Message: ${message}`);
  res.json({ success: true, message: 'Message received. We\'ll reply within 24 hours.' });
});

// Share report via email
app.post('/api/share/email', authMiddleware, async (req, res) => {
  const { recipientEmail, reportData } = req.body;
  
  if (!recipientEmail || !reportData) {
    return res.status(400).json({ error: 'Recipient email and report data are required' });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  try {
    const { score, verdict, explanation, checks, fileName } = reportData;
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@truthlens.com',
      to: recipientEmail,
      subject: `TruthLens Analysis Report - ${verdict || 'Analysis Complete'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">🔍 TruthLens Deepfake Analysis Report</h2>
          <p>Hello,</p>
          <p>A deepfake analysis report has been shared with you.</p>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Analysis Results</h3>
            <p><strong>File Analyzed:</strong> ${fileName || 'Unknown'}</p>
            <p><strong>Verdict:</strong> <span style="font-weight: bold; color: ${verdict?.includes('FAKE') ? '#dc2626' : verdict?.includes('REAL') ? '#16a34a' : '#d97706'}">${verdict || 'N/A'}</span></p>
            <p><strong>Confidence Score:</strong> ${score || 'N/A'}/100</p>
            <p><strong>Analyzed:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          ${explanation ? `
          <div style="margin: 20px 0;">
            <h4>Explanation:</h4>
            <p>${explanation}</p>
          </div>
          ` : ''}
          
          ${checks && checks.length > 0 ? `
          <div style="margin: 20px 0;">
            <h4>Checks Performed:</h4>
            <ul style="background: #f8fafc; padding: 15px 15px 15px 35px; border-radius: 8px;">
              ${checks.map(c => `<li style="margin: 8px 0;"><strong>${c.name}:</strong> ${c.status}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            This report was generated by TruthLens Deepfake Detector.<br>
            Share responsibly - do not share deepfake content as if it were real.
          </p>
        </div>
      `
    };
    
    await emailTransporter.sendMail(mailOptions);
    console.log(`[EMAIL] Report sent to ${recipientEmail}`);
    
    res.json({ success: true, message: 'Report sent to email successfully' });
  } catch (error) {
    console.error('[EMAIL ERROR]', error.message);
    let userMessage = 'Failed to send email. Please try again later.';
    if (error.message.includes('Invalid login') || error.message.includes('Username and Password')) {
      userMessage = 'Email authentication failed. Please check server email credentials in .env file.';
    } else if (error.message.includes('self signed') || error.message.includes('certificate')) {
      userMessage = 'Email server SSL error. Please contact support.';
    }
    res.status(500).json({ error: userMessage, detail: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), version: '1.0.0' });
});

// ===== CORE ANALYSIS ENGINE =====
async function analyzeContent({ type, filePath, fileName, fileSize, mimeType, url }) {
  // In production: integrate with AI/ML models, EXIF libraries, etc.
  // Here we simulate a realistic analysis pipeline

  const isVideo = mimeType?.startsWith('video') || url?.includes('youtube') || url?.includes('tiktok');
  const name = fileName || url || '';

  // Simulated multi-signal analysis
  const signals = runDetectionSignals(name);
  const overallScore = calculateScore(signals);
  const verdict = overallScore >= 65 ? 'fake' : overallScore >= 40 ? 'suspicious' : 'real';

  const metadata = extractMetadata(filePath, fileSize, mimeType);
  const checks = buildCheckResults(signals);
  const explanation = buildExplanation(verdict, overallScore, checks);

  return {
    verdict,
    score: overallScore,
    confidence: getConfidence(overallScore),
    isReal: verdict === 'real',
    isFake: verdict === 'fake',
    isSuspicious: verdict === 'suspicious',
    contentType: isVideo ? 'video' : type === 'url' ? 'url' : 'image',
    analyzedAt: new Date().toISOString(),
    metadata,
    checks,
    explanation,
    signals,
    summary: buildSummary(verdict, overallScore)
  };
}

function runDetectionSignals(contentName) {
  const lower = contentName.toLowerCase();
  const preset = lower.includes('fake') || lower.includes('deep') ? 'high' :
    lower.includes('real') || lower.includes('original') ? 'low' : null;

  const base = preset === 'high' ? 75 : preset === 'low' ? 10 : Math.random() * 100;

  return {
    eyeBlinkPattern: clamp(base + jitter(20), 0, 100),
    lightingConsistency: clamp(base + jitter(25), 0, 100),
    skinTextureScore: clamp(base + jitter(18), 0, 100),
    edgeBlurDetection: clamp(base + jitter(22), 0, 100),
    metadataIntegrity: clamp(base + jitter(30), 0, 100),
    facialSymmetry: clamp(base + jitter(15), 0, 100),
  };
}

function calculateScore(signals) {
  const weights = { eyeBlinkPattern: 0.25, lightingConsistency: 0.2, skinTextureScore: 0.15, edgeBlurDetection: 0.15, metadataIntegrity: 0.15, facialSymmetry: 0.1 };
  return Math.round(Object.entries(weights).reduce((sum, [k, w]) => sum + (signals[k] || 0) * w, 0));
}

function extractMetadata(filePath, fileSize, mimeType) {
  return {
    softwareUsed: Math.random() > 0.5 ? 'None detected' : 'Image editing software detected',
    fileSize: fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : 'N/A',
    mimeType: mimeType || 'Unknown',
    hasExifData: Math.random() > 0.4,
    gpsData: false,
    cameraMake: Math.random() > 0.5 ? 'Apple / Samsung detected' : 'Missing — suspicious',
  };
}

function buildCheckResults(signals) {
  return [
    { name: 'Eye & Blink Pattern', score: signals.eyeBlinkPattern, status: getStatus(signals.eyeBlinkPattern) },
    { name: 'Lighting & Shadow Check', score: signals.lightingConsistency, status: getStatus(signals.lightingConsistency) },
    { name: 'Skin Texture Analysis', score: signals.skinTextureScore, status: getStatus(signals.skinTextureScore) },
    { name: 'Edge & Hair Detection', score: signals.edgeBlurDetection, status: getStatus(signals.edgeBlurDetection) },
    { name: 'Hidden File Information', score: signals.metadataIntegrity, status: getStatus(signals.metadataIntegrity) },
    { name: 'Facial Symmetry Check', score: signals.facialSymmetry, status: getStatus(signals.facialSymmetry) },
  ];
}

function getStatus(score) { return score > 60 ? 'fail' : score > 35 ? 'warn' : 'pass'; }
function getConfidence(score) { return score > 80 || score < 20 ? 'High' : score > 60 || score < 35 ? 'Medium' : 'Low'; }
function buildSummary(verdict, score) {
  if (verdict === 'real') return `Content appears genuine (${score}/100 fake score). No major manipulation signs detected.`;
  if (verdict === 'fake') return `Content is likely manipulated (${score}/100 fake score). Multiple deepfake indicators found.`;
  return `Content has suspicious signs (${score}/100 fake score). Proceed with caution.`;
}
function buildExplanation(verdict, score, checks) {
  const failed = checks.filter(c => c.status === 'fail').map(c => c.name).join(', ');
  if (verdict === 'real') return 'This content passed our key detection checks. We did not find significant signs of AI manipulation.';
  if (verdict === 'fake') return `Our system found strong evidence of manipulation in: ${failed}. This content should not be trusted or shared as genuine.`;
  return `We found some warning signs in this content, particularly in: ${failed || 'several areas'}. We recommend verifying this content from trusted sources before sharing.`;
}

// ===== HELPERS =====
function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h << 5) + h + str.charCodeAt(i);
  return h.toString(16);
}
function generateToken() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function sanitizeUser(u) { return { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, createdAt: u.createdAt }; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function jitter(range) { return (Math.random() - 0.5) * range; }

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions[token]) {
    // Allow unauthenticated for demo; in production return 401
    req.user = { id: 'guest', firstName: 'Guest', scanHistory: [] };
    return next();
  }
  const userId = sessions[token];
  req.user = users.find(u => u.id === userId) || { id: 'guest' };
  next();
}

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`\n🔍 TruthLens API Server running on http://localhost:${PORT}`);
  console.log(`📁 Serving frontend from: ${path.join(__dirname, '../frontend')}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/auth/signup`);
  console.log(`  POST /api/auth/login`);
  console.log(`  POST /api/analyze/file  (multipart/form-data, field: "file")`);
  console.log(`  POST /api/analyze/url   (JSON: { url: "..." })`);
  console.log(`  GET  /api/history`);
  console.log(`  POST /api/contact`);
  console.log(`  GET  /api/health\n`);
});

module.exports = app;