const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const newtabJs = readNewtabRuntimeSource();
const newtabHtml = readPageSource('newtab.html');
const cascadeMenuJs = fs.readFileSync(path.join(repoRoot, 'src', 'newtab', 'bookmark-cascade-menu.js'), 'utf8');
const {
  buildCascadeSafeTriangle,
  isPointInsideCascadeSafeTriangle
} = require(path.join(repoRoot, 'src', 'newtab', 'bookmark-cascade-position.js'));
const {
  createBookmarkCascadeMenuRuntime
} = require(path.join(repoRoot, 'src', 'newtab', 'bookmark-cascade-menu.js'));
const {
  createFakeBookmarkCascadeView
} = require(path.join(repoRoot, 'scripts', 'helpers', 'fake-bookmark-cascade-view.js'));

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function getCssRuleBody(source, selector) {
  const selectorIndex = source.indexOf(selector);
  assert.ok(selectorIndex >= 0, `${selector} rule should exist`);
  const braceStart = source.indexOf('{', selectorIndex);
  assert.ok(braceStart >= 0, `${selector} rule should have a body`);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart + 1, index);
      }
    }
  }
  throw new Error(`${selector} rule should be parseable`);
}

function getCssZIndex(source, selector) {
  const body = getCssRuleBody(source, selector);
  const match = body.match(/z-index:\s*(-?\d+)/);
  assert.ok(match, `${selector} should define a z-index`);
  return Number.parseInt(match[1], 10);
}

function getCssNumericDeclaration(source, selector, propertyName) {
  const body = getCssRuleBody(source, selector);
  const escapedProperty = String(propertyName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = body.match(new RegExp(`${escapedProperty}:\\s*(-?\\d+)`));
  assert.ok(match, `${selector} should define ${propertyName} as a numeric value`);
  return Number.parseInt(match[1], 10);
}

function assertBookmarkCursorTooltipAboveCascade(source, label) {
  assert.ok(
    getCssNumericDeclaration(source, '.x-nt-bookmark-cursor-tooltip', '--x-extension-tooltip-z-index') >
      getCssZIndex(source, '.x-nt-bookmark-cascade-menu'),
    `${label} bookmark cursor tooltip should render above the bookmark cascade menu`
  );
}

function getJsConstNumber(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)\\s*;`));
  assert.ok(match, `${name} should be defined as a numeric constant`);
  return Number.parseInt(match[1], 10);
}

function createFakeEvent(type, values) {
  return {
    type,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
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
    tabIndex: 0,
    _connected: false,
    get isConnected() {
      return element._connected ||
        element === ownerDocument.body ||
        Boolean(element.parentNode && element.parentNode.isConnected);
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

function createFakeClock() {
  let now = 0;
  let nextTimerId = 1;
  const timers = [];
  function runDueTimers() {
    timers.sort((a, b) => a.due - b.due);
    for (let index = 0; index < timers.length; index += 1) {
      const timer = timers[index];
      if (timer.cleared || timer.due > now) {
        continue;
      }
      timers.splice(index, 1);
      index -= 1;
      timer.callback();
      timers.sort((a, b) => a.due - b.due);
    }
  }
  return {
    now: () => now,
    setTimeout(callback, delay) {
      const id = nextTimerId;
      nextTimerId += 1;
      timers.push({
        id,
        due: now + Math.max(0, Number(delay) || 0),
        callback,
        cleared: false
      });
      return id;
    },
    clearTimeout(id) {
      timers.forEach((timer) => {
        if (timer.id === id) {
          timer.cleared = true;
        }
      });
    },
    advance(ms) {
      now += Math.max(0, Number(ms) || 0);
      runDueTimers();
    }
  };
}

function getMenuLevels(documentObj) {
  return documentObj.body.querySelectorAll('.x-nt-bookmark-cascade-level');
}

function getMenuItems(levelElement) {
  return levelElement ? levelElement.querySelectorAll('.x-nt-bookmark-cascade-item') : [];
}

function getActiveLabel(levelElement) {
  const active = levelElement && levelElement.querySelector('.x-nt-bookmark-cascade-item[data-active="true"]');
  return active ? active.textContent : '';
}

function setLevelLayout(levelElement, rect) {
  if (!levelElement) {
    return;
  }
  const levelRect = { left: 40, top: 70, width: 210, height: 140, ...(rect || {}) };
  levelElement.setRect(levelRect);
  getMenuItems(levelElement).forEach((item, index) => {
    item.setRect({
      left: levelRect.left,
      top: levelRect.top + 34 + (index * 32),
      width: levelRect.width,
      height: 32
    });
  });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

assert.strictEqual(
  typeof buildCascadeSafeTriangle,
  'function',
  'cascade positioning should expose a safe-triangle builder'
);
assert.strictEqual(
  typeof isPointInsideCascadeSafeTriangle,
  'function',
  'cascade positioning should expose safe-triangle hit testing'
);
assert.strictEqual(
  typeof createBookmarkCascadeMenuRuntime,
  'function',
  'bookmark cascade menu should expose a reusable runtime factory'
);

{
  const triangle = buildCascadeSafeTriangle({
    pointer: { x: 100, y: 120 },
    submenuRect: { left: 220, right: 420, top: 80, bottom: 220 },
    side: 'right'
  });

  assert.deepStrictEqual(
    triangle,
    [
      { x: 100, y: 120 },
      { x: 220, y: 80 },
      { x: 220, y: 220 }
    ],
    'right-opening submenus should use the submenu left edge as the safe-triangle base'
  );
  assert.ok(
    isPointInsideCascadeSafeTriangle({ x: 180, y: 128 }, triangle),
    'points inside the right-opening safe triangle should be protected'
  );
  assert.ok(
    !isPointInsideCascadeSafeTriangle({ x: 180, y: 40 }, triangle),
    'points outside the right-opening safe triangle should not be protected'
  );
}

{
  const triangle = buildCascadeSafeTriangle({
    pointer: { x: 500, y: 220 },
    submenuRect: { left: 120, right: 320, top: 160, bottom: 360 },
    side: 'left'
  });

  assert.deepStrictEqual(
    triangle,
    [
      { x: 500, y: 220 },
      { x: 320, y: 160 },
      { x: 320, y: 360 }
    ],
    'left-opening submenus should use the submenu right edge as the safe-triangle base'
  );
  assert.ok(
    isPointInsideCascadeSafeTriangle({ x: 410, y: 230 }, triangle),
    'points inside the left-opening safe triangle should be protected'
  );
  assert.ok(
    !isPointInsideCascadeSafeTriangle({ x: 410, y: 120 }, triangle),
    'points outside the left-opening safe triangle should not be protected'
  );
}

assertContains(
  cascadeMenuJs,
  'BOOKMARK_CASCADE_HOVER_DELAY_MS',
  'bookmark cascade menus should use a hover delay before pointer-triggered activation'
);
assertContains(
  cascadeMenuJs,
  'BOOKMARK_CASCADE_CLOSE_DELAY_MS',
  'bookmark cascade menus should use a delayed close after pointer exit'
);
assertContains(
  cascadeMenuJs,
  'BOOKMARK_CASCADE_SAFE_RECHECK_MS',
  'bookmark cascade menus should recheck safe-triangle protection before switching'
);
assertContains(
  cascadeMenuJs,
  'BOOKMARK_CASCADE_SAFE_MAX_MS',
  'bookmark cascade menus should keep safe-triangle protection independent from the first hover delay'
);
assert.ok(
  getJsConstNumber(cascadeMenuJs, 'BOOKMARK_CASCADE_SAFE_MAX_MS') >
    getJsConstNumber(cascadeMenuJs, 'BOOKMARK_CASCADE_HOVER_DELAY_MS'),
  'safe-triangle protection should be allowed to outlive the initial hover delay'
);
assertContains(
  cascadeMenuJs,
  'safeUntil: scheduledAt + BOOKMARK_CASCADE_SAFE_MAX_MS',
  'safe-triangle protection should use its own max window instead of expiring at hover-delay completion'
);
assertContains(
  newtabJs,
  'BOOKMARK_CASCADE_DEBUG_STORAGE_KEY',
  'newtab should keep the bookmark cascade debug storage key for future maintenance'
);
assertContains(
  newtabJs,
  'const BOOKMARK_CASCADE_DEBUG_UI_ENABLED = false;',
  'bookmark cascade debug UI should be hidden behind a single disabled maintenance flag'
);
assertContains(
  newtabJs,
  'BOOKMARK_CASCADE_DEBUG_UI_ENABLED && bookmarkCascadeRuntime',
  'newtab should only create or append the bookmark cascade debug control when the maintenance flag is enabled'
);
assertContains(
  newtabJs,
  'BOOKMARK_CASCADE_DEBUG_UI_ENABLED && changes[BOOKMARK_CASCADE_DEBUG_STORAGE_KEY]',
  'stored bookmark cascade debug mode should only be restored when the maintenance flag is enabled'
);
assert.ok(
  !newtabJs.includes('if (bookmarkCascadeRuntime) {\n    bookmarkCascadeRuntime.createDebugControls();\n  }'),
  'newtab should not unconditionally create the bookmark cascade debug control'
);
assert.ok(
  !newtabJs.includes('if (bookmarkCascadeRuntime && bookmarkCascadeRuntime.getDebugControl()) {\n    document.body.appendChild(bookmarkCascadeRuntime.getDebugControl());\n  }'),
  'newtab should not unconditionally append the bookmark cascade debug control'
);
assertContains(
  cascadeMenuJs,
  'createBookmarkCascadeDebugControls',
  'bookmark cascade runtime should keep the debug control implementation for future maintenance'
);
assertContains(
  cascadeMenuJs,
  'scheduleBookmarkCascadeHoverIntent',
  'pointer hover in bookmark cascade should be routed through delayed intent scheduling'
);
assertContains(
  cascadeMenuJs,
  "const shouldSuppressHover = getFunction(config, 'shouldSuppressHover'",
  'bookmark cascade should accept a shared hover suppression hook for drag reorder'
);
assertContains(
  cascadeMenuJs,
  'isBookmarkCascadeHoverSuppressed(task.triggerElement',
  'bookmark cascade hover intent should re-check suppression before opening a delayed target'
);
assertContains(
  cascadeMenuJs,
  'shouldProtectBookmarkCascadeLevel',
  'bookmark cascade switching should consult the safe triangle before replacing a submenu'
);
assertContains(
  cascadeMenuJs,
  'updateBookmarkCascadeDebugTriangle',
  'bookmark cascade debug mode should update the generated triangle in real time'
);
assertContains(
  cascadeMenuJs,
  'updateBookmarkCascadeDelayDebugLabel',
  'bookmark cascade debug mode should show live delay countdown labels'
);
assertContains(
  newtabJs,
  'NEWTAB_BOOKMARK_CASCADE_MENU.createBookmarkCascadeMenuRuntime',
  'newtab should delegate bookmark cascade behavior to the menu runtime'
);
assert.ok(
  !newtabJs.includes('function scheduleBookmarkCascadeHoverIntent'),
  'newtab should not own the cascade hover-intent state machine after componentization'
);
assert.ok(
  newtabHtml.indexOf('bookmark-cascade-position.js') >= 0 &&
    newtabHtml.indexOf('bookmark-cascade-menu.js') > newtabHtml.indexOf('bookmark-cascade-position.js') &&
    newtabHtml.indexOf('bookmark-cascade-menu.js') < newtabHtml.indexOf('react-page-bootstrap.js'),
  'newtab should load the cascade menu runtime after positioning helpers and before the page bootstrap'
);
assertContains(
  newtabHtml,
  '.x-nt-bookmark-cascade-safe-triangle',
  'newtab CSS should style the safe-triangle debug polygon'
);
assertContains(
  newtabHtml,
  '.x-nt-bookmark-cascade-debug-label',
  'newtab CSS should style the delay countdown debug label'
);
assertContains(
  newtabHtml,
  '.x-nt-bookmark-cascade-debug-button',
  'newtab CSS should style the bookmark cascade debug switch'
);
{
  const cascadeItemRule = getCssRuleBody(newtabHtml, '.x-nt-bookmark-cascade-item');
  assertContains(
    cascadeItemRule,
    'transition: color 120ms ease;',
    'bookmark cascade row text color transitions should remain available'
  );
  assert.ok(
    !/transition:\s*[^;]*background-color/.test(cascadeItemRule),
    'bookmark cascade row hover background should appear immediately without a background-color transition'
  );
}
assertContains(
  newtabHtml,
  '.x-nt-bookmark-cascade-item[data-hover-suppressed="true"]:hover',
  'newtab CSS should suppress competing row hover visuals while safe-triangle protection is active'
);
assert.ok(
  getCssZIndex(newtabHtml, '.x-nt-bookmark-cascade-debug-svg') >
    getCssZIndex(newtabHtml, '.x-nt-bookmark-cascade-level'),
  'safe-triangle debug SVG should render above menu panels so it is not hidden by cascade levels'
);
assertContains(
  newtabJs,
  "className: 'x-nt-bookmark-cursor-tooltip'",
  'newtab bookmark cursor tooltip should use a scoped class for layer control'
);
assertBookmarkCursorTooltipAboveCascade(newtabHtml, 'standard newtab');
{
  assert.ok(
    !newtabHtml.includes('.x-nt-bookmark-cascade-item:focus-visible {\n        outline: 2px solid'),
    'bookmark cascade keyboard focus should use the selected row background instead of an outline stroke'
  );
}

function createCascadeRuntimeFixture(overrides) {
  const configOverrides = overrides || {};
  const documentObj = createFakeDocument();
  const clock = createFakeClock();
  const openedLevels = [];
  const openedUrls = [];
  const tooltipBindings = [];
  const anchor = documentObj.createElement('button');
  anchor.setRect({ left: 20, top: 20, width: 120, height: 40 });
  documentObj.body.appendChild(anchor);

  const itemsByFolder = configOverrides.itemsByFolder || {
    root: [
      { id: 'research', title: 'Research', type: 'folder' },
      { id: 'archive', title: 'Archive', url: 'https://example.com/archive' }
    ],
    research: [
      { id: 'amazon', title: 'Amazon Menu Aim', url: 'https://example.com/amazon' }
    ]
  };

  const runtime = createBookmarkCascadeMenuRuntime({
    view: createFakeBookmarkCascadeView(),
    documentObj,
    windowObj: {
      innerWidth: 1024,
      innerHeight: 720,
      performance: { now: clock.now },
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      requestAnimationFrame: () => 0,
      cancelAnimationFrame() {},
      getComputedStyle: () => ({ transform: 'none' })
    },
    positionUtils: {
      placeRootCascadeMenu: () => ({ left: 40, top: 70, side: 'right', horizontal: 'left', vertical: 'below' }),
      placeCascadeSubmenu: () => ({ left: 252, top: 70, side: 'right', horizontal: 'right', vertical: 'below' }),
      getTranslateNeutralRect: (rect) => rect,
      buildCascadeSafeTriangle,
      isPointInsideCascadeSafeTriangle
    },
    menuSurface: {
      applyContentWidth() {},
      open(element) {
        openedLevels.push(element);
        element.setAttribute('data-open', 'true');
      }
    },
    t: (_key, fallback) => fallback || '',
    sanitizeDisplayText: (value) => String(value || ''),
    getHostFromUrl: () => '',
    getSiteDisplayName: (_host, title) => title || '',
    getUrlDisplay: (url) => url,
    getRiSvg: () => '',
    getFigmaFolderSvg: () => '',
    initFolderPathMorph() {},
    playFolderPathMorph() {},
    attachFaviconWithFallbacks() {},
    ensureReady: () => Promise.resolve(true),
    getItems: (folderId) => itemsByFolder[String(folderId || '')] || [],
    navigateToUrl: configOverrides.navigateToUrl || ((url) => {
      openedUrls.push({ url, via: 'navigate' });
    }),
    openUrl: configOverrides.openUrl || ((url, options) => {
      openedUrls.push({ url, background: Boolean(options && options.openInBackgroundTab) });
    }),
    bindCursorTooltip: configOverrides.bindCursorTooltip || ((target, getText, options) => {
      tooltipBindings.push({ target, getText, options });
      return target;
    }),
    hideCursorTooltip: configOverrides.hideCursorTooltip || (() => {}),
    shouldSuppressHover: configOverrides.shouldSuppressHover || (() => false)
  });

  return { anchor, clock, documentObj, openedLevels, openedUrls, runtime, tooltipBindings };
}

async function openCascadeWithSubmenu(overrides) {
  const fixture = createCascadeRuntimeFixture(overrides);
  fixture.runtime.open({ id: 'root', title: 'Root' }, fixture.anchor);
  await flushPromises();

  let levels = getMenuLevels(fixture.documentObj);
  setLevelLayout(levels[0], { left: 40, top: 70, width: 210, height: 140 });

  const rootItems = getMenuItems(levels[0]);
  rootItems[0].dispatchEvent(createFakeEvent('click', { target: rootItems[0] }));

  levels = getMenuLevels(fixture.documentObj);
  setLevelLayout(levels[0], { left: 40, top: 70, width: 210, height: 140 });
  setLevelLayout(levels[1], { left: 252, top: 104, width: 210, height: 120 });

  return fixture;
}

(async () => {
  {
    let suppressHover = false;
    const { anchor, clock, documentObj, runtime } = createCascadeRuntimeFixture({
      shouldSuppressHover: () => suppressHover
    });
    runtime.open({ id: 'root', title: 'Root' }, anchor);
    await flushPromises();
    let levels = getMenuLevels(documentObj);
    setLevelLayout(levels[0], { left: 40, top: 70, width: 210, height: 140 });
    let rootItems = getMenuItems(levels[0]);
    suppressHover = true;
    rootItems[0].dispatchEvent(createFakeEvent('pointerenter', {
      clientX: 80,
      clientY: 104,
      pointerType: 'mouse',
      target: rootItems[0]
    }));
    clock.advance(getJsConstNumber(cascadeMenuJs, 'BOOKMARK_CASCADE_HOVER_DELAY_MS'));

    levels = getMenuLevels(documentObj);
    rootItems = getMenuItems(levels[0]);
    assert.strictEqual(
      levels.length,
      1,
      'drag hover suppression should prevent folder rows from opening a delayed cascade submenu'
    );
    assert.strictEqual(
      rootItems[0].getAttribute('data-hover-suppressed'),
      'true',
      'drag hover suppression should suppress native hover styling on the crossed cascade row'
    );
  }

  {
    const { anchor, clock, documentObj, runtime } = createCascadeRuntimeFixture();
    runtime.open({ id: 'root', title: 'Root' }, anchor);
    await flushPromises();
    const levels = getMenuLevels(documentObj);
    setLevelLayout(levels[0], { left: 40, top: 70, width: 210, height: 140 });

    runtime.setDragMode(true);
    documentObj.dispatchEvent(createFakeEvent('pointermove', {
      clientX: 900,
      clientY: 650,
      target: documentObj.body
    }));
    clock.advance(getJsConstNumber(cascadeMenuJs, 'BOOKMARK_CASCADE_CLOSE_DELAY_MS') + 1);

    assert.strictEqual(
      runtime.isOpen(),
      true,
      'an active cascade drag should not close or detach the menu when crossing outside its current levels'
    );
  }


  {
    const { clock, documentObj } = await openCascadeWithSubmenu();
    let levels = getMenuLevels(documentObj);
    let rootItems = getMenuItems(levels[0]);
    documentObj.dispatchEvent(createFakeEvent('pointermove', {
      clientX: 120,
      clientY: 120,
      target: rootItems[0]
    }));
    rootItems[0].dispatchEvent(createFakeEvent('pointerleave', {
      clientX: 220,
      clientY: 138,
      pointerType: 'mouse',
      target: rootItems[0]
    }));
    rootItems[1].dispatchEvent(createFakeEvent('pointerenter', {
      clientX: 220,
      clientY: 138,
      pointerType: 'mouse',
      target: rootItems[1]
    }));

    clock.advance(getJsConstNumber(cascadeMenuJs, 'BOOKMARK_CASCADE_HOVER_DELAY_MS'));

    levels = getMenuLevels(documentObj);
    rootItems = getMenuItems(levels[0]);
    assert.strictEqual(
      levels.length,
      2,
      'diagonal pointer movement toward an open submenu should keep safe-triangle protection after the base hover delay'
    );
    assert.strictEqual(
      getActiveLabel(levels[0]),
      'Research',
      'safe-triangle protection should not switch the parent row while the pointer is moving toward the submenu'
    );
  }

  {
    const { clock, documentObj } = await openCascadeWithSubmenu();
    let levels = getMenuLevels(documentObj);
    let rootItems = getMenuItems(levels[0]);
    documentObj.dispatchEvent(createFakeEvent('pointermove', {
      clientX: 120,
      clientY: 120,
      target: rootItems[0]
    }));
    rootItems[0].dispatchEvent(createFakeEvent('pointerleave', {
      clientX: 170,
      clientY: 138,
      pointerType: 'mouse',
      target: rootItems[0]
    }));
    rootItems[1].dispatchEvent(createFakeEvent('pointerenter', {
      clientX: 170,
      clientY: 138,
      pointerType: 'mouse',
      target: rootItems[1]
    }));

    clock.advance(getJsConstNumber(cascadeMenuJs, 'BOOKMARK_CASCADE_HOVER_DELAY_MS'));

    levels = getMenuLevels(documentObj);
    rootItems = getMenuItems(levels[0]);
    assert.strictEqual(
      levels.length,
      2,
      'mid-lane diagonal movement toward an open submenu should stay protected before the pointer reaches the submenu edge'
    );
    assert.strictEqual(
      getActiveLabel(levels[0]),
      'Research',
      'mid-lane diagonal protection should keep the active parent folder while the pointer moves toward its submenu'
    );
    assert.strictEqual(
      rootItems[1].getAttribute('data-hover-suppressed'),
      'true',
      'safe-triangle protection should suppress the next row native hover visual while it keeps the current submenu active'
    );
  }

  {
    const { documentObj } = await openCascadeWithSubmenu();
    let levels = getMenuLevels(documentObj);
    let rootItems = getMenuItems(levels[0]);
    documentObj.dispatchEvent(createFakeEvent('pointermove', {
      clientX: 120,
      clientY: 120,
      target: rootItems[0]
    }));
    rootItems[0].dispatchEvent(createFakeEvent('pointerleave', {
      clientX: 170,
      clientY: 138,
      pointerType: 'mouse',
      target: rootItems[0]
    }));
    rootItems[1].dispatchEvent(createFakeEvent('pointerenter', {
      clientX: 170,
      clientY: 138,
      pointerType: 'mouse',
      target: rootItems[1]
    }));
    rootItems[1].dispatchEvent(createFakeEvent('pointerleave', {
      clientX: 252,
      clientY: 138,
      pointerType: 'mouse',
      target: rootItems[1]
    }));

    levels = getMenuLevels(documentObj);
    rootItems = getMenuItems(levels[0]);
    assert.strictEqual(
      rootItems[1].getAttribute('data-hover-suppressed'),
      '',
      'leaving a protected sibling row should clear its temporary hover suppression'
    );
  }

  {
    const { clock, documentObj } = await openCascadeWithSubmenu();
    let levels = getMenuLevels(documentObj);
    let rootItems = getMenuItems(levels[0]);
    documentObj.dispatchEvent(createFakeEvent('pointermove', {
      clientX: 120,
      clientY: 120,
      target: rootItems[0]
    }));
    rootItems[0].dispatchEvent(createFakeEvent('pointerleave', {
      clientX: 150,
      clientY: 138,
      pointerType: 'mouse',
      target: rootItems[0]
    }));

    levels = getMenuLevels(documentObj);
    rootItems = getMenuItems(levels[0]);
    assert.strictEqual(
      levels.length,
      1,
      'vertical pointer leave should clear the old submenu immediately when the pointer is not moving toward it'
    );
    assert.strictEqual(
      getActiveLabel(levels[0]),
      '',
      'vertical pointer leave should remove the old row highlight before waiting for the next hover intent'
    );

    rootItems[1].dispatchEvent(createFakeEvent('pointerenter', {
      clientX: 150,
      clientY: 138,
      pointerType: 'mouse',
      target: rootItems[1]
    }));

    clock.advance(getJsConstNumber(cascadeMenuJs, 'BOOKMARK_CASCADE_HOVER_DELAY_MS'));

    levels = getMenuLevels(documentObj);
    rootItems = getMenuItems(levels[0]);
    assert.strictEqual(
      levels.length,
      1,
      'vertical pointer movement between rows should switch after the base hover delay instead of waiting out safe-triangle protection'
    );
    assert.strictEqual(
      getActiveLabel(levels[0]),
      'Archive',
      'vertical sibling hover should activate the newly hovered row'
    );
  }

  {
    const { documentObj, openedLevels } = await openCascadeWithSubmenu();
    let levels = getMenuLevels(documentObj);
    let rootItems = getMenuItems(levels[0]);
    const openCountAfterFirstSubmenu = openedLevels.length;
    rootItems[0].setAttribute('data-active', 'false');
    rootItems[0].dispatchEvent(createFakeEvent('click', { target: rootItems[0] }));

    levels = getMenuLevels(documentObj);
    rootItems = getMenuItems(levels[0]);
    assert.strictEqual(
      openedLevels.length,
      openCountAfterFirstSubmenu,
      'clicking a folder whose submenu is already expanded should reuse the existing submenu instead of replaying its open animation'
    );
    assert.strictEqual(
      levels.length,
      2,
      'reusing an already expanded folder submenu should keep the child level mounted'
    );
    assert.strictEqual(
      getActiveLabel(levels[0]),
      'Research',
      'reusing an already expanded folder submenu should restore the parent folder active state'
    );
  }

  {
    const hiddenTooltips = [];
    const { documentObj, openedUrls, runtime, tooltipBindings } = await openCascadeWithSubmenu({
      hideCursorTooltip: () => {
        hiddenTooltips.push(true);
      }
    });
    const levels = getMenuLevels(documentObj);
    const submenuItems = getMenuItems(levels[1]);
    const nestedUrlItem = submenuItems[0];
    const tooltipBinding = tooltipBindings.find((entry) => entry.target === nestedUrlItem);

    assert.ok(
      tooltipBinding,
      'bookmark cascade URL items inside folders should bind a cursor-following tooltip'
    );
    assert.strictEqual(
      tooltipBinding.getText(nestedUrlItem),
      'Amazon Menu Aim',
      'bookmark cascade URL tooltip text should use the nested bookmark title'
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(tooltipBinding.options, 'getTagText'),
      false,
      'bookmark cascade URL cursor tooltip should not render an extra background-open badge'
    );

    nestedUrlItem.dispatchEvent(createFakeEvent('click', {
      metaKey: true,
      target: nestedUrlItem
    }));
    assert.strictEqual(
      runtime.isOpen(),
      true,
      'Command-clicking a bookmark URL should keep the cascade menu open'
    );
    nestedUrlItem.dispatchEvent(createFakeEvent('auxclick', {
      button: 1,
      target: nestedUrlItem
    }));
    assert.strictEqual(
      runtime.isOpen(),
      true,
      'middle-clicking a bookmark URL should keep the cascade menu open'
    );

    assert.deepStrictEqual(
      openedUrls,
      [
        { url: 'https://example.com/amazon', background: true },
        { url: 'https://example.com/amazon', background: true }
      ],
      'bookmark cascade URL items should support Command-click and middle-click background opening'
    );
    assert.ok(
      hiddenTooltips.length > 0,
      'bookmark cascade URL activation should hide the cursor-following tooltip'
    );

    documentObj.dispatchEvent(createFakeEvent('pointerdown', {
      target: documentObj.body
    }));
    assert.strictEqual(
      runtime.isOpen(),
      false,
      'clicking outside should close a cascade menu kept open after background opening'
    );
  }

  {
    const { documentObj, openedUrls, runtime } = await openCascadeWithSubmenu();
    const levels = getMenuLevels(documentObj);
    const nestedUrlItem = getMenuItems(levels[1])[0];

    nestedUrlItem.dispatchEvent(createFakeEvent('click', {
      target: nestedUrlItem
    }));

    assert.strictEqual(runtime.isOpen(), false, 'ordinary bookmark clicks should close the cascade menu');
    assert.deepStrictEqual(
      openedUrls,
      [{ url: 'https://example.com/amazon', background: false }],
      'ordinary bookmark clicks should keep their foreground navigation behavior'
    );
  }

  {
    const { documentObj, openedUrls, runtime } = await openCascadeWithSubmenu();
    const levels = getMenuLevels(documentObj);
    const nestedUrlItem = getMenuItems(levels[1])[0];

    nestedUrlItem.dispatchEvent(createFakeEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      target: nestedUrlItem
    }));

    assert.deepStrictEqual(
      openedUrls,
      [{ url: 'https://example.com/amazon', background: true }],
      'bookmark cascade URL keyboard activation inside folders should open in the background while Ctrl is held'
    );
    assert.strictEqual(
      runtime.isOpen(),
      true,
      'Ctrl+Enter on a bookmark URL should keep the cascade menu open'
    );
  }

  console.log('newtab bookmark cascade hover intent tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
