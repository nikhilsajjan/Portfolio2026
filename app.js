(function () {
  var root = document.documentElement;
  var dots = document.getElementById('dots');
  var toggle = document.getElementById('theme-toggle');
  var mq = matchMedia('(min-width: 768px)');

  function buildDots() {
    if (!dots || !toggle) return;
    // the home page sets its desktop grid size in CSS (--dot-cols / --dot-rows)
    var style = getComputedStyle(dots);
    var cols = mq.matches ? parseInt(style.getPropertyValue('--dot-cols'), 10) || 32 : 14;
    var rows = mq.matches ? parseInt(style.getPropertyValue('--dot-rows'), 10) || 16 : 11;
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
     drag on touch. Colour lands instantly, then fades linearly back to grey over
     4s (the .dot transition), starting at once with no hold. Re-hovering restarts it.
     Dark mode composites the same hues at lower alpha so they don't glare. */
  var POSTITS = [
    [255, 255, 153], [255, 235, 161], [254, 230,  59], [255, 173, 100], [210, 222,  64],
    [ 55, 210, 216], [248,  58, 167], [255, 249, 165], [249, 184, 188], [176, 205, 235]
  ];
  var DARK_ALPHA = 0.6;
  var HOLD_MS = 1500; // reduced motion only: no fade, so hold the colour then snap back
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function paintDot(dot) {
    var prev = dot.dataset.hue === undefined ? -1 : +dot.dataset.hue;
    var i = prev;
    while (i === prev) { i = Math.floor(Math.random() * POSTITS.length); }
    dot.dataset.hue = i;

    var c = POSTITS[i];
    var dark = root.getAttribute('data-theme') === 'dark';
    var colour = dark
      ? 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + DARK_ALPHA + ')'
      : 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';

    clearTimeout(dot.fadeTimer);
    // land the colour with no transition, commit it, then let the CSS fade run
    dot.style.transition = 'none';
    dot.style.backgroundColor = colour;
    void dot.offsetWidth;
    dot.style.transition = '';
    dot.classList.add('is-fading');

    if (reduceMotion.matches) {
      dot.fadeTimer = setTimeout(function () { dot.style.backgroundColor = ''; }, HOLD_MS);
    } else {
      dot.style.backgroundColor = '';
    }
  }

  if (dots) {
    // back to the 1s theme transition once a dot has faded out
    dots.addEventListener('transitionend', function (e) {
      if (e.target.classList.contains('dot') && !e.target.style.backgroundColor) {
        e.target.classList.remove('is-fading');
      }
    });

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
     Mirrors Figma 323:15750. Only runs where there's room beside the column
     and a real pointer, so phones and narrow windows are unaffected. */
  var preview = document.querySelector('.row-preview');
  var previewOK = matchMedia('(min-width: 1390px) and (hover: hover)');

  function previewSrc(key) {
    var theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    return 'assets/previews/' + key + '-' + theme + '.webp';
  }

  if (preview) {
    /* Two stacked frames so moving between rows crossfades rather than swapping:
       300ms fade in from nothing and out to nothing, 450ms when the previous
       image is still showing (or still fading out) as the next row is entered. */
    var FADE_MS = 300, SWITCH_MS = 450;
    var frames = [preview, preview.cloneNode()];
    preview.after(frames[1]);
    var active = 0;
    var leftAt = -Infinity;

    function setFade(ms) {
      frames.forEach(function (f) { f.style.transitionDuration = ms + 'ms'; });
    }

    /* Top of the row as it will sit once the list settles: rows above it close
       their summaries as the pointer leaves, so measure them shut (title line
       plus spacing) rather than mid-animation. Measured on screen against the
       box the image is positioned in, so an animated (transformed) ancestor
       can't change what offsetTop is relative to. */
    function rowTop(row, frame) {
      var base = frame.offsetParent ? frame.offsetParent.getBoundingClientRect().top : 0;
      var first = row.parentNode.firstElementChild;
      var top = row.parentNode.getBoundingClientRect().top - base;
      for (var r = first; r !== row; r = r.nextElementSibling) {
        if (!r.classList.contains('row')) continue;
        top += r.querySelector('.row-head').offsetHeight + parseFloat(getComputedStyle(r).paddingBottom);
      }
      return top;
    }

    function showPreview(row) {
      var key = row.dataset.preview;
      var cur = frames[active];
      var src = previewSrc(key);
      if (cur.getAttribute('src') === src) {
        setFade(FADE_MS);
        cur.classList.add('is-visible');
        return;
      }
      var showing = cur.classList.contains('is-visible') || performance.now() - leftAt < FADE_MS;
      setFade(showing ? SWITCH_MS : FADE_MS);
      var next = frames[1 - active];
      next.src = src;
      // level with the top of the hovered row
      next.style.top = rowTop(row, next) + 'px';
      next.classList.add('is-visible');
      cur.classList.remove('is-visible');
      active = 1 - active;
    }

    document.querySelectorAll('.row[data-preview]').forEach(function (row) {
      row.addEventListener('pointerenter', function () {
        if (previewOK.matches) showPreview(row);
      });
      row.addEventListener('pointerleave', function () {
        setFade(FADE_MS);
        frames[active].classList.remove('is-visible');
        leftAt = performance.now();
      });
    });

    // warm the cache so the first hover doesn't show an empty frame
    if (previewOK.matches) {
      ['cdc', 'bulk', 'learn', 'saveplus', 'figma'].forEach(function (k) {
        ['light', 'dark'].forEach(function (t) {
          var im = new Image();
          im.src = 'assets/previews/' + k + '-' + t + '.webp';
        });
      });
    }
  }

  /* ---------- Work rows on touch ----------
     No hover, so a tap opens the row instead: its summary, its WIP badge and,
     where it has artwork, the image expanded beneath it. Every row behaves the
     same, so CDC's row stops navigating and its image carries the link instead.
     Gated on (hover: none) so pointer devices keep hover and normal links. */
  var inlineOK = matchMedia('(hover: none)');

  function inlineBox(row) {
    var next = row.nextElementSibling;
    if (next && next.classList.contains('row-inline')) return next;
    var link = row.querySelector('.row-title a');
    var box = document.createElement(link ? 'a' : 'span');
    box.className = 'row-inline';
    if (link) {
      box.setAttribute('href', link.getAttribute('href'));
      var kind = row.closest('#panel-writings') ? 'article' : 'case study';
      box.setAttribute('aria-label', link.textContent.trim() + ' — open ' + kind);
    }
    var img = document.createElement('img');
    img.alt = '';
    box.appendChild(img);
    box.hidden = true;
    row.parentNode.insertBefore(box, row.nextSibling);
    return box;
  }

  document.querySelectorAll('#panel-work .row, #panel-writings .row').forEach(function (row) {
    row.addEventListener('click', function (e) {
      if (!inlineOK.matches) return;
      // first tap opens the row rather than following its link
      if (e.target.closest('.row-title a')) e.preventDefault();
      var open = row.classList.toggle('is-open');
      if (row.dataset.preview) {
        var box = inlineBox(row);
        box.querySelector('img').src = previewSrc(row.dataset.preview);
        box.hidden = !open;
      }
    });
  });

  // keep any open inline preview in step with the theme
  document.addEventListener('themechange', function () {
    document.querySelectorAll('.row-inline:not([hidden])').forEach(function (box) {
      var row = box.previousElementSibling;
      if (row && row.dataset.preview) box.querySelector('img').src = previewSrc(row.dataset.preview);
    });
  });

  /* ---------- WIP rows: reachable by keyboard ----------
     Focus opens the row in CSS, as hover does. */
  document.querySelectorAll('.row[data-wip]').forEach(function (row) {
    var title = row.querySelector('.row-title');
    var name = row.querySelector('.title');
    if (!title || !name) return;
    title.setAttribute('tabindex', '0');
    title.setAttribute('aria-label', name.textContent.trim() + ' — work in progress');
  });
})();
