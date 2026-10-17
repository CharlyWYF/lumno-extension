const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/newtab/wallpaper-adaptive-tone.js', 'utf8'), sandbox);
const { getGlassAdaptation } = sandbox.LumnoNewtabWallpaperAdaptiveTone;

const grey = (value) => ({ red: value, green: value, blue: value });

// Light theme: bright calm wallpaper keeps dark ink on the thinnest tint.
const bright = getGlassAdaptation(0.9, 0.04, grey(230), 'light');
assert.strictEqual(bright.ink, 'dark');
assert(bright.density < 0.15, `bright calm patch stays thin (${bright.density})`);
// A mid-tone or busy patch still under dark ink needs more tint for contrast.
const midTone = getGlassAdaptation(0.55, 0.04, grey(140), 'light');
assert.strictEqual(midTone.ink, 'dark');
assert(midTone.density > bright.density + 0.3, 'a mid-tone patch thickens dark-ink glass');
const busy = getGlassAdaptation(0.85, 0.6, grey(200), 'light');
assert(busy.density > bright.density + 0.3, 'a busy patch thickens it too');

// A dark patch flips to light ink on a thin tint: dark wallpaper stays see-through.
const dark = getGlassAdaptation(0.12, 0.04, grey(30), 'light');
assert.strictEqual(dark.ink, 'light');
assert(dark.density < 0.15, `dark calm patch stays thin (${dark.density})`);
const darkBusy = getGlassAdaptation(0.25, 0.5, grey(60), 'light');
assert.strictEqual(darkBusy.ink, 'light');
assert(darkBusy.density > dark.density + 0.3, 'a busy dark patch thickens light-ink glass');

// Hysteresis: between the thresholds a plate keeps the ink it has.
assert.strictEqual(getGlassAdaptation(0.45, 0.1, grey(115), 'light', 'light').ink, 'light');
assert.strictEqual(getGlassAdaptation(0.45, 0.1, grey(115), 'light', 'dark').ink, 'dark');

// The dark theme always reads light; a bright patch thickens it.
const darkThemeBright = getGlassAdaptation(0.9, 0.04, grey(230), 'dark');
const darkThemeDark = getGlassAdaptation(0.12, 0.04, grey(30), 'dark');
assert.strictEqual(darkThemeBright.ink, 'light');
assert(darkThemeBright.density > darkThemeDark.density + 0.4);

// A vivid patch keeps less of the saturation boost; a neutral one keeps all of it.
const vivid = getGlassAdaptation(0.45, 0.1, { red: 20, green: 90, blue: 220 }, 'light');
assert.strictEqual(bright.saturate, 1);
assert(vivid.saturate < 0.6 && vivid.saturate >= 0.45, `vivid patch drops its boost (${vivid.saturate})`);

for (const result of [bright, midTone, busy, dark, darkBusy, darkThemeBright, darkThemeDark, vivid]) {
  assert(result.density >= 0 && result.density <= 1);
  assert(result.saturate >= 0.45 && result.saturate <= 1);
}
// A row shares its ink: a dark patch inside a bright row keeps dark ink and thickens instead.
const inBrightRow = getGlassAdaptation(0.2, 0.05, grey(50), 'light', null, 0.7);
assert.strictEqual(inBrightRow.ink, 'dark');
assert(inBrightRow.density > 0.5, `dark patch under dark ink gets a dense tint (${inBrightRow.density})`);
const inDarkRow = getGlassAdaptation(0.85, 0.05, grey(220), 'light', null, 0.2);
assert.strictEqual(inDarkRow.ink, 'light');
assert(inDarkRow.density > 0.5, 'a bright patch under light ink gets a dense dark tint');
console.log('glass adaptation tests passed');
