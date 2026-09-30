(function () {
  var root = document.documentElement;
  var dots = document.getElementById('dots');
  var toggle = document.getElementById('theme-toggle');
  var mq = matchMedia('(min-width: 768px)');

  function buildDots() {
    if (!dots || !toggle) return;
    var cols = mq.matches ? 23 : 10;
    var rows = mq.matches ? 12 : 8;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < rows * cols - 1; i++) {
      var d = document.createElement('span');
      d.className = 'dot';
      frag.appendChild(d);
    }
    dots.replaceChildren(frag, toggle);
  }

  /* Swap screenshots per theme. Only the needed file is fetched; images with no
     dark export (data-dark absent) keep their light source in both themes. */
  function applyShots(theme) {
    document.querySelectorAll('.shot-img').forEach(function (img) {
      var next = (theme === 'dark' && img.dataset.dark) || img.dataset.light;
      if (next && img.getAttribute('src') !== next) img.setAttribute('src', next);
    });
  }

  function applyTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (toggle) {
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    applyShots(theme);
    document.dispatchEvent(new CustomEvent('themechange'));
    if (persist) { try { localStorage.setItem('theme', theme); } catch (e) {} }
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
    });
  }

  applyTheme(root.getAttribute('data-theme') || 'light', false);
  buildDots();
  mq.addEventListener('change', buildDots);

  /* ---------- Typing the name ----------
     Runs on load and on hover (tap on touch). The <h1> carries the real name via
     aria-label, so assistive tech reads it once rather than 13 incremental updates,
     and the literal text in the HTML is what shows if this script never runs. */
  var nameEl = document.querySelector('.name');
  var nameText = nameEl && nameEl.querySelector('.name-text');
  var NAME_FULL = nameText ? nameText.textContent : '';
  var TYPE_MS = 70;
  var isTyping = false;

  function typeName() {
    if (!nameText || isTyping) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nameText.textContent = NAME_FULL;
      return;
    }
    isTyping = true;
    nameEl.classList.add('is-typing');
    nameText.textContent = '';
    var i = 0;
    (function step() {
      nameText.textContent = NAME_FULL.slice(0, ++i);
      if (i < NAME_FULL.length) {
        setTimeout(step, TYPE_MS);
      } else {
        isTyping = false;
        nameEl.classList.remove('is-typing');
      }
    })();
  }

  if (nameEl) {
    if (matchMedia('(hover: hover)').matches) {
      nameEl.addEventListener('pointerenter', typeName);
    }
    nameEl.addEventListener('click', typeName);
    typeName();
  }

  /* ---------- Post-it colours on the dot grid ----------
     Palette from Figma "Colour - Post it's" (112:44). Hover on pointer devices,
     tap on touch. Colour lands instantly, holds, then fades back to grey.
     Dark mode composites the same hues at lower alpha so they don't glare. */
  var POSTITS = [
    [255, 255, 153], [255, 235, 161], [254, 230,  59], [255, 173, 100], [210, 222,  64],
    [ 55, 210, 216], [248,  58, 167], [255, 249, 165], [249, 184, 188], [176, 205, 235]
  ];
  var HOLD_MS = 1500, DARK_ALPHA = 0.6;

  function paintDot(dot) {
    var prev = dot.dataset.hue === undefined ? -1 : +dot.dataset.hue;
    var i = prev;
    while (i === prev) { i = Math.floor(Math.random() * POSTITS.length); }
    dot.dataset.hue = i;

    var c = POSTITS[i];
    var dark = root.getAttribute('data-theme') === 'dark';
    dot.classList.add('is-lit');
    dot.style.backgroundColor = dark
      ? 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + DARK_ALPHA + ')'
      : 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';

    clearTimeout(dot.fadeTimer);
    dot.fadeTimer = setTimeout(function () {
      dot.classList.remove('is-lit');
      dot.style.backgroundColor = '';
      delete dot.dataset.hue;
    }, HOLD_MS);
  }

  if (dots) {
    var hitDot = function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('dot')) paintDot(t);
    };
    if (matchMedia('(hover: hover)').matches) dots.addEventListener('pointerover', hitDot);

    /* Touch: a drag never fires pointerover past the first element, because the
       pointer is captured. Track the finger instead and paint whatever it crosses,
       so dragging feels like hovering. Not passive:false — the page must still
       scroll normally from the grid. */
    var lastTouched = null;
    var usedTouch = false;

    function paintUnderTouch(e) {
      var t = e.touches && e.touches[0];
      if (!t) return;
      var el = document.elementFromPoint(t.clientX, t.clientY);
      if (el && el.classList && el.classList.contains('dot')) {
        if (el !== lastTouched) { lastTouched = el; paintDot(el); }
      } else {
        lastTouched = null;
      }
    }

    dots.addEventListener('touchstart', function (e) {
      usedTouch = true;
      lastTouched = null;
      paintUnderTouch(e);
    }, { passive: true });
    dots.addEventListener('touchmove', paintUnderTouch, { passive: true });
    dots.addEventListener('touchend', function () { lastTouched = null; }, { passive: true });

    // touchstart already painted; ignore the synthetic click so it doesn't re-roll
    dots.addEventListener('click', function (e) { if (!usedTouch) hitDot(e); });
  }

  /* ---------- Tabs: work / lab / experiments ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  if (tabs.length) {
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
      });
    });
  }

  /* ---------- Work-row hover previews ----------
     Mirrors Figma 265:26968. Only runs where there's room beside the 700px column
     and a real pointer, so phones and narrow windows are unaffected. */
  var preview = document.querySelector('.row-preview');
  var previewOK = matchMedia('(min-width: 1340px) and (hover: hover)');

  function previewSrc(key) {
    var theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    return 'assets/previews/' + key + '-' + theme + '.webp';
  }

  if (preview) {
    document.querySelectorAll('.row[data-preview]').forEach(function (row) {
      row.addEventListener('pointerenter', function () {
        if (!previewOK.matches) return;
        preview.src = previewSrc(row.dataset.preview);
        // pinned to the top of the work list, so it never jumps between rows
        var anchor = document.getElementById('panel-work');
        if (anchor) preview.style.top = anchor.offsetTop + 'px';
        preview.classList.add('is-visible');
      });
      row.addEventListener('pointerleave', function () {
        preview.classList.remove('is-visible');
      });
    });

    /* Touch only: tapping a work row expands its image beneath it. Every row
       behaves the same, so CDC's row stops navigating and its image carries the
       link instead. Gated on (hover: none) so pointer devices keep the hover
       preview and normal link behaviour. */
    var inlineOK = matchMedia('(hover: none)');

    function inlineBox(row) {
      var next = row.nextElementSibling;
      if (next && next.classList.contains('row-inline')) return next;
      var link = row.querySelector('.row-title a');
      var box = document.createElement(link ? 'a' : 'span');
      box.className = 'row-inline';
      if (link) {
        box.setAttribute('href', link.getAttribute('href'));
        box.setAttribute('aria-label', link.textContent.trim() + ' — open case study');
      }
      var img = document.createElement('img');
      img.alt = '';
      box.appendChild(img);
      box.hidden = true;
      row.parentNode.insertBefore(box, row.nextSibling);
      return box;
    }

    document.querySelectorAll('.row[data-preview]').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (!inlineOK.matches) return;
        // first tap reveals the image rather than following the row's link
        if (e.target.closest('.row-title a')) e.preventDefault();
        var box = inlineBox(row);
        box.querySelector('img').src = previewSrc(row.dataset.preview);
        box.hidden = !box.hidden;
      });
    });

    // keep any open inline preview in step with the theme
    document.addEventListener('themechange', function () {
      document.querySelectorAll('.row-inline:not([hidden])').forEach(function (box) {
        var row = box.previousElementSibling;
        if (row && row.dataset.preview) box.querySelector('img').src = previewSrc(row.dataset.preview);
      });
    });

    // warm the cache so the first hover doesn't show an empty frame
    if (previewOK.matches) {
      ['cdc', 'bulk', 'learn', 'saveplus'].forEach(function (k) {
        ['light', 'dark'].forEach(function (t) {
          var im = new Image();
          im.src = 'assets/previews/' + k + '-' + t + '.webp';
        });
      });
    }
  }

  /* ---------- WIP badge on work rows with no case study ----------
     Hover and keyboard focus are handled in CSS. Touch devices have no hover,
     so there a tap toggles the badge instead. */
  var canHover = matchMedia('(hover: hover)').matches;
  document.querySelectorAll('.row[data-wip]').forEach(function (row) {
    var title = row.querySelector('.row-title');
    if (!title || !row.querySelector('.wip')) return;

    title.setAttribute('tabindex', '0');
    title.setAttribute('aria-label', title.textContent.trim() + ' — work in progress');

    if (!canHover) {
      title.addEventListener('click', function () { title.classList.toggle('is-shown'); });
    }
  });
})();
