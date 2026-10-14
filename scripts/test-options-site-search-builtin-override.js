const assert = require('assert');
const fs = require('fs');

const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');

assert.match(
  optionsSource,
  /const removedItem = customSiteSearchProviders\.find\([\s\S]*?getSiteSearchBuiltinKey\(removedItem\);[\s\S]*?nextDisabledKeys\.delete\(builtinKey\);/,
  'removing a renamed override should re-enable its built-in origin'
);

assert.match(
  optionsSource,
  /const builtinKey = getSiteSearchBuiltinKey\(item\);\s*return key && !defaultKeys\.has\(key\) && !defaultKeys\.has\(builtinKey\);/,
  'resetting built-ins should remove renamed overrides as well as same-key overrides'
);

assert.match(
  optionsSource,
  /customSiteSearchProviders\.forEach\([\s\S]*?nextDisabledKeys\.delete\(builtinKey\);[\s\S]*?saveSiteSearchProviderState\(\[\], nextDisabledKeys\)/,
  'clearing custom providers should restore built-ins hidden by overrides in the same storage write'
);

console.log('options built-in site-search override tests passed');
