import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRecentSitesView,
  createRecentSitesViewApi,
  getRecentSitesSignature,
  type RecentCardElement,
  type RecentSiteItem,
  type RecentSitesViewController,
  type RecentSitesViewOptions
} from './recent-sites';

let views: RecentSitesViewController[] = [];

function createOptions(
  overrides: Partial<RecentSitesViewOptions> = {}
): RecentSitesViewOptions {
  const grid = document.createElement('div');
  document.body.appendChild(grid);
  return {
    documentObj: document,
    windowObj: window,
    grid,
    cards: [],
    t: (_key, fallback) => fallback,
    formatMessage: (_key, fallback, values) =>
      fallback.replace('{title}', values.title),
    sanitizeDisplayText: (value) => String(value || ''),
    getOwnExtensionPageDisplay: () => null,
    getHostFromUrl: () => 'example.com',
    getCanonicalPageUrlForFavicon: (url) => url,
    getBrowserPageFaviconUrl: () => 'chrome://favicon/',
    getSiteDisplayName: (_host, title) => title || 'Example',
    getUrlDisplay: (url) => url,
    getRiSvg: (id, sizeClass = '') =>
      `<i class="${sizeClass} ${id}"></i>`,
    attachFaviconWithFallbacks: (image) => {
      image.src = 'data:image/png;base64,dGVzdA==';
    },
    getImmediateThemeForSuggestion: () => ({ accent: 'blue' }),
    queueThemeForTarget: () => {},
    applyCardTheme: (card) => {
      card.dataset.themed = 'true';
    },
    getCurrentRecentCount: () => 4,
    isPinned: () => false,
    getPinnedCount: () => 0,
    getMaxPinnedCount: () => 3,
    updatePinButton: (button, pinned, limitReached) => {
      button.dataset.pinned = String(pinned);
      button.dataset.limitReached = String(limitReached);
      button.setAttribute('aria-label', pinned ? 'Unpin' : 'Pin');
    },
    showToast: () => {},
    showTopActionTooltip: () => {},
    hideTopActionTooltip: () => {},
    hideCursorTooltip: () => {},
    bindCursorTooltip: () => null,
    openUrl: () => {},
    togglePinned: () => Promise.resolve(null),
    onItemContextMenu: () => {},
    ...overrides
  };
}

function createView(
  overrides: Partial<RecentSitesViewOptions> = {}
): {
  view: RecentSitesViewController;
  options: RecentSitesViewOptions;
} {
  const options = createOptions(overrides);
  const view = createRecentSitesView(options);
  views.push(view);
  return { view, options };
}

function renderItems(
  view: RecentSitesViewController,
  items: RecentSiteItem[],
  signature = ''
) {
  let result = {
    changed: false,
    count: 0,
    signature: ''
  };
  act(() => {
    result = view.render(items, { signature });
  });
  return result;
}

afterEach(() => {
  act(() => {
    views.forEach((view) => view.clear());
  });
  views = [];
});

describe('Recent Sites React island', () => {
  it('preserves signatures without a legacy renderer', () => {
    const items = [{
      title: 'Example',
      url: 'https://example.com/',
      visitCount: 2
    }];
    expect(getRecentSitesSignature(items)).toBe(
      '0::https://example.com/::Example::::::2'
    );

    const options = createOptions();
    const view = createRecentSitesView(options);
    views.push(view);
    expect(createRecentSitesViewApi().implementation).toBe('react');
  });

  it('renders cards synchronously and keeps external card metadata intact', () => {
    const attachFavicon = vi.fn();
    const applyTheme = vi.fn((card: RecentCardElement) => {
      card.dataset.themed = 'true';
    });
    const bindTooltip = vi.fn();
    const { view, options } = createView({
      attachFaviconWithFallbacks: attachFavicon,
      applyCardTheme: applyTheme,
      bindCursorTooltip: bindTooltip
    });
    const items = [{
      title: 'Example Docs',
      url: 'https://example.com/docs',
      lastVisitTime: 42,
      visitCount: 3
    }];

    const result = renderItems(view, items);
    const grid = options.grid as HTMLElement;
    const card = grid.querySelector<RecentCardElement>('.x-nt-recent-card');

    expect(result).toEqual({
      changed: true,
      count: 1,
      signature: getRecentSitesSignature(items)
    });
    expect(grid.dataset.reactIsland).toBe('recent-sites');
    expect(view.getCards()).toEqual([card]);
    expect(card?._xHost).toBe('example.com');
    expect(card?._xTitleText).toBe('Example Docs');
    expect(card?._xActionText?.textContent).toBe('前往');
    expect(card?._xPinButton).toBeInstanceOf(HTMLButtonElement);
    expect(card?.querySelector('.x-nt-recent-dismiss')).toBeNull();
    expect(
      card?.querySelector('.x-nt-recent-card-visual')
    ).toBeInstanceOf(HTMLDivElement);
    expect(card?.dataset.themed).toBe('true');
    expect(attachFavicon).toHaveBeenCalledOnce();
    expect(applyTheme).toHaveBeenCalledOnce();
    expect(bindTooltip).toHaveBeenCalledOnce();

    const unchanged = renderItems(view, items, result.signature);
    expect(unchanged.changed).toBe(false);
    expect(attachFavicon).toHaveBeenCalledOnce();
  });

  it('preserves card nodes when history metadata changes or order moves', () => {
    const { view } = createView();
    const first = {
      title: 'First',
      url: 'https://first.example/',
      lastVisitTime: 10,
      visitCount: 1
    };
    const second = {
      title: 'Second',
      url: 'https://second.example/',
      lastVisitTime: 20,
      visitCount: 2
    };
    const initial = renderItems(view, [first, second]);
    const firstCard = view.getCards()[0];
    const secondCard = view.getCards()[1];

    renderItems(view, [
      {
        ...second,
        lastVisitTime: 30,
        visitCount: 3
      },
      {
        ...first,
        lastVisitTime: 40,
        visitCount: 4
      }
    ], initial.signature);

    expect(view.getCards()).toEqual([secondCard, firstCard]);
    expect(view.getCards()[0]._xTitleText).toBe('Second');
    expect(view.getCards()[1]._xTitleText).toBe('First');
  });

  it('shows a stable fallback before a browser-page favicon attaches', () => {
    const attachFavicon = vi.fn();
    const browserPageUrl = 'chrome://extensions/';
    const browserPageFaviconUrl =
      'chrome-extension://lumno/_favicon/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128';
    const { view, options } = createView({
      getHostFromUrl: (url) =>
        url === browserPageUrl ? 'extensions' : 'example.com',
      getBrowserPageFaviconUrl: (url) =>
        url === browserPageUrl ? browserPageFaviconUrl : '',
      attachFaviconWithFallbacks: attachFavicon
    });

    renderItems(view, [{
      title: 'Extensions',
      url: browserPageUrl
    }]);

    const grid = options.grid as HTMLElement;
    const image = grid.querySelector<HTMLImageElement>(
      '.x-nt-recent-favicon'
    );
    const fallback = grid.querySelector<HTMLElement>(
      '._x_extension_favicon_fallback_2024_unique_'
    );

    expect(image?.hasAttribute('src')).toBe(false);
    expect(image?.dataset.faviconPlaceholder).toBe('true');
    expect(image?.dataset.fallbackIconName).toBe('ri-link');
    expect(fallback?.dataset.visible).toBe('true');
    expect(fallback?.innerHTML).toContain('ri-link');
    expect(attachFavicon).toHaveBeenCalledWith(
      image,
      browserPageUrl,
      'extensions',
      { primaryUrl: browserPageFaviconUrl }
    );
  });

  it('preserves pointer suppression and background-open behavior', async () => {
    const opened: Array<{
      url: string;
      openInBackgroundTab: boolean;
    }> = [];
    const { view } = createView({
      openUrl: (url, options) => {
        opened.push({ url, ...options });
      }
    });
    renderItems(view, [{
      title: 'Example',
      url: 'https://example.com/'
    }]);
    const card = view.getCards()[0];

    act(() => {
      card.dispatchEvent(new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        ctrlKey: true
      }));
      card.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        button: 0,
        ctrlKey: true
      }));
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    act(() => {
      card.dispatchEvent(new MouseEvent('auxclick', {
        bubbles: true,
        button: 1
      }));
    });

    expect(opened).toEqual([
      {
        url: 'https://example.com/',
        openInBackgroundTab: true
      },
      {
        url: 'https://example.com/',
        openInBackgroundTab: true
      }
    ]);
  });

  it('does not open a card for presses meant for its context menu', () => {
    const opened = vi.fn();
    let suppressed = true;
    const { view } = createView({
      openUrl: opened,
      isActivationSuppressed: () => suppressed
    });
    renderItems(view, [{
      title: 'Example',
      url: 'https://example.com/'
    }]);
    const card = view.getCards()[0];
    const press = () => {
      act(() => {
        card.dispatchEvent(new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0
        }));
        card.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          button: 0
        }));
        card.dispatchEvent(new MouseEvent('auxclick', {
          bubbles: true,
          button: 1
        }));
      });
    };

    press();
    expect(opened).not.toHaveBeenCalled();

    suppressed = false;
    press();
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('offers a progress tracking switch on pinned cards', async () => {
    const states: Record<string, 'tracking' | 'available' | ''> = {
      'https://www.bilibili.com/video/BV11LEA6eEuj?p=2': 'tracking',
      'https://example.com/docs': 'available'
    };
    const toggled: string[] = [];
    const tooltips: string[] = [];
    const { view } = createView({
      getProgressState: (item) => states[String(item.url)] || '',
      toggleProgressTracking: (item) => {
        toggled.push(String(item.url));
        return true;
      },
      showTopActionTooltip: (_target, message) => tooltips.push(message)
    });
    renderItems(view, [
      { title: '合集 P2', url: 'https://www.bilibili.com/video/BV11LEA6eEuj?p=2' },
      { title: 'Docs', url: 'https://example.com/docs' },
      { title: 'Example', url: 'https://example.com/' }
    ]);
    const [tracked, available, plain] = view.getCards();
    const trackedButton = tracked.querySelector<HTMLButtonElement>('.x-nt-recent-track');
    expect(trackedButton?.getAttribute('aria-pressed')).toBe('true');
    expect(trackedButton?.classList.contains('x-nt-recent-track--active')).toBe(true);
    expect(trackedButton?.querySelector('.ri-radar-fill')).not.toBeNull();
    const availableButton = available.querySelector<HTMLButtonElement>('.x-nt-recent-track');
    expect(availableButton?.getAttribute('aria-pressed')).toBe('false');
    expect(availableButton?.querySelector('.ri-radar-line')).not.toBeNull();
    expect(plain.querySelector('.x-nt-recent-track')).toBeNull();
    expect(tracked.querySelector('.x-nt-recent-track')?.nextElementSibling)
      .toBe(tracked.querySelector('.x-nt-recent-pin'));

    act(() => {
      availableButton?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(tooltips.pop()).toContain('适合追剧');
    await act(async () => {
      availableButton?.click();
      await Promise.resolve();
    });
    expect(toggled).toEqual(['https://example.com/docs']);
  });

  it('includes tracking in the signature only for tracked cards', () => {
    expect(getRecentSitesSignature([{ url: 'https://a.com/', title: 'A' }])).not.toContain('tracking');
    expect(getRecentSitesSignature([
      { url: 'https://a.com/', title: 'A', progressTracking: true }
    ])).toContain('::tracking');
  });

  it('cleans foreground navigation listeners when the view clears', () => {
    const documentAdd = vi.spyOn(document, 'addEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');
    const windowAdd = vi.spyOn(window, 'addEventListener');
    const windowRemove = vi.spyOn(window, 'removeEventListener');
    const { view } = createView();
    renderItems(view, [{
      title: 'Example',
      url: 'https://example.com/'
    }]);

    act(() => {
      view.getCards()[0].dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        button: 0
      }));
    });
    expect(
      documentAdd.mock.calls.some(([type]) => type === 'visibilitychange')
    ).toBe(true);
    expect(
      windowAdd.mock.calls.some(([type]) => type === 'pagehide')
    ).toBe(true);

    act(() => {
      view.clear();
    });
    expect(
      documentRemove.mock.calls.some(([type]) => type === 'visibilitychange')
    ).toBe(true);
    expect(
      windowRemove.mock.calls.some(([type]) => type === 'pagehide')
    ).toBe(true);
    expect(view.getCards()).toEqual([]);
  });

  it('keeps pin-limit activation inside the action button', () => {
    const opened = vi.fn();
    const showToast = vi.fn();
    const updatePinButton = vi.fn();
    const { view } = createView({
      openUrl: opened,
      getPinnedCount: () => 3,
      getMaxPinnedCount: () => 3,
      showToast,
      updatePinButton
    });
    renderItems(view, [{
      title: 'Example',
      url: 'https://example.com/'
    }]);
    updatePinButton.mockClear();

    act(() => {
      view.getCards()[0]._xPinButton?.click();
    });

    expect(opened).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('最多只能置顶 3 个卡片。', false);
    expect(updatePinButton).toHaveBeenCalledWith(
      view.getCards()[0]._xPinButton,
      false,
      true
    );
  });

  it('routes right-click through the shared New Tab context-menu callback', () => {
    const onItemContextMenu = vi.fn((payload) => {
      payload.event.preventDefault();
      payload.event.stopPropagation();
    });
    const opened = vi.fn();
    const item = {
      title: 'Example',
      url: 'https://example.com/'
    };
    const { view } = createView({
      openUrl: opened,
      onItemContextMenu
    });
    renderItems(view, [item]);
    const card = view.getCards()[0];
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: 120,
      clientY: 80
    });

    act(() => {
      card.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onItemContextMenu).toHaveBeenCalledWith({
      event,
      item,
      element: card
    });
    expect(opened).not.toHaveBeenCalled();
  });

  it('coalesces rapid pin actions while persistence is pending', async () => {
    let resolvePin: (
      result: { pinned: boolean; limitReached: boolean }
    ) => void = () => {};
    const togglePinned = vi.fn(() => new Promise<{
      pinned: boolean;
      limitReached: boolean;
    }>((resolve) => {
      resolvePin = resolve;
    }));
    const { view } = createView({ togglePinned });
    renderItems(view, [{
      title: 'Example',
      url: 'https://example.com/'
    }]);
    const pinButton = view.getCards()[0]._xPinButton;

    act(() => {
      pinButton?.click();
      pinButton?.click();
    });

    expect(togglePinned).toHaveBeenCalledTimes(1);
    expect(pinButton?.disabled).toBe(true);
    expect(pinButton?.getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      resolvePin({ pinned: true, limitReached: false });
      await Promise.resolve();
    });

    expect(pinButton?.disabled).toBe(false);
    expect(pinButton?.getAttribute('aria-busy')).toBe('false');
  });
});
