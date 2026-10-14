(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoSearchSourceOrder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // One plain preference record holds every custom order the Search sources
  // page offers. Chrome Sync limits a single item to 8 KB, so the record stays
  // a flat list of short keys instead of nested per-group structures.
  const STORAGE_KEY = '_x_extension_search_source_order_2026_unique_';
  const SCHEMA_VERSION = 1;

  // Group ids are stable identifiers; the visible labels stay in the locale
  // files so every surface keeps translating them. The label keys are not a
  // mechanical plural of the id, so the mapping is explicit.
  const GROUP_IDS = Object.freeze(['aggregate', 'ai', 'engine', 'local', 'site']);
  const GROUP_LABEL_KEYS = Object.freeze({
    aggregate: 'search_scope_group_aggregates',
    ai: 'search_scope_group_ai',
    engine: 'search_scope_group_engines',
    local: 'search_scope_group_local',
    site: 'search_scope_group_sites'
  });
  // Alphabetical when the reader has not chosen an order yet.
  const DEFAULT_GROUP_ORDER = Object.freeze(['aggregate', 'ai', 'engine', 'local', 'site']);
  const LOCAL_SOURCE_TYPES = Object.freeze(['topSite', 'bookmark', 'history']);

  const MAX_ORDER_ENTRIES = 256;
  const MAX_KEY_LENGTH = 32;
  const MAX_ID_LENGTH = 48;
  // Chrome Sync rejects a single item above 8 KB, so the record is bounded by
  // bytes as well as by entry count. Entries beyond the budget are dropped from
  // the tail instead of letting one oversized preference fail the whole sync
  // write (and, once it is in the contract, the whole WebDAV apply).
  const MAX_RECORD_BYTES = 8000;

  function toText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeToken(value, maxLength) {
    return toText(value).slice(0, maxLength).toLowerCase();
  }

  function normalizeId(value) {
    return toText(value).slice(0, MAX_ID_LENGTH);
  }

  function normalizeGroupIds(value) {
    const result = [];
    const seen = new Set();
    (Array.isArray(value) ? value : []).forEach((item) => {
      const id = normalizeToken(item, MAX_KEY_LENGTH);
      if (id && GROUP_IDS.includes(id) && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    });
    // Every known group keeps a slot so a partially written record still
    // renders deterministically.
    GROUP_IDS.forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    });
    return result;
  }

  function normalizeKeyList(value, normalize) {
    const result = [];
    const seen = new Set();
    (Array.isArray(value) ? value : []).forEach((item) => {
      const key = normalize(item);
      if (!key || seen.has(key) || result.length >= MAX_ORDER_ENTRIES) {
        return;
      }
      seen.add(key);
      result.push(key);
    });
    return result;
  }

  function normalizeOrderEntryList(value) {
    const result = [];
    const seen = new Set();
    (Array.isArray(value) ? value : []).forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }
      const key = normalizeToken(item.key, MAX_KEY_LENGTH);
      const group = normalizeToken(item.group, MAX_KEY_LENGTH);
      if (!key || !GROUP_IDS.includes(group) || seen.has(key) || result.length >= MAX_ORDER_ENTRIES) {
        return;
      }
      seen.add(key);
      result.push({ key, group });
    });
    return result;
  }

  function buildPreferenceIndex(order, field) {
    const index = Object.create(null);
    const list = order && Array.isArray(order[field]) ? order[field] : [];
    list.forEach((entry, position) => {
      const key = field === 'providers' ? entry && entry.key : entry;
      const normalized = field === 'providers' ? normalizeToken(key, MAX_KEY_LENGTH) : normalizeId(key);
      if (normalized && !(normalized in index)) {
        index[normalized] = position;
      }
    });
    return index;
  }

  // Stable "listed items first, in the configured order, then the rest in
  // their original order". Nothing is dropped, so a provider the reader has
  // never reordered keeps its registry position.
  function sortByConfiguredOrder(items, order, options) {
    const list = Array.isArray(items) ? items : [];
    if (list.length < 2) {
      return list.slice();
    }
    const settings = options && typeof options === 'object' ? options : {};
    const field = settings.field === 'providers' ? 'providers' : 'aggregates';
    const getKey = typeof settings.getKey === 'function'
      ? settings.getKey
      : (item) => (field === 'providers'
        ? item && item.key
        : (item && (item.id || item.key)));
    const index = buildPreferenceIndex(order, field);
    const normalized = field === 'providers' ? normalizeToken : normalizeId;
    return list
      .map((item, position) => ({
        item,
        position,
        rank: index[normalized(getKey(item))] 
      }))
      .sort((left, right) => {
        const leftRanked = typeof left.rank === 'number';
        const rightRanked = typeof right.rank === 'number';
        if (leftRanked && rightRanked) {
          return left.rank - right.rank || left.position - right.position;
        }
        if (leftRanked !== rightRanked) {
          return leftRanked ? -1 : 1;
        }
        return left.position - right.position;
      })
      .map((entry) => entry.item);
  }

  function compareByDisplayName(options) {
    const settings = options && typeof options === 'object' ? options : {};
    const getName = typeof settings.getName === 'function'
      ? settings.getName
      : (item) => item && (item.name || item.label || item.key);
    return (left, right) => {
      const leftName = toText(getName(left));
      const rightName = toText(getName(right));
      return leftName.localeCompare(rightName, undefined, { numeric: true, sensitivity: 'base' });
    };
  }

  // Default order used before the reader customizes anything: the group blocks
  // sort alphabetically by id and each group's providers sort alphabetically by
  // display name. This also matches "AI search" sorting ahead of "Search
  // engines" and "Site search".
  function createInitialOrder(providers, options) {
    const settings = options && typeof options === 'object' ? options : {};
    const classify = typeof settings.getGroupKey === 'function' ? settings.getGroupKey : () => 'site';
    const getName = typeof settings.getName === 'function' ? settings.getName : (item) => item && (item.name || item.key);
    const list = (Array.isArray(providers) ? providers : []).filter(Boolean);
    const byGroup = Object.create(null);
    list.forEach((provider) => {
      const group = normalizeToken(classify(provider), MAX_KEY_LENGTH);
      const resolved = GROUP_IDS.includes(group) ? group : 'site';
      if (!byGroup[resolved]) {
        byGroup[resolved] = [];
      }
      byGroup[resolved].push(provider);
    });
    const compare = compareByDisplayName({ getName });
    const order = [];
    GROUP_IDS.slice().sort().forEach((group) => {
      // 'local' holds source types rather than providers and is ordered by its
      // canonical list, not by a display name.
      if (group === 'local') {
        return;
      }
      (byGroup[group] || []).slice().sort(compare).forEach((provider) => {
        const key = toText(provider && provider.key).toLowerCase();
        if (key) {
          order.push({ key: key.slice(0, MAX_KEY_LENGTH), group });
        }
      });
    });
    return trimOrderToByteBudget({
      version: SCHEMA_VERSION,
      groups: GROUP_IDS.slice().sort(),
      providers: order,
      local: LOCAL_SOURCE_TYPES.slice(),
      aggregates: []
    });
  }

  // The same alphabetical default, built straight from the surface's own list.
  // Kept byte-identical to createInitialOrder so a record seeded by Settings and
  // a record resolved by the background describe the same order.
  function createDefaultOrder(providers, options) {
    return createInitialOrder(providers, options);
  }

  // Drops trailing entries until the serialized record fits the Chrome Sync
  // item budget. Group order and the browser content list are kept: they are a
  // handful of short strings and carry the most visible part of the order.
  function trimOrderToByteBudget(order) {
    const record = {
      version: SCHEMA_VERSION,
      groups: normalizeGroupIds(order && order.groups),
      providers: normalizeOrderEntryList(order && order.providers),
      local: (Array.isArray(order && order.local) && order.local.length
        ? order.local
        : LOCAL_SOURCE_TYPES.slice()).slice(),
      aggregates: normalizeKeyList(order && order.aggregates, normalizeId)
    };
    const sizeOf = (candidate) => getRecordByteLength(candidate);
    if (sizeOf(record) <= MAX_RECORD_BYTES) {
      return record;
    }
    // Aggregates are the shortest list and the least costly to drop from the
    // tail, then providers.
    while (record.aggregates.length && sizeOf(record) > MAX_RECORD_BYTES) {
      record.aggregates.pop();
    }
    while (record.providers.length && sizeOf(record) > MAX_RECORD_BYTES) {
      record.providers.pop();
    }
    return record;
  }

  function getRecordByteLength(order) {
    try {
      return JSON.stringify(order).length + STORAGE_KEY.length;
    } catch (error) {
      return Number.MAX_SAFE_INTEGER;
    }
  }

  // Fills in anything the stored record does not mention: a provider added by
  // a newer version, an aggregate search created on another device, or a
  // value written by an older build. Missing entries land at the end of their
  // group so existing custom order is never disturbed.
  function reconcileOrder(order, providers, options) {
    const settings = options && typeof options === 'object' ? options : {};
    const classify = typeof settings.getGroupKey === 'function' ? settings.getGroupKey : () => 'site';
    const getName = typeof settings.getName === 'function' ? settings.getName : (item) => item && (item.name || item.key);
    const list = (Array.isArray(providers) ? providers : []).filter(Boolean);
    // Keys the caller can currently render. A stored key outside this set is
    // stale (a removed provider, or a value from another extension build) and
    // is dropped so the record does not grow without bound.
    const availableKeys = new Set(list
      .map((provider) => normalizeToken(provider && provider.key, MAX_KEY_LENGTH))
      .filter(Boolean));
    const known = new Set();
    const entries = [];
    normalizeOrderEntryList(order && order.providers).forEach((entry) => {
      if (known.has(entry.key) || !availableKeys.has(entry.key)) {
        return;
      }
      known.add(entry.key);
      entries.push(entry);
    });
    const missing = list.filter((provider) => {
      const key = normalizeToken(provider && provider.key, MAX_KEY_LENGTH);
      return key && !known.has(key);
    });
    const compare = compareByDisplayName({ getName });
    missing.sort(compare).forEach((provider) => {
      const key = normalizeToken(provider && provider.key, MAX_KEY_LENGTH);
      const group = (() => {
        const resolved = normalizeToken(classify(provider), MAX_KEY_LENGTH);
        return GROUP_IDS.includes(resolved) ? resolved : 'site';
      })();
      known.add(key);
      entries.push({ key, group });
    });

    const aggregates = Array.isArray(settings.aggregates) ? settings.aggregates : [];
    const aggregateIds = aggregates
      .map((definition) => normalizeId(definition && (definition.id || definition.key)))
      .filter(Boolean);
    const knownAggregates = normalizeKeyList(order && order.aggregates, normalizeId);
    const missingAggregates = aggregateIds.filter((id) => !knownAggregates.includes(id));

    const localKeys = normalizeKeyList(order && order.local, (item) => normalizeToken(item, MAX_KEY_LENGTH))
      .filter((key) => LOCAL_SOURCE_TYPES.includes(key));
    const missingLocal = LOCAL_SOURCE_TYPES.filter((key) => !localKeys.includes(key));

    return trimOrderToByteBudget({
      version: SCHEMA_VERSION,
      groups: normalizeGroupIds(order && order.groups),
      providers: entries,
      local: localKeys.concat(missingLocal),
      aggregates: knownAggregates.concat(missingAggregates)
    });
  }

  function normalizeOrder(value, providers, options) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return createDefaultOrder(providers, options);
    }
    const hasVersion = Number(value.version) === SCHEMA_VERSION;
    if (!hasVersion) {
      return createDefaultOrder(providers, options);
    }
    return reconcileOrder(value, providers, options);
  }

  // Reader-facing default when nothing is stored yet: an explicit, complete
  // order rather than "whatever the registry happens to declare".
  function resolveInitialOrder(providers, options) {
    return createInitialOrder(providers, options);
  }

  // Ranks providers the way the search scope surfaces render them: the
  // configured group block first, then the configured position inside it. A
  // provider the record does not mention lands at the end of its group, so
  // existing custom order is never disturbed.
  function sortProviders(providers, order, options) {
    const items = (Array.isArray(providers) ? providers : []).map((provider) => ({
      groupKey: getProviderGroup(order, provider && provider.key, 'site'),
      kind: 'provider',
      provider
    }));
    return rankMenuItems(items, order, {
      getField: () => 'providers',
      getGroup: (item) => item.groupKey,
      getKey: (item) => item.provider && item.provider.key
    }).map((item) => item.provider);
  }

  function sortAggregates(definitions, order) {
    return sortByConfiguredOrder(definitions, order, { field: 'aggregates' });
  }

  function sortLocalSourceTypes(sourceTypes, order) {
    const list = Array.isArray(sourceTypes) ? sourceTypes.slice() : [];
    const preference = buildPreferenceIndex(order, 'local');
    return list
      .map((sourceType, position) => ({
        sourceType,
        position,
        rank: preference[toText(sourceType).toLowerCase()]
      }))
      .sort((left, right) => {
        const leftRanked = typeof left.rank === 'number';
        const rightRanked = typeof right.rank === 'number';
        if (leftRanked && rightRanked) {
          return left.rank - right.rank || left.position - right.position;
        }
        if (leftRanked !== rightRanked) {
          return leftRanked ? -1 : 1;
        }
        return left.position - right.position;
      })
      .map((entry) => entry.sourceType);
  }

  function getGroupRank(order) {
    const groups = normalizeGroupIds(order && order.groups);
    const rank = Object.create(null);
    groups.forEach((group, position) => {
      rank[group] = position;
    });
    return rank;
  }

  function buildProviderGroupIndex(order) {
    const index = Object.create(null);
    normalizeOrderEntryList(order && order.providers).forEach((entry) => {
      index[entry.key] = entry.group;
    });
    return index;
  }

  function getProviderGroup(order, providerKey, fallbackGroup) {
    const index = buildProviderGroupIndex(order);
    const key = normalizeToken(providerKey, MAX_KEY_LENGTH);
    const group = key && index[key];
    if (group) {
      return group;
    }
    const fallback = normalizeToken(fallbackGroup, MAX_KEY_LENGTH);
    return GROUP_IDS.includes(fallback) ? fallback : 'site';
  }

  function getGroupLabelKey(group) {
    const resolved = normalizeToken(group, MAX_KEY_LENGTH);
    return GROUP_IDS.includes(resolved) ? GROUP_LABEL_KEYS[resolved] : '';
  }

  // Ranks a provider, aggregate search or browser source type inside its group.
  // Items the record does not mention rank after the listed ones, so a newly
  // added provider never displaces a position the reader chose.
  function getItemRank(order, field, key) {
    const preference = buildPreferenceIndex(order, field);
    const normalize = field === 'providers' ? normalizeToken : normalizeId;
    const resolved = normalize(key);
    if (!resolved) {
      return Number.MAX_SAFE_INTEGER;
    }
    return resolved in preference ? preference[resolved] : Number.MAX_SAFE_INTEGER;
  }

  // Total order for a search scope panel: group blocks in the configured
  // group order, then the configured item order inside each block, then the
  // surface's own insertion order. Replaces sort-by-kind concatenation so a
  // custom order survives provider and aggregate reordering.
  function rankMenuItems(items, order, options) {
    const list = Array.isArray(items) ? items : [];
    if (list.length < 2) {
      return list.slice();
    }
    const settings = options && typeof options === 'object' ? options : {};
    const getGroup = typeof settings.getGroup === 'function'
      ? settings.getGroup
      : (item) => item && item.groupKey;
    // Browser content items read their position from the `local` list, not from
    // the provider or aggregate lists, so a source type can never borrow a
    // provider's or an aggregate search's rank.
    const getField = typeof settings.getField === 'function'
      ? settings.getField
      : (item) => {
        if (!item || typeof item !== 'object') {
          return 'providers';
        }
        if (item.kind === 'local') {
          return 'local';
        }
        return item.kind === 'provider' ? 'providers' : 'aggregates';
      };
    const getKey = typeof settings.getKey === 'function'
      ? settings.getKey
      : (item) => {
        if (item && item.kind === 'aggregate') {
          return item.aggregate && (item.aggregate.id || item.aggregate.key);
        }
        if (item && item.kind === 'local') {
          return item.sourceType;
        }
        return item && item.provider && item.provider.key;
      };
    const groupRank = getGroupRank(order);
    return list
      .map((item, position) => {
        const group = normalizeToken(getGroup(item), MAX_KEY_LENGTH);
        return {
          item,
          position,
          groupRank: group in groupRank ? groupRank[group] : Number.MAX_SAFE_INTEGER,
          itemRank: getItemRank(order, getField(item), getKey(item))
        };
      })
      .sort((left, right) => (
        left.groupRank - right.groupRank ||
        left.itemRank - right.itemRank ||
        left.position - right.position
      ))
      .map((entry) => entry.item);
  }

  function isLocalSourceType(value) {
    return LOCAL_SOURCE_TYPES.includes(toText(value));
  }

  return Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    GROUP_IDS,
    GROUP_LABEL_KEYS,
    DEFAULT_GROUP_ORDER,
    LOCAL_SOURCE_TYPES,
    MAX_ORDER_ENTRIES,
    MAX_KEY_LENGTH,
    MAX_ID_LENGTH,
    MAX_RECORD_BYTES,
    buildProviderGroupIndex,
    compareByDisplayName,
    createDefaultOrder,
    createInitialOrder,
    getGroupLabelKey,
    getGroupRank,
    getItemRank,
    getProviderGroup,
    isLocalSourceType,
    normalizeGroupIds,
    normalizeKeyList,
    normalizeOrder,
    normalizeOrderEntryList,
    normalizeToken,
    rankMenuItems,
    reconcileOrder,
    resolveInitialOrder,
    sortAggregates,
    sortByConfiguredOrder,
    sortLocalSourceTypes,
    sortProviders
  });
});
