const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const optionsJs = fs.readFileSync(path.join(repoRoot, 'src/options/options.js'), 'utf8');
const overlayJs = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
const newtabJs = readNewtabRuntimeSource();

function assertMatches(source, pattern, message) {
  assert.ok(pattern.test(source), message);
}

assertMatches(
  optionsJs,
  /optionsThemePickerApi\.createThemePickerController\(themePicker,[\s\S]*?setThemeMode\(mode\)/,
  'options should route React theme selections back through the existing storage adapter'
);

assertMatches(
  overlayJs,
  /function getThemeStorageUpdate\(mode\) \{[\s\S]*?SETTINGS\.createGlobalThemeModeStorageUpdate/,
  'overlay should build /mode global writes through the shared helper'
);
assertMatches(
  overlayJs,
  /function applyThemeModeChange\(mode\) \{[\s\S]*?const updates = getThemeStorageUpdate\(mode\);[\s\S]*?storageArea\.set\(updates\);[\s\S]*?applyOverlayTheme\(updates\[THEME_STORAGE_KEY\]\);/,
  'overlay /mode should write and apply the global theme without clearing New Tab override'
);

assertMatches(
  newtabJs,
  /function getGlobalThemeStorageUpdate\(mode\) \{[\s\S]*?SETTINGS\.createGlobalThemeModeStorageUpdate/,
  'newtab should build global appearance writes through the shared helper'
);

console.log('theme sync source tests passed');
