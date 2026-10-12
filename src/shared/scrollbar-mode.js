// Marks <html data-lumno-scrollbars="overlay"> when the system draws overlay
// scrollbars (macOS with "Show scroll bars: Automatically" and no mouse), so
// macOS keeps its own bar that shows while scrolling. Everywhere else, such as
// Windows or macOS set to always show scroll bars, our thin bar replaces the
// wide system one; styles treat an unmarked page the same way.
(function() {
  'use strict';

  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) {
    return;
  }

  function measure() {
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = [
      'position: absolute',
      'top: -200px',
      'left: -200px',
      'width: 100px',
      'height: 100px',
      'overflow: scroll',
      'visibility: hidden',
      'pointer-events: none'
    ].join(';');
    root.appendChild(probe);
    const width = probe.offsetWidth - probe.clientWidth;
    probe.remove();
    const mode = width > 0 ? 'classic' : 'overlay';
    if (root.getAttribute('data-lumno-scrollbars') !== mode) {
      root.setAttribute('data-lumno-scrollbars', mode);
    }
  }

  measure();
  // Connecting or removing a mouse switches macOS between the two kinds.
  window.addEventListener('focus', measure);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      measure();
    }
  });
})();
