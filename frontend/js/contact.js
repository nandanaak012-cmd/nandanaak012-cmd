// =============================================
// TRUTHLENS — Contact Page Logic
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  // File attachment label
  const attachFile = document.getElementById('attachFile');
  const attachText = document.getElementById('attachText');
  if (attachFile && attachText) {
    attachFile.addEventListener('change', () => {
      attachText.textContent = attachFile.files[0]?.name || 'Click to attach a file';
    });
  }

  // Contact form submit
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('.btn-primary');
      const orig = btn.textContent;
      btn.textContent = 'Sending...';
      btn.disabled = true;

      setTimeout(() => {
        btn.textContent = '✅ Message Sent!';
        showToast('Your message has been sent! We\'ll reply within 24 hours.', 'success');
        setTimeout(() => {
          btn.textContent = orig;
          btn.disabled = false;
          contactForm.reset();
          if (attachText) attachText.textContent = 'Click to attach a file';
        }, 3000);
      }, 1800);
    });
  }
});

// FAQ toggle
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = answer.classList.contains('open');

  // Close all
  document.querySelectorAll('.faq-a').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.faq-q').forEach(q => q.classList.remove('open'));

  if (!isOpen) {
    answer.classList.add('open');
    btn.classList.add('open');
  }
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