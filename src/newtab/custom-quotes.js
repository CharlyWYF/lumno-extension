(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LumnoCustomQuotes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const KEY = '_x_extension_custom_quotes_2026_unique_';
  const PICK_KEY = '_x_extension_custom_quote_pick_2026_unique_';
  const MAX_BYTES = 1024 * 1024;
  const MAX_QUOTES = 1000;
  const clean = value => String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim();
  function parseMarkdown(markdown) {
    const text = String(markdown || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('too-large');
    const quotes = []; let block = []; let fenced = false;
    const flush = () => {
      if (!block.length) return;
      const lines = block.splice(0); let author = '';
      if (lines.length > 1 && /^\s*[—–-]{1,2}\s*\S/.test(lines[lines.length - 1])) author = clean(lines.pop().replace(/^\s*[—–-]{1,2}\s*/, '')).slice(0, 120);
      const text = clean(lines.join(' '));
      if (text && !quotes.some(item => item.text === text && item.author === author)) {
        if (text.length > 500 || quotes.length >= MAX_QUOTES) throw new Error('limit');
        quotes.push({ text, author });
      }
    };
    text.split('\n').forEach(line => {
      if (/^\s*(```|~~~)/.test(line)) { flush(); fenced = !fenced; return; }
      if (fenced) return;
      if (!line.trim() || /^\s*(#{1,6}\s|[-*_]{3,}\s*$|<!--)/.test(line)) { flush(); return; }
      const list = /^\s*(?:[-+*]|\d+[.)])\s+/.test(line);
      if (list) flush();
      block.push(line.replace(/^\s*>\s?/, '').replace(/^\s*(?:[-+*]|\d+[.)])\s+/, ''));
    });
    flush();
    if (!quotes.length) throw new Error('empty');
    return quotes;
  }
  function normalizeLibrary(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.quotes) || !value.quotes.length || value.quotes.length > MAX_QUOTES) return null;
    const quotes = value.quotes.filter(item => item && typeof item.text === 'string' && item.text.trim() && item.text.length <= 500)
      .map(item => ({ text: item.text.trim(), author: String(item.author || '').slice(0, 120) }));
    return quotes.length ? { version: 1, filename: String(value.filename || '').slice(0, 128), revision: Number(value.revision) || 0, quotes } : null;
  }
  function select(library, date, pick, reroll) {
    const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    let hash = 0; for (const char of `${day}|${library.filename}|${library.revision}`) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
    const existing = pick && pick.day === day && pick.revision === library.revision && Number.isInteger(pick.index) && pick.index >= 0 && pick.index < library.quotes.length;
    let index = existing ? pick.index : hash % library.quotes.length;
    if (reroll) index = (index + 1) % library.quotes.length;
    return { quote: { ...library.quotes[index], source: library.filename, url: '' }, pick: { day, revision: library.revision, index } };
  }
  return Object.freeze({ KEY, PICK_KEY, MAX_BYTES, MAX_QUOTES, parseMarkdown, normalizeLibrary, select });
});
