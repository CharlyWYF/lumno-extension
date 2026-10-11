const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const {
  createBookmarkCascadeMenuRuntime
} = require(path.join(repoRoot, 'src', 'newtab', 'bookmark-cascade-menu.js'));
const {
  createFakeBookmarkCascadeView
} = require(path.join(repoRoot, 'scripts', 'helpers', 'fake-bookmark-cascade-view.js'));

function createFakeEvent(type, values) {
  return {
    type,
    defaultPrevented: false,
    propagationStopped: false,
    immediatePropagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    stopImmediatePropagation() {
      this.immediatePropagationStopped = true;
      this.propagationStopped = true;
    },
    ...(values || {})
  };
}

function parseSelector(selector) {
  const source = String(selector || '').trim();
  const attrMatch = source.match(/\[([^=\]]+)="([^"]*)"\]/);
  const attr = attrMatch ? { name: attrMatch[1], value: attrMatch[2] } : null;
  const withoutAttr = attr ? source.replace(attrMatch[0], '') : source;
  const classMatch = withoutAttr.match(/\.([A-Za-z0-9_-]+)/);
  const className = classMatch ? classMatch[1] : '';
  const tag = withoutAttr.replace(/\.[A-Za-z0-9_-]+/, '').trim().toUpperCase();
  return { attr, className, tag };
}

function createFakeElement(tagName, ownerDocument) {
  const children = [];
  const attributes = new Map();
  const listeners = new Map();
  const classes = new Set();
  const styleValues = new Map();
  let classNameValue = '';
  let textContentValue = '';
  let rect = { left: 0, top: 0, width: 210, height: 32 };
  const element = {
    tagName: String(tagName || '').toUpperCase(),
    nodeType: 1,
    children,
    childNodes: children,
    ownerDocument,
    parentNode: null,
    get className() {
      return classNameValue;
    },
    set className(value) {
      classNameValue = String(value || '');
      classes.clear();
      classNameValue.split(/\s+/).filter(Boolean).forEach((part) => classes.add(part));
    },
    innerHTML: '',
    get textContent() {
      return textContentValue || children.map((child) => child.textContent || '').join('');
    },
    set textContent(value) {
      textContentValue = String(value || '');
    },
    title: '',
    type: '',
    value: '',
    tabIndex: 0,
    _connected: false,
    get isConnected() {
      return element._connected || element === ownerDocument.body || Boolean(element.parentNode && element.parentNode.isConnected);
    },
    get firstChild() {
      return children[0] || null;
    },
    get offsetWidth() {
      return rect.width;
    },
    get offsetHeight() {
      return rect.height;
    },
    classList: {
      add: (...names) => {
        names.forEach((name) => {
          String(name || '').split(/\s+/).filter(Boolean).forEach((part) => classes.add(part));
        });
        classNameValue = Array.from(classes).join(' ');
      },
      remove: (...names) => {
        names.forEach((name) => classes.delete(name));
        classNameValue = Array.from(classes).join(' ');
      },
      contains: (name) => classes.has(name)
    },
    style: {
      setProperty: (name, value) => styleValues.set(name, String(value)),
      removeProperty: (name) => styleValues.delete(name),
      getPropertyValue: (name) => styleValues.get(name) || ''
    },
    setRect(nextRect) {
      rect = { ...rect, ...(nextRect || {}) };
    },
    appendChild(child) {
      child.parentNode = element;
      child.ownerDocument = ownerDocument;
      children.push(child);
      return child;
    },
    insertBefore(child, reference) {
      child.parentNode = element;
      child.ownerDocument = ownerDocument;
      const index = children.indexOf(reference);
      if (index < 0) {
        children.push(child);
      } else {
        children.splice(index, 0, child);
      }
      return child;
    },
    removeChild(child) {
      const index = children.indexOf(child);
      if (index >= 0) {
        children.splice(index, 1);
        child.parentNode = null;
      }
      return child;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.get(name) || '';
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    addEventListener(type, listener) {
      const eventName = String(type || '');
      listeners.set(eventName, [...(listeners.get(eventName) || []), listener]);
    },
    dispatchEvent(event) {
      const nextEvent = event || createFakeEvent('');
      nextEvent.target = nextEvent.target || element;
      (listeners.get(nextEvent.type) || []).forEach((listener) => listener(nextEvent));
      return !nextEvent.defaultPrevented;
    },
    focus() {
      ownerDocument.activeElement = element;
      element.dispatchEvent(createFakeEvent('focus', { target: element }));
    },
    matches(selector) {
      if (selector === ':hover') {
        return false;
      }
      const parsed = parseSelector(selector);
      if (parsed.tag && element.tagName !== parsed.tag) {
        return false;
      }
      if (parsed.className && !classes.has(parsed.className)) {
        return false;
      }
      if (parsed.attr && element.getAttribute(parsed.attr.name) !== parsed.attr.value) {
        return false;
      }
      return true;
    },
    contains(target) {
      if (target === element) {
        return true;
      }
      return children.some((child) => child.contains && child.contains(target));
    },
    querySelector(selector) {
      return element.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const matches = [];
      function visit(node) {
        if (node.matches && node.matches(selector)) {
          matches.push(node);
        }
        (node.children || []).forEach(visit);
      }
      children.forEach(visit);
      return matches;
    },
    getBoundingClientRect() {
      return {
        left: rect.left,
        top: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        width: rect.width,
        height: rect.height
      };
    }
  };
  return element;
}

function createFakeDocument() {
  const listeners = new Map();
  const fakeDocument = {
    activeElement: null,
    body: null,
    documentElement: { clientWidth: 1024, clientHeight: 720 },
    createElement(tagName) {
      return createFakeElement(tagName, fakeDocument);
    },
    createElementNS(_namespace, tagName) {
      return createFakeElement(tagName, fakeDocument);
    },
    addEventListener(type, listener) {
      const eventName = String(type || '');
      listeners.set(eventName, [...(listeners.get(eventName) || []), listener]);
    },
    dispatchEvent(event) {
      const nextEvent = event || createFakeEvent('');
      nextEvent.target = nextEvent.target || fakeDocument.activeElement || fakeDocument.body;
      (listeners.get(nextEvent.type) || []).forEach((listener) => listener(nextEvent));
      return !nextEvent.defaultPrevented;
    }
  };
  fakeDocument.body = createFakeElement('body', fakeDocument);
  fakeDocument.body._connected = true;
  return fakeDocument;
}

function getMenuItems(levelElement) {
  return levelElement ? levelElement.querySelectorAll('.x-nt-bookmark-cascade-item') : [];
}

function getLevelTitle(levelElement) {
  const title = levelElement && levelElement.querySelector('.x-nt-bookmark-cascade-title');
  return title ? title.textContent : '';
}

function getActiveLabel(levelElement) {
  const active = levelElement && levelElement.querySelector('.x-nt-bookmark-cascade-item[data-active="true"]');
  return active ? active.textContent : '';
}

function dispatchKey(documentObj, key) {
  const event = createFakeEvent('keydown', { key });
  documentObj.dispatchEvent(event);
  assert.ok(event.defaultPrevented, `${key} should be handled by the open cascade menu`);
  return event;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

(async () => {
  const documentObj = createFakeDocument();
  const anchor = documentObj.createElement('button');
  const anchorVisualStates = [];
  anchor._xSetBookmarkMenuVisualActive = (active) => {
    anchorVisualStates.push(Boolean(active));
  };
  anchor.setRect({ left: 20, top: 20, width: 120, height: 40 });
  documentObj.body.appendChild(anchor);

  const itemsByFolder = {
    root: [
      { id: 'research', title: 'Research', type: 'folder' },
      { id: 'patterns', title: 'Patterns', type: 'folder' },
      { id: 'archive', title: 'Archive', url: 'https://example.com/archive' },
      { id: 'router', title: 'Router', url: 'http://192.168.1.1/admin' }
    ],
    research: [
      { id: 'amazon', title: 'Amazon Menu Aim', url: 'https://example.com/amazon' },
      { id: 'nngroup', title: 'NNGroup', url: 'https://example.com/nngroup' }
    ],
    patterns: [
      { id: 'pattern-library', title: 'Pattern Library', url: 'https://example.com/patterns' }
    ]
  };

  const faviconCalls = [];
  const copyCalls = [];
  const openUrlCalls = [];
  const tooltipCalls = [];
  const runtime = createBookmarkCascadeMenuRuntime({
    view: createFakeBookmarkCascadeView(),
    documentObj,
    windowObj: {
      innerWidth: 1024,
      innerHeight: 720,
      performance: { now: () => 0 },
      setTimeout,
      clearTimeout,
      requestAnimationFrame: (callback) => {
        callback();
        return 1;
      },
      cancelAnimationFrame() {},
      getComputedStyle: () => ({ transform: 'none' })
    },
    positionUtils: {
      placeRootCascadeMenu: () => ({ left: 40, top: 70, side: 'right', horizontal: 'right', vertical: 'bottom' }),
      placeCascadeSubmenu: () => ({ left: 260, top: 70, side: 'right', horizontal: 'right', vertical: 'bottom' }),
      getTranslateNeutralRect: (rect) => rect,
      buildCascadeSafeTriangle: () => null,
      isPointInsideCascadeSafeTriangle: () => false
    },
    menuSurface: {
      applyContentWidth() {},
      open(element) {
        element.setAttribute('data-open', 'true');
      }
    },
    t: (_key, fallback) => fallback || '',
    sanitizeDisplayText: (value) => String(value || ''),
    getHostFromUrl: (url) => new URL(url).hostname,
    getSiteDisplayName: (_host, title) => title || '',
    getUrlDisplay: (url) => url,
    getRiSvg: () => '',
    getFigmaFolderSvg: () => '',
    initFolderPathMorph() {},
    playFolderPathMorph() {},
    attachFaviconWithFallbacks(_img, url, host, options) {
      faviconCalls.push({ url, host, browserUrl: options && options.browserUrl });
    },
    isLocalNetworkHost: (host) => String(host || '').startsWith('192.168.'),
    getChromeFaviconUrl: (url) => `chrome://favicon2/?pageUrl=${encodeURIComponent(url)}&size=128`,
    ensureReady: () => Promise.resolve(true),
    getItems: (folderId) => itemsByFolder[String(folderId || '')] || [],
    copyTooltipController: {
      show(target, text, options) {
        tooltipCalls.push({
          type: 'show',
          target,
          text,
          placement: options && options.placement,
          maxWidth: options && options.maxWidth,
          spacing: options && options.spacing
        });
      },
      hide() {
        tooltipCalls.push({ type: 'hide' });
      }
    },
    copyUrl(url) {
      copyCalls.push(url);
      return Promise.resolve(true);
    },
    openUrl(url, options) {
      openUrlCalls.push({ url, options });
    }
  });

  runtime.open({ id: 'root', title: 'Root' }, anchor);
  await flushPromises();
  assert.deepStrictEqual(
    anchorVisualStates,
    [true],
    'opening the cascade menu should keep the trigger folder card visually active'
  );

  let levels = documentObj.body.querySelectorAll('.x-nt-bookmark-cascade-level');
  assert.strictEqual(levels.length, 1, 'opening a cascade should render the root menu level');
  let rootItems = getMenuItems(levels[0]);
  assert.strictEqual(
    levels[0].style.getPropertyValue('width'),
    '210px',
    'each cascade level should lock its initial rendered width before hover styles can affect truncation'
  );
  assert.strictEqual(getLevelTitle(levels[0]), 'Root', 'opening a cascade should render the trigger folder title');
  assert.strictEqual(rootItems.length, 4, 'folder titles should not be counted as keyboard menu items');
  assert.ok(
    faviconCalls.some((call) => (
      call.url === 'http://192.168.1.1/admin' &&
      call.host === '192.168.1.1' &&
      call.browserUrl === 'chrome://favicon2/?pageUrl=http%3A%2F%2F192.168.1.1%2Fadmin&size=128'
    )),
    'local bookmark cascade items should pass the browser favicon candidate'
  );
  assert.strictEqual(getActiveLabel(levels[0]), 'Research', 'opening a cascade should select the first menu item');
  assert.strictEqual(documentObj.activeElement, rootItems[0], 'opening a cascade should move keyboard focus into the menu');

  const initialRootLevel = levels[0];
  runtime.open({ id: 'root', title: 'Root' }, anchor);
  await flushPromises();
  levels = documentObj.body.querySelectorAll('.x-nt-bookmark-cascade-level');
  assert.strictEqual(
    levels[0],
    initialRootLevel,
    'opening an already-open folder without toggle should reuse the current menu without replaying its open animation'
  );
  assert.deepStrictEqual(
    anchorVisualStates,
    [true],
    'opening an already-open folder without toggle should not reactivate its visual state'
  );
  rootItems = getMenuItems(levels[0]);

  const rootCopyTriggers = levels[0].querySelectorAll('.x-nt-bookmark-cascade-copy-trigger');
  assert.strictEqual(rootCopyTriggers.length, 2, 'URL bookmarks should render copy triggers while folders do not');
  const archiveCopyTrigger = rootCopyTriggers[0];
  const archiveCopyRow = archiveCopyTrigger.parentNode;
  assert.strictEqual(archiveCopyTrigger.getAttribute('aria-label'), 'Copy link');
  const tooltipCallCountBeforeRowHover = tooltipCalls.length;
  archiveCopyRow.dispatchEvent(createFakeEvent('pointerenter'));
  assert.strictEqual(
    tooltipCalls.length,
    tooltipCallCountBeforeRowHover,
    'hovering the bookmark row should reveal the icon through CSS without showing its tooltip'
  );
  archiveCopyTrigger.dispatchEvent(createFakeEvent('pointerenter'));
  assert.deepStrictEqual(
    tooltipCalls[tooltipCalls.length - 1],
    {
      type: 'show',
      target: archiveCopyTrigger,
      text: 'Copy link',
      placement: 'top',
      maxWidth: 200,
      spacing: 8
    },
    'hovering the copy icon should show its dedicated Copy link tooltip'
  );
  const copyClick = createFakeEvent('click');
  archiveCopyTrigger.dispatchEvent(copyClick);
  await flushPromises();
  assert.deepStrictEqual(copyCalls, ['https://example.com/archive']);
  assert.ok(copyClick.defaultPrevented, 'copy clicks should not open the bookmark');
  assert.ok(copyClick.propagationStopped, 'copy clicks should not bubble into the bookmark row');
  archiveCopyTrigger.dispatchEvent(createFakeEvent('pointerleave'));
  assert.deepStrictEqual(tooltipCalls[tooltipCalls.length - 1], { type: 'hide' });
  archiveCopyTrigger.focus();
  assert.deepStrictEqual(
    tooltipCalls[tooltipCalls.length - 1],
    {
      type: 'show',
      target: archiveCopyTrigger,
      text: 'Copy link',
      placement: 'top',
      maxWidth: 200,
      spacing: 8
    },
    'keyboard focus on the copy icon should show the same dedicated tooltip'
  );
  archiveCopyTrigger.dispatchEvent(createFakeEvent('blur'));
  rootItems[0].focus();

  dispatchKey(documentObj, 'ArrowDown');
  assert.strictEqual(getActiveLabel(levels[0]), 'Patterns', 'ArrowDown should move selection to the next root item');
  assert.strictEqual(documentObj.activeElement, rootItems[1], 'ArrowDown should move focus with the selected item');

  dispatchKey(documentObj, 'ArrowUp');
  assert.strictEqual(getActiveLabel(levels[0]), 'Research', 'ArrowUp should move selection to the previous root item');
  assert.strictEqual(documentObj.activeElement, rootItems[0], 'ArrowUp should focus the previous item');

  dispatchKey(documentObj, 'ArrowRight');
  levels = documentObj.body.querySelectorAll('.x-nt-bookmark-cascade-level');
  assert.strictEqual(levels.length, 2, 'ArrowRight on a folder should open its submenu');
  assert.strictEqual(rootItems[0].getAttribute('aria-expanded'), 'true', 'ArrowRight should mark the selected folder expanded');
  assert.strictEqual(getLevelTitle(levels[1]), 'Research', 'opening a submenu should render the nested folder title');
  assert.strictEqual(getMenuItems(levels[1]).length, 2, 'nested folder titles should not be counted as keyboard menu items');
  assert.strictEqual(getActiveLabel(levels[1]), 'Amazon Menu Aim', 'opening a submenu from keyboard should select its first item');
  assert.strictEqual(documentObj.activeElement, getMenuItems(levels[1])[0], 'ArrowRight should move focus into the submenu');

  dispatchKey(documentObj, 'ArrowDown');
  assert.strictEqual(getActiveLabel(levels[1]), 'NNGroup', 'ArrowDown should move selection inside the current submenu');

  dispatchKey(documentObj, 'ArrowLeft');
  levels = documentObj.body.querySelectorAll('.x-nt-bookmark-cascade-level');
  assert.strictEqual(levels.length, 1, 'ArrowLeft inside a submenu should close that submenu');
  assert.strictEqual(rootItems[0].getAttribute('aria-expanded'), 'false', 'ArrowLeft should collapse the parent folder');
  assert.strictEqual(getActiveLabel(levels[0]), 'Research', 'ArrowLeft should keep the parent item selected');
  assert.strictEqual(documentObj.activeElement, rootItems[0], 'ArrowLeft should restore focus to the parent item');

  dispatchKey(documentObj, 'ArrowDown');
  dispatchKey(documentObj, 'ArrowRight');
  levels = documentObj.body.querySelectorAll('.x-nt-bookmark-cascade-level');
  assert.strictEqual(levels.length, 2, 'ArrowRight should enter the newly selected sibling folder');
  assert.strictEqual(getLevelTitle(levels[1]), 'Patterns', 'sibling submenus should render their own folder title');
  assert.strictEqual(getActiveLabel(levels[1]), 'Pattern Library', 'the newly opened submenu should select its first child');

  dispatchKey(documentObj, 'Escape');
  assert.strictEqual(runtime.isOpen(), false, 'Escape should close the cascade menu');
  assert.strictEqual(documentObj.activeElement, anchor, 'Escape should restore focus to the trigger');
  assert.strictEqual(
    anchorVisualStates[anchorVisualStates.length - 1],
    false,
    'closing the cascade menu should release the trigger folder card visual active state'
  );

  runtime.open({ id: 'root', title: 'Root' }, anchor);
  await flushPromises();
  levels = documentObj.body.querySelectorAll('.x-nt-bookmark-cascade-level');
  rootItems = getMenuItems(levels[0]);
  rootItems[2].dispatchEvent(createFakeEvent('click'));
  assert.strictEqual(
    openUrlCalls[0].url,
    'https://example.com/archive',
    'clicking a leaf inside the folder menu should open its bookmark'
  );
  assert.strictEqual(openUrlCalls[0].options.openInBackgroundTab, false);
  assert.strictEqual(
    openUrlCalls[0].options.anchor,
    anchor,
    'the opened bookmark should carry the menu anchor even though the menu closes first'
  );
  assert.strictEqual(
    runtime.isOpen(),
    false,
    'foreground bookmark activation should close the folder menu'
  );

  runtime.open({ id: 'root', title: 'Root' }, anchor);
  await flushPromises();
  levels = documentObj.body.querySelectorAll('.x-nt-bookmark-cascade-level');
  rootItems = getMenuItems(levels[0]);
  rootItems[2].dispatchEvent(createFakeEvent('auxclick', { button: 1 }));
  assert.strictEqual(openUrlCalls[1].url, 'https://example.com/archive');
  assert.strictEqual(
    openUrlCalls[1].options.openInBackgroundTab,
    true,
    'middle-clicking a leaf should open it in the background'
  );
  assert.strictEqual(
    runtime.isOpen(),
    true,
    'background bookmark activation should keep the folder menu open'
  );
  runtime.close();

  const toggleOptions = { toggle: true };
  runtime.open({ id: 'root', title: 'Root' }, anchor, toggleOptions);
  await flushPromises();
  assert.strictEqual(runtime.isOpen(), true, 'the first folder activation should expand its menu');
  assert.strictEqual(anchor.getAttribute('aria-expanded'), 'true');
  dispatchKey(documentObj, 'ArrowRight');
  runtime.open({ id: 'root', title: 'Root' }, anchor, toggleOptions);
  assert.strictEqual(runtime.isOpen(), false, 'the second folder activation should collapse all menu levels');
  assert.strictEqual(documentObj.body.querySelectorAll('.x-nt-bookmark-cascade-level').length, 0);
  assert.strictEqual(anchor.getAttribute('aria-expanded'), 'false');
  assert.strictEqual(anchorVisualStates[anchorVisualStates.length - 1], false);
  assert.strictEqual(documentObj.activeElement, anchor, 'collapsing the menu should restore focus to its trigger');

  runtime.open({ id: 'root', title: 'Root' }, anchor, toggleOptions);
  await flushPromises();
  assert.strictEqual(runtime.isOpen(), true, 'a third folder activation should reopen the menu');
  runtime.close();

  runtime.open({ id: 'root', title: 'Root' }, anchor, toggleOptions);
  runtime.open({ id: 'root', title: 'Root' }, anchor, toggleOptions);
  await flushPromises();
  assert.strictEqual(runtime.isOpen(), false, 'a second activation during loading should cancel the pending menu');
  assert.strictEqual(anchor.getAttribute('aria-expanded'), 'false');
  runtime.open({ id: 'root', title: 'Root' }, anchor, toggleOptions);
  runtime.open({ id: 'root', title: 'Root' }, anchor, toggleOptions);
  runtime.open({ id: 'root', title: 'Root' }, anchor, toggleOptions);
  await flushPromises();
  assert.strictEqual(runtime.isOpen(), true, 'rapid repeated activations should respect the last toggle');
  runtime.close();

  runtime.open({ id: 'root', title: 'Root' }, anchor, { dragMode: true, toggle: true });
  await flushPromises();
  const dragMenu = documentObj.body.querySelector('.x-nt-bookmark-cascade-menu');
  runtime.open({ id: 'root', title: 'Root' }, anchor, { dragMode: true, toggle: true });
  assert.strictEqual(runtime.isOpen(), true, 'repeated drag expansion should keep the folder open');
  assert.strictEqual(documentObj.body.querySelector('.x-nt-bookmark-cascade-menu'), dragMenu);
  runtime.close();

  console.log('newtab bookmark cascade keyboard tests passed');
})();
