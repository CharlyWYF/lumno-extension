import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildLensFilter,
  createLiquidSurfaces,
  getLensLayout,
  getLensTilePixels,
  getRimDisplacement,
  getSurfaceBezel,
  getSurfaceDisplacementScale,
  isLiquidGlassSupported,
  placeLensFilter
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
    expect(getSurfaceBezel(800, 200)).toBe(40);
    expect(getSurfaceBezel(800, 70)).toBe(20);
    expect(getSurfaceBezel(42, 42)).toBe(12);
    expect(getSurfaceBezel(8, 8)).toBe(4);
    // Every surface bends as far per pixel of rim as the bookmarks bar's 16 over 16px.
    expect(getSurfaceDisplacementScale(16)).toBe(16);
    expect(getSurfaceDisplacementScale(30)).toBe(30);
    // A rounder corner pushes the rim's bend off the straight edge near the corner.
    const straight = getRimDisplacement(40, 2, 120, 120, 'floating', { radius: 4, bezel: 16 });
    const round = getRimDisplacement(4, 2, 48, 48, 'floating', { radius: 16, bezel: 16 });
    expect(straight[0]).toBe(0);
    expect(round[0]).toBeGreaterThan(0);
    expect(getRimDisplacement(24, 24, 48, 48, 'floating', { radius: 16, bezel: 16 })).toEqual([0, 0]);
    // A corner tighter than its rim turns the bend as one as wide as the rim does, so it never
    // snaps from sideways to upward along the corner's diagonal.
    const tight = { radius: 22, bezel: 40 };
    expect(getRimDisplacement(30, 32, 230, 165, 'floating', tight))
      .toEqual(getRimDisplacement(30, 32, 230, 165, 'floating', { radius: 40, bezel: 40 }));
    const [beforeX, beforeY] = getRimDisplacement(29.5, 30.5, 230, 165, 'floating', tight);
    const [afterX, afterY] = getRimDisplacement(30.5, 29.5, 230, 165, 'floating', tight);
    expect(Math.abs(beforeX - afterX)).toBeLessThan(0.03);
    expect(Math.abs(beforeY - afterY)).toBeLessThan(0.03);
  });

  it('eases the bend out to nothing at the rim\'s inner edge, without folding the scene', () => {
    const bezel = 14;
    const at = (y: number) => getRimDisplacement(400, y, 800, 72, 'floating', { bezel, radius: 36 })[1];
    expect(at(0.5)).toBeGreaterThan(0.9);
    expect(at(7)).toBeLessThan(at(0.5));
    // No slope left at the inner edge, so no line where the rim meets the flat middle.
    expect(at(13.5)).toBeLessThan(0.01);
    expect(at(14.5)).toBe(0);
    // Where each point samples the scene moves inward steadily from the edge (the bluest channel
    // bends furthest): the scene stretches toward the rim but never mirrors back on itself.
    const shift = (getSurfaceDisplacementScale(bezel) * 1.25) / 2;
    let sampled = -Infinity;
    for (let y = 0.5; y < bezel; y += 0.5) {
      const next = y + at(y) * shift;
      expect(next).toBeGreaterThan(sampled);
      sampled = next;
    }
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

  it('bends the whole surface in every pass and moves only its tiles on resize', () => {
    const tiles = { shape: 'floating' as const, size: 30, urls: Array.from({ length: 8 }, (_, i) => `data:t${i}`) };
    document.body.innerHTML = `<svg>${buildLensFilter('lens', 640, 470, tiles, 90, true)}</svg>`;
    const filter = document.querySelector('filter') as Element;
    // No pass that reads the backdrop is held to a subregion: Chrome draws those wrong.
    const bends = Array.from(filter.querySelectorAll('feDisplacementMap'));
    expect(bends).toHaveLength(3);
    bends.forEach((bend) => ['x', 'y', 'width', 'height'].forEach((name) => expect(bend.hasAttribute(name)).toBe(false)));
    placeLensFilter(filter, 640, 300, tiles);
    expect(filter.getAttribute('height')).toBe('300');
    expect(filter.querySelectorAll('feImage')[3].getAttribute('y')).toBe('270');
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
      const addSurface = (size: { width: number; height: number }) => {
        const element = document.createElement('div');
        element.className = 'glass';
        document.body.appendChild(element);
        Object.defineProperty(element, 'offsetWidth', { get: () => size.width });
        Object.defineProperty(element, 'offsetHeight', { get: () => size.height });
        return element;
      };
      const size = { width: 200, height: 64 };
      const corner = { radius: '16px', rim: '' };
      const card = addSurface(size);
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
        getComputedStyle: () => ({
          borderTopLeftRadius: corner.radius,
          getPropertyValue: (name: string) => (name === '--rim' ? corner.rim : '')
        }),
        requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback),
        cancelAnimationFrame() {},
        ResizeObserver: FakeResizeObserver,
        MutationObserver
      } as unknown as Window;
      const surfaces = createLiquidSurfaces({
        documentObj: document,
        dispersionSelector: '.glass.search',
        property: '--refraction',
        rimProperty: '--rim',
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
      const pointedAt = (element = card) => element.style.getPropertyValue('--refraction').replace(/^url\(#|\)$/g, '');
      const observe = (element: HTMLElement) =>
        resized([{ target: element } as unknown as ResizeObserverEntry], {} as ResizeObserver);
      return { addSurface, corner, encoded, filters, observe, pointedAt, resize, settle, surfaces };
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
      const { corner, filters, pointedAt, resize, settle, surfaces } = setup();
      resize(200, 64);
      await settle();
      const first = pointedAt();

      // Rounder: the corner tiles change, which needs new tiles.
      corner.radius = '24px';
      resize(200, 90);
      expect(pointedAt()).toBe(first);
      await settle();
      const second = pointedAt();
      expect(second).not.toBe(first);
      expect(filters().map((filter) => filter.id)).toEqual([second]);
      expect(filters()[0].getAttribute('height')).toBe('90');

      // Back to the first corner: its tiles are cached, so no new images, but a fresh filter.
      corner.radius = '16px';
      resize(200, 64);
      await settle();
      expect(pointedAt()).not.toBe(second);
      expect(filters()).toHaveLength(1);
      surfaces.destroy();
      expect(filters()).toEqual([]);
      expect(pointedAt()).toBe('');
    });

    it('gives every surface its own lens, sized to it', async () => {
      const { addSurface, filters, observe, pointedAt, resize, settle, surfaces } = setup();
      const menu = addSurface({ width: 168, height: 138 });
      const plate = addSurface({ width: 640, height: 470 });
      resize(640, 70);
      observe(menu);
      observe(plate);
      await settle();
      const ids = [pointedAt(), pointedAt(menu), pointedAt(plate)];
      expect(new Set(ids).size).toBe(3);
      // Each id names one filter, the size of the surface pointing at it.
      expect(filters().map((filter) => filter.id).sort()).toEqual(ids.slice().sort());
      const sizeOf = (id: string) => {
        const filter = document.getElementById(id) as Element;
        return [filter.getAttribute('width'), filter.getAttribute('height')];
      };
      expect(sizeOf(ids[0])).toEqual(['640', '70']);
      expect(sizeOf(ids[1])).toEqual(['168', '138']);
      expect(sizeOf(ids[2])).toEqual(['640', '470']);
      surfaces.destroy();
    });

    it('splits colors only on the surfaces chosen for it', async () => {
      const { addSurface, filters, observe, pointedAt, resize, settle, surfaces } = setup();
      const search = addSurface({ width: 640, height: 70 });
      search.classList.add('search');
      resize(270, 156);
      observe(search);
      await settle();
      const passes = (id: string) => (document.getElementById(id) as Element).querySelectorAll('feDisplacementMap').length;
      expect(passes(pointedAt())).toBe(1);
      expect(passes(pointedAt(search))).toBe(3);
      expect(filters()).toHaveLength(2);
      surfaces.destroy();
    });

    it('holds a rim the surface sets for itself while it grows', async () => {
      const { corner, encoded, filters, pointedAt, resize, settle, surfaces } = setup();
      corner.rim = '22px';
      resize(640, 70);
      await settle();
      const first = pointedAt();
      const builds = encoded.mock.calls.length;
      // The default would widen the rim as the plate grew, up to 40px at 140px; this one is 22px
      // from the start, so growing never asks for new tiles.
      const map = () => (filters()[0].querySelector('feDisplacementMap') as Element).getAttribute('scale');
      expect(map()).toBe(getSurfaceDisplacementScale(22).toFixed(1));
      resize(640, 180);
      resize(640, 412);
      await settle();
      expect(pointedAt()).toBe(first);
      expect(encoded.mock.calls.length).toBe(builds);
      // Too short for it, the rim narrows to half the surface.
      resize(640, 40);
      await settle();
      expect(map()).toBe(getSurfaceDisplacementScale(20).toFixed(1));
      surfaces.destroy();
    });

    it('leaves small controls without a lens', async () => {
      const { filters, pointedAt, resize, settle, surfaces } = setup();
      resize(28, 28);
      await settle();
      expect(pointedAt()).toBe('');
      expect(filters()).toEqual([]);
      // Grown into a plate, it gets one; shrunk again, it drops it.
      resize(200, 64);
      await settle();
      expect(pointedAt()).not.toBe('');
      resize(28, 28);
      expect(pointedAt()).toBe('');
      expect(filters()).toEqual([]);
      surfaces.destroy();
    });
  });
});
