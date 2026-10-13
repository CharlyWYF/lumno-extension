const assert = require('assert');
const { extractFunction } = require('./helpers/extract-function');

const source = [
  '(function() {',
  '  function helper(value = {}) {',
  '    if (value) { return { ok: true }; }',
  '    return null;',
  '  }',
  '  async function load(name) {',
  '    return await Promise.resolve(name);',
  '  }',
  '})();'
].join('\n');

const helper = extractFunction(source, 'helper');
assert.ok(helper.startsWith('function helper('));
assert.ok(helper.endsWith('return null;\n  }'));
assert.deepStrictEqual(new Function(`${helper}; return helper;`)()(1), { ok: true });

const load = extractFunction(source, 'load');
assert.ok(load.startsWith('async function load('), 'keeps the async keyword');

assert.throws(() => extractFunction(source, 'missing'), /missing function missing/);
assert.throws(() => extractFunction('function broken() {', 'broken'), /unterminated function broken/);

console.log('Shared extractFunction test helper tests passed.');
