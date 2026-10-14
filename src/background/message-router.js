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

  // Who may send which action. Content scripts and the injected overlay run
  // inside web pages, so a message from there is treated as coming from the
  // page: only actions those surfaces use are accepted, and their arguments
  // must pass the action's guard. Extension pages may send every action.
  function createSenderPolicy(options) {
    const config = options || {};
    const extensionBaseUrl = String(config.extensionBaseUrl || '');
    const pageActions = new Set((config.pageActions || []).map((action) => String(action)));
    const pageArgumentGuards = config.pageArgumentGuards || {};

    function isExtensionPageSender(sender) {
      const url = sender && typeof sender.url === 'string' ? sender.url : '';
      return Boolean(extensionBaseUrl && url.startsWith(extensionBaseUrl));
    }

    function check(action, request, sender) {
      const name = String(action || '');
      if (isExtensionPageSender(sender)) {
        return { ok: true };
      }
      if (!pageActions.has(name)) {
        return { ok: false, reason: 'sender-not-allowed' };
      }
      const guard = pageArgumentGuards[name];
      if (typeof guard === 'function' && guard(request || {}, sender) !== true) {
        return { ok: false, reason: 'argument-not-allowed' };
      }
      return { ok: true };
    }

    return Object.freeze({
      isExtensionPageSender,
      check
    });
  }

  function sendRejectedResponse(sendResponse, reason) {
    if (typeof sendResponse === 'function') {
      sendResponse(reason ? { ok: false, reason } : { ok: false });
    }
    return undefined;
  }

  function dispatch(router, request, sender, sendResponse, senderPolicy) {
    const action = request && request.action ? String(request.action) : '';
    const handler = action && router ? router.get(action) : null;
    if (!handler) {
      return sendRejectedResponse(sendResponse);
    }
    if (senderPolicy) {
      const verdict = senderPolicy.check(action, request, sender);
      if (!verdict.ok) {
        return sendRejectedResponse(sendResponse, verdict.reason);
      }
    }
    return handler(request, sender, sendResponse);
  }

  const api = Object.freeze({
    createRouter,
    createSenderPolicy,
    dispatch
  });

  root.LumnoBackgroundMessageRouter = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
