'use strict';

// Store-package helpers that join runs of plain classic <script src> tags into
// one file per run. Classic scripts already share one global scope, so a run
// behaves the same joined, as long as no two files declare the same top-level
// name (that would be one SyntaxError for the whole run) and no file relies on
// its own "use strict" directive (only a bundle's first file could keep one).

const vm = require('vm');

const PLAIN_SCRIPT_LINE = /^([ \t]*)<script\s+src=(["'])([^"']+)\2\s*><\/script>[ \t]*$/;
const BUNDLE_SEPARATOR = '\n;\n';
// Pages read these through document.currentScript or need their own position.
const UNBUNDLED_SCRIPT_NAMES = new Set([
  'react-page-bootstrap.js',
  'wallpaper-effect-preload.js'
]);

function isBundleableSrc(src) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')) {
    return false;
  }
  const name = src.split(/[?#]/)[0].split('/').pop();
  return !UNBUNDLED_SCRIPT_NAMES.has(name);
}

// Returns each run of two or more consecutive plain script lines, with the
// character range the run covers in `html` (whole lines, including the last
// line break) and the src values in order.
function findPlainScriptRuns(html) {
  const runs = [];
  const linePattern = /[^\n]*(?:\n|$)/g;
  let current = null;
  let match = null;
  const closeRun = () => {
    if (current && current.srcs.length > 1) {
      runs.push(current);
    }
    current = null;
  };
  while ((match = linePattern.exec(html)) && match[0]) {
    const line = match[0].replace(/\r?\n$/, '');
    const tag = line.match(PLAIN_SCRIPT_LINE);
    if (!tag || !isBundleableSrc(tag[3])) {
      closeRun();
      continue;
    }
    if (!current) {
      current = { start: match.index, end: match.index, indent: tag[1], srcs: [] };
    }
    current.srcs.push(tag[3]);
    current.end = match.index + match[0].length;
  }
  closeRun();
  return runs;
}

function stripBom(source) {
  return source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
}

function loadTypeScript() {
  try {
    return require('typescript');
  } catch (error) {
    throw new Error('Store package script bundling needs the typescript dev dependency; run npm install.');
  }
}

function parseScript(source, file) {
  const ts = loadTypeScript();
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
}

function hasUseStrictDirective(source, file = 'script.js') {
  const ts = loadTypeScript();
  for (const statement of parseScript(stripBom(source), file).statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
      return false;
    }
    if (statement.expression.text === 'use strict') {
      return true;
    }
  }
  return false;
}

function collectBindingNames(ts, nameNode, names) {
  if (ts.isIdentifier(nameNode)) {
    names.push(nameNode.text);
    return;
  }
  nameNode.elements.forEach((element) => {
    if (!ts.isOmittedExpression(element)) {
      collectBindingNames(ts, element.name, names);
    }
  });
}

// Top-level names a classic script adds to the shared global scope.
function getTopLevelDeclarations(source, file = 'script.js') {
  const ts = loadTypeScript();
  const declarations = [];
  parseScript(stripBom(source), file).statements.forEach((statement) => {
    if (ts.isVariableStatement(statement)) {
      const flags = statement.declarationList.flags;
      const kind = flags & ts.NodeFlags.Const
        ? 'const'
        : flags & ts.NodeFlags.Let ? 'let' : 'var';
      statement.declarationList.declarations.forEach((declaration) => {
        const names = [];
        collectBindingNames(ts, declaration.name, names);
        names.forEach((name) => declarations.push({ name, kind }));
      });
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      declarations.push({ name: statement.name.text, kind: 'function' });
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      declarations.push({ name: statement.name.text, kind: 'class' });
    }
  });
  return declarations;
}

// `files` is [{ path, source }]. Repeated `var` is harmless; any other repeat
// either breaks the joined bundle or changes which function wins hoisting.
function findDuplicateTopLevelDeclarations(files) {
  const byName = new Map();
  files.forEach((file) => {
    getTopLevelDeclarations(file.source, file.path).forEach(({ name, kind }) => {
      if (!byName.has(name)) {
        byName.set(name, []);
      }
      const owners = byName.get(name);
      if (!owners.some((owner) => owner.path === file.path && owner.kind === kind)) {
        owners.push({ path: file.path, kind });
      }
    });
  });
  const duplicates = [];
  byName.forEach((owners, name) => {
    const paths = new Set(owners.map((owner) => owner.path));
    if (paths.size > 1 && owners.some((owner) => owner.kind !== 'var')) {
      duplicates.push({ name, owners });
    }
  });
  return duplicates;
}

function assertNoDuplicateTopLevelDeclarations(files, label = 'script bundle') {
  const duplicates = findDuplicateTopLevelDeclarations(files);
  if (duplicates.length === 0) {
    return;
  }
  const details = duplicates.map(({ name, owners }) => (
    `- ${name}: ${owners.map((owner) => `${owner.kind} in ${owner.path}`).join(', ')}`
  ));
  throw new Error(`${label} would declare the same top-level name in more than one file:\n${details.join('\n')}`);
}

function joinBundleSources(files) {
  return `${files.map((file) => `//# ${file.path}\n${stripBom(file.source)}`).join(BUNDLE_SEPARATOR)}\n`;
}

// Joins `files` into one bundle source after checking each file on its own,
// the declarations across files, and the joined result.
function buildScriptBundle(files, label = 'script bundle') {
  files.forEach((file) => {
    try {
      new vm.Script(stripBom(file.source), { filename: file.path });
    } catch (error) {
      throw new Error(`${label}: ${file.path} does not parse as a classic script: ${error.message}`);
    }
    if (hasUseStrictDirective(file.source, file.path)) {
      throw new Error(`${label}: ${file.path} has a top-level "use strict" directive and cannot be joined.`);
    }
  });
  assertNoDuplicateTopLevelDeclarations(files, label);
  const source = joinBundleSources(files);
  try {
    new vm.Script(source, { filename: label });
  } catch (error) {
    throw new Error(`${label} does not parse after joining: ${error.message}`);
  }
  return source;
}

// Rewrites `html` so each run of plain script tags loads one bundle.
// `resolveScript(src)` returns { path, source } for a tag's file, and
// `bundleTarget(index)` returns { src, path } for the n-th bundle (from 1).
// Files with their own "use strict" directive stay as separate tags and split
// the run around them; a piece left with a single file keeps its tag as is.
function bundlePageScripts({ html, label, resolveScript, bundleTarget }) {
  const bundles = [];
  let nextHtml = '';
  let cursor = 0;
  findPlainScriptRuns(html).forEach((run) => {
    const lines = [];
    let pending = [];
    const tagLine = (src) => `${run.indent}<script src="${src}"></script>\n`;
    const flush = () => {
      if (pending.length > 1) {
        const target = bundleTarget(bundles.length + 1);
        const bundleLabel = `${label} bundle ${target.path}`;
        bundles.push({
          path: target.path,
          files: pending.map((entry) => entry.file.path),
          source: buildScriptBundle(pending.map((entry) => entry.file), bundleLabel)
        });
        lines.push(tagLine(target.src));
      } else {
        pending.forEach((entry) => lines.push(tagLine(entry.src)));
      }
      pending = [];
    };
    run.srcs.forEach((src) => {
      const file = resolveScript(src);
      if (hasUseStrictDirective(file.source, file.path)) {
        flush();
        lines.push(tagLine(src));
        return;
      }
      pending.push({ src, file });
    });
    flush();
    const runHtml = html.slice(run.start, run.end);
    if (!/\n$/.test(runHtml)) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/\n$/, '');
    }
    nextHtml += html.slice(cursor, run.start) + lines.join('');
    cursor = run.end;
  });
  nextHtml += html.slice(cursor);
  return { html: nextHtml, bundles };
}

module.exports = {
  BUNDLE_SEPARATOR,
  assertNoDuplicateTopLevelDeclarations,
  buildScriptBundle,
  bundlePageScripts,
  findDuplicateTopLevelDeclarations,
  findPlainScriptRuns,
  getTopLevelDeclarations,
  hasUseStrictDirective,
  joinBundleSources
};
