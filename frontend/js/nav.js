// =============================================
// TRUTHLENS — Navigation Logic
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  // Load user info
  const user = JSON.parse(localStorage.getItem('tl-user') || 'null');
  const avatar = document.getElementById('navAvatar');
  if (avatar && user) {
    avatar.textContent = (user.name || 'U')[0].toUpperCase();
    avatar.title = user.name;
    avatar.onclick = () => {
      if (confirm(`Signed in as ${user.name}. Sign out?`)) {
        localStorage.removeItem('tl-user');
        window.location.href = 'index.html';
      }
    };
  } else if (avatar) {
    avatar.onclick = () => window.location.href = 'index.html';
  }

  // Redirect if not logged in
  if (!user && !window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
    // Allow browsing but show toast
    setTimeout(() => showToast('Sign in to save your scan history', 'info'), 2000);
  }

  // Hamburger menu
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
      }
    });
  }

  // Theme toggle in nav — sync label only (click is handled by theme.js)
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const updateLabel = () => {
      const t = document.documentElement.getAttribute('data-theme');
      themeToggle.textContent = t === 'dark' ? '☀️ Light' : '🌙 Dark';
    };
    // Set initial label
    updateLabel();
    // Keep label in sync whenever data-theme changes (from theme.js click handler)
    new MutationObserver(updateLabel).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme']
    });
  }

  // Scroll reveal for nav
  let lastScroll = 0;
  const nav = document.querySelector('.main-nav');
  window.addEventListener('scroll', () => {
    const curr = window.scrollY;
    if (nav) {
      nav.style.transform = curr > lastScroll && curr > 100 ? 'translateY(-100%)' : 'translateY(0)';
    }
    lastScroll = curr;
  }, { passive: true });
});

// Helper
function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}