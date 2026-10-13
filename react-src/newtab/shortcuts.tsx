import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

type ThemeValue = unknown;

export interface ShortcutItem {
  id?: string;
  url?: string;
  host?: string;
  title?: string;
  groupId?: string;
  [key: string]: unknown;
}

export interface ShortcutGroup {
  id: string;
  title: string;
}

// Without `grouped`, shortcuts render as one centered run of tiles.
export interface ShortcutsLayout {
  grouped?: boolean;
  groups?: ShortcutGroup[];
  editingGroupId?: string;
}

interface ThemeSuggestion {
  type: 'shortcut';
  url: string;
  title: string;
  customIconDataUrl: string;
}

export interface ShortcutTileElement extends HTMLButtonElement {
  _xHost?: string;
  _xTheme?: ThemeValue;
  _xShortcutSuppressClick?: boolean;
  _xSetBookmarkMenuVisualActive?: (active: boolean) => void;
}

export interface ShortcutsViewOptions {
  getFolderIconSvg?: (idSuffix: string, folderId?: string) => string;
  initFolderIcon?: (icon: HTMLElement) => void;
  animateFolderIcon?: (icon: HTMLElement, active: boolean) => void;
  onFolderMenuChange?: (tile: HTMLElement) => void;
  grid?: HTMLElement | null;
  tiles?: ShortcutTileElement[];
  maxShortcuts?: number;
  getShortcutTitle?: (shortcut: ShortcutItem) => string;
  getHostFromUrl?: (url: string) => string;
  getShortcutIconDataUrl?: (shortcutId: string) => string;
  getShortcutFaviconDataUrl?: (pageUrl: string) => string;
  resolveShortcutFaviconDataUrl?: (pageUrl: string) => Promise<string>;
  getShortcutFaviconPolicyRevision?: () => number;
  getShortcutFaviconCandidateUrl?: (url: string) => string;
  getImmediateThemeForSuggestion?: (
    suggestion: ThemeSuggestion
  ) => ThemeValue;
  applyShortcutTileTheme?: (
    tile: ShortcutTileElement,
    theme: ThemeValue,
    host: string
  ) => void;
  queueThemeForTarget?: (
    tile: ShortcutTileElement,
    suggestion: ThemeSuggestion,
    onTheme: (theme: ThemeValue) => void,
    options: { priority: number }
  ) => void;
  attachFaviconWithFallbacks?: (
    image: HTMLImageElement,
    pageUrl: string,
    host: string,
    options: {
      primaryUrl: string;
      browserUrl?: string;
      pageSpecificUrl?: string;
      skipPersisted?: boolean;
      sourceProfile?: 'shortcut';
    }
  ) => void;
  bindTooltip?: (
    target: HTMLElement,
    getText: () => string,
    options: { maxWidth: number }
  ) => unknown;
  hideTooltip?: () => void;
  formatOpenLabel?: (title: string) => string;
  isMiddleClick?: (event: ReactMouseEvent<HTMLElement>) => boolean;
  openShortcut?: (
    shortcut: ShortcutItem,
    event: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>
  ) => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onNativeDragStart?: (event: ReactDragEvent<HTMLButtonElement>) => void;
  getAddLabel?: () => string;
  getAddIconSvg?: () => string;
  getAddVisible?: () => boolean;
  onAdd?: (sourceElement: HTMLButtonElement) => void;
  onAddContextMenu?: (sourceElement: HTMLButtonElement) => void;
  groupHeaders?: HTMLElement[];
  getGroupPlaceholder?: () => string;
  getGroupTitleLabel?: () => string;
  getGroupActionsLabel?: (title: string) => string;
  getGroupMoreIconSvg?: () => string;
  onGroupMenu?: (groupId: string, anchor: HTMLElement) => void;
  onGroupRenameStart?: (groupId: string) => void;
  onGroupRename?: (groupId: string, title: string) => void;
  onGroupRenameCancel?: () => void;
  getGroupEmptyLabel?: () => string;
  onGroupAdd?: (groupId: string, sourceElement: HTMLButtonElement) => void;
}

export interface ShortcutsViewController {
  render(items: ShortcutItem[], layout?: ShortcutsLayout): { count: number };
  clear(): void;
  refreshElements(): void;
  getTiles(): ShortcutTileElement[];
  getAddButton(): HTMLButtonElement | null;
}

interface NormalizedOptions {
  getFolderIconSvg: (idSuffix: string, folderId?: string) => string;
  initFolderIcon: (icon: HTMLElement) => void;
  animateFolderIcon: (icon: HTMLElement, active: boolean) => void;
  onFolderMenuChange: (tile: HTMLElement) => void;
  grid: HTMLElement;
  tiles: ShortcutTileElement[];
  maxShortcuts: number;
  getShortcutTitle: (shortcut: ShortcutItem) => string;
  getHostFromUrl: (url: string) => string;
  getShortcutIconDataUrl: (shortcutId: string) => string;
  getShortcutFaviconDataUrl: (pageUrl: string) => string;
  resolveShortcutFaviconDataUrl: (pageUrl: string) => Promise<string>;
  getShortcutFaviconPolicyRevision: () => number;
  getShortcutFaviconCandidateUrl: (url: string) => string;
  getImmediateThemeForSuggestion: (
    suggestion: ThemeSuggestion
  ) => ThemeValue;
  applyShortcutTileTheme: (
    tile: ShortcutTileElement,
    theme: ThemeValue,
    host: string
  ) => void;
  queueThemeForTarget: (
    tile: ShortcutTileElement,
    suggestion: ThemeSuggestion,
    onTheme: (theme: ThemeValue) => void,
    options: { priority: number }
  ) => void;
  attachFaviconWithFallbacks: (
    image: HTMLImageElement,
    pageUrl: string,
    host: string,
    options: {
      primaryUrl: string;
      browserUrl?: string;
      pageSpecificUrl?: string;
      skipPersisted?: boolean;
      sourceProfile?: 'shortcut';
    }
  ) => void;
  bindTooltip: (
    target: HTMLElement,
    getText: () => string,
    options: { maxWidth: number }
  ) => unknown;
  hideTooltip: () => void;
  formatOpenLabel: (title: string) => string;
  isMiddleClick: (event: ReactMouseEvent<HTMLElement>) => boolean;
  openShortcut: (
    shortcut: ShortcutItem,
    event: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>
  ) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onNativeDragStart: (event: ReactDragEvent<HTMLButtonElement>) => void;
  getAddLabel: () => string;
  getAddIconSvg: () => string;
  getAddVisible: () => boolean;
  onAdd: (sourceElement: HTMLButtonElement) => void;
  onAddContextMenu: (sourceElement: HTMLButtonElement) => void;
  groupHeaders: HTMLElement[];
  getGroupPlaceholder: () => string;
  getGroupTitleLabel: () => string;
  getGroupActionsLabel: (title: string) => string;
  getGroupMoreIconSvg: () => string;
  onGroupMenu: (groupId: string, anchor: HTMLElement) => void;
  onGroupRenameStart: (groupId: string) => void;
  onGroupRename: (groupId: string, title: string) => void;
  onGroupRenameCancel: () => void;
  getGroupEmptyLabel: () => string;
  onGroupAdd: (groupId: string, sourceElement: HTMLButtonElement) => void;
}

function normalizeOptions(
  options: ShortcutsViewOptions = {}
): NormalizedOptions | null {
  if (!options.grid) {
    return null;
  }
  return {
    getFolderIconSvg: options.getFolderIconSvg || (() => ''),
    initFolderIcon: options.initFolderIcon || (() => {}),
    animateFolderIcon: options.animateFolderIcon || (() => {}),
    onFolderMenuChange: options.onFolderMenuChange || (() => {}),
    grid: options.grid,
    tiles: Array.isArray(options.tiles) ? options.tiles : [],
    maxShortcuts: Number.isFinite(Number(options.maxShortcuts))
      ? Math.max(0, Math.floor(Number(options.maxShortcuts)))
      : Number.POSITIVE_INFINITY,
    getShortcutTitle: options.getShortcutTitle || (() => ''),
    getHostFromUrl: options.getHostFromUrl || (() => ''),
    getShortcutIconDataUrl: options.getShortcutIconDataUrl || (() => ''),
    getShortcutFaviconDataUrl:
      options.getShortcutFaviconDataUrl || (() => ''),
    resolveShortcutFaviconDataUrl:
      options.resolveShortcutFaviconDataUrl || (() => Promise.resolve('')),
    getShortcutFaviconPolicyRevision:
      options.getShortcutFaviconPolicyRevision || (() => 0),
    getShortcutFaviconCandidateUrl:
      options.getShortcutFaviconCandidateUrl || (() => ''),
    getImmediateThemeForSuggestion:
      options.getImmediateThemeForSuggestion || (() => null),
    applyShortcutTileTheme: options.applyShortcutTileTheme || (() => {}),
    queueThemeForTarget: options.queueThemeForTarget || (() => {}),
    attachFaviconWithFallbacks:
      options.attachFaviconWithFallbacks || (() => {}),
    bindTooltip: options.bindTooltip || (() => null),
    hideTooltip: options.hideTooltip || (() => {}),
    formatOpenLabel: options.formatOpenLabel || ((title) => title),
    isMiddleClick:
      options.isMiddleClick ||
      ((event) => Number(event.button) === 1),
    openShortcut: options.openShortcut || (() => {}),
    onContextMenu: options.onContextMenu || (() => {}),
    onNativeDragStart: options.onNativeDragStart || ((event) => {
      event.preventDefault();
    }),
    getAddLabel: options.getAddLabel || (() => ''),
    getAddIconSvg: options.getAddIconSvg || (() => ''),
    getAddVisible: options.getAddVisible || (() => true),
    onAdd: options.onAdd || (() => {}),
    onAddContextMenu: options.onAddContextMenu || (() => {}),
    groupHeaders: Array.isArray(options.groupHeaders) ? options.groupHeaders : [],
    getGroupPlaceholder: options.getGroupPlaceholder || (() => ''),
    getGroupTitleLabel: options.getGroupTitleLabel || (() => ''),
    getGroupActionsLabel: options.getGroupActionsLabel || ((title) => title),
    getGroupMoreIconSvg: options.getGroupMoreIconSvg || (() => ''),
    onGroupMenu: options.onGroupMenu || (() => {}),
    onGroupRenameStart: options.onGroupRenameStart || (() => {}),
    onGroupRename: options.onGroupRename || (() => {}),
    onGroupRenameCancel: options.onGroupRenameCancel || (() => {}),
    getGroupEmptyLabel: options.getGroupEmptyLabel || (() => ''),
    onGroupAdd: options.onGroupAdd || (() => {})
  };
}

function ShortcutFavicon({
  shortcut,
  host,
  options
}: {
  shortcut: ShortcutItem;
  host: string;
  options: NormalizedOptions;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const shortcutId = String(shortcut.id || '');
  const url = String(shortcut.url || '');
  const iconSource = String(shortcut.iconSource || '');
  const localIconDataUrl = options.getShortcutIconDataUrl(shortcutId);
  const primaryFaviconUrl = options.getShortcutFaviconCandidateUrl(url);
  const isBuiltinIcon = !localIconDataUrl && /\/assets\/images\/site-search\/glyph-[a-z0-9]+\.(?:svg|png)(?:[?#]|$)/.test(primaryFaviconUrl);
  const isMonochromeBuiltinIcon = isBuiltinIcon && /\/glyph-(?:gh|gpt|mdn|wk|zw)\.svg(?:[?#]|$)/.test(primaryFaviconUrl);
  const cachedFaviconDataUrl = options.getShortcutFaviconDataUrl(url);
  const faviconPolicyRevision = options.getShortcutFaviconPolicyRevision();
  const [resolvedFavicon, setResolvedFavicon] = useState({ url, iconSource, dataUrl: cachedFaviconDataUrl });
  const fallbackFaviconDataUrl =
    cachedFaviconDataUrl || (resolvedFavicon.url === url && resolvedFavicon.iconSource === iconSource ? resolvedFavicon.dataUrl : '');

  useEffect(() => {
    let cancelled = false;
    if (localIconDataUrl || cachedFaviconDataUrl || primaryFaviconUrl) {
      setResolvedFavicon({ url, iconSource, dataUrl: cachedFaviconDataUrl });
      return () => {
        cancelled = true;
      };
    }
    setResolvedFavicon({ url, iconSource, dataUrl: '' });
    options.resolveShortcutFaviconDataUrl(url).then((dataUrl) => {
      if (!cancelled && dataUrl) {
        setResolvedFavicon({ url, iconSource, dataUrl });
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cachedFaviconDataUrl, faviconPolicyRevision, iconSource, localIconDataUrl, options, primaryFaviconUrl, url]);

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!image) {
      return;
    }
    if (localIconDataUrl) {
      image.parentElement
        ?.querySelectorAll('._x_extension_favicon_fallback_2024_unique_')
        .forEach((node) => node.remove());
      return;
    }
    options.attachFaviconWithFallbacks(image, url, host, {
      primaryUrl: primaryFaviconUrl,
      pageSpecificUrl: fallbackFaviconDataUrl,
      skipPersisted: true,
      sourceProfile: 'shortcut'
    });
  }, [fallbackFaviconDataUrl, host, localIconDataUrl, options, primaryFaviconUrl, url]);

  return (
    <span className="x-nt-shortcut-icon">
      <span className="x-nt-shortcut-favicon-mask" data-builtin-icon={isBuiltinIcon ? 'true' : undefined} data-builtin-monochrome={isMonochromeBuiltinIcon ? 'true' : undefined}>
        <img
          key={localIconDataUrl || url}
          ref={imageRef}
          className="x-nt-shortcut-favicon"
          alt=""
          loading="lazy"
          draggable={false}
          src={localIconDataUrl || undefined}
        />
      </span>
    </span>
  );
}

function ShortcutTile({
  shortcut,
  options
}: {
  shortcut: ShortcutItem;
  options: NormalizedOptions;
}) {
  const tileRef = useRef<ShortcutTileElement>(null);
  const folderIconRef = useRef<HTMLSpanElement>(null);
  const isFolder = shortcut.type === 'folder';
  const title = options.getShortcutTitle(shortcut);
  const url = String(shortcut.url || '');
  const host = String(shortcut.host || options.getHostFromUrl(url));
  const shortcutId = String(shortcut.id || url);
  // Preserve the SVG paths owned by the animation runtime across list refreshes.
  const folderIconHtml = useMemo(() => ({
    __html: isFolder ? options.getFolderIconSvg(`shortcut-${shortcutId}`, String(shortcut.folderId || '')) : ''
  }), [isFolder, options, shortcutId, shortcut.folderId]);
  const localIconDataUrl = options.getShortcutIconDataUrl(
    String(shortcut.id || '')
  );
  const themeSuggestion = useMemo<ThemeSuggestion>(() => ({
    type: 'shortcut',
    url,
    title,
    customIconDataUrl: localIconDataUrl
  }), [localIconDataUrl, title, url]);

  useLayoutEffect(() => {
    const tile = tileRef.current;
    if (!tile) {
      return;
    }
    const immediateTheme =
      options.getImmediateThemeForSuggestion(themeSuggestion);
    tile._xHost = host;
    tile._xTheme = immediateTheme;
    options.applyShortcutTileTheme(tile, immediateTheme, host);
    options.bindTooltip(
      tile,
      () => tile.getAttribute('data-shortcut-title') || title,
      { maxWidth: 360 }
    );
    if (isFolder && folderIconRef.current) {
      const icon = folderIconRef.current;
      options.initFolderIcon(icon);
      tile._xSetBookmarkMenuVisualActive = (active) => {
        const expanded = active || tile.getAttribute('aria-expanded') === 'true' ||
          tile.hasAttribute('data-shortcut-context-menu-open');
        tile.toggleAttribute('data-shortcut-folder-open', expanded);
        options.animateFolderIcon(icon, expanded);
        options.onFolderMenuChange(tile);
      };
      return () => { delete tile._xSetBookmarkMenuVisualActive; };
    }
    options.queueThemeForTarget(
      tile,
      themeSuggestion,
      (theme) => {
        if (!tile.isConnected) {
          return;
        }
        tile._xTheme = theme || tile._xTheme;
        options.applyShortcutTileTheme(tile, theme, host);
      },
      { priority: 0 }
    );
  }, [host, isFolder, options, themeSuggestion, title]);

  function activate(
    event: ReactMouseEvent<HTMLButtonElement> |
      ReactKeyboardEvent<HTMLButtonElement>
  ): void {
    const tile = tileRef.current;
    if (tile?._xShortcutSuppressClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    options.hideTooltip();
    options.openShortcut(shortcut, event);
  }

  function handleAuxClick(event: ReactMouseEvent<HTMLButtonElement>): void {
    if (!options.isMiddleClick(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    options.openShortcut(shortcut, event);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    activate(event);
  }

  return (
    <button
      ref={tileRef}
      type="button"
      className={`x-nt-shortcut-tile${isFolder ? ' x-nt-shortcut-tile--folder' : ''}`}
      draggable={false}
      data-shortcut-id={shortcutId}
      data-shortcut-group-id={shortcut.groupId ? String(shortcut.groupId) : undefined}
      data-shortcut-url={url}
      data-shortcut-title={title}
      data-shortcut-draggable="true"
      data-bookmark-id={isFolder ? String(shortcut.folderId || '') : undefined}
      data-bookmark-drop-folder-id={isFolder ? String(shortcut.folderId || '') : undefined}
      data-bookmark-drop-folder-title={isFolder ? title : undefined}
      aria-haspopup={isFolder ? 'menu' : undefined}
      aria-expanded={isFolder ? false : undefined}
      data-shortcut-custom-icon={localIconDataUrl ? 'true' : undefined}
      data-tooltip={title}
      aria-label={options.formatOpenLabel(title)}
      onClick={activate}
      onAuxClick={handleAuxClick}
      onKeyDown={handleKeyDown}
      onContextMenu={options.onContextMenu}
      onDragStart={options.onNativeDragStart}
      onPointerEnter={() => {
        if (folderIconRef.current && !document.body.hasAttribute('data-drag-source')) {
          options.animateFolderIcon(folderIconRef.current, true);
        }
      }}
      onPointerLeave={() => {
        if (folderIconRef.current && !tileRef.current?.hasAttribute('data-shortcut-folder-open')) {
          options.animateFolderIcon(folderIconRef.current, false);
        }
      }}
    >
      {isFolder ? <span
        ref={folderIconRef}
        className="x-nt-shortcut-icon x-nt-shortcut-icon--folder"
        dangerouslySetInnerHTML={folderIconHtml}
      /> : <ShortcutFavicon
        shortcut={shortcut}
        host={host}
        options={options}
      />}
    </button>
  );
}

// A group's title row spans the whole grid, so its tiles start on a new row
// and every row holds tiles of one group. Its title edits in place.
function ShortcutGroupHeader({
  group,
  editing,
  options
}: {
  group: ShortcutGroup;
  editing: boolean;
  options: NormalizedOptions;
}) {
  const moreRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishedRef = useRef(false);
  const [draft, setDraft] = useState(group.title);

  useLayoutEffect(() => {
    if (!editing) {
      return;
    }
    finishedRef.current = false;
    setDraft(group.title);
    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select();
    }
    // The draft starts from the title the edit opened with.
  }, [editing]);

  function finish(save: boolean): void {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    if (save) {
      options.onGroupRename(group.id, draft);
    } else {
      options.onGroupRenameCancel();
    }
  }

  function openMenu(): void {
    options.hideTooltip();
    options.onGroupMenu(group.id, moreRef.current as HTMLElement);
  }

  return (
    <div
      className="x-nt-shortcut-group-header"
      data-shortcut-group-id={group.id}
      data-shortcut-group-untitled={group.title ? undefined : 'true'}
      data-shortcut-group-editing={editing ? 'true' : undefined}
      onContextMenu={(event) => {
        if (editing) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        openMenu();
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="x-nt-shortcut-group-input"
          type="text"
          value={draft}
          maxLength={24}
          spellCheck={false}
          autoComplete="off"
          aria-label={options.getGroupTitleLabel()}
          placeholder={options.getGroupPlaceholder()}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) {
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              finish(true);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              finish(false);
            }
          }}
          onBlur={() => finish(true)}
        />
      ) : group.title ? (
        <span
          className="x-nt-shortcut-group-title"
          onDoubleClick={() => options.onGroupRenameStart(group.id)}
        >
          {group.title}
        </span>
      ) : (
        <button
          type="button"
          className="x-nt-shortcut-group-title x-nt-shortcut-group-title--placeholder"
          onClick={() => options.onGroupRenameStart(group.id)}
        >
          {options.getGroupPlaceholder()}
        </button>
      )}
      {editing ? null : (
        <button
          ref={moreRef}
          type="button"
          className="x-nt-shortcut-group-more"
          aria-haspopup="menu"
          aria-label={options.getGroupActionsLabel(group.title)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openMenu();
          }}
          dangerouslySetInnerHTML={{ __html: options.getGroupMoreIconSvg() }}
        />
      )}
    </div>
  );
}

function ShortcutsList({
  items,
  layout,
  options,
  addButtonRef
}: {
  items: ShortcutItem[];
  layout: ShortcutsLayout;
  options: NormalizedOptions;
  addButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const addLabel = options.getAddLabel();
  const keys = new Map<string, number>();
  const renderTile = (shortcut: ShortcutItem) => {
    const identity = String(shortcut.id || shortcut.url || 'shortcut');
    const occurrence = keys.get(identity) || 0;
    keys.set(identity, occurrence + 1);
    return (
      <ShortcutTile
        key={`${identity}:${occurrence}`}
        shortcut={shortcut}
        options={options}
      />
    );
  };
  const groups = layout.grouped && Array.isArray(layout.groups) ? layout.groups : null;
  const emptyLabel = options.getGroupEmptyLabel();
  const isEmpty = (group: ShortcutGroup) => !items.some((shortcut) => shortcut.groupId === group.id);
  // An empty group shows a slot that adds a site to it and takes drops;
  // when the last group is empty, that slot stands in for the add tile.
  const lastGroupEmpty = Boolean(groups && groups.length && isEmpty(groups[groups.length - 1]));
  return (
    <>
      {groups
        ? groups.flatMap((group) => [
          <ShortcutGroupHeader
            key={`group:${group.id}`}
            group={group}
            editing={layout.editingGroupId === group.id}
            options={options}
          />,
          ...(isEmpty(group)
            ? [
              <button
                key={`group-empty:${group.id}`}
                type="button"
                className="x-nt-shortcut-group-empty"
                data-shortcut-group-id={group.id}
                aria-label={emptyLabel}
                hidden={items.length >= options.maxShortcuts}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  options.hideTooltip();
                  options.onGroupAdd(group.id, event.currentTarget);
                }}
              >
                <span
                  className="x-nt-shortcut-icon x-nt-shortcut-icon--add"
                  dangerouslySetInnerHTML={{ __html: options.getAddIconSvg() }}
                />
              </button>
            ]
            : items.filter((shortcut) => shortcut.groupId === group.id).map(renderTile))
        ])
        : items.map(renderTile)}
      <button
        ref={addButtonRef}
        type="button"
        className="x-nt-shortcut-tile x-nt-shortcut-tile--add"
        hidden={!options.getAddVisible() || items.length >= options.maxShortcuts || lastGroupEmpty}
        data-tooltip={addLabel}
        aria-label={addLabel}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          options.hideTooltip();
          options.onAdd(event.currentTarget);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          options.hideTooltip();
          options.onAddContextMenu(event.currentTarget);
        }}
      >
        <span
          className="x-nt-shortcut-icon x-nt-shortcut-icon--add"
          dangerouslySetInnerHTML={{ __html: options.getAddIconSvg() }}
        />
      </button>
    </>
  );
}

function createNoopController(
  options: ShortcutsViewOptions
): ShortcutsViewController {
  const tiles = Array.isArray(options.tiles) ? options.tiles : [];
  return {
    render() {
      tiles.length = 0;
      return { count: 0 };
    },
    clear() {
      tiles.length = 0;
    },
    refreshElements() {
      tiles.length = 0;
    },
    getTiles() {
      return tiles;
    },
    getAddButton() {
      return null;
    }
  };
}

export function createShortcutsView(
  rawOptions: ShortcutsViewOptions = {}
): ShortcutsViewController {
  const normalizedOptions = normalizeOptions(rawOptions);
  if (!normalizedOptions) {
    return createNoopController(rawOptions);
  }
  const options: NormalizedOptions = normalizedOptions;
  const reactRoot: Root = createRoot(options.grid);
  const addButtonRef = { current: null } as {
    current: HTMLButtonElement | null;
  };
  options.grid.setAttribute('data-react-island', 'shortcuts');

  function refreshElements(): void {
    options.tiles.length = 0;
    options.grid
      .querySelectorAll<ShortcutTileElement>(
        '.x-nt-shortcut-tile[data-shortcut-id]'
      )
      .forEach((tile) => options.tiles.push(tile));
    addButtonRef.current = options.grid.querySelector<HTMLButtonElement>(
      '.x-nt-shortcut-tile--add'
    );
    options.groupHeaders.length = 0;
    options.grid
      .querySelectorAll<HTMLElement>('.x-nt-shortcut-group-header')
      .forEach((header) => options.groupHeaders.push(header));
  }

  function render(items: ShortcutItem[], layout: ShortcutsLayout = {}): { count: number } {
    const normalizedItems = Array.isArray(items) ? items : [];
    const grouped = Boolean(layout.grouped && Array.isArray(layout.groups) && layout.groups.length);
    options.hideTooltip();
    if (grouped) {
      options.grid.setAttribute('data-shortcut-grouped', 'true');
    } else {
      options.grid.removeAttribute('data-shortcut-grouped');
    }
    flushSync(() => {
      reactRoot.render(
        <ShortcutsList
          items={normalizedItems}
          layout={{ ...layout, grouped }}
          options={options}
          addButtonRef={addButtonRef}
        />
      );
    });
    refreshElements();
    const addButton = addButtonRef.current;
    if (addButton) {
      options.bindTooltip(
        addButton,
        () => addButton.getAttribute('data-tooltip') || options.getAddLabel(),
        { maxWidth: 260 }
      );
    }
    return { count: normalizedItems.length };
  }

  return {
    render,
    clear() {
      options.hideTooltip();
      flushSync(() => {
        reactRoot.render(null);
      });
      options.tiles.length = 0;
      options.groupHeaders.length = 0;
      addButtonRef.current = null;
    },
    refreshElements,
    getTiles() {
      return options.tiles;
    },
    getAddButton() {
      return addButtonRef.current;
    }
  };
}

export function createShortcutsViewApi() {
  return Object.freeze({
    implementation: 'react',
    createShortcutsView(options?: ShortcutsViewOptions) {
      return createShortcutsView(options);
    }
  });
}
