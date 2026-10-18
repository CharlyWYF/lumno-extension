const assert = require('assert');

require('../src/newtab/wallpaper-adaptive-tone.js');

const {
  chooseReadableInk,
  getAdaptiveInkTones,
  getWordmarkInkColor,
  getContrastRatio,
  getTranslucentToneContrast
} = globalThis.LumnoNewtabWallpaperAdaptiveTone;

function gray(level) {
  return { red: level, green: level, blue: level };
}

// Rec. 601 luminance, the scale the sampler hands to the tone functions.
function sampledLuminance(color) {
  return ((color.red * 0.299) + (color.green * 0.587) + (color.blue * 0.114)) / 255;
}

// What the reader sees: the tone blended over the background it is drawn on.
function blendedContrast(tone, background) {
  return getTranslucentToneContrast(tone, background);
}

// Either family can come out of the hysteresis band (0.5 to 0.62), so start
// from each; chooseReadableInk settles the family the tones are drawn in.
const midGrays = [102, 115, 128, 140, 150, 158, 166];
midGrays.forEach((level) => {
  const background = gray(level);
  const luminance = sampledLuminance(background);
  ['light', 'dark'].forEach((startInk) => {
    const ink = chooseReadableInk(startInk, luminance, background, 'none');
    const tones = getAdaptiveInkTones(luminance, ink, background, 'none');
    const inkContrast = blendedContrast(tones.ink, background);
    const mutedContrast = blendedContrast(tones.muted, background);
    const bestPossible = Math.max(
      getContrastRatio({ red: 248, green: 250, blue: 252 }, background),
      getContrastRatio({ red: 15, green: 23, blue: 42 }, background)
    );
    assert.ok(
      inkContrast >= Math.min(4.5, bestPossible) - 0.05,
      `${ink} ink on gray ${level} should reach 4.5:1 (or the best either extreme allows), got ${inkContrast.toFixed(2)}`
    );
    assert.ok(
      mutedContrast >= 3 - 0.05,
      `${ink} muted ink on gray ${level} should reach 3:1, got ${mutedContrast.toFixed(2)}`
    );
  });
});

// The old fixed interpolation gave light ink on a 0.6 gray roughly 1.6:1.
// Light ink cannot reach the floor there even opaque, so the whole family turns
// dark; tones never leave the family they are given.
{
  const background = gray(150);
  const luminance = sampledLuminance(background);
  assert.strictEqual(chooseReadableInk('light', luminance, background, 'none'), 'dark');
  const tones = getAdaptiveInkTones(luminance, 'dark', background, 'none');
  assert.ok(blendedContrast(tones.ink, background) >= 4.45);
  const lightTones = getAdaptiveInkTones(luminance, 'light', background, 'none');
  assert.ok(lightTones.ink.color.red > 200, 'light ink stays light even when it falls short');
}

// A family that already reads is kept, so clearly light or dark wallpapers do not change.
assert.strictEqual(chooseReadableInk('light', sampledLuminance(gray(30)), gray(30), 'none'), 'light');
assert.strictEqual(chooseReadableInk('dark', sampledLuminance(gray(230)), gray(230), 'none'), 'dark');

// Tones that already read keep their color and translucency.
{
  const background = gray(20);
  const tones = getAdaptiveInkTones(sampledLuminance(background), 'light', background, 'none');
  assert.ok(tones.ink.alpha < 1, 'light ink on a dark wallpaper should stay translucent');
  assert.ok(tones.muted.alpha < 1, 'muted ink on a dark wallpaper should stay translucent');
  assert.ok(blendedContrast(tones.ink, background) >= 4.5);
}
{
  const background = gray(240);
  const tones = getAdaptiveInkTones(sampledLuminance(background), 'dark', background, 'none');
  assert.ok(tones.ink.alpha < 1, 'dark ink on a bright wallpaper should stay translucent');
  assert.ok(blendedContrast(tones.ink, background) >= 4.5);
}

// Translucency counts against contrast: the same color reads worse when the wallpaper shows through.
{
  const background = gray(128);
  const opaque = blendedContrast({ color: gray(20), alpha: 1 }, background);
  const translucent = blendedContrast({ color: gray(20), alpha: 0.5 }, background);
  assert.ok(translucent < opaque);
}

// A filter repaints the wallpaper, so its luminance, not the sampled hue, is the background.
{
  const saturated = { red: 220, green: 40, blue: 40 };
  const ink = chooseReadableInk('dark', 0.5, saturated, 'dither');
  const tones = getAdaptiveInkTones(0.5, ink, saturated, 'dither');
  assert.ok(blendedContrast(tones.ink, gray(Math.round(0.5 * 255))) >= 4.45);
}

// The wordmark and clock ink keeps the wallpaper's hue at a decisive
// lightness: never the washed grey that sat right at a 3.25:1 floor.
function wordmarkInk(color, ink, effectType = 'none', textureContrast = 0.05) {
  return getWordmarkInkColor(color, sampledLuminance(color), ink, 0, 0, textureContrast, effectType);
}
const paleSky = { red: 200, green: 214, blue: 228 };
const paleSkyInk = wordmarkInk(paleSky, 'dark');
assert.ok(getContrastRatio(paleSkyInk, paleSky) >= 5.5, 'dark wordmark ink clears 5.5:1');
assert.ok(paleSkyInk.blue > paleSkyInk.red, 'dark wordmark ink keeps the sky blue hue');
const cream = { red: 236, green: 226, blue: 206 };
const creamInk = wordmarkInk(cream, 'dark');
assert.ok(creamInk.red > creamInk.blue, 'dark wordmark ink keeps a warm wallpaper warm');
const navy = { red: 22, green: 30, blue: 52 };
const navyInk = wordmarkInk(navy, 'light');
assert.ok(Math.min(navyInk.red, navyInk.green, navyInk.blue) >= 230, 'light wordmark ink is a near white, not a mid grey');
assert.ok(getContrastRatio(navyInk, navy) >= 4.5);
const busy = { red: 210, green: 214, blue: 220 };
assert.ok(
  getContrastRatio(wordmarkInk(busy, 'dark', 'dither'), gray(Math.round(sampledLuminance(busy) * 255))) >= 7,
  'busy textures raise the dark ink floor'
);
// Mid tones that no lightness can lift to the floor take the extreme.
const midGreen = { red: 104, green: 132, blue: 88 };
const midGreenInk = wordmarkInk(midGreen, 'dark');
assert.ok(Math.max(midGreenInk.red, midGreenInk.green, midGreenInk.blue) < 40);
// A fully covered wallpaper keeps the plain off-wallpaper wordmark color.
assert.deepStrictEqual(
  { ...getWordmarkInkColor(paleSky, 0.8, 'dark', 1, 0.9, 0, 'none') },
  { red: 242, green: 242, blue: 242 }
);

console.log('new tab wallpaper adaptive ink contrast tests passed');
