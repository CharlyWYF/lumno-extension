(function(root) {
  'use strict';

  // Height motion for the Options panel. When a setting shows or hides rows,
  // the panel animates from its old height to its new one, and the focused
  // control (usually the switch just clicked) stays where it was on screen:
  // the page scrolls by however far it moved, and a transparent reserve below
  // the panel keeps the browser from clamping that scroll near the bottom.
  const HEIGHT_ANIMATION_DURATION_MS = 280;
  const HEIGHT_ANIMATION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

  // Shows or hides one conditional setting; with visibleDisplay it toggles
  // style.display instead of hidden. Returns whether visibility changed.
  function setConditionalSettingsElementVisibility(element, visible, visibleDisplay) {
    if (!element) {
      return false;
    }
    const shouldShow = Boolean(visible);
    const wasVisible = visibleDisplay
      ? element.style.display !== 'none'
      : !element.hidden;
    if (visibleDisplay) {
      element.style.setProperty('display', shouldShow ? visibleDisplay : 'none');
    } else {
      element.hidden = !shouldShow;
    }
    element.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    return wasVisible !== shouldShow;
  }

  //   panel        the element whose height animates
  //   reserveHost  the element whose --settings-focus-anchor-reserve keeps
  //                room below the panel
  //   documentObj, windowObj
  // animate(mutateLayout) runs mutateLayout (which returns false when nothing
  // changed) and animates the resulting height change; cancel() stops it.
  function createPanelHeightAnimator(options) {
    const panel = options.panel;
    const reserveHost = options.reserveHost;
    const documentObj = options.documentObj;
    const windowObj = options.windowObj;
    let heightAnimation = null;
    let reservedAnchor = null;
    let focusAnchorReserve = 0;

    function getFocusedPanelAnchor() {
      const activeElement = documentObj.activeElement;
      if (!activeElement || activeElement === documentObj.body || !panel.contains(activeElement) ||
          typeof activeElement.getBoundingClientRect !== 'function') {
        return null;
      }
      const rect = activeElement.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0 ? activeElement : null;
    }

    function setFocusAnchorReserve(anchor, reserve) {
      const nextReserve = Number.isFinite(reserve) ? Math.max(0, Math.ceil(reserve)) : 0;
      reservedAnchor = nextReserve > 0 ? anchor : null;
      focusAnchorReserve = nextReserve;
      if (nextReserve > 0) {
        reserveHost.style.setProperty('--settings-focus-anchor-reserve', `${nextReserve}px`);
        return;
      }
      reserveHost.style.removeProperty('--settings-focus-anchor-reserve');
    }

    function clearFocusAnchorReserve() {
      setFocusAnchorReserve(null, 0);
    }

    function releaseFocusAnchorReserve(event) {
      const anchor = reservedAnchor;
      const target = event && event.target;
      if (!anchor || !target || target === anchor ||
          (typeof anchor.contains === 'function' && anchor.contains(target))) {
        return;
      }
      clearFocusAnchorReserve();
    }

    function primeFocusAnchorReserve(anchor, beforeHeight) {
      if (!anchor) {
        return;
      }
      setFocusAnchorReserve(
        anchor,
        Math.max(focusAnchorReserve, Number.isFinite(beforeHeight) ? beforeHeight : 0)
      );
    }

    function stabilizeFocusAnchor(anchor, focusTop, minimumHeightReduction) {
      if (!anchor || !Number.isFinite(focusTop) || !anchor.isConnected) {
        clearFocusAnchorReserve();
        return;
      }
      const heightReduction = Number.isFinite(minimumHeightReduction)
        ? Math.max(0, minimumHeightReduction)
        : 0;
      for (let pass = 0; pass < 2; pass += 1) {
        const nextFocusTop = anchor.getBoundingClientRect().top;
        const focusOffset = nextFocusTop - focusTop;
        if (Number.isFinite(focusOffset) && Math.abs(focusOffset) > 0.5) {
          windowObj.scrollBy(0, focusOffset);
        }
        const baseDocumentHeight = Math.max(
          0,
          documentObj.documentElement.scrollHeight - focusAnchorReserve - heightReduction
        );
        const requiredReserve = Math.max(
          0,
          windowObj.scrollY + windowObj.innerHeight - baseDocumentHeight + 2
        );
        setFocusAnchorReserve(anchor, requiredReserve);
      }
    }

    function cancel() {
      const animation = heightAnimation;
      heightAnimation = null;
      if (animation) {
        animation.onfinish = null;
        animation.cancel();
      }
      panel.style.removeProperty('height');
      panel.removeAttribute('data-height-animating');
      clearFocusAnchorReserve();
    }

    function shouldAnimate() {
      if (!documentObj.documentElement ||
          documentObj.documentElement.getAttribute('data-lumno-options-ready') !== 'true' ||
          typeof panel.animate !== 'function') {
        return false;
      }
      if (typeof panel.getClientRects === 'function' && panel.getClientRects().length === 0) {
        return false;
      }
      return !(typeof windowObj.matchMedia === 'function' &&
        windowObj.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function animate(mutateLayout) {
      if (typeof mutateLayout !== 'function') {
        return false;
      }
      const animationInProgress = Boolean(heightAnimation);
      const previousFocusAnchor = reservedAnchor;
      const previousFocusAnchorReserve = focusAnchorReserve;
      const beforeHeight = panel.getBoundingClientRect().height;
      const focusAnchor = getFocusedPanelAnchor();
      const focusTop = focusAnchor ? focusAnchor.getBoundingClientRect().top : null;
      primeFocusAnchorReserve(focusAnchor, beforeHeight);
      panel.setAttribute('data-height-animating', 'true');

      const layoutChanged = mutateLayout() !== false;
      if (!layoutChanged) {
        setFocusAnchorReserve(previousFocusAnchor, previousFocusAnchorReserve);
        if (!animationInProgress) {
          panel.removeAttribute('data-height-animating');
        }
        return false;
      }

      if (heightAnimation) {
        const previousAnimation = heightAnimation;
        heightAnimation = null;
        previousAnimation.onfinish = null;
        previousAnimation.cancel();
      }
      panel.style.removeProperty('height');
      const afterHeight = panel.getBoundingClientRect().height;
      const canAnimateHeight = shouldAnimate() &&
        Number.isFinite(beforeHeight) && Number.isFinite(afterHeight) &&
        Math.abs(afterHeight - beforeHeight) >= 0.5;

      stabilizeFocusAnchor(
        focusAnchor,
        focusTop,
        canAnimateHeight ? Math.max(0, afterHeight - beforeHeight) : 0
      );

      if (!canAnimateHeight) {
        panel.removeAttribute('data-height-animating');
        return true;
      }

      panel.style.height = `${afterHeight}px`;
      const animation = panel.animate(
        [
          { height: `${beforeHeight}px` },
          { height: `${afterHeight}px` }
        ],
        {
          duration: HEIGHT_ANIMATION_DURATION_MS,
          easing: HEIGHT_ANIMATION_EASING,
          fill: 'both'
        }
      );
      heightAnimation = animation;
      animation.onfinish = () => {
        if (heightAnimation !== animation) {
          return;
        }
        heightAnimation = null;
        animation.onfinish = null;
        animation.cancel();
        panel.style.removeProperty('height');
        panel.removeAttribute('data-height-animating');
        stabilizeFocusAnchor(focusAnchor, focusTop, 0);
      };
      return true;
    }

    // A click or focus anywhere else ends the reserve kept for the anchor.
    documentObj.addEventListener('pointerdown', releaseFocusAnchorReserve, true);
    documentObj.addEventListener('focusin', releaseFocusAnchorReserve, true);

    return Object.freeze({ animate, cancel });
  }

  const api = Object.freeze({ createPanelHeightAnimator, setConditionalSettingsElementVisibility });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LumnoOptionsPanelMotion = api;
})(globalThis);
