import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import optionsHtml from '../../src/options/options.html?raw';
import optionsSource from '../../src/options/options.js?raw';
import panelMotionSource from '../../src/options/options-panel-motion.js?raw';
import themeSource from '../../src/options/options-theme.js?raw';
import settingBindingsSource from '../../src/options/options-setting-bindings.js?raw';
import toggleSettingsSource from '../../src/options/options-toggle-settings.js?raw';
import siteSearchSource from '../../src/options/options-site-search.js?raw';
import aggregateSearchSource from '../../src/options/options-aggregate-search.js?raw';
import syncTransferSource from '../../src/options/options-sync-transfer.js?raw';
import syncSectionSource from '../../src/options/options-sync-section.js?raw';
import shortcutKeysSource from '../../src/options/options-shortcut-keys.js?raw';
import fallbackShortcutSource from '../../src/options/options-fallback-shortcut.js?raw';
import blacklistSource from '../../src/options/options-blacklist.js?raw';
import feedbackSupportSource from '../../src/options/options-feedback-support.js?raw';
import webdavOptionsSource from '../../src/options/webdav-options.js?raw';
import settingsSource from '../../src/shared/settings.js?raw';
import blacklistUtilsSource from '../../src/shared/blacklist-utils.js?raw';
import navigationDispositionSource from '../../src/shared/navigation-disposition.js?raw';
import communityLinksSource from '../../src/shared/community-links.js?raw';
import searchUtilsSource from '../../src/shared/search-utils.js?raw';
import aggregateSearchStoreSource from '../../src/shared/aggregate-search-store.js?raw';
import faviconUtilsSource from '../../src/shared/favicon-utils.js?raw';
import shortcutFaviconSource from '../../src/shared/shortcut-favicon.js?raw';
import bookmarkFolderReferenceSource from '../../src/shared/bookmark-folder-reference.js?raw';
import shortcutsStoreSource from '../../src/newtab/shortcuts-store.js?raw';
import tooltipSource from '../../src/shared/tooltip.js?raw';
import cursorTooltipSource from '../../src/shared/cursor-tooltip.js?raw';
import menuSurfaceSource from '../../src/shared/menu-surface.js?raw';
import shortcutDisplaySource from '../../src/shared/shortcut-display.js?raw';
import browserProfileSource from '../../src/shared/browser-profile.js?raw';
import shortcutReferenceSource from '../../src/shared/shortcut-reference.js?raw';
import siteSearchCatalog from '../../assets/data/site-search.json';
import enMessages from '../../_locales/en/messages.json';
import jaMessages from '../../_locales/ja/messages.json';
import zhCnMessages from '../../_locales/zh_CN/messages.json';
import zhTwMessages from '../../_locales/zh_TW/messages.json';

// Boots the real Options page (markup, shared scripts, React islands and
// options.js) against an in-memory chrome.storage, so the page's storage
// wiring can be checked by what it shows and writes.

type StorageValues = Record<string, unknown>;
type Messages = Record<string, { message: string }>;
const LOCALE_MESSAGES: Record<string, Messages> = {
  en: enMessages as Messages,
  ja: jaMessages as Messages,
  zh_CN: zhCnMessages as Messages,
  zh_TW: zhTwMessages as Messages
};
type ChangeListener = (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => void;


const PAGE_SCRIPTS = [
  settingsSource,
  blacklistUtilsSource,
  navigationDispositionSource,
  communityLinksSource,
  searchUtilsSource,
  aggregateSearchStoreSource,
  faviconUtilsSource,
  shortcutFaviconSource,
  bookmarkFolderReferenceSource,
  shortcutsStoreSource,
  tooltipSource,
  cursorTooltipSource,
  menuSurfaceSource,
  shortcutDisplaySource,
  browserProfileSource,
  shortcutReferenceSource,
  webdavOptionsSource,
  panelMotionSource,
  themeSource,
  settingBindingsSource,
  toggleSettingsSource,
  siteSearchSource,
  aggregateSearchSource,
  syncTransferSource,
  syncSectionSource,
  shortcutKeysSource,
  fallbackShortcutSource,
  blacklistSource,
  feedbackSupportSource
];

const addedListeners: Array<[EventTarget, string, EventListenerOrEventListenerObject, unknown]> = [];

function runClassicScript(source: string): void {
  new Function('module', source)(undefined);
}

runClassicScript(settingsSource);
const SETTINGS = (globalThis as unknown as { LumnoSettings: Record<string, string> }).LumnoSettings;

function trackListeners(target: Document | Window): void {
  const addEventListener = target.addEventListener.bind(target);
  vi.spyOn(target as EventTarget, 'addEventListener').mockImplementation((type, listener, options) => {
    if (listener) {
      addedListeners.push([target, type, listener, options]);
      addEventListener(type, listener, options as AddEventListenerOptions);
    }
  });
}

function createArea(name: string, values: StorageValues, listeners: Set<ChangeListener>) {
  const writes: StorageValues[] = [];
  const pick = (keys: unknown) => {
    if (keys === null || keys === undefined) return { ...values };
    const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys as object);
    return Object.fromEntries(list.filter((key) => key in values).map((key) => [key, values[key]]));
  };
  const emit = (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => {
    if (Object.keys(changes).length) {
      listeners.forEach((listener) => listener(changes, name));
    }
  };
  return {
    values,
    writes,
    get(keys: unknown, callback?: (result: StorageValues) => void) {
      const result = pick(keys);
      if (callback) {
        queueMicrotask(() => callback(result));
        return undefined;
      }
      return Promise.resolve(result);
    },
    set(payload: StorageValues, callback?: () => void) {
      writes.push({ ...payload });
      const changes: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
      Object.entries(payload).forEach(([key, value]) => {
        changes[key] = { newValue: value, oldValue: values[key] };
        values[key] = value;
      });
      queueMicrotask(() => {
        if (callback) callback();
        emit(changes);
      });
      return callback ? undefined : Promise.resolve();
    },
    remove(keys: string | string[], callback?: () => void) {
      const changes: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        if (key in values) {
          changes[key] = { oldValue: values[key] };
          delete values[key];
        }
      });
      queueMicrotask(() => {
        if (callback) callback();
        emit(changes);
      });
      return callback ? undefined : Promise.resolve();
    },
    // A change made by another page.
    externalSet(payload: StorageValues) {
      const changes: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
      Object.entries(payload).forEach(([key, value]) => {
        changes[key] = { newValue: value, oldValue: values[key] };
        values[key] = value;
      });
      emit(changes);
    }
  };
}

function createChromeStub(sync: StorageValues, local: StorageValues) {
  const listeners = new Set<ChangeListener>();
  const messages = enMessages as Record<string, { message: string }>;
  return {
    commands: { getAll: (callback: (commands: object[]) => void) => callback([]) },
    i18n: {
      getMessage: (key: string) => (messages[key] ? messages[key].message : ''),
      getUILanguage: () => 'en'
    },
    runtime: {
      getManifest: () => ({ version: '1.0.0' }),
      getURL: (path: string) => `chrome-extension://lumno/${path}`,
      id: 'lumno',
      lastError: null,
      onMessage: { addListener() {} },
      sendMessage: vi.fn((_message: unknown, callback?: (response: unknown) => void) => {
        if (callback) callback({ ok: true });
      })
    },
    storage: {
      local: createArea('local', local, listeners),
      onChanged: {
        addListener: (listener: ChangeListener) => listeners.add(listener),
        removeListener: (listener: ChangeListener) => listeners.delete(listener)
      },
      sync: createArea('sync', sync, listeners)
    }
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let pass = 0; pass < 6; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

async function bootOptionsPage(
  sync: StorageValues = {},
  local: StorageValues = {},
  chromeStub?: ReturnType<typeof createChromeStub>
) {
  const parsed = new DOMParser().parseFromString(optionsHtml, 'text/html');
  Array.from(parsed.body.children)
    .filter((node) => node.tagName !== 'SCRIPT')
    .forEach((node) => document.body.appendChild(document.importNode(node, true)));
  const chrome = chromeStub || createChromeStub(sync, local);
  vi.stubGlobal('chrome', chrome);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {}
  }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const locale = /_locales\/([^/]+)\/messages\.json/.exec(String(url));
    const body = locale ? LOCALE_MESSAGES[locale[1]] || enMessages : siteSearchCatalog;
    return { ok: true, json: async () => body };
  }));
  PAGE_SCRIPTS.forEach(runClassicScript);
  vi.resetModules();
  await import('./options-islands-entry');
  trackListeners(document);
  trackListeners(window);
  await act(async () => {
    runClassicScript(optionsSource);
  });
  await settle();
  return chrome;
}

function toggle(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement;
}

afterEach(() => {
  addedListeners.splice(0).forEach(([target, type, listener, options]) => {
    target.removeEventListener(type, listener, options as EventListenerOptions);
  });
  vi.unstubAllGlobals();
});

describe('Options page storage wiring', () => {
  it('restores switches from storage, repairs missing values and becomes ready', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage({
      [settings.MOTION_EFFECTS_ENABLED_STORAGE_KEY]: false,
      [settings.TAB_SWITCHER_ENABLED_STORAGE_KEY]: true
    });
    expect(toggle('_x_extension_motion_effects_toggle_2026_unique_').checked).toBe(false);
    expect(toggle('_x_extension_tab_switcher_toggle_2026_unique_').checked).toBe(true);
    expect(toggle('_x_extension_update_notice_toggle_2026_unique_').checked).toBe(true);
    const synced = chrome.storage.sync.values;
    expect(synced[settings.UPDATE_NOTICE_ENABLED_STORAGE_KEY]).toBe(true);
    expect(synced[settings.SIMPLE_MODE_ENABLED_STORAGE_KEY]).toBe(false);
    expect(synced[settings.AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY]).toBe(true);
    expect(synced[settings.MOTION_EFFECTS_ENABLED_STORAGE_KEY]).toBe(false);
    expect(document.getElementById('_x_extension_feedback_support_2026_unique_')?.textContent)
      .toContain((enMessages as Messages).settings_help_center_title.message);
    // The WebDAV controller is created in the page's own declaration order.
    expect(document.getElementById('lumno-webdav-list')?.childElementCount).toBeGreaterThan(0);
    // Ready once the startup values have been painted.
    await vi.waitFor(() => {
      expect(document.documentElement.getAttribute('data-lumno-options-ready')).toBe('true');
    });
  });

  it('persists switch changes and follows changes made elsewhere', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage();
    const simpleMode = toggle('_x_extension_simple_mode_toggle_2026_unique_');
    await act(async () => {
      // A click on the switch the user sees.
      simpleMode.click();
    });
    await settle();
    expect(chrome.storage.sync.values[settings.SIMPLE_MODE_ENABLED_STORAGE_KEY]).toBe(true);

    await act(async () => {
      chrome.storage.sync.externalSet({ [settings.SIMPLE_MODE_ENABLED_STORAGE_KEY]: false });
    });
    await settle();
    expect(simpleMode.checked).toBe(false);

    await act(async () => {
      chrome.storage.local.externalSet({ [settings.SIMPLE_MODE_ENABLED_STORAGE_KEY]: true });
    });
    await settle();
    expect(simpleMode.checked).toBe(false);
  });

  it('applies theme, language and aggregate search changes from other pages', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage();
    await act(async () => {
      chrome.storage.sync.externalSet({ [settings.THEME_STORAGE_KEY]: 'dark' });
    });
    await settle();
    expect(document.body.getAttribute('data-theme')).toBe('dark');

    await act(async () => {
      chrome.storage.sync.externalSet({ [settings.LANGUAGE_STORAGE_KEY]: 'ja' });
    });
    await settle();
    expect(document.documentElement.lang).toBe('ja');

    const list = document.getElementById('_x_extension_aggregate_search_list_2026_unique_') as HTMLElement;
    expect(list.textContent).not.toContain('Synced tech');
    await act(async () => {
      chrome.storage.sync.externalSet({
        [settings.AGGREGATE_SEARCH_STORAGE_KEY]: {
          version: 1,
          items: [{ id: 'agg-1', key: 'tech', name: 'Synced tech', sourceRefs: ['builtin:yt', 'builtin:gh'] }]
        }
      });
    });
    await settle();
    expect(list.textContent).toContain('Synced tech');
  });

  it('binds every switch in the shared table to its storage key', async () => {
    const chrome = await bootOptionsPage();
    const entries = (globalThis as unknown as {
      LumnoOptionsToggleSettings: {
        getToggleSettings(settings: unknown): Array<{
          control?: string;
          inputId: string;
          key: string;
          normalize(value: unknown): unknown;
          normalizeInput?(value: unknown): unknown;
        }>;
      };
    }).LumnoOptionsToggleSettings.getToggleSettings(SETTINGS);
    // Sub-options stay disabled while their parent switch is off.
    const parents = [SETTINGS.SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY, SETTINGS.NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY];
    for (const entry of entries) {
      if (!parents.includes(entry.key)) {
        await act(async () => {
          chrome.storage.sync.externalSet(Object.fromEntries(parents.map((key) => [key, true])));
        });
        await settle();
      }
      const control = document.getElementById(entry.inputId) as HTMLInputElement & HTMLSelectElement;
      expect(control, entry.inputId).toBeTruthy();
      if (entry.control === 'select') {
        const option = Array.from(control.options).map((item) => item.value).find((value) => value !== control.value);
        const host = control.closest('._x_extension_custom_select_2024_unique_') as HTMLElement;
        await act(async () => {
          host.querySelector<HTMLButtonElement>('button')?.click();
        });
        await act(async () => {
          host.querySelector<HTMLElement>(`[data-value="${option}"]`)?.click();
        });
        await settle();
        expect(chrome.storage.sync.values[entry.key], entry.key).toBe(entry.normalize(option));
        continue;
      }
      const next = !control.checked;
      await act(async () => {
        control.click();
      });
      await settle();
      const written = (entry.normalizeInput || entry.normalize)(next);
      // A value the page does not allow is repaired once its own write lands.
      expect(chrome.storage.sync.values[entry.key], `${entry.key} persists`).toBe(entry.normalize(written));
      await act(async () => {
        chrome.storage.sync.externalSet({ [entry.key]: !written });
      });
      await settle();
      expect(control.checked, `${entry.key} follows storage`).toBe(Boolean(entry.normalize(!written)));
    }
  });

  it('runs each switch\'s follow-up, such as locking the selection provider while it is off', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage({ [settings.SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY]: true });
    const provider = document.getElementById('_x_extension_selection_quick_actions_provider_select_2026_unique_') as HTMLSelectElement;
    expect(provider.disabled).toBe(false);
    await act(async () => {
      chrome.storage.sync.externalSet({ [settings.SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY]: false });
    });
    await settle();
    expect(provider.disabled).toBe(true);
  });

  it('migrates the aggregate tab-group switch from older per-search values', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage({
      [settings.AGGREGATE_SEARCH_STORAGE_KEY]: {
        version: 1,
        items: [{ id: 'agg-1', key: 'tech', name: 'Tech', sourceRefs: ['builtin:yt', 'builtin:gh'], autoCreateTabGroup: false }]
      }
    });
    expect(toggle('_x_extension_aggregate_search_auto_group_toggle_2026_unique_').checked).toBe(false);
    expect(chrome.storage.sync.values[settings.AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY]).toBe(false);
  });

  it('tells a failed aggregate search read apart from an empty list', async () => {
    const settings = SETTINGS;
    const toastText = () => document.getElementById('_x_extension_toast_2024_unique_')?.textContent || '';
    await bootOptionsPage();
    expect(toastText()).not.toContain('Action failed');
    addedListeners.splice(0).forEach(([target, type, listener, options]) => {
      target.removeEventListener(type, listener, options as EventListenerOptions);
    });
    vi.unstubAllGlobals();
    document.body.replaceChildren();

    const failing = createChromeStub({}, {});
    const get = failing.storage.sync.get.bind(failing.storage.sync);
    failing.storage.sync.get = (keys: unknown, callback?: (result: StorageValues) => void) => {
      const list = Array.isArray(keys) ? keys : [keys];
      if (callback && list.length === 1 && list[0] === settings.AGGREGATE_SEARCH_STORAGE_KEY) {
        queueMicrotask(() => {
          failing.runtime.lastError = { message: 'read failed' } as unknown as null;
          callback({});
          failing.runtime.lastError = null;
        });
        return undefined;
      }
      return get(keys, callback);
    };
    await bootOptionsPage({}, {}, failing);
    await vi.waitFor(() => {
      expect(toastText()).toContain('Action failed');
    });
  });

  it('repairs, persists and follows the overlay opening animation', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage({ [settings.OVERLAY_ENTER_ANIMATION_STORAGE_KEY]: 'bounce' });
    const key = settings.OVERLAY_ENTER_ANIMATION_STORAGE_KEY;
    const button = (value: string) => document.querySelector(
      `#_x_extension_overlay_enter_animation_tabs_wrap_2026_unique_ button[data-overlay-enter-animation="${value}"]`
    ) as HTMLButtonElement;
    expect(chrome.storage.sync.values[key]).toBe('elastic');
    expect(button('elastic').getAttribute('aria-pressed')).toBe('true');
    await act(async () => {
      button('fade').click();
    });
    await settle();
    expect(chrome.storage.sync.values[key]).toBe('fade');
    await act(async () => {
      chrome.storage.sync.externalSet({ [key]: 'elastic' });
    });
    await settle();
    expect(button('elastic').getAttribute('aria-pressed')).toBe('true');
  });

  it('refreshes the sync status when any synced preference changes', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage();
    const reads = vi.spyOn(chrome.storage.sync, 'get');
    await act(async () => {
      chrome.storage.sync.externalSet({ [settings.BOOKMARK_COUNT_STORAGE_KEY]: 2 });
    });
    await settle();
    expect(reads.mock.calls.some(([keys]) => Array.isArray(keys) && keys.includes(settings.SYNC_META_STORAGE_KEY))).toBe(true);
  });

  it.each(['zh_CN', 'zh_TW', 'en', 'ja'])(
    'saves and restores the %s tab-position choice through its content-sized select',
    async (locale) => {
      const settings = SETTINGS;
      const messages = LOCALE_MESSAGES[locale];
      const chrome = await bootOptionsPage({ [settings.LANGUAGE_STORAGE_KEY]: locale.replace('_', '-') });
      const select = document.getElementById('_x_extension_search_result_tab_position_select_2026_unique_') as HTMLSelectElement;
      const host = select.closest('._x_extension_custom_select_2024_unique_') as HTMLElement;
      const label = () => host.querySelector('._x_extension_select_label_2024_unique_')?.textContent;
      await vi.waitFor(() => {
        expect(label()).toBe(messages.search_result_tab_position_end.message);
      });
      expect(host.dataset.selectKind).toBe('search-result-tab-position');
      await act(async () => {
        host.querySelector<HTMLButtonElement>('button')?.click();
      });
      const menu = host.querySelector<HTMLElement>('[role="listbox"]')!;
      // The auto-width wrapper must not pin longer localized options to the trigger width.
      expect(menu.dataset.menuSurfaceWidth).toBe('content');
      expect(menu.style.getPropertyValue('--x-extension-menu-surface-min-width')).toBe('100%');
      // React owns the labels: no data-i18n hooks for the classic i18n pass to overwrite.
      expect(menu.querySelector('[data-i18n]')).toBeNull();
      expect(Array.from(menu.querySelectorAll('._x_extension_select_option_label_2026_unique_'), (option) => option.textContent))
        .toEqual([
          messages.search_result_tab_position_end.message,
          messages.search_result_tab_position_after_current.message,
          messages.search_result_tab_position_before_current.message
        ]);
      await act(async () => {
        host.querySelector<HTMLElement>('[data-value="beforeCurrent"]')?.click();
      });
      await settle();
      expect(chrome.storage.sync.values[settings.SEARCH_RESULT_TAB_POSITION_STORAGE_KEY]).toBe('beforeCurrent');
      expect(label()).toBe(messages.search_result_tab_position_before_current.message);

      await act(async () => {
        chrome.storage.sync.externalSet({ [settings.SEARCH_RESULT_TAB_POSITION_STORAGE_KEY]: 'afterCurrent' });
      });
      await settle();
      expect(label()).toBe(messages.search_result_tab_position_after_current.message);
    }
  );

  it('imports a settings file into storage and stamps it as an import', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage();
    const input = document.getElementById('_x_extension_sync_import_input_2024_unique_') as HTMLInputElement;
    const file = new File([JSON.stringify({
      version: 1,
      data: {
        [settings.THEME_STORAGE_KEY]: 'light',
        [settings.NEWTAB_SHORTCUTS_STORAGE_KEY]: [{ url: 'https://example.com' }]
      }
    })], 'settings.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change'));
    });
    await vi.waitFor(() => {
      expect(chrome.storage.sync.values[settings.SYNC_META_STORAGE_KEY]).toMatchObject({ source: 'import' });
    });
    const synced = chrome.storage.sync.values;
    expect(synced[settings.THEME_STORAGE_KEY]).toBe('light');
    expect(synced[settings.NEWTAB_SHORTCUTS_CHUNK_2_STORAGE_KEY]).toEqual([]);
    expect(input.value).toBe('');
  });
});
