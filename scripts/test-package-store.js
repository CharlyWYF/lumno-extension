const assert = require('assert');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
const zipPath = path.join(repoRoot, 'dist', `lumno-store-v${manifest.version}.zip`);
const expectedDevExtensionId = 'kkcjcneagmlhpeaafngjdlpcfjakejgb';

// Page script bundles run to a few MB, past execFileSync's 1 MB default.
const ARCHIVE_READ_MAX_BUFFER = 64 * 1024 * 1024;

function readArchive(entry) {
  if (process.platform !== 'win32') return execFileSync(entry ? 'unzip' : 'zipinfo', entry ? ['-p', zipPath, entry] : ['-1', zipPath], { cwd: repoRoot, encoding: 'utf8', maxBuffer: ARCHIVE_READ_MAX_BUFFER });
  const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
  const command = entry
    ? `$reader = [System.IO.StreamReader]::new($archive.GetEntry(${quote(entry)}).Open()); try { [Console]::Write($reader.ReadToEnd()) } finally { $reader.Dispose() }`
    : '$archive.Entries | ForEach-Object { $_.FullName }';
  return execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem; " +
    `$archive = [System.IO.Compression.ZipFile]::OpenRead(${quote(zipPath)}); try { ${command} } finally { $archive.Dispose() }`
  ], { cwd: repoRoot, encoding: 'utf8', maxBuffer: ARCHIVE_READ_MAX_BUFFER });
}

function getExtensionIdFromManifestKey(key) {
  const publicKey = Buffer.from(String(key || ''), 'base64');
  const digestPrefix = crypto.createHash('sha256').update(publicKey).digest().subarray(0, 16);
  return Array.from(digestPrefix)
    .flatMap((byte) => [byte >> 4, byte & 0x0f])
    .map((nibble) => String.fromCharCode('a'.charCodeAt(0) + nibble))
    .join('');
}

assert.strictEqual(
  getExtensionIdFromManifestKey(manifest.key),
  expectedDevExtensionId,
  'source manifest should keep the dedicated development extension ID stable'
);

execFileSync(process.execPath, ['scripts/package-store.js'], {
  cwd: repoRoot,
  stdio: 'pipe'
});

const entries = readArchive().split(/\r?\n/).filter(Boolean);
const packagedManifest = JSON.parse(readArchive('manifest.json'));
const readPackagedText = readArchive;

assert(
  entries.every((entry) => !entry.startsWith('assets/images/readme/')),
  'store package should not include README-only images'
);
assert(
  entries.includes('src/react/newtab-islands.js') &&
    entries.includes('src/react/options-islands.js') &&
    entries.includes('src/react/onboarding-islands.js') &&
    entries.includes('src/react/overlay-islands.js') &&
    entries.includes('src/react/react-shared.js') &&
    entries.includes('src/react/tab-switcher-shared.js') &&
    entries.includes('src/react/react-runtime.js') &&
    entries.includes('src/shared/react-page-bootstrap.js'),
  'store package should include both page entries, shared React chunks, and bootstrap'
);
const retiredRenderers = [
  'src/shared/search-input-ui.js',
  'src/newtab/bookmarks-topbar.js',
  'src/newtab/page-notice.js',
  'src/newtab/toast.js',
  'src/newtab/dock.js',
  'src/newtab/recent-sites-view.js',
  'src/newtab/bookmarks-view.js',
  'src/newtab/suggestions-view.js',
  'src/newtab/shortcut-dialog.js',
  'src/newtab/shortcuts-view.js',
  'src/overlay/input-ui.js',
  'src/overlay/shell.js'
];
assert(
  retiredRenderers.every((file) => !entries.includes(file)),
  'store package should not include retired UI renderers'
);
assert(
  entries.every((entry) => !entry.startsWith('react-src/')),
  'store package should not include React source or test files'
);
assert(
  entries.every((entry) => !/^(?:supabase|docs|scripts)\//.test(entry)),
  'store package should contain no backend, deployment, or repository tooling files'
);
const developmentOnlyFiles = [
  'src/background/codex-debug-bridge.js',
  'src/shared/codex-debug-surface.js'
];
assert(
  developmentOnlyFiles.every((file) => !entries.includes(file)),
  'store package should exclude development-only Codex debug scripts'
);
[
  'newtab.html',
  'src/options/options.html',
  'src/onboarding/onboarding.html'
].forEach((file) => {
  assert(
    !readPackagedText(file).includes('codex-debug-surface.js'),
    `${file} should not load the development-only debug surface in the store package`
  );
  assert(
    fs.readFileSync(path.join(repoRoot, file), 'utf8').includes('codex-debug-surface.js'),
    `${file} should retain the debug surface in development source`
  );
});
const { getBackgroundServiceFiles } = require('./helpers/background-source');
['src/background/background.js'].concat(getBackgroundServiceFiles()).forEach((file) => {
  assert(entries.includes(file), `store package should include ${file}`);
  assert(
    !/codex-debug-(?:bridge|surface)\.js|LumnoCodexDebug|codexDebugBridge/.test(readPackagedText(file)),
    `store ${file} should not retain development-only debug bridge references`
  );
});
assert(
  /codex-debug-bridge\.js/.test(fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8')),
  'development background should retain the Codex debug bridge'
);
assert(
  !Object.prototype.hasOwnProperty.call(packagedManifest, 'key'),
  'store package should not include the dedicated development key'
);
assert(
  !Object.prototype.hasOwnProperty.call(packagedManifest, 'externally_connectable'),
  'store package should not expose the development-only Codex debug connection'
);
assert.strictEqual(
  packagedManifest.version,
  manifest.version,
  'store package should preserve the source manifest version'
);

const {
  assertNoDuplicateTopLevelDeclarations,
  bundlePageScripts,
  findDuplicateTopLevelDeclarations
} = require('./helpers/page-script-bundles');

function getReferenceBase(page, html) {
  const baseMatch = html.match(/<base\s+[^>]*href=["']([^"']+)["']/i);
  return path.posix.normalize(path.posix.join(path.posix.dirname(page), baseMatch ? baseMatch[1] : ''));
}

function listScriptTags(html) {
  return [...html.matchAll(/<script\b([^>]*)>\s*<\/script>/g)].map((match) => ({
    tag: match[0],
    src: (match[1].match(/\bsrc=["']([^"']+)["']/) || [])[1] || ''
  }));
}

const bootstrapTagPattern = /<script\s+src="\.\.\/shared\/react-page-bootstrap\.js"[^>]*><\/script>/;
const debugSurfaceLinePattern = /^[ \t]*<script\s+src=["']\.\.\/shared\/codex-debug-surface\.js["']\s*><\/script>\s*\r?\n/gm;
[
  'newtab.html',
  'src/options/options.html',
  'src/onboarding/onboarding.html'
].forEach((page) => {
  const sourceHtml = fs.readFileSync(path.join(repoRoot, page), 'utf8').replace(debugSurfaceLinePattern, '');
  const packagedHtml = readPackagedText(page);
  const base = getReferenceBase(page, sourceHtml);
  const resolve = (src) => path.posix.normalize(path.posix.join(base, src));
  const sourceScripts = listScriptTags(sourceHtml).map((script) => resolve(script.src));
  const packagedTags = listScriptTags(packagedHtml);
  const bundleTags = packagedTags.filter((script) => /-bundle-\d+\.js$/.test(script.src));
  assert(bundleTags.length > 0, `${page} should load at least one script bundle in the store package`);
  assert(
    packagedTags.length < sourceScripts.length,
    `${page} should load fewer script files in the store package than in development`
  );

  // Expanding every bundle back into its files should give the development
  // script order exactly, and each bundle should be its files joined in order.
  const expandedScripts = packagedTags.flatMap((script) => {
    if (!bundleTags.includes(script)) {
      return [resolve(script.src)];
    }
    const bundlePath = resolve(script.src);
    assert(entries.includes(bundlePath), `${page} bundle ${bundlePath} should be in the store package`);
    const bundleSource = readPackagedText(bundlePath);
    const files = [...bundleSource.matchAll(/^\/\/# (src\/\S+\.js)$/gm)].map((match) => match[1]);
    assert(files.length > 1, `${bundlePath} should join more than one script`);
    const joined = `${files.map((file) => `//# ${file}\n${readPackagedText(file)}`).join('\n;\n')}\n`;
    assert.strictEqual(bundleSource, joined, `${bundlePath} should be its scripts joined in page order`);
    return files;
  });
  assert.deepStrictEqual(expandedScripts, sourceScripts, `${page} bundles should keep the development script order`);

  const sourceBootstrap = sourceHtml.match(bootstrapTagPattern);
  assert(sourceBootstrap, `${page} should load the React page bootstrap in development`);
  const packagedBootstrap = packagedHtml.match(bootstrapTagPattern);
  assert(packagedBootstrap, `${page} should keep its own React page bootstrap tag in the store package`);
  assert.strictEqual(
    packagedBootstrap[0],
    sourceBootstrap[0],
    `${page} should keep the React page bootstrap tag and its data attributes unchanged`
  );
  assert(/data-react-entry="[^"]+"/.test(packagedBootstrap[0]) && /data-page-entry="[^"]+"/.test(packagedBootstrap[0]),
    `${page} bootstrap should keep the data attributes it reads through document.currentScript`);
});
assert(
  /<body\b[^>]*>\s*<script src="wallpaper-effect-preload\.js"><\/script>/.test(readPackagedText('newtab.html')),
  'store newtab.html should keep the wallpaper effect preload as the first body script'
);

assert.deepStrictEqual(
  findDuplicateTopLevelDeclarations([
    { path: 'a.js', source: 'var shared = 1;\nfunction onlyA() {}\n' },
    { path: 'b.js', source: 'var shared = 2;\n(function () { const onlyA = 1; })();\n' }
  ]),
  [],
  'repeated var and nested names should not count as duplicate top-level declarations'
);
[
  ['const', 'const value = 1;', 'let value = 2;'],
  ['class', 'class Panel {}', 'const Panel = null;'],
  ['function', 'function render() {}', 'function render() {}'],
  ['destructured', 'const { value } = globalThis;', 'var value;']
].forEach(([label, first, second]) => {
  assert.throws(
    () => assertNoDuplicateTopLevelDeclarations([
      { path: 'src/first.js', source: first },
      { path: 'src/second.js', source: second }
    ], 'test bundle'),
    (error) => /src\/first\.js/.test(error.message) && /src\/second\.js/.test(error.message),
    `duplicate ${label} declarations should fail the bundle and name both files`
  );
});
const fakeScripts = {
  'one.js': 'const one = 1;',
  'two.js': 'const one = 2;',
  'strict.js': "'use strict';\nwindow.strict = true;",
  'three.js': 'window.three = 3;',
  'four.js': 'window.four = 4;'
};
const fakeBundle = (html) => bundlePageScripts({
  html,
  label: 'test.html',
  resolveScript: (src) => ({ path: src, source: fakeScripts[src] }),
  bundleTarget: (index) => ({ src: `test-bundle-${index}.js`, path: `test-bundle-${index}.js` })
});
assert.throws(
  () => fakeBundle('<script src="one.js"></script>\n<script src="two.js"></script>\n'),
  /declare the same top-level name[\s\S]*- one: const in one\.js, const in two\.js/,
  'the package should fail when a script run declares the same top-level const twice'
);
const strictSplit = fakeBundle([
  '  <script src="one.js"></script>',
  '  <script src="three.js"></script>',
  '  <script src="strict.js"></script>',
  '  <script src="four.js"></script>',
  '  <div></div>',
  ''
].join('\n'));
assert.strictEqual(
  strictSplit.html,
  '  <script src="test-bundle-1.js"></script>\n  <script src="strict.js"></script>\n  <script src="four.js"></script>\n  <div></div>\n',
  'a "use strict" file should stay separate and split its run; single leftovers keep their own tag'
);
assert.deepStrictEqual(strictSplit.bundles.map((bundle) => bundle.files), [['one.js', 'three.js']]);
assert.strictEqual(strictSplit.bundles[0].source, '//# one.js\nconst one = 1;\n;\n//# three.js\nwindow.three = 3;\n');

console.log('package store tests passed');
