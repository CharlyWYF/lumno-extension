import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildLensFilter,
  createLiquidSurfaces,
  getLensBands,
  getLensLayout,
  getLensTilePixels,
  getRimDisplacement,
  getSurfaceBezel,
  getSurfaceDisplacementScale,
  isLiquidGlassSupported,
  placeLensFilter,
  usesLensBands
} from './liquid-glass';

function fakeWindow(supportsUrl: boolean, userAgent: string) {
  return {
    CSS: { supports: () => supportsUrl },
    navigator: { userAgent }
  } as unknown as Window;
}

describe('New Tab bookmarks bar liquid glass', () => {
  it('runs only where backdrop-filter draws SVG filters', () => {
    expect(isLiquidGlassSupported(fakeWindow(true, 'Mozilla/5.0 Chrome/140.0'))).toBe(true);
    expect(isLiquidGlassSupported(fakeWindow(true, 'Mozilla/5.0 Firefox/140.0'))).toBe(false);
    expect(isLiquidGlassSupported(fakeWindow(false, 'Mozilla/5.0 Chrome/140.0'))).toBe(false);
  });

  it('bends only the docked bar\'s bottom rim, inward', () => {
    expect(getRimDisplacement(400, 1, 800, 36, 'docked')).toEqual([0, 0]);
    expect(getRimDisplacement(400, 18, 800, 36, 'docked')).toEqual([0, 0]);
    const [dx, dy] = getRimDisplacement(400, 35.5, 800, 36, 'docked');
    expect(dx).toBe(0);
    expect(dy).toBeLessThan(-0.6);
    expect(getRimDisplacement(400, 30, 800, 36, 'docked')[1]).toBeGreaterThan(dy);
  });

  it('bends every floating rim toward the middle and leaves the middle flat', () => {
    expect(getRimDisplacement(400, 18, 800, 36, 'floating')).toEqual([0, 0]);
    expect(getRimDisplacement(400, 0.5, 800, 36, 'floating')[1]).toBeGreaterThan(0.6);
    expect(getRimDisplacement(400, 35.5, 800, 36, 'floating')[1]).toBeLessThan(-0.6);
    expect(getRimDisplacement(0.5, 18, 800, 36, 'floating')[0]).toBeGreaterThan(0.6);
    expect(getRimDisplacement(799.5, 18, 800, 36, 'floating')[0]).toBeLessThan(-0.6);
    const [cornerX, cornerY] = getRimDisplacement(2, 2, 800, 36, 'floating');
    expect(cornerX).toBeGreaterThan(0);
    expect(cornerY).toBeGreaterThan(0);
  });

  it('fits the rim to any surface size and corner radius', () => {
    expect(getSurfaceBezel(800, 72)).toBe(30);
    expect(getSurfaceBezel(44, 44)).toBe(20);
    expect(getSurfaceBezel(8, 8)).toBe(4);
    // Every surface bends as far per pixel of rim as the bookmarks bar's 48 over 16px.
    expect(getSurfaceDisplacementScale(16)).toBe(48);
    expect(getSurfaceDisplacementScale(30)).toBe(90);
    // A rounder corner pushes the rim's bend off the straight edge near the corner.
    const sharp = getRimDisplacement(4, 2, 48, 48, 'floating', { radius: 4, bezel: 16 });
    const round = getRimDisplacement(4, 2, 48, 48, 'floating', { radius: 16, bezel: 16 });
    expect(sharp[0]).toBe(0);
    expect(round[0]).toBeGreaterThan(0);
    expect(getRimDisplacement(24, 24, 48, 48, 'floating', { radius: 16, bezel: 16 })).toEqual([0, 0]);
  });

  it('bends hardest at the edge and eases into the flat middle', () => {
    const at = (y: number) => getRimDisplacement(400, y, 800, 72, 'floating', { bezel: 30, radius: 36 })[1];
    expect(at(0.5)).toBeGreaterThan(0.75);
    expect(at(8)).toBeGreaterThan(0.2);
    expect(at(8)).toBeLessThan(at(0.5));
    expect(at(20)).toBeLessThan(at(8));
    expect(at(20)).toBeGreaterThanOrEqual(0);
  });

  it('rebuilds the whole rim from nine-slice tiles at any size', () => {
    const geometry = { bezel: 16, radius: 12 };
    const { size, tiles } = getLensTilePixels('floating', geometry.radius, geometry.bezel);
    expect(size).toBe(16);
    for (const [width, height] of [[40, 40], [200, 64], [33, 120]]) {
      const rects = getLensLayout('floating', width, height, size);
      // Every point reads the tile covering it (a strip stretched along its side), or flat.
      const read = (x: number, y: number) => {
        const index = rects.findIndex(([left, top, w, h]) => x >= left && x < left + w && y >= top && y < top + h);
        if (index < 0) {
          return [128, 128];
        }
        const tile = tiles[index];
        const [left, top] = rects[index];
        const tx = tile.width === 1 ? 0 : x - left;
        const ty = tile.height === 1 ? 0 : y - top;
        const offset = (ty * tile.width + tx) * 4;
        return [tile.data[offset], tile.data[offset + 1]];
      };
      for (let y = 0; y < height; y += 3) {
        for (let x = 0; x < width; x += 3) {
          const [dx, dy] = getRimDisplacement(x + 0.5, y + 0.5, width, height, 'floating', geometry);
          expect(read(x, y)).toEqual([Math.round(128 + dx * 127), Math.round(128 + dy * 127)]);
        }
      }
    }
    const docked = getLensTilePixels('docked', 0, 16);
    expect(docked.tiles).toHaveLength(1);
    expect(getLensLayout('docked', 800, 36, docked.size)).toEqual([[0, 20, 800, 16]]);
  });

  it('splits the bend into color channels on plates, blue bending furthest', () => {
    const tiles = { shape: 'floating' as const, size: 20, urls: Array.from({ length: 8 }, (_, i) => `data:t${i}`) };
    const markup = buildLensFilter('lens', 120, 70, tiles, 90, true);
    const scales = Array.from(markup.matchAll(/feDisplacementMap[^>]*scale="([\d.]+)"/g), (match) => Number(match[1]));
    expect(scales).toHaveLength(3);
    expect(scales[0]).toBeLessThan(90);
    expect(scales[1]).toBe(90);
    expect(scales[2]).toBeGreaterThan(90);
    expect(markup).toContain('values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"');
    expect(markup.match(/<feBlend/g)).toHaveLength(2);
    expect(markup.match(/<feImage/g)).toHaveLength(8);
    expect(markup).toContain('<filter id="lens" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB" x="0" y="0" width="120" height="70">');
    // A small control bends in one pass.
    const single = buildLensFilter('lens', 40, 40, tiles, 60, false);
    expect(single.match(/<feDisplacementMap/g)).toHaveLength(1);
    expect(single).not.toContain('feBlend');
  });

  it('bends a large plate inside its rim bands only, the middle passing through', () => {
    expect(usesLensBands(640, 470, 30)).toBe(true);
    expect(usesLensBands(640, 76, 30)).toBe(false);
    expect(usesLensBands(56, 56, 25)).toBe(false);
    const tiles = { shape: 'floating' as const, size: 30, urls: Array.from({ length: 8 }, (_, i) => `data:t${i}`) };
    document.body.innerHTML = `<svg>${buildLensFilter('lens', 640, 470, tiles, 90, true, true)}</svg>`;
    const filter = document.querySelector('filter') as Element;
    // Every pass that reads the backdrop is held to a band.
    const bends = Array.from(filter.querySelectorAll('feDisplacementMap'));
    expect(bends).toHaveLength(12);
    bends.forEach((bend) => expect(bend.hasAttribute('data-band')).toBe(true));
    const last = filter.lastElementChild as Element;
    expect(last.tagName.toLowerCase()).toBe('femerge');
    expect(Array.from(last.children).map((node) => node.getAttribute('in'))).toEqual(['SourceGraphic', 'b0', 'b1', 'b2', 'b3']);
    // Resizing moves the bands with the tiles.
    placeLensFilter(filter, 640, 300, tiles);
    const bottom = filter.querySelectorAll('feDisplacementMap[data-band="1"]')[0];
    expect(['x', 'y', 'width', 'height'].map((name) => Number(bottom.getAttribute(name)))).toEqual(getLensBands(640, 300, 30)[1]);
    expect(filter.querySelector('[data-tile="3"]')?.getAttribute('y')).toBe('270');
    document.body.innerHTML = '';
  });

  describe('surfaces', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      document.body.innerHTML = '';
    });

    function setup() {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        putImageData() {}
      } as unknown as CanvasRenderingContext2D);
      const encoded = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AA==');
      const frames: FrameRequestCallback[] = [];
      const card = document.createElement('div');
      card.className = 'glass';
      document.body.appendChild(card);
      const size = { width: 200, height: 64 };
      Object.defineProperty(card, 'offsetWidth', { get: () => size.width });
      Object.defineProperty(card, 'offsetHeight', { get: () => size.height });
      let resized: ResizeObserverCallback = () => {};
      class FakeResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resized = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      const windowObj = {
        CSS: { supports: () => true },
        navigator: { userAgent: 'Chrome/140.0' },
        getComputedStyle: () => ({ borderTopLeftRadius: '16px' }),
        requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback),
        cancelAnimationFrame() {},
        ResizeObserver: FakeResizeObserver,
        MutationObserver
      } as unknown as Window;
      const surfaces = createLiquidSurfaces({
        documentObj: document,
        property: '--refraction',
        selector: '.glass',
        windowObj
      });
      const resize = (width: number, height: number) => {
        size.width = width;
        size.height = height;
        resized([{ target: card } as unknown as ResizeObserverEntry], {} as ResizeObserver);
      };
      // Lets the tiles' decode settle, then runs the frames it queues.
      const settle = async () => {
        for (let round = 0; round < 4; round += 1) {
          await Promise.resolve();
          await Promise.resolve();
          frames.splice(0).forEach((callback) => callback(0));
        }
      };
      const filters = () => Array.from(document.querySelectorAll('filter'));
      const pointedAt = () => card.style.getPropertyValue('--refraction').replace(/^url\(#|\)$/g, '');
      return { encoded, filters, pointedAt, resize, settle, surfaces };
    }

    it('fits a resize in place in the same frame, with nothing rebuilt', async () => {
      const { encoded, filters, pointedAt, resize, settle, surfaces } = setup();
      resize(200, 64);
      await settle();
      const first = pointedAt();
      expect(first).not.toBe('');
      expect(filters().map((filter) => filter.id)).toEqual([first]);
      const builds = encoded.mock.calls.length;

      // Same corner and rim: the filter just moves its tiles, before the frame paints.
      resize(260, 64);
      expect(pointedAt()).toBe(first);
      const filter = filters()[0];
      expect(filter.getAttribute('width')).toBe('260');
      const topRight = filter.querySelectorAll('feImage')[1];
      expect(Number(topRight.getAttribute('x'))).toBe(260 - Number(topRight.getAttribute('width')));
      expect(encoded.mock.calls.length).toBe(builds);
      expect(filters()).toHaveLength(1);
      surfaces.destroy();
    });

    it('keeps a surface on its old lens until the tiles for a new rim are ready', async () => {
      const { filters, pointedAt, resize, settle, surfaces } = setup();
      resize(200, 64);
      await settle();
      const first = pointedAt();

      // Taller: the rim widens, which needs new tiles.
      resize(200, 90);
      expect(pointedAt()).toBe(first);
      await settle();
      const second = pointedAt();
      expect(second).not.toBe(first);
      expect(filters().map((filter) => filter.id)).toEqual([second]);
      expect(filters()[0].getAttribute('height')).toBe('90');

      // Back to the first rim: its tiles are cached, so no new images, but a fresh filter.
      resize(200, 64);
      await settle();
      expect(pointedAt()).not.toBe(second);
      expect(filters()).toHaveLength(1);
      surfaces.destroy();
      expect(filters()).toEqual([]);
      expect(pointedAt()).toBe('');
    });

    it('leaves small controls without a lens', async () => {
      const { filters, pointedAt, resize, settle, surfaces } = setup();
      resize(56, 56);
      await settle();
      expect(pointedAt()).toBe('');
      expect(filters()).toEqual([]);
      // Grown into a plate, it gets one; shrunk again, it drops it.
      resize(200, 64);
      await settle();
      expect(pointedAt()).not.toBe('');
      resize(56, 56);
      expect(pointedAt()).toBe('');
      expect(filters()).toEqual([]);
      surfaces.destroy();
    });
  });
});
