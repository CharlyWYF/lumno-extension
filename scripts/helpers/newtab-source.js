const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
// Page runtime modules split out of newtab.js, in the order newtab.html loads them.
const NEWTAB_RUNTIME_MODULES = [
  'src/newtab/site-theme-resolver.js',
  'src/newtab/url-policy.js',
  'src/newtab/recent-sites-controller.js',
  'src/newtab/site-search-providers.js',
  'src/newtab/bookmark-display-settings.js',
  'src/newtab/feedback-control.js',
  'src/newtab/shortcut-dock.js',
  'src/newtab/shortcut-context-menu.js',
  'src/newtab/bookmark-context-menu.js',
  'src/newtab/bookmark-pager.js',
  'src/newtab/search-autocomplete.js',
  'src/newtab/tooltip-bindings.js',
  'src/newtab/page-navigation.js',
  'src/newtab/shortcuts-controller.js',
  'src/newtab/shortcut-drag.js',
  'src/newtab/bookmark-drag-controller.js',
  'src/newtab/recent-card-drag.js',
  'src/newtab/section-loaders.js',
  'src/newtab/card-themes.js',
  'src/newtab/search-modes.js',
  'src/newtab/search-navigation.js',
  'src/newtab/suggestions-controller.js',
  'src/newtab/top-content.js',
  'src/newtab/mode-commands.js',
  'src/newtab/page-preferences.js',
  'src/newtab/appearance-modes.js',
  'src/newtab/section-headers.js',
  'src/newtab/recent-mode-switch.js',
  'src/newtab/input-focus.js',
  'src/newtab/entry-motion.js'
];

// Returns newtab.js followed by the modules split out of it, so source checks
// can locate a function regardless of which file now holds it. newtab.js and
// the split modules share page state as properties of one `pageState`
// object. The prefix and the factory's extra indentation are dropped so
// checks and extracted functions see the same code they would in a single
// closure, with page state as plain variables.
function readNewtabRuntimeSource() {
  const modules = NEWTAB_RUNTIME_MODULES.map((file) => fs.readFileSync(path.join(repoRoot, file), 'utf8')
    .replace(/^  /gm, ''));
  return [fs.readFileSync(path.join(repoRoot, 'src/newtab/newtab.js'), 'utf8'), ...modules]
    .join('\n')
    .replace(/\bpageState\./g, '');
}

module.exports = { NEWTAB_RUNTIME_MODULES, readNewtabRuntimeSource };
