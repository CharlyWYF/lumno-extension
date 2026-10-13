const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const guardPath = path.join(repoRoot, 'src/shared/ime-key-guard.js');
const guard = require(guardPath);

function createClock(start) {
  let current = start;
  return {
    now() {
      return current;
    },
    tick(ms) {
      current += ms;
    }
  };
}

const clock = createClock(1000);
const input = { nodeName: 'INPUT' };
const otherInput = { nodeName: 'INPUT' };
const imeGuard = guard.createImeKeyGuard({ now: clock.now, commitEnterIgnoreMs: 120 });

imeGuard.markCompositionStart({ target: input });
assert.strictEqual(
  imeGuard.shouldIgnoreKeydown({ key: 'a', target: input }),
  true,
  'guard should ignore keydown while an IME composition is active'
);

imeGuard.markCompositionEnd({ target: input });
assert.strictEqual(
  imeGuard.shouldIgnoreKeydown({
    key: 'Enter',
    keyCode: 13,
    which: 13,
    isComposing: false,
    target: input
  }),
  true,
  'guard should ignore the Enter keydown that commits raw IME text after compositionend'
);

assert.strictEqual(
  imeGuard.shouldIgnoreKeydown({
    key: 'Enter',
    keyCode: 13,
    which: 13,
    isComposing: false,
    target: otherInput
  }),
  false,
  'guard should not suppress Enter on an unrelated target'
);

clock.tick(121);
assert.strictEqual(
  imeGuard.shouldIgnoreKeydown({
    key: 'Enter',
    keyCode: 13,
    which: 13,
    isComposing: false,
    target: input
  }),
  false,
  'guard should allow deliberate Enter after the composition commit window'
);

imeGuard.markCompositionStart({ target: input });
imeGuard.markCompositionEnd({ target: input });
imeGuard.markKeyUp();
assert.strictEqual(
  imeGuard.shouldIgnoreKeydown({
    key: 'Enter',
    keyCode: 13,
    which: 13,
    isComposing: false,
    target: input
  }),
  false,
  'guard should allow Enter right after the key that committed the IME text is released'
);

imeGuard.markCompositionStart({ target: input });
imeGuard.markKeyUp();
assert.strictEqual(
  imeGuard.isComposing(),
  true,
  'keyup during a composition should not end it'
);
imeGuard.markCompositionEnd({ target: input });

const newtabHtml = readPageSource('newtab.html');
const backgroundJs = fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8');
const newtabJs = readNewtabRuntimeSource();
const overlayJs = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');

assert.ok(
  newtabHtml.includes('<script src="../shared/ime-key-guard.js"></script>'),
  'New Tab should load the IME key guard before newtab.js'
);

assert.ok(
  backgroundJs.includes("'src/shared/ime-key-guard.js'"),
  'overlay injection should load the IME key guard before search-panel.js'
);

assert.match(
  newtabJs,
  /const imeKeyGuard = LumnoImeKeyGuard\.createImeKeyGuard\(\);[\s\S]*?function isImeCompositionEvent\(event\)[\s\S]*?return imeKeyGuard\.shouldIgnoreKeydown\(event\);/,
  'New Tab keydown handling should suppress IME commit Enter through the shared guard'
);

assert.match(
  overlayJs,
  /const imeKeyGuard = LumnoImeKeyGuard\.createImeKeyGuard\(\);[\s\S]*?function isImeCompositionEvent\(event\)[\s\S]*?return imeKeyGuard\.shouldIgnoreKeydown\(event\);/,
  'overlay keydown handling should suppress IME commit Enter through the shared guard'
);

assert.match(
  newtabJs,
  /inputParts\.input\.addEventListener\('keyup', imeKeyGuard\.markKeyUp, true\);/,
  'New Tab should end the IME commit window when the commit key is released'
);


const newtabCss = fs.readFileSync(path.join(repoRoot, 'src/newtab/newtab.css'), 'utf8');
const newtabRootRule = newtabCss.match(/\n#_x_extension_newtab_root_2024_unique_ \{[^}]*\}/);
assert.ok(newtabRootRule, 'New Tab search root rule should exist');
assert.doesNotMatch(
  newtabRootRule[0],
  /visibility:\s*hidden/,
  'New Tab search root should stay focusable before the page is ready so early keys reach the IME'
);

console.log('IME composition Enter tests passed');
