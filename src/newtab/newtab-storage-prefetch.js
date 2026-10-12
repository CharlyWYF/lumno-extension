(function() {
  // Starts the startup work the last New Tab's choices make known while the rest of the page is still
  // loading; newtab.js takes the results.
  const settings = globalThis.LumnoSettings;
  const chromeApi = window.chrome || null;

  function readCache(key) {
    try {
      return window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (_error) {
      return null;
    }
  }

  // The locale messages gate the page's first reveal; fetch them now instead of after storage answers.
  const cachedLocale = readCache(settings.NEWTAB_LOCALE_CACHE_KEY);
  if (cachedLocale && settings.normalizeLocale(cachedLocale) === cachedLocale &&
      chromeApi && chromeApi.runtime && typeof chromeApi.runtime.getURL === 'function') {
    const localePath = chromeApi.runtime.getURL(`_locales/${cachedLocale}/messages.json`);
    globalThis.LumnoNewtabLocalePrefetch = {
      locale: cachedLocale,
      messages: fetch(localePath, { cache: 'no-store' }).then((response) => response.json())
    };
  }

  let keys = null;
  try {
    keys = JSON.parse(readCache(settings.NEWTAB_STARTUP_STORAGE_KEYS_CACHE_KEY) || 'null');
  } catch (_error) {
    keys = null;
  }
  if (!Array.isArray(keys) || !keys.length || !keys.every((key) => typeof key === 'string')) {
    return;
  }
  const providerRuntime = settings.createProviderStorageRuntime(chromeApi);
  if (providerRuntime) {
    settings.prefetchStorageRead(providerRuntime.area, keys, chromeApi);
  }
})();
