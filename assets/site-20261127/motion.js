
// Default HTML stays readable if scripts or observers fail.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const plans = new Map();
  let observer;
  const headingSelector = 'main h1, main h2, main h3';
  const graphemes = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(root.lang, { granularity: 'grapheme' }) : null;
  const letters = text => graphemes
    ? Array.from(graphemes.segment(text), item => item.segment) : Array.from(text);

  function finish(element) {
    const plan = plans.get(element);
    if (!plan) return;
    clearTimeout(plan.timer);
    element.dataset.motionState = 'done';
    observer?.unobserve(element);
  }

  function reveal(element) {
    const plan = plans.get(element);
    if (!plan || element.dataset.motionState !== 'pending') return;
    element.dataset.motionState = 'running';
    observer?.unobserve(element);
    const total = reduced.matches ? 120 : plan.duration + plan.delay;
    plan.timer = setTimeout(() => finish(element), total + 48);
  }

  function prepare(element, kind, delay = 0) {
    if (plans.has(element) || element.closest('[hidden], details:not([open])')) return;
    element.dataset.motion = kind;
    element.dataset.motionState = 'pending';
    element.style.setProperty('--reveal-delay', delay + 'ms');
    plans.set(element, { duration: kind === 'rise' ? 360 : 520, delay, timer: null });
  }

  function splitHeading(heading) {
    const label = heading.innerText.replace(/\s+/g, ' ').trim();
    const visual = document.createElement('span');
    visual.className = 'motion-heading-copy';
    visual.setAttribute('aria-hidden', 'true');
    const glyphs = [];
    function append(source, destination) {
      if (source.nodeType === Node.TEXT_NODE) {
        source.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { destination.append(document.createTextNode(part)); return; }
          const word = document.createElement('span');
          word.className = 'motion-word';
          letters(part).forEach(letter => {
            const glyph = document.createElement('span');
            glyph.className = 'motion-char';
            glyph.textContent = letter;
            glyphs.push(glyph);
            word.append(glyph);
          });
          destination.append(word);
        });
      } else if (source.nodeType === Node.ELEMENT_NODE) {
        const copy = source.cloneNode(false);
        Array.from(source.childNodes).forEach(child => append(child, copy));
        destination.append(copy);
      }
    }
    Array.from(heading.childNodes).forEach(node => append(node, visual));
    const hero = heading.tagName === 'H1';
    const duration = hero ? 660 : 520;
    const spread = hero ? 360 : 280;
    const step = Math.min(hero ? 22 : 18, spread / Math.max(1, glyphs.length - 1));
    glyphs.forEach((glyph, index) => glyph.style.setProperty('--letter-delay', index * step + 'ms'));
    heading.setAttribute('aria-label', label);
    heading.replaceChildren(visual);
    heading.style.setProperty('--motion-duration', duration + 'ms');
    const plan = plans.get(heading);
    plan.duration = duration;
    plan.delay = Math.max(0, glyphs.length - 1) * step;
  }

  if (root.dataset.motion === 'off' || reduced.matches) return;
  new MutationObserver(() => { if (root.dataset.motion === 'off') plans.forEach((_, element) => finish(element)); }).observe(root, {attributes:true,attributeFilter:['data-motion']});

  try {
    document.querySelectorAll(headingSelector).forEach(heading => {
      prepare(heading, 'letters');
      if (plans.has(heading)) splitHeading(heading);
    });
    const supporting = ['.hero-side > p', '.hero-side > .button', '.attention-copy > p', '.attention-stat', '.app-intro-copy > p', '.app-mechanics > div', '.tag-copy > .body-copy', '.capsule-copy > .body-copy', '.capsule-copy > .text-link', '.impact-intro > p', '.impact-intro > .text-link', '.metric'].join(',');
    document.querySelectorAll(supporting).forEach(element => {
      const delay = element.matches('.hero-side > .btn, .product-copy > .text-link') ? 200
        : element.matches('.hero-side > p, .product-copy > p, .impact .lead') ? 100 : 0;
      prepare(element, 'rise', delay);
    });
    document.querySelectorAll('.hero-media, .mockup-card, .tag-visual, .capsule-photo, .footer-top, .footer-bottom')
      .forEach(element => prepare(element, 'fade', element.matches('.hero-image') ? 200 : 0));

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); });
      }, { rootMargin: '0px 0px -24px 0px', threshold: 0 });
      root.classList.add('motion-ready');
      plans.forEach((_, element) => observer.observe(element));
    } else {
      plans.forEach((_, element) => finish(element));
    }
    // Keyboard users never wait for a focused action to become visible.
    document.addEventListener('focusin', event => {
      plans.forEach((_, element) => { if (element.contains(event.target)) finish(element); });
    });
    reduced.addEventListener('change', event => {
      if (event.matches) plans.forEach((_, element) => finish(element));
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) plans.forEach((_, element) => {
        if (element.dataset.motionState === 'running') finish(element);
      });
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted) plans.forEach((_, element) => finish(element));
    });
  } catch {
    root.classList.remove('motion-ready');
    plans.forEach((_, element) => finish(element));
  }
})();
