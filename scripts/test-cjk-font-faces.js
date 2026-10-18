const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');
const modulePath = path.join(repoRoot, 'src/shared/cjk-font-faces.js');
const CJK = require(modulePath);

// The CJK face only composes with Open Sans when its weight band matches one of
// the Open Sans faces exactly, on pages and in the overlay alike.
const openSansCss = fs.readFileSync(path.join(repoRoot, 'assets/fonts/open-sans/open-sans.css'), 'utf8');
const pageBands = [...openSansCss.matchAll(/font-weight:\s*([\d ]+);/g)].map((match) => match[1].trim());
assert.deepStrictEqual(pageBands, ['300 549', '550 649', '650 800']);
assert.ok(pageBands.includes(CJK.FONT_WEIGHT_BAND));
const overlaySource = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
assert.ok(overlaySource.includes(`['${pageBands.join("', '")}']`),
  'the overlay must declare "Lumno Open Sans" in the same weight bands as open-sans.css');

const cases = [
  ['zh-CN', 'PingFangSC-Medium'],
  ['zh', 'PingFangSC-Medium'],
  ['zh-TW', 'PingFangTC-Medium'],
  ['zh-Hant-HK', 'PingFangTC-Medium'],
  ['ja', 'HiraginoSans-W5']
];
cases.forEach(([lang, face]) => {
  const css = CJK.buildFontFaceCss('Open Sans', lang);
  assert.ok(css.includes(`local("${face}")`), `${lang} should use ${face}`);
  assert.ok(css.includes(`font-weight: ${CJK.FONT_WEIGHT_BAND};`));
  assert.ok(/unicode-range: [^;]*U\+4E00-9FFF/.test(css));
});
assert.strictEqual(CJK.buildFontFaceCss('Open Sans', 'en'), '');
assert.strictEqual(CJK.buildFontFaceCss('Open Sans', ''), '');
assert.strictEqual(CJK.buildFontFaceCss('', 'zh-CN'), '');

// install() writes one style, rewrites it on a language change and removes it
// for languages without a CJK face.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
const { document } = dom.window;
const styleId = 'cjk-test-style';
CJK.install(document, { family: 'Lumno Open Sans', lang: 'zh-CN', styleId });
assert.ok(document.getElementById(styleId).textContent.includes('PingFangSC-Medium'));
CJK.install(document, { family: 'Lumno Open Sans', lang: 'ja', styleId });
assert.strictEqual(document.querySelectorAll(`#${styleId}`).length, 1);
assert.ok(document.getElementById(styleId).textContent.includes('HiraginoSans-W5'));
CJK.install(document, { family: 'Lumno Open Sans', lang: 'en', styleId });
assert.strictEqual(document.getElementById(styleId), null);

// A page script tag with data-font-family follows <html lang>.
(async () => {
  const page = new JSDOM(
    '<!doctype html><html lang="zh-CN"><head></head><body></body></html>',
    { runScripts: 'outside-only' }
  );
  const script = page.window.document.createElement('script');
  script.dataset.fontFamily = 'Open Sans';
  Object.defineProperty(page.window.document, 'currentScript', { value: script, configurable: true });
  page.window.eval(fs.readFileSync(modulePath, 'utf8'));
  const readFace = () => {
    const style = page.window.document.getElementById('_x_extension_cjk_font_faces_2026_unique_');
    return style ? style.textContent : '';
  };
  assert.ok(readFace().includes('PingFangSC-Medium'));
  page.window.document.documentElement.lang = 'zh-TW';
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(readFace().includes('PingFangTC-Medium'));
  page.window.document.documentElement.lang = 'en';
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.strictEqual(readFace(), '');
  console.log('cjk font face tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
