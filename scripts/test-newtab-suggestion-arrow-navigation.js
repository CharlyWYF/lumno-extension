// Arrow keys in the New Tab search box move the highlighted suggestion one
// step and wrap; with nothing selected the step starts from the suggestion
// highlighted automatically.
const assert = require('assert');
const path = require('path');

const { getNextSuggestionIndex } = require(path.join(__dirname, '..', 'src', 'newtab', 'search-navigation.js'));
const DOWN = 1;
const UP = -1;

// Down from a selection moves on and wraps from the last to the first.
assert.deepStrictEqual(getNextSuggestionIndex(DOWN, 0, 3, -1), { index: 1, didWrap: false });
assert.deepStrictEqual(getNextSuggestionIndex(DOWN, 2, 3, -1), { index: 0, didWrap: true });

// Down with nothing selected starts after the automatic highlight, or at
// the top without one.
assert.deepStrictEqual(getNextSuggestionIndex(DOWN, -1, 3, -1), { index: 0, didWrap: false });
assert.deepStrictEqual(getNextSuggestionIndex(DOWN, -1, 3, 0), { index: 1, didWrap: false });
assert.deepStrictEqual(getNextSuggestionIndex(DOWN, -1, 3, 2), { index: 0, didWrap: true });

// Up moves back and wraps from the first to the last.
assert.deepStrictEqual(getNextSuggestionIndex(UP, 2, 3, -1), { index: 1, didWrap: false });
assert.deepStrictEqual(getNextSuggestionIndex(UP, 0, 3, -1), { index: 2, didWrap: true });

// Up with nothing selected starts before the automatic highlight; from the
// top highlight, or without one, it goes to the last.
assert.deepStrictEqual(getNextSuggestionIndex(UP, -1, 3, 2), { index: 1, didWrap: false });
assert.deepStrictEqual(getNextSuggestionIndex(UP, -1, 3, 0), { index: 2, didWrap: true });
assert.deepStrictEqual(getNextSuggestionIndex(UP, -1, 3, -1), { index: 2, didWrap: true });

// A single suggestion stays put; an empty list selects nothing.
assert.deepStrictEqual(getNextSuggestionIndex(DOWN, 0, 1, -1), { index: 0, didWrap: true });
assert.deepStrictEqual(getNextSuggestionIndex(DOWN, -1, 0, -1), { index: -1, didWrap: false });

console.log('newtab suggestion arrow navigation tests passed');
