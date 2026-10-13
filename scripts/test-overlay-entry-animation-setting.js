const assert = require('assert');
const fs = require('fs');
const { readPageSource } = require('./helpers/page-source');

const optionsHtml = readPageSource('src/options/options.html');
const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
const overlayRuntimeSource = fs.readFileSync('src/overlay/runtime.js', 'utf8');
const backgroundSource = fs.readFileSync('src/background/background.js', 'utf8');
const settings = require('../src/shared/settings.js');

const sizeRowIndex = optionsHtml.indexOf('data-i18n="settings_overlay_size_title"');
const animationRowIndex = optionsHtml.indexOf('data-i18n="settings_overlay_enter_animation_title"');
assert(sizeRowIndex >= 0, 'overlay size row should exist');
assert(
  animationRowIndex > sizeRowIndex,
  'overlay entry animation row should appear directly after the overlay size setting'
);
assert.match(
  optionsHtml,
  /data-overlay-enter-animation="elastic" data-active="true" aria-pressed="true"[\s\S]*?data-overlay-enter-animation="fade" data-active="false" aria-pressed="false"/,
  'spring should be the default selected option and fade should be available'
);
assert.match(
  optionsHtml,
  /_x_extension_overlay_enter_animation_tabs_wrap_2026_unique_"[^>]*role="group"/,
  'the animation selector should expose button-group semantics'
);

assert.match(
  optionsSource,
  /createOptionsSegmentedControlController\(\s*overlayEnterAnimationTabsWrap,\s*'overlay-enter-animation',\s*handleOverlayEnterAnimationSelection\s*\)/,
  'the animation choice should reuse the options segmented control'
);
assert.deepStrictEqual(
  [undefined, 'bogus', 'fade', 'elastic'].map(settings.normalizeOverlayEnterAnimation),
  ['elastic', 'elastic', 'fade', 'elastic'],
  'invalid and missing animation values should default to elastic'
);
assert.match(
  overlayRuntimeSource,
  /overlayEnterAnimation:\s*'_x_extension_overlay_enter_animation_2026_unique_'/,
  'the overlay runtime should expose the animation storage key'
);
assert.match(
  backgroundSource,
  /migrateStorageIfNeeded\(CHROME_SYNC_STORAGE_KEYS\);/,
  'the background migration should include the animation preference'
);
assert(
  settings.CHROME_SYNC_STORAGE_KEYS.includes('_x_extension_overlay_enter_animation_2026_unique_'),
  'the shared Chrome Sync contract should include the animation preference'
);

const expectedLabels = {
  en: ['Opening animation', 'Spring', 'Fade'],
  ja: ['表示時のアニメーション', 'スプリング', 'フェード'],
  zh_CN: ['进入动画', '弹性', '淡入'],
  zh_TW: ['進入動畫', '彈性', '淡入']
};
Object.entries(expectedLabels).forEach(([locale, labels]) => {
  const messages = JSON.parse(
    fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8')
  );
  assert.strictEqual(messages.settings_overlay_enter_animation_title.message, labels[0]);
  assert.strictEqual(messages.overlay_enter_animation_elastic.message, labels[1]);
  assert.strictEqual(messages.overlay_enter_animation_fade.message, labels[2]);
});

console.log('overlay entry animation setting tests passed');
