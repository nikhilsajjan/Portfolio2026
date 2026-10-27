/* Case studies (cdc-w-xendit, bulk-download, learn, just-ask-it,
   figma-to-website, photography). Loaded last.
   - The theme toggle is the pet, as on the home page: it stays put, its eyes
     follow the pointer.
   - Videos play without player controls; a tap brings them.
   - Learn on phones: paragraphs fade in whole as they arrive, instead of the
     word-by-word fill that flickers under a flick of the thumb (fx/case.css
     also turns snapping off there). */
(function () {
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = matchMedia('(max-width: 767px), (hover: none)');

  /* ---------- Pet ---------- */
  var pet = document.getElementById('theme-toggle');
  if (pet) {
    pet.classList.add('hm-pet');
    ['i', 'i'].forEach(function (t) { var e = document.createElement(t); e.className = 'hm-eye'; pet.appendChild(e); });
    var look = function (x, y) {
      var r = pet.getBoundingClientRect();
      var dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1;
      var reach = Math.min(1, d / 120) * r.width / 6;
      pet.style.setProperty('--ex', (dx / d * reach).toFixed(1) + 'px');
      pet.style.setProperty('--ey', (dy / d * reach).toFixed(1) + 'px');
    };
    addEventListener('pointermove', function (e) { look(e.clientX, e.clientY); }, { passive: true });
    addEventListener('pointerdown', function (e) { look(e.clientX, e.clientY); }, { passive: true });
    if (!reduce) {
      (function blink() {
        setTimeout(function () {
          pet.classList.add('is-blink');
          setTimeout(function () { pet.classList.remove('is-blink'); blink(); }, 140);
        }, 2500 + Math.floor(Math.random() * 4000));
      })();
    }
  }

  /* ---------- Videos: no player in the way; a tap brings the controls ---------- */
  document.querySelectorAll('.shot-video').forEach(function (v) {
    v.controls = false;
    v.addEventListener('click', function (e) {
      // the lab's image lightbox listens on the shot and expects an <img>
      e.stopPropagation();
      if (v.controls) return;
      v.controls = true;
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    });
  });

  /* ---------- Learn on phones: whole paragraphs fade in ---------- */
  function calm() {
    if (!phone.matches || !root.classList.contains('learn-fill') || !('IntersectionObserver' in window)) return;
    root.classList.add('hm-calm');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('hm-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('.case-section .prose p, .case-section .prose li, .case-section > p').forEach(function (p) {
      p.classList.add('hm-para');
      io.observe(p);
    });
  }
  // fx/learn.js sets learn-fill once the page has loaded
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(calm, 0); });
  else setTimeout(calm, 0);
})();
