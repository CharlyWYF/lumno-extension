// The New Tab page's single storage listener runs, for each change, the
// handlers registered for the keys it carries, in registration order and
// only for their storage area.
const assert = require('assert');
const path = require('path');

const { createStorageChangeRegistry } = require(path.join(
  __dirname, '..', 'src', 'newtab', 'storage-change-registry.js'
));

const change = (value) => ({ oldValue: undefined, newValue: value });

// Keys pick handlers; registration order is run order.
{
  const registry = createStorageChangeRegistry({ isPrimaryArea: (area) => area === 'sync' });
  const ran = [];
  registry.on('theme', (changes) => ran.push(`theme=${changes.theme.newValue}`));
  registry.on(['a', 'b'], (changes) => ran.push(`ab:${Object.keys(changes).sort().join('')}`));
  registry.onAny(() => ran.push('any'));
  registry.on('theme', () => ran.push('theme again'));

  registry.dispatch({ theme: change('dark') }, 'sync');
  assert.deepStrictEqual(ran, ['theme=dark', 'any', 'theme again']);
  ran.length = 0;
  registry.dispatch({ a: change(1), b: change(2) }, 'sync');
  assert.deepStrictEqual(ran, ['ab:ab', 'any'], 'a handler for several keys runs once');
  ran.length = 0;
  registry.dispatch({ other: change(1) }, 'sync');
  assert.deepStrictEqual(ran, ['any']);
}

// Areas: primary by default, 'local', 'any', or a predicate.
{
  let primary = 'sync';
  const registry = createStorageChangeRegistry({ isPrimaryArea: (area) => area === primary });
  const ran = [];
  registry.on('k', () => ran.push('primary'));
  registry.on('k', () => ran.push('local'), { area: 'local' });
  registry.on('k', () => ran.push('any'), { area: 'any' });
  registry.on('k', () => ran.push('secondary local'), { area: (area) => area === 'local' && area !== primary });

  registry.dispatch({ k: change(1) }, 'sync');
  assert.deepStrictEqual(ran, ['primary', 'any']);
  ran.length = 0;
  registry.dispatch({ k: change(1) }, 'local');
  assert.deepStrictEqual(ran, ['local', 'any', 'secondary local']);
  ran.length = 0;
  primary = 'local';
  registry.dispatch({ k: change(1) }, 'local');
  assert.deepStrictEqual(ran, ['primary', 'local', 'any'], 'with settings in local, local is primary');
}

// One failing handler does not keep the others from the change.
{
  const registry = createStorageChangeRegistry({ isPrimaryArea: () => true });
  const ran = [];
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    registry.on('k', () => { throw new Error('boom'); });
    registry.on('k', () => ran.push('after'));
    registry.dispatch({ k: change(1) }, 'sync');
  } finally {
    console.error = originalError;
  }
  assert.deepStrictEqual(ran, ['after']);
  assert.strictEqual(logged.length, 1);
}

console.log('newtab storage change registry tests passed');
