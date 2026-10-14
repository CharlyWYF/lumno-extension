(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoNewtabDragClickGuard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // Releasing a dragged shortcut, bookmark or group title also fires a click
  // on whatever is under the pointer, which would open the site or toggle
  // the folder the drag just dropped. One policy for every drag on the page:
  //
  //   After a drag is released, the single pointer click that follows is
  //   swallowed, wherever it lands, if it comes within DRAG_CLICK_GUARD_MS.
  //   A new press before that click ends the guard, so a deliberate next
  //   click still works; keyboard activations always pass.
  //
  // A drag canceled while the pointer is still held (Escape) waits for that
  // pointer's release first, then guards the same way.
  const DRAG_CLICK_GUARD_MS = 420;

  function createDragClickGuard(options) {
    const opts = options || {};
    const windowObj = opts.windowObj || (typeof window !== 'undefined' ? window : null);
    const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
    const guardMs = Number.isFinite(opts.guardMs) ? opts.guardMs : DRAG_CLICK_GUARD_MS;
    let armedUntil = 0;
    let waitingPointerId = null;
    let listening = false;

    // Enter or Space on a focused control also fires a click, with no
    // press count and no pointer type; a release that fired no click (its
    // target was removed) must not swallow that.
    function isPointerClick(event) {
      return Number(event.detail) > 0 ||
        (typeof event.pointerType === 'string' && event.pointerType !== '');
    }

    function handleClick(event) {
      if (!armedUntil || !isPointerClick(event)) {
        return;
      }
      const active = now() <= armedUntil;
      disarm();
      if (active) {
        event.preventDefault();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
        event.stopPropagation();
      }
    }

    function handlePointerDown() {
      // The held pointer of a canceled drag is already down; any press is new.
      disarm();
    }

    function handleRelease(event) {
      if (waitingPointerId === null || (event && event.pointerId !== waitingPointerId)) {
        return;
      }
      waitingPointerId = null;
      armedUntil = now() + guardMs;
    }

    function listen() {
      if (listening || !windowObj || typeof windowObj.addEventListener !== 'function') {
        return;
      }
      listening = true;
      // The window sees the click before any page listener, React's included.
      windowObj.addEventListener('click', handleClick, true);
      windowObj.addEventListener('pointerdown', handlePointerDown, true);
      windowObj.addEventListener('pointerup', handleRelease, true);
      windowObj.addEventListener('pointercancel', handleRelease, true);
    }

    function unlisten() {
      if (!listening) {
        return;
      }
      listening = false;
      windowObj.removeEventListener('click', handleClick, true);
      windowObj.removeEventListener('pointerdown', handlePointerDown, true);
      windowObj.removeEventListener('pointerup', handleRelease, true);
      windowObj.removeEventListener('pointercancel', handleRelease, true);
    }

    function disarm() {
      armedUntil = 0;
      waitingPointerId = null;
      unlisten();
    }

    // The drag ended with its pointer's release.
    function armAfterRelease() {
      waitingPointerId = null;
      armedUntil = now() + guardMs;
      listen();
    }

    // The drag ended while `pointerId` is still held down.
    function armUntilRelease(pointerId) {
      armedUntil = 0;
      waitingPointerId = pointerId;
      listen();
    }

    // `release` is the pointer event that ended the drag, or null when the
    // drag was canceled without one.
    function armAfterDrag(release, pointerId) {
      if (release) {
        armAfterRelease();
      } else {
        armUntilRelease(pointerId);
      }
    }

    function isArmed() {
      return waitingPointerId !== null || (armedUntil > 0 && now() <= armedUntil);
    }

    return {
      armAfterDrag,
      armAfterRelease,
      armUntilRelease,
      isArmed,
      disarm
    };
  }

  let sharedGuard = null;
  function getDragClickGuard() {
    if (!sharedGuard) {
      sharedGuard = createDragClickGuard();
    }
    return sharedGuard;
  }

  return {
    DRAG_CLICK_GUARD_MS,
    createDragClickGuard,
    getDragClickGuard
  };
});
