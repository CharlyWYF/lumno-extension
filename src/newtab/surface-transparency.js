(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LumnoSurfaceTransparency = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const KEY = '_x_extension_newtab_surface_transparency_2026_unique_';
  const fields = ['search', 'shortcut'];
  const percent = value => value === null || value === '' || typeof value === 'boolean' || !Number.isFinite(Number(value))
    ? 0 : Math.round(Math.max(0, Math.min(100, Number(value))));
  const normalize = value => Object.fromEntries(fields.map(field => [field, percent(value?.[field])]));
  function createRuntime({ documentObj: document, chromeObj: chrome, storageArea: storage, t, showToast }) {
    let values = normalize(); let saved = { ...values }; let refs; let revision = 0; let pending = 0; let disposed = false;
    let queue = Promise.resolve(); const removeListeners = [];
    function apply() {
      fields.forEach(field => {
        if (values[field] > 0) document.body.setAttribute(`data-${field}-transparency`, String(values[field]));
        else document.body.removeAttribute(`data-${field}-transparency`);
        document.body.style.setProperty(`--x-nt-${field}-surface-strength`, String((100 - values[field]) / 100));
      });
    }
    function update() {
      if (!refs) return;
      fields.forEach(field => {
        const label = t(`newtab_${field}_transparency`, field === 'search' ? 'Search box transparency' : 'Shortcut background transparency');
        const slider = refs[`${field}TransparencySlider`]; const input = refs[`${field}TransparencyValue`];
        refs[`${field}TransparencyLabel`].textContent = label;
        slider.setAttribute('aria-label', label); input.setAttribute('aria-label', label);
        slider.value = input.value = String(values[field]);
        slider.setAttribute('aria-valuetext', `${values[field]}%`);
        slider.style.setProperty('--x-range-slider-percent', `${values[field]}%`);
        refs[`${field}TransparencyHint`].textContent = t('newtab_transparency_hint', '0% keeps the original background; 100% is fully transparent. Text and icons stay unchanged.');
        const reset = refs[`${field}TransparencyReset`];
        reset.setAttribute('aria-label', t('newtab_transparency_reset', 'Reset transparency'));
        reset.title = t('newtab_transparency_reset', 'Reset transparency'); reset.disabled = values[field] === 0;
      });
    }
    function preview(field, value) {
      values = { ...values, [field]: percent(value) }; revision++; apply(); update();
    }
    function commit(field, value) {
      if (disposed) return Promise.resolve();
      preview(field, value); const current = revision; const snapshot = { ...values }; pending++;
      queue = queue.then(() => new Promise((resolve, reject) => {
        if (!storage) return reject(new Error('Storage unavailable'));
        storage.set({ [KEY]: snapshot }, () => {
          const error = chrome?.runtime?.lastError;
          if (error) reject(new Error(error.message)); else resolve();
        });
      })).then(() => { saved = snapshot; }).catch(() => {
        if (!disposed && current === revision) { values = { ...saved }; apply(); update(); }
        if (!disposed) showToast?.(t('newtab_transparency_save_error', 'Could not save transparency. Try again.'), true);
      }).finally(() => { pending--; });
      return queue;
    }
    function listen(element, event, listener) {
      element.addEventListener(event, listener); removeListeners.push(() => element.removeEventListener(event, listener));
    }
    function bindSettings(nextRefs) {
      if (refs) return;
      refs = nextRefs;
      fields.forEach(field => {
        const slider = refs[`${field}TransparencySlider`]; const input = refs[`${field}TransparencyValue`];
        listen(slider, 'input', () => preview(field, slider.value));
        listen(slider, 'change', () => commit(field, slider.value));
        listen(input, 'input', () => { if (input.value.trim() && Number.isFinite(Number(input.value))) preview(field, input.value); });
        listen(input, 'blur', () => commit(field, input.value));
        listen(input, 'keydown', event => { if (event.key === 'Enter') { event.preventDefault(); input.blur(); } });
        listen(refs[`${field}TransparencyReset`], 'click', () => commit(field, 0));
      });
      update();
    }
    const onChanged = (changes, area) => {
      if (disposed || pending || area !== 'sync' || !changes[KEY]) return;
      const next = normalize(changes[KEY].newValue);
      if (fields.every(field => next[field] === saved[field])) return;
      revision++; values = saved = next; apply(); update();
    };
    chrome?.storage?.onChanged?.addListener(onChanged);
    apply();
    const initialRevision = revision;
    const ready = new Promise(resolve => {
      if (!storage) return resolve();
      storage.get([KEY], result => {
        if (!disposed && revision === initialRevision && !chrome?.runtime?.lastError) {
          values = saved = normalize(result?.[KEY]); apply(); update();
        }
        resolve();
      });
    });
    return { ready, bindSettings, updateLanguage: update, preview, commit, getValues: () => ({ ...values }),
      destroy() { disposed = true; removeListeners.forEach(remove => remove()); chrome?.storage?.onChanged?.removeListener(onChanged); }
    };
  }
  return Object.freeze({ KEY, normalize, createRuntime });
});
