const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadBackground } = require('./helpers/background-harness');

// background.js is split into classic scripts that share the worker's global
// scope. Chrome loads them through importScripts while background.js starts;
// the Firefox build (scripts/build-firefox.js) lists the first import block as
// separate background.scripts that all run before background.js. Both orders
// must boot without touching a top-level binding before it is initialized.

const repoRoot = path.resolve(__dirname, '..');
const backgroundSource = fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8');
const firstImportBlock = backgroundSource.match(/importScripts\(([\s\S]*?)\);/)[1];
const serviceModules = fs.readdirSync(path.join(repoRoot, 'src/background'))
  .filter((file) => /-service\.js$|^pinned-tab-recovery\.js$/.test(file))
  .map((file) => `src/background/${file}`);

serviceModules.forEach((file) => {
  assert.ok(
    firstImportBlock.includes(`'${file}'`),
    `${file} must be in the first importScripts block so the Firefox build loads it`
  );
});

function bootAndCheck(firefoxOrder) {
  const harness = loadBackground({
    firefoxOrder,
    tabs: [{ id: 3, windowId: 1, index: 0, active: true, url: 'https://example.com/', title: 'Example' }],
    expose: ['backgroundMessageRouter']
  });
  const router = harness.exposed('backgroundMessageRouter');
  assert.ok(router && router.has('getSearchSuggestions'), 'the router should be ready after boot');
  return harness;
}

(async () => {
  const chromeOrder = bootAndCheck(false);
  const firefoxOrder = bootAndCheck(true);
  for (const harness of [chromeOrder, firefoxOrder]) {
    const response = await harness.sendMessage({ action: 'getShowSearchShortcut' });
    assert.ok(response && typeof response.shortcut === 'string');
  }
  console.log('background load order tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
