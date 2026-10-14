(function(root) {
  'use strict';

  // The Options theme: the system / light / dark picker, the resolved theme
  // on the page, and the localStorage copy theme-preload.js paints from on the
  // next load. While the mode is "system" the page follows the OS setting.
  const THEME_PREVIEWS = Object.freeze({
    system: '../../assets/images/system.svg',
    light: '../../assets/images/light.svg',
    dark: '../../assets/images/dark.svg'
  });
  const CLICK_EFFECT_MS = 260;

  function normalizeMode(mode) {
    return mode === 'dark' || mode === 'light' ? mode : 'system';
  }

  //   documentObj, windowObj, panel
  //   storageArea      provider storage area (may be null)
  //   settings         LumnoSettings
  //   picker           the theme picker's React controller
  //   getMessage(key, fallback)
  //   onModeShown(mode) runs whenever the picker shows a mode
  function createThemeSection(options) {
    const { documentObj, windowObj, panel, storageArea, settings, picker } = options;
    const getMessage = options.getMessage;
    const onModeShown = typeof options.onModeShown === 'function' ? options.onModeShown : () => {};
    const themeKey = settings.THEME_STORAGE_KEY;
    const mediaQuery = windowObj.matchMedia('(prefers-color-scheme: dark)');
    let currentMode = 'system';
    let followsSystem = false;

    function resolveTheme(mode) {
      if (mode === 'dark' || mode === 'light') {
        return mode;
      }
      return mediaQuery.matches ? 'dark' : 'light';
    }

    function applyResolvedTheme(resolvedTheme) {
      documentObj.body.setAttribute('data-theme', resolvedTheme);
      panel.setAttribute('data-theme', resolvedTheme);
      documentObj.documentElement.style.colorScheme = resolvedTheme;
      const themeColorMeta = documentObj.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', resolvedTheme === 'dark' ? '#111111' : '#f1f5f9');
      }
    }

    function render() {
      onModeShown(currentMode);
      picker.render({
        activeMode: currentMode,
        options: [
          {
            mode: 'system',
            labelKey: 'settings_theme_system',
            label: getMessage('settings_theme_system', '跟随系统'),
            previewSrc: THEME_PREVIEWS.system
          },
          {
            mode: 'light',
            labelKey: 'settings_theme_light',
            label: getMessage('settings_theme_light', '浅色'),
            previewSrc: THEME_PREVIEWS.light
          },
          {
            mode: 'dark',
            labelKey: 'settings_theme_dark',
            label: getMessage('settings_theme_dark', '深色'),
            previewSrc: THEME_PREVIEWS.dark
          }
        ]
      });
    }

    function onSystemThemeChange() {
      if (currentMode === 'system') {
        applyResolvedTheme(resolveTheme('system'));
      }
    }

    function followSystemTheme(follow) {
      if (follow === followsSystem) {
        return;
      }
      followsSystem = follow;
      if (follow) {
        mediaQuery.addEventListener('change', onSystemThemeChange);
      } else {
        mediaQuery.removeEventListener('change', onSystemThemeChange);
      }
    }

    function cacheMode(mode) {
      try {
        if (windowObj.localStorage) {
          windowObj.localStorage.setItem(settings.OPTIONS_THEME_PRELOAD_STORAGE_KEY, normalizeMode(mode));
        }
      } catch (e) {
        // The early theme preloader falls back to the system theme when caching is unavailable.
      }
    }

    // Shows a stored mode: picker, page theme and, for "system", OS changes.
    function show(mode) {
      currentMode = normalizeMode(mode);
      render();
      applyResolvedTheme(resolveTheme(currentMode));
      followSystemTheme(currentMode === 'system');
    }

    // theme-preload.js has already painted the cached (or system) theme and
    // marked the page ready before this runs, so there is nothing to fall
    // back to while the stored preference loads.
    function init() {
      return new Promise((resolve) => {
        if (!storageArea) {
          resolve('system');
          return;
        }
        storageArea.get([themeKey], (result) => {
          resolve((result && result[themeKey]) || 'system');
        });
      }).then((storedMode) => {
        cacheMode(storedMode);
        show(storedMode);
        documentObj.documentElement.setAttribute('data-theme-ready', 'true');
      });
    }

    function setMode(mode) {
      if (!storageArea) {
        return;
      }
      const updates = settings.createGlobalThemeModeStorageUpdate(mode);
      const nextMode = updates[themeKey];
      cacheMode(nextMode);
      storageArea.set(updates, () => show(nextMode));
    }

    function applyStorageChange(value) {
      show(value || 'system');
    }

    return Object.freeze({ applyStorageChange, init, render, setMode });
  }

  // The short press animation on a theme option.
  function playThemeOptionClickEffect(button, windowObj) {
    if (!button) {
      return;
    }
    button.classList.remove('x-theme-clicking');
    void button.offsetWidth;
    button.classList.add('x-theme-clicking');
    windowObj.setTimeout(() => {
      button.classList.remove('x-theme-clicking');
    }, CLICK_EFFECT_MS);
  }

  const api = Object.freeze({ createThemeSection, playThemeOptionClickEffect });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LumnoOptionsTheme = api;
})(globalThis);
