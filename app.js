(function () {
  var root = document.documentElement;
  var dots = document.getElementById('dots');
  var toggle = document.getElementById('theme-toggle');
  var mq = matchMedia('(min-width: 768px)');
  // the grid's last cells are controls (+a, -a, theme); the rest are dots
  var gridTools = dots ? Array.prototype.slice.call(dots.children) : [];

  function buildDots() {
    if (!dots || !toggle) return;
    // the home page sets its desktop grid size in CSS (--dot-cols / --dot-rows)
    var style = getComputedStyle(dots);
    var cols = mq.matches ? parseInt(style.getPropertyValue('--dot-cols'), 10) || 32 : 14;
    var rows = mq.matches ? parseInt(style.getPropertyValue('--dot-rows'), 10) || 16 : 11;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < rows * cols - gridTools.length; i++) {
      var d = document.createElement('span');
      d.className = 'dot';
      frag.appendChild(d);
    }
    gridTools.forEach(function (t) { frag.appendChild(t); });
    dots.replaceChildren(frag);
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

  /* Theme ripple: the new theme spreads out in a circle from the toggle, via
     the View Transitions API (Chrome, Edge, Safari 18+). Elsewhere, and with
     reduced motion, the theme simply switches. */
  var reduceRipple = matchMedia('(prefers-reduced-motion: reduce)');

  function switchTheme() {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition || reduceRipple.matches) {
      applyTheme(next, true);
      return;
    }
    var r = toggle.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    // .theme-ripple scopes the ripple's CSS to this transition, so page-to-page
    // View Transitions (on pages that opt in) keep their normal cross-fade
    root.classList.add('theme-ripple');
    var vt = document.startViewTransition(function () { applyTheme(next, true); });
    vt.ready.then(function () {
      root.animate({ clipPath: ['circle(0 at ' + x + 'px ' + y + 'px)', 'circle(' + end + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 700, easing: 'cubic-bezier(0.7, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(function () {});
    vt.finished.finally(function () { root.classList.remove('theme-ripple'); });
  }

  if (toggle) toggle.addEventListener('click', switchTheme);

  /* A page-to-page View Transition is cancelled when only one side opts in
     (e.g. an inner page going back to index.html). That's expected, so don't
     let the browser report it as an unhandled error. */
  function quietTransition(e) {
    var t = e.viewTransition;
    if (!t) return;
    [t.ready, t.finished, t.updateCallbackDone].forEach(function (p) { if (p) p.catch(function () {}); });
  }
  addEventListener('pageswap', quietTransition);
  addEventListener('pagereveal', quietTransition);

  /* ---------- Which home page to go back to ----------
     The homepage experiments (index_experiments_*.html) link to the same inner
     pages as index.html. Each home page records itself for the session, and an
     inner page's back link returns to it, keeping any ?tab= or #hash. */
  try {
    if (document.querySelector('main.home')) {
      // the page and its ?query (e.g. ?preset=bonkers), so back returns to the same view
      sessionStorage.setItem('home', (location.pathname.split('/').pop() || 'index.html') + location.search);
      // whether this home page opts into page-to-page View Transitions; the
      // inner pages only opt in when it did (a one-sided opt-in is cancelled)
      sessionStorage.setItem('home-vt', document.getElementById('v2-vt') ? '1' : '0');
    } else {
      var homePage = sessionStorage.getItem('home');
      if (homePage && !/^index\.html(\?|$)/.test(homePage)) {
        document.querySelectorAll('a.back').forEach(function (a) {
          // index.html#work + index_experiments_version2.html?preset=x -> ...?preset=x#work
          var hp = homePage.split('?'), q = hp[1] ? '?' + hp[1] : '';
          a.setAttribute('href', a.getAttribute('href').replace(/^index\.html(\?[^#]*)?/, hp[0] + q));
        });
      }
    }
  } catch (e) {}

  /* ---------- Text size: +a / -a in the inner-page top bar ----------
     Reading text scales by --fs; the step is remembered across pages. The
     <head> of each inner page applies the saved step before first paint. */
  var TEXT_STEPS = [0.875, 1, 1.125, 1.25, 1.375];
  var textButtons = Array.prototype.slice.call(document.querySelectorAll('.text-step'));
  if (textButtons.length) {
    var textStep = 1;
    try {
      var saved = parseInt(localStorage.getItem('textStep'), 10);
      if (TEXT_STEPS[saved]) textStep = saved;
    } catch (e) {}
    var setText = function (i, persist) {
      textStep = Math.max(0, Math.min(TEXT_STEPS.length - 1, i));
      if (textStep === 1) root.style.removeProperty('--fs');
      else root.style.setProperty('--fs', TEXT_STEPS[textStep]);
      textButtons.forEach(function (b) {
        var up = +b.dataset.step > 0;
        b.disabled = up ? textStep === TEXT_STEPS.length - 1 : textStep === 0;
      });
      if (persist) {
        try { localStorage.setItem('textStep', textStep); } catch (e) {}
        // the page got taller or shorter: let the side index re-measure
        dispatchEvent(new Event('resize'));
      }
    };
    textButtons.forEach(function (b) {
      b.addEventListener('click', function () { setText(textStep + +b.dataset.step, true); });
    });
    setText(textStep, false);
  }

  applyTheme(root.getAttribute('data-theme') || 'light', false);
  buildDots();
  mq.addEventListener('change', buildDots);

  /* ---------- Typing the name ----------
     Runs on load and on hover (tap on touch). On the home page the hover and
     tap only count once the name has shrunk to the top (.hm-head.is-small,
     set by fx/home.js): at full size it is too big to keep retyping. The <h1> carries the real name via
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

  function typeAgain() {
    var head = nameEl.closest('.hm-head');
    if (!head || head.classList.contains('is-small')) typeName();
  }

  if (nameEl) {
    if (matchMedia('(hover: hover)').matches) {
      nameEl.addEventListener('pointerenter', typeAgain);
    }
    nameEl.addEventListener('click', typeAgain);
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
    // index.html#writings (from a page's back link) opens on that tab
    var start = location.hash && document.getElementById('tab-' + location.hash.slice(1));
    if (start) {
      start.click();
      start.closest('.section').scrollIntoView({ block: 'center' });
    }
  }

  /* ---------- Left arrow: back to the home page ----------
     Pages with a back link return home on ←. Coming from the home page it's
     the browser's back, so the tab and scroll position are as they were;
     otherwise the back link, which names the tab this page belongs to. */
  var back = document.querySelector('a.back');
  if (back) {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (document.querySelector('.fx-lightbox')) return;
      e.preventDefault();
      var home = new URL(back.getAttribute('href'), location.href);
      var from = null;
      try { from = document.referrer ? new URL(document.referrer) : null; } catch (err) {}
      var bare = function (u) { return u.pathname.replace(/index\.html$/, ''); };
      if (from && from.origin === home.origin && bare(from) === bare(home) && history.length > 1) history.back();
      else location.href = home.href;
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

  /* Rows marked data-preview-video (Learn) preview a short muted loop, the
     .mp4 beside their .webp; with reduced motion they keep the still. */
  var reducePreview = matchMedia('(prefers-reduced-motion: reduce)');
  function previewIsVideo(row) { return row.hasAttribute('data-preview-video') && !reducePreview.matches; }
  function previewMedia(row) {
    var src = previewSrc(row.dataset.preview);
    return previewIsVideo(row) ? src.replace(/\.webp$/, '.mp4') : src;
  }
  function playQuiet(v) {
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
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
    // a third frame for video previews, crossfading with the two images
    var clip = document.createElement('video');
    clip.className = 'row-preview';
    clip.muted = true;
    clip.loop = true;
    clip.playsInline = true;
    clip.preload = 'none';
    clip.setAttribute('aria-hidden', 'true');
    frames[1].after(clip);
    var shown = null; // the frame on screen, or the last one that was

    function setFade(ms) {
      frames.concat(clip).forEach(function (f) { f.style.transitionDuration = ms + 'ms'; });
    }
    // pause the loop once it has faded out, unless it came straight back
    function pauseClip() {
      setTimeout(function () { if (!clip.classList.contains('is-visible')) clip.pause(); }, SWITCH_MS + 50);
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
      var isClip = previewIsVideo(row);
      var cur = shown;
      var src = previewMedia(row);
      if (cur && cur.getAttribute('src') === src) {
        setFade(FADE_MS);
        cur.classList.add('is-visible');
        if (cur === clip) playQuiet(clip);
        return;
      }
      var showing = cur && (cur.classList.contains('is-visible') || performance.now() - leftAt < FADE_MS);
      setFade(showing ? SWITCH_MS : FADE_MS);
      var next = isClip ? clip : frames[1 - active];
      if (next.getAttribute('src') !== src) next.src = src;
      // level with the top of the hovered row
      next.style.top = rowTop(row, next) + 'px';
      next.classList.add('is-visible');
      if (isClip) { clip.currentTime = 0; playQuiet(clip); }
      if (cur && cur !== next) {
        cur.classList.remove('is-visible');
        if (cur === clip) pauseClip();
      }
      if (!isClip) active = 1 - active;
      shown = next;
    }

    document.querySelectorAll('.row[data-preview]').forEach(function (row) {
      row.addEventListener('pointerenter', function () {
        if (previewOK.matches) showPreview(row);
      });
      row.addEventListener('pointerleave', function () {
        setFade(FADE_MS);
        if (shown) shown.classList.remove('is-visible');
        if (shown === clip) pauseClip();
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
      // animated previews are heavier: only this theme's, once the page has loaded
      addEventListener('load', function () { new Image().src = previewSrc('askit'); });
      // and the video preview for this theme, once the page itself has loaded
      var clipRow = document.querySelector('.row[data-preview-video]');
      if (clipRow && previewIsVideo(clipRow)) addEventListener('load', function () {
        if (clip.getAttribute('src')) return;
        clip.preload = 'auto';
        clip.src = previewMedia(clipRow);
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
      var kind = row.closest('#panel-writings, #panel-experiments') ? 'article' : 'case study';
      box.setAttribute('aria-label', link.textContent.trim() + ' — open ' + kind);
    }
    var media = document.createElement(previewIsVideo(row) ? 'video' : 'img');
    if (media.tagName === 'VIDEO') {
      media.muted = true;
      media.loop = true;
      media.playsInline = true;
      media.setAttribute('aria-hidden', 'true');
    } else media.alt = '';
    box.appendChild(media);
    box.hidden = true;
    row.parentNode.insertBefore(box, row.nextSibling);
    return box;
  }

  // the expanded image (or loop) for this theme; loops play only while open
  function setInline(box, row) {
    var m = box.firstElementChild;
    var src = previewMedia(row);
    if (m.getAttribute('src') !== src) m.src = src;
    if (m.tagName === 'VIDEO') { if (box.hidden) m.pause(); else playQuiet(m); }
  }

  // experiments: only rows with artwork, so a plain outside link still opens on tap
  document.querySelectorAll('#panel-work .row, #panel-experiments .row[data-preview], #panel-writings .row').forEach(function (row) {
    row.addEventListener('click', function (e) {
      if (!inlineOK.matches) return;
      // first tap opens the row rather than following its link
      if (e.target.closest('.row-title a')) e.preventDefault();
      var open = row.classList.toggle('is-open');
      if (row.dataset.preview) {
        var box = inlineBox(row);
        box.hidden = !open;
        setInline(box, row);
      }
    });
  });

  // keep any open inline preview in step with the theme
  document.addEventListener('themechange', function () {
    document.querySelectorAll('.row-inline:not([hidden])').forEach(function (box) {
      var row = box.previousElementSibling;
      if (row && row.dataset.preview) setInline(box, row);
    });
  });

  /* ---------- WIP rows: reachable by keyboard ----------
     Focus opens the row in CSS, as hover does. Rows whose title is a link
     (a draft page, e.g. Bulk download) are focusable already. */
  document.querySelectorAll('.row[data-wip]').forEach(function (row) {
    var title = row.querySelector('.row-title');
    var name = row.querySelector('.title');
    if (!title || !name || name.tagName === 'A') return;
    title.setAttribute('tabindex', '0');
    title.setAttribute('aria-label', name.textContent.trim() + ' — work in progress');
  });
})();
