// =============================================
// TRUTHLENS — Scroll Animations
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const fadeEls = document.querySelectorAll('.fade-in');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger delay
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, i * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  fadeEls.forEach(el => observer.observe(el));

  // Number counter animation for stats
  const statNumbers = document.querySelectorAll('.stat-number');
  statNumbers.forEach(el => {
    const text = el.textContent;
    const match = text.match(/[\d.]+/);
    if (!match) return;
    const target = parseFloat(match[0]);
    const suffix = text.replace(match[0], '');

    const numObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        animateNumber(el, 0, target, suffix, text);
        numObserver.unobserve(el);
      });
    }, { threshold: 0.5 });
    numObserver.observe(el);
  });

  function animateNumber(el, from, to, suffix, originalText) {
    const duration = 1800;
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const value = from + (to - from) * ease;
      const display = to % 1 === 0 ? Math.round(value) : value.toFixed(1);
      el.textContent = display + suffix;
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = originalText;
    }
    requestAnimationFrame(tick);
  }
});