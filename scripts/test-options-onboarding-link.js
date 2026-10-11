const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');

const repoRoot = path.join(__dirname, '..');
const optionsHtml = readPageSource('src/options/options.html');
const optionsJs = fs.readFileSync(path.join(repoRoot, 'src/options/options.js'), 'utf8');
const onboardingHtml = readPageSource('src/onboarding/onboarding.html');

const buttonId = '_x_extension_open_onboarding_page_2026_unique_';
const buttonClass = '_x_extension_onboarding_guide_button_2026_unique_';
const labelKey = 'settings_onboarding_tutorial_action';
const versionButtonId = '_x_extension_settings_version_2024_unique_';
const versionButtonClass = '_x_extension_settings_version_badge_2024_unique_';
const versionTooltipKey = 'settings_version_tooltip';

function getRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = optionsHtml.match(new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `${selector} should exist in options CSS`);
  return match[1];
}

assert.match(
  optionsHtml,
  new RegExp(`<button[^>]+id="${buttonId}"[^>]+class="[^"]*${buttonClass}[^"]*"[^>]*>[\\s\\S]*?<span data-i18n="${labelKey}">新手引导<\\/span>[\\s\\S]*?<i class="ri-icon ri-size-14 ri-external-link-line"`),
  'general settings header should expose a compact onboarding tutorial ghost action with the onboarding ghost icon'
);

assert.match(
  onboardingHtml,
  /onboarding-action-button--ghost[\s\S]*?ri-external-link-line/,
  'onboarding should keep the reference ghost action icon used by the options tutorial link'
);

const rule = getRule(`._x_extension_shortcut_submit_2024_unique_.${buttonClass}`);
const darkRule = getRule(`body[data-theme="dark"] .${buttonClass}`);
[
  /margin-left:\s*auto;/,
  /--settings-button-min-height:\s*28px;/,
  /--settings-button-padding:\s*0 10px;/,
  /--settings-button-bg:\s*transparent;/,
  /--settings-button-shadow:\s*none;/,
  /white-space:\s*nowrap;/
].forEach((pattern) => {
  assert.match(rule, pattern, 'tutorial action should stay compact and ghost-styled');
});
assert.match(
  rule,
  /--settings-button-hover-bg:\s*rgba\(15,\s*23,\s*42,\s*0\.045\);/,
  'tutorial ghost action should only gain a background on hover'
);
assert.match(
  darkRule,
  /--settings-button-color:\s*var\(--panel-subtext\);/,
  'dark tutorial ghost action should use the dark-mode subtext token'
);
assert.match(
  darkRule,
  /--settings-button-bg:\s*transparent;/,
  'dark tutorial ghost action should stay backgroundless by default'
);
assert.match(
  darkRule,
  /--settings-button-shadow:\s*none;/,
  'dark tutorial ghost action should stay flat by default'
);
assert.doesNotMatch(
  darkRule,
  /rgba\(156,\s*163,\s*175,\s*0\.88\)|#f3f4f6|rgba\(255,\s*255,\s*255,/,
  'dark tutorial ghost action should not hard-code the old pale dark-mode colors'
);
assert.match(
  darkRule,
  /--settings-button-hover-bg:\s*color-mix\(in srgb,\s*var\(--control-hover-bg\)\s*72%,\s*transparent\);/,
  'dark tutorial ghost action should expose its quiet dark hover surface as a variant token'
);
assert.match(
  darkRule,
  /--settings-button-hover-color:\s*var\(--panel-text\);/,
  'dark tutorial ghost action should expose its hover text lift as a variant token'
);
assert.ok(
  !new RegExp(`(?:^|\\n)\\s*body\\[data-theme="dark"\\]\\s+\\.${buttonClass}:hover\\s*\\{`).test(optionsHtml),
  'dark tutorial ghost action should not need a separate hover selector'
);

assert.match(
  optionsJs,
  new RegExp(`const openOnboardingPageButton = document\\.getElementById\\('${buttonId}'\\);`),
  'options should cache the onboarding tutorial button'
);
assert.match(
  optionsJs,
  /openOnboardingPageButton\.addEventListener\('click'[\s\S]*?chrome\.runtime\.sendMessage\(\{\s*action:\s*'openOnboardingPage'\s*\}/,
  'clicking the tutorial action should ask the background page to open onboarding in a new tab'
);

assert.match(
  optionsHtml,
  new RegExp(`<button[^>]+id="${versionButtonId}"[^>]+class="[^"]*${versionButtonClass}[^"]*"[^>]+type="button"[^>]+data-tooltip="查看更新日志"[^>]+data-i18n-tooltip="${versionTooltipKey}"[^>]*><\\/button>`),
  'options version label should be a clickable button'
);
assert.match(
  getRule(`.${versionButtonClass}`),
  /cursor:\s*pointer;/,
  'options version button should advertise clickability'
);
assert.match(
  getRule(`.${versionButtonClass}:hover`),
  /background:\s*rgba\(255,\s*255,\s*255,\s*0\.56\);/,
  'options version button should show a visible light-mode background on hover'
);
assert.match(
  getRule(`body[data-theme="dark"] .${versionButtonClass}:hover`),
  /background:\s*rgba\(255,\s*255,\s*255,\s*0\.12\);/,
  'options version button should show a visible dark-mode background on hover'
);
assert.match(
  optionsJs,
  /function openSettingsVersionRelease\(event\)[\s\S]*?chrome\.runtime\.sendMessage\(\{\s*action:\s*'openReleasePage',\s*reason:\s*'options-version',\s*disposition:[\s\S]*?settingsVersion\.addEventListener\('click', openSettingsVersionRelease\)/,
  'clicking the version button should ask the background page to open the official release page'
);

['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(path.join(repoRoot, '_locales', locale, 'messages.json'), 'utf8'));
  assert.ok(messages[labelKey] && messages[labelKey].message, `${locale} should localize the onboarding tutorial label`);
  assert.ok(
    messages[versionTooltipKey] && messages[versionTooltipKey].message,
    `${locale} should localize the version changelog tooltip`
  );
});

console.log('options onboarding link tests passed');
