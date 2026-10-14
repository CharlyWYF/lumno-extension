const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');
const { extractFunction: extractFunctionFrom } = require('./helpers/extract-function');

const source = readNewtabRuntimeSource();
function extractFunction(name) {
  return extractFunctionFrom(source, name);
}

function createHarness() {
  let resolveLoad;
  let rejectLoad;
  const state = { loads: 0, mounts: 0, opens: [], closes: 0, errors: 0 };
  const controller = {
    mount() { state.mounts += 1; },
    open(options) { state.opens.push(options); },
    close() { state.closes += 1; }
  };
  const create = new Function('deps', `
    let shortcutDialogController = null;
    let shortcutDialogLoadPromise = null;
    let shortcutDialogOpenRevision = 0;
    const document = { body: {} };
    const console = { warn() {} };
    const createShortcutDialogComponent = deps.load;
    const showToast = deps.showError;
    const t = (_key, fallback) => fallback;
    ${extractFunction('openShortcutDialog')}
    ${extractFunction('closeShortcutDialog')}
    return { open: openShortcutDialog, close: closeShortcutDialog };
  `);
  const runtime = create({
    load() {
      state.loads += 1;
      return new Promise((resolve, reject) => { resolveLoad = resolve; rejectLoad = reject; });
    },
    showError() { state.errors += 1; }
  });
  return { runtime, state, finish: () => resolveLoad(controller), fail: () => rejectLoad(new Error('Failed')) };
}

async function run() {
  const harness = createHarness();
  assert.strictEqual(harness.state.loads, 0, 'opening a new tab must not load the editor');
  const first = harness.runtime.open({ title: 'First' });
  const second = harness.runtime.open({ title: 'Second' });
  assert.strictEqual(harness.state.loads, 1, 'concurrent opens must share one load');
  harness.finish();
  await Promise.all([first, second]);
  assert.deepStrictEqual(harness.state.opens, [{ title: 'Second' }]);
  assert.strictEqual(harness.state.mounts, 1);
  await harness.runtime.open({ title: 'Third' });
  assert.strictEqual(harness.state.loads, 1, 'reopening must reuse the loaded modal');
  const canceled = createHarness();
  const pending = canceled.runtime.open({ title: 'Canceled' });
  canceled.runtime.close(); canceled.finish(); await pending;
  assert.deepStrictEqual(canceled.state.opens, [], 'closing during loading must not open a stale editor');
  const retry = createHarness();
  const failed = retry.runtime.open({ title: 'Failed' });
  retry.fail(); await failed;
  assert.strictEqual(retry.state.errors, 1);
  const again = retry.runtime.open({ title: 'Retry' });
  retry.finish(); await again;
  assert.strictEqual(retry.state.loads, 2);
  assert.deepStrictEqual(retry.state.opens, [{ title: 'Retry' }]);
  console.log('Shortcut dialog lazy loading, cancellation, and retry tests passed.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
