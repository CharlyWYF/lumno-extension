const assert = require('assert');
const fs = require('fs');
const settings = require('../src/shared/settings.js');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const optionsHtml = readPageSource('src/options/options.html');
const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
const newtabHtml = readPageSource('newtab.html');
const newtabSource = readNewtabRuntimeSource();
const wordmarkSource = fs.readFileSync('react-src/newtab/wordmark.tsx', 'utf8');

function getFunctionSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert(start >= 0, `${name} should exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  assert.fail(`${name} should have a complete body`);
}

assert.strictEqual(
  settings.NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY,
  '_x_extension_newtab_time_seconds_visible_2026_unique_'
);
assert.strictEqual(
  settings.NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY,
  '_x_extension_newtab_time_font_weight_2026_unique_'
);
assert.strictEqual(settings.NEWTAB_TIME_FONT_WEIGHT_MIN, 300);
assert.strictEqual(settings.NEWTAB_TIME_FONT_WEIGHT_MAX, 800);
assert.strictEqual(settings.NEWTAB_TIME_FONT_WEIGHT_DEFAULT, 320);
assert.strictEqual(settings.normalizeNewtabTimeFontWeight(undefined), 320);
assert.strictEqual(settings.normalizeNewtabTimeFontWeight(299), 300);
assert.strictEqual(settings.normalizeNewtabTimeFontWeight(650), 650);
assert.strictEqual(settings.normalizeNewtabTimeFontWeight(801), 800);
assert.strictEqual(settings.normalizeNewtabTimeSecondsVisible(undefined), false);
assert.strictEqual(settings.normalizeNewtabTimeSecondsVisible(true), true);
assert(
  settings.CHROME_SYNC_STORAGE_KEYS.includes(
    settings.NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY
  ),
  'the time font-weight preference should sync through the shared settings contract'
);
assert(
  settings.CHROME_SYNC_STORAGE_KEYS.includes(
    settings.NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY
  ),
  'the seconds preference should sync through the shared settings contract'
);

const topContentRowIndex = optionsHtml.indexOf(
  '_x_extension_newtab_top_content_tabs_wrap_2026_unique_'
);
const fontWeightRowIndex = optionsHtml.indexOf(
  '_x_extension_newtab_time_font_weight_row_2026_unique_',
  topContentRowIndex
);
const secondsRowIndex = optionsHtml.indexOf(
  '_x_extension_newtab_time_seconds_row_2026_unique_',
  fontWeightRowIndex
);
const autofocusRowIndex = optionsHtml.indexOf(
  '_x_extension_newtab_input_auto_focus_toggle_2026_unique_',
  secondsRowIndex
);
assert(
  topContentRowIndex < fontWeightRowIndex &&
    fontWeightRowIndex < secondsRowIndex &&
    secondsRowIndex < autofocusRowIndex,
  'Options should place time font weight above seconds immediately after the top-content selector'
);
assert.match(
  optionsHtml,
  /id="_x_extension_newtab_time_font_weight_row_2026_unique_"[^>]*aria-hidden="true"[^>]*hidden/
);
assert.match(
  optionsHtml,
  /id="_x_extension_newtab_time_seconds_row_2026_unique_"[^>]*aria-hidden="true"[^>]*hidden/
);
assert.match(
  optionsHtml,
  /id="_x_extension_newtab_time_seconds_toggle_2026_unique_"[^>]*type="checkbox"/
);
const syncOptionsVisibility = getFunctionSource(
  optionsSource,
  'syncNewtabTimeSecondsVisibility'
);
assert.match(syncOptionsVisibility, /currentNewtabTopContentMode === 'time'/);
assert.match(
  syncOptionsVisibility,
  /\[newtabTimeFontWeightRow, newtabTimeSecondsRow\]/
);
assert.match(
  syncOptionsVisibility,
  /animateOptionsPanelHeight\([\s\S]*?setConditionalSettingsElementVisibility\(row, visible\)/
);
assert.match(
  getFunctionSource(optionsSource, 'setNewtabTopContentTabState'),
  /syncNewtabTimeSecondsVisibility\(\)/
);
assert.match(
  optionsSource,
  /createRangeSliderControlController[\s\S]*?kind: 'newtab-time-font-weight'/
);
assert.match(
  getFunctionSource(optionsSource, 'renderNewtabTimeFontWeightControl'),
  /min: NEWTAB_TIME_FONT_WEIGHT_MIN[\s\S]*?max: NEWTAB_TIME_FONT_WEIGHT_MAX[\s\S]*?step: 1[\s\S]*?value: currentNewtabTimeFontWeight/
);

// The appearance panel is a React view driven by the wallpaper runtime; its controls are
// tested by behavior in react-src/newtab/wallpaper-view.test.tsx and
// scripts/test-newtab-wallpaper-panel.js rather than by matching source text here.

assert.match(newtabSource, /fontWeight: newtabTimeFontWeight/);
assert.match(newtabSource, /showSeconds: newtabTimeSecondsVisible/);
assert.match(
  getFunctionSource(newtabSource, 'setNewtabTimeFontWeight'),
  /changed && newtabTopContentMode === 'time'[\s\S]*?renderNewtabTopContent\(false\)/
);
assert.match(
  newtabSource,
  /getTimeFontWeight: \(\) => newtabTimeFontWeight[\s\S]*?setTimeFontWeight: (?:\(\.\.\.args\) => )?setNewtabTimeFontWeight/
);
assert.match(
  getFunctionSource(newtabSource, 'setNewtabTimeSecondsVisible'),
  /changed && newtabTopContentMode === 'time'[\s\S]*?renderNewtabTopContent\(false\)/
);
assert.match(
  newtabSource,
  /getTimeSecondsVisible: \(\) => newtabTimeSecondsVisible[\s\S]*?setTimeSecondsVisible: (?:\(\.\.\.args\) => )?setNewtabTimeSecondsVisible/
);

assert.match(wordmarkSource, /fontWeight\?: number/);
assert.match(wordmarkSource, /const fontWeight = model\.fontWeight \?\? 320/);
assert.match(wordmarkSource, /CLOCK_LETTER_SPACING_WEIGHT_STEP = 100/);
assert.match(wordmarkSource, /CLOCK_LETTER_SPACING_STEP_EM = 0\.004/);
assert.match(wordmarkSource, /letterSpacing: getClockLetterSpacing\(fontWeight\)/);
assert.match(wordmarkSource, /showSeconds\?: boolean/);
assert.match(wordmarkSource, /const interval = showSeconds \? 1_000 : 60_000/);
assert.match(wordmarkSource, /data-show-seconds=\{showSeconds \? 'true' : 'false'\}/);
assert.match(wordmarkSource, /className="x-nt-time-seconds-value"/);
assert.match(wordmarkSource, /const secondsText = String\(time\.seconds\)\.padStart\(2, '0'\)/);
assert.match(wordmarkSource, /className="x-nt-time-seconds-digit"/);
assert.match(wordmarkSource, /data-place="tens"/);
assert.match(wordmarkSource, /data-place="ones"/);
assert.match(wordmarkSource, /key=\{`tens-\$\{secondsText\[0\]\}`\}/);
assert.match(wordmarkSource, /key=\{`ones-\$\{secondsText\[1\]\}`\}/);
assert.doesNotMatch(wordmarkSource, /value=\{time\.seconds\}/);
assert.match(
  newtabHtml,
  /_x_nt_time_seconds_soft_swap_2026_unique_ 120ms[\s\S]*?@keyframes _x_nt_time_seconds_soft_swap_2026_unique_[\s\S]*?opacity: 0\.68;[\s\S]*?transform: scale\(0\.985\);[\s\S]*?transform: scale\(1\);/
);
const secondsAnimationSource = newtabHtml.match(
  /\.x-nt-time-seconds-digit \{[\s\S]*?@keyframes _x_nt_time_seconds_soft_swap_2026_unique_[\s\S]*?\n\s{6}\}/
)?.[0] || '';
assert.doesNotMatch(secondsAnimationSource, /filter:|blur\(|will-change:/);
assert.doesNotMatch(
  newtabHtml.match(
    /@keyframes _x_nt_time_seconds_soft_swap_2026_unique_[\s\S]*?\n\s*\}/
  )?.[0] || '',
  /translate/
);
assert.match(wordmarkSource, /document\.visibilityState !== 'visible'[\s\S]*?return;/);
assert.match(wordmarkSource, /const localizedTimeFormatter = useMemo\(/);
assert.match(wordmarkSource, /const ClockHourMinuteDigits = memo\(/);
assert.match(wordmarkSource, /onAnimationEnd=\{\(event\) => event\.stopPropagation\(\)\}/);

const expectedLabels = {
  en: { fontWeight: 'Time font weight', seconds: 'Show seconds' },
  ja: { fontWeight: '時刻の文字の太さ', seconds: '秒を表示' },
  zh_CN: { fontWeight: '时间字重', seconds: '显示秒数' },
  zh_TW: { fontWeight: '時間字重', seconds: '顯示秒數' }
};
Object.entries(expectedLabels).forEach(([locale, expected]) => {
  const messages = JSON.parse(
    fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8')
  );
  assert.strictEqual(
    messages.newtab_time_font_weight_title.message,
    expected.fontWeight
  );
  assert.strictEqual(
    messages.newtab_time_show_seconds_title.message,
    expected.seconds
  );
});

console.log('newtab time font-weight and seconds setting tests passed');
