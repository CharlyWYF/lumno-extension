'use strict';

// background.js is split into classic service scripts that share the worker's
// global scope (see the first importScripts block in background.js). Tests that
// slice functions out of the background by name read all of them together.

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const BACKGROUND_ENTRY = 'src/background/background.js';

function getBackgroundServiceFiles() {
  const source = fs.readFileSync(path.join(repoRoot, BACKGROUND_ENTRY), 'utf8');
  const importBlock = source.match(/importScripts\(([\s\S]*?)\);/);
  if (!importBlock) {
    return [];
  }
  return [...importBlock[1].matchAll(/getURL\('(src\/background\/[^']+)'\)/g)]
    .map((match) => match[1])
    .filter((file) => /-service\.js$|^src\/background\/pinned-tab-recovery\.js$/.test(file));
}

// Service scripts first: they hold the function definitions that
// background.js wires to browser events, matching how the worker loads them.
function readBackgroundSource() {
  return getBackgroundServiceFiles().concat([BACKGROUND_ENTRY])
    .map((file) => fs.readFileSync(path.join(repoRoot, file), 'utf8'))
    .join('\n');
}

module.exports = {
  BACKGROUND_ENTRY,
  getBackgroundServiceFiles,
  readBackgroundSource
};
