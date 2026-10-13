const assert = require('assert');

// Slices `function name(...) { ... }` (with a leading `async`, if any) out of
// a source file by counting braces from the body's opening `{`. Tests use
// it to exercise one function from inside a page IIFE that does not export it.
// It does not understand strings or comments, so a brace inside either one in
// the function body throws the count off; keep it to plain functions.
function extractFunction(source, name) {
  let start = source.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `missing function ${name}`);
  if (source.slice(start - 6, start) === 'async ') {
    start -= 6;
  }
  // Skip the parameter list first so a default like `options = {}` is not
  // mistaken for the body.
  let paramsEnd = source.indexOf('(', start);
  for (let parens = 0; paramsEnd < source.length; paramsEnd += 1) {
    if (source[paramsEnd] === '(') parens += 1;
    if (source[paramsEnd] === ')' && --parens === 0) break;
  }
  const openBrace = source.indexOf('{', paramsEnd);
  assert.notStrictEqual(openBrace, -1, `missing opening brace for ${name}`);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error(`unterminated function ${name}`);
}

module.exports = { extractFunction };
