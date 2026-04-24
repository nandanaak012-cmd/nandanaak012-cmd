// =============================================
// TRUTHLENS — Theme Toggle
// =============================================

// Step 1: Apply saved theme immediately (runs before DOMContentLoaded)
(function () {
  var saved = localStorage.getItem('tl-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

// Step 2: Wire the button once DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  var btn = document.getElementById('themeToggle');
  if (!btn) return;

  // Sync nav-text buttons (those with class="theme-toggle-nav")
  function syncLabel() {
    if (!btn.classList.contains('theme-toggle-nav')) return;
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
    btn.title      = isDark ? 'Switch to Light mode' : 'Switch to Dark mode';
  }

  // Initial label sync
  syncLabel();

  // Click handler — toggle and persist
  btn.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme');
    var next    = current === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('tl-theme', next);

    syncLabel();
  });
});