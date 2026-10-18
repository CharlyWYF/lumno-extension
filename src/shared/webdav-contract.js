(function(root, factory) {
  const settings = root.LumnoSettings || (typeof require === 'function' ? require('./settings.js') : {});
  const shortcuts = root.LumnoNewtabShortcutsStore || (typeof require === 'function' ? require('../newtab/shortcuts-store.js') : {});
  const api = factory(settings, shortcuts);
  root.LumnoWebDavContract = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(settings, shortcutStore) {
  'use strict';
  // Grouped and legacy shortcut keys: none of them is a plain preference.
  const SHORTCUT_KEYS = shortcutStore.SHORTCUT_STORAGE_KEYS;
  const SHORTCUT_SYNC_KEYS = shortcutStore.SHORTCUTS_SYNC_KEYS;
  const OVERFLOW_KEY = shortcutStore.SHORTCUTS_LOCAL_OVERFLOW_KEY;
  // Version 3 states carry shortcut groups and more shortcuts than older
  // versions accept; a state is only written as version 3 when it needs to be.
  const GROUPED_STATE_VERSION = 3;
  const LEGACY_MAX_SHORTCUTS = 60;
  const MAX_SHORTCUTS = shortcutStore.DEFAULT_MAX_SHORTCUTS;
  const ICONS_KEY = '_x_extension_newtab_shortcut_icons_2026_unique_';
  const WALLPAPER_KEY = '_x_extension_newtab_wallpaper_2026_unique_';
  const LOCAL_WALLPAPER_KEY = '_x_extension_newtab_local_wallpaper_2026_unique_';
  const LINK_WALLPAPERS_KEY = settings.NEWTAB_LINK_WALLPAPERS_STORAGE_KEY;
  // Browser sync stores the link list as one item of at most 8 KB.
  const MAX_LINK_WALLPAPERS_BYTES = 8000;
  const PREFERENCE_KEYS = settings.CHROME_SYNC_STORAGE_KEYS.filter((key) => !SHORTCUT_KEYS.includes(key));
  // Preferences kept in chrome.storage.local that WebDAV carries but browser
  // sync never does: the custom wallpaper selection, the bookmark bar
  // material chosen against it, and the imported quote collection (too large
  // for browser sync). Each device keeps its own daily pick.
  const TOPBAR_KEYS = settings.BOOKMARK_TOPBAR_WEBDAV_STORAGE_KEYS || [];
  const CUSTOM_QUOTES_KEY = '_x_extension_custom_quotes_2026_unique_';
  const LOCAL_PREFERENCE_KEYS = [LOCAL_WALLPAPER_KEY, ...TOPBAR_KEYS, CUSTOM_QUOTES_KEY];
  // Records whose fields are independent settings merge field by field, so
  // two devices editing different fields of one record do not conflict.
  // Folder colors merge per folder for the same reason.
  // Every preference this version reads and writes. A state carries its
  // writer's list as `keys`, so a reader can tell a value the writer removed
  // from one the writer never knew: an older version drops what it does not
  // know whenever it saves. States without the list were written by 1.0.0 or
  // earlier, which knew every key except these.
  const KNOWN_KEYS = Object.freeze([...PREFERENCE_KEYS, ...LOCAL_PREFERENCE_KEYS]);
  const KEYS_UNKNOWN_TO_LEGACY_WRITERS = Object.freeze([
    settings.NEWTAB_GLASS_STYLE_STORAGE_KEY,
    settings.NEWTAB_TIME_FONT_SIZE_STORAGE_KEY,
    settings.NEWTAB_TIME_OPACITY_STORAGE_KEY,
    settings.NEWTAB_TIME_FONT_STORAGE_KEY,
    settings.SEARCH_SOURCE_ORDER_STORAGE_KEY,
    CUSTOM_QUOTES_KEY
  ].filter(Boolean));
  const FIELD_MERGE_KEYS = [settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY,
    settings.BOOKMARK_FOLDER_COLOR_REFS_STORAGE_KEY].filter(Boolean);
  const MAX_STATE_BYTES = 2 * 1024 * 1024;
  const MAX_ASSET_BYTES = 2 * 1024 * 1024;
  const HASH_PATTERN = /^[a-f0-9]{64}$/;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
  function fail(code) { throw Object.assign(new Error(code), { code }); }
  function byteLength(value) { return new TextEncoder().encode(String(value)).byteLength; }
  function canonical(value) {
    if (typeof value === 'undefined') return 'undefined';
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  }
  function equal(left, right) { return canonical(left) === canonical(right); }
  // Both sides must still hold a record; a deleted or replaced value is a
  // whole-value change. A missing base record counts as an empty one.
  function fieldMergeable(key, base, local, remote) {
    return FIELD_MERGE_KEYS.includes(key) && isObject(local) && isObject(remote) && (typeof base === 'undefined' || isObject(base));
  }
  function fieldNames(...records) {
    return [...new Set(records.flatMap((record) => Object.keys(record || {})))].sort();
  }
  function writerKnows(state, key) {
    return Array.isArray(state.keys) ? state.keys.includes(key) : !KEYS_UNKNOWN_TO_LEGACY_WRITERS.includes(key);
  }
  // The other side's value for a key, or `fallback` when its writer never
  // knew the key and so has no say in it.
  function sideValue(state, key, fallback) {
    return writerKnows(state, key) ? state.data[key] : fallback;
  }
  // Same content, whichever version wrote each side. Comparing writer lists
  // too would make two versions rewrite the server after each other forever.
  function sameContent(left, right) {
    const { keys: _leftKeys, ...leftContent } = left || {};
    const { keys: _rightKeys, ...rightContent } = right || {};
    return equal(leftContent, rightContent);
  }
  // The remote state as this device applies it: values for keys its writer
  // never knew stay as they are here.
  function adoptRemote(local, remote) {
    const data = { ...remote.data };
    KNOWN_KEYS.forEach((key) => {
      if (!writerKnows(remote, key) && own(local.data, key)) data[key] = local.data[key];
    });
    return validateState({ ...remote, data, keys: KNOWN_KEYS });
  }
  function readShortcutState(values, overflow) {
    return shortcutStore.readShortcutState(values, overflow);
  }
  // Whether a state needs the grouped format: real groups, or more shortcuts
  // than older versions accept.
  function needsGroupedState(groups, shortcuts) {
    return !shortcutStore.isDefaultShortcutGroupLayout(groups) || shortcuts.length > LEGACY_MAX_SHORTCUTS;
  }
  function selectPreferences(values) {
    return Object.fromEntries([...PREFERENCE_KEYS, ...LOCAL_PREFERENCE_KEYS]
      .filter((key) => own(values, key)).map((key) => [key, values[key]]));
  }
  function collectAssets(state) {
    const refs = [...Object.values(state.icons), ...state.wallpapers.flatMap((wallpaper) => [wallpaper.image, wallpaper.thumbnail])];
    return Object.fromEntries([...new Set(refs)].sort().map((hash) => [hash, state.assets[hash]]));
  }
  function validateState(value) {
    if (!isObject(value) || ![1, 2, GROUPED_STATE_VERSION].includes(value.version) || !isObject(value.data) ||
        !Array.isArray(value.shortcuts) || !isObject(value.icons) || !Array.isArray(value.wallpapers) ||
        !isObject(value.assets)) fail('invalid-state');
    const grouped = value.version >= GROUPED_STATE_VERSION;
    if (byteLength(JSON.stringify(value)) > MAX_STATE_BYTES ||
        value.shortcuts.length > (grouped ? MAX_SHORTCUTS : LEGACY_MAX_SHORTCUTS) || value.wallpapers.length > 256) fail('state-too-large');
    // Older states have no groups; their shortcuts all belong to the default one.
    let groups = shortcutStore.normalizeShortcutGroups(null);
    if (grouped) {
      if (!Array.isArray(value.groups) || !value.groups.length) fail('invalid-shortcuts');
      groups = shortcutStore.normalizeShortcutGroups(value.groups);
      if (groups.length !== value.groups.length || value.groups.some((group, index) => !isObject(group) ||
          group.id !== groups[index].id)) fail('invalid-shortcuts');
      const groupIds = new Set(groups.map((group) => group.id));
      if (value.shortcuts.some((item) => !isObject(item) || !groupIds.has(item.groupId))) fail('invalid-shortcuts');
    }
    const shortcutState = shortcutStore.normalizeShortcutState({ groups, items: grouped ? value.shortcuts
      : value.shortcuts.map((item) => {
        if (!isObject(item)) return item;
        const { groupId: _ignored, ...rest } = item;
        return rest;
      }) });
    const shortcuts = shortcutState.items;
    if (shortcuts.length !== value.shortcuts.length || shortcuts.some((item) => item.type === 'folder' &&
        (value.version < 2 || !item.folderRef))) fail('invalid-shortcuts');
    if (value.shortcuts.some((item) => item.type === 'folder' && own(item, 'folderId'))) fail('invalid-shortcuts');
    const ids = new Set(shortcuts.map((item) => item.id));
    if (ids.size !== shortcuts.length) fail('invalid-shortcuts');
    const assets = {};
    Object.entries(value.assets).forEach(([hash, asset]) => {
      if (!HASH_PATTERN.test(hash) || !isObject(asset) || !['image/png', 'image/webp'].includes(asset.mime) ||
          !Number.isInteger(asset.size) || asset.size <= 0 || asset.size > MAX_ASSET_BYTES) fail('invalid-asset');
      assets[hash] = { mime: asset.mime, size: asset.size };
    });
    const checkRef = (hash, mime, maxSize) => {
      if (!HASH_PATTERN.test(String(hash)) || !own(assets, hash) || assets[hash].mime !== mime || assets[hash].size > maxSize) fail('invalid-asset');
    };
    const icons = Object.fromEntries(Object.entries(value.icons).map(([id, hash]) => {
      if (!ids.has(id)) fail('invalid-icon');
      checkRef(hash, 'image/png', 96 * 1024);
      return [id, hash];
    }));
    const wallpaperIds = new Set();
    const wallpapers = value.wallpapers.map((item) => {
      if (!isObject(item) || !/^custom-wallpaper-[-\w]{1,120}$/.test(item.id) || wallpaperIds.has(item.id) ||
          !Number.isInteger(item.width) || !Number.isInteger(item.height) || item.width < 1 || item.width > 8192 ||
          item.height < 1 || item.height > 8192 || !Number.isFinite(item.updatedAt)) fail('invalid-wallpaper');
      wallpaperIds.add(item.id);
      checkRef(item.image, 'image/webp', MAX_ASSET_BYTES);
      checkRef(item.thumbnail, 'image/webp', 160 * 1024);
      return { id: item.id, name: String(item.name || '').slice(0, 200), width: item.width, height: item.height,
        updatedAt: item.updatedAt, image: item.image, thumbnail: item.thumbnail };
    });
    const state = { version: value.version, data: selectPreferences(value.data), groups: shortcutState.groups, shortcuts,
      icons, wallpapers, assets };
    if (own(value, 'keys')) {
      if (!Array.isArray(value.keys) || value.keys.length > 2000 || value.keys.some((key) => typeof key !== 'string' ||
          key.length > 200)) fail('invalid-state');
      state.keys = [...new Set(value.keys)].sort();
    }
    state.assets = collectAssets(state);
    return state;
  }
  // A first join that merges keeps the server's settings and selection, and adds this
  // device's wallpapers to them: uploads not already on the server (the same image
  // counts once) and links to new addresses. Nothing is dropped to fit; a merge
  // past the sync limits fails with merge-too-large and changes nothing.
  function mergeInitialWallpapers(local, remote) {
    const remoteImages = new Set(remote.wallpapers.map((item) => item.image));
    const remoteIds = new Set(remote.wallpapers.map((item) => item.id));
    const wallpapers = remote.wallpapers.concat(local.wallpapers.filter((item) =>
      !remoteImages.has(item.image) && !remoteIds.has(item.id)));
    const data = { ...adoptRemote(local, remote).data };
    const remoteLinks = Array.isArray(remote.data[LINK_WALLPAPERS_KEY]) ? remote.data[LINK_WALLPAPERS_KEY] : [];
    const localLinks = Array.isArray(local.data[LINK_WALLPAPERS_KEY]) ? local.data[LINK_WALLPAPERS_KEY] : [];
    const linkUrls = new Set(remoteLinks.map((item) => item && item.url));
    const linkIds = new Set(remoteLinks.map((item) => item && item.id));
    const links = remoteLinks.concat(localLinks.filter((item) => item && !linkUrls.has(item.url) && !linkIds.has(item.id)));
    if (LINK_WALLPAPERS_KEY && links.length) {
      if (byteLength(JSON.stringify(links)) > MAX_LINK_WALLPAPERS_BYTES) fail('merge-too-large');
      data[LINK_WALLPAPERS_KEY] = links;
    }
    try {
      return validateState({ version: Math.max(local.version, remote.version), data, groups: remote.groups,
        shortcuts: remote.shortcuts, icons: remote.icons, wallpapers, assets: { ...local.assets, ...remote.assets },
        keys: KNOWN_KEYS });
    } catch (cause) {
      if (cause.code === 'state-too-large') fail('merge-too-large');
      throw cause;
    }
  }
  // A three-way merge against the last state both sides agreed on. Whatever
  // only one side changed is taken from that side. A value both sides changed
  // apart is a conflict for the person to resolve, whether it is a list or a
  // single setting: a device that was offline or paused may hold the older
  // edit, so neither side wins on its own. Sorting and deletes cannot safely be
  // resolved by joining arrays, so whole lists stay single merge domains.
  // Every part merges on its own. Chrome sync delivers shared keys before
  // WebDAV delivers local-only ones (wallpaper selection, icons), and a
  // half-arrived edit must not look like a second device's change.
  function mergeStates(savedBase, local, remote, resolution) {
    // A baseline saved by an older version still holds fields this version
    // drops; compare it in the same form as both sides.
    const base = validateState(savedBase);
    const conflicts = [];
    function choose(key, previous, left, right) {
      if (equal(left, right) || equal(right, previous)) return left;
      if (equal(left, previous)) return right;
      if (resolution === 'remote') return right;
      if (resolution === 'local') return left;
      conflicts.push(key);
      return left;
    }
    // Fields outside `only` are dropped before they could conflict.
    function chooseFields(key, previous, left, right, only) {
      const record = {};
      fieldNames(previous, left, right).filter((field) => !only || only.has(field)).forEach((field) => {
        const value = choose(key, (previous || {})[field], (left || {})[field], (right || {})[field]);
        if (typeof value !== 'undefined') record[field] = value;
      });
      return record;
    }
    const data = {};
    KNOWN_KEYS.forEach((key) => {
      // A side whose writer never knew the key left it as it was.
      const previous = own(base.data, key) ? base.data[key] : sideValue(base, key, local.data[key]);
      const left = local.data[key];
      const right = sideValue(remote, key, previous);
      const value = fieldMergeable(key, previous, left, right)
        ? chooseFields(key, previous, left, right)
        : choose(key, previous, left, right);
      if (typeof value !== 'undefined') data[key] = value;
    });
    // Groups and the shortcuts inside them change together as one list.
    const shortcutDomain = (state) => ({ groups: state.groups, shortcuts: state.shortcuts });
    const shortcutState = choose('shortcuts', shortcutDomain(base), shortcutDomain(local), shortcutDomain(remote));
    const shortcutList = shortcutState.shortcuts;
    // An icon belongs to the shortcut domain: two different icons for one
    // shortcut conflict there, while the icon of a removed shortcut goes too.
    const icons = chooseFields('shortcuts', base.icons, local.icons, remote.icons, new Set(shortcutList.map((item) => item.id)));
    const wallpapers = choose('wallpapers', base.wallpapers, local.wallpapers, remote.wallpapers);
    const state = validateState({ version: Math.max(base.version, local.version, remote.version), data,
      groups: shortcutState.groups, shortcuts: shortcutList, icons, wallpapers,
      assets: { ...base.assets, ...remote.assets, ...local.assets }, keys: KNOWN_KEYS });
    return { state, conflicts: [...new Set(conflicts)] };
  }
  // A conflict summary is display data only: names are capped and values are
  // reduced to their kind, so it never ships full shortcut lists or images.
  const SUMMARY_NAMES = 6;
  function names(list, name) {
    return { names: list.slice(0, SUMMARY_NAMES).map(name), count: list.length };
  }
  function summarizeValue(value) {
    if (typeof value === 'undefined' || value === null) return { kind: 'unset' };
    if (typeof value === 'boolean') return { kind: 'boolean', value };
    if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'number', value };
    if (typeof value === 'string' && value.length <= 40) return { kind: 'text', value };
    if (Array.isArray(value)) return { kind: 'list', count: value.length };
    return { kind: 'changed' };
  }
  function describeList(before, after, name, changedItem) {
    const previous = new Map(before.map((item) => [item.id, item]));
    const next = new Set(after.map((item) => item.id));
    const kept = after.filter((item) => previous.has(item.id));
    return {
      total: after.length,
      added: names(after.filter((item) => !previous.has(item.id)), name),
      removed: names(before.filter((item) => !next.has(item.id)), name),
      changed: names(kept.filter((item) => changedItem(item, previous.get(item.id))), name),
      reordered: !equal(kept.map((item) => item.id), before.filter((item) => next.has(item.id)).map((item) => item.id))
    };
  }
  function describeShortcuts(base, side) {
    return describeList(base.shortcuts, side.shortcuts, (item) => String(item.title || item.url || '').slice(0, 60),
      (item, previous) => !equal(item, previous) || side.icons[item.id] !== base.icons[item.id]);
  }
  function describeWallpapers(base, side) {
    const summary = describeList(base.wallpapers, side.wallpapers, (item) => String(item.name || '').slice(0, 60),
      (item, previous) => item.image !== previous.image || item.name !== previous.name);
    summary.selectionChanged = !equal(side.data[LOCAL_WALLPAPER_KEY], base.data[LOCAL_WALLPAPER_KEY]) ||
      !equal(side.data[WALLPAPER_KEY], base.data[WALLPAPER_KEY]);
    return summary;
  }
  // A folder color entry also carries the folder's creation time; only the
  // color means anything to the person choosing a side.
  function fieldValue(key, value) {
    return key === settings.BOOKMARK_FOLDER_COLOR_REFS_STORAGE_KEY && isObject(value) ? value.color : value;
  }
  // A field-merged record lists only the fields both sides changed apart.
  function describeFields(key, previous, left, right) {
    return fieldNames(previous, left, right).filter((field) => {
      const before = (previous || {})[field];
      return !equal(left[field], right[field]) && !equal(left[field], before) && !equal(right[field], before);
    }).map((field) => ({ key, field, domain: 'preference', local: summarizeValue(fieldValue(key, left[field])),
      remote: summarizeValue(fieldValue(key, right[field])) }));
  }
  function describeConflict(base, local, remote, keys) {
    return [...new Set(keys)].flatMap((key) => {
      if (key === 'shortcuts') return { key, domain: 'shortcuts', local: describeShortcuts(base, local), remote: describeShortcuts(base, remote) };
      if (key === 'wallpapers') return { key, domain: 'wallpapers', local: describeWallpapers(base, local), remote: describeWallpapers(base, remote) };
      if (fieldMergeable(key, base.data[key], local.data[key], remote.data[key])) {
        return describeFields(key, base.data[key], local.data[key], remote.data[key]);
      }
      return { key, domain: 'preference', local: summarizeValue(local.data[key]), remote: summarizeValue(remote.data[key]) };
    });
  }
  function sameShortcutState(left, right) {
    return equal({ groups: left.groups, items: left.items }, { groups: right.groups, items: right.items });
  }
  // Chrome keeps the legacy shortcut keys as they are: an older device still
  // reads them. Only the grouped copy is written.
  function planChromeBackup(values, existing, options) {
    const opts = options || {};
    const quota = opts.quota || 102400;
    const itemQuota = opts.itemQuota || 8192;
    const maxItems = opts.maxItems || 512;
    const keys = settings.CHROME_SYNC_STORAGE_KEYS;
    const bytes = (key, value) => byteLength(key) + byteLength(JSON.stringify(value));
    // Include retained old values in the budget, including values that no
    // longer fit. A partial backup keeps their last successful Chrome copy.
    const projected = { ...existing };
    const remove = keys.filter((key) => !SHORTCUT_KEYS.includes(key) && !own(values, key) && own(existing, key));
    remove.forEach((key) => delete projected[key]);
    const hasShortcuts = SHORTCUT_KEYS.some((key) => own(values, key));
    if (hasShortcuts) SHORTCUT_SYNC_KEYS.forEach((key) => { projected[key] = []; });
    const payload = {};
    const skipped = [];
    for (const key of keys.filter((key) => !SHORTCUT_KEYS.includes(key))) {
      if (!own(values, key)) continue;
      const old = projected[key];
      projected[key] = values[key];
      const total = Object.entries(projected).reduce((sum, [name, value]) => sum + bytes(name, value), 0);
      if (bytes(key, values[key]) > itemQuota || total > quota || Object.keys(projected).length > maxItems) {
        if (typeof old === 'undefined') delete projected[key]; else projected[key] = old;
        skipped.push(key);
      } else if (!equal(existing[key], values[key])) payload[key] = values[key];
    }
    if (hasShortcuts) {
      const nonShortcutBytes = Object.entries(projected).filter(([key]) => !SHORTCUT_SYNC_KEYS.includes(key))
        .reduce((sum, [key, value]) => sum + bytes(key, value), 0);
      const state = readShortcutState(values, null);
      const fallback = shortcutStore.createShortcutStoragePlan(state, {
        maxItemBytes: Math.min(itemQuota, shortcutStore.DEFAULT_SHORTCUTS_SYNC_ITEM_BUDGET_BYTES),
        maxTotalBytes: Math.max(0, quota - nonShortcutBytes)
      });
      Object.assign(projected, fallback.payload);
      const fits = Object.keys(projected).length <= maxItems && Object.entries(projected)
        .reduce((sum, [key, value]) => sum + bytes(key, value), 0) <= quota;
      if (fits) {
        // All three chunks are updated together, including empty tail chunks.
        // Keeping a stale tail would resurrect removed shortcuts on a new device.
        const current = shortcutStore.readShortcutSyncValues(existing);
        if (current.source !== 'v2' || current.torn ||
            !sameShortcutState(shortcutStore.normalizeShortcutState(current), fallback.state)) {
          Object.assign(payload, fallback.payload);
        }
        if (fallback.overflowItems.length) skipped.push(...SHORTCUT_SYNC_KEYS);
      } else {
        skipped.push(...SHORTCUT_SYNC_KEYS);
        // A changed preference must not rely on removing chunks that cannot be
        // replaced. Replan without shortcut allocation under a full quota.
        SHORTCUT_SYNC_KEYS.forEach((key) => {
          if (own(existing, key)) projected[key] = existing[key]; else delete projected[key];
        });
        for (const key of Object.keys(payload).reverse()) {
          if (Object.entries(projected).reduce((sum, [name, value]) => sum + bytes(name, value), 0) <= quota) break;
          delete payload[key];
          skipped.push(key);
          if (own(existing, key)) projected[key] = existing[key]; else delete projected[key];
        }
      }
    }
    return { payload, remove, skipped, complete: skipped.length === 0 };
  }
  return Object.freeze({ SHORTCUT_KEYS, SHORTCUT_SYNC_KEYS, FIELD_MERGE_KEYS, OVERFLOW_KEY, ICONS_KEY, WALLPAPER_KEY,
    LOCAL_WALLPAPER_KEY, LOCAL_PREFERENCE_KEYS, PREFERENCE_KEYS, GROUPED_STATE_VERSION, LEGACY_MAX_SHORTCUTS, MAX_SHORTCUTS,
    MAX_STATE_BYTES, MAX_ASSET_BYTES, KNOWN_KEYS, canonical, equal, sameContent, byteLength, readShortcutState,
    needsGroupedState, selectPreferences, validateState, adoptRemote, mergeStates, mergeInitialWallpapers, describeConflict,
    planChromeBackup });
});
