(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoSelectionQuickActionProvider = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function getInteractiveProviders(providers, isInteractive) {
    const predicate = typeof isInteractive === 'function'
      ? isInteractive
      : () => true;
    return (Array.isArray(providers) ? providers : []).filter(predicate);
  }

  function findProvider(providers, key) {
    const normalizedKey = String(key || '').trim().toLowerCase();
    if (!normalizedKey) {
      return null;
    }
    return providers.find((provider) => (
      String(provider && provider.key || '').trim().toLowerCase() === normalizedKey
    )) || null;
  }

  function resolveSelectionQuickActionProvider(
    visibleProviders,
    bundledProviders,
    requestedKey,
    isInteractive
  ) {
    const visible = getInteractiveProviders(visibleProviders, isInteractive);
    const bundled = getInteractiveProviders(bundledProviders, isInteractive);
    // Every fallback is key-based. The provider list order is the reader's
    // Search sources order, so an index-based fallback would silently change
    // which site a selection action opens once they reorder that page.
    const fallbackKey = 'gpt';
    return findProvider(visible, requestedKey) ||
      findProvider(bundled, requestedKey) ||
      findProvider(visible, fallbackKey) ||
      findProvider(bundled, fallbackKey) ||
      null;
  }

  return Object.freeze({
    resolveSelectionQuickActionProvider
  });
});
