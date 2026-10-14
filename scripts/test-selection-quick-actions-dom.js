const assert = require('assert');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const selectionIntent = require('../src/shared/selection-intent.js');

// The runtime only schedules work through window.setTimeout and
// requestAnimationFrame, so the test drives a virtual clock instead of
// sleeping: wait(ms) runs every timer that falls due within ms, in order.
function installVirtualClock(window) {
  let now = 0;
  let nextId = 1;
  let order = 0;
  const timers = new Map();
  const schedule = (callback, delay, args) => {
    const id = nextId++;
    timers.set(id, { args, callback, due: now + Math.max(0, Number(delay) || 0), order: order++ });
    return id;
  };
  const cancel = (id) => {
    timers.delete(id);
  };
  window.setTimeout = (callback, delay, ...args) => schedule(callback, delay, args);
  window.clearTimeout = cancel;
  window.requestAnimationFrame = (callback) => schedule(() => callback(now), 16, []);
  window.cancelAnimationFrame = cancel;
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return async function advance(ms) {
    const target = now + Math.max(0, ms);
    await settle();
    for (;;) {
      let nextEntry = null;
      timers.forEach((timer, id) => {
        if (timer.due > target) return;
        if (!nextEntry || timer.due < nextEntry[1].due ||
            (timer.due === nextEntry[1].due && timer.order < nextEntry[1].order)) {
          nextEntry = [id, timer];
        }
      });
      if (!nextEntry) break;
      const [id, timer] = nextEntry;
      timers.delete(id);
      now = timer.due;
      try {
        if (typeof timer.callback === 'function') {
          timer.callback(...timer.args);
        } else {
          window.eval(String(timer.callback));
        }
      } catch (error) {
        console.error('Uncaught error in timer callback:', error);
      }
      await settle();
    }
    now = target;
    await settle();
  };
}

let wait = null;

(async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><body>
    <style>
      #_x_extension_selection_quick_actions_host_2026_unique_ {
        all: unset !important;
        display: none !important;
        position: static !important;
        z-index: -1 !important;
        margin: 120px !important;
        padding: 120px !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        transform: scale(0.1) !important;
        filter: blur(20px) !important;
      }
    </style>
    <p id="copy">serendipity</p>
    <p id="question">How should I structure this rollout?</p>
    <p id="article-paragraph">今年初，一款名为 Bookology 的读书管理应用进入我的视野，它集合了我需要的原本分散在各个读书应用中的功能。总结来说，Bookology 将书籍管理、阅读进度、阅读笔记和数据统计整合在一个简洁的数字书架中，在这一个 App 中就可以建立专属于我自己的阅读档案。</p>
    <p><span id="generic-context"><em id="generic">React</em> trailing text</span></p>
    <p id="cjk">这是你需要的资料</p>
    <div id="dark-context" style="background-color: rgb(20, 24, 32);"><span id="dark-copy">serendipity</span></div>
    <button id="selectable-button" type="button">Why is this unavailable?</button>
    <a id="selectable-link" href="#selected-link">React components</a>
    <span id="selectable-role-button" role="button" tabindex="0">React components</span>
    <span id="selectable-custom" tabindex="0">React components</span>
    <div id="selectable-editable" contenteditable="true">React components</div>
    <input id="selectable-input" type="text" value="React components">
    <textarea id="selectable-textarea">Why is this unavailable?</textarea>
    <input id="sensitive-password" type="password" value="secret token">
    <input id="sensitive-payment" type="text" autocomplete="cc-number" value="4111111111111111">
    <article id="x-post"><div><span id="x-body">为什么这条来自 X 的帖子无法加载？</span> <a href="https://t.co/example">https://t.co/example</a></div></article>
  </body></html>`, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    url: 'https://example.com/article'
  });
  const { window } = dom;
  wait = installVirtualClock(window);
  window.LumnoSelectionIntent = selectionIntent;
  window.Range.prototype.getBoundingClientRect = function() {
    const node = this.commonAncestorContainer;
    const element = node.nodeType === window.Node.ELEMENT_NODE ? node : node.parentElement;
    if (element && element.id === 'copy') {
      return { bottom: 88, height: 62, left: 20, right: 900, top: 26, width: 880 };
    }
    return { bottom: 44, height: 18, left: 20, right: 110, top: 26, width: 90 };
  };
  window.Range.prototype.getClientRects = function() {
    const node = this.commonAncestorContainer;
    const element = node.nodeType === window.Node.ELEMENT_NODE ? node : node.parentElement;
    if (element && element.id === 'generic') {
      return [{ bottom: 88, height: 18, left: 20, right: 70, top: 70, width: 50 }];
    }
    if (element && element.id === 'copy') {
      return [
        { bottom: 44, height: 18, left: 20, right: 900, top: 26, width: 880 },
        { bottom: 88, height: 18, left: 20, right: 110, top: 70, width: 90 }
      ];
    }
    return [];
  };
  window.HTMLElement.prototype.getBoundingClientRect = function() {
    return { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 };
  };
  let reduceMotion = false;
  const toolbarAnimations = [];
  let surfaceResizeObserverCallback = null;
  let surfaceResizeObserverTarget = null;
  window.ResizeObserver = class {
    constructor(callback) {
      surfaceResizeObserverCallback = callback;
    }
    observe(target) {
      surfaceResizeObserverTarget = target;
    }
    disconnect() {}
  };
  window.matchMedia = (query) => ({
    matches: reduceMotion && query === '(prefers-reduced-motion: reduce)',
    media: query
  });
  window.Element.prototype.animate = function(keyframes, options) {
    const record = {
      cancelled: false,
      keyframes,
      options,
      target: this
    };
    toolbarAnimations.push(record);
    return {
      cancel() {
        record.cancelled = true;
      }
    };
  };
  const selectionHostId = '_x_extension_selection_quick_actions_host_2026_unique_';
  const selectionToastHostId = '_x_extension_selection_quick_actions_toast_host_2026_unique_';
  let selectionShadow = null;
  let selectionToastShadow = null;
  const storageChangeListeners = [];
  const localStorageValues = {
    _x_extension_selection_quick_actions_trigger_style_2026_unique_: 'lumno'
  };
  const syncStorageValues = {
    _x_extension_selection_quick_actions_enabled_2026_unique_: true,
    _x_extension_selection_quick_actions_icon_set_2026_unique_: 'hugeicons',
    _x_extension_selection_quick_actions_trigger_style_2026_unique_: 'butterfly'
  };
  const attachShadow = window.Element.prototype.attachShadow;
  window.Element.prototype.attachShadow = function(options) {
    const root = attachShadow.call(this, options);
    if (this.id === selectionHostId) {
      selectionShadow = root;
    } else if (this.id === selectionToastHostId) {
      selectionToastShadow = root;
    }
    return root;
  };
  const runtimeMessages = [];
  const pendingSelectionActionCallbacks = [];
  let deferSelectionActionResponses = false;
  let nextSelectionActionResponse;
  window.chrome = {
    i18n: {
      getMessage() { return ''; },
      getUILanguage() { return 'zh-CN'; }
    },
    runtime: {
      id: 'kkcjcneagmlhpeaafngjdlpcfjakejgb',
      getURL(path) { return `chrome-extension://lumno/${path}`; },
      lastError: null,
      sendMessage(message, callback) {
        runtimeMessages.push(message);
        if (message && message.action === 'runSelectionQuickAction' && deferSelectionActionResponses) {
          pendingSelectionActionCallbacks.push(callback);
          return;
        }
        if (message && message.action === 'runSelectionQuickAction' && nextSelectionActionResponse !== undefined) {
          const response = nextSelectionActionResponse;
          nextSelectionActionResponse = undefined;
          if (callback) callback(response);
          return;
        }
        if (callback) callback({ ok: true });
      }
    },
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(localStorageValues, key)) {
              result[key] = localStorageValues[key];
            }
          });
          callback(result);
        },
        set(payload, callback) {
          Object.assign(localStorageValues, payload);
          if (callback) callback();
        }
      },
      onChanged: {
        addListener(listener) { storageChangeListeners.push(listener); }
      },
      sync: {
        get(_keys, callback) {
          callback({ ...syncStorageValues });
        }
      }
    }
  };

  const paragraph = window.document.getElementById('copy');
  const question = window.document.getElementById('question');
  const articleParagraph = window.document.getElementById('article-paragraph');
  const generic = window.document.getElementById('generic');
  const cjk = window.document.getElementById('cjk');
  const darkCopy = window.document.getElementById('dark-copy');
  const selectableButton = window.document.getElementById('selectable-button');
  const selectableLink = window.document.getElementById('selectable-link');
  const selectableRoleButton = window.document.getElementById('selectable-role-button');
  const selectableCustom = window.document.getElementById('selectable-custom');
  const selectableEditable = window.document.getElementById('selectable-editable');
  const selectableInput = window.document.getElementById('selectable-input');
  const selectableTextarea = window.document.getElementById('selectable-textarea');
  const sensitivePassword = window.document.getElementById('sensitive-password');
  const sensitivePayment = window.document.getElementById('sensitive-payment');
  const xPost = window.document.getElementById('x-post');
  const selection = window.getSelection();
  const inputValueDescriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  let sensitivePaymentValueReads = 0;
  Object.defineProperty(sensitivePayment, 'value', {
    configurable: true,
    get() {
      sensitivePaymentValueReads += 1;
      return inputValueDescriptor.get.call(this);
    },
    set(value) {
      inputValueDescriptor.set.call(this, value);
    }
  });
  let selectableButtonClicks = 0;
  selectableButton.addEventListener('click', () => {
    selectableButtonClicks += 1;
    selection.removeAllRanges();
  });
  selectableCustom.addEventListener('click', () => {});
  [selectableInput, selectableTextarea, sensitivePassword, sensitivePayment].forEach((element, index) => {
    element.getBoundingClientRect = () => ({
      bottom: 188 + index * 28,
      height: 24,
      left: 20,
      right: 240,
      top: 164 + index * 28,
      width: 220
    });
  });
  window.eval(fs.readFileSync('src/shared/settings.js', 'utf8'));
  window.eval(fs.readFileSync('src/shared/selection-action-icons.js', 'utf8'));
  window.eval(fs.readFileSync('src/shared/toast.js', 'utf8'));
  assert.strictEqual(
    window.LumnoSelectionButterfly,
    undefined,
    'the DOM regression should cover a missing shared butterfly module'
  );
  window.eval(fs.readFileSync('src/content/selection-quick-actions.js', 'utf8'));
  await wait(0);

  const legacyHost = window.document.createElement('div');
  legacyHost.id = '_x_extension_selection_quick_actions_host_2026_unique_';
  legacyHost.dataset.selectionMark = 'lumno';
  window.document.documentElement.appendChild(legacyHost);
  await wait(0);
  assert.strictEqual(
    legacyHost.isConnected,
    false,
    'the current runtime should remove a legacy selection host injected by another Lumno installation'
  );

  paragraph.dispatchEvent(new window.MouseEvent('pointerdown', {
    bubbles: true,
    button: 0,
    clientX: 20,
    clientY: 40
  }));
  const range = window.document.createRange();
  range.selectNodeContents(paragraph);
  selection.removeAllRanges();
  selection.addRange(range);

  paragraph.dispatchEvent(new window.MouseEvent('pointerup', {
    bubbles: true,
    button: 0,
    clientX: 100,
    clientY: 40
  }));

  await wait(460);
  const host = window.document.getElementById('_x_extension_selection_quick_actions_host_2026_unique_');
  assert(host, 'high-confidence selection should create the quick action host');
  assert.strictEqual(host.hidden, false);
  assert.strictEqual(host.dataset.visible, 'true');
  for (const [attribute, expected] of [
    ['translate', 'no'],
    ['lang', 'zxx'],
    ['notranslate', ''],
    ['data-no-translate', 'true']
  ]) {
    assert.strictEqual(host.getAttribute(attribute), expected,
      `the selection host should expose Overlay's ${attribute} translation guard`);
  }
  assert.strictEqual(host.classList.contains('notranslate'), true,
    'the selection host should expose the common notranslate class used by translation extensions');
  assert.strictEqual(host.dataset.iconSet, 'remix', 'obsolete icon-set storage should not change the toolbar renderer');
  assert.strictEqual(host.dataset.selectionMark, 'lumno', 'the entry should always use the fixed Lumno mark');
  assert.strictEqual(host.dataset.runtimeRevision, 'selection-toolbar-v32');
  assert.strictEqual(host.dataset.entryContrast, 'light',
    'an entry on the default light page should use the restrained light-surface contrast treatment');
  assert.strictEqual(host.style.colorScheme, 'light',
    'the expanded material should remain light on a locally light page surface');
  assert.strictEqual(host.dataset.runtimeId, 'kkcjcneagmlhpeaafngjdlpcfjakejgb');
  const computedHostStyle = window.getComputedStyle(host);
  assert.strictEqual(computedHostStyle.display, 'block',
    'hostile page CSS should not hide the owned selection host');
  assert.strictEqual(computedHostStyle.position, 'fixed',
    'hostile page CSS should not move the selection host back into page layout');
  assert.strictEqual(computedHostStyle.zIndex, '2147483647',
    'hostile page CSS should not lower the selection host below page overlays');
  assert.strictEqual(computedHostStyle.opacity, '1',
    'hostile page CSS should not fade the selection host');
  assert.strictEqual(computedHostStyle.visibility, 'visible',
    'hostile page CSS should not make the selection host invisible');
  assert.strictEqual(computedHostStyle.pointerEvents, 'auto',
    'hostile page CSS should not disable selection toolbar interaction');
  assert.strictEqual(computedHostStyle.transform, 'none',
    'hostile page CSS should not scale or offset the selection host');
  assert.strictEqual(computedHostStyle.filter, 'none',
    'hostile page CSS should not blur the selection host');
  assert.strictEqual(host.style.getPropertyValue('all'), 'initial',
    'the host should reset the full page style surface before applying protected geometry');
  assert.strictEqual(host.dataset.triggerStyle, undefined);
  assert.strictEqual(host.dataset.triggerStyleSource, undefined);
  assert.strictEqual(
    localStorageValues._x_extension_selection_quick_actions_trigger_style_2026_unique_,
    'lumno',
    'hydration should ignore an obsolete local entry-style mirror'
  );
  storageChangeListeners.forEach((listener) => listener({
    _x_extension_language_2024_unique_: {
      oldValue: 'system',
      newValue: 'zh-CN'
    }
  }, 'sync'));
  await wait(0);
  assert.strictEqual(
    host.dataset.selectionMark,
    'lumno',
    'rehydration should keep the fixed Lumno mark'
  );
  storageChangeListeners.forEach((listener) => listener({
    _x_extension_selection_quick_actions_trigger_style_2026_unique_: {
      oldValue: 'lumno',
      newValue: 'butterfly'
    }
  }, 'sync'));
  assert.strictEqual(
    window.document.querySelectorAll('[id="_x_extension_selection_quick_actions_host_2026_unique_"]').length,
    1,
    'only one Lumno selection surface should remain when multiple extension builds inject the same page'
  );
  assert(selectionShadow, 'the selection surface should create a shadow root');
  const highLogo = selectionShadow.querySelector('.lumno-selection-logo');
  const highButterfly = selectionShadow.querySelector('.lumno-selection-butterfly-stage');
  assert(highLogo, 'the selection surface should contain the Lumno mark');
  assert.strictEqual(highLogo.hidden, false, 'the fixed Lumno mark should remain visible');
  assert(highLogo.src.endsWith('/assets/images/lumno-selection-mark.svg'),
    'every triggerable selection should use the vector butterfly mark');
  assert.strictEqual(highButterfly, null, 'the removed butterfly visual should not remain in the shadow DOM');
  assert.strictEqual(selectionShadow.querySelector('.lumno-selection-more'), null,
    'the compact entry should open the toolbar directly without a second disclosure button');
  const highEntry = selectionShadow.querySelector('.lumno-selection-main');
  const highSurface = selectionShadow.querySelector('.lumno-selection-surface');
  const toolbarMaterial = selectionShadow.querySelector('.lumno-selection-material');
  const toolbarContent = selectionShadow.querySelector('.lumno-selection-content');
  const primaryDivider = selectionShadow.querySelector('.lumno-selection-primary-divider');
  const actionsViewport = selectionShadow.querySelector('.lumno-selection-actions-viewport');
  assert(toolbarMaterial, 'the toolbar should own an independently growing material layer');
  assert(toolbarContent, 'all right-aligned toolbar contents should share one clipping layer');
  assert(primaryDivider, 'the trailing butterfly region should own a dedicated divider');
  assert(actionsViewport, 'the moving actions should live in a dedicated clipping viewport');
  highSurface.getBoundingClientRect = function() {
    const iconOnly = this.dataset.iconOnly === 'true';
    return {
      bottom: iconOnly ? 84 : 104,
      height: iconOnly ? 18 : 38,
      left: 300,
      right: iconOnly ? 318 : 540,
      top: 66,
      width: iconOnly ? 18 : 240
    };
  };
  highEntry.getBoundingClientRect = function() {
    const iconOnly = this.dataset.iconOnly === 'true';
    return {
      bottom: iconOnly ? 84 : 100,
      height: iconOnly ? 18 : 30,
      left: iconOnly ? 300 : 506,
      right: iconOnly ? 318 : 536,
      top: iconOnly ? 66 : 70,
      width: iconOnly ? 18 : 30
    };
  };
  assert.strictEqual(highEntry.getAttribute('aria-controls'), 'lumno-selection-toolbar');
  assert.strictEqual(highEntry.hasAttribute('aria-haspopup'), false,
    'the entry should not claim menu semantics for a toolbar');
  assert.strictEqual(highEntry.dataset.iconOnly, 'true',
    'high-confidence intent should not replace the compact butterfly with a direct-action chip');
  assert.strictEqual(highSurface.dataset.iconOnly, 'true');
  highEntry.click();
  await wait(30);
  const toolbar = selectionShadow.querySelector('.lumno-selection-toolbar');
  assert(toolbar, 'clicking the butterfly should open a toolbar');
  assert.strictEqual(primaryDivider.hidden, false, 'the primary divider should join the shared reveal');
  assert.strictEqual(actionsViewport.hidden, false, 'the actions viewport should open inside the shared clipping layer');
  assert.strictEqual(toolbar.parentElement, actionsViewport,
    'only the red-box actions should be children of the clipping viewport');
  assert.strictEqual(host.style.left, '300px',
    'the expanded toolbar should start at the original entry point and occupy the space on its right');
  assert.strictEqual(host.style.right, 'auto',
    'the expanded toolbar should grow rightward from an explicit left anchor');
  assert.strictEqual(host.style.top, '56px',
    'the expanded toolbar should remain vertically centered around the compact entry anchor');
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 180 });
  host.style.setProperty('left', '-200px', 'important');
  host.style.setProperty('right', 'auto', 'important');
  host.style.setProperty('top', '160px', 'important');
  window.dispatchEvent(new window.Event('resize'));
  await wait(30);
  assert.strictEqual(highSurface.style.maxWidth, '376px',
    'the toolbar shell should never grow wider than the viewport safe area');
  assert.strictEqual(surfaceResizeObserverTarget, highSurface,
    'toolbar size changes should keep edge clamping active after fonts or labels settle');
  assert.strictEqual(typeof surfaceResizeObserverCallback, 'function');
  assert.strictEqual(host.style.left, '12px',
    'viewport clamping should preserve the toolbar left anchor with a 12px safe margin');
  assert.strictEqual(host.style.right, 'auto');
  assert.strictEqual(host.style.top, '130px',
    'an expanded toolbar should retain a 12px safe margin from the bottom viewport edge');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
  assert.strictEqual(toolbar.getAttribute('role'), 'toolbar');
  const translatedToolbarActions = Array.from(toolbar.querySelectorAll('[data-intent]'));
  assert.deepStrictEqual(
    translatedToolbarActions.map((button) => button.dataset.intent),
    ['translate', 'explain', 'search'],
    'the inferred intent should be first and the toolbar should render exactly three actions'
  );
  assert.strictEqual(toolbar.getAttribute('tabindex'), '-1',
    'the toolbar should be programmatically focusable without joining the page tab order');
  assert.strictEqual(selectionShadow.activeElement, toolbar,
    'opening the toolbar should focus its container without pre-highlighting the inferred first action');
  assert.notStrictEqual(selectionShadow.activeElement, translatedToolbarActions[0],
    'the first action should remain visually neutral until the user navigates to it');
  assert.strictEqual(highEntry.hidden, false,
    'the same butterfly button should remain visible at the right edge after the toolbar opens');
  assert.strictEqual(highEntry.dataset.iconOnly, 'false',
    'the shared butterfly should enlarge from compact-entry mode into its toolbar slot');
  assert.strictEqual(toolbarMaterial.nextElementSibling, toolbarContent,
    'the independently growing material should be followed by one shared content viewport');
  assert.strictEqual(actionsViewport.parentElement, toolbarContent,
    'the actions should participate in the same right-aligned reveal as the trailing controls');
  assert.strictEqual(actionsViewport.nextElementSibling, primaryDivider,
    'the divider should remain immediately to the left of the butterfly inside the shared reveal');
  assert.strictEqual(primaryDivider.nextElementSibling, highEntry,
    'the butterfly should occupy the rightmost toolbar position');
  assert.strictEqual(toolbarContent.lastElementChild, highEntry,
    'the butterfly should be the shared content layer trailing edge, not a separately fixed control');
  const toolbarTranslationGuardNodes = [highSurface, ...highSurface.querySelectorAll('*')];
  toolbarTranslationGuardNodes.forEach((element) => {
    assert.strictEqual(element.getAttribute('translate'), 'no',
      'every initial and dynamically rendered toolbar node should opt out of translation');
    assert.strictEqual(element.getAttribute('lang'), 'zxx',
      'every initial and dynamically rendered toolbar node should declare non-linguistic content');
    assert.strictEqual(element.hasAttribute('notranslate'), true,
      'every initial and dynamically rendered toolbar node should expose the notranslate marker');
    assert.strictEqual(element.getAttribute('data-no-translate'), 'true',
      'every initial and dynamically rendered toolbar node should expose Lumno no-translate metadata');
    assert.strictEqual(element.classList.contains('notranslate'), true,
      'every initial and dynamically rendered toolbar node should use the common notranslate class');
  });
  assert(translatedToolbarActions.every((button) => button.querySelector('.lumno-selection-action-icon > path')),
    'toolbar actions should use the filled Remix SVG definitions');
  const materialGrowth = toolbarAnimations.find((record) => record.target === toolbarMaterial);
  const contentGrowth = toolbarAnimations.find((record) => record.target === toolbarContent);
  const actionsReveal = toolbarAnimations.find((record) => record.target === actionsViewport);
  const surfaceGrowth = toolbarAnimations.find((record) => record.target === highSurface);
  const sharedButterflyGrowth = toolbarAnimations.find((record) => record.target === highEntry);
  const toolbarContentGrowth = toolbarAnimations.find((record) => record.target === toolbar);
  assert.strictEqual(surfaceGrowth, undefined,
    'the final layout shell should keep its geometry while only material and actions reveal left to right');
  assert(materialGrowth, 'the material should grow independently from the final left edge');
  assert.strictEqual(materialGrowth.options.duration, 240);
  assert.strictEqual(materialGrowth.options.easing, 'cubic-bezier(0.22, 1, 0.36, 1)');
  assert.deepStrictEqual(Array.from(materialGrowth.keyframes, (keyframe) => keyframe.width), ['0px', '240px'],
    'the material should grow from the original point toward the moving right-aligned contents');
  assert.strictEqual(sharedButterflyGrowth, undefined,
    'the butterfly should move with the shared right-aligned content instead of owning a separate animation');
  assert.strictEqual(toolbarAnimations.some((record) => record.target === primaryDivider), false,
    'the divider should move with the shared content instead of owning a separate animation');
  assert(contentGrowth, 'one right-aligned content viewport should own the toolbar width reveal');
  assert.deepStrictEqual(
    Array.from(contentGrowth.keyframes, (keyframe) => keyframe.width),
    ['0px', '232px'],
    'the shared content viewport should grow from the original point toward the right'
  );
  assert.strictEqual(contentGrowth.options.duration, 260);
  assert.strictEqual(contentGrowth.options.delay, 20);
  assert.strictEqual(actionsReveal, undefined,
    'the left-side actions should be revealed by the shared viewport rather than a second mask');
  assert(toolbarContentGrowth, 'toolbar contents should move as one left-to-right revealing layer');
  assert.strictEqual(toolbarContentGrowth.options.duration, 280);
  assert.strictEqual(toolbarContentGrowth.options.delay, 30);
  assert.match(toolbarContentGrowth.keyframes[0].transform, /translateX\(-\d+(?:\.\d+)?px\)/);
  assert.strictEqual(toolbarContentGrowth.keyframes[1].transform, 'translateX(0px)');
  assert.strictEqual(
    toolbarAnimations.filter((record) => (
      record.target.classList && record.target.classList.contains('lumno-selection-action-label')
    )).length,
    0,
    'individual labels should not float in independently of the toolbar content layer'
  );
  await wait(430);
  assert.strictEqual(materialGrowth.cancelled, false,
    'finishing the entrance should preserve its exact final width instead of cancelling back to intrinsic layout');
  assert.strictEqual(contentGrowth.cancelled, false,
    'the shared clipping viewport should retain its measured final width after the reveal finishes');
  assert.strictEqual(toolbarContentGrowth.cancelled, false,
    'the right-aligned contents should keep the completed animation state until the toolbar closes');
  highEntry.click();
  assert(runtimeMessages.some((message) => message.action === 'openOptionsPage' && message.hash === 'labs'),
    'clicking the enlarged trailing butterfly should open the Labs settings route');
  assert.strictEqual(materialGrowth.cancelled, true,
    'dismissing the selection surface should cancel an in-flight toolbar animation');
  delete highSurface.getBoundingClientRect;

  async function selectDomText(element, options = {}) {
    window.document.dispatchEvent(new window.Event('copy', { bubbles: true }));
    selection.removeAllRanges();
    element.dispatchEvent(new window.MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 20,
      clientY: 150
    }));
    const elementRange = window.document.createRange();
    elementRange.selectNodeContents(element);
    selection.addRange(elementRange);
    element.dispatchEvent(new window.MouseEvent('pointerup', {
      bubbles: true,
      button: 0,
      clientX: 150,
      clientY: 150
    }));
    if (options.clickAfterPointerUp) {
      element.click();
    }
    await wait(460);
  }

  async function selectTextControl(element, start, end, beforePointerUp) {
    window.document.dispatchEvent(new window.Event('copy', { bubbles: true }));
    selection.removeAllRanges();
    element.focus();
    element.setSelectionRange(0, 0);
    element.dispatchEvent(new window.MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 36,
      clientY: 176
    }));
    element.setSelectionRange(start, end);
    if (beforePointerUp) {
      beforePointerUp();
    }
    element.dispatchEvent(new window.MouseEvent('pointerup', {
      bubbles: true,
      button: 0,
      clientX: 164,
      clientY: 176
    }));
    await wait(460);
  }

  await selectDomText(articleParagraph);
  assert.strictEqual(host.hidden, false,
    'a substantial article paragraph should expose the entry without relying on line count');
  selectionShadow.querySelector('.lumno-selection-main').click();
  assert.strictEqual(
    selectionShadow.querySelector('.lumno-selection-toolbar [data-intent]').dataset.intent,
    'summarize',
    'a substantial article paragraph should put Summarize first'
  );

  await selectDomText(selectableButton, { clickAfterPointerUp: true });
  assert.strictEqual(selectableButtonClicks, 1, 'Lumno should not block the selected button click');
  assert.strictEqual(host.hidden, false,
    'a pointer-up snapshot should survive a button click that immediately collapses the live selection');
  selectionShadow.querySelector('.lumno-selection-main').click();
  assert.strictEqual(
    selectionShadow.querySelector('.lumno-selection-toolbar [data-intent]').dataset.intent,
    'ask',
    'the captured button question should retain its inferred action after the page clears the selection'
  );

  for (const [element, description] of [
    [selectableLink, 'link'],
    [selectableRoleButton, 'role button'],
    [selectableCustom, 'custom clickable node'],
    [selectableEditable, 'contenteditable region']
  ]) {
    await selectDomText(element);
    assert.strictEqual(host.hidden, false, `selected text inside a ${description} should reach intent evaluation`);
  }

  await selectDomText(selectableLink);
  selectionShadow.querySelector('.lumno-selection-main').click();
  const actionMessageCount = runtimeMessages.length;
  const actionToolbar = selectionShadow.querySelector('.lumno-selection-toolbar');
  actionToolbar.dispatchEvent(new window.FocusEvent('blur', {
    bubbles: false,
    composed: true
  }));
  assert.strictEqual(host.hidden, false,
    'a descendant blur inside the toolbar must not be mistaken for the browser window losing focus');
  const firstAction = selectionShadow.querySelector('.lumno-selection-toolbar [data-intent]');
  const selectedAction = firstAction.dataset.intent;
  const sendingMaterialGrowth = toolbarAnimations.filter((record) => record.target === toolbarMaterial).at(-1);
  deferSelectionActionResponses = true;
  firstAction.click();
  deferSelectionActionResponses = false;
  assert.strictEqual(runtimeMessages.length, actionMessageCount + 1,
    'clicking a toolbar action should send exactly one background request');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(runtimeMessages.at(-1))), {
    action: 'runSelectionQuickAction',
    intent: selectedAction,
    locale: 'zh-CN',
    text: 'React components'
  }, 'the background request should preserve the inferred intent and captured selection');
  assert.strictEqual(host.hidden, true,
    'a clicked action should close the selection toolbar while work continues in the background');
  assert(selectionToastShadow, 'a clicked action should mount the shared Toast component');
  const selectionToast = selectionToastShadow.querySelector('.x-lumno-toast');
  assert(selectionToast, 'the action status should render through the shared Toast surface');
  assert.strictEqual(selectionToast.dataset.show, 'true',
    'a clicked action should immediately show the shared Toast');
  assert.strictEqual(selectionToast.textContent, '正在后台打开…',
    'the shared Toast should retain the localized opening-in-background message');
  assert.strictEqual(sendingMaterialGrowth.cancelled, true,
    'switching from toolbar controls to the sending status should release the retained entrance width');
  assert.strictEqual(pendingSelectionActionCallbacks.length, 1,
    'the regression harness should retain the first action response');
  window.document.dispatchEvent(new window.Event('copy', { bubbles: true }));

  await selectTextControl(selectableInput, 0, selectableInput.value.length);
  assert.strictEqual(host.hidden, false, 'ordinary input selections should reach intent evaluation');
  await wait(700);
  assert.strictEqual(host.hidden, false,
    'a stale action hide timer must not dismiss a newer selection candidate');
  pendingSelectionActionCallbacks.shift()({ ok: false });
  await wait(0);
  assert.strictEqual(host.hidden, false,
    'a stale failed action response must not hide a newer selection candidate');
  assert.strictEqual(selectionToast.dataset.show, 'false',
    'a stale failed action response must not replace a newer candidate with an error Toast');
  assert.notStrictEqual(selectionToast.textContent, '发送失败，请重试。',
    'a stale failed action response must not overwrite the shared Toast copy');
  selectionShadow.querySelector('.lumno-selection-main').click();
  assert.strictEqual(
    selectionShadow.querySelector('.lumno-selection-toolbar [data-intent]').dataset.intent,
    'translate',
    'a new input selection should replace the stale captured button candidate'
  );
  nextSelectionActionResponse = { ok: false };
  selectionShadow.querySelector('.lumno-selection-toolbar [data-intent]').click();
  assert.strictEqual(host.hidden, true,
    'an immediate action failure should keep the selection toolbar closed');
  assert.strictEqual(selectionToast.dataset.show, 'true',
    'an immediate action failure should show the shared Toast error state');
  assert.strictEqual(selectionToast.textContent, '发送失败，请重试。',
    'an immediate action failure should localize its shared Toast copy');
  assert.strictEqual(selectionToast.dataset.tone, 'error',
    'the shared Toast should use its error treatment for failed actions');
  await wait(1100);
  assert.strictEqual(host.hidden, true,
    'an immediate action failure should not reopen the selection toolbar');
  assert.strictEqual(selectionToast.dataset.show, 'true',
    'the failure Toast should remain visible for its dedicated dismissal interval');

  await selectTextControl(selectableTextarea, 0, selectableTextarea.value.length);
  assert.strictEqual(host.hidden, false, 'textarea selections should reach intent evaluation');
  selectionShadow.querySelector('.lumno-selection-main').click();
  const repeatedAction = selectionShadow.querySelector('.lumno-selection-toolbar [data-intent]');
  deferSelectionActionResponses = true;
  repeatedAction.click();
  await wait(100);
  repeatedAction.click();
  deferSelectionActionResponses = false;
  assert.strictEqual(pendingSelectionActionCallbacks.length, 2,
    'the regression harness should retain both overlapping action responses');
  const [olderActionResponse, latestActionResponse] = pendingSelectionActionCallbacks.splice(0, 2);
  await wait(850);
  latestActionResponse({ ok: false });
  await wait(250);
  assert.strictEqual(host.hidden, true,
    'an older action timer must not reopen the toolbar owned by the latest action');
  assert.strictEqual(selectionToast.dataset.show, 'true',
    'the latest overlapping action failure should retain its dedicated Toast interval');
  assert.strictEqual(selectionToast.textContent, '发送失败，请重试。',
    'the latest overlapping action failure should own the shared Toast copy');
  olderActionResponse({ ok: false });
  selectableLink.focus();
  await selectDomText(selectableLink);
  highSurface.getBoundingClientRect = function() {
    const iconOnly = this.dataset.iconOnly === 'true';
    return {
      bottom: iconOnly ? 84 : 104,
      height: iconOnly ? 18 : 38,
      left: iconOnly ? 300 : 78,
      right: 318,
      top: 66,
      width: iconOnly ? 18 : 240
    };
  };
  window.eval('delete Element.prototype.animate');
  assert.strictEqual(typeof highSurface.animate, 'undefined');
  const nativeFocus = window.HTMLElement.prototype.focus;
  window.HTMLElement.prototype.focus = function() {};
  selectionShadow.querySelector('.lumno-selection-main').click();
  assert.strictEqual(highSurface.dataset.iconOnly, 'false');
  assert.strictEqual(highSurface.getBoundingClientRect().width, 240);
  for (let attempt = 0; attempt < 20 && highSurface.dataset.toolbarEntranceState !== 'to'; attempt += 1) {
    await wait(10);
  }
  assert.strictEqual(host.hidden, false);
  assert.strictEqual(host.dataset.visible, 'true');
  assert.strictEqual(highSurface.dataset.toolbarEntranceMode, 'fallback');
  assert.strictEqual(highSurface.dataset.toolbarEntranceState, 'to',
    'browsers without Web Animations should retain the staged reveal through CSS state');
  await wait(430);
  assert.strictEqual(highSurface.dataset.toolbarEntranceState, 'to',
    'the CSS fallback should preserve its measured final width until the toolbar closes');
  assert.strictEqual(highSurface.style.getPropertyValue('--lumno-toolbar-expanded-width'), '240px',
    'the CSS fallback should retain the measured material width after the transition finishes');
  window.HTMLElement.prototype.focus = nativeFocus;
  window.document.dispatchEvent(new window.Event('copy', { bubbles: true }));
  assert.strictEqual(highSurface.dataset.toolbarEntranceState, undefined,
    'dismissing the CSS fallback should clear its temporary animation state');
  delete highSurface.getBoundingClientRect;

  await selectDomText(selectableLink);
  reduceMotion = true;
  const animationCountBeforeReducedMotion = toolbarAnimations.length;
  selectionShadow.querySelector('.lumno-selection-main').click();
  await wait(30);
  assert.strictEqual(toolbarAnimations.length, animationCountBeforeReducedMotion,
    'prefers-reduced-motion should bypass the butterfly-to-toolbar animation');
  assert.strictEqual(highSurface.style.transition, '',
    'prefers-reduced-motion should bypass the CSS entrance fallback too');
  reduceMotion = false;

  await selectTextControl(sensitivePassword, 0, sensitivePassword.value.length);
  assert.strictEqual(host.hidden, true, 'password selections must remain suppressed');

  await selectTextControl(sensitivePayment, 0, 16, () => {
    sensitivePaymentValueReads = 0;
  });
  assert.strictEqual(host.hidden, true, 'payment autocomplete selections must remain suppressed');
  assert.strictEqual(sensitivePaymentValueReads, 0,
    'selection acquisition must reject payment fields before reading their value');

  window.document.dispatchEvent(new window.Event('copy', { bubbles: true }));
  selection.removeAllRanges();
  question.dispatchEvent(new window.MouseEvent('pointerdown', {
    bubbles: true,
    button: 0,
    clientX: 20,
    clientY: 52
  }));
  const questionRange = window.document.createRange();
  questionRange.selectNodeContents(question);
  selection.addRange(questionRange);
  question.dispatchEvent(new window.MouseEvent('pointerup', {
    bubbles: true,
    button: 0,
    clientX: 100,
    clientY: 52
  }));
  await wait(460);
  selectionShadow.querySelector('.lumno-selection-main').click();
  assert.deepStrictEqual(
    Array.from(selectionShadow.querySelectorAll('.lumno-selection-toolbar [data-intent]'))
      .map((button) => button.dataset.intent),
    ['ask', 'explain', 'search'],
    'a question should expose Answer first without using it as a generic fallback'
  );

  storageChangeListeners.forEach((listener) => listener({
    _x_extension_selection_quick_actions_trigger_style_2026_unique_: {
      oldValue: 'butterfly',
      newValue: 'lumno'
    }
  }, 'sync'));
  assert.strictEqual(host.dataset.selectionMark, 'lumno', 'obsolete sync changes should not affect a visible entry');
  assert.strictEqual(
    localStorageValues._x_extension_selection_quick_actions_trigger_style_2026_unique_,
    'lumno',
    'obsolete sync changes should not update the local runtime mirror'
  );
  storageChangeListeners.forEach((listener) => listener({
    _x_extension_selection_quick_actions_trigger_style_2026_unique_: {
      oldValue: 'lumno',
      newValue: 'butterfly'
    }
  }, 'sync'));
  assert.strictEqual(host.dataset.selectionMark, 'lumno', 'obsolete sync values should never restore the removed visual');

  storageChangeListeners.forEach((listener) => listener({
    _x_extension_selection_quick_actions_trigger_style_2026_unique_: {
      oldValue: 'butterfly',
      newValue: 'lumno'
    }
  }, 'local'));
  assert.strictEqual(
    host.dataset.selectionMark,
    'lumno',
    'obsolete local mirror updates should be ignored while Chrome Sync is primary'
  );
  storageChangeListeners.forEach((listener) => listener({
    _x_extension_selection_quick_actions_trigger_style_2026_unique_: {
      oldValue: 'lumno',
      newValue: 'butterfly'
    }
  }, 'local'));
  assert.strictEqual(host.dataset.selectionMark, 'lumno');

  const lateLegacyHost = window.document.createElement('div');
  lateLegacyHost.id = '_x_extension_selection_quick_actions_host_2026_unique_';
  lateLegacyHost.dataset.selectionMark = 'lumno';
  window.document.documentElement.appendChild(lateLegacyHost);
  await wait(0);
  assert.strictEqual(
    lateLegacyHost.isConnected,
    false,
    'a legacy host injected after the current surface should not cover the fixed Lumno entry'
  );
  assert.strictEqual(
    window.document.querySelectorAll('[id="_x_extension_selection_quick_actions_host_2026_unique_"]').length,
    1
  );

  window.document.dispatchEvent(new window.Event('copy', { bubbles: true }));
  assert.strictEqual(host.hidden, true, 'copy should dismiss the selection affordance');

  selection.removeAllRanges();
  generic.dispatchEvent(new window.MouseEvent('pointerdown', {
    bubbles: true,
    button: 0,
    clientX: 20,
    clientY: 70
  }));
  const genericRange = window.document.createRange();
  genericRange.selectNodeContents(generic);
  selection.addRange(genericRange);
  generic.dispatchEvent(new window.MouseEvent('pointerup', {
    bubbles: true,
    button: 0,
    clientX: 70,
    clientY: 70
  }));
  await wait(520);
  assert.strictEqual(host.hidden, false, 'a deliberate single-word selection should show the low-distraction entry');
  assert.strictEqual(host.dataset.selectionMark, 'lumno', 'the fixed Lumno mark should render in the compact entry');
  assert.strictEqual(host.style.left, '72px', 'the entry should sit tightly at the end of the selected text');
  assert.strictEqual(host.style.top, '66px', 'the entry should sit compactly at the upper-right of the selected text');
  const selectionStyles = selectionShadow.querySelector('style').textContent;
  assert(
    /:host::before,\s*:host::after\s*\{[\s\S]*?content:\s*none !important[\s\S]*?display:\s*none !important/.test(selectionStyles),
    'page pseudo-elements should not be able to inject content into the isolated toolbar host'
  );
  assert(selectionStyles.includes('width: 18px'), 'the compact trigger should use the half-size 18px button');
  assert(selectionStyles.includes('width: 12px'), 'the compact trigger should use the 12px Lumno mark');
  assert(selectionStyles.includes('inset: -5px'), 'the smaller visual should retain an expanded pointer target');
  assert(
    /\.lumno-selection-surface\s*\{[\s\S]*?--lumno-selection-surface-radius:\s*13px[\s\S]*?height:\s*38px[\s\S]*?padding:\s*3px[\s\S]*?border-radius:\s*var\(--lumno-selection-surface-radius\)/.test(selectionStyles) &&
      /\.lumno-selection-material\s*\{[\s\S]*?background:\s*light-dark\(rgba\(244, 245, 247, 0\.94\), rgba\(26, 27, 31, 0\.92\)\)/.test(selectionStyles),
    'the expanded toolbar should use the approved compact 38px surface geometry'
  );
  assert(
    /\.lumno-selection-material\s*\{[\s\S]*?border:\s*1px solid light-dark\(rgba\(15, 23, 42, 0\.12\), rgba\(255, 255, 255, 0\.13\)\)/.test(selectionStyles) &&
      /\.lumno-selection-surface\s*\{[\s\S]*?color:\s*light-dark\(#18181b, #e7e8eb\)/.test(selectionStyles),
    'light and dark toolbar materials should use independently tuned borders and foregrounds'
  );
  assert(
    /\.lumno-selection-material\s*\{[\s\S]*?inset 0 0 0 1px light-dark\(rgba\(255, 255, 255, 0\.3\), transparent\)/.test(selectionStyles),
    'the dark toolbar material should remove the inner highlight while preserving it in light mode'
  );
  assert(
    /\.lumno-selection-material::before\s*\{[\s\S]*?border-radius:\s*calc\(var\(--lumno-selection-surface-radius\) - 1px\)/.test(selectionStyles),
    'the inner material radius should follow the one-pixel inset inside the outer border'
  );
  assert(
    /@supports\s*\(corner-shape:\s*superellipse\(1\.25\)\)\s*\{[\s\S]*?\.lumno-selection-material,[\s\S]*?\.lumno-selection-material::before\s*\{[\s\S]*?corner-shape:\s*superellipse\(1\.25\)/.test(selectionStyles),
    'the inner material and its border should share the same continuous corner curve'
  );
  assert(
    /\.lumno-selection-material::before\s*\{[\s\S]*?radial-gradient\([\s\S]*?transparent 72%[\s\S]*?radial-gradient\([\s\S]*?transparent 78%/.test(selectionStyles),
    'the toolbar should use broad static gradient diffusion instead of an animated large blur layer'
  );
  assert(
    /\.lumno-selection-material\s*\{[\s\S]*?-webkit-backdrop-filter:\s*blur\(14px\) saturate\(130%\)[\s\S]*?backdrop-filter:\s*blur\(14px\) saturate\(130%\)/.test(selectionStyles),
    'the translucent toolbar material should softly blend with the page underneath'
  );
  assert(
    /button\s*\{[\s\S]*?padding:\s*0 8px[\s\S]*?min-height:\s*30px[\s\S]*?border-radius:\s*9px[\s\S]*?gap:\s*5px[\s\S]*?font:\s*400 12px/.test(selectionStyles),
    '30px actions should use the lighter text weight and retain the same 3px shell inset'
  );
  assert(
    /\.lumno-selection-surface\[data-icon-only="false"\]\s*\{[\s\S]*?padding-inline-end:\s*1px/.test(selectionStyles) &&
      !/\.lumno-selection-main\[data-icon-only="false"\] \.lumno-selection-logo\s*\{/.test(selectionStyles),
    'the expanded toolbar should shorten only the trailing shell inset while keeping the butterfly centered in its hit area'
  );
  assert(
    /\.lumno-selection-content\s*\{[\s\S]*?justify-content:\s*flex-end[\s\S]*?overflow:\s*hidden/.test(selectionStyles) &&
      /\.lumno-selection-toolbar\s*\{[\s\S]*?justify-content:\s*flex-end[\s\S]*?transform-origin:\s*left center/.test(selectionStyles),
    'all toolbar contents should stay right-aligned while the shared viewport grows to the right'
  );
  assert(
    /\.lumno-selection-actions-viewport\s*\{[\s\S]*?flex:\s*0 1 auto[\s\S]*?min-width:\s*0[\s\S]*?justify-content:\s*flex-end[\s\S]*?overflow:\s*hidden/.test(selectionStyles),
    'the actions viewport should shrink safely while remaining aligned to the moving right edge'
  );
  assert(
    /button:focus-visible\s*\{[\s\S]*?box-shadow:\s*inset 0 0 0 1px/.test(selectionStyles),
    'keyboard focus should stay visible without creating a heavy nested pill'
  );
  assert(
    /\.lumno-selection-toolbar:hover button:focus-visible:not\(:hover\)[\s\S]*?background:\s*transparent[\s\S]*?box-shadow:\s*none/.test(selectionStyles),
    'pointer hover should suppress a competing programmatic focus highlight'
  );
  assert(
    /\.lumno-selection-toolbar:focus\s*\{[\s\S]*?outline:\s*none/.test(selectionStyles),
    'the neutral toolbar focus target should not add a second outline around the surface'
  );
  assert(
    /\.lumno-selection-primary-divider\s*\{[\s\S]*?margin-inline:\s*3px[\s\S]*?width:\s*1px[\s\S]*?height:\s*18px/.test(selectionStyles) &&
      /\.lumno-selection-actions-viewport\s*\{[\s\S]*?overflow:\s*hidden/.test(selectionStyles) &&
      !/\.lumno-selection-toolbar::before/.test(selectionStyles) &&
      /\.lumno-selection-toolbar button \+ button\s*\{[\s\S]*?margin-inline-start:\s*7px/.test(selectionStyles) &&
      /\.lumno-selection-toolbar button \+ button::before[\s\S]*?inset-inline-start:\s*-4px[\s\S]*?width:\s*1px[\s\S]*?height:\s*18px/.test(selectionStyles),
    'the trailing primary divider and in-toolbar dividers should retain the same 3px clearance'
  );
  assert(
    /@supports \(corner-shape:\s*superellipse\(1\.25\)\)[\s\S]*?corner-shape:\s*superellipse\(1\.25\)/.test(selectionStyles),
    'the toolbar shell and controls should share the Overlay superellipse corner treatment'
  );
  assert(
    /button\s*\{[\s\S]*?border-radius:\s*9px[\s\S]*?corner-shape:\s*superellipse\(1\.25\)/.test(selectionStyles) &&
      /button:hover, button:focus-visible\s*\{[\s\S]*?background:/.test(selectionStyles),
    'toolbar action and butterfly hover backgrounds should draw directly with continuous corners'
  );
  assert(
    /\.lumno-selection-action-icon\s*\{[\s\S]*?width:\s*16px[\s\S]*?height:\s*16px/.test(selectionStyles),
    'toolbar action icons should use the compact 16px scale'
  );
  assert(!selectionStyles.includes('lumno-selection-butterfly'),
    'the selection styles should not retain butterfly-only rules');

  await selectDomText(darkCopy);
  assert.strictEqual(host.dataset.entryContrast, 'dark',
    'a butterfly placed over a dark page surface should adapt without a conspicuous global inversion effect');
  assert.strictEqual(host.style.colorScheme, 'dark',
    'opening from a dark page surface should keep the toolbar material dark instead of flashing white');

  window.document.dispatchEvent(new window.Event('copy', { bubbles: true }));
  selection.removeAllRanges();
  cjk.dispatchEvent(new window.MouseEvent('pointerdown', {
    bubbles: true,
    button: 0,
    clientX: 20,
    clientY: 100
  }));
  const cjkRange = window.document.createRange();
  cjkRange.selectNodeContents(cjk);
  selection.addRange(cjkRange);
  cjk.dispatchEvent(new window.MouseEvent('pointerup', {
    bubbles: true,
    button: 0,
    clientX: 110,
    clientY: 100
  }));
  await wait(520);
  assert.strictEqual(host.hidden, true, 'a generic Chinese statement should not show the selection entry');

  window.document.dispatchEvent(new window.Event('copy', { bubbles: true }));

  selection.removeAllRanges();
  xPost.dispatchEvent(new window.MouseEvent('pointerdown', {
    bubbles: true,
    button: 0,
    clientX: 20,
    clientY: 130
  }));
  xPost.dispatchEvent(new window.MouseEvent('pointerup', {
    bubbles: true,
    button: 0,
    clientX: 120,
    clientY: 130
  }));
  const delayedXRange = window.document.createRange();
  delayedXRange.selectNodeContents(xPost);
  selection.addRange(delayedXRange);
  window.document.dispatchEvent(new window.Event('selectionchange'));
  await wait(520);
  assert.strictEqual(host.hidden, false, 'a selection that settles after pointerup should still trigger on X-like content');

  window.document.dispatchEvent(new window.Event('copy', { bubbles: true }));

  selection.removeAllRanges();
  xPost.dispatchEvent(new window.Event('selectstart', { bubbles: true }));
  const selectStartXRange = window.document.createRange();
  selectStartXRange.selectNodeContents(xPost);
  selection.addRange(selectStartXRange);
  window.document.dispatchEvent(new window.Event('selectionchange'));
  await wait(520);
  assert.strictEqual(host.hidden, false, 'selectstart should arm selection evaluation even when pointerup is absent');

  window.document.dispatchEvent(new window.Event('copy', { bubbles: true }));

  selection.removeAllRanges();
  xPost.dispatchEvent(new window.MouseEvent('pointerdown', {
    bubbles: true,
    button: 0,
    clientX: 20,
    clientY: 130
  }));
  const cancelledXRange = window.document.createRange();
  cancelledXRange.selectNodeContents(xPost);
  selection.addRange(cancelledXRange);
  xPost.dispatchEvent(new window.MouseEvent('pointercancel', {
    bubbles: true,
    button: 0,
    clientX: 120,
    clientY: 130
  }));
  await wait(520);
  assert.strictEqual(host.hidden, false, 'a pointercancel during X selection should not discard the selection trigger');

  window.document.dispatchEvent(new window.Event('copy', { bubbles: true }));

  selection.removeAllRanges();
  const staleRange = window.document.createRange();
  staleRange.selectNodeContents(paragraph);
  selection.addRange(staleRange);
  paragraph.dispatchEvent(new window.MouseEvent('pointerup', {
    bubbles: true,
    button: 0,
    clientX: 70,
    clientY: 40
  }));
  await wait(520);
  assert.strictEqual(host.hidden, true, 'an existing selection without a new pointer gesture should not trigger');

  storageChangeListeners.forEach((listener) => listener({
    _x_extension_selection_quick_actions_enabled_2026_unique_: {
      oldValue: true,
      newValue: false
    }
  }, 'sync'));
  assert.strictEqual(
    host.isConnected,
    false,
    'disabling this runtime should release its ownership instead of suppressing another Lumno installation'
  );

  dom.window.close();
  console.log('selection quick actions DOM tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
