(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoPageColorScheme = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function parseCssColor(color) {
    if (!color || typeof color !== 'string') {
      return null;
    }
    const trimmed = color.trim().toLowerCase();
    if (!trimmed || trimmed === 'transparent') {
      return null;
    }
    if (trimmed.startsWith('#')) {
      const hex = trimmed.slice(1);
      if (hex.length === 3) {
        const channels = hex.split('').map((value) => parseInt(value + value, 16));
        return channels.every((value) => Number.isFinite(value)) ? channels : null;
      }
      if (hex.length === 6) {
        const channels = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)]
          .map((value) => parseInt(value, 16));
        return channels.every((value) => Number.isFinite(value)) ? channels : null;
      }
      return null;
    }
    const functionMatch = trimmed.match(/^rgba?\(([\s\S]+)\)$/);
    if (!functionMatch) {
      return null;
    }
    const parts = functionMatch[1]
      .replace(/\//g, ' ')
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length < 3) {
      return null;
    }
    const channels = parts.slice(0, 3).map((part) => {
      if (part.endsWith('%')) {
        return Math.round(Number(part.slice(0, -1)) * 2.55);
      }
      return Math.round(Number(part));
    });
    const alpha = parts.length >= 4 ? Number(parts[3]) : 1;
    if (!channels.every((value) => Number.isFinite(value)) ||
        !Number.isFinite(alpha) ||
        alpha <= 0) {
      return null;
    }
    return channels.map((value) => Math.max(0, Math.min(255, value)));
  }

  function getLuminance(rgb) {
    const [red, green, blue] = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  function themeFromColor(color) {
    const rgb = parseCssColor(color);
    if (!rgb || rgb.length !== 3) {
      return null;
    }
    return getLuminance(rgb) < 0.42 ? 'dark' : 'light';
  }

  // Guesses whether a web page is light or dark from its theme attributes,
  // classes, background, theme-color and color-scheme, so the surfaces Lumno
  // draws over the page (tab switcher, toasts) can match it. Returns null when
  // the page gives no signal.
  function detectPageTheme(documentRef, windowRef) {
    const doc = documentRef || globalThis.document;
    const win = windowRef || globalThis.window;
    if (!doc || !win) {
      return null;
    }
    const docEl = doc.documentElement;
    const body = doc.body;
    if (!docEl) {
      return null;
    }
    if (docEl.hasAttribute('dark') || (body && body.hasAttribute('dark'))) {
      return 'dark';
    }
    if (docEl.hasAttribute('light') || (body && body.hasAttribute('light'))) {
      return 'light';
    }
    const attrCandidates = [
      docEl.getAttribute('data-theme'),
      docEl.getAttribute('data-color-scheme'),
      docEl.getAttribute('data-color-mode'),
      docEl.getAttribute('data-mode'),
      docEl.getAttribute('data-appearance'),
      docEl.getAttribute('color-scheme'),
      docEl.getAttribute('theme'),
      docEl.getAttribute('data-bs-theme'),
      body ? body.getAttribute('data-theme') : null,
      body ? body.getAttribute('data-color-scheme') : null,
      body ? body.getAttribute('data-color-mode') : null,
      body ? body.getAttribute('data-mode') : null,
      body ? body.getAttribute('data-appearance') : null,
      body ? body.getAttribute('color-scheme') : null,
      body ? body.getAttribute('theme') : null,
      body ? body.getAttribute('data-bs-theme') : null
    ];
    for (let i = 0; i < attrCandidates.length; i += 1) {
      const value = String(attrCandidates[i] || '').toLowerCase();
      if (!value) {
        continue;
      }
      if (value.includes('dark') ||
          value.includes('night') ||
          value === '1' ||
          value === 'true' ||
          value === 'on') {
        return 'dark';
      }
      if (value.includes('light') ||
          value.includes('day') ||
          value === '0' ||
          value === 'false' ||
          value === 'off') {
        return 'light';
      }
    }
    const youtubeDarkRoot = doc.querySelector('ytd-app[dark], ytm-app[dark]');
    if (youtubeDarkRoot) {
      return 'dark';
    }
    const classTokens = [
      docEl.className || '',
      body ? body.className || '' : ''
    ];
    for (let i = 0; i < classTokens.length; i += 1) {
      const classText = String(classTokens[i] || '').toLowerCase();
      const tokenList = classText.split(/\s+/);
      if (tokenList.includes('dark')) {
        return 'dark';
      }
      if (tokenList.includes('light')) {
        return 'light';
      }
      if (/(^|[\s_-])(dark|darkmode|dark-theme|theme-dark|night)([\s_-]|$)/.test(classText)) {
        return 'dark';
      }
      if (/(^|[\s_-])(light|lightmode|light-theme|theme-light|day)([\s_-]|$)/.test(classText)) {
        return 'light';
      }
    }
    const bodyStyle = body ? win.getComputedStyle(body) : null;
    const docStyle = win.getComputedStyle(docEl);
    const bgColor = bodyStyle && themeFromColor(bodyStyle.backgroundColor)
      ? bodyStyle.backgroundColor
      : docStyle.backgroundColor;
    const backgroundTheme = themeFromColor(bgColor);
    if (backgroundTheme) {
      return backgroundTheme;
    }
    const themeColorMeta = doc.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      const themeColor = String(themeColorMeta.getAttribute('content') || '').trim();
      const theme = themeFromColor(themeColor);
      if (theme) {
        return theme;
      }
    }
    const colorSchemeMeta = doc.querySelector('meta[name="color-scheme"]');
    if (colorSchemeMeta) {
      const metaContent = String(colorSchemeMeta.getAttribute('content') || '').toLowerCase();
      if (metaContent.includes('dark') && !metaContent.includes('light')) {
        return 'dark';
      }
      if (metaContent.includes('light') && !metaContent.includes('dark')) {
        return 'light';
      }
    }
    const schemeValue = (win.getComputedStyle(docEl).colorScheme || '').toLowerCase();
    if (schemeValue.includes('dark') && !schemeValue.includes('light')) {
      return 'dark';
    }
    if (schemeValue.includes('light') && !schemeValue.includes('dark')) {
      return 'light';
    }
    return null;
  }

  return Object.freeze({
    detectPageTheme
  });
});
