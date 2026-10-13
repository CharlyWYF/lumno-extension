(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoNewtabDismissStack = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // One Escape press dismisses one layer: the open layer pushed last, or a
  // layer with a higher priority (an active drag) whenever it is open.
  // Layers push themselves when they open; `isOpen` lets the stack skip a
  // layer that closed some other way, so a missed `remove` never strands it.
  function createDismissStack(options) {
    const opts = options || {};
    const documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    const layers = new Map();
    let pushCount = 0;
    let listening = false;
    let shouldIgnore = typeof opts.shouldIgnore === 'function' ? opts.shouldIgnore : null;

    function isLayerOpen(layer) {
      try {
        return typeof layer.isOpen === 'function' ? Boolean(layer.isOpen()) : true;
      } catch (_error) {
        return false;
      }
    }

    function getTopLayer() {
      let top = null;
      layers.forEach((layer) => {
        if (!isLayerOpen(layer)) {
          return;
        }
        if (!top || layer.priority > top.priority ||
            (layer.priority === top.priority && layer.order > top.order)) {
          top = layer;
        }
      });
      return top;
    }

    function dismissTop(event) {
      const top = getTopLayer();
      if (!top) {
        return false;
      }
      // Nothing else sees this Escape, not even a listener on the document
      // added later by a menu underneath.
      if (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
      }
      top.close(event);
      return true;
    }

    function handleKeyDown(event) {
      if (!event || event.key !== 'Escape' || event.defaultPrevented || event.isComposing) {
        return;
      }
      if (shouldIgnore && shouldIgnore(event)) {
        return;
      }
      dismissTop(event);
    }

    function listen() {
      if (listening || !documentObj || typeof documentObj.addEventListener !== 'function') {
        return;
      }
      listening = true;
      documentObj.addEventListener('keydown', handleKeyDown, true);
    }

    // Puts `key` on top of the stack, adding it or refreshing its handlers.
    function push(key, layer) {
      if (!key || !layer || typeof layer.close !== 'function') {
        return;
      }
      pushCount += 1;
      layers.set(key, {
        key,
        close: layer.close,
        isOpen: layer.isOpen,
        priority: Number(layer.priority) || 0,
        order: pushCount
      });
      listen();
    }

    function remove(key) {
      layers.delete(key);
    }

    function setShouldIgnore(predicate) {
      shouldIgnore = typeof predicate === 'function' ? predicate : null;
    }

    return {
      push,
      remove,
      dismissTop,
      handleKeyDown,
      setShouldIgnore,
      getTopKey: () => {
        const top = getTopLayer();
        return top ? top.key : '';
      }
    };
  }

  let sharedStack = null;
  function getDismissStack() {
    if (!sharedStack) {
      sharedStack = createDismissStack();
    }
    return sharedStack;
  }

  return {
    createDismissStack,
    getDismissStack
  };
});
