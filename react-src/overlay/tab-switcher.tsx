import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { CSSProperties } from 'react';

export type TabSwitcherCloseButtonPlacement = 'left' | 'right';

export interface TabSwitcherTab {
  id: number;
  windowId?: number | null;
  title?: string;
  url?: string;
  favIconUrl?: string;
  thumbnail?: string;
  thumbnailStatus?: string;
  thumbnailReason?: string;
  accentRgb?: unknown;
  [key: string]: unknown;
}

export interface TabSwitcherThumbnailUpdate {
  tabId?: number;
  url?: string;
  thumbnail?: string;
  thumbnailStatus?: string;
  thumbnailReason?: string;
}

export interface TabSwitcherViewOptions {
  document?: Document;
  root?: Element | ShadowRoot | null;
  panelId?: string;
  tabs?: TabSwitcherTab[];
  selectedIndex?: number;
  ariaLabel?: string;
  closeButtonPlacement?: TabSwitcherCloseButtonPlacement;
  sanitizeText?: (value: unknown, fallback?: string) => string;
  getHostLabel?: (url: string) => string;
  getMessage?: (key: string, fallback: string) => string;
  normalizeAccentCss?: (accent: unknown) => string;
  getThumbnailStatus?: (
    tab: TabSwitcherTab,
    thumbnail: string
  ) => string;
  onSelect?: (index: number) => void;
  onActivate?: (index: number, event: MouseEvent) => void;
  onClose?: (index: number, event: MouseEvent) => void;
}

export interface TabSwitcherToastOptions {
  error?: boolean;
  duration?: number;
}

export interface TabSwitcherViewController {
  panel: HTMLElement | null;
  buttons: HTMLButtonElement[];
  updateSelection(index: number): void;
  setTabClosing(tabId: number, closing: boolean): void;
  removeTab(tabId: number): boolean;
  showToast(message: string, options?: TabSwitcherToastOptions): void;
  updateThumbnail(
    update: TabSwitcherThumbnailUpdate
  ): { ok: boolean; reason?: string };
  destroy(): void;
}

interface InternalTab extends TabSwitcherTab {
  _previousThumbnail?: string;
  _thumbnailEntering?: boolean;
  _closing?: boolean;
}

interface ToastState {
  text: string;
  tone: '' | 'error';
  visible: boolean;
}

interface NormalizedOptions {
  document: Document;
  root: Element | ShadowRoot;
  panelId: string;
  ariaLabel: string;
  closeButtonPlacement: TabSwitcherCloseButtonPlacement;
  sanitizeText: NonNullable<TabSwitcherViewOptions['sanitizeText']>;
  getHostLabel: NonNullable<TabSwitcherViewOptions['getHostLabel']>;
  getMessage: NonNullable<TabSwitcherViewOptions['getMessage']>;
  normalizeAccentCss: NonNullable<
    TabSwitcherViewOptions['normalizeAccentCss']
  >;
  getThumbnailStatus: NonNullable<
    TabSwitcherViewOptions['getThumbnailStatus']
  >;
  onSelect: NonNullable<TabSwitcherViewOptions['onSelect']>;
  onActivate: NonNullable<TabSwitcherViewOptions['onActivate']>;
  onClose: NonNullable<TabSwitcherViewOptions['onClose']>;
}

function normalizeOptions(
  raw: TabSwitcherViewOptions
): NormalizedOptions | null {
  const documentRef = raw.document || globalThis.document;
  if (!documentRef || !raw.root) {
    return null;
  }
  return {
    document: documentRef,
    root: raw.root,
    panelId:
      raw.panelId ||
      '_x_extension_tab_switcher_panel_2026_unique_',
    ariaLabel: raw.ariaLabel || 'Recent tabs',
    closeButtonPlacement:
      raw.closeButtonPlacement === 'right' ? 'right' : 'left',
    sanitizeText:
      raw.sanitizeText ||
      ((value, fallback = '') => {
        const text = String(value || '')
          .replace(/\s+/g, ' ')
          .trim();
        return text || fallback;
      }),
    getHostLabel:
      raw.getHostLabel ||
      ((url) => {
        try {
          return new URL(url).hostname.replace(/^www\./i, '');
        } catch {
          return '';
        }
      }),
    getMessage: raw.getMessage || ((_key, fallback) => fallback),
    normalizeAccentCss: raw.normalizeAccentCss || (() => ''),
    getThumbnailStatus:
      raw.getThumbnailStatus ||
      ((_tab, thumbnail) =>
        thumbnail.startsWith('data:image/') ? 'ok' : 'missing'),
    onSelect: raw.onSelect || (() => {}),
    onActivate: raw.onActivate || (() => {}),
    onClose: raw.onClose || (() => {})
  };
}

function isImageDataUrl(value: unknown): boolean {
  return String(value || '').startsWith('data:image/');
}

function PreparedImage({
  className,
  src,
  alt,
  kind,
  entering,
  exiting
}: {
  className?: string;
  src: string;
  alt: string;
  kind?: string;
  entering?: boolean;
  exiting?: boolean;
}) {
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      decoding="async"
      loading="eager"
      referrerPolicy="no-referrer"
      data-kind={kind}
      data-entering={entering ? 'true' : undefined}
      data-exiting={exiting ? 'true' : undefined}
      onError={(event) => {
        event.currentTarget.setAttribute('data-broken', 'true');
        event.currentTarget.removeAttribute('src');
      }}
    />
  );
}

function TitleFavicon({
  src
}: {
  src: string;
}) {
  if (!src) {
    return <span className="x-tab-switcher-title-favicon" />;
  }
  return (
    <PreparedImage
      className="x-tab-switcher-title-favicon"
      src={src}
      alt=""
    />
  );
}

function TabCard({
  options,
  tab,
  index,
  active
}: {
  options: NormalizedOptions;
  tab: InternalTab;
  index: number;
  active: boolean;
}) {
  const title = options.sanitizeText(
    tab.title,
    options.getMessage('tab_switcher_untitled', 'Untitled')
  );
  const url = String(tab.url || '');
  const favicon = String(tab.favIconUrl || '');
  const thumbnail = String(tab.thumbnail || '');
  const previousThumbnail = String(tab._previousThumbnail || '');
  const thumbnailStatus = options.getThumbnailStatus(
    tab,
    thumbnail
  );
  const accent = options.normalizeAccentCss(tab.accentRgb);
  const style = accent
    ? ({
        '--x-tab-switcher-card-accent': accent
      } as CSSProperties)
    : undefined;

  const closeLabel = options.getMessage(
    'tab_switcher_close_tab',
    'Close tab'
  );

  return (
    <div
      className="x-tab-switcher-item"
      data-closing={tab._closing ? 'true' : undefined}
    >
      <button
        type="button"
        role="option"
        className="x-tab-switcher-card"
        data-tab-id={String(tab.id)}
        data-thumbnail-status={thumbnailStatus}
        data-active={active ? 'true' : 'false'}
        aria-selected={active}
        aria-label={title}
        tabIndex={active ? 0 : -1}
        style={style}
        onPointerEnter={() => options.onSelect(index)}
        onFocus={() => options.onSelect(index)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          options.onActivate(index, event.nativeEvent);
        }}
      >
        <div
          className="x-tab-switcher-thumb"
          data-tab-id={String(tab.id)}
          data-thumbnail-status={thumbnailStatus}
          data-thumbnail-reason={
            tab.thumbnailReason
              ? options.sanitizeText(tab.thumbnailReason)
              : undefined
          }
        >
          {isImageDataUrl(previousThumbnail) && (
            <PreparedImage
              src={previousThumbnail}
              alt=""
              kind="thumbnail"
              exiting
            />
          )}
          {isImageDataUrl(thumbnail) ? (
            <PreparedImage
              src={thumbnail}
              alt=""
              kind="thumbnail"
              entering={Boolean(tab._thumbnailEntering)}
            />
          ) : (
            <div className="x-tab-switcher-fallback">
              {favicon && (
                <PreparedImage
                  className="x-tab-switcher-favicon"
                  src={favicon}
                  alt={options.getMessage(
                    'tab_switcher_favicon_alt',
                    'Site icon'
                  )}
                />
              )}
            </div>
          )}
        </div>
        <div className="x-tab-switcher-meta">
          <div className="x-tab-switcher-name-row">
            <TitleFavicon src={favicon} />
            <div className="x-tab-switcher-name" title={title}>
              {title}
            </div>
          </div>
          <div className="x-tab-switcher-host">
            {options.getHostLabel(url) || url}
          </div>
        </div>
      </button>
      <button
        type="button"
        className="x-tab-switcher-close"
        aria-label={closeLabel}
        title={closeLabel}
        tabIndex={-1}
        disabled={Boolean(tab._closing)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          options.onClose(index, event.nativeEvent);
        }}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  );
}

function TabSwitcherToast({ toast }: { toast: ToastState }) {
  return (
    <div
      className="x-tab-switcher-toast"
      role="status"
      aria-live="polite"
      data-show={toast.visible ? 'true' : 'false'}
      data-tone={toast.tone || undefined}
    >
      {toast.text}
    </div>
  );
}

function TabSwitcherView({
  options,
  tabs,
  selectedIndex,
  toast,
  panelRef
}: {
  options: NormalizedOptions;
  tabs: InternalTab[];
  selectedIndex: number;
  toast: ToastState;
  panelRef: (node: HTMLElement | null) => void;
}) {
  return (
    <div
      ref={panelRef}
      id={options.panelId}
      role="listbox"
      aria-label={options.ariaLabel}
      data-visible="true"
      data-close-placement={options.closeButtonPlacement}
      data-react-island="overlay-tab-switcher"
      style={{
        '--x-tab-count': String(
          Math.max(1, Math.min(5, tabs.length))
        )
      } as CSSProperties}
    >
      <div className="x-tab-switcher-list">
        {tabs.map((tab, index) => (
          <TabCard
            key={tab.id}
            options={options}
            tab={tab}
            index={index}
            active={index === selectedIndex}
          />
        ))}
      </div>
      <TabSwitcherToast toast={toast} />
    </div>
  );
}

function createNoopController(): TabSwitcherViewController {
  return {
    panel: null,
    buttons: [],
    updateSelection() {},
    setTabClosing() {},
    removeTab() {
      return false;
    },
    showToast() {},
    updateThumbnail() {
      return { ok: false, reason: 'react-view-unavailable' };
    },
    destroy() {}
  };
}

export function createTabSwitcherView(
  rawOptions: TabSwitcherViewOptions = {}
): TabSwitcherViewController {
  const normalizedOptions = normalizeOptions(rawOptions);
  if (!normalizedOptions) {
    return createNoopController();
  }
  const options: NormalizedOptions = normalizedOptions;
  const mount = options.document.createElement('div');
  mount.setAttribute(
    'data-react-island-owner',
    'overlay-tab-switcher'
  );
  options.root.appendChild(mount);
  const root: Root = createRoot(mount);
  let tabs: InternalTab[] = (
    Array.isArray(rawOptions.tabs) ? rawOptions.tabs : []
  )
    .filter((tab) => tab && Number.isInteger(tab.id))
    .slice(0, 5)
    .map((tab) => ({ ...tab }));
  let selectedIndex = Number(rawOptions.selectedIndex) || 0;
  let panel: HTMLElement | null = null;
  let destroyed = false;
  let toast: ToastState = { text: '', tone: '', visible: false };
  let toastTimer = 0;
  const timers = new Set<number>();

  const controller: TabSwitcherViewController = {
    get panel() {
      return panel;
    },
    get buttons() {
      return panel
        ? Array.from(
            panel.querySelectorAll<HTMLButtonElement>(
              '.x-tab-switcher-card'
            )
          )
        : [];
    },
    updateSelection(index) {
      selectedIndex = Number(index) || 0;
      render();
    },
    setTabClosing(tabId, closing) {
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (index < 0 || Boolean(tabs[index]._closing) === closing) {
        return;
      }
      tabs[index] = { ...tabs[index], _closing: closing };
      render();
    },
    removeTab(tabId) {
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (index < 0) {
        return false;
      }
      tabs = tabs.filter((tab) => tab.id !== tabId);
      render();
      return true;
    },
    showToast(message, toastOptions = {}) {
      const text = String(message || '');
      if (!text) {
        return;
      }
      if (toastTimer) {
        window.clearTimeout(toastTimer);
        timers.delete(toastTimer);
      }
      toast = {
        text,
        tone: toastOptions.error ? 'error' : '',
        visible: true
      };
      render();
      const duration = Number.isFinite(Number(toastOptions.duration))
        ? Math.max(0, Number(toastOptions.duration))
        : 1800;
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        toastTimer = 0;
        toast = { ...toast, visible: false };
        render();
      }, duration);
      toastTimer = timer;
      timers.add(timer);
    },
    updateThumbnail(update) {
      const tabId = Number(update && update.tabId);
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (!Number.isInteger(tabId) || index < 0) {
        return { ok: false, reason: 'tab-not-visible' };
      }
      const thumbnail = String(update.thumbnail || '');
      if (!isImageDataUrl(thumbnail)) {
        return { ok: false, reason: 'invalid-thumbnail' };
      }
      const tab = tabs[index];
      const updateUrl = String(update.url || '');
      if (updateUrl && tab.url && updateUrl !== tab.url) {
        return { ok: false, reason: 'tab-url-mismatch' };
      }
      if (tab.thumbnail === thumbnail) {
        return { ok: true };
      }
      tabs[index] = {
        ...tab,
        _previousThumbnail: isImageDataUrl(tab.thumbnail)
          ? String(tab.thumbnail)
          : '',
        _thumbnailEntering: true,
        thumbnail,
        thumbnailStatus: update.thumbnailStatus || 'ok',
        thumbnailReason: update.thumbnailReason || ''
      };
      render();
      const windowRef = options.document.defaultView;
      const requestFrame =
        windowRef?.requestAnimationFrame?.bind(windowRef) ||
        ((callback: FrameRequestCallback) =>
          window.setTimeout(() => callback(Date.now()), 0));
      requestFrame(() => {
        if (destroyed || !tabs[index] || tabs[index].id !== tabId) {
          return;
        }
        tabs[index] = {
          ...tabs[index],
          _thumbnailEntering: false
        };
        render();
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          if (
            destroyed ||
            !tabs[index] ||
            tabs[index].id !== tabId
          ) {
            return;
          }
          tabs[index] = {
            ...tabs[index],
            _previousThumbnail: ''
          };
          render();
        }, 260);
        timers.add(timer);
      });
      return { ok: true };
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      root.unmount();
      mount.remove();
      panel = null;
    }
  };

  function render(): void {
    if (destroyed) {
      return;
    }
    flushSync(() => {
      root.render(
        <TabSwitcherView
          options={options}
          tabs={tabs}
          selectedIndex={selectedIndex}
          toast={toast}
          panelRef={(node) => {
            panel = node;
          }}
        />
      );
    });
  }

  render();
  return controller;
}

export function createTabSwitcherViewApi() {
  return Object.freeze({
    implementation: 'react' as const,
    createTabSwitcherView
  });
}
