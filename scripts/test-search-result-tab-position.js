const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const settings = require('../src/shared/settings.js');
const searchResultTabs = require('../src/background/search-result-tabs.js');
const tabGroups = require('../src/background/tab-groups.js');

const source = fs.readFileSync(path.join(__dirname, '../src/background/background.js'), 'utf8');
const createFunctions = source.slice(
  source.indexOf('function createTabWithSourceGroup('),
  source.indexOf('function moveTabToSourceGroupContext(')
);
function sliceHandlerMap(name, nextName) {
  const start = source.indexOf(`const ${name} = `);
  const end = source.indexOf(`const ${nextName} = `);
  assert.ok(start >= 0 && end > start, `${name} should be followed by ${nextName}`);
  return `${source.slice(start, end)}\nglobalThis.${name} = ${name};\n`;
}
const searchHandler = sliceHandlerMap('SEARCH_MESSAGE_HANDLERS', 'SITE_SEARCH_MESSAGE_HANDLERS');
const pageHandler = sliceHandlerMap('EXTENSION_PAGE_MESSAGE_HANDLERS', 'FAVICON_MESSAGE_HANDLERS');

function createHarness(options = {}) {
  const created = [];
  const updated = [];
  const searched = [];
  const grouped = [];
  const currentSource = { id: 10, index: 5, windowId: 3, groupId: 42 };
  const chromeApi = {
    runtime: { lastError: null },
    tabGroups: { TAB_GROUP_ID_NONE: -1 },
    tabs: {
      get(_id, callback) {
        if (options.closedSource) {
          chromeApi.runtime.lastError = { message: 'No tab' };
          callback();
          chromeApi.runtime.lastError = null;
        } else {
          callback(currentSource);
        }
      },
      query(_query, callback) { callback([currentSource]); },
      create(props, callback) {
        created.push({ ...props });
        if (options.createError) {
          chromeApi.runtime.lastError = { message: 'create failed' };
          callback();
          chromeApi.runtime.lastError = null;
        } else {
          callback({ id: 100, windowId: props.windowId || 3, groupId: -1, ...props });
        }
      },
      update(id, props, callback) {
        updated.push({ id, ...props });
        chromeApi.runtime.lastError = null;
        callback({ id, ...props });
      },
      group(props, callback) { grouped.push({ ...props }); callback(42); }
    },
    search: {
      query(props, callback) {
        searched.push({ ...props });
        if (options.searchThrows) throw new Error('search unavailable');
        chromeApi.runtime.lastError = options.searchError ? { message: 'search failed' } : null;
        callback();
        chromeApi.runtime.lastError = null;
      }
    }
  };
  if (options.noSearchApi) delete chromeApi.search;
  const context = vm.createContext({
    chrome: chromeApi,
    SETTINGS: settings,
    SEARCH_RESULT_TABS: searchResultTabs,
    BACKGROUND_TAB_GROUPS: tabGroups,
    storageArea: {
      get(_keys, callback) {
        callback({ [settings.SEARCH_RESULT_TAB_POSITION_STORAGE_KEY]: options.position });
      }
    },
    loadShortcutRules: () => Promise.resolve([]),
    getShortcutUrl: (query) => query === 'shortcut' ? 'https://shortcut.test/' : '',
    getDirectNavigationUrl: (query) => query.startsWith('https://') ? query : '',
    buildDefaultSearchUrl: (query) => `https://fallback.test/?q=${encodeURIComponent(query)}`,
    markPendingSearchTab(id) { context.pendingSearchTabId = id; },
    pendingSearchAt: 0,
    pendingSearchTabId: null,
    pendingSearchGroupContext: null
  });
  vm.runInContext(createFunctions + searchHandler + pageHandler, context);
  const send = (request, sender = { tab: { ...currentSource, index: 1 } }) => new Promise((resolve) => {
    const handlers = request.action === 'searchOrNavigate'
      ? context.SEARCH_MESSAGE_HANDLERS
      : context.EXTENSION_PAGE_MESSAGE_HANDLERS;
    handlers[request.action](request, sender, resolve);
  });
  return { send, created, updated, searched, grouped };
}

async function run() {
  assert.strictEqual(settings.normalizeSearchResultTabPosition(undefined), 'end');
  assert.strictEqual(settings.normalizeSearchResultTabPosition('invalid'), 'end');
  assert.strictEqual(settings.normalizeSearchResultTabPosition('beforeCurrent'), 'beforeCurrent');
  assert.ok(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.SEARCH_RESULT_TAB_POSITION_STORAGE_KEY));

  for (const [position, index] of [['afterCurrent', 6], ['beforeCurrent', 5]]) {
    for (const disposition of ['newTab', 'backgroundTab']) {
      const harness = createHarness({ position });
      const response = await harness.send({ action: 'searchOrNavigate', query: 'hello', disposition });
      assert.strictEqual(response.ok, true);
      assert.deepStrictEqual(harness.created, [{ url: 'about:blank', active: disposition === 'newTab', index, windowId: 3 }]);
      assert.deepStrictEqual(harness.searched, [{ text: 'hello', tabId: 100 }]);
      assert.deepStrictEqual(harness.grouped, [{ tabIds: 100, groupId: 42 }]);
    }
  }

  for (const query of ['https://example.test/', 'shortcut']) {
    const harness = createHarness({ position: 'afterCurrent' });
    await harness.send({ action: 'searchOrNavigate', query });
    assert.strictEqual(harness.created[0].index, 6, 'direct navigation and shortcuts should use the refreshed index');
    assert.strictEqual(harness.searched.length, 0);
  }

  const defaultPosition = createHarness();
  await defaultPosition.send({ action: 'searchOrNavigate', query: 'hello' });
  assert.strictEqual(defaultPosition.created.length, 0, 'default browser searches should keep the original NEW_TAB path');
  assert.deepStrictEqual(defaultPosition.searched, [{ text: 'hello', disposition: 'NEW_TAB' }]);

  const defaultBackground = createHarness();
  await defaultBackground.send({ action: 'searchOrNavigate', query: 'hello', disposition: 'backgroundTab' });
  assert.deepStrictEqual(defaultBackground.created, [{ url: 'https://fallback.test/?q=hello', active: false, windowId: 3 }]);
  assert.strictEqual(defaultBackground.searched.length, 0, 'default background searches should keep the original URL-based path');

  const defaultLink = createHarness();
  await defaultLink.send({ action: 'createTab', url: 'https://example.test/' });
  assert.strictEqual(defaultLink.created[0].index, undefined, 'missing preferences should keep original link creation without an insertion index');

  const endPosition = createHarness({ position: 'end' });
  await endPosition.send({ action: 'searchOrNavigate', query: 'https://example.test/' });
  assert.strictEqual(endPosition.created[0].index, undefined, 'end-of-strip remains available as an explicit preference');

  const direct = createHarness({ position: 'afterCurrent' });
  await direct.send({ action: 'createTab', url: 'https://example.test/', disposition: 'backgroundTab' }, {});
  assert.deepStrictEqual(direct.created[0], { url: 'https://example.test/', active: false, index: 6, windowId: 3 });

  const current = createHarness({ position: 'afterCurrent' });
  await current.send({ action: 'createTab', url: 'https://example.test/', disposition: 'currentTab' });
  assert.strictEqual(current.created.length, 0);
  assert.deepStrictEqual(current.updated, [{ id: 10, url: 'https://example.test/', active: true }]);

  const closed = createHarness({ position: 'afterCurrent', closedSource: true });
  await closed.send({ action: 'createTab', url: 'https://example.test/' });
  assert.strictEqual(closed.created[0].index, undefined, 'a closed source tab must not leave a stale insertion index');
  assert.strictEqual(closed.grouped.length, 0);

  for (const failure of [{ searchError: true }, { searchThrows: true }]) {
    const harness = createHarness({ position: 'afterCurrent', ...failure });
    const response = await harness.send({ action: 'searchOrNavigate', query: 'hello' });
    assert.strictEqual(response.ok, true);
    assert.strictEqual(harness.created.length, 1, 'search fallback must reuse the positioned tab');
    assert.deepStrictEqual(harness.updated, [{ id: 100, url: 'https://fallback.test/?q=hello' }]);
  }

  const unavailable = createHarness({ position: 'afterCurrent', noSearchApi: true });
  await unavailable.send({ action: 'searchOrNavigate', query: 'hello' });
  assert.strictEqual(unavailable.created[0].index, 6);
  assert.strictEqual(unavailable.created[0].url, 'https://fallback.test/?q=hello');

  const failedCreate = createHarness({ position: 'afterCurrent', createError: true });
  const failure = await failedCreate.send({ action: 'searchOrNavigate', query: 'hello' });
  assert.strictEqual(failure.ok, false);
  assert.strictEqual(failedCreate.searched.length, 0);
  console.log('search result tab position tests passed');
}

run().catch((error) => { console.error(error); process.exit(1); });
