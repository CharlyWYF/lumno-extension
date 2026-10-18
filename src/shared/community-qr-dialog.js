(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoCommunityQrDialog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  // The WeChat group QR, shown in a dialog over the current page instead of
  // opening the image in a new tab. It renders in its own shadow root so a
  // web page's CSS cannot reach it, and it never changes the page's overflow:
  // the page keeps its scrollbar, so nothing behind the dialog shifts sideways.
  // Wheel and touch scrolling are swallowed by the backdrop instead.
  const HOST_ID = '_x_extension_community_qr_dialog_2026_unique_';
  const CLOSE_ICON_PATH = 'M10.5859 12L2.79297 4.20706L4.20718 2.79285L12.0001 10.5857L19.793 2.79285L21.2072 4.20706L13.4143 12L21.2072 19.7928L19.793 21.2071L12.0001 13.4142L4.20718 21.2071L2.79297 19.7928L10.5859 12Z';
  const EXIT_DURATION_MS = 170;

  const STYLES = `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: block;
      color-scheme: light;
      font-family: "Lumno Open Sans", "Open Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    :host([data-theme="dark"]) {
      color-scheme: dark;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      background: rgba(15, 23, 42, 0.18);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      overscroll-behavior: contain;
      opacity: 0;
      transition: opacity 170ms ease;
    }
    :host([data-theme="dark"]) .backdrop {
      background: rgba(0, 0, 0, 0.42);
    }
    .card {
      --inset: 10px;
      --radius: 16px;
      width: min(300px, 100%);
      max-height: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: var(--inset);
      border-radius: var(--radius);
      box-sizing: border-box;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow:
        0 18px 34px rgba(15, 23, 42, 0.14),
        0 2px 4px rgba(15, 23, 42, 0.05);
      color: #212733;
      outline: none;
      transform: scale(0.97);
      transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    :host([data-theme="dark"]) .card {
      background: #27272a;
      border-color: rgba(255, 255, 255, 0.14);
      box-shadow:
        0 18px 34px rgba(0, 0, 0, 0.32),
        0 2px 4px rgba(0, 0, 0, 0.16);
      color: #f4f4f5;
    }
    :host([data-open="true"]) .backdrop {
      opacity: 1;
    }
    :host([data-open="true"]) .card {
      transform: scale(1);
    }
    .header {
      min-height: 30px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding-left: 4px;
    }
    .title {
      flex: 1 1 auto;
      min-width: 0;
      margin: 0;
      font-size: 16px;
      line-height: 1.25;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .close {
      all: unset;
      flex: 0 0 auto;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #606976;
      cursor: pointer;
      transition: color 120ms ease, background 120ms ease, transform 120ms ease;
    }
    .close svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
    .close:hover {
      color: #212733;
      background: rgba(15, 23, 42, 0.07);
    }
    .close:active {
      background: rgba(15, 23, 42, 0.12);
      transform: scale(0.94);
    }
    .close:focus-visible {
      outline: 2px solid rgba(75, 84, 95, 0.35);
      outline-offset: 1px;
    }
    :host([data-theme="dark"]) .close {
      color: #a1a1aa;
    }
    :host([data-theme="dark"]) .close:hover {
      color: #f4f4f5;
      background: rgba(255, 255, 255, 0.1);
    }
    :host([data-theme="dark"]) .close:active {
      background: rgba(255, 255, 255, 0.16);
    }
    .qr {
      display: block;
      flex: 0 1 auto;
      width: 100%;
      min-height: 0;
      height: auto;
      aspect-ratio: 1080 / 1596;
      object-fit: contain;
      /* Concentric with the card: its radius minus the inset around the image. */
      border-radius: calc(var(--radius) - var(--inset));
      background: #f2f4f8;
    }
    :host([data-theme="dark"]) .qr {
      background: #18181b;
    }
    /* Glass (the New Tab's material, read from the host's custom properties). The backdrop keeps
       full opacity and no filter, either of which would stop the card's glass at the dim instead of
       the page: the dim fades on a layer of its own behind the card, and the card fades itself. */
    :host([data-glass]) .backdrop {
      background: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      opacity: 1;
    }
    :host([data-glass]) .backdrop::before {
      content: "";
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.18);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 170ms ease;
    }
    :host([data-glass][data-theme="dark"]) .backdrop::before {
      background: rgba(0, 0, 0, 0.3);
    }
    :host([data-glass][data-open="true"]) .backdrop::before {
      opacity: 1;
    }
    :host([data-glass]) .card {
      position: relative;
      background: rgb(var(--x-nt-glass-float-rgb) / var(--x-nt-glass-modal-alpha));
      border-color: transparent;
      box-shadow: var(--x-nt-glass-edge), var(--x-nt-glass-float-shadow);
      backdrop-filter: var(--x-nt-glass-modal-filter);
      -webkit-backdrop-filter: var(--x-nt-glass-modal-filter);
      color: var(--x-nt-text);
      opacity: 0;
      transition: opacity 170ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    :host([data-glass][data-open="true"]) .card {
      opacity: 1;
    }
    :host([data-glass]) .close {
      color: var(--x-nt-glass-ink-secondary);
    }
    :host([data-glass]) .close:hover {
      color: var(--x-nt-text);
      background: var(--x-nt-glass-chip);
    }
    :host([data-glass]) .close:active {
      background: var(--x-nt-glass-chip-strong);
    }
    :host([data-glass]) .qr {
      background: var(--x-nt-glass-chip);
    }
    @media (prefers-reduced-motion: reduce) {
      .backdrop,
      .backdrop::before,
      .card {
        transition: none;
      }
      .card {
        transform: none;
      }
    }
  `;

  let active = null;

  function close() {
    if (active) {
      active.close();
    }
  }

  function isOpen() {
    return Boolean(active);
  }

  /**
   * Opens the dialog. options: { imageUrl, title, alt, closeLabel, theme
   * ('light' | 'dark'), documentObj, returnFocus (element focused on close),
   * glass (draw the card in the page's glass material; the dialog then opens in
   * the body, where the page sets the material's custom properties) }.
   */
  function open(options) {
    const config = options && typeof options === 'object' ? options : {};
    const documentObj = config.documentObj || root.document;
    const imageUrl = String(config.imageUrl || '').trim();
    if (!documentObj || !documentObj.documentElement || !imageUrl) {
      return null;
    }
    close();
    const windowObj = documentObj.defaultView || root;
    const returnFocus = config.returnFocus || null;

    const host = documentObj.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-theme', config.theme === 'dark' ? 'dark' : 'light');
    host.setAttribute('data-open', 'false');
    if (config.glass === true) {
      host.setAttribute('data-glass', '');
    }
    const shadow = host.attachShadow({ mode: 'open' });

    const style = documentObj.createElement('style');
    style.textContent = STYLES;

    const backdrop = documentObj.createElement('div');
    backdrop.className = 'backdrop';

    const card = documentObj.createElement('div');
    card.className = 'card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.tabIndex = -1;

    const header = documentObj.createElement('div');
    header.className = 'header';
    const title = documentObj.createElement('h2');
    title.className = 'title';
    title.id = 'title';
    title.textContent = String(config.title || '');
    card.setAttribute('aria-labelledby', 'title');

    const closeButton = documentObj.createElement('button');
    closeButton.className = 'close';
    closeButton.type = 'button';
    const closeLabel = String(config.closeLabel || 'Close');
    closeButton.setAttribute('aria-label', closeLabel);
    closeButton.title = closeLabel;
    closeButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${CLOSE_ICON_PATH}"></path></svg>`;

    const image = documentObj.createElement('img');
    image.className = 'qr';
    image.alt = String(config.alt || '');
    image.width = 1080;
    image.height = 1596;
    image.decoding = 'async';
    image.src = imageUrl;

    header.append(title, closeButton);
    card.append(header, image);
    backdrop.appendChild(card);
    shadow.append(style, backdrop);

    let closed = false;

    function swallowScroll(event) {
      event.preventDefault();
    }

    function onKeyDown(event) {
      // Keys typed in the dialog stay in it, so page shortcuts and the
      // search box behind it don't react while it is open.
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        controller.close();
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        closeButton.focus();
      }
    }

    function stopPropagation(event) {
      event.stopPropagation();
    }

    const controller = {
      element: host,
      close() {
        if (closed) {
          return;
        }
        closed = true;
        if (active === controller) {
          active = null;
        }
        host.setAttribute('data-open', 'false');
        const reduceMotion = windowObj.matchMedia &&
          windowObj.matchMedia('(prefers-reduced-motion: reduce)').matches;
        windowObj.setTimeout(() => {
          host.remove();
        }, reduceMotion ? 0 : EXIT_DURATION_MS);
        if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
          returnFocus.focus({ preventScroll: true });
        }
      }
    };

    backdrop.addEventListener('wheel', swallowScroll, { passive: false });
    backdrop.addEventListener('touchmove', swallowScroll, { passive: false });
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        controller.close();
      }
    });
    closeButton.addEventListener('click', () => controller.close());
    host.addEventListener('keydown', onKeyDown);
    ['keyup', 'keypress', 'pointerdown', 'mousedown', 'click'].forEach((type) => {
      host.addEventListener(type, stopPropagation);
    });

    (config.glass === true && documentObj.body ? documentObj.body : documentObj.documentElement).appendChild(host);
    active = controller;
    closeButton.focus({ preventScroll: true });
    // Lay out the closed state first so the enter transition runs.
    void card.offsetWidth;
    host.setAttribute('data-open', 'true');
    return controller;
  }

  return Object.freeze({ HOST_ID, open, close, isOpen });
});
