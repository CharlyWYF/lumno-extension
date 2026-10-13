(function(root, factory) {
  const references = root.LumnoBookmarkFolderReference || (typeof require === 'function'
    ? require('../shared/bookmark-folder-reference.js') : {});
  const api = factory(references);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoNewtabShortcutsStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(references) {
  // Shortcuts are stored as one state: ordered groups, and ordered items that
  // each name their group. Browser sync holds a compact copy of that state in
  // three keys under a fixed byte ceiling; whatever does not fit stays in this
  // device's local overflow record, which WebDAV carries between devices.
  const DEFAULT_MAX_SHORTCUTS = 200;
  const DEFAULT_MAX_SHORTCUT_GROUPS = 20;
  const SHORTCUT_GROUP_TITLE_MAX_LENGTH = 24;
  const DEFAULT_SHORTCUT_GROUP_ID = 'g0';
  const SHORTCUTS_STORAGE_VERSION = 2;
  const SHORTCUTS_SYNC_KEYS = Object.freeze([
    '_x_extension_newtab_shortcuts_v2_2026_unique_',
    '_x_extension_newtab_shortcuts_v2_chunk_2_2026_unique_',
    '_x_extension_newtab_shortcuts_v2_chunk_3_2026_unique_'
  ]);
  // The flat list older versions wrote. It is read until the first save in
  // the new format and then left untouched, because a device still running an
  // older version reads it (and backs it up to WebDAV) as its whole list.
  const LEGACY_SHORTCUTS_KEY = '_x_extension_newtab_shortcuts_2026_unique_';
  const LEGACY_SHORTCUTS_CHUNK_KEYS = Object.freeze([
    LEGACY_SHORTCUTS_KEY,
    '_x_extension_newtab_shortcuts_chunk_2_2026_unique_',
    '_x_extension_newtab_shortcuts_chunk_3_2026_unique_'
  ]);
  const SHORTCUT_STORAGE_KEYS = Object.freeze([...SHORTCUTS_SYNC_KEYS, ...LEGACY_SHORTCUTS_CHUNK_KEYS]);
  const SHORTCUTS_LOCAL_OVERFLOW_KEY = '_x_extension_newtab_shortcuts_local_overflow_2026_unique_';
  // Every older device has updated long before this, so the legacy copy can
  // give its sync bytes back.
  const LEGACY_SHORTCUTS_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  // chrome.storage.sync allows 8192 bytes per item; keep a margin under it.
  const DEFAULT_SHORTCUTS_SYNC_ITEM_BUDGET_BYTES = 7680;
  // Shortcuts never take more than this from browser sync, legacy copy included.
  const DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES =
    DEFAULT_SHORTCUTS_SYNC_ITEM_BUDGET_BYTES * SHORTCUTS_SYNC_KEYS.length;
  // Browser sync space shortcuts must leave to every other setting.
  const DEFAULT_SHORTCUTS_SYNC_RESERVE_BYTES = 64 * 1024;
  const DEFAULT_SYNC_QUOTA_BYTES = 100 * 1024;
  const DEFAULT_SHORTCUTS = Object.freeze([
    Object.freeze({
      id: 'shortcut-lumno-default',
      title: 'Lumno',
      url: 'https://lumno.kubai.design/'
    })
  ]);
  const BROWSER_INTERNAL_PROTOCOLS = new Set([
    'chrome:', 'edge:', 'brave:', 'vivaldi:', 'opera:'
  ]);
  const ICON_SOURCES = ['service', 'favicon-is', 'cache', 'custom', 'builtin'];
  const ID_PATTERN = /^[\w-]{1,120}$/;
  const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

  function defaultNormalizeHost(hostname) {
    return String(hostname || '').trim().toLowerCase().replace(/^www\./i, '');
  }

  function getNormalizeHost(options) {
    return options && typeof options.normalizeHost === 'function'
      ? options.normalizeHost
      : defaultNormalizeHost;
  }

  function sanitizeDisplayText(text, options) {
    const value = options && typeof options.sanitizeDisplayText === 'function'
      ? options.sanitizeDisplayText(text)
      : text;
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function getNow(options) {
    const raw = Number(options && options.now);
    return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : Date.now();
  }

  function getMaxShortcuts(options) {
    const raw = Number(options && options.maxShortcuts);
    return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : DEFAULT_MAX_SHORTCUTS;
  }

  function getMaxGroups(options) {
    const raw = Number(options && options.maxGroups);
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_MAX_SHORTCUT_GROUPS;
  }

  function getUtf8ByteLength(value) {
    let byteLength = 0;
    for (const character of String(value || '')) {
      const codePoint = character.codePointAt(0) || 0;
      if (codePoint <= 0x7f) {
        byteLength += 1;
      } else if (codePoint <= 0x7ff) {
        byteLength += 2;
      } else if (codePoint <= 0xffff) {
        byteLength += 3;
      } else {
        byteLength += 4;
      }
    }
    return byteLength;
  }

  function getShortcutStorageItemByteSize(key, value) {
    return getUtf8ByteLength(key) + getUtf8ByteLength(JSON.stringify(value));
  }

  function getShortcutStoragePayloadByteSize(payload) {
    return Object.entries(payload && typeof payload === 'object' ? payload : {})
      .reduce((total, [key, value]) => (
        total + getShortcutStorageItemByteSize(key, value)
      ), 0);
  }

  function getBudget(options, name, fallback) {
    const raw = Number(options && options[name]);
    return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
  }

  function stableHashCode(text) {
    const value = String(text || '');
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function randomToken(length) {
    const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    let token = '';
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      const bytes = cryptoApi.getRandomValues(new Uint8Array(length));
      bytes.forEach((byte) => { token += (byte % 36).toString(36); });
      return token;
    }
    while (token.length < length) {
      token += Math.floor(Math.random() * 36).toString(36);
    }
    return token;
  }

  function normalizeShortcutUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }
    const candidate = SCHEME_PATTERN.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(candidate);
      const isBrowserInternal = BROWSER_INTERNAL_PROTOCOLS.has(parsed.protocol);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && !isBrowserInternal) {
        return '';
      }
      if (!parsed.hostname) {
        return '';
      }
      if (isBrowserInternal) {
        if (parsed.username || parsed.password || parsed.port) {
          return '';
        }
        parsed.hostname = parsed.hostname.toLowerCase();
        parsed.pathname = parsed.pathname || '/';
      }
      return parsed.toString();
    } catch (error) {
      return '';
    }
  }

  // Short ids keep each synced entry small; older long ids stay valid.
  function createShortcutId(url, options) {
    return `s${getNow(options).toString(36)}${stableHashCode(url).slice(0, 4)}`;
  }

  function createShortcutGroupId() {
    return `g${Date.now().toString(36)}${randomToken(3)}`;
  }

  function normalizeId(value) {
    const id = String(value || '').trim();
    return ID_PATTERN.test(id) ? id : '';
  }

  function normalizeGroupTitle(value, options) {
    return Array.from(sanitizeDisplayText(value, options))
      .slice(0, SHORTCUT_GROUP_TITLE_MAX_LENGTH).join('');
  }

  function normalizeShortcutItem(item, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const source = item && typeof item === 'object' ? item : {};
    const groupId = normalizeId(source.groupId);
    const group = groupId ? { groupId } : {};
    if (source.type === 'folder') {
      const folderRef = references.normalizeReference(source.folderRef);
      const folderId = String(source.folderId || '').trim();
      if (!folderRef && (!folderId || folderId === '0')) {
        return null;
      }
      const id = sanitizeDisplayText(source.id || '', opts);
      if (folderRef && !id) {
        return null;
      }
      return {
        id: id || `shortcut-folder-${folderId}`,
        ...group,
        type: 'folder',
        ...(folderRef ? { folderRef } : { folderId }),
        title: sanitizeDisplayText(source.title || source.name || '', opts)
      };
    }
    const url = normalizeShortcutUrl(source.url);
    if (!url) {
      return null;
    }
    const normalizeHost = getNormalizeHost(opts);
    let host = '';
    try {
      host = normalizeHost(new URL(url).hostname);
    } catch (error) {
      host = '';
    }
    const rawTitle = sanitizeDisplayText(source.title || source.name || '', opts);
    const title = rawTitle || host || url;
    const id = sanitizeDisplayText(source.id || '', opts) || createShortcutId(url, opts);
    return {
      id,
      ...group,
      title,
      url,
      host,
      ...(ICON_SOURCES.includes(source.iconSource) ? { iconSource: source.iconSource } : {})
    };
  }

  function createShortcutRecord(input, options) {
    const opts = options && typeof options === 'object' ? options : {};
    return normalizeShortcutItem({
      ...(input || {}),
      ...(input && input.type === 'folder' && references.normalizeReference(input.folderRef) && !input.id
        ? { id: references.createEntryId() } : {})
    }, opts);
  }

  function normalizeShortcuts(items, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const maxShortcuts = getMaxShortcuts(opts);
    if (!Array.isArray(items) || maxShortcuts <= 0) {
      return [];
    }
    const normalized = [];
    const seenUrls = new Set();
    const seenIds = new Set();
    for (let i = 0; i < items.length; i += 1) {
      const item = normalizeShortcutItem(items[i], opts);
      const identity = item && (item.type === 'folder'
        ? (item.folderRef ? `folder-entry:${item.id}` : `folder:${item.folderId}`) : item.url);
      if (!item || seenUrls.has(identity) || seenIds.has(item.id)) {
        continue;
      }
      seenUrls.add(identity);
      seenIds.add(item.id);
      normalized.push(item);
      if (normalized.length >= maxShortcuts) {
        break;
      }
    }
    return normalized;
  }

  function createDefaultShortcutGroups() {
    return [{ id: DEFAULT_SHORTCUT_GROUP_ID, title: '' }];
  }

  function normalizeShortcutGroups(groups, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const maxGroups = getMaxGroups(opts);
    const normalized = [];
    const seen = new Set();
    (Array.isArray(groups) ? groups : []).forEach((group) => {
      const id = normalizeId(group && group.id);
      if (!id || seen.has(id) || normalized.length >= maxGroups) {
        return;
      }
      seen.add(id);
      normalized.push({ id, title: normalizeGroupTitle(group.title, opts) });
    });
    return normalized.length ? normalized : createDefaultShortcutGroups();
  }

  // Items stay in their groups' order and keep their order inside a group.
  // An item without a known group joins the group of the item before it, so a
  // shortcut inserted into a flat list lands where it was dropped.
  function normalizeShortcutState(state, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const source = state && typeof state === 'object' ? state : {};
    const groups = normalizeShortcutGroups(source.groups, opts);
    const groupIndex = new Map(groups.map((group, index) => [group.id, index]));
    let currentGroupId = groups[0].id;
    const items = normalizeShortcuts(source.items, opts).map((item) => {
      if (item.groupId && groupIndex.has(item.groupId)) {
        currentGroupId = item.groupId;
        return item;
      }
      // Rebuilt so every item lists its fields in the same order.
      return normalizeShortcutItem({ ...item, groupId: currentGroupId }, opts);
    });
    const ordered = items
      .map((item, index) => ({ item, index, group: groupIndex.get(item.groupId) }))
      .sort((left, right) => (left.group - right.group) || (left.index - right.index))
      .map((entry) => entry.item);
    const migratedAt = Number(source.migratedAt);
    return {
      groups,
      items: ordered,
      ...(Number.isFinite(migratedAt) && migratedAt > 0 ? { migratedAt: Math.floor(migratedAt) } : {})
    };
  }

  function isDefaultShortcutGroupLayout(groups) {
    return Array.isArray(groups) && groups.length === 1 &&
      groups[0].id === DEFAULT_SHORTCUT_GROUP_ID && !groups[0].title;
  }

  function getDefaultShortcuts(options) {
    const opts = options && typeof options === 'object' ? options : {};
    return normalizeShortcutState({ items: DEFAULT_SHORTCUTS }, opts).items;
  }

  function getDefaultShortcutState(options) {
    return normalizeShortcutState({ items: DEFAULT_SHORTCUTS }, options);
  }

  // Synced entries are positional arrays. Links leave out the https scheme
  // and a title that only repeats the host; folders carry a type marker in
  // the url slot.
  function compactUrl(url) {
    if (url.startsWith('https://')) {
      const rest = url.slice(8);
      if (!SCHEME_PATTERN.test(rest)) {
        return rest;
      }
    }
    return url;
  }

  function expandUrl(value) {
    const text = String(value || '');
    return SCHEME_PATTERN.test(text) ? text : `https://${text}`;
  }

  function encodeEntry(item, groupPosition) {
    if (item.type === 'folder') {
      if (item.folderRef) {
        const ref = item.folderRef;
        return [item.id, groupPosition, item.title, 0, [ref.root, ref.scope, ref.path, ref.fingerprint]];
      }
      return [item.id, groupPosition, item.title, 1, item.folderId];
    }
    const entry = [item.id, groupPosition, item.title === item.host ? '' : item.title, compactUrl(item.url)];
    if (item.iconSource) {
      entry.push(item.iconSource);
    }
    return entry;
  }

  function decodeEntry(entry, groups) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string') {
      return null;
    }
    const group = Number.isInteger(entry[1]) ? groups[entry[1]] : null;
    const base = { id: entry[0], ...(group ? { groupId: group.id } : {}), title: String(entry[2] || '') };
    if (typeof entry[3] === 'string') {
      return { ...base, url: expandUrl(entry[3]), ...(typeof entry[4] === 'string' ? { iconSource: entry[4] } : {}) };
    }
    if (entry[3] === 0 && Array.isArray(entry[4])) {
      const [refRoot, scope, path, fingerprint] = entry[4];
      return { ...base, type: 'folder', folderRef: { version: 1, root: refRoot, scope, path, fingerprint } };
    }
    if (entry[3] === 1) {
      return { ...base, type: 'folder', folderId: String(entry[4] || '') };
    }
    return null;
  }

  function hasStoredValue(values, key) {
    return Boolean(values && Object.prototype.hasOwnProperty.call(values, key) &&
      typeof values[key] !== 'undefined');
  }

  // Reads the synced copy. Browser sync can deliver the three keys of one
  // save separately; a chunk from another save marks the read as torn, and
  // its entries are still kept so a save made from it loses nothing.
  function readShortcutSyncValues(values, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const head = values && values[SHORTCUTS_SYNC_KEYS[0]];
    if (head && typeof head === 'object' && head.v === SHORTCUTS_STORAGE_VERSION && Array.isArray(head.g)) {
      const groups = normalizeShortcutGroups(head.g.map((group) => (
        Array.isArray(group) ? { id: group[0], title: group[1] } : null
      )), opts);
      const count = Math.min(SHORTCUTS_SYNC_KEYS.length, Math.max(1, Math.floor(Number(head.n) || 1)));
      const entries = Array.isArray(head.s) ? head.s.slice() : [];
      let torn = false;
      for (let index = 1; index < count; index += 1) {
        const chunk = values[SHORTCUTS_SYNC_KEYS[index]];
        if (!chunk || chunk.r !== head.r) {
          torn = true;
        }
        if (chunk && Array.isArray(chunk.s)) {
          entries.push(...chunk.s);
        }
      }
      return {
        source: 'v2',
        rev: String(head.r || ''),
        torn,
        migratedAt: Number(head.m) || 0,
        groups,
        items: entries.map((entry) => decodeEntry(entry, groups)).filter(Boolean)
      };
    }
    if (LEGACY_SHORTCUTS_CHUNK_KEYS.some((key) => hasStoredValue(values, key))) {
      const items = [];
      LEGACY_SHORTCUTS_CHUNK_KEYS.forEach((key) => {
        if (Array.isArray(values[key])) {
          items.push(...values[key].map((item) => {
            if (!item || typeof item !== 'object') return item;
            const { groupId: _ignored, ...rest } = item;
            return rest;
          }));
        }
      });
      return { source: 'legacy', rev: '', torn: false, migratedAt: 0, groups: createDefaultShortcutGroups(), items };
    }
    return {
      source: 'none',
      rev: '',
      torn: false,
      migratedAt: 0,
      groups: createDefaultShortcutGroups(),
      items: DEFAULT_SHORTCUTS.slice()
    };
  }

  function normalizeOverflowRecord(value) {
    if (Array.isArray(value)) {
      return { authoritative: false, rev: '', groups: null, items: value };
    }
    const source = value && typeof value === 'object' ? value : {};
    return {
      authoritative: source.authoritative === true,
      rev: String(source.rev || ''),
      groups: Array.isArray(source.groups) ? source.groups : null,
      migratedAt: Number(source.migratedAt) || 0,
      items: Array.isArray(source.items) ? source.items : []
    };
  }

  // Rebuilds the whole state from the synced copy and this device's overflow
  // record. Overflow entries are the tail of the list, so each one goes back
  // to the end of its group; an entry the synced copy already has keeps the
  // synced position.
  function readShortcutState(values, overflowValue, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const synced = readShortcutSyncValues(values, opts);
    const overflow = normalizeOverflowRecord(overflowValue);
    const meta = { source: synced.source, rev: synced.rev, torn: synced.torn };
    if (overflow.authoritative) {
      return {
        ...normalizeShortcutState({
          groups: overflow.groups || synced.groups,
          items: overflow.items,
          migratedAt: overflow.migratedAt || synced.migratedAt
        }, opts),
        ...meta,
        source: 'local'
      };
    }
    return {
      ...normalizeShortcutState({
        groups: synced.groups,
        items: [...synced.items, ...overflow.items],
        migratedAt: synced.migratedAt
      }, opts),
      ...meta
    };
  }

  // How many shortcuts browser sync carries and how many only this device
  // keeps. After a failed sync write the local record holds them all.
  function summarizeShortcutSync(values, overflowValue, options) {
    const state = readShortcutState(values, overflowValue, options);
    const total = state.items.length;
    if (normalizeOverflowRecord(overflowValue).authoritative) {
      return { total, synced: 0, localOnly: total, syncFailed: true };
    }
    const synced = readShortcutSyncValues(values, options);
    // Nothing saved yet: every device starts from the same default shortcuts.
    if (synced.source === 'none' && !normalizeOverflowRecord(overflowValue).items.length) {
      return { total, synced: total, localOnly: 0, syncFailed: false };
    }
    const syncedIds = new Set(normalizeShortcuts(synced.items, options).map((item) => item.id));
    const syncedCount = state.items.filter((item) => syncedIds.has(item.id)).length;
    return { total, synced: syncedCount, localOnly: total - syncedCount, syncFailed: false };
  }

  // Sync bytes available to the new copy: the shortcut ceiling, never past
  // the space reserved for other settings, minus what the legacy copy holds.
  function getShortcutSyncBudget(usage) {
    const source = usage && typeof usage === 'object' ? usage : {};
    const quotaBytes = getBudget(source, 'quotaBytes', DEFAULT_SYNC_QUOTA_BYTES);
    const reserveBytes = getBudget(source, 'reserveBytes', DEFAULT_SHORTCUTS_SYNC_RESERVE_BYTES);
    const ceilingBytes = getBudget(source, 'ceilingBytes', DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES);
    const totalBytes = getBudget(source, 'totalBytes', 0);
    const shortcutBytes = getBudget(source, 'shortcutBytes', 0);
    const legacyBytes = getBudget(source, 'legacyBytes', 0);
    const otherBytes = Math.max(0, totalBytes - shortcutBytes - legacyBytes);
    const protectedBytes = Math.max(0, quotaBytes - reserveBytes - otherBytes);
    return Math.max(0, Math.min(ceilingBytes, protectedBytes) - legacyBytes);
  }

  function measureShortcutSyncUsage(values) {
    const usage = { totalBytes: 0, shortcutBytes: 0, legacyBytes: 0 };
    Object.entries(values && typeof values === 'object' ? values : {}).forEach(([key, value]) => {
      if (typeof value === 'undefined') return;
      const bytes = getShortcutStorageItemByteSize(key, value);
      usage.totalBytes += bytes;
      if (SHORTCUTS_SYNC_KEYS.includes(key)) usage.shortcutBytes += bytes;
      if (LEGACY_SHORTCUTS_CHUNK_KEYS.includes(key)) usage.legacyBytes += bytes;
    });
    return usage;
  }

  // Packs the state into the three sync keys in display order. Group titles
  // always go first; entries fill each key up to its byte budget, and the
  // first entry that does not fit starts the local overflow.
  function createShortcutStoragePlan(state, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const normalized = normalizeShortcutState(state, opts);
    const now = getNow(opts);
    const rev = String(opts.rev || `${now.toString(36)}${randomToken(4)}`);
    const migratedAt = normalized.migratedAt || now;
    const maxItemBytes = Math.max(1, getBudget(opts, 'maxItemBytes', DEFAULT_SHORTCUTS_SYNC_ITEM_BUDGET_BYTES));
    const requestedMaxTotalBytes = getBudget(opts, 'maxTotalBytes', DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES);
    const groupPositions = new Map(normalized.groups.map((group, index) => [group.id, index]));
    const chunks = SHORTCUTS_SYNC_KEYS.map((key, index) => (index === 0
      ? { v: SHORTCUTS_STORAGE_VERSION, r: rev, n: 1, m: migratedAt,
        g: normalized.groups.map((group) => [group.id, group.title]), s: [] }
      : { r: rev, s: [] }));
    const chunkBytes = chunks.map((chunk, index) => getShortcutStorageItemByteSize(SHORTCUTS_SYNC_KEYS[index], chunk));
    const emptyBytes = chunkBytes.reduce((sum, bytes) => sum + bytes, 0);
    const maxTotalBytes = Math.max(emptyBytes, requestedMaxTotalBytes);
    let totalBytes = emptyBytes;
    let chunkIndex = 0;
    let overflowStartIndex = normalized.items.length;

    for (let itemIndex = 0; itemIndex < normalized.items.length; itemIndex += 1) {
      const item = normalized.items[itemIndex];
      const entryBytes = getUtf8ByteLength(JSON.stringify(encodeEntry(item, groupPositions.get(item.groupId))));
      let stored = false;
      while (chunkIndex < chunks.length) {
        const added = entryBytes + (chunks[chunkIndex].s.length ? 1 : 0);
        if (chunkBytes[chunkIndex] + added <= maxItemBytes && totalBytes + added <= maxTotalBytes) {
          chunks[chunkIndex].s.push(encodeEntry(item, groupPositions.get(item.groupId)));
          chunkBytes[chunkIndex] += added;
          totalBytes += added;
          stored = true;
          break;
        }
        chunkIndex += 1;
      }
      if (!stored) {
        overflowStartIndex = itemIndex;
        break;
      }
    }

    let usedChunks = 1;
    chunks.forEach((chunk, index) => {
      if (chunk.s.length) usedChunks = index + 1;
    });
    chunks[0].n = usedChunks;
    const payload = {};
    SHORTCUTS_SYNC_KEYS.forEach((key, index) => {
      payload[key] = chunks[index];
    });
    const syncedItems = normalized.items.slice(0, overflowStartIndex);
    const overflowItems = normalized.items.slice(overflowStartIndex);
    const legacyExpired = opts.legacyKeysPresent === true && normalized.migratedAt > 0 &&
      now - normalized.migratedAt >= LEGACY_SHORTCUTS_RETENTION_MS;
    return {
      state: { ...normalized, migratedAt },
      rev,
      payload,
      syncedItems,
      overflowItems,
      overflowRecord: { version: SHORTCUTS_STORAGE_VERSION, rev, authoritative: false, items: overflowItems },
      removeKeys: legacyExpired ? LEGACY_SHORTCUTS_CHUNK_KEYS.slice() : [],
      totalBytes: getShortcutStoragePayloadByteSize(payload),
      maxItemBytes,
      maxTotalBytes
    };
  }

  function createAuthoritativeOverflowRecord(state) {
    return {
      version: SHORTCUTS_STORAGE_VERSION,
      rev: '',
      authoritative: true,
      groups: state.groups,
      items: state.items,
      ...(state.migratedAt ? { migratedAt: state.migratedAt } : {})
    };
  }

  function storageGet(storage, keys) {
    return new Promise((resolve) => {
      if (!storage || typeof storage.get !== 'function') {
        resolve({});
        return;
      }
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result || {});
      };
      try {
        const maybePromise = storage.get(Array.isArray(keys) ? keys : [keys], finish);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(finish).catch(() => finish({}));
        }
      } catch (error) {
        finish({});
      }
    });
  }

  function getStorageLastError(options) {
    if (options && typeof options.getLastError === 'function') {
      return options.getLastError() || null;
    }
    const chromeApi = typeof globalThis !== 'undefined' ? globalThis.chrome : null;
    return chromeApi && chromeApi.runtime && chromeApi.runtime.lastError
      ? chromeApi.runtime.lastError
      : null;
  }

  function createStorageError(error, fallbackMessage) {
    const message = error && error.message
      ? String(error.message)
      : String(fallbackMessage || 'Shortcut storage write failed');
    const storageError = new Error(message);
    storageError.code = 'SHORTCUT_STORAGE_WRITE_FAILED';
    return storageError;
  }

  function storageWrite(storage, method, value, options) {
    return new Promise((resolve, reject) => {
      if (!storage || typeof storage[method] !== 'function') {
        resolve();
        return;
      }
      let settled = false;
      const finish = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        if (error) {
          reject(createStorageError(error));
          return;
        }
        resolve();
      };
      try {
        const maybePromise = storage[method](value, () => {
          finish(getStorageLastError(options));
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(() => finish(null)).catch(finish);
        }
      } catch (error) {
        finish(error);
      }
    });
  }

  function storageSet(storage, value, options) {
    return storageWrite(storage, 'set', value, options);
  }

  function loadShortcutState(storage, options) {
    return storageGet(storage, SHORTCUT_STORAGE_KEYS).then((values) => readShortcutState(values, null, options));
  }

  function loadShortcuts(storage, options) {
    return loadShortcutState(storage, options).then((state) => state.items);
  }

  function createShortcutQuotaError(plan) {
    const error = new Error('Shortcut sync quota exceeded');
    error.code = 'SHORTCUT_SYNC_QUOTA_EXCEEDED';
    error.plan = plan;
    return error;
  }

  function saveShortcutStoragePlan(storage, plan, options) {
    const storagePlan = plan && typeof plan === 'object' ? plan : null;
    if (!storagePlan || !storagePlan.payload) {
      return Promise.reject(createStorageError(null, 'Invalid shortcut storage plan'));
    }
    return storageSet(storage, storagePlan.payload, options).then(() => storagePlan);
  }

  // Writes a whole state to one storage area. Without allowOverflow a state
  // that does not fit the byte budgets is refused instead of cut short.
  function saveShortcutState(storage, state, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const plan = createShortcutStoragePlan(state, opts);
    if (plan.overflowItems.length > 0 && opts.allowOverflow !== true) {
      return Promise.reject(createShortcutQuotaError(plan));
    }
    return saveShortcutStoragePlan(storage, plan, opts).then(() => plan.state);
  }

  // Saves items while keeping the stored groups.
  function saveShortcuts(storage, items, options) {
    const opts = options && typeof options === 'object' ? options : {};
    return loadShortcutState(storage, opts).then((current) => saveShortcutState(storage, {
      groups: opts.groups || current.groups,
      items,
      migratedAt: current.migratedAt
    }, opts)).then((state) => state.items);
  }

  // Saves a state to browser sync with the rest in the local overflow record.
  // When the sync write fails, the overflow record becomes the authoritative
  // copy of the whole state on this device. Without an overflow area every
  // item is written to the given area.
  function persistShortcutState(storage, state, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const overflowArea = opts.overflowArea || null;
    const unlimited = { maxItemBytes: Number.MAX_SAFE_INTEGER, maxTotalBytes: Number.MAX_SAFE_INTEGER };
    const plan = createShortcutStoragePlan(state, overflowArea ? opts : { ...opts, ...unlimited });
    const ids = (items) => items.map((item) => String(item && item.id || ''));
    if (!overflowArea) {
      return saveShortcutStoragePlan(storage, plan, opts).then(() => ({
        state: plan.state, plan, localOnlyIds: [], syncLimited: false
      }));
    }
    return storageSet(overflowArea, { [SHORTCUTS_LOCAL_OVERFLOW_KEY]: plan.overflowRecord }, opts)
      .then(() => saveShortcutStoragePlan(storage, plan, opts))
      .then(() => (plan.removeKeys.length
        ? storageWrite(storage, 'remove', plan.removeKeys, opts).catch(() => {})
        : null))
      .then(() => ({
        state: plan.state,
        plan,
        localOnlyIds: ids(plan.overflowItems),
        syncLimited: plan.overflowItems.length > 0
      }))
      .catch((syncError) => storageSet(overflowArea, {
        [SHORTCUTS_LOCAL_OVERFLOW_KEY]: createAuthoritativeOverflowRecord(plan.state)
      }, opts).then(() => ({
        state: plan.state,
        plan,
        localOnlyIds: ids(plan.state.items),
        syncError,
        syncLimited: true
      })));
  }

  return {
    DEFAULT_MAX_SHORTCUTS,
    DEFAULT_MAX_SHORTCUT_GROUPS,
    SHORTCUT_GROUP_TITLE_MAX_LENGTH,
    DEFAULT_SHORTCUT_GROUP_ID,
    SHORTCUTS_STORAGE_VERSION,
    SHORTCUTS_SYNC_KEYS,
    LEGACY_SHORTCUTS_KEY,
    LEGACY_SHORTCUTS_CHUNK_KEYS,
    SHORTCUT_STORAGE_KEYS,
    SHORTCUTS_LOCAL_OVERFLOW_KEY,
    LEGACY_SHORTCUTS_RETENTION_MS,
    DEFAULT_SHORTCUTS_SYNC_ITEM_BUDGET_BYTES,
    DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES,
    DEFAULT_SHORTCUTS_SYNC_RESERVE_BYTES,
    DEFAULT_SHORTCUTS,
    getUtf8ByteLength,
    getShortcutStorageItemByteSize,
    getShortcutStoragePayloadByteSize,
    normalizeShortcutUrl,
    normalizeShortcutItem,
    createShortcutRecord,
    createShortcutGroupId,
    normalizeShortcuts,
    normalizeShortcutGroups,
    normalizeShortcutState,
    isDefaultShortcutGroupLayout,
    getDefaultShortcuts,
    getDefaultShortcutState,
    readShortcutSyncValues,
    readShortcutState,
    summarizeShortcutSync,
    getShortcutSyncBudget,
    measureShortcutSyncUsage,
    createShortcutStoragePlan,
    saveShortcutStoragePlan,
    loadShortcutState,
    loadShortcuts,
    saveShortcutState,
    saveShortcuts,
    persistShortcutState
  };
});
