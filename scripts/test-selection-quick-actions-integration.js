const assert = require('assert');
const fs = require('fs');
const { readPageSource } = require('./helpers/page-source');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const optionsHtml = readPageSource('src/options/options.html');
const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
const settings = require('../src/shared/settings.js');
const optionsToggleKeys = require('../src/options/options-toggle-settings.js')
  .getToggleSettings(settings)
  .map((entry) => entry.key);
const backgroundSource = fs.readFileSync('src/background/background.js', 'utf8');
const selectionTargetSource = fs.readFileSync('src/background/selection-target.js', 'utf8');
const providerResolverSource = fs.readFileSync('src/background/selection-quick-action-provider.js', 'utf8');
const contentSource = fs.readFileSync('src/content/selection-quick-actions.js', 'utf8');
const selectionMarkSource = fs.readFileSync('assets/images/lumno-selection-mark.svg', 'utf8');
const intentSource = fs.readFileSync('src/shared/selection-intent.js', 'utf8');
const iconSource = fs.readFileSync('src/shared/selection-action-icons.js', 'utf8');
const toastSource = fs.readFileSync('src/shared/toast.js', 'utf8');
const settingsSource = fs.readFileSync('src/shared/settings.js', 'utf8');
const selectStyles = fs.readFileSync('src/shared/custom-select.css', 'utf8');
const localeNames = ['en', 'ja', 'zh_CN', 'zh_TW'];
const storageKey = '_x_extension_selection_quick_actions_enabled_2026_unique_';
const providerStorageKey = '_x_extension_selection_quick_actions_provider_2026_unique_';
const groupEnabledStorageKey = '_x_extension_selection_quick_actions_group_enabled_2026_unique_';
const iconSetStorageKey = '_x_extension_selection_quick_actions_icon_set_2026_unique_';
const triggerStyleStorageKey = '_x_extension_selection_quick_actions_trigger_style_2026_unique_';

const selectionScriptRegistration = require('../src/background/selection-script-registration.js');
assert(
  !manifest.content_scripts.some((entry) => (
    Array.isArray(entry.js) && entry.js.includes('src/content/selection-quick-actions.js')
  )),
  'the default-off selection toolbar should not load into every page from the manifest'
);
assert.deepStrictEqual(
  Array.from(selectionScriptRegistration.SCRIPT_FILES),
  ['src/shared/settings.js', 'src/shared/selection-action-icons.js', 'src/shared/selection-intent.js', 'src/shared/toast.js', 'src/content/selection-quick-actions.js'],
  'provider-aware settings, the selection classifier, and the shared Toast should load before the content interaction runtime'
);
assert.strictEqual(
  fs.existsSync('src/shared/selection-butterfly.js'),
  false,
  'the removed butterfly option should not leave a bundled runtime behind'
);
assert.strictEqual(selectionScriptRegistration.RUN_AT, 'document_idle');
assert(
  backgroundSource.includes("chrome.runtime.getURL('src/background/selection-script-registration.js')"),
  'the background should load the selection script registration'
);

const optionsToggleTag = optionsHtml.match(
  /<input\b[^>]*id="_x_extension_selection_quick_actions_toggle_2026_unique_"[^>]*>/
);
assert(optionsToggleTag, 'Labs should render the selection quick actions toggle');
assert.doesNotMatch(
  optionsToggleTag[0],
  /\bchecked\b/,
  'Labs should show the selection quick actions toggle as disabled by default'
);
assert(optionsToggleKeys.includes(storageKey), 'options should persist the selection setting');
assert(optionsToggleKeys.includes(providerStorageKey), 'options should persist the preferred selection provider');
assert(optionsToggleKeys.includes(groupEnabledStorageKey), 'options should persist the optional selection group setting');
assert(!optionsSource.includes(iconSetStorageKey), 'options should not persist a fixed toolbar icon library');
assert(!optionsSource.includes(triggerStyleStorageKey), 'options should not persist a removed trigger-style choice');
assert(
  optionsHtml.includes('_x_extension_selection_quick_actions_provider_select_2026_unique_'),
  'Labs should render the preferred provider dropdown'
);
const groupToggleTag = optionsHtml.match(
  /<input\b[^>]*id="_x_extension_selection_quick_actions_group_toggle_2026_unique_"[^>]*>/
);
assert(groupToggleTag, 'Labs should render the optional selection group toggle');
assert.doesNotMatch(groupToggleTag[0], /\bchecked\b/, 'selection grouping should be off by default');
assert(
  /data-i18n="settings_selection_quick_actions_group_title">在后台查询</.test(optionsHtml) &&
    /data-i18n-tooltip="settings_selection_quick_actions_group_desc" data-tooltip="所有 AI 网页皆归入「AI 查询」标签组"/.test(optionsHtml),
  'the group-enabled behavior should be described as a background query rather than tab creation'
);
assert(!optionsHtml.includes('selection_quick_actions_icon_set'),
  'Labs should not show an icon-library setting when the toolbar always uses Remix');
assert(!optionsHtml.includes('selection_quick_actions_trigger_style'),
  'Labs should not ask users to choose between selection-entry visuals');
assert(
  /_x_extension_theme_indicator_2024_unique_\[data-ready="false"\][\s\S]*?_x_extension_theme_option_2024_unique_\[data-active="true"\][\s\S]*?background:\s*var\(--inline-tab-active-bg\)/.test(optionsHtml),
  'segmented controls should preserve an active background before their indicator can be measured'
);
assert.strictEqual(
  (optionsHtml.match(/data-icon-path="assets\/images\/site-search\/tile-[^"]+"/g) || []).length >= 8,
  true,
  'the provider dropdown should pair each provider with a bundled icon'
);
assert(
  settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY),
  'selection setting should participate in sync/export/import'
);
assert(
  settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY),
  'selection provider should participate in sync/export/import'
);
assert(
  settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY),
  'selection grouping should participate in sync/export/import'
);
assert(!settingsSource.includes(iconSetStorageKey),
  'browser sync should not retain the removed toolbar icon-library field');
assert(!settingsSource.includes(triggerStyleStorageKey),
  'browser sync should not retain the removed trigger-style field');
assert(
  backgroundSource.includes("src/background/selection-quick-action-provider.js") &&
    backgroundSource.includes('loadSelectionQuickActionFallbackProviders()') &&
    providerResolverSource.includes('resolveSelectionQuickActionProvider'),
  'selection actions should resolve their preferred provider independently of general search-source visibility'
);
assert(
  /Promise\.all\(\[[\s\S]*loadSelectionQuickActionsGroupEnabled\(\)[\s\S]*\]\)/.test(backgroundSource) &&
    backgroundSource.includes('loadSelectionQuickActionGroupTitle(request.locale)') &&
    /SELECTION_TARGET\.openSelectionTarget\([\s\S]*groupEnabled[\s\S]*groupTitle:\s*groupTitle\s*\|\|\s*SELECTION_TARGET\.DEFAULT_GROUP_TITLE[\s\S]*groupColor:\s*'blue'/.test(backgroundSource),
  'selection targets should localize the optional AI group name when the setting is enabled'
);
assert(
  selectionTargetSource.includes("const DEFAULT_GROUP_TITLE = 'AI Search';") &&
    !selectionTargetSource.includes('\\u67E5\\u8BE2'),
  'the reusable selection-target helper should not fall back to a Chinese-only group name'
);
assert(
  /async function openAndSubmitSelectionPrompt\([\s\S]*?targetInfo\.mode === 'reused'[\s\S]*?reuseExisting:\s*false[\s\S]*?submitSelectionPromptInTab/.test(backgroundSource) &&
    /runSelectionQuickAction\([\s\S]*?return openAndSubmitSelectionPrompt\(/.test(backgroundSource),
  'a failed attempt to submit into a reusable AI page should fall back to one fresh grouped tab'
);
assert(
  /active:\s*true/.test(selectionTargetSource),
  'default selection target tabs should activate immediately'
);

assert(contentSource.includes('selectionChangeTimer'));
assert(contentSource.includes('function handlePointerCancel'));
assert(contentSource.includes("event.key === 'Escape'"));
assert(contentSource.includes("sourceKind: 'text-control'"),
  'ordinary text controls should produce immutable selection snapshots');
assert(contentSource.includes('element.selectionStart'));
assert(contentSource.includes('element.selectionEnd'));
assert(contentSource.includes('function getUnifiedSelectionSnapshot'));
assert(contentSource.includes('function buildCandidateFromSnapshot(snapshot, classification)'));
assert(
  contentSource.includes('const TOAST = globalThis.LumnoToast;') &&
    contentSource.includes('TOAST.createToastController') &&
    contentSource.includes("toastElement.className = 'x-lumno-toast'") &&
    toastSource.includes('function createToastController') &&
    !contentSource.includes('lumno-selection-status'),
  'selection action progress and failures should use the shared Toast component instead of an in-toolbar status block'
);
assert(!/suppressed[\s\S]*settings\.editable\s*===\s*true/.test(intentSource),
  'editable context alone should not suppress a meaningful selection');
assert(contentSource.includes('input[type="password"]'));
assert(contentSource.includes('[autocomplete^="cc-"]'));
assert(
  contentSource.includes("assets/images/lumno-selection-mark.svg") &&
    selectionMarkSource.includes('shape-rendering="geometricPrecision"') &&
    (selectionMarkSource.match(/<path\b/g) || []).length === 2,
  'the selection affordance should use the precise two-layer vector Lumno mark'
);
assert(
  contentSource.includes("const RUNTIME_REVISION = 'selection-toolbar-v32'") &&
    contentSource.includes('const RUNTIME_VERSION = 32'),
  'the selection runtime should expose the general prose-intent revision for live diagnostics'
);
assert(
  /\.lumno-selection-surface\[data-icon-only="true"\][\s\S]*?border:\s*0[;\s\S]*?box-shadow:\s*none/.test(contentSource),
  'the default floating selection affordance should not have a border or shadow'
);
assert(
  /\.lumno-selection-surface\[data-icon-only="true"\][\s\S]*?\.lumno-selection-main:hover[\s\S]*?background:/.test(contentSource),
  'the default floating selection affordance should reveal its background on hover'
);
assert(
  contentSource.includes("positionSurface(candidate.rect, 'inline')"),
  'every triggerable selection should anchor the same compact entry inline with the selected text'
);
assert(
  /function applyNoTranslate\(element\)[\s\S]*?setAttribute\('translate', 'no'\)[\s\S]*?setAttribute\('lang', 'zxx'\)[\s\S]*?setAttribute\('notranslate', ''\)[\s\S]*?setAttribute\('data-no-translate', 'true'\)[\s\S]*?classList\.add\('notranslate'\)/.test(contentSource) &&
    contentSource.includes('applyNoTranslate(host)') &&
    contentSource.includes('applyNoTranslateDeep(surface)') &&
    contentSource.includes('applyNoTranslateDeep(menu)'),
  'the selection host and dynamic toolbar descendants should reuse Overlay no-translate markers'
);
assert(
  contentSource.includes("positionSurface(currentCandidate.rect, 'panel', originRect)") &&
    /function positionSurface\(rect, placement, anchorRect\)[\s\S]*?preferredLeft\s*=\s*anchorRect\.left[\s\S]*?setHostPosition/.test(contentSource) &&
    !contentSource.includes('destinationButtonCenterX'),
  'the expanded toolbar should start at the compact entry point and grow into the space on its right'
);
assert(
  contentSource.includes('const VIEWPORT_SAFE_MARGIN_PX = 12') &&
    contentSource.includes("host.style.setProperty(property, value, 'important')") &&
    contentSource.includes('surfaceResizeObserver.observe(surface)') &&
    contentSource.includes('applySurfaceViewportLimit(viewport)'),
  'the closed selection surface should resist hostile page CSS and remain inside a 12px visual-viewport safe area'
);
assert(
  contentSource.includes('const inlineRect = clientRects.length > 0') &&
    /inline:\s*\{[\s\S]*?right:\s*inlineRect\.right/.test(contentSource) &&
    contentSource.includes('const gap = 2') &&
    contentSource.includes('const topOffset = Math.max(4, Math.min(7, bounds.height * 0.4))'),
  'selection positioning should use the final selected client rect'
);
assert(
  /\.lumno-selection-main\[data-icon-only="true"\][\s\S]*?width:\s*18px[\s\S]*?min-height:\s*18px/.test(contentSource) &&
    /\.lumno-selection-main\[data-icon-only="true"\] \.lumno-selection-logo[\s\S]*?width:\s*12px[\s\S]*?height:\s*12px/.test(contentSource),
  'the low-distraction selection affordance should use the compact half-size entry mark'
);
assert(
  /\.lumno-selection-main\[data-icon-only="true"\]::before[\s\S]*?inset:\s*-5px/.test(contentSource),
  'the compact visual should keep a forgiving invisible pointer target'
);
assert(
  /\.lumno-selection-surface\[data-icon-only="false"\]\s*\{[\s\S]*?padding-inline-end:\s*1px/.test(contentSource) &&
    !/\.lumno-selection-main\[data-icon-only="false"\] \.lumno-selection-logo\s*\{/.test(contentSource),
  'the expanded toolbar should shorten only the trailing shell inset while keeping the butterfly centered in its hit area'
);
assert(
  /\.lumno-selection-main\[data-icon-only="true"\]\s*\{[\s\S]*?background:\s*rgba\(250,\s*250,\s*250,\s*0\.76\)[\s\S]*?backdrop-filter:\s*blur\(10px\)/.test(contentSource),
  'the floating selection mark should use a stable high-contrast acrylic backing'
);
assert(!contentSource.includes('mix-blend-mode: difference'),
  'the floating selection mark should not blur into page text through difference blending');
assert(
  /\.lumno-selection-surface\[data-icon-only="true"\] \.lumno-selection-main:hover[\s\S]*?backdrop-filter:\s*blur\(10px\)/.test(contentSource),
  'the hover state should use a translucent acrylic treatment'
);
assert(
  !contentSource.includes('filter: blur(8px)') &&
    /\.lumno-selection-main\[data-icon-only="true"\][\s\S]*?opacity:\s*0[\s\S]*?transform:\s*translateY\(2px\) scale\(0\.9\)/.test(contentSource) &&
    /:host\(\[data-visible="true"\]\) \.lumno-selection-main\[data-icon-only="true"\][\s\S]*?opacity:\s*1[\s\S]*?transform:\s*translateY\(0\) scale\(1\)/.test(contentSource),
  'the floating selection mark should use a clean low-cost rise instead of a blur-to-sharp loading effect'
);
assert(contentSource.includes('let enabled = false;'), 'content runtime should start disabled');
assert(contentSource.includes('lumno-selection-action-icon'), 'content runtime should render inline action SVGs');
assert(!contentSource.includes('ICON_SET_STORAGE_KEY'), 'content runtime should not read an obsolete icon-set choice');
assert(
  contentSource.includes("const TOOLBAR_FALLBACK_ACTIONS = Object.freeze(['explain', 'search', 'translate'])") &&
    /function getToolbarActions\(primary\)[\s\S]*?\.slice\(0, 3\)/.test(contentSource),
  'the inferred task should lead a three-item toolbar without exposing generic Ask AI as a fallback'
);
assert(
  contentSource.includes("menu.setAttribute('role', 'toolbar')") &&
    !contentSource.includes('lumno-selection-more'),
  'the butterfly should open the toolbar directly without a second disclosure control'
);
assert(
  contentSource.includes("primaryDivider.className = 'lumno-selection-primary-divider'") &&
    contentSource.includes("material.className = 'lumno-selection-material'") &&
    contentSource.includes("contentViewport.className = 'lumno-selection-content'") &&
    contentSource.includes("actionsViewport.className = 'lumno-selection-actions-viewport'") &&
    contentSource.includes('actionsViewport.append(menu)') &&
    contentSource.includes('contentViewport.append(actionsViewport, primaryDivider, mainButton)') &&
    contentSource.includes('surface.append(material, contentViewport)'),
  'all toolbar controls should share one right-aligned clipping layer with the butterfly last'
);
assert(!contentSource.toLowerCase().includes('butterfly'),
  'content runtime should render only the fixed Lumno selection mark');
assert(iconSource.includes('remix: Object.freeze') && !iconSource.toLowerCase().includes('hugeicons'),
  'the bundled action icon library should contain Remix only');
assert(
  /ask:\s*icon\('<path fill="currentColor" d="M1 11C6\.52285/.test(iconSource),
  'Ask AI should use the simpler single-sparkle Remix icon'
);
assert(
  /\.lumno-selection-surface\s*\{[\s\S]*?--lumno-selection-surface-radius:\s*13px[\s\S]*?height:\s*38px[\s\S]*?padding:\s*3px[\s\S]*?border-radius:\s*var\(--lumno-selection-surface-radius\)/.test(contentSource) &&
    /\.lumno-selection-material\s*\{[\s\S]*?background:\s*light-dark\(rgba\(244, 245, 247, 0\.94\), rgba\(26, 27, 31, 0\.92\)\)/.test(contentSource),
  'the expanded toolbar should use the approved compact surface geometry'
);
assert(
  /\.lumno-selection-material\s*\{[\s\S]*?border:\s*1px solid light-dark\(rgba\(15, 23, 42, 0\.12\), rgba\(255, 255, 255, 0\.13\)\)/.test(contentSource) &&
    /\.lumno-selection-surface\s*\{[\s\S]*?color:\s*light-dark\(#18181b, #e7e8eb\)/.test(contentSource),
  'the expanded toolbar should tune border and text contrast for each theme'
);
assert(
  /\.lumno-selection-material\s*\{[\s\S]*?inset 0 0 0 1px light-dark\(rgba\(255, 255, 255, 0\.3\), transparent\)/.test(contentSource),
  'the expanded toolbar should omit its inner highlight in dark mode'
);
assert(
  /\.lumno-selection-material::before\s*\{[\s\S]*?border-radius:\s*calc\(var\(--lumno-selection-surface-radius\) - 1px\)/.test(contentSource),
  'the inner material curve should stay one pixel inside the outer border curve'
);
assert(
  /@supports\s*\(corner-shape:\s*superellipse\(1\.25\)\)\s*\{[\s\S]*?\.lumno-selection-material,[\s\S]*?\.lumno-selection-material::before\s*\{[\s\S]*?corner-shape:\s*superellipse\(1\.25\)/.test(contentSource),
  'the inner material and border should use the same continuous corner shape when supported'
);
assert(
  /\.lumno-selection-material::before\s*\{[\s\S]*?radial-gradient\([\s\S]*?transparent 72%[\s\S]*?radial-gradient\([\s\S]*?transparent 78%/.test(contentSource),
  'the expanded toolbar should use broad static gradient diffusion for its inner glow'
);
assert(
  /\.lumno-selection-material\s*\{[\s\S]*?-webkit-backdrop-filter:\s*blur\(14px\) saturate\(130%\)[\s\S]*?backdrop-filter:\s*blur\(14px\) saturate\(130%\)/.test(contentSource),
  'the expanded toolbar should use a translucent acrylic backdrop treatment'
);
assert(
  /\.lumno-selection-surface\s*\{[\s\S]*?justify-content:\s*flex-start/.test(contentSource) &&
    /\.lumno-selection-content\s*\{[\s\S]*?justify-content:\s*flex-end[\s\S]*?overflow:\s*hidden/.test(contentSource) &&
    /\.lumno-selection-toolbar\s*\{[\s\S]*?justify-content:\s*flex-end[\s\S]*?transform-origin:\s*left center[\s\S]*?gap:\s*0/.test(contentSource) &&
    /button\s*\{[\s\S]*?padding:\s*0 8px[\s\S]*?min-height:\s*30px[\s\S]*?border-radius:\s*9px[\s\S]*?gap:\s*5px[\s\S]*?font:\s*400 12px/.test(contentSource) &&
    /\.lumno-selection-primary-divider\s*\{[\s\S]*?margin-inline:\s*3px[\s\S]*?height:\s*18px/.test(contentSource) &&
    /\.lumno-selection-actions-viewport\s*\{[\s\S]*?overflow:\s*hidden/.test(contentSource) &&
    !/\.lumno-selection-toolbar::before/.test(contentSource) &&
    /\.lumno-selection-toolbar button \+ button\s*\{[\s\S]*?margin-inline-start:\s*7px/.test(contentSource) &&
    /\.lumno-selection-toolbar button \+ button::before[\s\S]*?inset-inline-start:\s*-4px[\s\S]*?height:\s*18px/.test(contentSource) &&
    /\.lumno-selection-action-icon\s*\{[\s\S]*?width:\s*16px[\s\S]*?height:\s*16px/.test(contentSource),
  'the shared right-aligned content layer should retain the same compact 3px rhythm'
);
assert(
  /@supports \(corner-shape:\s*superellipse\(1\.25\)\)[\s\S]*?corner-shape:\s*superellipse\(1\.25\)/.test(contentSource),
  'the toolbar should use the same supported smooth-corner primitive as Overlay'
);
assert(
  /button\s*\{[\s\S]*?border-radius:\s*9px[\s\S]*?corner-shape:\s*superellipse\(1\.25\)/.test(contentSource) &&
    /button:hover, button:focus-visible\s*\{[\s\S]*?background:/.test(contentSource),
  'toolbar action and butterfly hover backgrounds should draw directly with continuous corners'
);
assert(
  contentSource.includes('menu.tabIndex = -1') &&
    /function renderMenu\(\)[\s\S]*?menu\.focus\(\{ preventScroll: true \}\)/.test(contentSource) &&
    !contentSource.includes('actionButtons[0].focus({ preventScroll: true })') &&
    /\.lumno-selection-toolbar:focus\s*\{[\s\S]*?outline:\s*none/.test(contentSource),
  'opening the toolbar should focus its neutral container instead of pre-highlighting the first action'
);
assert(
    contentSource.includes('function animateToolbarEntrance(originRect)') &&
    contentSource.includes("window.matchMedia('(prefers-reduced-motion: reduce)').matches") &&
    /material\.animate\(\[[\s\S]*?width:\s*'0px'[\s\S]*?width:\s*`\$\{destinationRect\.width\}px`[\s\S]*?duration:\s*240,[\s\S]*?easing:\s*'cubic-bezier\(0\.22, 1, 0\.36, 1\)'/.test(contentSource) &&
    /contentViewport\.animate\(\[[\s\S]*?width:\s*'0px'[\s\S]*?width:\s*`\$\{geometry\.contentWidth\}px`[\s\S]*?duration:\s*260,[\s\S]*?delay:\s*20/.test(contentSource) &&
    !contentSource.includes('actionsViewport.animate([') &&
    !contentSource.includes('surface.animate([') &&
    !contentSource.includes('mainButton.animate([') &&
    /menu\.animate\(\[[\s\S]*?translateX\(-\$\{geometry\.contentOffset\}px\)[\s\S]*?translateX\(0px\)[\s\S]*?duration:\s*280,[\s\S]*?delay:\s*30/.test(contentSource) &&
    !contentSource.includes('label.animate(['),
  'the material and one right-aligned content viewport should grow together from left to right'
);
assert(
  /function handleWindowBlur\(event\)\s*\{[\s\S]*?event\.target !== window[\s\S]*?cancelSelectionGesture\(\)/.test(contentSource),
  'toolbar descendant blur events should not be treated as browser window blur before an action request is sent'
);
assert(
    contentSource.includes('function runToolbarEntranceFallback') &&
    contentSource.includes("surface.style.setProperty('--lumno-toolbar-expanded-width'") &&
    contentSource.includes("surface.style.setProperty('--lumno-toolbar-content-width'") &&
    contentSource.includes("surface.style.setProperty('--lumno-toolbar-content-offset'") &&
    contentSource.includes("surface.dataset.toolbarEntranceState = 'from'") &&
    contentSource.includes("surface.dataset.toolbarEntranceState = 'to'") &&
    /data-toolbar-entrance-state="from"\] \.lumno-selection-material\s*\{[\s\S]*?width:\s*0/.test(contentSource) &&
    /data-toolbar-entrance-state="to"\] \.lumno-selection-material\s*\{[\s\S]*?width:\s*var\(--lumno-toolbar-expanded-width\)/.test(contentSource) &&
    /data-toolbar-entrance-state="from"\] \.lumno-selection-content\s*\{[\s\S]*?width:\s*0/.test(contentSource) &&
    /data-toolbar-entrance-state="to"\] \.lumno-selection-content\s*\{[\s\S]*?width:\s*var\(--lumno-toolbar-content-width\)/.test(contentSource),
  'the fallback should grow material and the shared right-aligned content width together'
);
assert(
  /\.lumno-selection-surface\s*\{[\s\S]*?overflow:\s*visible[\s\S]*?contain:\s*layout style/.test(contentSource) &&
    /\.lumno-selection-material\s*\{[\s\S]*?overflow:\s*hidden[\s\S]*?box-shadow:/.test(contentSource) &&
    !/\.lumno-selection-surface\s*\{[\s\S]*?contain:\s*layout paint style/.test(contentSource),
  'the independent material should preserve its rounded glow and shadow outside the unclipped layout shell'
);
assert(
  /\.lumno-selection-main\[data-icon-only="false"\],[\s\S]*?\.lumno-selection-primary-divider,[\s\S]*?\.lumno-selection-toolbar\s*\{[\s\S]*?flex:\s*0 0 auto/.test(contentSource) &&
    /\.lumno-selection-content\s*\{[\s\S]*?flex:\s*0 1 auto[\s\S]*?min-width:\s*0[\s\S]*?justify-content:\s*flex-end/.test(contentSource) &&
    /\.lumno-selection-actions-viewport\s*\{[\s\S]*?flex:\s*0 1 auto[\s\S]*?min-width:\s*0[\s\S]*?justify-content:\s*flex-end/.test(contentSource),
  'all toolbar contents should align to the moving right edge while actions can shrink safely'
);
assert(
  /function openLabsSettings\(\)[\s\S]*?action:\s*'openOptionsPage'[\s\S]*?hash:\s*'labs'/.test(contentSource),
  'the enlarged trailing butterfly should navigate directly to the Labs settings route'
);
assert(
  contentSource.includes('function resolveEntryContrastTone(element)') &&
    contentSource.includes('const entryContrast = resolveEntryContrastTone(candidate.snapshot.element)') &&
    contentSource.includes('host.dataset.entryContrast = entryContrast') &&
    contentSource.includes("setHostColorScheme(entryContrast === 'mixed' ? 'light dark' : entryContrast)") &&
    /data-entry-contrast="dark"/.test(contentSource),
  'the compact butterfly and expanded material should adapt their restrained contrast to the local page surface'
);
assert(
  /function hideSurface\(options\)\s*\{[\s\S]*?cancelToolbarEntranceAnimation\(\)/.test(contentSource) &&
    /function clearOwnedSurface\(\)\s*\{[\s\S]*?cancelToolbarEntranceAnimation\(\)/.test(contentSource),
  'dismissal and runtime handoff should interrupt the toolbar entrance animation'
);
assert(
  contentSource.includes('result[ENABLED_STORAGE_KEY] === true'),
  'content runtime should require an explicit enabled setting'
);
assert(
  backgroundSource.includes('result[SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY] === true'),
  'background actions should require an explicit enabled setting'
);
assert(
  /resolveSelectionQuickActionProvider\(\s*providers,\s*bundledProviders,\s*preferredProviderKey/.test(backgroundSource),
  'background actions should honor the stored preferred provider'
);
assert(
  /\._x_extension_select_trigger_2024_unique_\s*\{[\s\S]*?gap:\s*8px/.test(selectStyles),
  'the selected provider icon and label should use the same 8px gap as menu options'
);

localeNames.forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
  [
    'settings_selection_quick_actions_title',
    'settings_selection_quick_actions_desc',
    'settings_selection_quick_actions_provider_title',
    'settings_selection_quick_actions_group_title',
    'settings_selection_quick_actions_group_desc',
    'selection_quick_actions_group_name',
    'selection_quick_action_ask',
    'selection_quick_action_translate',
    'selection_quick_action_explain',
    'selection_quick_action_summarize',
    'selection_quick_action_search',
    'selection_quick_action_calculate'
  ].forEach((key) => {
    assert(messages[key] && String(messages[key].message || '').trim(), `${locale} should localize ${key}`);
  });
  [
    'settings_selection_quick_actions_icon_set_title',
    'selection_quick_actions_icon_set_remix',
    'selection_quick_actions_icon_set_hugeicons',
    'settings_selection_quick_actions_trigger_style_title',
    'selection_quick_actions_trigger_style_lumno',
    'selection_quick_actions_trigger_style_butterfly'
  ].forEach((key) => {
    assert.strictEqual(messages[key], undefined, `${locale} should remove the obsolete trigger-style copy`);
  });
});
const zhCnMessages = JSON.parse(fs.readFileSync('_locales/zh_CN/messages.json', 'utf8'));
assert.strictEqual(zhCnMessages.settings_selection_quick_actions_group_title.message, '在后台查询');
assert.strictEqual(
  zhCnMessages.settings_selection_quick_actions_group_desc.message,
  '所有 AI 网页皆归入「AI 查询」标签组'
);

const expectedGroupCopy = {
  en: ['AI Search', 'Collect all AI pages in the “AI Search” tab group'],
  ja: ['AI 検索', 'すべての AI ページを「AI 検索」タブグループにまとめます'],
  zh_CN: ['AI 查询', '所有 AI 网页皆归入「AI 查询」标签组'],
  zh_TW: ['AI 查詢', '所有 AI 網頁皆歸入「AI 查詢」分頁群組']
};
localeNames.forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
  assert.deepStrictEqual(
    [
      messages.selection_quick_actions_group_name.message,
      messages.settings_selection_quick_actions_group_desc.message
    ],
    expectedGroupCopy[locale],
    `${locale} should use one localized AI group name in both runtime and settings copy`
  );
});

const expectedTaskLabels = {
  en: ['Answer', 'Translate', 'Explain', 'Summarize', 'Research', 'Calculate'],
  ja: ['回答', '翻訳', '説明', '要約', '調査', '計算'],
  zh_CN: ['解答', '翻译', '解释', '总结', '调研', '计算'],
  zh_TW: ['解答', '翻譯', '解釋', '總結', '研究', '計算']
};
localeNames.forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
  assert.deepStrictEqual(
    [
      'selection_quick_action_ask',
      'selection_quick_action_translate',
      'selection_quick_action_explain',
      'selection_quick_action_summarize',
      'selection_quick_action_search',
      'selection_quick_action_calculate'
    ].map((key) => messages[key].message),
    expectedTaskLabels[locale],
    `${locale} should describe every toolbar item as a user task instead of mixing tasks with the AI channel`
  );
});

console.log('selection quick actions integration tests passed');
