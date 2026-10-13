import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShortcutsView,
  createShortcutsViewApi,
  type ShortcutItem,
  type ShortcutsLayout,
  type ShortcutsViewController,
  type ShortcutsViewOptions
} from './shortcuts';

let views: ShortcutsViewController[] = [];

function createOptions(
  overrides: Partial<ShortcutsViewOptions> = {}
): ShortcutsViewOptions {
  const grid = document.createElement('div');
  document.body.appendChild(grid);
  return {
    grid,
    tiles: [],
    getShortcutTitle: (shortcut) => String(shortcut.title || shortcut.host || ''),
    getHostFromUrl: () => 'example.com',
    getShortcutIconDataUrl: () => '',
    getShortcutFaviconCandidateUrl: () => '',
    getImmediateThemeForSuggestion: () => ({ accent: 'blue' }),
    applyShortcutTileTheme: (tile) => {
      tile.dataset.themed = 'true';
    },
    queueThemeForTarget: () => {},
    attachFaviconWithFallbacks: (image) => {
      image.src = 'data:image/png;base64,dGVzdA==';
    },
    bindTooltip: () => null,
    hideTooltip: () => {},
    formatOpenLabel: (title) => `Open ${title}`,
    isMiddleClick: (event) => event.button === 1,
    openShortcut: () => {},
    onContextMenu: () => {},
    onNativeDragStart: (event) => event.preventDefault(),
    getAddLabel: () => 'Add shortcut',
    getAddIconSvg: () => '<i class="ri-add-line"></i>',
    getAddVisible: () => true,
    onAdd: () => {},
    onAddContextMenu: () => {},
    ...overrides
  };
}

function createView(
  overrides: Partial<ShortcutsViewOptions> = {}
): {
  view: ShortcutsViewController;
  options: ShortcutsViewOptions;
} {
  const options = createOptions(overrides);
  const view = createShortcutsView(options);
  views.push(view);
  return { view, options };
}

function renderItems(
  view: ShortcutsViewController,
  items: ShortcutItem[],
  layout?: ShortcutsLayout
): { count: number } {
  let result = { count: 0 };
  act(() => {
    result = view.render(items, layout);
  });
  return result;
}

afterEach(() => {
  act(() => {
    views.forEach((view) => view.clear());
  });
  views = [];
});

describe('Shortcuts React island', () => {
  it('renders a live folder entry with the shared animated icon and menu semantics', () => {
    const initFolderIcon = vi.fn();
    const animateFolderIcon = vi.fn();
    const openShortcut = vi.fn();
    const queueThemeForTarget = vi.fn();
    const getFolderIconSvg = vi.fn(() => '<svg data-folder-icon="true"></svg>');
    const resolveShortcutFaviconDataUrl = vi.fn(() => Promise.resolve(''));
    const { view, options } = createView({
      getFolderIconSvg,
      initFolderIcon, animateFolderIcon, openShortcut, resolveShortcutFaviconDataUrl,
      queueThemeForTarget
    });
    renderItems(view, [{ id: 'folder-entry', type: 'folder', folderId: '42', title: 'Design' }]);
    const tile = options.grid!.querySelector<HTMLButtonElement>('[data-shortcut-id="folder-entry"]')!;
    expect(tile.getAttribute('aria-haspopup')).toBe('menu');
    expect(tile.getAttribute('data-bookmark-drop-folder-id')).toBe('42');
    expect(tile.querySelector('[data-folder-icon]')).not.toBeNull();
    expect(tile.dataset.themed).toBe('true');
    expect(tile.querySelector('.x-nt-shortcut-icon--folder')?.classList.contains('x-nt-shortcut-icon')).toBe(true);
    expect(getFolderIconSvg).toHaveBeenCalledWith('shortcut-folder-entry', '42');
    expect(initFolderIcon).toHaveBeenCalledTimes(1);
    expect(resolveShortcutFaviconDataUrl).not.toHaveBeenCalled();
    expect(queueThemeForTarget).not.toHaveBeenCalled();
    act(() => tile.click());
    expect(openShortcut).toHaveBeenCalledWith(expect.objectContaining({ folderId: '42' }), expect.anything());
    const folderTile = tile as import('./shortcuts').ShortcutTileElement;
    folderTile._xSetBookmarkMenuVisualActive!(true);
    expect(animateFolderIcon).toHaveBeenLastCalledWith(tile.querySelector('.x-nt-shortcut-icon'), true);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(true);
    folderTile._xSetBookmarkMenuVisualActive!(false);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(false);
  });
  it('preserves animated SVG nodes when a folder shortcut rerenders or is renamed', () => {
    const { view, options } = createView({
      getFolderIconSvg: () => '<svg><path data-folder-part="upper-body" d="M0 0" /></svg>'
    });
    const folder = { id: 'folder-entry', type: 'folder', folderId: '42', title: 'Design' };
    renderItems(view, [folder]);
    const path = options.grid!.querySelector('path')!;
    path.setAttribute('d', 'M9 13');
    renderItems(view, [folder]);
    renderItems(view, [{ ...folder, title: 'Design renamed' }]);
    expect(options.grid!.querySelector('path')).toBe(path);
    expect(path.getAttribute('d')).toBe('M9 13');
    expect(options.grid!.querySelector('[data-shortcut-title="Design renamed"]')).not.toBeNull();
  });
  it('keeps the folder icon open while the pointer moves into its context menu', () => {
    const animateFolderIcon = vi.fn();
    const { view } = createView({
      getFolderIconSvg: () => '<svg data-folder-icon="true"></svg>',
      animateFolderIcon
    });
    renderItems(view, [{ id: 'folder-entry', type: 'folder', folderId: '42', title: 'Design' }]);
    const tile = view.getTiles()[0];
    const icon = tile.querySelector('.x-nt-shortcut-icon');
    tile.setAttribute('data-shortcut-context-menu-open', 'true');
    tile._xSetBookmarkMenuVisualActive!(true);
    animateFolderIcon.mockClear();
    act(() => tile.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body })));
    expect(animateFolderIcon).not.toHaveBeenCalled();
    // A folder contents menu can close while the context menu is still open.
    tile._xSetBookmarkMenuVisualActive!(false);
    expect(animateFolderIcon).toHaveBeenLastCalledWith(icon, true);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(true);
    tile.removeAttribute('data-shortcut-context-menu-open');
    tile._xSetBookmarkMenuVisualActive!(false);
    expect(animateFolderIcon).toHaveBeenLastCalledWith(icon, false);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(false);
  });
  it('keeps an open folder contents menu expanded when its context menu closes', () => {
    const animateFolderIcon = vi.fn();
    const { view } = createView({ animateFolderIcon });
    renderItems(view, [{ id: 'folder-entry', type: 'folder', folderId: '42', title: 'Design' }]);
    const tile = view.getTiles()[0];
    tile.setAttribute('aria-expanded', 'true');
    tile._xSetBookmarkMenuVisualActive!(true);
    tile.setAttribute('data-shortcut-context-menu-open', 'true');
    tile.removeAttribute('data-shortcut-context-menu-open');
    tile._xSetBookmarkMenuVisualActive!(false);
    expect(animateFolderIcon).toHaveBeenLastCalledWith(tile.querySelector('.x-nt-shortcut-icon'), true);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(true);
    tile.setAttribute('aria-expanded', 'false');
    tile._xSetBookmarkMenuVisualActive!(false);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(false);
  });
  it('renders shortcut metadata and keeps the external tile cache synchronous', () => {
    const attachFavicon = vi.fn((image: HTMLImageElement) => {
      image.src = 'data:image/png;base64,dGVzdA==';
    });
    const applyTheme = vi.fn((tile: HTMLButtonElement) => {
      tile.dataset.themed = 'true';
    });
    const bindTooltip = vi.fn();
    const { view, options } = createView({
      attachFaviconWithFallbacks: attachFavicon,
      applyShortcutTileTheme: applyTheme,
      bindTooltip
    });
    const result = renderItems(view, [{
      id: 'docs',
      title: 'Docs',
      url: 'https://example.com/docs'
    }]);
    const grid = options.grid as HTMLElement;
    const tile = view.getTiles()[0];

    expect(createShortcutsViewApi().implementation).toBe('react');
    expect(result).toEqual({ count: 1 });
    expect(grid.dataset.reactIsland).toBe('shortcuts');
    expect(tile.dataset.shortcutId).toBe('docs');
    expect(tile.dataset.shortcutUrl).toBe('https://example.com/docs');
    expect(tile.dataset.shortcutDraggable).toBe('true');
    expect(tile.dataset.themed).toBe('true');
    expect(tile.getAttribute('aria-label')).toBe('Open Docs');
    expect(tile._xHost).toBe('example.com');
    expect(view.getAddButton()?.dataset.tooltip).toBe('Add shortcut');
    expect(attachFavicon).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      'https://example.com/docs',
      'example.com',
      {
        primaryUrl: '',
        pageSpecificUrl: '',
        skipPersisted: true,
        sourceProfile: 'shortcut'
      }
    );
    expect(applyTheme).toHaveBeenCalledOnce();
    expect(bindTooltip).toHaveBeenCalledTimes(2);
  });

  it('routes click, keyboard, middle-click, context menu, and add actions', () => {
    const openShortcut = vi.fn();
    const onContextMenu = vi.fn();
    const onAdd = vi.fn();
    const onAddContextMenu = vi.fn();
    const { view } = createView({
      openShortcut,
      onContextMenu,
      onAdd,
      onAddContextMenu
    });
    renderItems(view, [{
      id: 'docs',
      title: 'Docs',
      url: 'https://example.com/docs'
    }]);
    const tile = view.getTiles()[0];

    act(() => {
      tile.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        button: 0
      }));
      tile.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter'
      }));
      tile.dispatchEvent(new MouseEvent('auxclick', {
        bubbles: true,
        button: 1
      }));
      tile.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true
      }));
      view.getAddButton()?.click();
      view.getAddButton()?.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true
      }));
    });

    expect(openShortcut).toHaveBeenCalledTimes(3);
    expect(onContextMenu).toHaveBeenCalledOnce();
    expect(onAdd).toHaveBeenCalledWith(view.getAddButton());
    expect(onAddContextMenu).toHaveBeenCalledWith(view.getAddButton());
  });

  it('hides the add tile when the preference is off and restores it live', () => {
    let addVisible = false;
    const { view } = createView({
      getAddVisible: () => addVisible
    });

    renderItems(view, [{
      id: 'docs',
      title: 'Docs',
      url: 'https://example.com/docs'
    }]);
    expect(view.getAddButton()?.hidden).toBe(true);

    addVisible = true;
    renderItems(view, [{
      id: 'docs',
      title: 'Docs',
      url: 'https://example.com/docs'
    }]);
    expect(view.getAddButton()?.hidden).toBe(false);
  });

  it('hides the add tile at capacity without removing existing shortcuts', () => {
    const { view } = createView({
      maxShortcuts: 2
    });
    renderItems(view, [
      {
        id: 'one',
        title: 'One',
        url: 'https://one.example/'
      },
      {
        id: 'two',
        title: 'Two',
        url: 'https://two.example/'
      }
    ]);

    expect(view.getTiles()).toHaveLength(2);
    expect(view.getAddButton()?.hidden).toBe(true);

    renderItems(view, [{
      id: 'one',
      title: 'One',
      url: 'https://one.example/'
    }]);

    expect(view.getAddButton()?.hidden).toBe(false);
  });

  it('renders uploaded icons without invoking the favicon fallback runtime', () => {
    const attachFavicon = vi.fn();
    const getImmediateTheme = vi.fn(() => ({ accent: 'custom' }));
    const queueTheme = vi.fn();
    const { view } = createView({
      getShortcutIconDataUrl: (shortcutId) =>
        shortcutId === 'custom'
          ? 'data:image/png;base64,Y3VzdG9t'
          : '',
      attachFaviconWithFallbacks: attachFavicon,
      getImmediateThemeForSuggestion: getImmediateTheme,
      queueThemeForTarget: queueTheme
    });
    renderItems(view, [{
      id: 'custom',
      title: 'Custom',
      url: 'https://example.com/'
    }]);
    const tile = view.getTiles()[0];
    const image = tile.querySelector<HTMLImageElement>('.x-nt-shortcut-favicon');

    expect(tile.dataset.shortcutCustomIcon).toBe('true');
    expect(image?.src).toContain('data:image/png;base64,Y3VzdG9t');
    expect(attachFavicon).not.toHaveBeenCalled();
    expect(getImmediateTheme).toHaveBeenCalledWith(expect.objectContaining({
      customIconDataUrl: 'data:image/png;base64,Y3VzdG9t'
    }));
    expect(queueTheme).toHaveBeenCalledWith(
      tile,
      expect.objectContaining({
        customIconDataUrl: 'data:image/png;base64,Y3VzdG9t'
      }),
      expect.any(Function),
      { priority: 0 }
    );
  });

  it('uses bundled artwork without acquiring an icon from the browser or a remote service', () => {
    const assetUrl = 'chrome-extension://abc/assets/images/site-search/glyph-xhs.png';
    const attachFavicon = vi.fn();
    const resolveShortcutFaviconDataUrl = vi.fn(() => Promise.resolve(''));
    const { view } = createView({
      getShortcutFaviconCandidateUrl: () => assetUrl,
      resolveShortcutFaviconDataUrl,
      attachFaviconWithFallbacks: attachFavicon
    });
    renderItems(view, [{ id: 'xhs', title: '小红书', url: 'https://www.xiaohongshu.com/' }]);
    expect(resolveShortcutFaviconDataUrl).not.toHaveBeenCalled();
    expect(document.querySelector('.x-nt-shortcut-favicon-mask')?.getAttribute('data-builtin-icon')).toBe('true');
    expect(attachFavicon).toHaveBeenLastCalledWith(
      expect.any(HTMLImageElement), 'https://www.xiaohongshu.com/', 'example.com',
      { primaryUrl: assetUrl, pageSpecificUrl: '', skipPersisted: true, sourceProfile: 'shortcut' }
    );
  });

  it('retries a missing snapshot after policy changes and then retains the saved image', async () => {
    let revision = 0;
    let cachedDataUrl = '';
    const savedImage = 'data:image/png;base64,c25hcHNob3Q=';
    const acquireIcon = vi.fn()
      .mockResolvedValueOnce('')
      .mockImplementationOnce(async () => {
        cachedDataUrl = savedImage;
        return savedImage;
      });
    const attachFavicon = vi.fn();
    const { view } = createView({
      getShortcutFaviconPolicyRevision: () => revision,
      getShortcutFaviconDataUrl: () => cachedDataUrl,
      resolveShortcutFaviconDataUrl: acquireIcon,
      attachFaviconWithFallbacks: attachFavicon
    });
    const items = [{ id: 'stable', title: 'Stable', url: 'https://unlisted.example/' }];
    renderItems(view, items);
    await act(async () => { await Promise.resolve(); });
    expect(acquireIcon).toHaveBeenCalledTimes(1);
    revision += 1;
    renderItems(view, items);
    await act(async () => { await Promise.resolve(); });
    expect(acquireIcon).toHaveBeenCalledTimes(2);
    expect(attachFavicon).toHaveBeenLastCalledWith(
      expect.any(HTMLImageElement), 'https://unlisted.example/', 'example.com',
      { primaryUrl: '', pageSpecificUrl: savedImage, skipPersisted: true, sourceProfile: 'shortcut' }
    );
    revision += 1;
    renderItems(view, items);
    expect(acquireIcon).toHaveBeenCalledTimes(2);
  });

  it('waits for a saved icon without displaying a live browser favicon', async () => {
    const attachFavicon = vi.fn();
    let finishResolution: (dataUrl: string) => void = () => {};
    const resolveShortcutFaviconDataUrl = vi.fn(() => new Promise<string>((resolve) => {
      finishResolution = resolve;
    }));
    const { view } = createView({
      attachFaviconWithFallbacks: attachFavicon,
      getShortcutFaviconDataUrl: () => '',
      resolveShortcutFaviconDataUrl
    });
    renderItems(view, [{
      id: 'docs',
      title: 'Docs',
      url: 'https://example.com/docs'
    }]);

    expect(attachFavicon).toHaveBeenCalledOnce();
    expect(resolveShortcutFaviconDataUrl).toHaveBeenCalledWith(
      'https://example.com/docs'
    );

    await act(async () => {
      finishResolution('data:image/png;base64,aGlnaC1yZXM=');
      await Promise.resolve();
    });

    expect(attachFavicon).toHaveBeenCalledTimes(2);
    expect(attachFavicon).toHaveBeenLastCalledWith(
      expect.any(HTMLImageElement),
      'https://example.com/docs',
      'example.com',
      {
        primaryUrl: '',
        pageSpecificUrl: 'data:image/png;base64,aGlnaC1yZXM=',
        skipPersisted: true,
        sourceProfile: 'shortcut'
      }
    );
  });

  it('uses a cached page-specific icon without acquiring a new one', () => {
    const attachFavicon = vi.fn();
    const resolveShortcutFaviconDataUrl = vi.fn(() => Promise.resolve(''));
    const developerConsoleUrl =
      'https://chrome.google.com/webstore/devconsole/example?hl=zh-cn';
    const { view } = createView({
      attachFaviconWithFallbacks: attachFavicon,
      getShortcutFaviconDataUrl: () => 'data:image/png;base64,Y2FjaGVkLWhk',
      resolveShortcutFaviconDataUrl
    });
    renderItems(view, [{
      id: 'docs',
      title: 'Docs',
      url: developerConsoleUrl
    }]);

    const image = view.getTiles()[0]
      .querySelector<HTMLImageElement>('.x-nt-shortcut-favicon');
    expect(image?.getAttribute('src')).toBeNull();
    expect(attachFavicon).toHaveBeenCalledWith(
      image,
      developerConsoleUrl,
      'example.com',
      {
        primaryUrl: '',
        pageSpecificUrl: 'data:image/png;base64,Y2FjaGVkLWhk',
        skipPersisted: true,
        sourceProfile: 'shortcut'
      }
    );
    expect(resolveShortcutFaviconDataUrl).not.toHaveBeenCalled();
  });

  it('keeps page-specific icons isolated for shortcuts on the same host', () => {
    const attachFavicon = vi.fn();
    const profileUrl = 'https://x.com/thsottiaux';
    const homeUrl = 'https://x.com/home';
    const profileIcon = 'data:image/jpeg;base64,dGlibw==';
    const homeIcon = 'data:image/png;base64,eA==';
    const { view } = createView({
      getHostFromUrl: () => 'x.com',
      getShortcutFaviconDataUrl: (url) =>
        url === profileUrl ? profileIcon : homeIcon,
      getShortcutFaviconCandidateUrl: () => '',
      attachFaviconWithFallbacks: attachFavicon
    });

    renderItems(view, [
      { id: 'profile', title: 'Tibo', url: profileUrl },
      { id: 'home', title: 'X', url: homeUrl }
    ]);

    expect(attachFavicon).toHaveBeenCalledTimes(2);
    expect(attachFavicon).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      profileUrl,
      'x.com',
      {
        primaryUrl: '',
        pageSpecificUrl: profileIcon,
        skipPersisted: true,
        sourceProfile: 'shortcut'
      }
    );
    expect(attachFavicon).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      homeUrl,
      'x.com',
      {
        primaryUrl: '',
        pageSpecificUrl: homeIcon,
        skipPersisted: true,
        sourceProfile: 'shortcut'
      }
    );
  });

  it('preserves keyed tile nodes when legacy drag order is synchronized', () => {
    const { view, options } = createView();
    const first = {
      id: 'first',
      title: 'First',
      url: 'https://first.example/'
    };
    const second = {
      id: 'second',
      title: 'Second',
      url: 'https://second.example/'
    };
    renderItems(view, [first, second]);
    const firstTile = view.getTiles()[0];
    const secondTile = view.getTiles()[1];
    const grid = options.grid as HTMLElement;

    grid.insertBefore(secondTile, firstTile);
    renderItems(view, [second, first]);

    expect(view.getTiles()).toEqual([secondTile, firstTile]);
    expect(view.getTiles()[0].dataset.shortcutId).toBe('second');
    expect(view.getTiles()[1].dataset.shortcutId).toBe('first');
  });
  describe('groups', () => {
    const groups = [{ id: 'g0', title: '' }, { id: 'work', title: '工作' }];
    const items = [
      { id: 'a', title: 'A', url: 'https://a.example/', groupId: 'g0' },
      { id: 'b', title: 'B', url: 'https://b.example/', groupId: 'work' },
      { id: 'c', title: 'C', url: 'https://c.example/', groupId: 'work' }
    ];
    const childSummary = (grid: HTMLElement) => Array.from(grid.children).map((child) => (
      child.classList.contains('x-nt-shortcut-group-header')
        ? `#${child.getAttribute('data-shortcut-group-id')}`
        : child.getAttribute('data-shortcut-id') || 'add'
    ));

    it('renders each group title before its tiles in one grid', () => {
      const groupHeaders: HTMLElement[] = [];
      const { view, options } = createView({
        groupHeaders,
        getGroupPlaceholder: () => 'Add a title'
      });
      const grid = options.grid as HTMLElement;
      renderItems(view, items, { grouped: true, groups });

      expect(grid.getAttribute('data-shortcut-grouped')).toBe('true');
      expect(childSummary(grid)).toEqual(['#g0', 'a', '#work', 'b', 'c', 'add']);
      expect(groupHeaders.map((header) => header.dataset.shortcutGroupId)).toEqual(['g0', 'work']);
      expect(view.getTiles().map((tile) => tile.dataset.shortcutGroupId)).toEqual(['g0', 'work', 'work']);
      expect(groupHeaders[0].dataset.shortcutGroupUntitled).toBe('true');
      expect(groupHeaders[0].textContent).toContain('Add a title');
      expect(groupHeaders[1].querySelector('.x-nt-shortcut-group-title')?.textContent).toBe('工作');

      renderItems(view, items, { grouped: false, groups });
      expect(grid.hasAttribute('data-shortcut-grouped')).toBe(false);
      expect(childSummary(grid)).toEqual(['a', 'b', 'c', 'add']);
      expect(groupHeaders).toEqual([]);
    });

    it('gives an empty group a slot that adds to it and stands in for an empty last group\'s add tile', () => {
      const onGroupAdd = vi.fn();
      const { view, options } = createView({ onGroupAdd, getGroupEmptyLabel: () => 'Add site' });
      const grid = options.grid as HTMLElement;
      const withEmpty = [...groups, { id: 'empty', title: 'Empty' }];
      renderItems(view, items, { grouped: true, groups: withEmpty });

      expect(childSummary(grid)).toEqual(['#g0', 'a', '#work', 'b', 'c', '#empty', 'add', 'add']);
      const slot = grid.querySelector<HTMLButtonElement>('.x-nt-shortcut-group-empty')!;
      expect(slot.dataset.shortcutGroupId).toBe('empty');
      expect(slot.getAttribute('aria-label')).toBe('Add site');
      expect(view.getAddButton()?.hidden).toBe(true);
      act(() => { slot.click(); });
      expect(onGroupAdd).toHaveBeenCalledWith('empty', slot);

      renderItems(view, items, { grouped: true, groups: [withEmpty[0], withEmpty[2], withEmpty[1]] });
      expect(view.getAddButton()?.hidden).toBe(false);
      expect(grid.querySelectorAll('.x-nt-shortcut-group-empty')).toHaveLength(1);
    });

    it('hugs the longest group row so short groups stay centered', () => {
      const { view, options } = createView({ maxShortcuts: 50 });
      const grid = options.grid as HTMLElement;
      const columns = () => grid.style.getPropertyValue('--x-nt-shortcut-grouped-columns');

      renderItems(view, items, { grouped: true, groups });
      // The last group's two sites and its add tile.
      expect(columns()).toBe('3');
      // An empty last group holds its slot instead of the add tile.
      renderItems(view, items, { grouped: true, groups: [...groups, { id: 'empty', title: 'Empty' }] });
      expect(columns()).toBe('2');
      renderItems(view, items, { grouped: false, groups });
      expect(columns()).toBe('');
    });

    it('keeps a tile node when it moves into another group', () => {
      const { view } = createView();
      renderItems(view, items, { grouped: true, groups });
      const tile = view.getTiles()[0];
      renderItems(view, [{ ...items[1] }, { ...items[0], groupId: 'work' }, items[2]], { grouped: true, groups });

      expect(view.getTiles()[1]).toBe(tile);
      expect(tile.dataset.shortcutGroupId).toBe('work');
    });

    it('opens the group menu from its button or a right click', () => {
      const onGroupMenu = vi.fn();
      const { view, options } = createView({ onGroupMenu, getGroupActionsLabel: (title) => `${title} actions` });
      renderItems(view, items, { grouped: true, groups });
      const header = (options.grid as HTMLElement).querySelector<HTMLElement>('[data-shortcut-group-id="work"]')!;
      const more = header.querySelector<HTMLButtonElement>('.x-nt-shortcut-group-more')!;

      expect(more.getAttribute('aria-label')).toBe('工作 actions');
      act(() => { more.click(); });
      act(() => {
        header.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      });
      expect(onGroupMenu).toHaveBeenNthCalledWith(1, 'work', more);
      expect(onGroupMenu).toHaveBeenNthCalledWith(2, 'work', more);
    });

    it('asks to rename a group from a double-clicked title or an untitled group\'s placeholder', () => {
      const onGroupRename = vi.fn();
      const { view, options } = createView({ onGroupRename });
      const grid = options.grid as HTMLElement;
      renderItems(view, items, { grouped: true, groups });

      const title = grid.querySelector<HTMLElement>('[data-shortcut-group-id="work"] .x-nt-shortcut-group-title')!;
      act(() => { title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
      expect(onGroupRename).toHaveBeenLastCalledWith('work', title);

      const placeholder = grid.querySelector<HTMLButtonElement>('.x-nt-shortcut-group-title--placeholder')!;
      act(() => { placeholder.click(); });
      expect(onGroupRename).toHaveBeenLastCalledWith('g0', placeholder);
      expect(grid.querySelector('input')).toBeNull();
    });
  });
});
