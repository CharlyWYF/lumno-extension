const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readBackgroundSource } = require('./helpers/background-source');

const repoRoot = path.resolve(__dirname, '..');
const backgroundJs = readBackgroundSource();

function getFunctionBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notStrictEqual(start, -1, `${startNeedle} should exist`);
  const end = source.indexOf(endNeedle, start);
  assert.notStrictEqual(end, -1, `${endNeedle} should exist after ${startNeedle}`);
  return source.slice(start, end);
}

assert.match(
  backgroundJs,
  /function getBackgroundFaviconUrlResolver\(\)[\s\S]*?FAVICON_UTILS\.createFaviconUrlResolver[\s\S]*?shouldBlockFaviconForHost/,
  'background search suggestions should use the shared favicon URL resolver'
);

assert.match(
  backgroundJs,
  /function isBrowserInternalPageUrl\(url\)[\s\S]*?resolver\.isBrowserInternalPageUrl\(url\)/,
  'background search suggestions should share browser-internal URL detection'
);

const suggestionFaviconBlock = getFunctionBlock(
  backgroundJs,
  'function buildSearchSuggestionFavicon(url)',
  'function createSearchSuggestion'
);

assert.match(
  suggestionFaviconBlock,
  /if \(isBrowserInternalPageUrl\(url\)\) \{\s*return getPageFaviconCandidateUrl\(url\);\s*\}/,
  'bookmark/history/top-site search results for browser pages should use browser-page favicon candidates'
);

assert.doesNotMatch(
  suggestionFaviconBlock,
  /isUrlBlockedByFaviconRequestBlacklist\(url\)[\s\S]*?return '';/,
  'favicon request exclusions should not hide safe virtual favicon candidates in search suggestions'
);

const browserPageBranch = suggestionFaviconBlock.indexOf('isBrowserInternalPageUrl(url)');
const genericUrlParsing = suggestionFaviconBlock.indexOf('new URL(url)');
assert.ok(
  browserPageBranch !== -1 && genericUrlParsing !== -1 && browserPageBranch < genericUrlParsing,
  'browser-page favicon handling should run before generic URL host parsing'
);

console.log('background search favicon tests passed');
