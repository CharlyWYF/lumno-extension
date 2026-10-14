const assert = require('assert');
const providerResolver = require('../src/background/selection-quick-action-provider.js');

function isInteractive(provider) {
  return Boolean(provider && provider.action === 'openAndSubmit' && provider.submitStrategy);
}

const chatGpt = {
  key: 'gpt',
  action: 'openAndSubmit',
  submitStrategy: 'chatgptPrompt'
};
const gemini = {
  key: 'gm',
  action: 'openAndSubmit',
  submitStrategy: 'geminiPrompt'
};

assert.strictEqual(
  providerResolver.resolveSelectionQuickActionProvider(
    [gemini],
    [chatGpt, gemini],
    'gpt',
    isInteractive
  ),
  chatGpt,
  'the selection-specific provider should remain available when it is hidden from general search sources'
);

assert.strictEqual(
  providerResolver.resolveSelectionQuickActionProvider(
    [],
    [chatGpt, gemini],
    'gm',
    isInteractive
  ),
  gemini,
  'selection actions should fall back to bundled AI providers when all AI search sources are disabled'
);

assert.strictEqual(
  providerResolver.resolveSelectionQuickActionProvider(
    [],
    [chatGpt],
    'missing-provider',
    isInteractive
  ),
  chatGpt,
  'an unavailable preference should fall back to bundled ChatGPT'
);

// The provider list order becomes the reader's Search sources order once that
// page is used, so the fallback must not depend on which provider is listed
// first.
assert.strictEqual(
  providerResolver.resolveSelectionQuickActionProvider(
    [gemini, chatGpt],
    [],
    'missing-provider',
    isInteractive
  ),
  chatGpt,
  'the fallback should stay ChatGPT when it is not the first provider in the list'
);
assert.strictEqual(
  providerResolver.resolveSelectionQuickActionProvider(
    [gemini],
    [],
    'missing-provider',
    isInteractive
  ),
  null,
  'no fallback should be invented when ChatGPT is not available at all'
);

console.log('selection quick action provider tests passed');
