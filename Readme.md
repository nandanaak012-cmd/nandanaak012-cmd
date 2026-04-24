# 🔍 TruthLens — Deepfake Detector for Social Media

A full-stack web application that detects whether images, videos, or social media URLs are real or fake — explained in plain, simple English.

---

## 📁 Project Structure

```
deepfake-detector/
│
├── frontend/                   ← All website pages & styles
│   ├── index.html              ← Page 1: Login / Sign Up
│   ├── about.html              ← Page 2: About / How It Works
│   ├── detector.html           ← Page 3: Upload & Analyze
│   ├── contact.html            ← Page 4: Contact the Owner
│   │
│   ├── css/
│   │   ├── variables.css       ← Color themes (dark/light)
│   │   ├── global.css          ← Shared styles, navbar, buttons
│   │   ├── auth.css            ← Login/Signup page styles
│   │   ├── about.css           ← About page styles
│   │   ├── detector.css        ← Detector page styles
│   │   └── contact.css         ← Contact page styles
│   │
│   └── js/
│       ├── theme.js            ← Dark/Light mode toggle
│       ├── auth.js             ← Login & signup logic
│       ├── nav.js              ← Navigation & session
│       ├── detector.js         ← Core analysis engine (frontend)
│       ├── contact.js          ← Contact form logic
│       └── animations.js       ← Scroll animations
│
├── backend/
│   ├── server.js               ← Node.js/Express API server
│   └── package.json            ← Backend dependencies
│
└── docs/
    └── README.md               ← This file
```

---

## 🚀 How to Run the Website

### Option A — Open Directly (No Backend Needed)

The frontend works completely on its own for demo purposes.

1. Open the `frontend/` folder
2. Double-click `index.html` OR use VS Code Live Server:
   - Install the "Live Server" extension in VS Code
   - Right-click `index.html` → "Open with Live Server"
3. The site runs at `http://127.0.0.1:5500`

> **Note:** Without the backend, analysis is simulated in the browser. It still demonstrates the full UI and flow.

---

### Option B — Full Stack (Frontend + Backend)

#### Step 1: Install Node.js

Download from https://nodejs.org (version 18 or newer)

#### Step 2: Set Up Backend

```bash
cd deepfake-detector/backend
npm install
node server.js
```

The server starts at http://localhost:3001 and serves the frontend automatically.

#### Step 3: Open in Browser

Go to: http://localhost:3001

---

## 🌐 Pages Overview

| Page           | File            | Description                             |
| -------------- | --------------- | --------------------------------------- |
| Login / Signup | `index.html`    | First page — create account or sign in  |
| About          | `about.html`    | What deepfakes are, how TruthLens works |
| Detector       | `detector.html` | Upload files or paste URLs to analyze   |
| Contact        | `contact.html`  | Owner info, contact form, FAQ           |

---

## ✨ Features

- **Dark / Light Mode** — Toggle in the top-right corner on every page
- **Login & Signup** — With social login buttons (Google, GitHub)
- **File Upload** — Drag & drop or browse for images/videos
- **URL Analysis** — Paste links from Twitter, Facebook, Instagram, YouTube, TikTok
- **Animated Scan** — Progress bar with real-time step descriptions
- **Plain English Results** — No technical jargon, just clear explanations
- **Fake Score Meter** — Visual 0–100 scale showing how suspicious content is
- **Detailed Checks** — 6 individual detection checks explained simply
- **Metadata Inspector** — Shows hidden file information
- **Scan History** — Recent scans stored in browser
- **Responsive Design** — Works on laptop, desktop, and mobile

---

## 🔌 API Endpoints (Backend)

| Method | Route               | Description              |
| ------ | ------------------- | ------------------------ |
| POST   | `/api/auth/signup`  | Register new user        |
| POST   | `/api/auth/login`   | Sign in                  |
| GET    | `/api/auth/me`      | Get current user         |
| POST   | `/api/analyze/file` | Analyze uploaded file    |
| POST   | `/api/analyze/url`  | Analyze social media URL |
| GET    | `/api/history`      | Get scan history         |
| POST   | `/api/contact`      | Submit contact form      |
| GET    | `/api/health`       | Server health check      |

---

## 🔮 Connecting a Real AI Model (Production)

To use real AI detection in production, replace the `analyzeContent()` function in `backend/server.js` with calls to:

- **FaceForensics++** — Open-source deepfake detection model
- **DeepFace** (Python) — Face analysis library
- **Microsoft Azure Video Indexer** — Cloud-based video analysis
- **Google Cloud Vision API** — Image manipulation detection
- **Sensity AI API** — Commercial deepfake detection API

Example Python integration:

```python
# Install: pip install deepface tensorflow
from deepface import DeepFace
result = DeepFace.analyze(img_path="upload.jpg", actions=["emotion", "age"])
```

---

## 🗄️ Database Setup (Optional)

For persistent user accounts and scan history, add a database:

### MongoDB (Recommended)

```bash
npm install mongoose
```

```javascript
// In server.js, replace in-memory users array with:
const mongoose = require("mongoose");
mongoose.connect("mongodb://localhost:27017/truthlens");
```

### SQLite (Simple)

```bash
npm install better-sqlite3
```

---

## 🔐 Environment Variables

Create a `.env` file in the `backend/` folder:

```
PORT=3001
JWT_SECRET=your-secret-key-here
MONGODB_URI=mongodb://localhost:27017/truthlens
SENDGRID_API_KEY=your-sendgrid-key
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

## 🛡️ Security Notes

- Files are deleted immediately after analysis
- Rate limiting: 50 requests per 15 minutes per IP
- Helmet.js sets secure HTTP headers
- In production: add HTTPS, use proper JWT tokens, connect a real database
- Never commit `.env` files to version control

---

## 📬 Contact

**Arjun Kumar** — Founder & CEO, TruthLens  
📧 hello@truthlens.io  
📍 Bengaluru, Karnataka, India

---

_TruthLens — See Through the Lies._ 🔍
