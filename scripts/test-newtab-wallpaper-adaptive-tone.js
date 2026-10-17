const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function createStyle() {
  const values = new Map();
  return {
    getPropertyValue(name) {
      return values.get(String(name)) || '';
    },
    setProperty(name, value) {
      values.set(String(name), String(value));
    },
    removeProperty(name) {
      values.delete(String(name));
    }
  };
}

function createElement(rect) {
  const attributes = new Map();
  return {
    style: createStyle(),
    getAttribute(name) {
      return attributes.has(String(name)) ? attributes.get(String(name)) : null;
    },
    setAttribute(name, value) {
      attributes.set(String(name), String(value));
    },
    removeAttribute(name) {
      attributes.delete(String(name));
    },
    getBoundingClientRect() {
      return rect || {
        left: 100,
        top: 100,
        right: 148,
        bottom: 148,
        width: 48,
        height: 48
      };
    }
  };
}

function createCanvas() {
  let drawnImage = null;
  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return {
        drawImage(image) {
          drawnImage = image;
        },
        getImageData() {
          const pixel = drawnImage && drawnImage.pixel
            ? drawnImage.pixel
            : { red: 128, green: 128, blue: 128 };
          const length = Math.max(1, canvas.width * canvas.height) * 4;
          const data = new Uint8ClampedArray(length);
          for (let index = 0; index < length; index += 4) {
            // A two-tone image is dark on its left half and bright on its right.
            const tone = drawnImage && drawnImage.leftPixel && ((index / 4) % canvas.width) < canvas.width / 2
              ? drawnImage.leftPixel
              : pixel;
            data[index] = tone.red;
            data[index + 1] = tone.green;
            data[index + 2] = tone.blue;
            data[index + 3] = 255;
          }
          return { data };
        }
      };
    }
  };
  return canvas;
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

function getCssRgbChannels(value) {
  const channels = String(value || '').match(/[\d.]+/g);
  return channels ? channels.slice(0, 3).map(Number) : [];
}

(async () => {
  const target = createElement();
  const body = createElement();
  body.setAttribute('data-wallpaper-active', 'true');
  const canvas = createCanvas();
  const pendingImages = [];
  const scheduledFrames = new Map();
  let nextFrameId = 0;
  let currentWallpaper = {
    id: 'dark-wallpaper',
    url: 'test://dark-wallpaper'
  };
  let overlayAlpha = 0;
  let overlayLuminance = 1;
  let preferOverlayPolarity = true;
  let extraTargets = [];

  class FakeImage {
    constructor() {
      this.width = 10;
      this.height = 10;
      this.naturalWidth = 10;
      this.naturalHeight = 10;
      this.onload = null;
      this.onerror = null;
      this.pixel = null;
      this.settled = false;
      pendingImages.push(this);
    }

    set src(value) {
      this._src = String(value);
    }

    get src() {
      return this._src;
    }

    decode() {
      return Promise.resolve();
    }

    resolve(pixel, leftPixel) {
      assert.strictEqual(this.settled, false, `image ${this.src} should settle once`);
      this.settled = true;
      this.pixel = pixel;
      this.leftPixel = leftPixel || null;
      this.onload();
    }

    reject() {
      assert.strictEqual(this.settled, false, `image ${this.src} should settle once`);
      this.settled = true;
      this.onerror();
    }
  }

  function getPendingImage(url) {
    const image = pendingImages.find((candidate) => candidate.src === url && !candidate.settled);
    assert.ok(image, `expected a pending image for ${url}`);
    return image;
  }

  const documentObj = {
    body,
    documentElement: {
      clientWidth: 1000,
      clientHeight: 600
    },
    createElement(tagName) {
      return String(tagName).toLowerCase() === 'canvas' ? canvas : createElement();
    }
  };
  const windowObj = {
    innerWidth: 1000,
    innerHeight: 600,
    requestAnimationFrame(callback) {
      const id = ++nextFrameId;
      scheduledFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      scheduledFrames.delete(id);
    }
  };
  const sandbox = {
    console,
    Image: FakeImage,
    Uint8ClampedArray,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(
    fs.readFileSync('src/newtab/wallpaper-adaptive-tone.js', 'utf8'),
    sandbox,
    { filename: 'src/newtab/wallpaper-adaptive-tone.js' }
  );

  const runtime = sandbox.LumnoNewtabWallpaperAdaptiveTone.createWallpaperAdaptiveTone({
    documentObj,
    windowObj,
    getTargets() {
      return [{
        element: target,
        sampleElement: target,
        minWidth: 42,
        minHeight: 42,
        iconButton: true,
        surface: 'topbar',
        preferOverlayPolarity
      }].concat(extraTargets);
    },
    getCurrentWallpaper() {
      return currentWallpaper;
    },
    getWallpaperImageUrl(wallpaper) {
      return wallpaper.url;
    },
    getOverlayAlphaAtViewportY() {
      return overlayAlpha;
    },
    getOverlayLuminance() {
      return overlayLuminance;
    },
    getEffectLuminanceAtViewport() {
      return null;
    },
    applyWordmarkThemeAppearance() {}
  });

  runtime.refresh();
  getPendingImage('test://dark-wallpaper').resolve({ red: 16, green: 24, blue: 32 });
  await flushAsyncWork();

  const darkInk = target.getAttribute('data-wallpaper-ink');
  const darkAdaptiveColor = target.style.getPropertyValue('--x-nt-wallpaper-adaptive-ink');
  const darkMistSurface = target.style.getPropertyValue('--x-nt-wallpaper-surface-mist');
  const darkClearSurface = target.style.getPropertyValue('--x-nt-wallpaper-surface-clear');
  assert.strictEqual(darkInk, 'light');
  assert.ok(darkAdaptiveColor, 'the initial wallpaper should apply an adaptive color');
  assert.ok(darkMistSurface, 'the topbar target should receive an adaptive mist surface');
  assert.ok(darkClearSurface, 'the topbar target should receive a protected clear surface');
  assert.notStrictEqual(
    darkMistSurface,
    darkClearSurface,
    'mist and clear surfaces should retain different opacity levels'
  );
  assert.strictEqual(scheduledFrames.size, 1, 'the initial apply should schedule a follow-up sample');

  currentWallpaper = {
    id: 'middle-wallpaper',
    url: 'test://middle-wallpaper'
  };
  runtime.refresh();

  assert.strictEqual(
    scheduledFrames.size,
    0,
    'starting a replacement sampler should cancel the stale scheduled apply'
  );
  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    darkInk,
    'the previous ink choice should remain while the replacement image is loading'
  );
  assert.strictEqual(
    target.style.getPropertyValue('--x-nt-wallpaper-adaptive-ink'),
    darkAdaptiveColor,
    'the previous adaptive color should remain while the replacement image is loading'
  );

  runtime.schedule();
  assert.strictEqual(
    scheduledFrames.size,
    0,
    'layout updates should not resample the previous image during a wallpaper transition'
  );

  const staleMiddleImage = getPendingImage('test://middle-wallpaper');
  currentWallpaper = {
    id: 'dark-wallpaper',
    url: 'test://dark-wallpaper'
  };
  runtime.refresh();

  assert.strictEqual(
    pendingImages.filter((image) => image.src === 'test://dark-wallpaper').length,
    1,
    'switching back should reuse the retained sampler instead of loading the previous wallpaper again'
  );
  assert.strictEqual(
    scheduledFrames.size,
    1,
    'switching back should resume sampling from the retained active wallpaper'
  );

  staleMiddleImage.resolve({ red: 150, green: 150, blue: 150 });
  await flushAsyncWork();
  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    darkInk,
    'a canceled replacement load should not overwrite the restored active wallpaper'
  );

  currentWallpaper = {
    id: 'middle-wallpaper',
    url: 'test://middle-wallpaper'
  };
  runtime.refresh();
  getPendingImage('test://middle-wallpaper').resolve({ red: 150, green: 150, blue: 150 });
  await flushAsyncWork();

  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    'dark',
    'a replacement wallpaper should choose fresh ink instead of inheriting the previous wallpaper hysteresis'
  );
  assert.notStrictEqual(
    target.style.getPropertyValue('--x-nt-wallpaper-adaptive-ink'),
    darkAdaptiveColor,
    'the replacement sampler should overwrite the retained adaptive color'
  );
  assert.notStrictEqual(
    target.style.getPropertyValue('--x-nt-wallpaper-surface-mist'),
    darkMistSurface,
    'the replacement sampler should retint the topbar material'
  );

  currentWallpaper = {
    id: 'failed-wallpaper',
    url: 'test://failed-wallpaper'
  };
  runtime.refresh();
  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    'dark',
    'a pending image should retain the last valid tone even if it will later fail'
  );

  getPendingImage('test://failed-wallpaper').reject();
  await flushAsyncWork();

  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    null,
    'a current wallpaper load failure should clear the retained tone'
  );
  assert.strictEqual(
    target.style.getPropertyValue('--x-nt-wallpaper-adaptive-ink'),
    '',
    'a current wallpaper load failure should restore the theme fallback'
  );
  assert.strictEqual(
    target.style.getPropertyValue('--x-nt-wallpaper-surface-mist'),
    '',
    'a current wallpaper load failure should clear the sampled topbar material'
  );

  body.setAttribute('data-theme', 'dark');
  overlayAlpha = 0.44;
  overlayLuminance = 0;
  currentWallpaper = {
    id: 'bright-wallpaper-with-dark-mask',
    url: 'test://bright-wallpaper-with-dark-mask'
  };
  runtime.refresh();
  getPendingImage('test://bright-wallpaper-with-dark-mask').resolve({
    red: 255,
    green: 255,
    blue: 255
  });
  await flushAsyncWork();

  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    'light',
    'a meaningful black mask should keep the default topbar in the dark-material family'
  );
  const maskedDarkSurfaceChannels = getCssRgbChannels(
    target.style.getPropertyValue('--x-nt-wallpaper-surface-mist')
  );
  assert.strictEqual(maskedDarkSurfaceChannels.length, 3);
  assert.ok(
    Math.max(...maskedDarkSurfaceChannels) < 80,
    'a black mask over a bright wallpaper should produce a dark topbar surface for light text'
  );

  body.setAttribute('data-theme', 'light');
  overlayAlpha = 0.54;
  overlayLuminance = 1;
  currentWallpaper = {
    id: 'dark-wallpaper-with-light-mask',
    url: 'test://dark-wallpaper-with-light-mask'
  };
  runtime.refresh();
  getPendingImage('test://dark-wallpaper-with-light-mask').resolve({
    red: 0,
    green: 0,
    blue: 0
  });
  await flushAsyncWork();

  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    'dark',
    'a meaningful white mask should keep the default topbar in the light-material family'
  );
  const maskedLightSurfaceChannels = getCssRgbChannels(
    target.style.getPropertyValue('--x-nt-wallpaper-surface-mist')
  );
  assert.strictEqual(maskedLightSurfaceChannels.length, 3);
  assert.ok(
    Math.min(...maskedLightSurfaceChannels) > 200,
    'a white mask over a dark wallpaper should produce a light topbar surface for dark text'
  );

  preferOverlayPolarity = false;
  body.setAttribute('data-theme', 'dark');
  overlayAlpha = 0.44;
  overlayLuminance = 0;
  currentWallpaper = {
    id: 'bright-wallpaper-under-transparent-topbar',
    url: 'test://bright-wallpaper-under-transparent-topbar'
  };
  runtime.refresh();
  getPendingImage('test://bright-wallpaper-under-transparent-topbar').resolve({
    red: 255,
    green: 255,
    blue: 255
  });
  await flushAsyncWork();

  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    'dark',
    'a transparent topbar should keep choosing ink from the actually composited background'
  );

  preferOverlayPolarity = false;
  body.setAttribute('data-theme', 'light');
  body.setAttribute('data-wallpaper-effect', 'dither');
  overlayAlpha = 0;
  overlayLuminance = 1;
  currentWallpaper = {
    id: 'mid-tone-textured-wallpaper',
    url: 'test://mid-tone-textured-wallpaper'
  };
  runtime.refresh();
  getPendingImage('test://mid-tone-textured-wallpaper').resolve({
    red: 120,
    green: 120,
    blue: 120
  });
  await flushAsyncWork();

  assert.strictEqual(target.getAttribute('data-wallpaper-ink'), 'light');
  const midToneWordmarkInk = getCssRgbChannels(
    target.style.getPropertyValue('--x-nt-wallpaper-wordmark-ink')
  );
  assert.ok(
    Math.min(...midToneWordmarkInk) > 200,
    'a mid tone where neither extreme reaches the textured contrast floor should keep the light ink family'
  );
  assert.ok(
    target.style.getPropertyValue('--x-nt-wallpaper-wordmark-shadow').startsWith('rgb(15 23 42 /'),
    'light wordmark ink should be backed by a dark shadow'
  );
  assert.strictEqual(
    target.style.getPropertyValue('--x-nt-wallpaper-wordmark-halo'),
    'rgb(15 23 42 / 28%)',
    'a textured mid tone should get the full-strength halo'
  );
  assert.strictEqual(
    target.style.getPropertyValue('--x-nt-wallpaper-adaptive-shadow'),
    'rgb(15 23 42 / 42%)',
    'light ink at the threshold should not get the weakest shadow'
  );

  body.removeAttribute('data-wallpaper-effect');
  currentWallpaper = {
    id: 'calm-bright-wallpaper',
    url: 'test://calm-bright-wallpaper'
  };
  runtime.refresh();
  getPendingImage('test://calm-bright-wallpaper').resolve({
    red: 236,
    green: 238,
    blue: 240
  });
  await flushAsyncWork();

  assert.strictEqual(target.getAttribute('data-wallpaper-ink'), 'dark');
  const calmWordmarkInk = getCssRgbChannels(
    target.style.getPropertyValue('--x-nt-wallpaper-wordmark-ink')
  );
  assert.ok(Math.max(...calmWordmarkInk) < 160, 'a bright wallpaper should produce dark wordmark ink');
  const calmHaloAlpha = Number(
    (target.style.getPropertyValue('--x-nt-wallpaper-wordmark-halo').match(/\/ ([\d.]+)%/) || [])[1]
  );
  assert.ok(
    target.style.getPropertyValue('--x-nt-wallpaper-wordmark-halo').startsWith('rgb(248 250 252 /') &&
      calmHaloAlpha <= 12,
    'dark wordmark ink on a calm background should only get a faint light halo'
  );

  // A caption and its heading read one sample over the box around both, so a
  // heading over the dark half and a caption over the bright half share one ink.
  const heading = createElement({ left: 380, top: 100, right: 480, bottom: 160, width: 100, height: 60 });
  const caption = createElement({ left: 520, top: 170, right: 620, bottom: 200, width: 100, height: 30 });
  const runFrames = () => {
    while (scheduledFrames.size > 0) {
      const [id, callback] = scheduledFrames.entries().next().value;
      scheduledFrames.delete(id);
      callback();
    }
  };
  const captionTargets = (grouped) => [heading, caption].map((element) => ({
    element,
    sampleElement: grouped ? [heading, caption] : element,
    toneGroup: grouped ? 'caption' : '',
    minWidth: 42,
    minHeight: 32
  }));
  scheduledFrames.clear();
  extraTargets = captionTargets(false);
  currentWallpaper = {
    id: 'two-tone-wallpaper',
    url: 'test://two-tone-wallpaper'
  };
  runtime.refresh();
  getPendingImage('test://two-tone-wallpaper').resolve({ red: 236, green: 238, blue: 240 }, { red: 20, green: 24, blue: 30 });
  await flushAsyncWork();
  runFrames();
  assert.notStrictEqual(heading.getAttribute('data-wallpaper-ink'), caption.getAttribute('data-wallpaper-ink'),
    'ungrouped, a heading and caption over opposite halves should take opposite inks');
  extraTargets = captionTargets(true);
  runtime.schedule();
  runFrames();
  assert.strictEqual(caption.getAttribute('data-wallpaper-ink'), heading.getAttribute('data-wallpaper-ink'),
    'a grouped caption should share its heading ink');
  assert.strictEqual(
    caption.style.getPropertyValue('--x-nt-wallpaper-local-luma'),
    heading.style.getPropertyValue('--x-nt-wallpaper-local-luma'),
    'a grouped caption should read the same sample as its heading'
  );
  assert.strictEqual(
    caption.style.getPropertyValue('--x-nt-wallpaper-adaptive-ink'),
    heading.style.getPropertyValue('--x-nt-wallpaper-adaptive-ink'),
    'a grouped caption should share its heading adaptive ink'
  );
  extraTargets = [];

  console.log('new tab wallpaper adaptive tone transition tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
