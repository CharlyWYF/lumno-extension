'use strict';

// Boots the real background service worker (background.js and everything it
// importScripts) inside a vm context with a recording chrome stub, so tests can
// fire browser events at it and observe the storage writes and API calls it
// makes, instead of asserting on its source text.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..');

function createEvent() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    },
    removeListener(listener) {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    },
    hasListener(listener) {
      return listeners.includes(listener);
    },
    dispatch(...args) {
      return listeners.map((listener) => listener(...args));
    }
  };
}

function createStorageArea(name, initialData, options) {
  const data = Object.assign({}, initialData || {});
  const config = options || {};
  const writes = [];
  const area = {
    data,
    writes,
    // While held, get() callbacks queue up as they would while the browser
    // is still reading storage for a freshly woken worker.
    held: config.hold === true,
    pendingGets: [],
    release() {
      area.held = false;
      const pending = area.pendingGets.splice(0);
      pending.forEach((run) => run());
    },
    get(keys, callback) {
      const run = () => {
        const result = {};
        const keyList = keys === null || keys === undefined
          ? Object.keys(data)
          : (Array.isArray(keys)
            ? keys
            : (typeof keys === 'string' ? [keys] : Object.keys(keys || {})));
        keyList.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            result[key] = JSON.parse(JSON.stringify(data[key]));
          } else if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
            result[key] = keys[key];
          }
        });
        if (typeof callback === 'function') {
          setTimeout(() => callback(result), 0);
        }
      };
      if (area.held) {
        area.pendingGets.push(run);
        return undefined;
      }
      run();
      return undefined;
    },
    set(items, callback) {
      const copy = JSON.parse(JSON.stringify(items || {}));
      writes.push(copy);
      Object.assign(data, copy);
      if (typeof callback === 'function') {
        setTimeout(callback, 0);
      }
    },
    remove(keys, callback) {
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        delete data[key];
      });
      if (typeof callback === 'function') {
        setTimeout(callback, 0);
      }
    }
  };
  area.areaName = name;
  return area;
}

function callLater(callback, value) {
  if (typeof callback === 'function') {
    setTimeout(() => callback(value), 0);
  }
}

function createChromeStub(config) {
  const calls = [];
  const record = (name, args) => {
    calls.push({ name, args });
  };
  const tabs = Array.isArray(config.tabs) ? config.tabs : [];
  const storageOptions = config.storageOptions || {};
  const storage = {
    sync: createStorageArea('sync', config.sync, storageOptions.sync),
    local: createStorageArea('local', config.local, storageOptions.local),
    session: createStorageArea('session', config.session, storageOptions.session),
    onChanged: createEvent()
  };
  const chromeApi = {
    runtime: {
      id: 'lumno-test',
      lastError: null,
      getURL(relativePath) {
        return path.join(repoRoot, relativePath);
      },
      getManifest() {
        return { version: config.version || '1.0.0' };
      },
      getPlatformInfo(callback) {
        callLater(callback, { os: config.os || 'mac' });
      },
      sendMessage(message, callback) {
        record('runtime.sendMessage', [message]);
        callLater(callback, undefined);
      },
      onMessage: createEvent(),
      onInstalled: createEvent(),
      onStartup: createEvent(),
      onSuspend: createEvent(),
      onConnect: createEvent(),
      setUninstallURL(_url, callback) {
        callLater(callback);
      },
      openOptionsPage(callback) {
        callLater(callback);
      }
    },
    storage,
    history: {
      search(_options, callback) {
        callLater(callback, []);
      },
      deleteUrl(_options, callback) {
        callLater(callback);
      },
      onVisited: createEvent(),
      onVisitRemoved: createEvent()
    },
    topSites: {
      get(callback) {
        callLater(callback, []);
      }
    },
    bookmarks: {
      search(_options, callback) {
        callLater(callback, []);
      },
      getTree(callback) {
        callLater(callback, [{ id: '0', title: '', children: [] }]);
      },
      onCreated: createEvent(),
      onRemoved: createEvent(),
      onChanged: createEvent(),
      onMoved: createEvent(),
      onChildrenReordered: createEvent(),
      onImportEnded: createEvent()
    },
    tabs: {
      query(queryInfo, callback) {
        record('tabs.query', [queryInfo]);
        const info = queryInfo || {};
        const result = tabs.filter((tab) => Object.keys(info).every((key) => {
          if (key === 'currentWindow' || key === 'lastFocusedWindow') {
            return true;
          }
          return tab[key] === info[key];
        }));
        callLater(callback, result);
      },
      get(tabId, callback) {
        const tab = tabs.find((item) => item.id === tabId);
        if (!tab) {
          chromeApi.runtime.lastError = { message: `No tab with id: ${tabId}.` };
          callback(undefined);
          chromeApi.runtime.lastError = null;
          return;
        }
        callLater(callback, tab);
      },
      create(options, callback) {
        record('tabs.create', [options]);
        callLater(callback, Object.assign({ id: 9000 + calls.length, windowId: 1 }, options));
      },
      update(tabId, options, callback) {
        record('tabs.update', [tabId, options]);
        callLater(callback, Object.assign({ id: tabId, windowId: 1 }, options));
      },
      sendMessage(tabId, message, optionsOrCallback, maybeCallback) {
        record('tabs.sendMessage', [tabId, message]);
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
        callLater(callback, undefined);
      },
      remove(tabIds, callback) {
        record('tabs.remove', [tabIds]);
        callLater(callback);
      },
      getZoom(_tabId, callback) {
        callLater(callback, 1);
      },
      captureVisibleTab(_windowId, _options, callback) {
        callLater(callback, '');
      },
      group(_options, callback) {
        callLater(callback, 1);
      },
      onCreated: createEvent(),
      onUpdated: createEvent(),
      onRemoved: createEvent(),
      onActivated: createEvent(),
      onReplaced: createEvent(),
      onMoved: createEvent(),
      onAttached: createEvent(),
      onDetached: createEvent()
    },
    windows: {
      update(windowId, _options, callback) {
        callLater(callback, { id: windowId });
      },
      getCurrent(callback) {
        callLater(callback, { id: 1 });
      },
      getLastFocused(_options, callback) {
        const done = typeof _options === 'function' ? _options : callback;
        callLater(done, { id: 1, type: 'normal' });
      },
      getAll(_options, callback) {
        const done = typeof _options === 'function' ? _options : callback;
        callLater(done, [{ id: 1, type: 'normal', incognito: false }]);
      },
      onFocusChanged: createEvent(),
      onCreated: createEvent(),
      onRemoved: createEvent(),
      WINDOW_ID_NONE: -1
    },
    commands: {
      getAll(callback) {
        callLater(callback, Array.isArray(config.commands) ? config.commands : []);
      },
      onCommand: createEvent()
    },
    action: {
      onClicked: createEvent(),
      setIcon(_options, callback) {
        callLater(callback);
      },
      setTitle(_options, callback) {
        callLater(callback);
      }
    },
    alarms: {
      create() {},
      clear(_name, callback) {
        callLater(callback, true);
      },
      onAlarm: createEvent()
    },
    scripting: {
      executeScript(options, callback) {
        record('scripting.executeScript', [options]);
        if (typeof callback === 'function') {
          callLater(callback, []);
          return undefined;
        }
        return Promise.resolve([]);
      },
      insertCSS(_options, callback) {
        callLater(callback);
      },
      registerContentScripts(_scripts, callback) {
        callLater(callback);
      },
      unregisterContentScripts(_filter, callback) {
        callLater(callback);
      },
      getRegisteredContentScripts(_filter, callback) {
        const done = typeof _filter === 'function' ? _filter : callback;
        callLater(done, []);
      }
    },
    search: {
      query(_options, callback) {
        callLater(callback);
      }
    },
    permissions: {
      contains(_options, callback) {
        callLater(callback, true);
      }
    },
    i18n: {
      getUILanguage() {
        return 'en';
      },
      getMessage() {
        return '';
      }
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      get(_groupId, callback) {
        callLater(callback, null);
      },
      update(_groupId, _options, callback) {
        callLater(callback, null);
      }
    }
  };
  return { chromeApi, calls };
}

function loadBackground(options) {
  const config = options || {};
  const { chromeApi, calls } = createChromeStub(config);
  if (typeof config.configureChrome === 'function') {
    config.configureChrome(chromeApi, calls);
  }
  const context = vm.createContext({
    console: config.console || {
      log() {},
      info() {},
      debug() {},
      warn: (...args) => calls.push({ name: 'console.warn', args }),
      error: (...args) => calls.push({ name: 'console.error', args })
    },
    chrome: chromeApi,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Blob,
    AbortController,
    navigator: { userAgent: 'Fake Chrome', platform: 'MacIntel' },
    fetch: config.fetch || (async () => {
      throw new Error('network disabled in background harness');
    })
  });
  context.globalThis = context;
  context.self = context;
  context.importScripts = (...urls) => {
    urls.forEach((url) => {
      vm.runInContext(fs.readFileSync(String(url), 'utf8'), context, {
        filename: String(url)
      });
    });
  };
  const exposed = Array.isArray(config.expose) ? config.expose : [];
  const exposeSource = exposed.map((name) => (
    `\nglobalThis.__test_${name} = typeof ${name} === 'undefined' ? undefined : ${name};`
  )).join('');
  vm.runInContext(
    fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8') + exposeSource,
    context,
    { filename: 'src/background/background.js' }
  );

  function sendMessage(request, sender, timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (response) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(response);
      };
      const results = chromeApi.runtime.onMessage.dispatch(request, sender || {}, finish);
      if (!results.some((result) => result === true)) {
        setTimeout(() => finish(undefined), 0);
      }
      setTimeout(() => finish(undefined), Number(timeoutMs) > 0 ? Number(timeoutMs) : 500);
    });
  }

  return {
    context,
    chrome: chromeApi,
    calls,
    storage: chromeApi.storage,
    sendMessage,
    exposed(name) {
      return context[`__test_${name}`];
    }
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  loadBackground,
  createEvent,
  createStorageArea,
  wait
};
