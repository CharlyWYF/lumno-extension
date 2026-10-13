(function(root) {
  'use strict';

  // Builds one action -> handler registry from any number of handler maps
  // ({ actionName(request, sender, sendResponse) { ... } }). Feature areas can
  // keep their handlers together; an action registered by two maps throws.
  function createRouter(...handlerMaps) {
    const handlers = new Map();
    handlerMaps.forEach((handlerMap) => {
      Object.entries(handlerMap || {}).forEach(([rawAction, handler]) => {
        const action = String(rawAction || '').trim();
        if (!action) {
          return;
        }
        if (typeof handler !== 'function') {
          throw new Error(`Background message handler is not a function: ${action}`);
        }
        if (handlers.has(action)) {
          throw new Error(`Duplicate background message action: ${action}`);
        }
        handlers.set(action, handler);
      });
    });
    return Object.freeze({
      has(action) {
        return handlers.has(String(action || ''));
      },
      actions() {
        return Array.from(handlers.keys());
      },
      get(action) {
        return handlers.get(String(action || '')) || null;
      }
    });
  }

  function sendUnknownResponse(sendResponse) {
    if (typeof sendResponse === 'function') {
      sendResponse({ ok: false });
    }
    return undefined;
  }

  function dispatch(router, request, sender, sendResponse) {
    const action = request && request.action ? String(request.action) : '';
    const handler = action && router ? router.get(action) : null;
    if (!handler) {
      return sendUnknownResponse(sendResponse);
    }
    return handler(request, sender, sendResponse);
  }

  const api = Object.freeze({
    createRouter,
    dispatch
  });

  root.LumnoBackgroundMessageRouter = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
