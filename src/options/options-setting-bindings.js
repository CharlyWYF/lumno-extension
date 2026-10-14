(function(root) {
  'use strict';

  // Routes chrome.storage.onChanged events to the handlers each settings
  // section registers next to its own render code. A handler watches one key
  // or several; with several it runs once per event when any of them changed.
  // Handlers run in registration order. By default they only see events from
  // the provider's primary area; `area: 'local'` watches chrome.storage.local.
  function createStorageChangeRegistry(options) {
    const isPrimaryAreaName = options && typeof options.isPrimaryAreaName === 'function'
      ? options.isPrimaryAreaName
      : () => false;
    const entries = [];

    function on(keys, handler, entryOptions) {
      const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
      if (!list.length || typeof handler !== 'function') {
        return;
      }
      entries.push({
        area: (entryOptions && entryOptions.area) || 'primary',
        handler,
        keys: list
      });
    }

    function dispatch(changes, areaName) {
      if (!changes || typeof changes !== 'object') {
        return;
      }
      const isPrimary = isPrimaryAreaName(areaName);
      entries.forEach((entry) => {
        const watchesArea = entry.area === 'primary' ? isPrimary : entry.area === areaName;
        if (watchesArea && entry.keys.some((key) => changes[key])) {
          entry.handler(changes, areaName);
        }
      });
    }

    return Object.freeze({ dispatch, on });
  }

  // Binds one stored setting to the page: reads it once at startup, applies the
  // normalized value, follows later storage changes, and writes the normalized
  // value back when the stored one was missing or invalid.
  //
  // Spec fields:
  //   key              storage key
  //   normalize(raw)   stored value -> value the page shows
  //   normalizeChange  normalizer for storage changes, when it differs
  //   apply(value)     renders the value
  //   load             false to skip the startup read (a section reads it
  //                    together with related keys)
  //   repairOnLoad     false to never write back after the startup read
  //   repairOnChange   false to never write back after a storage change
  //   refreshSelects   true to refresh the custom selects after applying
  //
  // bindToggle/bindSelect add the control: they apply through setToggleState
  // or setSelectState (then spec.afterApply), and persist the control's own
  // changes. `normalizeInput` overrides how the control's value is read.
  function createSettingBinder(options) {
    const config = options || {};
    const storageArea = config.storageArea || null;
    const registry = config.registry;
    const refreshCustomSelects = typeof config.refreshCustomSelects === 'function'
      ? config.refreshCustomSelects
      : () => {};

    function write(values) {
      if (storageArea) {
        storageArea.set(values);
      }
    }

    function bindSetting(spec) {
      const key = spec.key;
      const normalizeChange = spec.normalizeChange || spec.normalize;
      const sync = (raw, normalize, repair) => {
        const value = normalize(raw);
        spec.apply(value, raw);
        if (repair && raw !== value) {
          write({ [key]: value });
        }
        if (spec.refreshSelects) {
          refreshCustomSelects();
        }
      };
      if (spec.load !== false && storageArea) {
        storageArea.get([key], (result) => {
          sync(result ? result[key] : undefined, spec.normalize, spec.repairOnLoad !== false);
        });
      }
      registry.on(key, (changes) => {
        sync(changes[key].newValue, normalizeChange, spec.repairOnChange !== false);
      });
    }

    function bindControl(spec, readControl, setControlState) {
      const control = spec.input;
      const apply = (value) => {
        setControlState(control, value);
        if (typeof spec.afterApply === 'function') {
          spec.afterApply(value);
        }
      };
      bindSetting(Object.assign({}, spec, { apply }));
      if (!control) {
        return;
      }
      const normalizeInput = spec.normalizeInput || spec.normalize;
      control.addEventListener('change', () => {
        const next = normalizeInput(readControl(control));
        apply(next);
        write({ [spec.key]: next });
      });
    }

    function bindToggle(spec) {
      bindControl(spec, (input) => input.checked, config.setToggleState);
    }

    function bindSelect(spec) {
      bindControl(spec, (select) => select.value, config.setSelectState);
    }

    return Object.freeze({ bindSelect, bindSetting, bindToggle });
  }

  const api = Object.freeze({ createSettingBinder, createStorageChangeRegistry });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LumnoOptionsSettingBindings = api;
})(globalThis);
