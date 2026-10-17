import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBookmarksTopbar,
  createBookmarksTopbarApi,
  getSurfaceColorTokens,
  normalizeLayout,
  normalizeSurfaceMode,
  normalizeSurfaceColor,
  type BookmarksTopbarRuntime
} from './bookmarks-topbar';

let runtime: BookmarksTopbarRuntime | null = null;

afterEach(() => {
  if (runtime) {
    act(() => runtime?.destroy());
  }
  runtime = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('New Tab React bookmarks topbar', () => {
  it('moves adapter-owned content into the React surface and restores it', () => {
    const section = document.createElement('section');
    const grid = document.createElement('div');
    const modeControl = document.createElement('button');
    const managerButton = document.createElement('button');
    section.append(grid, managerButton, modeControl);
    document.body.appendChild(section);
    const onVisibilityChange = vi.fn();
    act(() => {
      runtime = createBookmarksTopbar({
        documentObj: document,
        windowObj: window,
        grid,
        managerButton,
        modeControl,
        onVisibilityChange
      });
      runtime.mount(document.body);
    });
    if (!runtime) {
      throw new Error('Expected bookmarks topbar runtime');
    }

    expect(createBookmarksTopbarApi().implementation).toBe('react');
    expect(runtime.element.dataset.reactIsland).toBe(
      'newtab-bookmarks-topbar'
    );
    expect(runtime.activate()).toBe(true);
    expect(runtime.itemsHost.firstElementChild).toBe(grid);
    expect(Array.from(runtime.actions.children)).toEqual([
      managerButton,
      modeControl
    ]);
    expect(runtime.setVisible(true)).toBe(true);
    expect(onVisibilityChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ height: 36 })
    );
    expect(runtime.deactivate()).toBe(true);
    expect(Array.from(section.children)).toEqual([
      grid,
      managerButton,
      modeControl
    ]);
  });

  it('keeps surface color and overflow behavior', () => {
    act(() => {
      runtime = createBookmarksTopbar({
        documentObj: document,
        windowObj: window
      });
    });
    if (!runtime) {
      throw new Error('Expected bookmarks topbar runtime');
    }
    expect(normalizeSurfaceColor('#EdF4Fe')).toBe('#edf4fe');
    expect(normalizeSurfaceColor('#abc')).toBe('#aabbcc');
    expect(getSurfaceColorTokens('#111827')?.ink).toBe('#f8fafc');
    expect(normalizeSurfaceMode('clear')).toBe('clear');
    expect(normalizeSurfaceMode('transparent')).toBe('transparent');
    expect(runtime.setSurfaceMode('transparent')).toBe('transparent');
    expect(runtime.element.dataset.surfaceMode).toBe('transparent');
    expect(runtime.element.dataset.layout).toBe('docked');
    expect(normalizeLayout('floating')).toBe('floating');
    expect(normalizeLayout('sideways')).toBe('docked');
    expect(runtime.setLayout('floating')).toBe('floating');
    expect(runtime.element.dataset.layout).toBe('floating');
    expect(runtime.setLayout(undefined)).toBe('docked');
    expect(runtime.setSurfaceColor('#edf4fe')).toBe('#edf4fe');
    expect(
      runtime.element.style.getPropertyValue(
        '--x-nt-bookmarks-topbar-surface'
      )
    ).toBe('#edf4fe');

    Object.defineProperties(runtime.viewport, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 500 }
    });
    runtime.activate();
    runtime.setVisible(true);
    expect(runtime.syncOverflowFade()).toBe(true);
    expect(runtime.edgeFade.dataset.visible).toBe('true');
    // Both ends report overflow, so the viewport can fade whichever side runs past the bar.
    expect(runtime.viewport.dataset.overflowEnd).toBe('true');
    expect(runtime.viewport.dataset.overflowStart).toBe('false');
    runtime.viewport.scrollLeft = 400;
    runtime.syncOverflowFade();
    expect(runtime.viewport.dataset.overflowStart).toBe('true');
    expect(runtime.viewport.dataset.overflowEnd).toBe('false');
  });

  it('keeps horizontal wheel gestures native and batches vertical wheel input', () => {
    const animationFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      animationFrames.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      animationFrames.delete(frameId);
    });
    const flushAnimationFrames = () => {
      while (animationFrames.size > 0) {
        const pendingFrames = Array.from(animationFrames.entries());
        animationFrames.clear();
        pendingFrames.forEach(([, callback]) => callback(0));
      }
    };

    act(() => {
      runtime = createBookmarksTopbar({
        documentObj: document,
        windowObj: window
      });
    });
    if (!runtime) {
      throw new Error('Expected bookmarks topbar runtime');
    }
    Object.defineProperties(runtime.viewport, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 500 }
    });
    runtime.activate();
    runtime.setVisible(true);
    flushAnimationFrames();

    const horizontalWheel = new WheelEvent('wheel', {
      cancelable: true,
      deltaX: 48,
      deltaY: 4
    });
    runtime.viewport.dispatchEvent(horizontalWheel);
    expect(horizontalWheel.defaultPrevented).toBe(false);
    expect(runtime.viewport.scrollLeft).toBe(0);
    expect(animationFrames.size).toBe(0);

    runtime.viewport.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 24 })
    );
    runtime.viewport.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 36 })
    );
    expect(runtime.viewport.scrollLeft).toBe(0);
    expect(animationFrames.size).toBe(1);

    flushAnimationFrames();
    expect(runtime.viewport.scrollLeft).toBe(60);
  });
});
