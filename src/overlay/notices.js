(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoOverlayNotices = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function getNoticeElement(controller) {
    return controller && controller.element ? controller.element : null;
  }

  // Hosts the update and engagement notices just above the overlay panel.
  // They mount beside the panel (never inside it, so they take no part in its
  // layout), follow its width, position, viewport scale and theme, and stop
  // listening when the overlay closes.
  function createNoticeLayer(win, config) {
    const settings = config && typeof config === 'object' ? config : {};
    const doc = win.document;
    let frameListener = null;
    let frameViewport = null;
    let mountTimer = null;

    function getNotices() {
      return {
        update: typeof settings.getUpdateNotice === 'function' ? settings.getUpdateNotice() : null,
        engagement: typeof settings.getEngagementNotice === 'function'
          ? settings.getEngagementNotice()
          : null
      };
    }

    function decorate(element) {
      if (typeof settings.decorate === 'function') {
        settings.decorate(element);
      }
    }

    function sync(panel) {
      const notices = getNotices();
      const elements = [
        getNoticeElement(notices.update),
        getNoticeElement(notices.engagement)
      ].filter(Boolean);
      if (elements.length === 0 || !panel) {
        return;
      }
      const sizePreset = typeof settings.getSizePreset === 'function'
        ? settings.getSizePreset()
        : null;
      const fallbackWidth = sizePreset && sizePreset.width ? `${sizePreset.width}px` : '';
      const width = panel.style.getPropertyValue('width') || fallbackWidth;
      const maxWidth = panel.style.getPropertyValue('max-width') || 'calc(100vw - 24px)';
      const left = panel.style.getPropertyValue('left') || '50%';
      const top = panel.style.getPropertyValue('top') || '20vh';
      const visibleScale = panel.style.getPropertyValue('--x-ov-visible-scale') || '1';
      elements.forEach((element) => {
        element.style.setProperty('width', width, 'important');
        element.style.setProperty('max-width', maxWidth, 'important');
        element.style.setProperty('left', left, 'important');
        element.style.setProperty('top', top, 'important');
        element.style.setProperty('--x-ov-visible-scale', visibleScale, 'important');
        if (typeof element.style.removeProperty === 'function') {
          element.style.removeProperty('zoom');
        }
        element.setAttribute('data-theme', panel.getAttribute('data-theme') || '');
      });
    }

    function stopFrameSync() {
      if (!frameListener) {
        return;
      }
      win.removeEventListener('resize', frameListener);
      if (frameViewport && typeof frameViewport.removeEventListener === 'function') {
        frameViewport.removeEventListener('resize', frameListener);
      }
      frameListener = null;
      frameViewport = null;
    }

    function startFrameSync(panel) {
      stopFrameSync();
      if (!panel) {
        return;
      }
      frameListener = () => {
        sync(panel);
      };
      win.addEventListener('resize', frameListener, { passive: true });
      if (win.visualViewport && typeof win.visualViewport.addEventListener === 'function') {
        win.visualViewport.addEventListener('resize', frameListener, { passive: true });
        frameViewport = win.visualViewport;
      }
      sync(panel);
    }

    function insertAbovePanel(element, panel, styleRoot) {
      decorate(element);
      if (styleRoot && typeof styleRoot.insertBefore === 'function') {
        styleRoot.insertBefore(element, panel);
      } else if (doc.body) {
        doc.body.appendChild(element);
      }
    }

    function shouldAnimateMount(element) {
      if (element.getAttribute('data-visible') !== 'true') {
        return false;
      }
      return !win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // Mounts the update notice (counting one exposure) and then the
    // engagement notice. A visible update notice blurs in: it carries
    // data-overlay-mounting for two frames after insertion.
    function mount(panel, styleRoot) {
      const notices = getNotices();
      const noticeElement = getNoticeElement(notices.update);
      if (!noticeElement || noticeElement.parentNode) {
        return;
      }
      const animateMount = shouldAnimateMount(noticeElement);
      if (animateMount) {
        noticeElement.setAttribute('data-overlay-mounting', 'true');
      }
      insertAbovePanel(noticeElement, panel, styleRoot);
      if (typeof notices.update.recordExposure === 'function') {
        notices.update.recordExposure();
      }
      sync(panel);
      const finishMountAnimation = () => {
        noticeElement.removeAttribute('data-overlay-mounting');
      };
      if (animateMount) {
        win.requestAnimationFrame(() => {
          win.requestAnimationFrame(finishMountAnimation);
        });
      } else {
        finishMountAnimation();
      }
      const engagementNoticeElement = getNoticeElement(notices.engagement);
      if (engagementNoticeElement && !engagementNoticeElement.parentNode) {
        insertAbovePanel(engagementNoticeElement, panel, styleRoot);
        sync(panel);
      }
    }

    function clearMountTimer() {
      if (mountTimer !== null) {
        win.clearTimeout(mountTimer);
        mountTimer = null;
      }
    }

    function scheduleMount(panel, styleRoot, delayMs) {
      clearMountTimer();
      mountTimer = win.setTimeout(() => {
        mountTimer = null;
        if (!panel || !panel.isConnected) {
          return;
        }
        mount(panel, styleRoot);
      }, Math.max(0, Number(delayMs) || 0));
    }

    function stop() {
      stopFrameSync();
      clearMountTimer();
    }

    return Object.freeze({
      mount,
      scheduleMount,
      startFrameSync,
      stop,
      sync
    });
  }

  return Object.freeze({
    createNoticeLayer
  });
});
