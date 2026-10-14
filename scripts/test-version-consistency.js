const assert = require('assert');
const fs = require('fs');
const path = require('path');

// The release version lives in three files; a bump that misses one ships a
// package whose manifest disagrees with npm metadata (or the reverse).

const repoRoot = path.join(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8'));

const manifestVersion = readJson('manifest.json').version;
const packageVersion = readJson('package.json').version;
const lock = readJson('package-lock.json');
const lockVersion = lock.version;
const lockRootVersion = lock.packages && lock.packages[''] ? lock.packages[''].version : undefined;

assert(/^\d+(\.\d+){0,3}$/.test(manifestVersion), `manifest.json version ${manifestVersion} should be a dotted number`);
assert.strictEqual(packageVersion, manifestVersion, 'package.json version should match manifest.json');
assert.strictEqual(lockVersion, manifestVersion, 'package-lock.json version should match manifest.json');
assert.strictEqual(lockRootVersion, manifestVersion, 'package-lock.json root package version should match manifest.json');

console.log('version consistency tests passed');
