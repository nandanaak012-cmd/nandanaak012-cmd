// =============================================
// TRUTHLENS — Auth Page Logic
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  // --- Tab switching ---
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // --- Password Strength ---
  const pwInput = document.querySelector('#signup input[type="password"]');
  if (pwInput) {
    pwInput.addEventListener('input', () => {
      const val = pwInput.value;
      const score = calcStrength(val);
      const fill = document.querySelector('.strength-fill');
      if (!fill) return;
      fill.style.width = (score * 25) + '%';
      fill.style.background = ['#ff3c3c','#ff3c3c','#ffb800','#00e5ff','#00ff8c'][score];
    });
  }

  function calcStrength(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  // --- Login Form ---
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = loginForm.querySelector('.btn-primary');
      btn.textContent = 'Signing in...';
      btn.disabled = true;

      setTimeout(() => {
        // Save mock user session
        localStorage.setItem('tl-user', JSON.stringify({ name: 'Alex', email: loginForm.querySelector('input[type=email]').value }));
        showToast('Welcome back! Redirecting...', 'success');
        setTimeout(() => window.location.href = 'about.html', 1000);
      }, 1500);
    });
  }

  // --- Signup Form ---
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputs = signupForm.querySelectorAll('input[type=password]');
      if (inputs[0].value !== inputs[1].value) {
        showToast('Passwords do not match', 'error');
        return;
      }
      const btn = signupForm.querySelector('.btn-primary');
      btn.textContent = 'Creating account...';
      btn.disabled = true;

      setTimeout(() => {
        const name = signupForm.querySelectorAll('input[type=text]')[0].value || 'User';
        localStorage.setItem('tl-user', JSON.stringify({ name, email: signupForm.querySelector('input[type=email]').value }));
        showToast('Account created! Welcome to TruthLens 🎉', 'success');
        setTimeout(() => window.location.href = 'about.html', 1200);
      }, 1500);
    });
  }

  // --- Social Login ---
  window.socialLogin = function(provider) {
    showToast(`Connecting to ${provider}...`, 'info');
    setTimeout(() => {
      localStorage.setItem('tl-user', JSON.stringify({ name: 'User', email: 'user@' + provider + '.com' }));
      showToast('Logged in! Redirecting...', 'success');
      setTimeout(() => window.location.href = 'about.html', 1000);
    }, 1200);
  };

  // --- Check if already logged in ---
  const user = localStorage.getItem('tl-user');
  if (user) {
    window.location.href = 'about.html';
  }
});

// Toast utility
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer') || (() => {
    const c = document.createElement('div');
    c.className = 'toast-container'; c.id = 'toastContainer';
    document.body.appendChild(c); return c;
  })();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Password visibility toggle
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';

  // Swap icons
  const eyeIcon    = btn.querySelector('.eye-icon');
  const eyeOffIcon = btn.querySelector('.eye-off-icon');
  if (eyeIcon)    eyeIcon.style.display    = isHidden ? 'none'  : '';
  if (eyeOffIcon) eyeOffIcon.style.display = isHidden ? ''      : 'none';

  // Update aria label
  btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');

  // Keep focus on input
  input.focus();
}