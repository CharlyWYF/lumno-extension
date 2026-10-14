const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const newtabJs = readNewtabRuntimeSource();
const newtabHtml = readPageSource('newtab.html');

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

assertContains(
  newtabJs,
  'function bindBookmarkPagerTooltip',
  'bookmark pager buttons should bind custom hover/focus tooltips'
);

assertContains(
  newtabJs,
  "bookmarkPagerPrevButton.setAttribute('data-tooltip', prevLabel);",
  'previous page button should expose its tooltip text'
);
assertContains(
  newtabJs,
  "bookmarkPagerNextButton.setAttribute('data-tooltip', nextLabel);",
  'next page button should expose its tooltip text'
);
assertContains(
  newtabJs,
  "bookmarkOpenManagerButton.setAttribute('data-tooltip', managerLabel);",
  'bookmark manager button should expose its tooltip text'
);

assertContains(
  newtabJs,
  'bookmarkPager.appendChild(bookmarkModeMenu.control);',
  'bookmark display mode should sit after the bookmark manager button'
);

assertContains(
  newtabJs,
  "bookmarkPagerPrevButton.removeAttribute('title');",
  'previous page button should avoid native title tooltip duplication'
);
assertContains(
  newtabJs,
  "bookmarkPagerNextButton.removeAttribute('title');",
  'next page button should avoid native title tooltip duplication'
);
assertContains(
  newtabJs,
  "bookmarkOpenManagerButton.removeAttribute('title');",
  'bookmark manager button should avoid native title tooltip duplication'
);

assert.ok(
  !/bookmarkPager(?:Prev|Next)Button\.disabled\s*=/.test(newtabJs),
  'pager buttons should remain hoverable instead of using the native disabled attribute'
);
assertContains(
  newtabJs,
  'setBookmarkPagerButtonAvailability(bookmarkPagerPrevButton, !atStart);',
  'previous page availability should be represented without native disabled'
);
assertContains(
  newtabJs,
  'setBookmarkPagerButtonAvailability(bookmarkPagerNextButton, !atEnd);',
  'next page availability should be represented without native disabled'
);

assertContains(
  newtabHtml,
  '.x-nt-bookmarks-pager-btn:hover:not([aria-disabled="true"])',
  'pager hover styling should ignore aria-disabled buttons'
);
assertContains(
  newtabHtml,
  '.x-nt-bookmarks-pager-btn[aria-disabled="true"]',
  'pager disabled styling should be driven by aria-disabled'
);

assert.ok(
  /\.x-nt-bookmarks-topbar\s+\.x-nt-section-mode-select\s+\._x_extension_select_trigger_2024_unique_\s+\._x_extension_select_icon_2024_unique_\s*\{[^}]*color:\s*inherit;/.test(newtabHtml),
  'the topbar more icon should inherit the same color as the bookmark manager button in every interaction state'
);

assert.ok(
  /body\[data-wallpaper-active="true"\]\s+\.x-nt-section-mode-select\s+\._x_extension_select_trigger_2024_unique_\s+\._x_extension_select_icon_2024_unique_\s*\{[^}]*color:\s*inherit;/.test(newtabHtml),
  'wallpaper mode-menu icons should retain the sampled foreground color on hover and while open'
);

assertContains(
  newtabJs,
  'recentModeMenu = NEWTAB_RECENT_MODE_SWITCH.createRecentModeSwitch({',
  'the recent heading should itself be the display mode switch'
);
assertContains(
  newtabJs,
  'recentHeading.hidden = true;',
  'the recent mode switch should replace the plain heading rather than repeat it'
);
assert.ok(
  /\.x-nt-recent-mode-switch\[data-expanded="false"\]\s+\.x-nt-recent-mode-switch-option\[aria-checked="false"\]\s*\{[^}]*width:\s*0;/.test(newtabHtml),
  'the collapsed recent mode switch should show only the current mode'
);
assert.ok(
  !/\.x-nt-recent-header-bar\s+\.x-nt-recent-mode-switch\s*\{[^}]*margin-left:\s*auto;/.test(newtabHtml),
  'the recent display mode switch should stay at the start of its header row, not float right'
);

console.log('newtab bookmark pager tooltip tests passed');
