import { describe, expect, it } from 'vitest';
import { getRimDisplacement, isLiquidGlassSupported } from './liquid-glass';

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
});
