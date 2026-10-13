const assert = require('assert');
const { readStylesheet } = require('./helpers/css-tokens');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const newtabSource = readNewtabRuntimeSource();
const newtabSuggestionsSource = fs.readFileSync(path.join(repoRoot, 'react-src/search/suggestions.tsx'), 'utf8');
const newtabHtmlSource = readPageSource('newtab.html');
const overlaySource = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
const overlayCssSource = readStylesheet('src/overlay/suggestions-view.css');
const backgroundSource = fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8');
const localeNames = ['en', 'ja', 'zh_CN', 'zh_TW'];

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `expected ${name} to exist`);
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
  throw new Error(`could not extract ${name}`);
}

function createCommandMatcher(source, documentPipEnabled) {
  const definitionsMatch = source.match(
    /const commandDefinitions = (\[[\s\S]*?\n\s*\]);\n\n\s*function getCommandMatches/
  );
  assert.ok(definitionsMatch, 'expected command definitions before getCommandMatches');
  const functionSource = extractFunction(source, 'getCommandMatches');
  return vm.runInNewContext(`(() => {
    const documentPipEnabled = ${documentPipEnabled ? 'true' : 'false'};
    const commandDefinitions = ${definitionsMatch[1]};
    ${functionSource}
    return getCommandMatches;
  })()`);
}

function assertSlashCommandDiscovery(source, expectedTypes, surface) {
  expectedTypes.forEach((type) => {
    assert.match(
      source,
      new RegExp(`type:\\s*'${type}'[\\s\\S]*?primary:\\s*'\\/`),
      `${surface} should include ${type} in its slash command definitions`
    );
  });
  assert.match(
    source,
    /function getCommandMatches\(rawInput\) \{[\s\S]*?const matches = \[\];[\s\S]*?token\.startsWith\(input\)[\s\S]*?matches\.push\(command\)[\s\S]*?return matches;/,
    `${surface} should return every slash command matching the live input`
  );
  assert.doesNotMatch(
    source,
    /input\.startsWith\(token\)/,
    `${surface} should stop matching after the user types past a complete command or alias`
  );
  assert.match(
    source,
    /commandMatches\.forEach\(\(command\) => \{[\s\S]*?preSuggestions\.push\(buildCommandSuggestion\(command\)\);[\s\S]*?\}\);/,
    `${surface} should render all matching commands instead of only the first match`
  );
}

function assertPlainNavigationSuggestionsPreserved(source, surface, options) {
  const preSuggestionsStart = source.indexOf('const preSuggestions = [];');
  assert.ok(preSuggestionsStart >= 0, `${surface} should define pre-suggestions`);
  const providersStart = source.indexOf('const providersForTags', preSuggestionsStart);
  assert.ok(providersStart > preSuggestionsStart, `${surface} should compose pre-suggestions before provider matching`);
  const block = source.slice(preSuggestionsStart, providersStart);
  const slashBranchIndex = block.indexOf('else if (slashCommandModeActive && !siteSearchQueryModeActive)');
  const plainBranchIndex = block.search(
    /else if \(!siteSearchQueryModeActive(?: && !localSearchQueryModeActive)?\)/
  );
  assert.ok(slashBranchIndex >= 0, `${surface} should keep a slash-only command branch`);
  assert.ok(
    plainBranchIndex > slashBranchIndex,
    `${surface} should restore ordinary navigation suggestions outside slash command mode`
  );
  const plainBranch = block.slice(plainBranchIndex);
  assert.match(
    plainBranch,
    /const directUrlSuggestion = getDirectUrlSuggestion\(query\);/,
    `${surface} should build a direct URL candidate for ordinary input`
  );
  if (options && options.excludeCurrentUrl) {
    assert.match(
      plainBranch,
      /if \(directUrlSuggestion && !isCurrentOverlayTabUrl\(directUrlSuggestion\.url\)\)/,
      `${surface} should avoid suggesting the current page as a direct URL`
    );
  } else {
    assert.match(
      plainBranch,
      /if \(directUrlSuggestion\)/,
      `${surface} should retain recognized direct URL candidates`
    );
  }
  assert.match(
    plainBranch,
    /const keywordSuggestions = buildKeywordSuggestions\(query, rules\);[\s\S]*?preSuggestions\.push\(\.\.\.keywordSuggestions\);/,
    `${surface} should retain ordinary keyword navigation candidates`
  );
}

assertSlashCommandDiscovery(
  newtabSource,
  ['commandNewTab', 'commandSettings', 'modeSwitch', 'zenSwitch'],
  'New Tab'
);
assertSlashCommandDiscovery(
  overlaySource,
  ['commandNewTab', 'commandSettings', 'modeSwitch', 'commandOpenTabs', 'commandCopyUrl', 'commandDocumentPip'],
  'overlay'
);
assertPlainNavigationSuggestionsPreserved(newtabSource, 'New Tab');
assertPlainNavigationSuggestionsPreserved(overlaySource, 'overlay', { excludeCurrentUrl: true });

const getNewtabCommandMatches = createCommandMatcher(newtabSource, false);
assert.deepStrictEqual(
  Array.from(getNewtabCommandMatches('/'), (command) => command.type),
  ['commandNewTab', 'commandSettings', 'modeSwitch', 'zenSwitch'],
  'New Tab should show every available slash command for a bare slash'
);
assert.deepStrictEqual(
  Array.from(getNewtabCommandMatches('/m'), (command) => command.type),
  ['modeSwitch'],
  'New Tab should filter the command list as the user types'
);
assert.deepStrictEqual(
  Array.from(getNewtabCommandMatches('/z'), (command) => command.type),
  ['zenSwitch'],
  'New Tab should include the Zen command in live filtering'
);
assert.deepStrictEqual(
  Array.from(getNewtabCommandMatches('/unknown'), (command) => command.type),
  [],
  'New Tab should remove commands that no longer match the input'
);
['/nothing', '/something', '/settings-extra', '/newtab-extra'].forEach((input) => {
  assert.deepStrictEqual(
    Array.from(getNewtabCommandMatches(input), (command) => command.type),
    [],
    `New Tab should not execute a command when ${input} only starts with an alias or command`
  );
});

const getOverlayCommandMatches = createCommandMatcher(overlaySource, true);
assert.deepStrictEqual(
  Array.from(getOverlayCommandMatches('/'), (command) => command.type),
  ['commandNewTab', 'commandSettings', 'modeSwitch', 'commandOpenTabs', 'commandCopyUrl', 'commandDocumentPip'],
  'overlay should show every available slash command without mixing in plain commands'
);
assert.deepStrictEqual(
  Array.from(getOverlayCommandMatches('/c'), (command) => command.type),
  ['commandCopyUrl', 'commandDocumentPip'],
  'overlay should filter copy and clip commands together until the input disambiguates them'
);
assert.deepStrictEqual(
  Array.from(getOverlayCommandMatches('/t'), (command) => command.type),
  ['commandOpenTabs'],
  'overlay should expose its existing open-tabs-only mode as a slash command'
);
assert.deepStrictEqual(
  Array.from(getOverlayCommandMatches('/set'), (command) => command.type),
  ['commandSettings'],
  'overlay should filter slash commands by aliases'
);
['/continue', '/test', '/copycat', '/tabs-extra'].forEach((input) => {
  assert.deepStrictEqual(
    Array.from(getOverlayCommandMatches(input), (command) => command.type),
    [],
    `overlay should not execute a command when ${input} only starts with an alias or command`
  );
});
assert.deepStrictEqual(
  Array.from(getOverlayCommandMatches('clip'), (command) => command.type),
  ['commandDocumentPip'],
  'overlay should preserve the enabled legacy plain clip command'
);
const getOverlayCommandsWithoutClip = createCommandMatcher(overlaySource, false);
assert.deepStrictEqual(
  Array.from(getOverlayCommandsWithoutClip('/'), (command) => command.type),
  ['commandNewTab', 'commandSettings', 'modeSwitch', 'commandOpenTabs', 'commandCopyUrl'],
  'overlay should hide only the clip command while webpage clipping is disabled'
);

assert.match(
  overlaySource,
  /primary:\s*'\/clip'[\s\S]*?legacyExactAliases:\s*\['clip', 'webclip', 'web clip'\][\s\S]*?legacyExactAliases\.includes\(input\)[\s\S]*?matches\.push\(command\)/,
  'overlay should discover /clip while retaining its legacy exact inputs'
);
assert.match(
  overlaySource,
  /if \(commandMatch\.command\.type === 'modeSwitch'\) \{[\s\S]*?applyThemeModeChange\(getNextThemeMode\(overlayThemeMode \|\| 'system'\)\);[\s\S]*?searchInput\.focus\(\);[\s\S]*?return;/,
  'overlay should execute a filtered /mode suggestion without closing the command bar'
);
assert.match(
  newtabSource,
  /function buildModeSuggestion\(\)[\s\S]*?commandText:\s*'\/mode'[\s\S]*?function buildZenSuggestion\(\)[\s\S]*?commandText:\s*'\/zen'/,
  'New Tab should keep command labels when exact /mode and /zen results use their direct builders'
);
assert.match(
  overlaySource,
  /function buildModeSuggestion\(\)[\s\S]*?commandText:\s*'\/mode'/,
  'overlay should keep the command label when exact /mode uses its direct builder'
);
assert.match(
  overlaySource,
  /type:\s*'commandOpenTabs'[\s\S]*?primary:\s*'\/tabs'[\s\S]*?type:\s*'commandCopyUrl'[\s\S]*?primary:\s*'\/copy'[\s\S]*?type:\s*'commandDocumentPip'[\s\S]*?primary:\s*'\/clip'/,
  'overlay should keep the recommended Lumno-only command order'
);

assert.match(
  newtabSource,
  /if \((?:!localSearchScopeState && )?isSlashCommandInput\(query\)\) \{[\s\S]*?renderSuggestions\(\[\], query\);[\s\S]*?return;/,
  'New Tab should route slash-prefixed input directly to command rendering outside local search scopes'
);
assert.ok(
  (overlaySource.match(/if \((?:!localSearchScopeState && )?isSlashCommandInput\(query\)\) \{/g) || []).length >= 2,
  'overlay input and paste paths should route slash-prefixed input to command rendering outside local search scopes'
);
assert.match(
  newtabSource,
  /const slashCommandModeActive = [^;]*isSlashCommandInput\(rawTagInput\);[\s\S]*?const newTabSuggestion = \([\s\S]*?slashCommandModeActive[\s\S]*?let allSuggestions = [\s\S]*?slashCommandModeActive \? \[\.\.\.preSuggestions\]/,
  'New Tab should compose only command rows while slash command mode is active'
);
assert.match(
  overlaySource,
  /const slashCommandModeActive = [^;]*isSlashCommandInput\(rawTagInput\);[\s\S]*?const newTabSuggestion = \([\s\S]*?slashCommandModeActive[\s\S]*?let allSuggestions = [\s\S]*?slashCommandModeActive \? \[\.\.\.preSuggestions\]/,
  'overlay should compose only command rows while slash command mode is active'
);
assert.match(
  newtabSource,
  /const emptyMessage = slashCommandModeActive && allSuggestions\.length === 0[\s\S]*?slash_command_empty/,
  'New Tab should show a command-specific empty state without falling back to search'
);
assert.match(
  overlaySource,
  /const emptyMessage = slashCommandModeActive && allSuggestions\.length === 0[\s\S]*?slash_command_empty[\s\S]*?reactView\.render\(\{[\s\S]*?emptyMessage/,
  'overlay should show a command-specific empty state without falling back to search'
);

assert.match(
  overlaySource,
  /type === 'commandOpenTabs'[\s\S]*?activateOpenTabsSearchMode\(\)[\s\S]*?type === 'commandCopyUrl'[\s\S]*?action:\s*'copyCurrentPageUrl'/,
  'overlay should execute tabs and copy commands through existing capability paths'
);
assert.match(
  overlaySource,
  /else if \(query\) \{\s*if \((?:!localSearchScopeState && )?isSlashCommandInput\(query\)\) \{\s*updateSearchSuggestions\(\[\], query\);\s*return;[\s\S]*?resolveQuickNavigation\(query\)/,
  'overlay Enter should preserve the slash empty state instead of falling through to navigation'
);
assert.match(
  newtabSource,
  /if \(selectedIndex >= 0 && currentSuggestions\[selectedIndex\]\) \{[\s\S]*?executeSuggestion\([\s\S]*?\}\s*if \((?:!localSearchScopeState && )?isSlashCommandInput\(query\)\) \{\s*renderSuggestions\(\[\], query\);\s*return;/,
  'New Tab Enter should execute a selected command before suppressing an unresolved slash input'
);
assert.match(
  newtabSource,
  /const emptyMessage = slashCommandModeActive && allSuggestions\.length === 0[\s\S]*?getSuggestionActionContextKey\([\s\S]*?\bemptyMessage\b[\s\S]*?suggestionsView\.render\(\{[\s\S]*?\bemptyMessage\b/,
  'New Tab should pass the same slash empty message to its action context and rendered view'
);
localeNames.forEach((localeName) => {
  const messages = JSON.parse(fs.readFileSync(
    path.join(repoRoot, '_locales', localeName, 'messages.json'),
    'utf8'
  ));
  [
    'slash_command_empty',
    'command_tabs_title',
    'command_tabs_action',
    'command_copy_title',
    'command_copy_action'
  ].forEach((key) => {
    assert.ok(messages[key] && messages[key].message, `${localeName} should localize ${key}`);
  });
});

assert.match(
  newtabSuggestionsSource,
  /data-command-row=\{command \? 'true'[\s\S]*?x-nt-suggestion-command[\s\S]*?x-nt-suggestion-command-description/,
  'New Tab command rows should put the command above the smaller result description'
);
assert.match(
  newtabSuggestionsSource,
  /function surfaceClass\([\s\S]*?options\.surface !== 'overlay'[\s\S]*?replace\(\/\^x-nt-\/, 'x-ov-'\)/,
  'Overlay command rows should reuse the React command layout with Overlay class names'
);
assert.match(
  newtabHtmlSource,
  /\.x-nt-suggestion-item\[data-command-row="true"\]\s*\{[\s\S]*?height:\s*var\(--x-nt-suggestion-row-height,\s*52px\);[\s\S]*?min-height:\s*var\(--x-nt-suggestion-row-height,\s*52px\);[\s\S]*?padding-top:\s*7px;[\s\S]*?padding-bottom:\s*7px;/,
  'New Tab command rows should stay locked to the existing 52px row height'
);
assert.match(
  newtabHtmlSource,
  /\.x-nt-suggestion-command\s*\{[\s\S]*?font-size:\s*14px;[\s\S]*?line-height:\s*18px;[\s\S]*?\}[\s\S]*?\.x-nt-suggestion-command-description[\s\S]*?font-size:\s*11px;[\s\S]*?line-height:\s*15px;/,
  'New Tab command typography should fit two lines inside the fixed row budget'
);
assert.match(
  newtabHtmlSource,
  /\.x-nt-suggestion-item\s*\{[^}]*height:\s*var\(--x-nt-suggestion-row-height,\s*52px\);[^}]*min-height:\s*var\(--x-nt-suggestion-row-height,\s*52px\);/,
  'New Tab result rows should use the shared fixed row-height contract'
);
assert.match(
  newtabHtmlSource,
  /\.x-nt-empty-state\s*\{[^}]*height:\s*var\(--x-nt-suggestion-row-height,\s*52px\);[^}]*min-height:\s*var\(--x-nt-suggestion-row-height,\s*52px\);[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*gap:\s*8px;/,
  'New Tab empty state should share the result-row height while centering its contents'
);
assert.match(
  overlayCssSource,
  /\.x-ov-suggestion-item\[data-command-row="true"\]\s*\{[\s\S]*?height:\s*var\(--x-ov-suggestion-row-height,\s*52px\);[\s\S]*?min-height:\s*var\(--x-ov-suggestion-row-height,\s*52px\);[\s\S]*?padding-top:\s*7px;[\s\S]*?padding-bottom:\s*7px;/,
  'overlay command rows should stay locked to the existing 52px row height'
);
assert.match(
  overlayCssSource,
  /\.x-ov-suggestion-command\s*\{[\s\S]*?font-size:\s*14px;[\s\S]*?line-height:\s*18px;[\s\S]*?\}[\s\S]*?\.x-ov-suggestion-command-description[\s\S]*?font-size:\s*11px;[\s\S]*?line-height:\s*15px;/,
  'overlay command typography should fit two lines inside the fixed row budget'
);

console.log('slash command discovery tests passed');
