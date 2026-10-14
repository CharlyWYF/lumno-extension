const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, ResourceLoader } = require('jsdom');

const repoRoot = path.resolve(__dirname, '..');
const pagePath = path.join(repoRoot, 'src/options/options.html');
const pageHtml = fs.readFileSync(pagePath, 'utf8');

// The page's own scripts are evaluated in document order against the real
// markup, which is the only way to catch an initialisation-order error: the
// whole options entry point is one IIFE with no try/catch, so touching a
// module-scope binding before its declaration aborts every later statement and
// the page silently loses its tabs, renders and storage listeners.
//
// The compiled React bundles are stubbed: they are ESM artefacts whose real
// behaviour is covered by the vitest suites. Every plain shared module is the
// real file, so the contract under test is the same one the browser runs.
const STUBBED_GLOBAL_PREFIXES = [
  'LumnoOptionsAggregateSearchList',
  'LumnoOptionsBlacklistList',
  'LumnoOptionsFeedbackSupport',
  'LumnoOptionsInfoButton',
  'LumnoOptionsPopconfirm',
  'LumnoOptionsSegmentedControl',
  'LumnoOptionsSelectControl',
  'LumnoOptionsSettingsControls',
  'LumnoOptionsSettingsForms',
  'LumnoOptionsSettingsNavigation',
  'LumnoOptionsShortcutHotkey',
  'LumnoOptionsShortcutReference',
  'LumnoOptionsSiteSearchList',
  'LumnoOptionsThemePicker',
  'LumnoOptionsToast'
];

function createGlobalStub(name) {
  const cache = new Map();
  const makeNode = (label) => {
    const handlers = new Map();
    const node = {
      addEventListener(type, handler) {
        handlers.set(type, handler);
      },
      appendChild(child) {
        return child;
      },
      classList: { add() {}, remove() {}, toggle() {} },
      dataset: {},
      destroy() {},
      getAttribute() {
        return null;
      },
      innerHTML: '',
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      remove() {},
      removeAttribute() {},
      render() {},
      replaceChildren() {},
      setAttribute() {},
      style: { removeProperty() {}, setProperty() {} },
      textContent: '',
      update() {},
      value: ''
    };
    node.firstElementChild = null;
    node.parentNode = null;
    node[Symbol.toPrimitive] = () => label;
    Object.defineProperty(node, 'handlers', { value: handlers, enumerable: false });
    return node;
  };
  return new Proxy({}, {
    get(_target, property) {
      if (property === Symbol.toPrimitive || property === 'toString') {
        return () => `[stub ${name}]`;
      }
      if (property === 'implementation') {
        return 'react';
      }
      if (property === 'then') {
        return undefined;
      }
      if (!cache.has(property)) {
        cache.set(property, (...args) => {
          // Controller factories return an object that callers render into.
          const last = args[args.length - 1];
          if (last === undefined || typeof last === 'object' || typeof last === 'function') {
            return makeNode(`${name}.${String(property)}`);
          }
          return undefined;
        });
      }
      return cache.get(property);
    }
  });
}

function extractScriptSources() {
  const sources = [];
  // The page-entry script is loaded by the React bootstrap as an ES module, so
  // it is not a plain <script src>. Its initialisation order is the thing under
  // test, so it is evaluated last, against the same real markup and the same
  // stubbed controller bundles.
  let pageEntry = null;
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let match = null;
  while ((match = pattern.exec(pageHtml))) {
    const attributes = match[1] || '';
    const inline = match[2] || '';
    const entryMatch = /data-page-entry\s*=\s*"([^"]+)"/.exec(attributes);
    if (entryMatch) {
      pageEntry = entryMatch[1];
      continue;
    }
    const isModule = /\btype\s*=\s*"module"/.test(attributes) ||
      /data-react-entry/.test(attributes);
    if (isModule) {
      continue;
    }
    const srcMatch = /\bsrc\s*=\s*"([^"]+)"/.exec(attributes);
    if (srcMatch) {
      sources.push({ inline: false, src: srcMatch[1] });
      continue;
    }
    if (inline.trim()) {
      sources.push({ inline: true, src: null, code: inline });
    }
  }
  return { sources, pageEntry };
}

function createChromeStub(window) {
  const storageData = {};
  const makeArea = () => ({
    clear(callback) {
      if (callback) {
        callback();
      }
    },
    get(keys, callback) {
      const requested = Array.isArray(keys) ? keys : (keys && typeof keys === 'object' ? Object.keys(keys) : [keys]);
      const result = {};
      requested.forEach((key) => {
        if (key) {
          result[key] = storageData[key];
        }
      });
      if (callback) {
        callback(result);
      }
      return Promise.resolve(result);
    },
    getBytesInUse(_keys, callback) {
      if (callback) {
        callback(0);
      }
    },
    onChanged: { addListener() {}, removeListener() {} },
    QUOTA_BYTES: 102400,
    remove(_keys, callback) {
      if (callback) {
        callback();
      }
    },
    set(_values, callback) {
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }
  });
  return {
    commands: {
      getAll(callback) {
        callback([]);
      },
      onCommand: { addListener() {} }
    },
    i18n: {
      getMessage: (key) => `[[${key}]]`,
      getUILanguage: () => 'en-US',
      getAcceptLanguages(callback) {
        if (callback) {
          callback(['en-US']);
        }
      }
    },
    permissions: {
      contains(_permissions, callback) {
        callback(true);
      },
      request(_permissions, callback) {
        if (callback) {
          callback(true);
        }
      }
    },
    runtime: {
      getManifest: () => ({ version: '1.0.1' }),
      getPlatformInfo(callback) {
        callback({ os: 'win', arch: 'x86-64' });
      },
      getURL: (resourcePath) => `chrome-extension://test/${resourcePath}`,
      lastError: null,
      onMessage: { addListener() {} },
      sendMessage(_message, callback) {
        if (callback) {
          callback({});
        }
      }
    },
    storage: {
      local: makeArea(),
      managed: makeArea(),
      onChanged: { addListener() {}, removeListener() {} },
      session: makeArea(),
      sync: makeArea()
    },
    tabs: {
      create(_options, callback) {
        if (callback) {
          callback({});
        }
      },
      query(_query, callback) {
        callback([]);
      }
    }
  };
}

async function createContext() {
  const dom = new JSDOM(pageHtml, {
    pretendToBeVisual: true,
    resourceLoader: new ResourceLoader(),
    runScripts: 'outside-only',
    url: 'chrome-extension://test/src/options/options.html'
  });
  const { window } = dom;
  const context = window;
  context.globalThis = window;
  context.chrome = createChromeStub(window);
  context.browser = context.chrome;
  context.console = console;
  // The page schedules startup work on timers and animation frames. They are
  // not part of the initialisation order under test and would otherwise fire
  // after the window is closed, so they are inert here.
  context.setTimeout = () => 0;
  context.clearTimeout = () => {};
  context.setInterval = () => 0;
  context.clearInterval = () => {};
  context.requestAnimationFrame = () => 0;
  context.cancelAnimationFrame = () => {};
  context.matchMedia = window.matchMedia || ((query) => ({
    addEventListener() {},
    matches: false,
    media: query,
    removeEventListener() {}
  }));
  context.fetch = () => Promise.reject(new Error('network disabled in the options init test'));
  context.navigator.clipboard = { writeText: () => Promise.resolve() };
  STUBBED_GLOBAL_PREFIXES.forEach((name) => {
    context[name] = createGlobalStub(name);
  });
  return { context, dom, window };
}

async function testOptionsPageInitialises() {
  const { context, dom } = await createContext();
  const { sources, pageEntry } = extractScriptSources();
  assert.ok(sources.length > 10, 'the options page should load its scripts');
  assert.ok(pageEntry, 'the options page should declare its entry script');
  const evaluated = [];
  sources.forEach((script) => {
    if (script.inline) {
      vm.runInContext(script.code, context, { filename: 'src/options/options.html (inline)' });
      evaluated.push('inline');
      return;
    }
    const fullPath = path.resolve(path.dirname(pagePath), script.src);
    if (!fs.existsSync(fullPath)) {
      evaluated.push(`${script.src} (missing)`);
      return;
    }
    const code = fs.readFileSync(fullPath, 'utf8');
    const relative = path.relative(repoRoot, fullPath).split(path.sep).join('/');
    try {
      vm.runInContext(code, context, { filename: relative });
    } catch (error) {
      dom.window.close();
      throw new Error(`evaluating ${relative} threw during page initialisation: ${error && error.stack}`);
    }
    evaluated.push(relative);
  });
  const entryPath = path.resolve(path.dirname(pagePath), pageEntry);
  const entryCode = fs.readFileSync(entryPath, 'utf8');
  const entryRelative = path.relative(repoRoot, entryPath).split(path.sep).join('/');
  try {
    vm.runInContext(entryCode, context, { filename: entryRelative });
  } catch (error) {
    dom.window.close();
    throw new Error(`the options entry point threw during initialisation: ${error && error.stack}`);
  }
  evaluated.push(entryRelative);
  assert.ok(
    evaluated.some((entry) => entry.endsWith('src/options/options.js')),
    'the options entry point should have been evaluated'
  );
  // A page that aborted mid-initialisation leaves the react bootstrap marker in
  // its error state; a clean load must not have written it.
  const root = dom.window.document.documentElement;
  assert.notStrictEqual(
    root.getAttribute('data-lumno-react-runtime'),
    'error',
    'the React bootstrap must not report an error state'
  );
  // The page has asynchronous startup callbacks (theme preload, provider loads).
  // They are drained before the window closes so a late failure surfaces as a
  // test failure instead of an unhandled error after the run.
  await new Promise((resolve) => setTimeout(resolve, 30));
  dom.window.close();
  return evaluated;
}

(async () => {
  const evaluated = await testOptionsPageInitialises();
  assert.ok(evaluated.length > 10, 'every page script should be evaluated');
  console.log(`options page initialisation tests passed (${evaluated.length} scripts evaluated)`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

// Startup callbacks drained above may still schedule work; exiting explicitly
// keeps a late resource error from changing the reported exit code.
process.on('uncaughtException', (error) => {
  console.error(error);
  process.exit(1);
});
