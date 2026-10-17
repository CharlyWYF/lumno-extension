import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLiquidSurfaces,
  getRimDisplacement,
  getSurfaceBezel,
  getSurfaceDisplacementScale,
  isLiquidGlassSupported
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
    expect(dy).toBeLessThan(-0.8);
    expect(getRimDisplacement(400, 30, 800, 36, 'docked')[1]).toBeGreaterThan(dy);
  });

  it('bends every floating rim toward the middle and leaves the middle flat', () => {
    expect(getRimDisplacement(400, 18, 800, 36, 'floating')).toEqual([0, 0]);
    expect(getRimDisplacement(400, 0.5, 800, 36, 'floating')[1]).toBeGreaterThan(0.8);
    expect(getRimDisplacement(400, 35.5, 800, 36, 'floating')[1]).toBeLessThan(-0.8);
    expect(getRimDisplacement(0.5, 18, 800, 36, 'floating')[0]).toBeGreaterThan(0.8);
    expect(getRimDisplacement(799.5, 18, 800, 36, 'floating')[0]).toBeLessThan(-0.8);
    const [cornerX, cornerY] = getRimDisplacement(2, 2, 800, 36, 'floating');
    expect(cornerX).toBeGreaterThan(0);
    expect(cornerY).toBeGreaterThan(0);
  });

  it('fits the rim to any surface size and corner radius', () => {
    expect(getSurfaceBezel(800, 72)).toBe(24);
    expect(getSurfaceBezel(36, 36)).toBe(15);
    expect(getSurfaceBezel(8, 8)).toBe(4);
    // Cards bend further per pixel of rim than the bookmarks bar's 48 over 16px.
    expect(getSurfaceDisplacementScale(16)).toBeGreaterThan(48);
    // A rounder corner pushes the rim's bend off the straight edge near the corner.
    const sharp = getRimDisplacement(4, 2, 48, 48, 'floating', { radius: 4, bezel: 16 });
    const round = getRimDisplacement(4, 2, 48, 48, 'floating', { radius: 16, bezel: 16 });
    expect(sharp[0]).toBe(0);
    expect(round[0]).toBeGreaterThan(0);
    expect(getRimDisplacement(24, 24, 48, 48, 'floating', { radius: 16, bezel: 16 })).toEqual([0, 0]);
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
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AA==');
      const frames: FrameRequestCallback[] = [];
      const card = document.createElement('div');
      card.className = 'glass';
      document.body.appendChild(card);
      const size = { width: 200, height: 50 };
      Object.defineProperty(card, 'offsetWidth', { get: () => size.width });
      Object.defineProperty(card, 'offsetHeight', { get: () => size.height });
      const windowObj = {
        CSS: { supports: () => true },
        navigator: { userAgent: 'Chrome/140.0' },
        getComputedStyle: () => ({ borderTopLeftRadius: '16px' }),
        requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback),
        cancelAnimationFrame() {}
      } as unknown as Window;
      const surfaces = createLiquidSurfaces({
        documentObj: document,
        property: '--refraction',
        selector: '.glass',
        windowObj
      });
      // Runs frames and lets each map's decode settle in between.
      const settle = async () => {
        for (let round = 0; round < 4; round += 1) {
          await Promise.resolve();
          await Promise.resolve();
          frames.splice(0).forEach((callback) => callback(0));
        }
      };
      const filterIds = () => Array.from(document.querySelectorAll('filter')).map((filter) => filter.id);
      const pointedAt = () => card.style.getPropertyValue('--refraction').replace(/^url\(#|\)$/g, '');
      const runFrame = () => frames.splice(0).forEach((callback) => callback(0));
      return { card, filterIds, pointedAt, runFrame, settle, size, surfaces };
    }

    it('keeps a surface on its old filter until the map for its new size is ready', async () => {
      const { filterIds, pointedAt, runFrame, settle, size, surfaces } = setup();
      await settle();
      const first = pointedAt();
      expect(first).not.toBe('');
      expect(filterIds()).toEqual([first]);

      size.width = 240;
      surfaces.refresh();
      // The resize is measured, but the new map has not decoded yet: the old filter must stay.
      runFrame();
      expect(pointedAt()).toBe(first);
      expect(filterIds()).toContain(first);

      await settle();
      const second = pointedAt();
      expect(second).not.toBe(first);
      // Once nothing points at the old map it goes.
      expect(filterIds()).toEqual([second]);
      surfaces.destroy();
      expect(filterIds()).toEqual([]);
      expect(pointedAt()).toBe('');
    });
  });
});
