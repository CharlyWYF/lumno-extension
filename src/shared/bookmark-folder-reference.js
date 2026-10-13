(function(root, factory) {
  const api = factory(root);
  root.LumnoBookmarkFolderReference = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';
  const BINDINGS_KEY = '_x_extension_shortcut_folder_bindings_2026_unique_';
  const ROOT_TYPES = new Set(['bookmarks-bar', 'other', 'mobile', 'managed']);
  // Chrome numbers its roots; Firefox uses fixed 12-character GUIDs. Mapping
  // both onto one root type keeps bookmark data portable between the browsers.
  const TREE_ROOT_IDS = new Set(['0', 'root________']);
  const ROOT_TYPES_BY_ID = Object.freeze({
    '1': 'bookmarks-bar', '2': 'other', '3': 'mobile',
    'toolbar_____': 'bookmarks-bar', 'unfiled_____': 'other', 'mobile______': 'mobile', 'menu________': 'menu'
  });
  const isTreeRootId = (id) => TREE_ROOT_IDS.has(String(id));
  const getTreeRoot = (nodeMap) => nodeMap.get('0') || nodeMap.get('root________');
  const getBookmarkRootType = (node) => (node && (node.folderType || ROOT_TYPES_BY_ID[String(node.id)])) || '';
  // Firefox's bookmarks menu has no Chrome counterpart. References sync through
  // WebDAV, and older clients reject a whole state that holds a root type they
  // do not know, so it is stored as "other".
  const getRootType = (node) => {
    const type = getBookmarkRootType(node);
    return type === 'menu' ? 'other' : type;
  };
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  function normalizeReference(value) {
    if (!value || value.version !== 1 || !ROOT_TYPES.has(value.root) ||
        !['account', 'local', 'unknown'].includes(value.scope) || !Array.isArray(value.path) ||
        value.path.length > 64 || value.path.some((part) => typeof part !== 'string' || part.length > 1024) ||
        !/^[a-f0-9]{16}$/.test(value.fingerprint || '')) return null;
    return { version: 1, root: value.root, scope: value.scope, path: value.path.slice(), fingerprint: value.fingerprint };
  }
  // Two 32-bit FNV-style lanes, hex encoded. Stored hashes depend on it.
  function hashText(text) {
    let first = 2166136261;
    let second = 0x9e3779b9;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second ^ code, 2246822519);
    }
    return [first, second].map((value) => (value >>> 0).toString(16).padStart(8, '0')).join('');
  }
  function fingerprint(node) {
    return hashText(JSON.stringify((node.children || []).map((child) =>
      JSON.stringify([child.url ? 'url' : 'folder', String(child.title || ''), String(child.url || '')])).sort()));
  }
  function buildNodeMap(nodes) {
    const map = new Map();
    function visit(node) {
      if (!node || !node.id) return;
      map.set(String(node.id), node);
      (node.children || []).forEach(visit);
    }
    (nodes || []).forEach(visit);
    return map;
  }
  function describe(folderId, nodeMap) {
    let node = nodeMap.get(String(folderId || ''));
    if (!node || node.url || isTreeRootId(node.id)) return null;
    const target = node;
    const path = [];
    const visited = new Set();
    while (node && !isTreeRootId(node.parentId)) {
      if (visited.has(node.id) || path.length >= 64) return null;
      visited.add(node.id);
      path.unshift(String(node.title || ''));
      node = nodeMap.get(String(node.parentId));
    }
    if (!node) return null;
    const rootType = getRootType(node);
    return normalizeReference({ version: 1, root: rootType,
      scope: typeof node.syncing === 'boolean' ? (node.syncing ? 'account' : 'local') : 'unknown',
      path, fingerprint: fingerprint(target) });
  }
  function resolveReference(reference, nodeMap) {
    const ref = normalizeReference(reference);
    // A local-only directory is usable through its originating device's binding.
    if (!ref || ref.scope === 'local') return null;
    const rootNode = getTreeRoot(nodeMap);
    const rootNodes = rootNode && Array.isArray(rootNode.children) ? rootNode.children : [...nodeMap.values()];
    const roots = rootNodes.filter((node) => isTreeRootId(node.parentId) &&
      getRootType(node) === ref.root &&
      (ref.scope === 'unknown' || typeof node.syncing !== 'boolean' || node.syncing === true));
    let candidates = roots;
    for (const part of ref.path) {
      candidates = candidates.flatMap((node) => (node.children || []).filter((child) => !child.url && child.title === part));
    }
    candidates = candidates.filter((node) => fingerprint(node) === ref.fingerprint);
    return candidates.length === 1 ? candidates[0] : null;
  }
  function createEntryId() {
    return `shortcut-folder-${root.crypto.randomUUID()}`;
  }
  function normalizeBindings(value) {
    const entries = Object.entries(value && typeof value === 'object' ? value : {}).slice(-512);
    return Object.fromEntries(entries.filter(([id, binding]) => id && id.length <= 180 && binding &&
      typeof binding.folderId === 'string' && binding.folderId && !isTreeRootId(binding.folderId) && binding.folderId.length <= 128)
      .map(([id, binding]) => [id, { folderId: binding.folderId }]));
  }
  function createRuntime(options) {
    const opts = options || {};
    const chromeApi = opts.chrome || root.chrome;
    const area = opts.storageArea || (chromeApi && chromeApi.storage.local);
    let bindings = {};
    let loaded = false;
    let pending = {};
    let chain = Promise.resolve();
    function storage(method, value) {
      return new Promise((resolve, reject) => {
        if (!area) { reject(new Error('Folder binding storage is unavailable')); return; }
        let done = false;
        const finish = (result) => {
          if (done) return;
          done = true;
          const error = chromeApi && chromeApi.runtime && chromeApi.runtime.lastError;
          if (error) reject(new Error(error.message)); else resolve(result);
        };
        try {
          const request = area[method](value, finish);
          if (request && request.then) request.then(finish, reject);
        } catch (error) { reject(error); }
      });
    }
    const ready = storage('get', [BINDINGS_KEY]).then((values) => {
      bindings = normalizeBindings(values && values[BINDINGS_KEY]);
      loaded = true;
    });
    function accept(value) {
      bindings = { ...normalizeBindings(value), ...pending };
    }
    function bind(id, folderId) {
      const next = { folderId: String(folderId) };
      if (!id || !next.folderId || isTreeRootId(next.folderId)) return;
      if (own(bindings, id) && bindings[id].folderId === next.folderId) return;
      bindings = { ...bindings, [id]: next };
      pending = { ...pending, [id]: next };
    }
    function flush() {
      const operation = chain.catch(() => {}).then(async () => {
        await ready;
        if (!Object.keys(pending).length) return;
        const changes = pending;
        pending = {};
        try {
          const values = await storage('get', [BINDINGS_KEY]);
          const merged = normalizeBindings({ ...normalizeBindings(values && values[BINDINGS_KEY]), ...changes });
          await storage('set', { [BINDINGS_KEY]: merged });
          bindings = { ...merged, ...pending };
        } catch (error) { pending = { ...changes, ...pending }; throw error; }
      });
      chain = operation;
      return operation;
    }
    function getNode(item, nodeMap) {
      if (!loaded || !item || item.type !== 'folder') return null;
      const binding = own(bindings, item.id) ? bindings[item.id] : null;
      if (binding) {
        const node = nodeMap.get(binding.folderId);
        // Never reattach a deleted binding to a newly created same-name folder.
        return node && !node.url ? node : null;
      }
      if (!item.folderRef) return null;
      const node = resolveReference(item.folderRef, nodeMap);
      if (node) bind(item.id, node.id);
      return node;
    }
    function reconcile(items, nodeMap) {
      if (!loaded) return items;
      return items.map((item) => {
        if (!item || item.type !== 'folder') return item;
        let node = getNode(item, nodeMap);
        if (!item.folderRef && !node) {
          // Legacy sync IDs have no provenance. Migrate only a unique title,
          // rather than trusting a possibly unrelated matching numeric ID.
          const candidates = [...nodeMap.values()].filter((candidate) => !candidate.url &&
            !isTreeRootId(candidate.id) && item.title && candidate.title === item.title);
          if (candidates.length === 1 && String(candidates[0].id) === item.folderId) node = candidates[0];
          if (node) bind(item.id, node.id);
        }
        const ref = node && describe(node.id, nodeMap);
        if (!ref || (item.folderRef && JSON.stringify(item.folderRef) === JSON.stringify(ref))) return item;
        const { folderId: _localId, ...portable } = item;
        return { ...portable, folderRef: ref, title: String(node.title || '') };
      });
    }
    function visibleItems(items, nodeMap) {
      return items.flatMap((item) => {
        if (item.type !== 'folder') return [item];
        const node = getNode(item, nodeMap);
        return node ? [{ ...item, folderId: String(node.id) }] : [];
      });
    }
    return { ready, accept, bind, flush, getNode, reconcile, visibleItems };
  }
  // Keep portable locators current even when the originating new-tab is closed.
  function createSyncController(options) {
    const opts = options || {};
    const chromeApi = opts.chrome || root.chrome;
    const settings = opts.settings || root.LumnoSettings;
    const store = opts.shortcuts || root.LumnoNewtabShortcutsStore;
    const provider = opts.provider || settings.createProviderStorageRuntime(chromeApi);
    const runtime = createRuntime({ chrome: chromeApi });
    const overflowKey = store.SHORTCUTS_LOCAL_OVERFLOW_KEY;
    let revision = 0;
    let timer = null;
    let chain = Promise.resolve();
    function storage(area, method, value) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const done = (result) => {
          if (settled) return;
          settled = true;
          const error = chromeApi.runtime && chromeApi.runtime.lastError;
          if (error) reject(new Error(error.message)); else resolve(result);
        };
        try {
          const request = area[method](value, done);
          if (request && request.then) request.then(done, reject);
        } catch (error) { reject(error); }
      });
    }
    async function update() {
      await Promise.all([provider.ready, runtime.ready]);
      const generation = revision;
      const sync = provider.getActiveAreaName() === 'sync';
      const values = await storage(provider.area, 'get', store.SHORTCUT_STORAGE_KEYS.slice());
      const local = sync ? await storage(chromeApi.storage.local, 'get', [overflowKey]) : {};
      const state = store.readShortcutState(values, local[overflowKey]);
      // A save from another device is still arriving; its next part reruns this.
      if (state.torn || !state.items.some((item) => item.type === 'folder')) return;
      const nodes = await new Promise((resolve, reject) => {
        chromeApi.bookmarks.getTree((tree) => {
          const error = chromeApi.runtime && chromeApi.runtime.lastError;
          if (error || !Array.isArray(tree) || !tree.length) reject(new Error('Bookmarks are unavailable'));
          else resolve(tree);
        });
      });
      const next = runtime.reconcile(state.items, buildNodeMap(nodes));
      await runtime.flush();
      if (generation !== revision || JSON.stringify(next) === JSON.stringify(state.items)) return;
      const nextState = { groups: state.groups, items: next, migratedAt: state.migratedAt };
      if (!sync) {
        await store.persistShortcutState(provider.area, nextState);
        return;
      }
      const allSync = await storage(chromeApi.storage.sync, 'get', null);
      if (generation !== revision) return;
      const usage = store.measureShortcutSyncUsage(allSync);
      await store.persistShortcutState(chromeApi.storage.sync, nextState, {
        overflowArea: chromeApi.storage.local,
        maxTotalBytes: store.getShortcutSyncBudget({ ...usage, quotaBytes: chromeApi.storage.sync.QUOTA_BYTES }),
        legacyKeysPresent: usage.legacyBytes > 0,
        getLastError: () => chromeApi.runtime && chromeApi.runtime.lastError
      });
    }
    function refresh() {
      if (timer) clearTimeout(timer);
      timer = null;
      const job = chain.catch(() => {}).then(update);
      chain = job;
      return job;
    }
    function schedule() {
      revision += 1;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        refresh().catch((error) => { if (opts.onError) opts.onError(error); });
      }, 120);
      if (timer && timer.unref) timer.unref();
    }
    function start() {
      for (const name of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']) {
        if (chromeApi.bookmarks[name]) chromeApi.bookmarks[name].addListener(schedule);
      }
      chromeApi.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[BINDINGS_KEY]) {
          runtime.accept(changes[BINDINGS_KEY].newValue);
          schedule();
        } else if (changes[settings.LOCAL_PRIMARY_STORAGE_KEY] || changes[overflowKey] ||
            (provider.isActiveAreaName(area) && store.SHORTCUT_STORAGE_KEYS.some((key) => changes[key]))) schedule();
      });
      refresh().catch((error) => { if (opts.onError) opts.onError(error); });
    }
    return { start, refresh };
  }
  return Object.freeze({ BINDINGS_KEY, normalizeReference, describe, resolveReference,
    isTreeRootId, getTreeRoot, getBookmarkRootType, hashText, buildNodeMap, createEntryId, createRuntime, createSyncController });
});
