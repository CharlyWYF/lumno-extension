(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoNewtabStorageChangeRegistry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // One storage listener for the New Tab page. Each part of the page
  // registers the keys it owns; a change runs the handlers whose keys it
  // carries, in the order they were registered.
  //
  // `area` says which storage area a handler listens to: 'primary' (the
  // area settings live in, sync or local; the default), 'local', 'any', or
  // a predicate on the area name.
  function createStorageChangeRegistry(options) {
    const opts = options || {};
    const isPrimaryArea = typeof opts.isPrimaryArea === 'function'
      ? opts.isPrimaryArea
      : (areaName) => areaName === 'sync';
    const handlers = [];

    function matchesArea(area, areaName) {
      if (typeof area === 'function') return Boolean(area(areaName));
      if (area === 'any') return true;
      if (area === 'local') return areaName === 'local';
      return isPrimaryArea(areaName);
    }

    function register(keys, handler, registerOptions) {
      if (typeof handler !== 'function') {
        return;
      }
      handlers.push({
        keys,
        handler,
        area: registerOptions && registerOptions.area ? registerOptions.area : 'primary'
      });
    }

    // `handler(changes, areaName)` runs when the change carries any of `keys`.
    function on(keys, handler, registerOptions) {
      const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean).map(String);
      if (list.length) {
        register(list, handler, registerOptions);
      }
    }

    // `handler(changes, areaName)` runs for every change in its area.
    function onAny(handler, registerOptions) {
      register(null, handler, registerOptions);
    }

    function dispatch(changes, areaName) {
      if (!changes) {
        return;
      }
      handlers.forEach((entry) => {
        if (!matchesArea(entry.area, areaName)) {
          return;
        }
        if (entry.keys && !entry.keys.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
          return;
        }
        try {
          entry.handler(changes, areaName);
        } catch (error) {
          // One part of the page failing to apply a change must not keep the
          // rest from seeing it.
          console.error('[Lumno] Storage change handler failed.', error);
        }
      });
    }

    return { on, onAny, dispatch };
  }

  return { createStorageChangeRegistry };
});
