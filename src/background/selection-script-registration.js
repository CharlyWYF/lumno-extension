(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoSelectionScriptRegistration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  // The selection toolbar is off by default, so its scripts are registered as
  // a content script only while it is on instead of loading into every page
  // from the manifest. Turning it on also injects it into pages already open,
  // which the manifest entry used to cover; turning it off leaves running
  // copies to hide themselves through their own storage listener.
  const SCRIPT_ID = 'lumno-selection-quick-actions';
  const SCRIPT_FILES = Object.freeze([
    'src/shared/settings.js',
    'src/shared/selection-action-icons.js',
    'src/shared/selection-intent.js',
    'src/shared/toast.js',
    'src/content/selection-quick-actions.js'
  ]);
  const RUN_AT = 'document_idle';
  const INJECTABLE_URL_PATTERN = /^(https?|file):/i;

  function createSelectionScriptRegistration(options) {
    const config = options || {};
    const chromeApi = config.chromeApi;
    const scripting = chromeApi && chromeApi.scripting;
    let queue = Promise.resolve();

    function readLastError() {
      return chromeApi && chromeApi.runtime ? chromeApi.runtime.lastError : null;
    }

    function call(method, args) {
      return new Promise((resolve) => {
        if (!scripting || typeof scripting[method] !== 'function') {
          resolve(null);
          return;
        }
        try {
          scripting[method](...args, (result) => {
            resolve(readLastError() ? null : (result === undefined ? true : result));
          });
        } catch (error) {
          resolve(null);
        }
      });
    }

    function isCurrent(registered) {
      return Boolean(registered) &&
        Array.isArray(registered.js) &&
        registered.js.join('\n') === SCRIPT_FILES.join('\n') &&
        registered.runAt === RUN_AT &&
        registered.allFrames !== true;
    }

    function queryOpenTabs() {
      return new Promise((resolve) => {
        if (!chromeApi || !chromeApi.tabs || typeof chromeApi.tabs.query !== 'function') {
          resolve([]);
          return;
        }
        chromeApi.tabs.query({}, (tabs) => {
          resolve(!readLastError() && Array.isArray(tabs) ? tabs : []);
        });
      });
    }

    async function injectIntoOpenTabs() {
      const tabs = await queryOpenTabs();
      await Promise.all(tabs
        .filter((tab) => tab && typeof tab.id === 'number' && INJECTABLE_URL_PATTERN.test(String(tab.url || '')))
        .map((tab) => call('executeScript', [{ target: { tabId: tab.id }, files: SCRIPT_FILES.slice() }])));
    }

    async function apply(enabled, applyOptions) {
      const registeredList = await call('getRegisteredContentScripts', [{ ids: [SCRIPT_ID] }]);
      const registered = Array.isArray(registeredList) ? registeredList[0] : null;
      if (!enabled) {
        if (registered) {
          await call('unregisterContentScripts', [{ ids: [SCRIPT_ID] }]);
        }
        return false;
      }
      const script = {
        id: SCRIPT_ID,
        matches: ['<all_urls>'],
        js: SCRIPT_FILES.slice(),
        runAt: RUN_AT,
        allFrames: false,
        persistAcrossSessions: true
      };
      if (!registered) {
        await call('registerContentScripts', [[script]]);
      } else if (!isCurrent(registered)) {
        await call('updateContentScripts', [[script]]);
      }
      if (applyOptions && applyOptions.injectOpenTabs) {
        await injectIntoOpenTabs();
      }
      return true;
    }

    function sync(enabled, syncOptions) {
      queue = queue.then(() => apply(Boolean(enabled), syncOptions || {})).catch(() => false);
      return queue;
    }

    return Object.freeze({ sync });
  }

  return Object.freeze({
    SCRIPT_ID,
    SCRIPT_FILES,
    RUN_AT,
    createSelectionScriptRegistration
  });
});
