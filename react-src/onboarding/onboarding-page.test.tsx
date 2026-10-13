import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import onboardingHtml from '../../src/onboarding/onboarding.html?raw';
import onboardingSource from '../../src/onboarding/onboarding.js?raw';
import onboardingContentSource from '../../src/onboarding/onboarding-content.js?raw';
import settingsSource from '../../src/shared/settings.js?raw';
import shortcutKeyMatcherSource from '../../src/shared/shortcut-key-matcher.js?raw';
import navigationDispositionSource from '../../src/shared/navigation-disposition.js?raw';
import communityLinksSource from '../../src/shared/community-links.js?raw';
import { createActionButtonsApi } from './action-buttons';
import { createBodyCopyApi } from './body-copy';
import { createCopyHeadingApi } from './copy-heading';
import { createCursorLayerApi } from './cursor-layer';
import { createInteractionsApi } from './interactions';
import { createPageStripApi } from './page-strip';
import { createVisualSurfaceApi } from './visual-surface';
import { createTooltipViewApi } from '../shared/tooltip-view';

interface OnboardingSlide {
  id: string;
  visual: { kind: string; visible: boolean };
}

type Runtime = typeof globalThis & Record<string, unknown> & {
  LumnoOnboardingContent: {
    getOnboardingBlueprint(locale: string): {
      htmlLang: string;
      slides: OnboardingSlide[];
    };
  };
};

const runtime = globalThis as Runtime;
const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
const VISUAL_ISLAND_BY_KIND: Record<string, string> = {
  'lumno-web-wordmark-surface': 'onboarding-lumno-wordmark-surface',
  'bookmark-focus-surface': 'onboarding-bookmark-focus-surface',
  'newtab-preview-surface': 'onboarding-newtab-preview-surface',
  'site-search-demo-surface': 'onboarding-site-search-demo-surface',
  'feature-cards-surface': 'onboarding-feature-cards-surface'
};
const addedListeners: Array<[
  EventTarget,
  string,
  EventListenerOrEventListenerObject,
  boolean | AddEventListenerOptions | undefined
]> = [];

function runClassicScript(source: string): void {
  new Function('module', source)(undefined);
}

function trackListeners(target: Document | Window): void {
  const addEventListener = target.addEventListener.bind(target);
  vi.spyOn(target as EventTarget, 'addEventListener').mockImplementation(
    (type, listener, options) => {
      if (listener) {
        addedListeners.push([target, type, listener, options]);
        addEventListener(type, listener, options);
      }
    }
  );
}

function createChromeStub(stored: Record<string, unknown>) {
  const read = (keys: string[], callback?: (result: object) => void) => {
    const result = Object.fromEntries(
      keys.filter((key) => key in stored).map((key) => [key, stored[key]])
    );
    if (callback) {
      callback(result);
      return undefined;
    }
    return Promise.resolve(result);
  };
  return {
    commands: {
      getAll: (callback: (commands: object[]) => void) => callback([
        { name: 'show-search', shortcut: 'Ctrl+Shift+K' }
      ])
    },
    runtime: {
      getManifest: () => ({ version: '1.0.0' }),
      getURL: (path: string) => `chrome-extension://lumno/${path}`,
      id: 'nggfkkbmogmadfoikakkfegkoilfcfao',
      lastError: null,
      onMessage: { addListener: vi.fn() },
      sendMessage: vi.fn()
    },
    storage: {
      local: { get: vi.fn((keys: string[], callback?: (result: object) => void) => read(keys, callback)) },
      sync: { get: vi.fn((keys: string[], callback?: (result: object) => void) => read(keys, callback)) }
    }
  };
}

function bootOnboardingPage(stored: Record<string, unknown> = {}) {
  const parsed = new DOMParser().parseFromString(onboardingHtml, 'text/html');
  const shell = parsed.getElementById('onboarding-root');
  document.body.appendChild(document.importNode(shell!, true));

  const chrome = createChromeStub(stored);
  vi.stubGlobal('chrome', chrome);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    addEventListener() {},
    removeEventListener() {}
  }));
  runtime.LumnoTooltip = {
    createController: () => ({
      hide() {},
      show: () => document.createElement('div')
    }),
    position() {}
  };
  runtime.LumnoOnboardingActions = createActionButtonsApi();
  runtime.LumnoOnboardingBodyCopy = createBodyCopyApi();
  runtime.LumnoOnboardingCopyHeading = createCopyHeadingApi();
  runtime.LumnoOnboardingCursorLayer = createCursorLayerApi();
  runtime.LumnoOnboardingInteractions = createInteractionsApi();
  runtime.LumnoOnboardingPageStrip = createPageStripApi();
  runtime.LumnoOnboardingVisualSurface = createVisualSurfaceApi();
  runtime.LumnoTooltipView = createTooltipViewApi();
  [
    settingsSource,
    shortcutKeyMatcherSource,
    navigationDispositionSource,
    communityLinksSource,
    onboardingContentSource
  ].forEach(runClassicScript);

  trackListeners(document);
  trackListeners(window);
  act(() => {
    runClassicScript(onboardingSource);
  });
  return {
    chrome,
    root: document.getElementById('onboarding-root') as HTMLElement,
    stage: document.getElementById('onboarding-visual-stage') as HTMLElement
  };
}

async function waitForFirstRender(root: HTMLElement): Promise<void> {
  await act(async () => {
    await vi.waitFor(() => {
      expect(root.dataset.direction).toBeDefined();
    });
  });
}

afterEach(() => {
  addedListeners.splice(0).forEach(([target, type, listener, options]) => {
    target.removeEventListener(type, listener, options);
  });
  vi.unstubAllGlobals();
  // The page mirrors the active slide into ?slide=.
  window.history.replaceState(null, '', '/');
});

describe('Onboarding page runtime', () => {
  it('reads the stored language and renders every slide visual through the React surface', async () => {
    const { chrome, root, stage } = bootOnboardingPage({
      [LANGUAGE_STORAGE_KEY]: 'ja'
    });
    await waitForFirstRender(root);

    const blueprint = runtime.LumnoOnboardingContent.getOnboardingBlueprint('ja');
    expect(chrome.storage.sync.get).toHaveBeenCalledWith(
      [LANGUAGE_STORAGE_KEY],
      expect.any(Function)
    );
    expect(document.documentElement.lang).toBe(blueprint.htmlLang);

    for (let index = 0; index < blueprint.slides.length; index += 1) {
      const slide = blueprint.slides[index];
      expect(root.dataset.activeIndex).toBe(String(index));
      expect(root.dataset.activeSlide).toBe(slide.id);
      expect(stage.dataset.visualKind).toBe(slide.visual.kind);
      const islands = Array.from(
        stage.querySelectorAll<HTMLElement>(':scope > [data-react-island]'),
        (node) => node.dataset.reactIsland
      );
      expect(islands).toEqual(
        slide.visual.visible ? [VISUAL_ISLAND_BY_KIND[slide.visual.kind]] : []
      );
      expect(stage.firstElementChild?.childElementCount).toBeGreaterThan(0);

      if (index === 0) {
        // The React action button advances exactly one slide.
        act(() => {
          document
            .querySelector<HTMLButtonElement>('.onboarding-action-button--primary')
            ?.click();
        });
      } else {
        act(() => {
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
          );
        });
      }
    }
    expect(root.dataset.activeIndex).toBe(String(blueprint.slides.length - 1));
  });

  it('opens accordion link actions on click and in the background on middle-click', async () => {
    const { chrome, root } = bootOnboardingPage();
    await waitForFirstRender(root);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(root.dataset.activeSlide).toBe('setup');

    const link = document.querySelector<HTMLAnchorElement>(
      '.interaction-accordion-link[data-action="openShortcuts"]'
    );
    expect(link).toBeTruthy();
    act(() => {
      link!.click();
    });
    act(() => {
      link!.dispatchEvent(
        new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 })
      );
    });

    expect(chrome.runtime.sendMessage.mock.calls.map(([message]) => message))
      .toEqual([
        { action: 'openExtensionShortcutsPage', disposition: 'newTab' },
        { action: 'openExtensionShortcutsPage', disposition: 'backgroundTab' }
      ]);
  });
});
