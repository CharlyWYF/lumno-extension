const assert = require('assert');
const fs = require('fs');
const faviconUtils = require('../src/shared/favicon-utils.js');
const { readBackgroundSource } = require('./helpers/background-source');
const { extractFunction: extractFunctionFrom } = require('./helpers/extract-function');

const source = readBackgroundSource();

function extractFunction(name) {
  return extractFunctionFrom(source, name);
}

const fetchShortcutFaviconResourceSource = extractFunction('fetchShortcutFaviconResource');
const calls = [];
let internalTargetGets = 0;
const factory = new Function('deps', `
  const SHORTCUT_FAVICON_RESOURCE_MAX_BYTES = 256 * 1024;
  const SHORTCUT_FAVICON = { inspectIconResource() { return null; } };
  const arrayBufferToBase64 = () => '';
  const isAllowedFaviconProxyRequestUrl = deps.isAllowed;
  const getBackgroundFaviconUrlResolver = () => deps.resolver;
  const fetch = deps.fetch;
  ${fetchShortcutFaviconResourceSource}
  return fetchShortcutFaviconResource;
`);

const fetchResource = factory({
  resolver: faviconUtils.createFaviconUrlResolver(),
  isAllowed(url) {
    return /^https:\/\/t2\.gstatic\.cn\/faviconV2/i.test(String(url || ''));
  },
  fetch(url, options) {
    calls.push({ url, options });
    if (!options || options.redirect !== 'error') {
      internalTargetGets += 1;
      return Promise.resolve({ ok: true, url: 'http://127.0.0.1/internal' });
    }
    return Promise.reject(new TypeError('redirect blocked'));
  }
});

async function run() {
  const direct = await fetchResource({
    url: 'http://127.0.0.1/internal',
    source: 'explicit'
  }, 'https://public.example/', undefined);
  assert.strictEqual(direct, null);
  assert.strictEqual(calls.length, 0,
    'a user-controlled direct URL must be rejected before fetch');

  const redirected = await fetchResource({
    url: 'https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Fpublic.example%2F',
    source: 'proxy'
  }, 'https://public.example/', undefined);
  assert.strictEqual(redirected, null);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].options.redirect, 'error');
  assert.strictEqual(internalTargetGets, 0,
    'redirect handling must fail before a redirected private target GET');

  console.log('background favicon redirect isolation tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
