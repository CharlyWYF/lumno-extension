(function() {
  'use strict';

  if (window._x_extension_selection_quick_actions_2026_unique_) {
    return;
  }
  window._x_extension_selection_quick_actions_2026_unique_ = true;

  const INTENT = globalThis.LumnoSelectionIntent;
  const ACTION_ICON_LIBRARY = globalThis.LumnoSelectionActionIcons;
  const TOAST = globalThis.LumnoToast;
  const SETTINGS = globalThis.LumnoSettings;

  const ENABLED_STORAGE_KEY = SETTINGS.SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY;
  const LANGUAGE_STORAGE_KEY = SETTINGS.LANGUAGE_STORAGE_KEY;
  const HOST_ID = '_x_extension_selection_quick_actions_host_2026_unique_';
  const DEVELOPMENT_EXTENSION_ID = 'kkcjcneagmlhpeaafngjdlpcfjakejgb';
  const RUNTIME_REVISION = 'selection-toolbar-v32';
  const RUNTIME_VERSION = 32;
  const RUNTIME_ID = chrome && chrome.runtime && chrome.runtime.id
    ? String(chrome.runtime.id)
    : '';
  const RUNTIME_PRIORITY = RUNTIME_ID === DEVELOPMENT_EXTENSION_ID ? 2 : 1;
  const TOAST_HOST_ID = '_x_extension_selection_quick_actions_toast_host_2026_unique_';
  const TOAST_STYLE_ID = '_x_extension_selection_quick_actions_toast_style_2026_unique_';
  const ENTRY_DELAY_MS = 320;
  const SELECTION_CHANGE_DELAY_MS = 80;
  const SELECTION_GESTURE_TIMEOUT_MS = 1600;
  const ENTRY_DISMISS_MS = 2200;
  const TOOLBAR_DISMISS_MS = 3600;
  const ACTION_SUCCESS_DISMISS_MS = 900;
  const ACTION_FAILURE_DISMISS_MS = 2200;
  const VIEWPORT_SAFE_MARGIN_PX = 12;
  const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email']);
  const providerStorage = SETTINGS.getProviderStorage(chrome);
  const providerStorageRuntime = providerStorage.runtime;
  const storageArea = providerStorage.area;

  let enabled = false;
  let languageMode = 'system';
  let localeMessages = null;
  let showTimer = null;
  let dismissTimer = null;
  let selectionActionHideTimer = null;
  let selectionChangeTimer = null;
  let gestureResetTimer = null;
  let requestSequence = 0;
  let pointerDownState = null;
  let selectionGestureActive = false;
  let currentCandidate = null;
  let host = null;
  let shadow = null;
  let surface = null;
  let material = null;
  let mainButton = null;
  let selectionLogo = null;
  let mainLabel = null;
  let primaryDivider = null;
  let contentViewport = null;
  let actionsViewport = null;
  let menu = null;
  let toastHost = null;
  let toastController = null;
  let toastStyleGate = null;
  let ownershipObserver = null;
  let surfaceResizeObserver = null;
  let toolbarEntranceAnimations = [];
  let toolbarEntranceFrame = null;
  let toolbarEntranceCleanupTimer = null;
  let viewportRepositionFrame = null;
  let hostHorizontalAnchor = 'left';
  let attachedPageListeners = null;

  const HOST_ISOLATION_STYLES = Object.freeze({
    all: 'initial',
    position: 'fixed',
    'z-index': '2147483647',
    'box-sizing': 'border-box',
    width: 'max-content',
    height: 'max-content',
    'min-width': '0',
    'min-height': '0',
    'max-width': 'none',
    'max-height': 'none',
    margin: '0',
    padding: '0',
    border: '0',
    outline: '0',
    bottom: 'auto',
    opacity: '1',
    visibility: 'visible',
    'pointer-events': 'auto',
    transform: 'none',
    translate: 'none',
    rotate: 'none',
    scale: 'none',
    filter: 'none',
    '-webkit-filter': 'none',
    perspective: 'none',
    clip: 'auto',
    'clip-path': 'none',
    '-webkit-clip-path': 'none',
    mask: 'none',
    '-webkit-mask': 'none',
    overflow: 'visible',
    isolation: 'isolate',
    'mix-blend-mode': 'normal',
    contain: 'layout style',
    'content-visibility': 'visible',
    'writing-mode': 'horizontal-tb',
    direction: 'ltr',
    zoom: '1',
    animation: 'none',
    transition: 'none'
  });

  const ACTION_COPY = Object.freeze({
    ask: ['selection_quick_action_ask', 'Answer'],
    translate: ['selection_quick_action_translate', 'Translate'],
    explain: ['selection_quick_action_explain', 'Explain'],
    summarize: ['selection_quick_action_summarize', 'Summarize'],
    search: ['selection_quick_action_search', 'Research'],
    calculate: ['selection_quick_action_calculate', 'Calculate']
  });
  const TOOLBAR_FALLBACK_ACTIONS = Object.freeze(['explain', 'search', 'translate']);

  function createInlineIcon(definition, className) {
    if (!definition || !definition.body) {
      return null;
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add(...String(className).split(/\s+/).filter(Boolean));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('viewBox', definition.viewBox || '0 0 24 24');
    svg.innerHTML = definition.body;
    return svg;
  }

  function buildActionIcon(action) {
    const definitions = ACTION_ICON_LIBRARY.remix || {};
    return createInlineIcon(definitions[action] || definitions.ask, 'lumno-selection-action-icon');
  }

  function getMessage(key, fallback) {
    if (localeMessages && localeMessages[key] && localeMessages[key].message) {
      return localeMessages[key].message;
    }
    try {
      const value = chrome.i18n && chrome.i18n.getMessage
        ? chrome.i18n.getMessage(key)
        : '';
      return value || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function applyNoTranslate(element) {
    if (!element || typeof element.setAttribute !== 'function') {
      return element;
    }
    element.setAttribute('translate', 'no');
    element.setAttribute('lang', 'zxx');
    element.setAttribute('notranslate', '');
    element.setAttribute('data-no-translate', 'true');
    if (element.classList) {
      element.classList.add('notranslate');
    }
    return element;
  }

  function applyNoTranslateDeep(root) {
    if (!root || typeof root !== 'object') {
      return root;
    }
    applyNoTranslate(root);
    if (typeof root.querySelectorAll === 'function') {
      root.querySelectorAll('*').forEach((element) => applyNoTranslate(element));
    }
    return root;
  }

  function normalizeLocale(value) {
    return SETTINGS.localeToHtmlLang(value);
  }

  function getCurrentLocale() {
    if (languageMode && languageMode !== 'system') {
      return normalizeLocale(languageMode);
    }
    try {
      if (chrome.i18n && typeof chrome.i18n.getUILanguage === 'function') {
        return normalizeLocale(chrome.i18n.getUILanguage());
      }
    } catch (e) {
      // Fall through to navigator language.
    }
    return normalizeLocale(navigator.language || 'en');
  }

  function refreshLocaleMessages() {
    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    chrome.runtime.sendMessage({ action: 'getLocaleMessages', locale: getCurrentLocale() }, (response) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        return;
      }
      localeMessages = response && response.messages ? response.messages : null;
      if (menu && !menu.hidden && currentCandidate) {
        renderMenu();
      }
    });
  }

  function getActionLabel(action) {
    const copy = ACTION_COPY[action] || ACTION_COPY.ask;
    return getMessage(copy[0], copy[1]);
  }

  function clearTimers() {
    if (showTimer) {
      window.clearTimeout(showTimer);
      showTimer = null;
    }
    if (dismissTimer) {
      window.clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    clearSelectionActionHideTimer();
    if (selectionChangeTimer) {
      window.clearTimeout(selectionChangeTimer);
      selectionChangeTimer = null;
    }
  }

  function clearSelectionActionHideTimer() {
    if (!selectionActionHideTimer) {
      return;
    }
    window.clearTimeout(selectionActionHideTimer);
    selectionActionHideTimer = null;
  }

  function applyHostIsolationStyles() {
    if (!host) {
      return;
    }
    Object.entries(HOST_ISOLATION_STYLES).forEach(([property, value]) => {
      host.style.setProperty(property, value, 'important');
    });
  }

  function setHostHidden(hidden) {
    if (!host) {
      return;
    }
    applyHostIsolationStyles();
    host.hidden = Boolean(hidden);
    host.style.setProperty('display', hidden ? 'none' : 'block', 'important');
  }

  function setHostPosition(left, top) {
    if (!host) {
      return;
    }
    hostHorizontalAnchor = 'left';
    host.style.setProperty('left', `${Math.round(left)}px`, 'important');
    host.style.setProperty('right', 'auto', 'important');
    host.style.setProperty('top', `${Math.round(top)}px`, 'important');
  }

  function setHostRightPosition(right, top) {
    if (!host) {
      return;
    }
    hostHorizontalAnchor = 'right';
    host.style.setProperty('left', 'auto', 'important');
    host.style.setProperty('right', `${Math.round(right)}px`, 'important');
    host.style.setProperty('top', `${Math.round(top)}px`, 'important');
  }

  function setHostColorScheme(value) {
    if (!host) {
      return;
    }
    host.style.setProperty('color-scheme', value, 'important');
  }

  function clearSelectionToast() {
    if (toastController && typeof toastController.destroy === 'function') {
      toastController.destroy();
    }
    if (toastStyleGate && typeof toastStyleGate.destroy === 'function') {
      toastStyleGate.destroy();
    }
    if (toastHost && toastHost.isConnected) {
      toastHost.remove();
    }
    toastHost = null;
    toastController = null;
    toastStyleGate = null;
  }

  function ensureSelectionToast() {
    if (toastHost && toastHost.isConnected && toastController) {
      return true;
    }
    clearSelectionToast();
    const staleHost = document.getElementById(TOAST_HOST_ID);
    if (staleHost) {
      staleHost.remove();
    }
    toastHost = document.createElement('div');
    toastHost.id = TOAST_HOST_ID;
    applyNoTranslate(toastHost);
    const hostStyles = {
      all: 'initial',
      position: 'fixed',
      inset: '0',
      'z-index': '2147483647',
      display: 'block',
      width: 'auto',
      height: 'auto',
      margin: '0',
      padding: '0',
      border: '0',
      opacity: '1',
      visibility: 'visible',
      'pointer-events': 'none',
      transform: 'none',
      filter: 'none',
      overflow: 'visible',
      isolation: 'isolate',
      contain: 'none'
    };
    Object.entries(hostStyles).forEach(([property, value]) => {
      toastHost.style.setProperty(property, value, 'important');
    });

    const toastShadow = toastHost.attachShadow({ mode: 'closed' });
    const stylesheet = document.createElement('link');
    stylesheet.id = TOAST_STYLE_ID;
    stylesheet.rel = 'stylesheet';
    stylesheet.href = chrome.runtime.getURL('src/shared/toast.css');
    const toastElement = document.createElement('div');
    toastElement.className = 'x-lumno-toast';
    toastElement.setAttribute('data-show', 'false');
    toastElement.setAttribute('role', 'status');
    toastElement.setAttribute('aria-live', 'polite');
    toastElement.style.setProperty(
      '--x-lumno-toast-top',
      'max(24px, calc(env(safe-area-inset-top) + 12px))'
    );
    toastElement.style.setProperty('--x-lumno-toast-z-index', '2147483647');
    applyNoTranslate(toastElement);
    toastShadow.append(stylesheet, toastElement);
    (document.documentElement || document.body).appendChild(toastHost);

    toastStyleGate = TOAST.createToastStyleGate(toastElement, {
      stylesheetElement: stylesheet,
      windowObj: window
    });
    toastController = TOAST.createToastController(toastElement, {
      duration: ACTION_FAILURE_DISMISS_MS,
      windowObj: window
    });
    return true;
  }

  function showSelectionToast(message, options) {
    if (!ensureSelectionToast()) {
      return;
    }
    toastController.show(message, options || {});
  }

  function hideSelectionToast() {
    if (toastController && typeof toastController.hide === 'function') {
      toastController.hide();
    }
  }

  function getViewportBounds() {
    const visualViewport = window.visualViewport;
    const width = visualViewport && Number.isFinite(visualViewport.width)
      ? visualViewport.width
      : (window.innerWidth || document.documentElement.clientWidth || 0);
    const height = visualViewport && Number.isFinite(visualViewport.height)
      ? visualViewport.height
      : (window.innerHeight || document.documentElement.clientHeight || 0);
    const left = visualViewport && Number.isFinite(visualViewport.offsetLeft)
      ? visualViewport.offsetLeft
      : 0;
    const top = visualViewport && Number.isFinite(visualViewport.offsetTop)
      ? visualViewport.offsetTop
      : 0;
    return {
      bottom: top + Math.max(0, height),
      left,
      right: left + Math.max(0, width),
      top
    };
  }

  function getLayoutViewportWidth() {
    return window.innerWidth || document.documentElement.clientWidth || 0;
  }

  function clampToSafeAxis(value, minimum, maximum) {
    const safeMaximum = Math.max(minimum, maximum);
    return Math.min(safeMaximum, Math.max(minimum, value));
  }

  function applySurfaceViewportLimit(viewport) {
    if (!surface || !viewport) {
      return;
    }
    const availableWidth = Math.max(
      0,
      viewport.right - viewport.left - VIEWPORT_SAFE_MARGIN_PX * 2
    );
    surface.style.maxWidth = `${Math.floor(availableWidth)}px`;
  }

  function clampVisibleSurfaceToViewport() {
    viewportRepositionFrame = null;
    if (!host || host.hidden || !surface) {
      return;
    }
    const viewport = getViewportBounds();
    applySurfaceViewportLimit(viewport);
    const bounds = surface.getBoundingClientRect();
    const safeLeft = viewport.left + VIEWPORT_SAFE_MARGIN_PX;
    const safeTop = viewport.top + VIEWPORT_SAFE_MARGIN_PX;
    const maximumLeft = viewport.right - bounds.width - VIEWPORT_SAFE_MARGIN_PX;
    const maximumTop = viewport.bottom - bounds.height - VIEWPORT_SAFE_MARGIN_PX;
    const currentTop = Number.parseFloat(host.style.top);
    const clampedTop = clampToSafeAxis(
      Number.isFinite(currentTop) ? currentTop : bounds.top,
      safeTop,
      maximumTop
    );
    if (hostHorizontalAnchor === 'right') {
      const layoutViewportWidth = getLayoutViewportWidth();
      const currentRightOffset = Number.parseFloat(host.style.right);
      const currentRightEdge = Number.isFinite(currentRightOffset)
        ? layoutViewportWidth - currentRightOffset
        : bounds.right;
      const rightEdge = clampToSafeAxis(
        currentRightEdge,
        safeLeft + bounds.width,
        viewport.right - VIEWPORT_SAFE_MARGIN_PX
      );
      setHostRightPosition(layoutViewportWidth - rightEdge, clampedTop);
      return;
    }
    const currentLeft = Number.parseFloat(host.style.left);
    setHostPosition(
      clampToSafeAxis(Number.isFinite(currentLeft) ? currentLeft : bounds.left, safeLeft, maximumLeft),
      clampedTop
    );
  }

  function scheduleViewportClamp() {
    if (!host || host.hidden || !surface) {
      return;
    }
    if (viewportRepositionFrame != null) {
      window.cancelAnimationFrame(viewportRepositionFrame);
    }
    viewportRepositionFrame = window.requestAnimationFrame(clampVisibleSurfaceToViewport);
  }

  function prefersReducedMotion() {
    try {
      return typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function cancelToolbarEntranceAnimation() {
    if (toolbarEntranceFrame != null) {
      window.cancelAnimationFrame(toolbarEntranceFrame);
      window.clearTimeout(toolbarEntranceFrame);
      toolbarEntranceFrame = null;
    }
    if (toolbarEntranceCleanupTimer) {
      window.clearTimeout(toolbarEntranceCleanupTimer);
      toolbarEntranceCleanupTimer = null;
    }
    toolbarEntranceAnimations.forEach((animation) => {
      if (animation && typeof animation.cancel === 'function') {
        animation.cancel();
      }
    });
    toolbarEntranceAnimations = [];
    if (surface) {
      delete surface.dataset.toolbarEntranceState;
      surface.style.removeProperty('--lumno-entry-width');
      surface.style.removeProperty('--lumno-toolbar-expanded-width');
      surface.style.removeProperty('--lumno-toolbar-content-width');
      surface.style.removeProperty('--lumno-toolbar-content-offset');
      surface.style.removeProperty('will-change');
    }
    if (material) {
      material.style.removeProperty('will-change');
    }
    if (contentViewport) {
      contentViewport.style.removeProperty('will-change');
    }
    if (menu) {
      menu.style.removeProperty('will-change');
    }
  }

  function runToolbarEntranceFallback(geometry) {
    if (!surface || !material || !contentViewport || !geometry) {
      return;
    }
    surface.dataset.toolbarEntranceMode = 'fallback';
    surface.style.setProperty('--lumno-toolbar-expanded-width', `${geometry.expandedWidth}px`);
    surface.style.setProperty('--lumno-toolbar-content-width', `${geometry.contentWidth}px`);
    surface.style.setProperty('--lumno-toolbar-content-offset', `${geometry.contentOffset}px`);
    surface.dataset.toolbarEntranceState = 'from';
    void surface.offsetWidth;
    toolbarEntranceFrame = window.setTimeout(() => {
      toolbarEntranceFrame = null;
      if (!surface || !menu || menu.hidden || !host || host.hidden) {
        cancelToolbarEntranceAnimation();
        return;
      }
      surface.dataset.toolbarEntranceState = 'to';
    }, 0);
  }

  function animateToolbarEntrance(originRect) {
    cancelToolbarEntranceAnimation();
    if (!surface || !material || !contentViewport || !originRect) {
      return;
    }
    if (prefersReducedMotion()) {
      surface.dataset.toolbarEntranceMode = 'reduced-motion';
      return;
    }
    surface.dataset.toolbarEntranceMode = 'scheduled';
    const useWebAnimations = typeof surface.animate === 'function';
    const runAfterLayout = useWebAnimations
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(callback, 0);
    toolbarEntranceFrame = runAfterLayout(() => {
      toolbarEntranceFrame = null;
      if (!surface || !menu || menu.hidden || !host || host.hidden) {
        return;
      }
      const destinationRect = surface.getBoundingClientRect();
      if (destinationRect.width <= 0 || destinationRect.height <= 0) {
        surface.dataset.toolbarEntranceMode = 'invalid-destination';
        return;
      }
      const geometry = {
        contentOffset: Math.max(6, Math.min(10, destinationRect.width * 0.04)),
        contentWidth: Math.max(0, (() => {
          const contentRect = contentViewport.getBoundingClientRect();
          return contentRect.width > 0 ? contentRect.width : destinationRect.width - 8;
        })()),
        expandedWidth: destinationRect.width
      };
      if (!useWebAnimations) {
        runToolbarEntranceFallback(geometry);
        return;
      }
      surface.dataset.toolbarEntranceMode = 'web-animations';
      material.style.willChange = 'width';
      contentViewport.style.willChange = 'width';
      menu.style.willChange = 'transform, opacity';
      const materialAnimation = material.animate([
        { width: '0px' },
        { width: `${destinationRect.width}px` }
      ], {
        duration: 240,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both'
      });
      const contentRevealAnimation = contentViewport.animate([
        { width: '0px' },
        { width: `${geometry.contentWidth}px` }
      ], {
        duration: 260,
        delay: 20,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both'
      });
      const toolbarContentAnimation = menu.animate([
        { transform: `translateX(-${geometry.contentOffset}px)`, opacity: 0.72 },
        { transform: 'translateX(0px)', opacity: 1 }
      ], {
        duration: 280,
        delay: 30,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both'
      });
      toolbarEntranceAnimations = [materialAnimation, contentRevealAnimation, toolbarContentAnimation];
      toolbarEntranceCleanupTimer = window.setTimeout(() => {
        toolbarEntranceCleanupTimer = null;
        if (material) material.style.removeProperty('will-change');
        if (contentViewport) contentViewport.style.removeProperty('will-change');
        if (menu) menu.style.removeProperty('will-change');
      }, 420);
    });
  }

  function hideSurface(options) {
    cancelToolbarEntranceAnimation();
    clearTimers();
    hideSelectionToast();
    if (viewportRepositionFrame != null) {
      window.cancelAnimationFrame(viewportRepositionFrame);
      viewportRepositionFrame = null;
    }
    currentCandidate = null;
    requestSequence += 1;
    if (!host) {
      return;
    }
    host.dataset.visible = 'false';
    if (!options || options.immediate !== false) {
      setHostHidden(true);
    } else {
      window.setTimeout(() => {
        if (host && host.dataset.visible !== 'true') {
          setHostHidden(true);
        }
      }, 160);
    }
  }

  function getRuntimeClaim(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE || element.id !== HOST_ID) {
      return null;
    }
    return {
      id: String(element.dataset.runtimeId || ''),
      priority: Number.parseInt(element.dataset.runtimePriority || '0', 10) || 0,
      version: Number.parseInt(element.dataset.runtimeVersion || '0', 10) || 0
    };
  }

  function compareRuntimeClaim(element) {
    const claim = getRuntimeClaim(element);
    if (!claim) {
      return -1;
    }
    if (claim.version !== RUNTIME_VERSION) {
      return claim.version - RUNTIME_VERSION;
    }
    if (claim.priority !== RUNTIME_PRIORITY) {
      return claim.priority - RUNTIME_PRIORITY;
    }
    return claim.id.localeCompare(RUNTIME_ID);
  }

  function clearOwnedSurface() {
    cancelToolbarEntranceAnimation();
    clearSelectionToast();
    if (surfaceResizeObserver) {
      surfaceResizeObserver.disconnect();
      surfaceResizeObserver = null;
    }
    if (host && host.isConnected) {
      host.remove();
    }
    host = null;
    shadow = null;
    surface = null;
    contentViewport = null;
    mainButton = null;
    selectionLogo = null;
    mainLabel = null;
    menu = null;
    currentCandidate = null;
  }

  function reconcileSurfaceOwnership() {
    if (!enabled) {
      return true;
    }
    const candidates = Array.from(document.querySelectorAll(`[id="${HOST_ID}"]`));
    const strongerClaim = candidates.find((candidate) => (
      candidate !== host && compareRuntimeClaim(candidate) > 0
    ));
    if (strongerClaim) {
      clearOwnedSurface();
      return false;
    }
    candidates.forEach((candidate) => {
      if (candidate !== host) {
        candidate.remove();
      }
    });
    return true;
  }

  function mutationContainsSelectionHost(mutation) {
    return Array.from(mutation.addedNodes || []).some((node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }
      if (node.id === HOST_ID) {
        return true;
      }
      return typeof node.querySelector === 'function' && Boolean(node.querySelector(`[id="${HOST_ID}"]`));
    });
  }

  function setOwnershipMonitoring(active) {
    if (!active) {
      if (ownershipObserver) {
        ownershipObserver.disconnect();
        ownershipObserver = null;
      }
      return;
    }
    reconcileSurfaceOwnership();
    if (ownershipObserver || typeof MutationObserver !== 'function') {
      return;
    }
    ownershipObserver = new MutationObserver((mutations) => {
      if (mutations.some(mutationContainsSelectionHost)) {
        reconcileSurfaceOwnership();
      }
    });
    ownershipObserver.observe(document.documentElement || document, {
      childList: true,
      subtree: true
    });
  }

  function getActiveStorageAreaName() {
    return providerStorageRuntime.getActiveAreaName();
  }

  function updateRuntimeDebugState() {
    if (!host) {
      return;
    }
    host.dataset.runtimeRevision = RUNTIME_REVISION;
    host.dataset.runtimeVersion = String(RUNTIME_VERSION);
    host.dataset.runtimeId = RUNTIME_ID;
    host.dataset.runtimePriority = String(RUNTIME_PRIORITY);
    host.dataset.storageArea = getActiveStorageAreaName() || '';
  }

  function isEditableElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    return Boolean(element.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], .monaco-editor, .CodeMirror'
    ));
  }

  function isInsideCode(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    return Boolean(element.closest('code, pre, samp, kbd, .highlight, .syntax-highlight'));
  }

  function isSensitiveElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    return Boolean(element.closest(
      'input[type="password"], [autocomplete="current-password"], [autocomplete="new-password"], [autocomplete^="cc-"], [data-sensitive="true"]'
    ));
  }

  function isTextControl(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    if (element.tagName === 'TEXTAREA') {
      return true;
    }
    return element.tagName === 'INPUT' && TEXT_INPUT_TYPES.has(
      String(element.type || 'text').toLowerCase()
    );
  }

  function getRangeElement(range) {
    const node = range && range.commonAncestorContainer;
    if (!node) {
      return null;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      return node;
    }
    if (node.parentElement) {
      return node.parentElement;
    }
    const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
    return root && root.host && root.host.nodeType === Node.ELEMENT_NODE
      ? root.host
      : null;
  }

  function getUsableClientRects(range) {
    if (!range || typeof range.getClientRects !== 'function') {
      return [];
    }
    return Array.from(range.getClientRects()).filter((item) => (
      item && Number.isFinite(item.left) && Number.isFinite(item.right) &&
      Number.isFinite(item.top) && Number.isFinite(item.bottom) &&
      item.width > 0 && item.height > 0
    ));
  }

  function getRangeRect(range) {
    if (!range) {
      return null;
    }
    const clientRects = getUsableClientRects(range);
    let rect = range.getBoundingClientRect();
    if ((!rect || rect.width <= 0 || rect.height <= 0) && clientRects.length > 0) {
      rect = clientRects[clientRects.length - 1];
    }
    if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.bottom)) {
      return null;
    }
    const inlineRect = clientRects.length > 0
      ? clientRects[clientRects.length - 1]
      : rect;
    return {
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      inline: {
        bottom: inlineRect.bottom,
        left: inlineRect.left,
        right: inlineRect.right,
        top: inlineRect.top,
        height: inlineRect.height
      }
    };
  }

  function getDomSelectionSnapshot() {
    if (!window.getSelection) {
      return null;
    }
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount <= 0) {
      return null;
    }
    const range = selection.getRangeAt(0);
    const element = getRangeElement(range);
    const rect = getRangeRect(range);
    if (isSensitiveElement(element)) {
      return null;
    }
    const text = INTENT.normalizeText(selection.toString());
    if (!element || !rect || !text) {
      return null;
    }
    return {
      sourceKind: 'dom',
      element,
      text,
      rect,
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset
    };
  }

  function getTextControlSelectionSnapshot(element, point) {
    if (!isTextControl(element) || isSensitiveElement(element)) {
      return null;
    }
    const start = Number(element.selectionStart);
    const end = Number(element.selectionEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) {
      return null;
    }
    const text = INTENT.normalizeText(String(element.value || '').slice(start, end));
    if (!text) {
      return null;
    }
    const bounds = element.getBoundingClientRect();
    const pointerX = point && Number.isFinite(point.clientX)
      ? point.clientX
      : bounds.right;
    const x = Math.min(bounds.right, Math.max(bounds.left, pointerX));
    return {
      sourceKind: 'text-control',
      element,
      text,
      rect: {
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        inline: {
          bottom: bounds.bottom,
          height: bounds.height,
          left: x,
          right: x,
          top: bounds.top
        }
      },
      start,
      end
    };
  }

  function getUnifiedSelectionSnapshot(target, point) {
    const targetElement = target && target.nodeType === Node.ELEMENT_NODE
      ? target
      : (target && target.parentElement ? target.parentElement : null);
    const targetControl = targetElement && typeof targetElement.closest === 'function'
      ? targetElement.closest('input, textarea')
      : null;
    const activeControl = isTextControl(document.activeElement)
      ? document.activeElement
      : null;
    if (targetControl && point) {
      const pointedControlSnapshot = getTextControlSelectionSnapshot(targetControl, point);
      if (pointedControlSnapshot) {
        return pointedControlSnapshot;
      }
    }
    return getDomSelectionSnapshot() ||
      getTextControlSelectionSnapshot(targetControl || activeControl, point);
  }

  function isSameSelection(left, right) {
    if (!left || !right) {
      return false;
    }
    if (left.sourceKind !== right.sourceKind ||
        left.element !== right.element ||
        left.text !== right.text) {
      return false;
    }
    if (left.sourceKind === 'text-control') {
      return left.start === right.start && left.end === right.end;
    }
    return left.anchorNode === right.anchorNode &&
      left.anchorOffset === right.anchorOffset &&
      left.focusNode === right.focusNode &&
      left.focusOffset === right.focusOffset;
  }

  function isSelectionStillCurrent(candidate) {
    if (!candidate || !candidate.snapshot) {
      return false;
    }
    const liveSnapshot = getUnifiedSelectionSnapshot(candidate.snapshot.element);
    if (!liveSnapshot) {
      return true;
    }
    return isSameSelection(candidate.snapshot, liveSnapshot);
  }

  function parseCssColor(value) {
    const match = String(value || '').match(
      /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i
    );
    if (!match) {
      return null;
    }
    return {
      a: match[4] == null ? 1 : Math.max(0, Math.min(1, Number(match[4]))),
      b: Math.max(0, Math.min(255, Number(match[3]))),
      g: Math.max(0, Math.min(255, Number(match[2]))),
      r: Math.max(0, Math.min(255, Number(match[1])))
    };
  }

  function compositeBackground(front, back) {
    const alpha = front.a + back.a * (1 - front.a);
    if (alpha <= 0) {
      return { a: 0, b: 0, g: 0, r: 0 };
    }
    const backWeight = back.a * (1 - front.a);
    return {
      a: alpha,
      b: (front.b * front.a + back.b * backWeight) / alpha,
      g: (front.g * front.a + back.g * backWeight) / alpha,
      r: (front.r * front.a + back.r * backWeight) / alpha
    };
  }

  function getRelativeLuminance(color) {
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(color.r) +
      0.7152 * channel(color.g) +
      0.0722 * channel(color.b);
  }

  function resolveEntryContrastTone(element) {
    let current = element && element.nodeType === Node.ELEMENT_NODE
      ? element
      : (document.body || document.documentElement);
    let composite = { a: 0, b: 0, g: 0, r: 0 };
    let complexBackdrop = false;
    while (current && composite.a < 0.98) {
      try {
        const computed = window.getComputedStyle(current);
        const background = parseCssColor(computed.backgroundColor);
        if (background && background.a > 0) {
          composite = compositeBackground(composite, background);
        }
        if (computed.backgroundImage && computed.backgroundImage !== 'none') {
          complexBackdrop = true;
        }
      } catch (e) {
        // Keep the neutral fallback when a hostile page blocks style inspection.
      }
      current = current.parentElement;
    }
    if (composite.a < 1) {
      composite = compositeBackground(composite, { a: 1, b: 255, g: 255, r: 255 });
    }
    const luminance = getRelativeLuminance(composite);
    if (complexBackdrop && luminance >= 0.34 && luminance <= 0.78) {
      return 'mixed';
    }
    if (luminance < 0.42) {
      return 'dark';
    }
    if (luminance > 0.72) {
      return 'light';
    }
    return 'mixed';
  }

  // Stylesheet for the toolbar's closed shadow root.
  const SELECTION_SURFACE_STYLES = `
      :host {
        all: initial;
        position: fixed;
        z-index: 2147483647;
        display: block;
        box-sizing: border-box;
        width: max-content;
        height: max-content;
        margin: 0;
        padding: 0;
        border: 0;
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: none;
        filter: none;
        overflow: visible;
        isolation: isolate;
        mix-blend-mode: normal;
        contain: layout style;
        color-scheme: light dark;
        font-family: "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      :host([hidden]) { display: none; }
      :host::before,
      :host::after {
        content: none !important;
        display: none !important;
      }
      .lumno-selection-surface {
        --lumno-selection-surface-radius: 13px;
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        gap: 0;
        height: 38px;
        padding: 3px;
        border: 1px solid transparent;
        border-radius: var(--lumno-selection-surface-radius);
        background: transparent;
        color: light-dark(#18181b, #e7e8eb);
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        box-shadow: none;
        opacity: 0;
        transform: translateY(-3px) scale(0.96);
        transition: opacity 140ms ease, transform 160ms ease;
        box-sizing: border-box;
        overflow: visible;
        contain: layout style;
      }
      .lumno-selection-material {
        position: absolute;
        inset: 0 auto 0 0;
        z-index: 0;
        width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        border: 1px solid light-dark(rgba(15, 23, 42, 0.12), rgba(255, 255, 255, 0.13));
        border-radius: inherit;
        background: light-dark(rgba(244, 245, 247, 0.94), rgba(26, 27, 31, 0.92));
        -webkit-backdrop-filter: blur(14px) saturate(130%);
        backdrop-filter: blur(14px) saturate(130%);
        box-shadow:
          inset 0 0 0 1px light-dark(rgba(255, 255, 255, 0.3), transparent),
          0 8px 24px light-dark(rgba(15, 23, 42, 0.14), rgba(0, 0, 0, 0.38)),
          0 2px 6px light-dark(rgba(15, 23, 42, 0.08), rgba(0, 0, 0, 0.24));
        pointer-events: none;
      }
      .lumno-selection-material::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: calc(var(--lumno-selection-surface-radius) - 1px);
        background:
          radial-gradient(125% 165% at 50% -38%, light-dark(rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.16)) 0%, transparent 72%),
          radial-gradient(115% 145% at 50% 138%, light-dark(rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.08)) 0%, transparent 78%);
        pointer-events: none;
      }
      .lumno-selection-surface > * {
        position: relative;
        z-index: 1;
      }
      .lumno-selection-surface > .lumno-selection-material {
        position: absolute;
        z-index: 0;
      }
      .lumno-selection-surface[data-icon-only="true"] {
        height: auto;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        overflow: visible;
      }
      .lumno-selection-surface[data-icon-only="true"] .lumno-selection-material { display: none; }
      .lumno-selection-surface[data-icon-only="true"] .lumno-selection-content {
        flex: 0 0 auto;
        overflow: visible;
      }
      .lumno-selection-surface[data-icon-only="false"] {
        padding-inline-end: 1px;
      }
      :host([data-visible="true"]) .lumno-selection-surface {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      button {
        appearance: none;
        border: 0;
        margin: 0;
        padding: 0 8px;
        min-height: 30px;
        border-radius: 9px;
        corner-shape: superellipse(1.25);
        background: transparent;
        color: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        font: 400 12px/1.2 "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        white-space: nowrap;
        cursor: pointer;
      }
      button:hover, button:focus-visible {
        background: light-dark(rgba(15, 23, 42, 0.065), rgba(255, 255, 255, 0.1));
        outline: none;
      }
      button:focus-visible {
        box-shadow: inset 0 0 0 1px light-dark(rgba(15, 23, 42, 0.2), rgba(255, 255, 255, 0.28));
      }
      button:disabled { opacity: 0.56; cursor: default; }
      .lumno-selection-main[data-icon-only="true"] {
        position: relative;
        width: 18px;
        min-height: 18px;
        padding: 0;
        border-radius: 5px;
        background: rgba(250, 250, 250, 0.76);
        -webkit-backdrop-filter: blur(10px) saturate(150%);
        backdrop-filter: blur(10px) saturate(150%);
        opacity: 0;
        transform: translateY(2px) scale(0.9);
        transition: background 120ms ease, backdrop-filter 120ms ease,
          opacity 160ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .lumno-selection-main[data-icon-only="true"]::before {
        content: "";
        position: absolute;
        inset: -5px;
      }
      .lumno-selection-main[data-icon-only="true"] .lumno-selection-label { display: none; }
      .lumno-selection-main[data-icon-only="false"] {
        width: 30px;
        min-height: 30px;
        padding: 0;
      }
      .lumno-selection-main[data-icon-only="false"] .lumno-selection-label { display: none; }
      .lumno-selection-main[data-icon-only="false"],
      .lumno-selection-primary-divider,
      .lumno-selection-toolbar {
        flex: 0 0 auto;
      }
      .lumno-selection-logo { width: 17px; height: 17px; display: block; }
      .lumno-selection-main[data-icon-only="true"] .lumno-selection-logo {
        width: 12px;
        height: 12px;
        filter: brightness(0.28) contrast(1.18);
        opacity: 0.9;
      }
      .lumno-selection-surface[data-icon-only="true"] .lumno-selection-main {
        transition: background 120ms ease, backdrop-filter 120ms ease,
          opacity 160ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .lumno-selection-surface[data-icon-only="true"] .lumno-selection-main:hover {
        background: rgba(255, 255, 255, 0.94);
        -webkit-backdrop-filter: blur(10px) saturate(140%);
        backdrop-filter: blur(10px) saturate(140%);
      }
      .lumno-selection-surface[data-icon-only="true"] .lumno-selection-main:focus-visible {
        background: rgba(255, 255, 255, 0.94);
        box-shadow: none;
      }
      :host([data-visible="true"]) .lumno-selection-main[data-icon-only="true"] {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      :host([data-entry-contrast="dark"]) .lumno-selection-main[data-icon-only="true"] {
        background: rgba(19, 22, 28, 0.32);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.09), 0 1px 3px rgba(0, 0, 0, 0.18);
      }
      :host([data-entry-contrast="dark"]) .lumno-selection-main[data-icon-only="true"] .lumno-selection-logo {
        filter: brightness(1.45) contrast(0.88) drop-shadow(0 0 1px rgba(0, 0, 0, 0.2));
        opacity: 0.84;
      }
      :host([data-entry-contrast="mixed"]) .lumno-selection-main[data-icon-only="true"] {
        background: rgba(250, 250, 250, 0.3);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18), 0 1px 3px rgba(0, 0, 0, 0.14);
      }
      :host([data-entry-contrast="mixed"]) .lumno-selection-main[data-icon-only="true"] .lumno-selection-logo {
        filter: brightness(0.62) contrast(1.05) drop-shadow(0 0 1px rgba(255, 255, 255, 0.72));
        opacity: 0.86;
      }
      .lumno-selection-content {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex: 0 1 auto;
        min-width: 0;
        border-radius: 2px;
        overflow: hidden;
      }
      .lumno-selection-toolbar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        transform-origin: left center;
        gap: 0;
      }
      .lumno-selection-primary-divider {
        display: block;
        width: 1px;
        height: 18px;
        margin-inline: 3px;
        background: light-dark(rgba(15, 23, 42, 0.12), rgba(255, 255, 255, 0.16));
        pointer-events: none;
      }
      .lumno-selection-actions-viewport {
        display: flex;
        align-items: center;
        flex: 0 1 auto;
        min-width: 0;
        justify-content: flex-end;
        overflow: hidden;
      }
      .lumno-selection-toolbar:focus {
        outline: none;
      }
      .lumno-selection-toolbar button {
        position: relative;
      }
      .lumno-selection-toolbar button + button {
        margin-inline-start: 7px;
      }
      .lumno-selection-toolbar button + button::before {
        content: "";
        position: absolute;
        inset-inline-start: -4px;
        top: 50%;
        width: 1px;
        height: 18px;
        background: light-dark(rgba(15, 23, 42, 0.12), rgba(255, 255, 255, 0.16));
        transform: translateY(-50%);
        pointer-events: none;
      }
      .lumno-selection-toolbar:hover button:focus-visible:not(:hover) {
        background: transparent;
        box-shadow: none;
      }
      .lumno-selection-toolbar[hidden],
      .lumno-selection-main[hidden],
      .lumno-selection-primary-divider[hidden],
      .lumno-selection-actions-viewport[hidden] { display: none; }
      .lumno-selection-action-icon {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
        display: block;
        color: currentColor;
      }
      .lumno-selection-action-label {
        display: block;
        overflow: hidden;
      }
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-material {
        transition: width 240ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="from"] .lumno-selection-material {
        width: 0;
      }
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="to"] .lumno-selection-material {
        width: var(--lumno-toolbar-expanded-width);
      }
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-content {
        transition: width 260ms cubic-bezier(0.22, 1, 0.36, 1) 20ms;
      }
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="from"] .lumno-selection-content {
        width: 0;
      }
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="to"] .lumno-selection-content {
        width: var(--lumno-toolbar-content-width);
      }
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-toolbar {
        transition:
          transform 280ms cubic-bezier(0.22, 1, 0.36, 1) 30ms,
          opacity 180ms ease-out 50ms;
      }
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="from"] .lumno-selection-toolbar {
        opacity: 0.72;
        transform: translateX(calc(-1 * var(--lumno-toolbar-content-offset)));
      }
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="to"] .lumno-selection-toolbar {
        opacity: 1;
        transform: translateX(0);
      }
      @supports (corner-shape: superellipse(1.25)) {
        .lumno-selection-surface,
        .lumno-selection-material,
        .lumno-selection-material::before {
          corner-shape: superellipse(1.25);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .lumno-selection-surface,
        .lumno-selection-main[data-icon-only="true"] {
          transition: none;
        }
        .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-material,
        .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-content,
        .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-toolbar {
          transition: none;
        }
      }
    `;

  function createSurfaceHost() {
    host = document.createElement('div');
    host.id = HOST_ID;
    applyNoTranslate(host);
    setHostHidden(true);
    host.dataset.visible = 'false';
    updateRuntimeDebugState();
    shadow = host.attachShadow({ mode: 'closed' });
  }

  function createSurfaceStyle() {
    const style = document.createElement('style');
    style.textContent = SELECTION_SURFACE_STYLES;
    return style;
  }

  function createMainButton() {
    mainButton = document.createElement('button');
    mainButton.type = 'button';
    mainButton.className = 'lumno-selection-main';
    const logo = document.createElement('img');
    logo.className = 'lumno-selection-logo';
    logo.alt = '';
    logo.src = chrome.runtime.getURL('assets/images/lumno-selection-mark.svg');
    selectionLogo = logo;
    mainLabel = document.createElement('span');
    mainLabel.className = 'lumno-selection-label';
    mainButton.append(logo);
    mainButton.append(mainLabel);
    mainButton.setAttribute('aria-controls', 'lumno-selection-toolbar');
    mainButton.setAttribute('aria-expanded', 'false');
  }

  function createToolbar() {
    primaryDivider = document.createElement('span');
    primaryDivider.className = 'lumno-selection-primary-divider';
    primaryDivider.hidden = true;
    primaryDivider.setAttribute('aria-hidden', 'true');

    actionsViewport = document.createElement('div');
    actionsViewport.className = 'lumno-selection-actions-viewport';
    actionsViewport.hidden = true;

    menu = document.createElement('div');
    menu.id = 'lumno-selection-toolbar';
    menu.className = 'lumno-selection-toolbar';
    menu.tabIndex = -1;
    menu.hidden = true;
    menu.setAttribute('role', 'toolbar');
    menu.setAttribute('aria-label', getMessage('selection_quick_action_open_menu', '使用 Lumno 处理所选文字'));
    actionsViewport.append(menu);
  }

  function buildSurfaceTree() {
    surface = document.createElement('div');
    surface.className = 'lumno-selection-surface';
    surface.setAttribute('role', 'group');

    material = document.createElement('span');
    material.className = 'lumno-selection-material';
    material.setAttribute('aria-hidden', 'true');

    createMainButton();
    createToolbar();

    contentViewport = document.createElement('div');
    contentViewport.className = 'lumno-selection-content';
    contentViewport.append(actionsViewport, primaryDivider, mainButton);

    surface.append(material, contentViewport);
    applyNoTranslateDeep(surface);
  }

  function observeSurfaceSize() {
    if (typeof window.ResizeObserver === 'function') {
      surfaceResizeObserver = new window.ResizeObserver(scheduleViewportClamp);
      surfaceResizeObserver.observe(surface);
    }
  }

  function bindSurfaceInteractions() {
    surface.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    surface.addEventListener('pointerenter', () => {
      if (dismissTimer) {
        window.clearTimeout(dismissTimer);
        dismissTimer = null;
      }
    });
    surface.addEventListener('pointerleave', () => {
      if (currentCandidate) {
        scheduleDismiss(menu && !menu.hidden ? TOOLBAR_DISMISS_MS : ENTRY_DISMISS_MS);
      }
    });
    mainButton.addEventListener('click', () => {
      if (!currentCandidate) {
        return;
      }
      if (surface && surface.dataset.iconOnly === 'true') {
        renderMenu();
        return;
      }
      openLabsSettings();
    });
  }

  function ensureSurface() {
    if (host && host.isConnected) {
      updateRuntimeDebugState();
      return true;
    }
    if (!reconcileSurfaceOwnership()) {
      return false;
    }
    createSurfaceHost();
    shadow.appendChild(createSurfaceStyle());
    buildSurfaceTree();
    shadow.appendChild(surface);
    (document.documentElement || document.body).appendChild(host);
    observeSurfaceSize();
    bindSurfaceInteractions();
    return true;
  }

  function positionSurface(rect, placement, anchorRect) {
    if (!host || !surface || !rect) {
      return;
    }
    const isInline = placement === 'inline' && rect.inline;
    const hasPanelAnchor = placement === 'panel' && anchorRect &&
      Number.isFinite(anchorRect.left) && Number.isFinite(anchorRect.top);
    if (!hasPanelAnchor) {
      const initialViewport = getViewportBounds();
      setHostPosition(
        initialViewport.left + VIEWPORT_SAFE_MARGIN_PX,
        initialViewport.top + VIEWPORT_SAFE_MARGIN_PX
      );
    }
    window.requestAnimationFrame(() => {
      if (!host || host.hidden) {
        return;
      }
      const viewport = getViewportBounds();
      applySurfaceViewportLimit(viewport);
      const bounds = surface.getBoundingClientRect();
      const safeLeft = viewport.left + VIEWPORT_SAFE_MARGIN_PX;
      const safeTop = viewport.top + VIEWPORT_SAFE_MARGIN_PX;
      const safeRight = viewport.right - VIEWPORT_SAFE_MARGIN_PX;
      const safeBottom = viewport.bottom - VIEWPORT_SAFE_MARGIN_PX;
      const maximumLeft = safeRight - bounds.width;
      const maximumTop = safeBottom - bounds.height;
      if (hasPanelAnchor) {
        const anchorHeight = Number.isFinite(anchorRect.height) && anchorRect.height > 0
          ? anchorRect.height
          : 18;
        const anchorCenterY = anchorRect.top + anchorHeight / 2;
        const preferredLeft = anchorRect.left;
        const left = clampToSafeAxis(
          preferredLeft,
          safeLeft,
          maximumLeft
        );
        const top = clampToSafeAxis(
          anchorCenterY - bounds.height / 2,
          safeTop,
          maximumTop
        );
        setHostPosition(left, top);
        return;
      }
      if (isInline) {
        const anchor = rect.inline;
        const gap = 2;
        let left = anchor.right + gap;
        const topOffset = Math.max(4, Math.min(7, bounds.height * 0.4));
        let top = anchor.top - topOffset;
        const fitsRight = left + bounds.width <= safeRight;
        if (!fitsRight) {
          const leftCandidate = anchor.left - bounds.width - gap;
          if (leftCandidate >= safeLeft) {
            left = leftCandidate;
          } else {
            left = clampToSafeAxis(
              anchor.right - bounds.width,
              safeLeft,
              maximumLeft
            );
            top = anchor.bottom + gap;
          }
        }
        left = clampToSafeAxis(left, safeLeft, maximumLeft);
        top = clampToSafeAxis(top, safeTop, maximumTop);
        setHostPosition(left, top);
        return;
      }
      const left = clampToSafeAxis(
        rect.right - Math.min(32, bounds.width / 2),
        safeLeft,
        maximumLeft
      );
      const fitsBelow = rect.bottom + bounds.height + VIEWPORT_SAFE_MARGIN_PX <= safeBottom;
      const preferredTop = fitsBelow
        ? rect.bottom + VIEWPORT_SAFE_MARGIN_PX
        : rect.top - bounds.height - VIEWPORT_SAFE_MARGIN_PX;
      const top = clampToSafeAxis(preferredTop, safeTop, maximumTop);
      setHostPosition(left, top);
    });
  }

  function updateSelectionMark() {
    if (selectionLogo) {
      selectionLogo.src = chrome.runtime.getURL('assets/images/lumno-selection-mark.svg');
    }
    if (host) {
      host.dataset.selectionMark = 'lumno';
      updateRuntimeDebugState();
    }
  }

  function scheduleDismiss(delay) {
    if (dismissTimer) {
      window.clearTimeout(dismissTimer);
    }
    dismissTimer = window.setTimeout(() => hideSurface({ immediate: false }), delay);
  }

  function renderCandidate(candidate) {
    cancelToolbarEntranceAnimation();
    if (!ensureSurface()) {
      return;
    }
    currentCandidate = candidate;
    const action = candidate.classification.action;
    const label = getActionLabel(action);
    setHostHidden(false);
    host.dataset.iconSet = 'remix';
    const entryContrast = resolveEntryContrastTone(candidate.snapshot.element);
    host.dataset.entryContrast = entryContrast;
    setHostColorScheme(entryContrast === 'mixed' ? 'light dark' : entryContrast);
    host.dataset.visible = 'false';
    surface.dataset.iconOnly = 'true';
    delete surface.dataset.toolbarEntranceMode;
    updateSelectionMark();
    mainButton.hidden = false;
    mainButton.disabled = false;
    mainButton.dataset.iconOnly = 'true';
    mainButton.setAttribute('aria-label', getMessage('selection_quick_action_open_menu', '使用 Lumno 处理所选文字'));
    mainButton.setAttribute('aria-expanded', 'false');
    mainLabel.textContent = label;
    primaryDivider.hidden = true;
    actionsViewport.hidden = true;
    menu.hidden = true;
    menu.replaceChildren();
    positionSurface(candidate.rect, 'inline');
    const renderedCandidate = currentCandidate;
    window.requestAnimationFrame(() => {
      if (host && currentCandidate === renderedCandidate) {
        host.dataset.visible = 'true';
      }
    });
    scheduleDismiss(ENTRY_DISMISS_MS);
  }

  function buildMenuAction(action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.intent = action;
    const icon = buildActionIcon(action);
    const label = document.createElement('span');
    label.className = 'lumno-selection-action-label';
    label.textContent = getActionLabel(action);
    if (icon) {
      button.appendChild(icon);
    }
    button.appendChild(label);
    button.addEventListener('click', () => sendSelectionAction(action));
    return button;
  }

  function getToolbarActions(primary) {
    return [primary, ...TOOLBAR_FALLBACK_ACTIONS]
      .filter((action, index, actions) => ACTION_COPY[action] && actions.indexOf(action) === index)
      .slice(0, 3);
  }

  function openLabsSettings() {
    try {
      chrome.runtime.sendMessage({
        action: 'openOptionsPage',
        hash: 'labs'
      });
    } catch (e) {
      // The entry disappears even if an extension update interrupts navigation.
    }
    hideSurface();
  }

  function renderMenu() {
    if (!currentCandidate || !host) {
      return;
    }
    const originRect = surface && surface.dataset.iconOnly === 'true' && mainButton
      ? mainButton.getBoundingClientRect()
      : null;
    const primary = currentCandidate.classification.action;
    const actions = getToolbarActions(primary);
    const actionButtons = actions.map(buildMenuAction);
    surface.dataset.iconOnly = 'false';
    mainButton.hidden = false;
    mainButton.dataset.iconOnly = 'false';
    mainButton.setAttribute('aria-label', getMessage('settings_tab_labs', '实验室功能'));
    mainButton.setAttribute('aria-expanded', 'true');
    menu.replaceChildren(...actionButtons);
    applyNoTranslateDeep(menu);
    host.dataset.iconSet = 'remix';
    primaryDivider.hidden = false;
    actionsViewport.hidden = false;
    menu.hidden = false;
    positionSurface(currentCandidate.rect, 'panel', originRect);
    menu.focus({ preventScroll: true });
    animateToolbarEntrance(originRect);
    scheduleDismiss(TOOLBAR_DISMISS_MS);
  }

  function renderSendingStatus() {
    if (!host || !currentCandidate) {
      return;
    }
    cancelToolbarEntranceAnimation();
    host.dataset.visible = 'false';
    setHostHidden(true);
    showSelectionToast(
      getMessage('selection_quick_action_sending', '正在后台打开…'),
      { duration: ACTION_SUCCESS_DISMISS_MS }
    );
  }

  function renderFailureStatus() {
    if (host) {
      host.dataset.visible = 'false';
      setHostHidden(true);
    }
    showSelectionToast(
      getMessage('selection_quick_action_failed', '发送失败，请重试。'),
      { error: true, duration: ACTION_FAILURE_DISMISS_MS }
    );
    scheduleDismiss(ACTION_FAILURE_DISMISS_MS);
  }

  function sendSelectionAction(action) {
    const candidate = currentCandidate;
    if (!candidate || !isSelectionStillCurrent(candidate)) {
      hideSurface();
      return;
    }
    const sequence = ++requestSequence;
    renderSendingStatus();
    clearSelectionActionHideTimer();
    const hideTimer = window.setTimeout(() => {
      if (selectionActionHideTimer !== hideTimer) {
        return;
      }
      selectionActionHideTimer = null;
      if (sequence === requestSequence && currentCandidate === candidate) {
        hideSurface({ immediate: false });
      }
    }, ACTION_SUCCESS_DISMISS_MS);
    selectionActionHideTimer = hideTimer;
    const renderCurrentFailure = () => {
      if (sequence !== requestSequence || currentCandidate !== candidate) {
        return;
      }
      clearSelectionActionHideTimer();
      renderFailureStatus();
    };
    try {
      chrome.runtime.sendMessage({
        action: 'runSelectionQuickAction',
        intent: action,
        locale: getCurrentLocale(),
        text: candidate.classification.text
      }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          renderCurrentFailure();
          return;
        }
        if (!response || response.ok === false) {
          renderCurrentFailure();
        }
      });
    } catch (e) {
      renderCurrentFailure();
    }
  }

  function classifySelectionSnapshot(snapshot) {
    if (!snapshot || !snapshot.element || !snapshot.text) {
      return null;
    }
    return INTENT.classifySelection(snapshot.text, {
      editable: isEditableElement(snapshot.element),
      insideCode: isInsideCode(snapshot.element),
      pageLanguage: document.documentElement && document.documentElement.lang,
      sensitive: isSensitiveElement(snapshot.element),
      uiLanguage: getCurrentLocale()
    });
  }

  function buildCandidateFromSnapshot(snapshot, classification) {
    if (!snapshot || !snapshot.element || !snapshot.rect || !snapshot.text) {
      return null;
    }
    if (host && (snapshot.element === host || host.contains(snapshot.element))) {
      return null;
    }
    const resolvedClassification = classification || classifySelectionSnapshot(snapshot);
    if (!resolvedClassification || resolvedClassification.suppressed || resolvedClassification.triggerable !== true) {
      return null;
    }
    return {
      classification: resolvedClassification,
      rect: snapshot.rect,
      sourceKind: snapshot.sourceKind,
      snapshot
    };
  }

  function evaluateSelection(snapshot) {
    hideSurface();
    const resolvedSnapshot = snapshot || getUnifiedSelectionSnapshot(document.activeElement);
    const classification = classifySelectionSnapshot(resolvedSnapshot);
    if (!enabled) {
      return;
    }
    const candidate = buildCandidateFromSnapshot(resolvedSnapshot, classification);
    if (!candidate) {
      return;
    }
    const sequence = ++requestSequence;
    currentCandidate = candidate;
    showTimer = window.setTimeout(() => {
      showTimer = null;
      if (sequence !== requestSequence || !enabled || !isSelectionStillCurrent(candidate)) {
        return;
      }
      renderCandidate(candidate);
    }, ENTRY_DELAY_MS);
  }

  function resetSelectionGesture() {
    selectionGestureActive = false;
    if (gestureResetTimer) {
      window.clearTimeout(gestureResetTimer);
      gestureResetTimer = null;
    }
  }

  function scheduleSelectionGestureReset() {
    if (gestureResetTimer) {
      window.clearTimeout(gestureResetTimer);
    }
    gestureResetTimer = window.setTimeout(() => {
      gestureResetTimer = null;
      if (pointerDownState) {
        scheduleSelectionGestureReset();
        return;
      }
      selectionGestureActive = false;
    }, SELECTION_GESTURE_TIMEOUT_MS);
  }

  function armSelectionGesture() {
    selectionGestureActive = true;
    scheduleSelectionGestureReset();
  }

  function cancelSelectionGesture() {
    pointerDownState = null;
    resetSelectionGesture();
    hideSurface();
  }

  function scheduleSelectionChangeEvaluation() {
    if (!enabled || !selectionGestureActive || pointerDownState) {
      return;
    }
    if (selectionChangeTimer) {
      window.clearTimeout(selectionChangeTimer);
    }
    selectionChangeTimer = window.setTimeout(() => {
      selectionChangeTimer = null;
      if (!enabled || !selectionGestureActive || pointerDownState || currentCandidate) {
        return;
      }
      const snapshot = getUnifiedSelectionSnapshot(document.activeElement);
      if (!snapshot || !snapshot.text) {
        return;
      }
      evaluateSelection(snapshot);
    }, SELECTION_CHANGE_DELAY_MS);
  }

  function handlePointerUp(event) {
    const pointerDown = pointerDownState;
    pointerDownState = null;
    if (event.button !== 0 || !enabled ||
        event.isPrimary === false ||
        !pointerDown ||
        (pointerDown.pointerId != null && event.pointerId != null && pointerDown.pointerId !== event.pointerId) ||
        (host && event.composedPath && event.composedPath().includes(host))) {
      return;
    }
    armSelectionGesture();
    const snapshot = getUnifiedSelectionSnapshot(event.target, event);
    const selectionChanged = !isSameSelection(pointerDown.selection, snapshot);
    const isMultiClick = Number(event.detail) >= 2;
    if (!snapshot || !snapshot.text) {
      scheduleSelectionChangeEvaluation();
      return;
    }
    if (!selectionChanged && !isMultiClick) {
      return;
    }
    evaluateSelection(snapshot);
  }

  function handlePointerDown(event) {
    pointerDownState = null;
    if (event.button !== 0 || !enabled ||
        event.isPrimary === false ||
        (host && event.composedPath && event.composedPath().includes(host))) {
      return;
    }
    pointerDownState = {
      pointerId: event.pointerId,
      selection: getUnifiedSelectionSnapshot(event.target, event)
    };
    hideSurface();
    armSelectionGesture();
  }

  function handleSelectionChange() {
    const snapshot = getUnifiedSelectionSnapshot(document.activeElement);
    if (currentCandidate && snapshot && !isSameSelection(currentCandidate.snapshot, snapshot)) {
      hideSurface();
    }
    if (!snapshot || !snapshot.text || !enabled ||
        !selectionGestureActive || pointerDownState || currentCandidate) {
      return;
    }
    scheduleSelectionChangeEvaluation();
  }

  function handlePointerCancel() {
    const pointerDown = pointerDownState;
    pointerDownState = null;
    const snapshot = getUnifiedSelectionSnapshot(document.activeElement);
    if (enabled && selectionGestureActive && snapshot && snapshot.text &&
        (!pointerDown || !isSameSelection(pointerDown.selection, snapshot))) {
      scheduleSelectionChangeEvaluation();
    }
  }

  function handleSelectStart(event) {
    if (!enabled ||
        (host && event.composedPath && event.composedPath().includes(host))) {
      return;
    }
    armSelectionGesture();
  }

  function handleWindowBlur(event) {
    if (event && event.target !== window) {
      return;
    }
    cancelSelectionGesture();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      cancelSelectionGesture();
      return;
    }
    if (event.shiftKey || ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'a')) {
      armSelectionGesture();
    }
  }

  // Page listeners exist only while the feature is enabled, so a disabled
  // feature costs nothing on selectionchange, scroll, resize and the rest.
  // The storage listener below stays attached so the feature can turn back on.
  function getPageListeners() {
    const listeners = [
      [document, 'pointerup', handlePointerUp, true],
      [document, 'pointerdown', handlePointerDown, true],
      [document, 'pointercancel', handlePointerCancel, true],
      [document, 'selectstart', handleSelectStart, true],
      [document, 'selectionchange', handleSelectionChange, true],
      [document, 'copy', cancelSelectionGesture, true],
      [document, 'scroll', cancelSelectionGesture, true],
      [document, 'keydown', handleKeyDown, true],
      [window, 'blur', handleWindowBlur, true],
      [window, 'resize', scheduleViewportClamp, true],
      [window, 'orientationchange', scheduleViewportClamp, true]
    ];
    if (window.visualViewport) {
      listeners.push(
        [window.visualViewport, 'resize', scheduleViewportClamp, false],
        [window.visualViewport, 'scroll', scheduleViewportClamp, false]
      );
    }
    return listeners;
  }

  function setPageListenersActive(active) {
    if (active && !attachedPageListeners) {
      attachedPageListeners = getPageListeners();
      attachedPageListeners.forEach(([target, type, listener, capture]) => {
        target.addEventListener(type, listener, capture);
      });
    } else if (!active && attachedPageListeners) {
      attachedPageListeners.forEach(([target, type, listener, capture]) => {
        target.removeEventListener(type, listener, capture);
      });
      attachedPageListeners = null;
    }
  }

  function setFeatureActive(active) {
    setPageListenersActive(active);
    setOwnershipMonitoring(active);
  }

  function hydrateSettings() {
    storageArea.get([
      ENABLED_STORAGE_KEY,
      LANGUAGE_STORAGE_KEY
    ], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        return;
      }
      enabled = Boolean(result && result[ENABLED_STORAGE_KEY] === true);
      languageMode = result && result[LANGUAGE_STORAGE_KEY]
        ? String(result[LANGUAGE_STORAGE_KEY])
        : 'system';
      refreshLocaleMessages();
      if (!enabled) {
        cancelSelectionGesture();
        clearOwnedSurface();
      }
      setFeatureActive(enabled);
      if (currentCandidate && host && !host.hidden) {
        updateSelectionMark();
      } else {
        updateRuntimeDebugState();
      }
    });
  }

  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (!providerStorageRuntime.isActiveAreaName(areaName)) {
        return;
      }
      if (changes[ENABLED_STORAGE_KEY]) {
        enabled = changes[ENABLED_STORAGE_KEY].newValue === true;
        setFeatureActive(enabled);
        if (!enabled) {
          cancelSelectionGesture();
          clearOwnedSurface();
        }
      }
      if (changes[LANGUAGE_STORAGE_KEY]) {
        hydrateSettings();
      }
    });
  }

  hydrateSettings();
})();
