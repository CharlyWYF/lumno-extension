const assert = require('assert');
const searchUtils = require('../src/shared/search-utils');
const aggregateSearchStore = require('../src/shared/aggregate-search-store');
const siteSearch = require('../src/options/options-site-search');

const model = siteSearch.createSiteSearchModel({ searchUtils, aggregateSearchStore });
const defaults = searchUtils.getDefaultSiteSearchProviders()
  .map((item) => searchUtils.normalizeSiteSearchProvider(item))
  .filter(Boolean);
const youtube = defaults.find((item) => item.key === 'yt');
const github = defaults.find((item) => item.key === 'gh');
const chatgpt = defaults.find((item) => searchUtils.isAiSiteSearchProvider(item));
assert(youtube && github && chatgpt);

let nextId = 0;
const createId = () => `source-${++nextId}`;
const noConflict = () => false;

// Aliases accept both comma widths and drop blanks and repeats.
assert.deepStrictEqual(siteSearch.normalizeAliases(' a, b，a ,, c '), ['a', 'b', 'c']);
assert.deepStrictEqual(siteSearch.normalizeAliases(''), []);

// Only built-ins that are neither overridden nor turned off count as active.
assert.deepStrictEqual(
  siteSearch.getActiveBuiltinSiteSearchProviders(
    [youtube, github, chatgpt],
    [{ key: 'GH' }],
    new Set(['gpt'])
  ).map((item) => item.key),
  ['yt']
);

// Adding a custom provider.
{
  const base = { custom: [{ key: 'docs', name: 'Old docs', template: 'https://old/{query}' }], disabledKeys: new Set(['docs', 'yt']), createId };
  const errors = [
    [{ key: '' }, 'shortcuts_error_key'],
    [{ key: 'a b' }, 'shortcuts_error_key_space'],
    [{ key: 'docs', template: 'https://x/{query}' }, 'shortcuts_error_key_duplicate', () => true],
    [{ key: 'docs', template: 'https://x/' }, 'toast_error_template']
  ];
  errors.forEach(([draft, error, hasKeyConflict]) => {
    assert.deepStrictEqual(
      model.addCustomSiteSearchProvider(draft, Object.assign({}, base, { hasKeyConflict: hasKeyConflict || noConflict })),
      { ok: false, error }
    );
  });
  const conflictChecks = [];
  const added = model.addCustomSiteSearchProvider(
    { key: 'Docs', template: 'https://docs.example/?q={query}', aliases: 'd, dd', category: 'searchEngine' },
    Object.assign({}, base, { hasKeyConflict: (key, allowedKey) => { conflictChecks.push([key, allowedKey]); return false; } })
  );
  assert.deepStrictEqual(conflictChecks, [['Docs', '']], 'new triggers may not reuse any existing one');
  assert.strictEqual(added.ok, true);
  assert.strictEqual(added.custom.length, 1, 'the new provider replaces a custom one with the same trigger');
  assert.strictEqual(added.custom[0].key, 'Docs');
  assert.strictEqual(added.custom[0].name, 'Docs', 'the name falls back to the trigger');
  assert.strictEqual(added.custom[0].category, 'searchEngine');
  assert.deepStrictEqual(added.custom[0].aliases, ['d', 'dd']);
  assert.match(added.custom[0].id, /^source-/);
  assert.deepStrictEqual(Array.from(added.disabledKeys).sort(), ['yt'], 'a reused key is turned back on');
  assert.deepStrictEqual(Array.from(base.disabledKeys).sort(), ['docs', 'yt'], 'the page state is not mutated');
}

// Editing a built-in stores a custom copy that remembers its origin and turns
// the original off.
{
  const edited = model.editSiteSearchProvider(youtube, true, {
    key: 'tube',
    name: 'Tube',
    template: youtube.template,
    category: 'searchEngine'
  }, { defaults, custom: [], disabledKeys: new Set(), hasKeyConflict: noConflict, createId });
  assert.strictEqual(edited.ok, true);
  assert.strictEqual(edited.custom[0].key, 'tube');
  assert.strictEqual(edited.custom[0].builtinKey, 'yt');
  assert.strictEqual(edited.custom[0].category, 'searchEngine');
  assert.strictEqual(edited.custom[0].disabled, false, 'an override never counts as a duplicate of its origin');
  assert(edited.disabledKeys.has('yt'), 'the original built-in is hidden');

  const conflictChecks = [];
  model.editSiteSearchProvider(youtube, true, { key: 'yt', template: youtube.template }, {
    defaults,
    custom: [],
    disabledKeys: new Set(),
    hasKeyConflict: (key, allowedKey) => { conflictChecks.push([key, allowedKey]); return false; },
    createId
  });
  assert.deepStrictEqual(conflictChecks, [['yt', 'yt']], 'an edit may keep its own trigger');

  const ai = model.editSiteSearchProvider(chatgpt, true, { key: chatgpt.key, template: 'https://chatgpt.com/' }, {
    defaults, custom: [], disabledKeys: new Set(), hasKeyConflict: noConflict, createId
  });
  assert.strictEqual(ai.ok, true, 'built-in AI providers do not need a {query} placeholder');
  assert.strictEqual(ai.custom[0].category, 'aiSearch');
}

// Editing a custom provider: renaming drops the old entry, and a template that
// repeats an active built-in marks it as a duplicate.
{
  const custom = [{ id: 'c1', key: 'mine', name: 'Mine', template: 'https://mine/{query}' }];
  const edited = model.editSiteSearchProvider(custom[0], false, {
    key: 'tube2',
    template: youtube.template
  }, { defaults, custom, disabledKeys: new Set(['tube2']), hasKeyConflict: noConflict, createId });
  assert.strictEqual(edited.ok, true);
  assert.deepStrictEqual(edited.custom.map((item) => item.key), ['tube2']);
  assert.strictEqual(edited.custom[0].id, 'c1', 'the stable id is kept');
  assert.strictEqual(edited.custom[0].disabled, true);
  assert.strictEqual(edited.custom[0].disabledReason, 'duplicate');
  assert(!edited.disabledKeys.has('tube2'));

  const whileBuiltinOff = model.editSiteSearchProvider(custom[0], false, {
    key: 'tube2',
    template: youtube.template
  }, { defaults, custom, disabledKeys: new Set(['yt']), hasKeyConflict: noConflict, createId });
  assert.strictEqual(whileBuiltinOff.custom[0].disabled, false, 'a turned-off built-in is no duplicate');
}

// Trigger conflicts cover providers and aggregate searches.
{
  const state = {
    providers: [youtube, { key: 'docs' }],
    aggregateSearches: [{ id: 'agg-1', key: 'tech' }]
  };
  assert.strictEqual(model.findSiteSearchKeyConflict('YT', '', '', state).key, 'yt');
  assert.strictEqual(model.findSiteSearchKeyConflict('yt', 'yt', '', state), null);
  assert.strictEqual(model.findSiteSearchKeyConflict('tech', '', '', state).id, 'agg-1');
  assert.strictEqual(model.findSiteSearchKeyConflict('tech', '', 'agg-1', state), null);
  assert.strictEqual(model.findSiteSearchKeyConflict('  ', '', '', state), null);
}

// Snapshot cleanup.
{
  const redundant = { key: 'yt', name: youtube.name, template: youtube.template, aliases: youtube.aliases.slice().reverse() };
  const changed = { key: 'gh', name: 'My GitHub', template: github.template };
  const debug = { id: 'd', key: 'dup', template: 'https://dup/{query}' };
  const duplicate = { key: 'tube', template: youtube.template };
  const prepared = model.prepareSiteSearchProviderSnapshot({
    defaults,
    custom: [redundant, changed, debug, duplicate],
    disabled: ['gh']
  }, { debugDuplicateKey: 'dup' });
  assert.deepStrictEqual(prepared.custom.map((item) => item.key), ['gh', 'tube'],
    'unchanged copies of built-ins and the debug provider are dropped');
  assert(prepared.custom.every((item) => item.id), 'every custom provider gets a stable id');
  assert.strictEqual(prepared.custom[1].disabledReason, 'duplicate');
  assert.strictEqual(prepared.needsPersistence, true);

  const again = model.prepareSiteSearchProviderSnapshot({
    defaults,
    custom: [redundant, changed, debug, duplicate],
    disabled: ['gh']
  }, { debugDuplicateKey: 'dup' });
  assert.deepStrictEqual(again.custom.map((item) => item.id), prepared.custom.map((item) => item.id),
    'legacy providers get the same ids on every device that migrates them');

  const clean = model.prepareSiteSearchProviderSnapshot({
    defaults,
    custom: prepared.custom,
    disabled: Array.from(prepared.disabledKeys)
  }, { debugDuplicateKey: 'dup' });
  assert.strictEqual(clean.needsPersistence, false, 'a cleaned snapshot needs no further write');

  const allOff = model.prepareSiteSearchProviderSnapshot({
    defaults: [youtube],
    custom: [],
    disabled: ['yt']
  });
  assert.strictEqual(allOff.disabledKeys.size, 0, 'built-ins come back when everything was turned off');
  assert.strictEqual(allOff.needsPersistence, true);
}

console.log('Options site search model tests passed.');
