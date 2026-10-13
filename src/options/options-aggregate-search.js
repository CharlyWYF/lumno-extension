(function(root) {
  'use strict';

  // Aggregate searches on the Options page: the state coordinator that keeps
  // edits from racing storage, and the rules for saving one aggregate search.
  // Validation results name a locale message key in `error`.

  // Loads, applies and mutates the aggregate search list. Mutations run one at
  // a time against freshly loaded items; a storage change or a newer load
  // makes older loads stale, and a mutation whose load went stale reloads.
  function createAggregateSearchStateCoordinator(config) {
    const options = config && typeof config === 'object' ? config : {};
    const normalize = typeof options.normalize === 'function'
      ? options.normalize
      : (items) => Array.isArray(items) ? items : [];
    const getCurrent = typeof options.getCurrent === 'function'
      ? options.getCurrent
      : () => [];
    let changeGeneration = 0;
    let loadGeneration = 0;
    let mutationQueue = Promise.resolve();

    function startLoad() {
      const token = {
        changeGeneration,
        loadGeneration: ++loadGeneration
      };
      let result;
      try {
        result = typeof options.load === 'function'
          ? options.load()
          : Promise.reject(new Error('aggregate-search-runtime-unavailable'));
      } catch (error) {
        result = Promise.reject(error);
      }
      return {
        promise: Promise.resolve(result).then(normalize),
        token
      };
    }

    function isLoadCurrent(token) {
      return Boolean(token) &&
        token.changeGeneration === changeGeneration &&
        token.loadGeneration === loadGeneration;
    }

    function refresh() {
      const pending = startLoad();
      return pending.promise.then((items) => {
        if (!isLoadCurrent(pending.token)) {
          return getCurrent();
        }
        if (typeof options.apply === 'function') {
          options.apply(items);
        }
        return items;
      }).catch((error) => {
        if (isLoadCurrent(pending.token) && typeof options.onLoadError === 'function') {
          options.onLoadError(error);
        }
        throw error;
      });
    }

    function loadLatestForMutation() {
      const pending = startLoad();
      return pending.promise.then((items) => {
        if (!isLoadCurrent(pending.token)) {
          return loadLatestForMutation();
        }
        return items;
      });
    }

    function enqueueMutation(mutate) {
      const operation = mutationQueue.then(() => loadLatestForMutation()).then((items) => {
        const result = typeof mutate === 'function' ? mutate(items) : null;
        if (!result || !Object.prototype.hasOwnProperty.call(result, 'items')) {
          return result;
        }
        const changeGenerationAtWrite = changeGeneration;
        loadGeneration += 1;
        return Promise.resolve().then(() => options.save(result.items)).then((savedItems) => {
          const normalizedItems = normalize(savedItems);
          loadGeneration += 1;
          if (changeGenerationAtWrite === changeGeneration && typeof options.apply === 'function') {
            options.apply(normalizedItems);
          }
          return { ...result, items: normalizedItems };
        });
      });
      // The caller gets this mutation's own result; the queue only needs to
      // know it settled.
      mutationQueue = operation.then(() => undefined, () => undefined);
      return operation;
    }

    function applyStorageChange(value) {
      changeGeneration += 1;
      loadGeneration += 1;
      const items = normalize(value);
      if (typeof options.apply === 'function') {
        options.apply(items);
      }
      return items;
    }

    return {
      applyStorageChange,
      enqueueMutation,
      refresh
    };
  }

  function createAggregateSearchModel(deps) {
    const store = deps.aggregateSearchStore;
    const limits = Object.freeze({
      maxItems: Number(store.MAX_AGGREGATE_COUNT) || 8,
      maxKeyLength: Number(store.MAX_KEY_LENGTH) || 32,
      maxNameLength: Number(store.MAX_NAME_LENGTH) || 80,
      maxSources: Number(store.MAX_SOURCE_COUNT) || 10,
      minSources: Number(store.MIN_SOURCE_COUNT) || 2
    });

    // Installs from before the global switch kept it per aggregate search: on
    // when there were none yet, or when any of them had it on.
    function deriveLegacyAutoGroupEnabled(value) {
      const items = store.normalizeAggregateSearches(value);
      return items.length === 0 || items.some((item) => item && item.autoCreateTabGroup === true);
    }

    // Checks a draft from the editor and builds the item to save.
    //   context: { items (current list), hasKeyConflict(key, id),
    //              availableProviders, createId() }
    function buildAggregateSearchItem(id, draft, context) {
      const currentId = String(id || '').trim();
      const keyRaw = String(draft && draft.key ? draft.key : '').trim().slice(0, limits.maxKeyLength);
      if (!keyRaw) {
        return { ok: false, error: 'shortcuts_error_key' };
      }
      if (/\s/.test(keyRaw)) {
        return { ok: false, error: 'shortcuts_error_key_space' };
      }
      const key = store.normalizeAggregateSearchKey(keyRaw);
      if (!key) {
        return { ok: false, error: 'shortcuts_error_key' };
      }
      if (context.hasKeyConflict(key, currentId)) {
        return { ok: false, error: 'shortcuts_error_key_duplicate' };
      }
      const name = String(draft && draft.name ? draft.name : '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, limits.maxNameLength);
      const sourceRefs = store.normalizeSourceRefs(draft && draft.sourceRefs);
      if (!name) {
        return { ok: false, error: 'aggregate_search_name_required_error' };
      }
      if (sourceRefs.length < limits.minSources) {
        return { ok: false, error: 'aggregate_search_min_sources_error' };
      }
      if (sourceRefs.length > limits.maxSources) {
        return { ok: false, error: 'aggregate_search_max_sources_error' };
      }
      const previousItem = currentId
        ? (context.items || []).find((item) => String(item && item.id || '') === currentId)
        : null;
      const item = {
        id: currentId || context.createId(),
        key,
        name,
        sourceRefs,
        ...(previousItem
          ? { autoCreateTabGroup: previousItem.autoCreateTabGroup === true }
          : {})
      };
      const availability = store.getAggregateSearchAvailability(item, context.availableProviders);
      if (!availability.available) {
        return { ok: false, error: 'aggregate_search_source_selection_unavailable_error' };
      }
      return { ok: true, item };
    }

    // Puts a built item into the freshly loaded list, replacing the one being
    // edited, unless the list is full or its name or trigger is taken.
    function mergeAggregateSearchItem(items, item, id) {
      const currentId = String(id || '').trim();
      if (!currentId && items.length >= limits.maxItems) {
        return { ok: false, error: 'aggregate_search_max_items_error' };
      }
      const others = items.filter((entry) => String(entry.id || '') !== currentId);
      if (others.some((entry) => (
        String(entry.name || '').trim().toLocaleLowerCase() === item.name.toLocaleLowerCase()
      ))) {
        return { ok: false, error: 'aggregate_search_name_duplicate_error' };
      }
      if (others.some((entry) => String(entry.key || '').trim().toLowerCase() === item.key)) {
        return { ok: false, error: 'shortcuts_error_key_duplicate' };
      }
      return {
        items: currentId
          ? items.map((entry) => String(entry.id || '') === currentId ? item : entry)
          : items.concat(item),
        ok: true
      };
    }

    return Object.freeze({
      buildAggregateSearchItem,
      deriveLegacyAutoGroupEnabled,
      limits,
      mergeAggregateSearchItem
    });
  }

  const api = Object.freeze({
    createAggregateSearchModel,
    createAggregateSearchStateCoordinator
  });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LumnoOptionsAggregateSearch = api;
})(globalThis);
