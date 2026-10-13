// Pinned-tab recovery (an opt-in Labs setting): keeps a snapshot of the
// user's pinned tabs and their tab groups in chrome.storage.local and reopens
// the missing ones after a browser or extension update, startup, or a new
// normal window.
//
// Loaded by background.js through its first importScripts block (the Firefox
// build lists that block as background.scripts). Like background.js this is a
// classic script sharing the worker's global scope. Its functions use
// background.js bindings (storageArea, the storage keys, getResolvedTabUrl,
// isRestrictedUrl, ...) only when they run, never while this file loads.
// background.js decides when to snapshot (tab and window events) and when to
// restore (install/startup/window events).
//
// Suspension: the setting is re-read on wake before an event is acted on, and
// a pending debounced snapshot is flushed on runtime.onSuspend.

const PINNED_TAB_SNAPSHOT_DEBOUNCE_MS = 600;

const PINNED_TAB_RESTORE_MAX_TABS = 24;

let pinnedTabRecoveryEnabledCache = false;

// Pinned-tab snapshot: debounced write, flushed on runtime.onSuspend.
let pinnedTabSnapshotTimer = null;

let pinnedTabSnapshotPersistOptions = null;

let pinnedTabRecoverySettingLoaded = false;

let pinnedTabRecoverySettingLoadPromise = null;

let pinnedTabRestorePromise = null;

function normalizePinnedTabRecoveryEnabled(value) {
  return value === true;
}

function applyPinnedTabRecoverySetting(rawValue) {
  const normalized = normalizePinnedTabRecoveryEnabled(rawValue);
  pinnedTabRecoveryEnabledCache = normalized;
  pinnedTabRecoverySettingLoaded = true;
  if (rawValue !== normalized && storageArea && typeof storageArea.set === 'function') {
    storageArea.set({ [PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY]: normalized });
  }
  return normalized;
}

function ensurePinnedTabRecoverySettingLoaded() {
  if (pinnedTabRecoverySettingLoaded) {
    return Promise.resolve(pinnedTabRecoveryEnabledCache);
  }
  if (pinnedTabRecoverySettingLoadPromise) {
    return pinnedTabRecoverySettingLoadPromise;
  }
  if (!storageArea || typeof storageArea.get !== 'function') {
    pinnedTabRecoverySettingLoaded = true;
    pinnedTabRecoveryEnabledCache = false;
    return Promise.resolve(false);
  }
  pinnedTabRecoverySettingLoadPromise = new Promise((resolve) => {
    storageArea.get([PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        pinnedTabRecoverySettingLoaded = true;
        pinnedTabRecoveryEnabledCache = false;
        resolve(false);
        return;
      }
      const rawValue = result ? result[PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY] : undefined;
      resolve(applyPinnedTabRecoverySetting(rawValue));
    });
  }).finally(() => {
    pinnedTabRecoverySettingLoadPromise = null;
  });
  return pinnedTabRecoverySettingLoadPromise;
}

function queryTabsForPinnedSnapshot(queryInfo) {
  return new Promise((resolve) => {
    if (!chrome || !chrome.tabs || typeof chrome.tabs.query !== 'function') {
      resolve([]);
      return;
    }
    chrome.tabs.query(queryInfo || {}, (tabs) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      resolve(Array.isArray(tabs) ? tabs : []);
    });
  });
}

function getPinnedSnapshotFromStorage() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      resolve(null);
      return;
    }
    chrome.storage.local.get([PINNED_TAB_SNAPSHOT_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(result ? result[PINNED_TAB_SNAPSHOT_STORAGE_KEY] : null);
    });
  });
}

function setPinnedSnapshotToStorage(snapshot) {
  return new Promise((resolve) => {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      resolve(false);
      return;
    }
    chrome.storage.local.set({ [PINNED_TAB_SNAPSHOT_STORAGE_KEY]: snapshot }, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

function createPinnedTabForRestore(url, windowId) {
  return new Promise((resolve) => {
    if (!chrome || !chrome.tabs || typeof chrome.tabs.create !== 'function') {
      resolve({ ok: false, tab: null });
      return;
    }
    const createWithWindow = (typeof windowId === 'number')
      ? { windowId, url, pinned: true, active: false }
      : { url, pinned: true, active: false };
    chrome.tabs.create(createWithWindow, (tab) => {
      if (!(chrome.runtime && chrome.runtime.lastError)) {
        resolve({ ok: true, tab: tab || null });
        return;
      }
      if (typeof windowId !== 'number') {
        resolve({ ok: false, tab: null });
        return;
      }
      chrome.tabs.create({ url, pinned: true, active: false }, (fallbackTab) => {
        resolve({
          ok: !(chrome.runtime && chrome.runtime.lastError),
          tab: fallbackTab || null
        });
      });
    });
  });
}

function getLastFocusedWindowIdForRestore() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.windows || typeof chrome.windows.getLastFocused !== 'function') {
      resolve(null);
      return;
    }
    chrome.windows.getLastFocused({}, (windowInfo) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      const canUse = windowInfo &&
        typeof windowInfo.id === 'number' &&
        windowInfo.incognito !== true &&
        (!windowInfo.type || windowInfo.type === 'normal');
      resolve(canUse ? windowInfo.id : null);
    });
  });
}

function getNormalWindowCountForPinnedSnapshot() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.windows || typeof chrome.windows.getAll !== 'function') {
      resolve(0);
      return;
    }
    chrome.windows.getAll({ windowTypes: ['normal'] }, (windows) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(0);
        return;
      }
      const count = Array.isArray(windows)
        ? windows.filter((windowInfo) =>
          windowInfo &&
          windowInfo.incognito !== true &&
          (!windowInfo.type || windowInfo.type === 'normal')
        ).length
        : 0;
      resolve(count);
    });
  });
}

function getPinnedTabUngroupedId() {
  return chrome &&
    chrome.tabGroups &&
    typeof chrome.tabGroups.TAB_GROUP_ID_NONE === 'number'
    ? chrome.tabGroups.TAB_GROUP_ID_NONE
    : -1;
}

function isTabInGroup(tab) {
  return Boolean(
    tab &&
    typeof tab.groupId === 'number' &&
    tab.groupId !== getPinnedTabUngroupedId()
  );
}

function normalizePinnedTabGroupSnapshot(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }
  const key = String(rawValue.key || '').trim();
  const title = String(rawValue.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const color = String(rawValue.color || '').trim();
  if (!key && !title && !color) {
    return null;
  }
  const snapshot = {};
  if (key) {
    snapshot.key = key;
  }
  if (title) {
    snapshot.title = title;
  }
  if (color) {
    snapshot.color = color;
  }
  return snapshot;
}

function normalizePinnedTabSnapshotEntry(rawValue) {
  const raw = typeof rawValue === 'string'
    ? { url: rawValue }
    : (rawValue && typeof rawValue === 'object' ? rawValue : null);
  if (!raw) {
    return null;
  }
  const url = String(raw.url || '').trim();
  if (!url || isRestrictedUrl(url)) {
    return null;
  }
  const entry = { url };
  const group = normalizePinnedTabGroupSnapshot(raw.group);
  if (group) {
    entry.group = group;
  }
  return entry;
}

function normalizePinnedTabSnapshot(rawValue) {
  const entries = [];
  const appendEntry = (item) => {
    const entry = normalizePinnedTabSnapshotEntry(item);
    if (entry) {
      entries.push(entry);
    }
  };
  if (Array.isArray(rawValue)) {
    rawValue.forEach(appendEntry);
    return entries.slice(0, PINNED_TAB_RESTORE_MAX_TABS);
  }
  if (!rawValue || typeof rawValue !== 'object') {
    return [];
  }
  if (Array.isArray(rawValue.entries)) {
    rawValue.entries.forEach(appendEntry);
    return entries.slice(0, PINNED_TAB_RESTORE_MAX_TABS);
  }
  if (Array.isArray(rawValue.urls)) {
    rawValue.urls.forEach(appendEntry);
  }
  return entries.slice(0, PINNED_TAB_RESTORE_MAX_TABS);
}

function countUrls(urls) {
  const map = new Map();
  urls.forEach((url) => {
    const current = map.get(url) || 0;
    map.set(url, current + 1);
  });
  return map;
}

function getMissingPinnedTabEntries(savedEntries, existingPinnedUrls) {
  const existing = countUrls(existingPinnedUrls);
  const missingEntries = [];
  (Array.isArray(savedEntries) ? savedEntries : []).forEach((entry) => {
    const url = entry && entry.url ? String(entry.url) : '';
    if (!url) {
      return;
    }
    const remaining = existing.get(url) || 0;
    if (remaining > 0) {
      existing.set(url, remaining - 1);
      return;
    }
    missingEntries.push(entry);
  });
  return missingEntries;
}

function getTabGroupById(groupId) {
  return new Promise((resolve) => {
    if (!chrome ||
        !chrome.tabGroups ||
        typeof chrome.tabGroups.get !== 'function' ||
        typeof groupId !== 'number') {
      resolve(null);
      return;
    }
    try {
      chrome.tabGroups.get(groupId, (group) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(group || null);
      });
    } catch (error) {
      resolve(null);
    }
  });
}

async function getPinnedTabGroupSnapshot(tab) {
  if (!isTabInGroup(tab)) {
    return null;
  }
  const group = await getTabGroupById(tab.groupId);
  const snapshot = normalizePinnedTabGroupSnapshot({
    key: `${typeof tab.windowId === 'number' ? tab.windowId : 'window'}:${tab.groupId}`,
    title: group && typeof group.title === 'string' ? group.title : '',
    color: group && typeof group.color === 'string' ? group.color : ''
  });
  return snapshot;
}

function getPinnedRestoreGroupKey(group) {
  const snapshot = normalizePinnedTabGroupSnapshot(group);
  if (!snapshot) {
    return '';
  }
  return snapshot.key || `${snapshot.title || ''}::${snapshot.color || ''}`;
}

function updateRestoredTabGroup(groupId, group) {
  return new Promise((resolve) => {
    const snapshot = normalizePinnedTabGroupSnapshot(group);
    if (!snapshot ||
        typeof groupId !== 'number' ||
        !chrome ||
        !chrome.tabGroups ||
        typeof chrome.tabGroups.update !== 'function') {
      resolve(false);
      return;
    }
    const updates = {};
    if (snapshot.title) {
      updates.title = snapshot.title;
    }
    if (snapshot.color) {
      updates.color = snapshot.color;
    }
    if (Object.keys(updates).length === 0) {
      resolve(false);
      return;
    }
    try {
      chrome.tabGroups.update(groupId, updates, () => {
        resolve(!(chrome.runtime && chrome.runtime.lastError));
      });
    } catch (error) {
      resolve(false);
    }
  });
}

function groupRestoredPinnedTab(tab, group, existingGroupId) {
  return new Promise((resolve) => {
    const snapshot = normalizePinnedTabGroupSnapshot(group);
    if (!snapshot ||
        !tab ||
        typeof tab.id !== 'number' ||
        !chrome ||
        !chrome.tabs ||
        typeof chrome.tabs.group !== 'function') {
      resolve(null);
      return;
    }
    const groupOptions = { tabIds: tab.id };
    if (typeof existingGroupId === 'number') {
      groupOptions.groupId = existingGroupId;
    }
    try {
      chrome.tabs.group(groupOptions, (groupId) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        const resolvedGroupId = typeof groupId === 'number' ? groupId : existingGroupId;
        if (typeof resolvedGroupId !== 'number') {
          resolve(null);
          return;
        }
        updateRestoredTabGroup(resolvedGroupId, snapshot)
          .catch(() => false)
          .finally(() => resolve(resolvedGroupId));
      });
    } catch (error) {
      resolve(null);
    }
  });
}

async function persistPinnedTabSnapshotNow(options) {
  if (!pinnedTabRecoveryEnabledCache) {
    return;
  }
  const opts = options && typeof options === 'object' ? options : {};
  const tabs = await queryTabsForPinnedSnapshot({ pinned: true });
  const snapshotTabs = tabs
    .filter((tab) => tab && tab.incognito !== true)
    .sort((a, b) => {
      const winA = typeof a.windowId === 'number' ? a.windowId : 0;
      const winB = typeof b.windowId === 'number' ? b.windowId : 0;
      if (winA !== winB) {
        return winA - winB;
      }
      const indexA = typeof a.index === 'number' ? a.index : 0;
      const indexB = typeof b.index === 'number' ? b.index : 0;
      return indexA - indexB;
    });
  const entries = [];
  for (let i = 0; i < snapshotTabs.length; i += 1) {
    if (entries.length >= PINNED_TAB_RESTORE_MAX_TABS) {
      break;
    }
    const tab = snapshotTabs[i];
    const url = getResolvedTabUrl(tab);
    if (!url || isRestrictedUrl(url)) {
      continue;
    }
    const entry = { url };
    const group = await getPinnedTabGroupSnapshot(tab);
    if (group) {
      entry.group = group;
    }
    entries.push(entry);
  }
  if (!entries.length && opts.skipEmptyWhenNoNormalWindows === true) {
    const normalWindowCount = await getNormalWindowCountForPinnedSnapshot();
    if (normalWindowCount <= 0) {
      return;
    }
  }
  await setPinnedSnapshotToStorage({
    version: 2,
    urls: entries.map((entry) => entry.url),
    entries,
    capturedAt: Date.now()
  });
}

function mergePinnedTabSnapshotPersistOptions(options) {
  if (!options || typeof options !== 'object') {
    return;
  }
  pinnedTabSnapshotPersistOptions = {
    skipEmptyWhenNoNormalWindows: Boolean(
      (pinnedTabSnapshotPersistOptions && pinnedTabSnapshotPersistOptions.skipEmptyWhenNoNormalWindows) ||
      options.skipEmptyWhenNoNormalWindows
    )
  };
}

function schedulePersistPinnedTabSnapshot(options) {
  if (!pinnedTabRecoverySettingLoaded) {
    // A worker woken by a pin, move or close sees that event before the
    // recovery setting is read; dropping it would leave the snapshot stale.
    ensurePinnedTabRecoverySettingLoaded().then(() => {
      if (pinnedTabRecoverySettingLoaded) {
        schedulePersistPinnedTabSnapshot(options);
      }
    });
    return;
  }
  if (!pinnedTabRecoveryEnabledCache) {
    if (pinnedTabSnapshotTimer !== null) {
      clearTimeout(pinnedTabSnapshotTimer);
      pinnedTabSnapshotTimer = null;
    }
    pinnedTabSnapshotPersistOptions = null;
    return;
  }
  mergePinnedTabSnapshotPersistOptions(options);
  if (pinnedTabSnapshotTimer !== null) {
    clearTimeout(pinnedTabSnapshotTimer);
  }
  pinnedTabSnapshotTimer = setTimeout(flushPendingPinnedTabSnapshot, PINNED_TAB_SNAPSHOT_DEBOUNCE_MS);
}

function flushPendingPinnedTabSnapshot() {
  if (pinnedTabSnapshotTimer === null) {
    return Promise.resolve();
  }
  clearTimeout(pinnedTabSnapshotTimer);
  const persistOptions = pinnedTabSnapshotPersistOptions;
  pinnedTabSnapshotPersistOptions = null;
  pinnedTabSnapshotTimer = null;
  return persistPinnedTabSnapshotNow(persistOptions).catch((error) => {
    console.warn('[Lumno] Failed to save the pinned-tab snapshot.', error);
  });
}

async function restorePinnedTabsFromSnapshotNow() {
  const enabled = await ensurePinnedTabRecoverySettingLoaded();
  if (!enabled) {
    return;
  }
  const savedRaw = await getPinnedSnapshotFromStorage();
  const savedEntries = normalizePinnedTabSnapshot(savedRaw);
  if (!savedEntries.length) {
    return;
  }
  const currentTabs = await queryTabsForPinnedSnapshot({});
  const existingPinnedUrls = currentTabs
    .filter((tab) => tab && tab.pinned && tab.incognito !== true)
    .map((tab) => getResolvedTabUrl(tab))
    .filter((url) => Boolean(url) && !isRestrictedUrl(url));
  const missingEntries = getMissingPinnedTabEntries(savedEntries, existingPinnedUrls);
  if (!missingEntries.length) {
    return;
  }
  const targetWindowId = await getLastFocusedWindowIdForRestore();
  const restoredGroupIds = new Map();
  for (let i = 0; i < missingEntries.length && i < PINNED_TAB_RESTORE_MAX_TABS; i += 1) {
    const entry = missingEntries[i];
    const result = await createPinnedTabForRestore(entry.url, targetWindowId);
    if (!result || !result.ok || !entry.group) {
      continue;
    }
    const groupKey = getPinnedRestoreGroupKey(entry.group);
    const existingGroupId = groupKey ? restoredGroupIds.get(groupKey) : null;
    const groupId = await groupRestoredPinnedTab(result.tab, entry.group, existingGroupId);
    if (groupKey && typeof groupId === 'number') {
      restoredGroupIds.set(groupKey, groupId);
    }
  }
  setTimeout(() => {
    schedulePersistPinnedTabSnapshot();
  }, 800);
}

function restorePinnedTabsFromSnapshotOnStartup() {
  if (pinnedTabRestorePromise) {
    return pinnedTabRestorePromise;
  }
  pinnedTabRestorePromise = restorePinnedTabsFromSnapshotNow().finally(() => {
    pinnedTabRestorePromise = null;
  });
  return pinnedTabRestorePromise;
}
