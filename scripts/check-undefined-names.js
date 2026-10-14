// Fails when extension source refers to a name that exists nowhere: a call to
// a deleted helper, or a shorthand property (`{ removedFn }`) left in an
// object literal. node --check accepts both, and they only throw when the
// line runs, which for page bootstrap code means a blank New Tab.
//
// The TypeScript checker resolves names across every classic script in src/
// as one global scope, plus browser and worker globals. Pages publish their
// modules as globals with `root.Name = api` (or globalThis/window/self), so
// those names are declared for it too. Only unresolved-name diagnostics are
// reported; type errors are not this script's concern.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repoRoot, 'src');
const excludedDirectories = new Set(['react', 'vendor']);
const UNRESOLVED_NAME_CODES = new Set([
  2304, // Cannot find name 'x'.
  2552, // Cannot find name 'x'. Did you mean 'y'?
  2582, // Cannot find name 'x' (test runner globals).
  18004 // No value exists in scope for the shorthand property 'x'.
]);

function collectJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return excludedDirectories.has(entry.name) ? [] : collectJavaScriptFiles(filePath);
      }
      return entry.isFile() && entry.name.endsWith('.js') ? [filePath] : [];
    });
}

function collectPublishedGlobals(files) {
  const names = new Set();
  const pattern = /\b(?:root|globalThis|window|self)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;
  files.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      names.add(match[1]);
    }
  });
  return names;
}

function buildAmbientDeclarations(publishedGlobals) {
  const lines = [
    'declare const chrome: any;',
    'declare const browser: any;',
    'declare function importScripts(...urls: string[]): void;',
    'declare const module: any;',
    'declare function require(id: string): any;'
  ];
  publishedGlobals.forEach((name) => {
    lines.push(`declare var ${name}: any;`);
  });
  return `${lines.join('\n')}\n`;
}

function checkUndefinedNames(files) {
  const ambientPath = path.join(repoRoot, '__lumno_ambient_globals__.d.ts');
  const ambientSource = buildAmbientDeclarations(collectPublishedGlobals(files));
  const options = {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.webworker.importscripts.d.ts'],
    types: []
  };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.readFile = (fileName) => (fileName === ambientPath ? ambientSource : readFile(fileName));
  host.fileExists = (fileName) => fileName === ambientPath || fileExists(fileName);
  host.getSourceFile = (fileName, languageVersion, ...rest) => (fileName === ambientPath
    ? ts.createSourceFile(fileName, ambientSource, languageVersion)
    : getSourceFile(fileName, languageVersion, ...rest));
  const program = ts.createProgram([...files, ambientPath], options, host);
  return ts.getPreEmitDiagnostics(program)
    .filter((diagnostic) => UNRESOLVED_NAME_CODES.has(diagnostic.code) && diagnostic.file)
    .map((diagnostic) => {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
      return `${path.relative(repoRoot, diagnostic.file.fileName)}:${line + 1}:${character + 1} ${message}`;
    });
}

if (require.main === module) {
  const files = collectJavaScriptFiles(sourceRoot).sort();
  const problems = checkUndefinedNames(files);
  if (problems.length) {
    process.stderr.write(`${problems.join('\n')}\n`);
    process.stderr.write(`\n${problems.length} unresolved name(s) in extension source.\n`);
    process.exit(1);
  }
  console.log(`No unresolved names (${files.length} files).`);
}

module.exports = { checkUndefinedNames, collectPublishedGlobals };
