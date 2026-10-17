(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoSearchSourceOrder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // One synced record holds every order the reader can set for search sources:
  // the group blocks of the search scope panel, each Settings list, and the
  // browser content source types. Nothing is stored until the reader moves
  // something, and anything the record does not mention keeps its usual place.
  const STORAGE_KEY = '_x_extension_search_source_order_2026_unique_';
  const SCHEMA_VERSION = 1;

  const GROUP_IDS = Object.freeze(['aggregate', 'engine', 'site', 'ai', 'local']);
  // The order the search scope panel has always used.
  const DEFAULT_GROUP_ORDER = GROUP_IDS;
  // One list per Settings list. Custom searches are ordered among themselves;
  // in the panel they lead their group, as they always have.
  const LIST_IDS = Object.freeze(['custom', 'engine', 'site', 'ai', 'aggregate']);
  const LOCAL_SOURCE_TYPES = Object.freeze(['topSite', 'bookmark', 'history']);

  const MAX_LIST_ENTRIES = 240;
  const MAX_KEY_LENGTH = 64;
  // Chrome Sync rejects an item above 8 KB, which fails the whole write.
  const MAX_RECORD_BYTES = 7600;

  function toText(value) {
    return String(value == null ? '' : value).trim();
  }

  // Provider keys match case-insensitively everywhere else, so they are stored
  // lowercased. Aggregate search ids are opaque and keep their case.
  function normalizeProviderKey(value) {
    return toText(value).slice(0, MAX_KEY_LENGTH).toLowerCase();
  }

  function normalizeAggregateId(value) {
    return toText(value).slice(0, MAX_KEY_LENGTH);
  }

  function getKeyNormalizer(listId) {
    return listId === 'aggregate' ? normalizeAggregateId : normalizeProviderKey;
  }

  function normalizeKeyList(value, normalize) {
    const result = [];
    const seen = new Set();
    (Array.isArray(value) ? value : []).forEach((item) => {
      const key = normalize(item);
      if (key && !seen.has(key) && result.length < MAX_LIST_ENTRIES) {
        seen.add(key);
        result.push(key);
      }
    });
    return result;
  }

  function normalizeGroups(value) {
    const groups = normalizeKeyList(value, (item) => {
      const id = toText(item).toLowerCase();
      return GROUP_IDS.includes(id) ? id : '';
    });
    DEFAULT_GROUP_ORDER.forEach((id) => {
      if (!groups.includes(id)) {
        groups.push(id);
      }
    });
    return groups;
  }

  // Source types are camelCase ('topSite'), so they match without case and keep
  // their canonical spelling.
  function toLocalSourceType(value) {
    const token = toText(value).toLowerCase();
    return LOCAL_SOURCE_TYPES.find((type) => type.toLowerCase() === token) || '';
  }

  function normalizeLocal(value) {
    const local = normalizeKeyList(value, toLocalSourceType);
    LOCAL_SOURCE_TYPES.forEach((type) => {
      if (!local.includes(type)) {
        local.push(type);
      }
    });
    return local;
  }

  function getRecordBytes(record) {
    try {
      return JSON.stringify(record).length + STORAGE_KEY.length;
    } catch (error) {
      return Number.MAX_SAFE_INTEGER;
    }
  }

  // Always returns a complete record, so callers never branch on "no order".
  // An over-budget record drops entries from the tail of its longest list.
  function normalizeOrder(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) &&
      Number(value.version) === SCHEMA_VERSION
      ? value
      : {};
    const sourceLists = source.lists && typeof source.lists === 'object' ? source.lists : {};
    const lists = {};
    LIST_IDS.forEach((listId) => {
      lists[listId] = normalizeKeyList(sourceLists[listId], getKeyNormalizer(listId));
    });
    const record = {
      version: SCHEMA_VERSION,
      groups: normalizeGroups(source.groups),
      lists,
      local: normalizeLocal(source.local)
    };
    while (getRecordBytes(record) > MAX_RECORD_BYTES) {
      const longest = LIST_IDS.reduce((best, listId) => (
        record.lists[listId].length > record.lists[best].length ? listId : best
      ), LIST_IDS[0]);
      if (!record.lists[longest].length) {
        break;
      }
      record.lists[longest].pop();
    }
    return record;
  }

  function getListKeys(order, listId) {
    const record = order && order.lists ? order : normalizeOrder(order);
    return Array.isArray(record.lists[listId]) ? record.lists[listId] : [];
  }

  // Items the record lists come first in its order; the rest keep their own
  // order after them, so a source added later never displaces a chosen slot.
  function sortByKeys(items, keys, getKey, normalize) {
    const list = Array.isArray(items) ? items : [];
    const rank = new Map();
    (Array.isArray(keys) ? keys : []).forEach((key, index) => {
      if (!rank.has(key)) {
        rank.set(key, index);
      }
    });
    return list
      .map((item, position) => {
        const key = normalize(getKey(item));
        return {
          item,
          position,
          rank: rank.has(key) ? rank.get(key) : Number.MAX_SAFE_INTEGER
        };
      })
      .sort((left, right) => left.rank - right.rank || left.position - right.position)
      .map((entry) => entry.item);
  }

  function sortList(items, order, listId, getKey) {
    return sortByKeys(
      items,
      getListKeys(order, listId),
      getKey || ((item) => item && item.key),
      getKeyNormalizer(listId)
    );
  }

  function sortLocalSourceTypes(sourceTypes, order) {
    const local = order && Array.isArray(order.local) ? order.local : LOCAL_SOURCE_TYPES;
    return sortByKeys(sourceTypes, local, (type) => type, toLocalSourceType);
  }

  function moveIndex(items, fromIndex, toIndex) {
    const list = Array.isArray(items) ? items.slice() : [];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
      return list;
    }
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    return list;
  }

  // Writes a reordered subset back into a full key list: the slots the subset
  // occupies stay where they are and take the subset's new order. A subset key
  // the full list lacks is appended. Used when only part of a list is on
  // screen, such as the custom searches of one panel group.
  function applySubsetOrder(fullKeys, subsetKeys) {
    const subset = Array.isArray(subsetKeys) ? subsetKeys.filter(Boolean) : [];
    const inSubset = new Set(subset);
    const full = (Array.isArray(fullKeys) ? fullKeys : []).filter(Boolean);
    let next = 0;
    const result = full.map((key) => (inSubset.has(key) ? subset[next++] : key));
    const placed = new Set(result);
    subset.forEach((key) => {
      if (!placed.has(key)) {
        result.push(key);
      }
    });
    return result;
  }

  function withList(order, listId, keys) {
    const record = normalizeOrder(order);
    record.lists[listId] = keys;
    return normalizeOrder(record);
  }

  function withGroups(order, groups) {
    const record = normalizeOrder(order);
    record.groups = groups;
    return normalizeOrder(record);
  }

  function withLocal(order, local) {
    const record = normalizeOrder(order);
    record.local = local;
    return normalizeOrder(record);
  }

  // Records a move made on a surface that shows only part of a list (a panel
  // group, a Settings list without its disabled built-ins). `knownKeys` is
  // every key of the list the surface knows, in its current order;
  // `movedKeys` is the reordered part. Keys the record holds but the surface
  // cannot see keep their slots.
  function applyMove(order, listId, knownKeys, movedKeys) {
    const record = normalizeOrder(order);
    const normalize = listId === 'local' ? toLocalSourceType : getKeyNormalizer(listId);
    const stored = listId === 'local' ? record.local : (record.lists[listId] || []);
    const known = normalizeKeyList(knownKeys, normalize);
    const full = stored.concat(known.filter((key) => !stored.includes(key)));
    const next = applySubsetOrder(full, normalizeKeyList(movedKeys, normalize));
    return listId === 'local' ? withLocal(record, next) : withList(record, listId, next);
  }

  // The record after a tile drag in the search scope panel. The payload is
  // what the panel reports: the list, every item of that list it shows (in
  // order, after the move) and the moved group of items.
  function applyScopeMenuMove(order, payload) {
    const move = payload && typeof payload === 'object' ? payload : {};
    const listId = toText(move.list);
    if (listId !== 'local' && !LIST_IDS.includes(listId)) {
      return normalizeOrder(order);
    }
    const keyOf = (item) => item && item.orderKey;
    return applyMove(
      order,
      listId,
      (Array.isArray(move.listItems) ? move.listItems : []).map(keyOf),
      (Array.isArray(move.movedItems) ? move.movedItems : []).map(keyOf)
    );
  }

  // Moves one group block up (-1) or down (+1) among the blocks the panel
  // shows; blocks it does not show (no aggregate searches yet) keep their slot.
  function applyGroupMove(order, renderedGroups, group, delta) {
    const record = normalizeOrder(order);
    const shown = normalizeKeyList(renderedGroups, (item) => {
      const id = toText(item).toLowerCase();
      return GROUP_IDS.includes(id) ? id : '';
    });
    const fromIndex = shown.indexOf(toText(group).toLowerCase());
    const toIndex = fromIndex + (Number(delta) < 0 ? -1 : 1);
    if (fromIndex < 0 || toIndex < 0 || toIndex >= shown.length) {
      return record;
    }
    return withGroups(record, applySubsetOrder(record.groups, moveIndex(shown, fromIndex, toIndex)));
  }

  function isSameOrder(left, right) {
    return JSON.stringify(normalizeOrder(left)) === JSON.stringify(normalizeOrder(right));
  }

  // Undo and redo for the moves one page makes. Each step keeps the record
  // before and after the move. A step only applies while storage still holds
  // the record it expects; if another page changed the order meanwhile, the
  // history no longer describes what is stored and is dropped.
  function createHistory(options) {
    const limit = Math.max(1, Number(options && options.limit) || 50);
    const done = [];
    const undone = [];
    function clear() {
      done.length = 0;
      undone.length = 0;
    }
    function step(from, to, expected, current) {
      const entry = from[from.length - 1];
      if (!entry) {
        return null;
      }
      if (current !== undefined && !isSameOrder(current, entry[expected])) {
        clear();
        return null;
      }
      from.pop();
      to.push(entry);
      return expected === 'after' ? entry.before : entry.after;
    }
    return Object.freeze({
      record(before, after) {
        if (isSameOrder(before, after)) {
          return;
        }
        done.push({ before: normalizeOrder(before), after: normalizeOrder(after) });
        if (done.length > limit) {
          done.shift();
        }
        undone.length = 0;
      },
      canUndo: () => done.length > 0,
      canRedo: () => undone.length > 0,
      // `current` is the stored record; leave it out to skip the check.
      undo: (current) => step(done, undone, 'after', current),
      redo: (current) => step(undone, done, 'before', current),
      clear
    });
  }

  // Ctrl or Cmd with Z undoes; adding Shift, or Ctrl+Y, redoes. Alt is left
  // alone so other shortcuts keep working.
  function getHistoryShortcut(event) {
    if (!event || event.altKey || !(event.metaKey || event.ctrlKey)) {
      return '';
    }
    const key = String(event.key || '').toLowerCase();
    if (key === 'z') {
      return event.shiftKey ? 'redo' : 'undo';
    }
    if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) {
      return 'redo';
    }
    return '';
  }

  // Orders the search scope panel: group blocks in the chosen order, then
  // pinned and custom entries ahead of built-in ones (as they always were),
  // then the chosen position inside each list, then the surface's own order.
  // `getList` returns 'custom', a list id, 'local', or 'pinned' for an entry
  // that leads its block and is not reorderable.
  function rankScopeItems(items, order, options) {
    const list = Array.isArray(items) ? items : [];
    const settings = options && typeof options === 'object' ? options : {};
    const record = normalizeOrder(order);
    const groupRank = new Map(record.groups.map((group, index) => [group, index]));
    const getGroup = settings.getGroup || ((item) => item && item.groupKey);
    const getList = settings.getList || ((item) => item && item.orderList);
    const getKey = settings.getKey || ((item) => item && item.orderKey);
    const keyRanks = {};
    const getKeyRank = (listId, key) => {
      if (!keyRanks[listId]) {
        const keys = listId === 'local' ? record.local : (record.lists[listId] || []);
        keyRanks[listId] = new Map(keys.map((entry, index) => [entry, index]));
      }
      const normalized = listId === 'local'
        ? toLocalSourceType(key)
        : getKeyNormalizer(listId)(key);
      const ranks = keyRanks[listId];
      return ranks.has(normalized) ? ranks.get(normalized) : Number.MAX_SAFE_INTEGER;
    };
    return list
      .map((item, position) => {
        const group = toText(getGroup(item)).toLowerCase();
        const listId = toText(getList(item));
        return {
          item,
          position,
          groupRank: groupRank.has(group) ? groupRank.get(group) : Number.MAX_SAFE_INTEGER,
          tier: listId === 'pinned' || listId === 'custom' ? 0 : 1,
          keyRank: listId && listId !== 'pinned' ? getKeyRank(listId, getKey(item)) : -1
        };
      })
      .sort((left, right) => (
        left.groupRank - right.groupRank ||
        left.tier - right.tier ||
        left.keyRank - right.keyRank ||
        left.position - right.position
      ))
      .map((entry) => entry.item);
  }

  return Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    GROUP_IDS,
    DEFAULT_GROUP_ORDER,
    LIST_IDS,
    LOCAL_SOURCE_TYPES,
    MAX_LIST_ENTRIES,
    MAX_RECORD_BYTES,
    applyGroupMove,
    applyMove,
    applyScopeMenuMove,
    applySubsetOrder,
    createHistory,
    getHistoryShortcut,
    getListKeys,
    isSameOrder,
    moveIndex,
    normalizeOrder,
    rankScopeItems,
    sortByKeys,
    sortList,
    sortLocalSourceTypes,
    toLocalSourceType,
    withGroups,
    withList,
    withLocal
  });
});
