(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoOverlayKeyboard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function isTrustedKeyEvent(event) {
    return Boolean(event) && event.isTrusted === true;
  }

  // A page-level key listener must only act on keys meant for the overlay:
  // keys from inside its mount host, or keys sent while nothing on the page
  // holds focus (they then target the body or the document). A focused
  // host-page control - including an editable body - keeps its own keys.
  function isOverlayKeyEvent(event, mount) {
    if (!event) {
      return false;
    }
    const config = mount && typeof mount === 'object' ? mount : {};
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if ((config.host && path.includes(config.host)) ||
        (config.panel && path.includes(config.panel))) {
      return true;
    }
    const target = event.target;
    const doc = config.document || (target && target.ownerDocument) || null;
    if (!target || target === doc || (doc && target === doc.defaultView)) {
      return true;
    }
    if (doc && (target === doc.body || target === doc.documentElement)) {
      const editableAttribute = typeof target.getAttribute === 'function'
        ? target.getAttribute('contenteditable')
        : null;
      const editable = target.isContentEditable === true ||
        String(doc.designMode || '').toLowerCase() === 'on' ||
        (editableAttribute !== null && editableAttribute.toLowerCase() !== 'false');
      return !editable;
    }
    return false;
  }

  // Routes page-level keyboard events while the overlay is open:
  // - window capture keydown/keypress/keyup: keys typed into the overlay input
  //   or its scope panel run Lumno's handling and are then kept away from the
  //   host page and other extensions (modifier keydown/keyup pass so browser,
  //   system and Lumno's own input shortcuts work; modifier keypress does not,
  //   since pages use it to pull focus into their own editor);
  // - document capture keydown: Tab in the input (the double-Tab scope
  //   shortcut) runs before page handlers;
  // - document keydown/keyup: keys that reach the page while the overlay owns
  //   the keyboard (focus inside the overlay, or nowhere); a focused host-page
  //   control keeps its keys, except Escape, which closes the overlay;
  // - window blur: modifier tracking resets.
  // Synthetic (untrusted) events never drive the overlay. `handlers` supplies
  // the overlay's state queries and actions.
  function createOverlayKeyRouter(win, handlers) {
    const doc = win.document;
    const config = handlers && typeof handlers === 'object' ? handlers : {};
    const isTrustedEvent = typeof config.isTrustedEvent === 'function'
      ? config.isTrustedEvent
      : isTrustedKeyEvent;
    let started = false;

    function call(name, event) {
      return typeof config[name] === 'function' ? config[name](event) : undefined;
    }

    function handleCapturedKey(event) {
      if (!isTrustedEvent(event)) {
        if (event && typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
        return;
      }
      if (!call('isOverlayConnected')) {
        return;
      }
      if (event.type === 'keyup') {
        call('onKeyUp', event);
      }
      const searchInputActive = Boolean(call('isSearchInputActive'));
      const modeMenuActive = Boolean(call('shouldHandleModeMenuKey', event));
      if (!searchInputActive && !modeMenuActive) {
        return;
      }
      if (call('isImeComposition', event)) {
        event.stopImmediatePropagation();
        return;
      }
      call('syncModifiers', event);
      if ((event.type === 'keydown' || event.type === 'keyup') &&
          call('handleNumberShortcut', event)) {
        event.stopImmediatePropagation();
        return;
      }
      if (event.type === 'keydown' && searchInputActive &&
          call('getSuggestionNavigationKey', event)) {
        call('handleInputKeydown', event);
        event.stopImmediatePropagation();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        // A keypress carries no browser shortcut, so the page never needs it.
        // Some pages refocus their own editor on any keypress while the
        // focused element is not a native input - the closed shadow host
        // never is - and would take the paste of Cmd+V (ChatGPT).
        if (event.type === 'keypress') {
          event.stopImmediatePropagation();
        }
        return;
      }
      if (event.type === 'keydown') {
        if (!modeMenuActive || call('handleModeMenuKey', event) !== true) {
          call('handleInputKeydown', event);
        }
      } else if (event.type === 'keyup') {
        call('syncModifiers', event);
      }
      event.stopImmediatePropagation();
    }

    function handleCapturedTab(event) {
      if (!isTrustedEvent(event) || event.key !== 'Tab') {
        return;
      }
      if (!call('isSearchInputActive')) {
        return;
      }
      call('handleTab', event);
    }

    function handleDocumentKeydown(event) {
      if (!isTrustedEvent(event)) {
        return;
      }
      if (!isOverlayKeyEvent(event, call('getMount'))) {
        if (event.key === 'Escape') {
          call('onEscapeOutside', event);
        }
        return;
      }
      call('handleOverlayKeydown', event);
    }

    function handleDocumentKeyup(event) {
      if (!isTrustedEvent(event) || !isOverlayKeyEvent(event, call('getMount'))) {
        return;
      }
      call('handleOverlayKeyup', event);
    }

    function handleBlur() {
      call('onBlur');
    }

    function start() {
      if (started) {
        return;
      }
      started = true;
      win.addEventListener('keydown', handleCapturedKey, true);
      win.addEventListener('keypress', handleCapturedKey, true);
      win.addEventListener('keyup', handleCapturedKey, true);
      doc.addEventListener('keydown', handleCapturedTab, true);
      doc.addEventListener('keydown', handleDocumentKeydown);
      doc.addEventListener('keyup', handleDocumentKeyup);
      win.addEventListener('blur', handleBlur);
    }

    function stop() {
      if (!started) {
        return;
      }
      started = false;
      win.removeEventListener('keydown', handleCapturedKey, true);
      win.removeEventListener('keypress', handleCapturedKey, true);
      win.removeEventListener('keyup', handleCapturedKey, true);
      doc.removeEventListener('keydown', handleCapturedTab, true);
      doc.removeEventListener('keydown', handleDocumentKeydown);
      doc.removeEventListener('keyup', handleDocumentKeyup);
      win.removeEventListener('blur', handleBlur);
    }

    return Object.freeze({
      start,
      stop,
      get active() { return started; }
    });
  }

  return Object.freeze({
    createOverlayKeyRouter,
    isOverlayKeyEvent
  });
});
