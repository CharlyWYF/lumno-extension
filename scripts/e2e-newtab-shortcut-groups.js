// Real-browser layout checks for New Tab shortcut groups.
//
// Loads the unpacked extension into a headless Chromium (no window, no
// focus), seeds grouped shortcuts and runs each interaction while recording
// where the search box, group titles, tiles, slots and the bottom dock sit.
// Each check names what may move; anything else that moves fails it.
//
//   npm run e2e:shortcut-groups
//   LUMNO_E2E_CHROME=/path/to/chrome npm run e2e:shortcut-groups
//   LUMNO_E2E_ONLY=drag npm run e2e:shortcut-groups   (checks whose name contains "drag")
//
// Not part of `npm test`: it needs a Chromium build that loads extensions
// (Chrome for Testing or Chromium; branded Chrome refuses --load-extension).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const shortcutsStore = require('../src/newtab/shortcuts-store.js');

const repoRoot = path.resolve(__dirname, '..');
const EXTENSION_ID = 'kkcjcneagmlhpeaafngjdlpcfjakejgb';
const NEWTAB_URL = `chrome-extension://${EXTENSION_ID}/newtab.html`;
const TOLERANCE_PX = 0.75;
const SETTLE_MS = 450;
const chromeCandidates = [
  process.env.LUMNO_E2E_CHROME,
  ...['chromium-1228', 'chromium-1200'].map((build) => path.join(
    os.homedir(),
    `Library/Caches/ms-playwright/${build}/chrome-mac-arm64`,
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  )),
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
].filter(Boolean);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpConnection {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', reject);
    });
    this.socket.on('message', (raw) => {
      const message = JSON.parse(String(raw));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject, method } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result || {});
        return;
      }
      this.listeners.forEach((listener) => listener(message));
    });
  }

  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() {
    try { this.socket.close(); } catch (_error) { /* already closed */ }
  }
}

async function launchBrowser() {
  const executable = chromeCandidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error('No Chromium build that loads extensions was found; set LUMNO_E2E_CHROME.');
  }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lumno-e2e-'));
  const port = 9400 + Math.floor(Math.random() * 400);
  const child = spawn(executable, [
    '--headless=new',
    `--user-data-dir=${profile}`,
    `--load-extension=${repoRoot}`,
    `--disable-extensions-except=${repoRoot}`,
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    'about:blank'
  ], { stdio: 'ignore' });
  let version = null;
  for (let attempt = 0; attempt < 100 && !version; attempt += 1) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch (_error) {
      await delay(150);
    }
  }
  if (!version) {
    child.kill('SIGKILL');
    throw new Error('Chromium did not open its DevTools port.');
  }
  const cdp = new CdpConnection(version.webSocketDebuggerUrl);
  const close = () => {
    cdp.close();
    child.kill('SIGKILL');
    fs.rmSync(profile, { recursive: true, force: true });
  };
  return { cdp, close };
}

async function openPage(cdp, viewport) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const errors = [];
  cdp.listeners.push((message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
    }
  });
  const send = (method, params) => cdp.send(method, params, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false });
  const page = {
    errors,
    send,
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      }
      return result.result.value;
    },
    async load() {
      await send('Page.navigate', { url: NEWTAB_URL });
      await send('Page.bringToFront');
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await delay(100);
        try {
          if (await page.evaluate(`document.body && document.body.getAttribute('data-nt-ready') === '1' &&
            location.search === '' && document.body.getAttribute('data-nt-enter') !== 'run'`)) break;
        } catch (_error) { /* navigating */ }
      }
      // Entry motion, favicons and the first adaptive tone pass.
      await delay(1600);
    },
    async seed(groups, items, extra = {}) {
      if (!(await page.evaluate('location.href')).startsWith(NEWTAB_URL)) {
        await page.load();
      }
      const payload = shortcutsStore.createShortcutStoragePlan({ groups, items }).payload;
      await page.evaluate(`new Promise((resolve) => chrome.storage.sync.set(${JSON.stringify({ ...payload, ...extra })}, resolve))`);
      await page.load();
    },
    async rect(selector) {
      return page.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return null;
        const r = element.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      })()`);
    },
    mouse(type, x, y, extra = {}) {
      return send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
    },
    async hover(selector, offsetX = 0) {
      const r = await page.rect(selector);
      await page.mouse('mouseMoved', r.x + offsetX, r.y, { button: 'none' });
    },
    async click(selector, clickCount = 1) {
      const r = await page.rect(selector);
      if (!r) throw new Error(`Missing ${selector}`);
      await page.mouse('mouseMoved', r.x, r.y, { button: 'none' });
      for (let count = 1; count <= clickCount; count += 1) {
        await page.mouse('mousePressed', r.x, r.y, { buttons: 1, clickCount: count });
        await page.mouse('mouseReleased', r.x, r.y, { clickCount: count });
      }
    },
    async contextMenu(selector) {
      await page.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        const r = element.getBoundingClientRect();
        element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      })()`);
    },
    async key(key, modifiers = 0) {
      const codes = { Enter: ['Enter', 13], Escape: ['Escape', 27], z: ['KeyZ', 90] };
      const [code, keyCode] = codes[key];
      // Enter carries its character, or a form would not submit.
      const text = key === 'Enter' ? { type: 'keyDown', text: '\r', unmodifiedText: '\r' } : { type: 'rawKeyDown' };
      await send('Input.dispatchKeyEvent', { ...text, key, code, windowsVirtualKeyCode: keyCode, modifiers });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers });
    },
    async type(text) {
      await send('Input.insertText', { text });
    },
    async drag(fromSelector, toPoint, options = {}) {
      const from = await page.rect(fromSelector);
      const steps = options.steps || 14;
      await page.mouse('mouseMoved', from.x, from.y, { button: 'none' });
      await page.mouse('mousePressed', from.x, from.y, { buttons: 1 });
      for (let step = 1; step <= steps; step += 1) {
        await page.mouse('mouseMoved', from.x + (toPoint.x - from.x) * step / steps,
          from.y + (toPoint.y - from.y) * step / steps, { buttons: 1 });
        await delay(35);
      }
      await delay(options.hold || 200);
      if (options.before) await options.before();
      if (options.cancel) {
        await page.key('Escape');
        await page.mouse('mouseReleased', toPoint.x, toPoint.y, { buttons: 0 });
      } else {
        await page.mouse('mouseReleased', toPoint.x, toPoint.y, { buttons: 0 });
      }
    },
    // Where every part of the page that should hold still sits. Group titles
    // are keyed by group, tiles by shortcut, so a re-render keeps the keys.
    // Shortcut parts count from the top of the area's content, so scrolling
    // the area is not a move; the area itself counts by its center, since a
    // classic scrollbar widens it on both sides.
    snapshot() {
      return page.evaluate(`(() => {
        const out = {};
        const section = document.querySelector('.x-nt-shortcuts-section');
        const scrollTop = section ? section.scrollTop : 0;
        const put = (key, element, inArea) => {
          if (!element) return;
          const r = element.getBoundingClientRect();
          if (!r.width && !r.height) return;
          out[key] = { left: r.left, top: r.top + (inArea ? scrollTop : 0), width: r.width, height: r.height };
        };
        put('search', document.getElementById('_x_extension_newtab_search_layer_2024_unique_'));
        put('dock', document.getElementById('_x_extension_newtab_bottom_dock_2024_unique_'));
        if (section) {
          const r = section.getBoundingClientRect();
          out.shortcuts = { left: r.left + r.width / 2, top: r.top, width: r.width, height: r.height };
        }
        document.querySelectorAll('.x-nt-shortcut-group-header').forEach((header) => {
          put('title:' + header.getAttribute('data-shortcut-group-id'), header, true);
        });
        document.querySelectorAll('.x-nt-shortcut-tile[data-shortcut-id]').forEach((tile) => {
          put('tile:' + tile.getAttribute('data-shortcut-id'), tile, true);
        });
        document.querySelectorAll('.x-nt-shortcut-group-empty').forEach((slot) => {
          put('slot:' + slot.getAttribute('data-shortcut-group-id'), slot, true);
        });
        const add = document.querySelector('.x-nt-shortcut-tile--add:not([hidden])');
        put('add', add, true);
        return out;
      })()`);
    },
    async settle(ms = SETTLE_MS) {
      await delay(ms);
    }
  };
  return page;
}

// Keys present in both snapshots whose box moved; `allow` names keys (or
// key prefixes ending in ':') that may move.
function movedBetween(before, after, allow = []) {
  const allowed = (key) => allow.some((rule) => (rule.endsWith(':') ? key.startsWith(rule) : key === rule));
  return Object.keys(before).filter((key) => after[key] && !allowed(key)).map((key) => {
    const a = before[key];
    const b = after[key];
    return { key, dx: Math.round((b.left - a.left) * 10) / 10, dy: Math.round((b.top - a.top) * 10) / 10 };
  }).filter((entry) => Math.abs(entry.dx) > TOLERANCE_PX || Math.abs(entry.dy) > TOLERANCE_PX);
}

// A grid that hugs its longest row re-centers when that row changes: every
// shortcut part shifts by the same amount and the grid stays centered under
// the search box. Anything else that moved is reported.
async function unevenShift(page, before, after, allow) {
  const moved = movedBetween(before, after, allow);
  const parts = moved.filter((entry) => /^(tile|title|slot):|^add$/.test(entry.key));
  const others = moved.filter((entry) => !parts.includes(entry));
  const dx = parts.length ? parts[0].dx : 0;
  const uneven = parts.filter((entry) => Math.abs(entry.dx - dx) > 1 || Math.abs(entry.dy) > TOLERANCE_PX);
  const offCenter = await page.evaluate(`(() => {
    const parts = Array.from(document.querySelectorAll('.x-nt-shortcut-tile[data-shortcut-id], .x-nt-shortcut-group-empty, .x-nt-shortcut-tile--add:not([hidden])'))
      .map((element) => element.getBoundingClientRect());
    const left = Math.min(...parts.map((r) => r.left));
    const right = Math.max(...parts.map((r) => r.right));
    const search = document.getElementById('_x_extension_newtab_search_layer_2024_unique_').getBoundingClientRect();
    return Math.round(((left + right) / 2 - (search.left + search.right) / 2) * 10) / 10;
  })()`);
  return [...others, ...uneven, ...(Math.abs(offCenter) > 1 ? [{ key: 'grid off center', dx: offCenter, dy: 0 }] : [])];
}

const link = (id, groupId, title) => ({ id, title: title || id, url: `https://${id}.example.com/`, groupId });
const BASE_GROUPS = [
  { id: 'g0', title: '' },
  { id: 'work', title: '工作' },
  { id: 'read', title: '阅读' }
];
const BASE_ITEMS = [
  ...['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => link(id, 'g0')),
  ...['w1', 'w2', 'w3', 'w4'].map((id) => link(id, 'work')),
  ...['r1', 'r2'].map((id) => link(id, 'read'))
];
const WIDE = { width: 1440, height: 1100 };

// Where the empty bookmarks bar would cover shortcuts, a drag leaves it
// hidden; the dock check needs a screen with room under the shortcuts.

const checks = [];
function check(name, viewport, run) {
  checks.push({ name, viewport, run });
}

// Hover and menus only change what is drawn, never where things are.
check('hovering an untitled group shows its placeholder in place', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.hover('[data-shortcut-group-id="g0"]', -200);
  await page.settle();
  return movedBetween(before, await page.snapshot());
});

const GROUP_DIALOG_INPUT = '.x-nt-shortcut-dialog input._x_extension_shortcut_input_2024_unique_';
const storedGroups = (page) => page.evaluate(`new Promise((resolve) => chrome.storage.sync.get(
  '_x_extension_newtab_shortcuts_v2_2026_unique_', (values) => resolve(values._x_extension_newtab_shortcuts_v2_2026_unique_.g)))`);
const dialogState = (page) => page.evaluate(`(() => {
  const dialog = document.querySelector('.x-nt-shortcut-dialog');
  const input = document.querySelector(${JSON.stringify(GROUP_DIALOG_INPUT)});
  const open = Boolean(dialog && dialog.getBoundingClientRect().height > 0 && getComputedStyle(dialog).visibility !== 'hidden');
  return { open, title: open ? (dialog.querySelector('.x-nt-shortcut-dialog-title') || {}).textContent : '',
    value: input ? input.value : null, urlFields: dialog ? dialog.querySelectorAll('input').length : 0,
    focused: document.activeElement === input };
})()`);

// Group titles are named in the shortcut dialog, never in the grid.
check('naming an untitled group opens the dialog and moves nothing', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.hover('[data-shortcut-group-id="g0"]', -200);
  await page.settle(200);
  await page.click('[data-shortcut-group-id="g0"] .x-nt-shortcut-group-title--placeholder');
  await page.settle();
  const problems = [];
  const state = await dialogState(page);
  if (!state.open || state.value !== '' || !state.focused || state.urlFields !== 1) {
    problems.push({ key: `dialog ${JSON.stringify(state)}`, dx: 0, dy: 0 });
  }
  problems.push(...movedBetween(before, await page.snapshot()));
  await page.key('Escape');
  await page.settle();
  problems.push(...movedBetween(before, await page.snapshot()).map((entry) => ({ ...entry, key: `after Esc ${entry.key}` })));
  return problems;
});

check('renaming a group in the dialog changes only its title', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.click('[data-shortcut-group-id="work"] .x-nt-shortcut-group-title', 2);
  await page.settle();
  const problems = [];
  const state = await dialogState(page);
  if (!state.open || state.value !== '工作') problems.push({ key: `dialog ${JSON.stringify(state)}`, dx: 0, dy: 0 });
  await page.evaluate(`document.querySelector(${JSON.stringify(GROUP_DIALOG_INPUT)}).select()`);
  await page.type('工作和项目管理');
  await page.key('Enter');
  await page.settle(700);
  const titles = (await storedGroups(page)).map((group) => group[1]);
  if (titles[1] !== '工作和项目管理') problems.push({ key: `stored titles ${JSON.stringify(titles)}`, dx: 0, dy: 0 });
  if ((await dialogState(page)).open) problems.push({ key: 'dialog stayed open', dx: 0, dy: 0 });
  problems.push(...movedBetween(before, await page.snapshot()).map((e) => ({ ...e, key: `saved ${e.key}` })));
  return problems;
});

// The add tile asks what to add on a click and has no right-click menu.
check('the add tile offers a site, a group or hiding it', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  // A closed menu keeps its options laid out; its control says whether it is open.
  const menu = () => page.evaluate(`(() => {
    const control = document.querySelector('.x-nt-shortcut-context-menu');
    if (!control || control.getAttribute('data-open') !== 'true') return [];
    return Array.from(document.querySelectorAll('.x-nt-shortcut-context-menu-portal:not(.x-nt-bookmark-context-menu-portal):not(.x-nt-recent-context-menu-portal) [data-value]'))
      .map((option) => option.getAttribute('data-value'));
  })()`);
  const problems = [];
  await page.contextMenu('.x-nt-shortcut-tile--add');
  await page.settle(300);
  if ((await menu()).length) problems.push({ key: `right-click opened ${JSON.stringify(await menu())}`, dx: 0, dy: 0 });
  await page.click('.x-nt-shortcut-tile--add');
  await page.settle(300);
  const options = await menu();
  if (JSON.stringify(options) !== JSON.stringify(['shortcut-add', 'group-create', 'hide-add'])) {
    problems.push({ key: `menu ${JSON.stringify(options)}`, dx: 0, dy: 0 });
  }
  await page.click('.x-nt-shortcut-tile--add');
  await page.settle(300);
  if ((await menu()).length) problems.push({ key: 'a second press left the menu open', dx: 0, dy: 0 });
  await page.click('.x-nt-shortcut-tile--add');
  await page.settle(300);
  await page.click('.x-nt-shortcut-context-menu-portal [data-value="shortcut-add"]');
  await page.settle(500);
  const state = await dialogState(page);
  if (!state.open || state.urlFields < 2) problems.push({ key: `add site dialog ${JSON.stringify(state)}`, dx: 0, dy: 0 });
  return problems;
});

check('group and tile menus open in place', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.hover('[data-shortcut-group-id="work"] .x-nt-shortcut-group-title');
  await page.settle(150);
  await page.click('[data-shortcut-group-id="work"] .x-nt-shortcut-group-more');
  await page.settle();
  const groupMenu = movedBetween(before, await page.snapshot());
  await page.key('Escape');
  await page.contextMenu('[data-shortcut-id="w2"]');
  await page.settle();
  const tileMenu = movedBetween(before, await page.snapshot());
  await page.key('Escape');
  await page.settle();
  return [...groupMenu, ...tileMenu.map((e) => ({ ...e, key: `tile menu ${e.key}` }))];
});

check('dock magnification leaves tile boxes in place', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  for (const id of ['a3', 'w1', 'r2']) {
    await page.hover(`[data-shortcut-id="${id}"]`);
    await page.settle(250);
  }
  return movedBetween(before, await page.snapshot());
});

check('a canceled tile drag puts everything back', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const target = await page.rect('[data-shortcut-id="r2"]');
  await page.drag('[data-shortcut-id="a2"]', { x: target.right + 20, y: target.y }, { cancel: true });
  await page.settle(700);
  return movedBetween(before, await page.snapshot());
});

check('reordering inside a group moves only that group\'s tiles', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const target = await page.rect('[data-shortcut-id="w3"]');
  await page.drag('[data-shortcut-id="w1"]', { x: target.right - 4, y: target.y });
  await page.settle(900);
  return movedBetween(before, await page.snapshot(), ['tile:w1', 'tile:w2', 'tile:w3', 'tile:w4']);
});

check('moving a tile into another group keeps the other groups in place', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const target = await page.rect('[data-shortcut-id="r2"]');
  await page.drag('[data-shortcut-id="w4"]', { x: target.right + 8, y: target.y });
  await page.settle(900);
  return movedBetween(before, await page.snapshot(), ['tile:w4', 'add']);
});

check('emptying the longest row re-centers the grid as a whole', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const target = await page.rect('[data-shortcut-id="r2"]');
  await page.drag('[data-shortcut-id="a5"]', { x: target.right + 8, y: target.y });
  await page.settle(900);
  return unevenShift(page, before, await page.snapshot(), ['tile:a5', 'add']);
});

check('a drag shows the empty bookmarks bar without moving the page', { width: 1440, height: 1300 }, async (page) => {
  // The bar is shown for a drag when it is empty but other bookmarks exist.
  await page.load();
  const bookmarkId = await page.evaluate(`new Promise((resolve) => chrome.bookmarks.create(
    { parentId: '2', title: 'Elsewhere', url: 'https://elsewhere.example.com/' }, (node) => resolve(node.id)))`);
  await page.seed([{ id: 'g0', title: '' }, { id: 'work', title: '工作' }],
    [link('a1', 'g0'), link('a2', 'g0'), link('w1', 'work')]);
  try {
    return await dragShowsEmptyBookmarksBar(page);
  } finally {
    await page.evaluate(`new Promise((resolve) => chrome.bookmarks.remove(${JSON.stringify(bookmarkId)}, resolve))`);
  }
});

check('a drag leaves the empty bookmarks bar hidden where it would cover shortcuts', WIDE, async (page) => {
  await page.load();
  const bookmarkId = await page.evaluate(`new Promise((resolve) => chrome.bookmarks.create(
    { parentId: '2', title: 'Elsewhere', url: 'https://elsewhere.example.com/' }, (node) => resolve(node.id)))`);
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  try {
    const before = await page.snapshot();
    const moves = [];
    const target = await page.rect('[data-shortcut-id="r1"]');
    await page.drag('[data-shortcut-id="a2"]', { x: target.x, y: target.bottom + 4 }, {
      cancel: true,
      before: async () => {
        const shown = await page.evaluate(`document.getElementById('_x_extension_newtab_bookmarks_grid_2024_unique_').getAttribute('data-bookmark-empty-drop-surface')`);
        if (shown === 'true') moves.push({ key: 'empty bookmarks bar covered the shortcuts', dx: 0, dy: 0 });
        // The dragged tile opens a slot among the tiles it passes.
        moves.push(...movedBetween(before, await page.snapshot(), ['tile:', 'add']).map((e) => ({ ...e, key: `during drag ${e.key}` })));
      }
    });
    await page.settle(800);
    moves.push(...movedBetween(before, await page.snapshot()).map((e) => ({ ...e, key: `after ${e.key}` })));
    return moves;
  } finally {
    await page.evaluate(`new Promise((resolve) => chrome.bookmarks.remove(${JSON.stringify(bookmarkId)}, resolve))`);
  }
});

async function dragShowsEmptyBookmarksBar(page) {
  const before = await page.snapshot();
  const moves = [];
  await page.drag('[data-shortcut-id="a1"]', { x: (await page.rect('[data-shortcut-id="a2"]')).x, y: 60 }, {
    cancel: true,
    before: async () => {
      const shown = await page.evaluate(`document.getElementById('_x_extension_newtab_bookmarks_grid_2024_unique_').getAttribute('data-bookmark-empty-drop-surface')`);
      if (shown !== 'true') moves.push({ key: 'empty bookmarks bar was not shown', dx: 0, dy: 0 });
      moves.push(...movedBetween(before, await page.snapshot(), ['tile:a1', 'dock'])
        .map((entry) => ({ ...entry, key: `during drag ${entry.key}` })));
    }
  });
  await page.settle(800);
  moves.push(...movedBetween(before, await page.snapshot()).map((entry) => ({ ...entry, key: `after ${entry.key}` })));
  const stillShown = await page.evaluate(`document.getElementById('_x_extension_newtab_bookmarks_grid_2024_unique_').getAttribute('data-bookmark-empty-drop-surface')`);
  if (stillShown === 'true') moves.push({ key: 'empty bookmarks bar stayed after the drag', dx: 0, dy: 0 });
  return moves;
}

check('creating a group adds below without moving what is there', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.click('.x-nt-shortcut-tile--add');
  await page.settle(300);
  await page.click('.x-nt-shortcut-context-menu-portal [data-value="group-create"]');
  await page.settle();
  await page.type('新分组');
  await page.key('Enter');
  await page.settle();
  const titles = (await storedGroups(page)).map((group) => group[1]);
  return [...movedBetween(before, await page.snapshot(), ['add']),
    ...(titles[3] === '新分组' ? [] : [{ key: `stored titles ${JSON.stringify(titles)}`, dx: 0, dy: 0 }])];
});

check('deleting a group and undoing it restores every position', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.hover('[data-shortcut-group-id="read"] .x-nt-shortcut-group-title');
  await page.settle(150);
  await page.click('[data-shortcut-group-id="read"] .x-nt-shortcut-group-more');
  await page.settle(300);
  await page.click('.x-nt-shortcut-context-menu-portal [data-value="group-delete"]');
  await page.settle(700);
  const deleted = movedBetween(before, await page.snapshot(), ['tile:', 'add', 'title:', 'shortcuts']);
  await page.key('z', 4);
  await page.settle(900);
  return [...deleted.map((e) => ({ ...e, key: `deleted ${e.key}` })), ...movedBetween(before, await page.snapshot())];
});

check('dragging a group title and canceling moves nothing', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const target = await page.rect('[data-shortcut-group-id="work"]');
  await page.drag('[data-shortcut-group-id="read"] .x-nt-shortcut-group-title', { x: target.x, y: target.top + 2 }, {
    cancel: true
  });
  await page.settle();
  return movedBetween(before, await page.snapshot());
});

check('the search box and dock hold still while groups change', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const keep = (snap) => Object.fromEntries(Object.entries(snap).filter(([key]) => key === 'search' || key === 'dock'));
  const moves = [];
  await page.click('.x-nt-shortcut-tile--add');
  await page.settle(300);
  await page.click('.x-nt-shortcut-context-menu-portal [data-value="group-create"]');
  await page.settle();
  // An empty name makes an untitled group.
  await page.key('Enter');
  await page.settle();
  moves.push(...movedBetween(keep(before), await page.snapshot()).map((e) => ({ ...e, key: `create ${e.key}` })));
  const target = await page.rect('.x-nt-shortcut-group-empty');
  await page.drag('[data-shortcut-id="a1"]', { x: target.x, y: target.y });
  await page.settle(900);
  moves.push(...movedBetween(keep(before), await page.snapshot()).map((e) => ({ ...e, key: `drop ${e.key}` })));
  return moves;
});

check('a scrolling shortcut area keeps the search box and dock still', { width: 1280, height: 860 }, async (page) => {
  const many = Array.from({ length: 34 }, (_, index) => link(`m${index}`, index < 14 ? 'g0' : index < 28 ? 'work' : 'read'));
  await page.seed(BASE_GROUPS, many);
  const scrollable = await page.evaluate(`document.querySelector('.x-nt-shortcuts-section').getAttribute('data-shortcuts-scrollable')`);
  if (scrollable !== 'true') return [{ key: 'shortcut area did not scroll', dx: 0, dy: 0 }];
  const before = await page.snapshot();
  const keep = ['search', 'dock', 'shortcuts'];
  const only = (snap) => Object.fromEntries(Object.entries(snap).filter(([key]) => keep.includes(key)));
  await page.evaluate(`document.querySelector('.x-nt-shortcuts-section').scrollTop = 200`);
  await page.settle(300);
  const scrolled = movedBetween(only(before), await page.snapshot());
  const area = await page.rect('.x-nt-shortcuts-section');
  await page.drag('[data-shortcut-id="m15"]', { x: area.x, y: area.bottom - 12 }, { hold: 900 });
  await page.settle(900);
  return [...scrolled, ...movedBetween(only(before), await page.snapshot()).map((e) => ({ ...e, key: `after drag ${e.key}` }))];
});

async function main() {
  const only = process.env.LUMNO_E2E_ONLY;
  const selected = checks.filter((entry) => !only || entry.name.includes(only));
  const { cdp, close } = await launchBrowser();
  let failures = 0;
  try {
    for (const entry of selected) {
      const page = await openPage(cdp, entry.viewport);
      let moved;
      try {
        moved = await entry.run(page);
      } catch (error) {
        moved = [{ key: `error: ${error.message.split('\n')[0]}`, dx: 0, dy: 0 }];
      }
      const problems = [...moved, ...page.errors.map((error) => ({ key: `console: ${error.slice(0, 160)}`, dx: 0, dy: 0 }))];
      if (problems.length) {
        failures += 1;
        process.stdout.write(`FAIL ${entry.name}\n${problems.map((p) => `     ${p.key}  dx=${p.dx} dy=${p.dy}`).join('\n')}\n`);
      } else {
        process.stdout.write(`ok   ${entry.name}\n`);
      }
      await cdp.send('Target.closeTarget', { targetId: (await cdp.send('Target.getTargets')).targetInfos
        .find((info) => info.url.startsWith(NEWTAB_URL))?.targetId }).catch(() => {});
    }
  } finally {
    close();
  }
  process.stdout.write(`\n${selected.length - failures}/${selected.length} shortcut group layout checks passed.\n`);
  process.exitCode = failures ? 1 : 0;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { launchBrowser, openPage, movedBetween, BASE_GROUPS, BASE_ITEMS, link };
