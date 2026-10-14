import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSegmentedControlApi,
  createSegmentedControlController,
  type SegmentedControlController,
  type SegmentedControlRenderModel
} from './segmented-control';

let controllers: SegmentedControlController[] = [];

const model: SegmentedControlRenderModel = {
  activeValue: 'latest',
  dataAttribute: 'data-recent-mode',
  items: [
    {
      iconClass: 'ri-icon ri-size-14 ri-time-line',
      label: '最近访问',
      labelKey: 'recent_mode_latest',
      value: 'latest'
    },
    {
      iconClass: 'ri-icon ri-size-14 ri-vip-diamond-line',
      label: '最常访问',
      labelKey: 'recent_mode_most',
      value: 'most'
    }
  ],
  select: {
    id: '_x_extension_recent_mode_select_2024_unique_'
  }
};

function createFixture() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const onSelect = vi.fn();
  const controller = createSegmentedControlController(host, {
    kind: 'recent-mode',
    onSelect
  });
  controllers.push(controller);
  return { controller, host, onSelect };
}

afterEach(() => {
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  controllers = [];
  document.body.textContent = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Options segmented control React island', () => {
  it('preserves indicator, data attributes, icons, and hidden select contracts', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));

    expect(createSegmentedControlApi().implementation).toBe('react');
    expect(host.dataset.reactIsland).toBe('options-segmented-control');
    expect(host.dataset.segmentedKind).toBe('recent-mode');
    expect(host.querySelector('._x_extension_theme_indicator_2024_unique_'))
      .not.toBeNull();
    expect(host.querySelectorAll('[data-recent-mode]')).toHaveLength(2);
    expect(host.querySelector('select')?.value).toBe('latest');
  });

  it('routes button and hidden-select changes through one adapter callback', () => {
    const { controller, host, onSelect } = createFixture();
    act(() => controller.render(model));
    act(() => {
      host.querySelector<HTMLButtonElement>('[data-recent-mode="most"]')?.click();
      const select = host.querySelector<HTMLSelectElement>('select');
      if (select) {
        select.value = 'most';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(onSelect).toHaveBeenNthCalledWith(1, 'most');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'most');
  });

  it('updates controlled state and localized copy without replacing the host', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));
    act(() => controller.render({
      ...model,
      activeValue: 'most',
      items: model.items.map((item) => ({
        ...item,
        label: item.value === 'most' ? 'Most visited' : 'Latest'
      }))
    }));

    expect(host.isConnected).toBe(true);
    expect(host.querySelector('[data-recent-mode="most"]')?.getAttribute('aria-checked'))
      .toBe('true');
    // Radio group semantics: no tab role, no aria-selected alongside aria-checked.
    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(host.querySelector('[aria-selected]')).toBeNull();
    expect(host.querySelector('select')?.value).toBe('most');
    expect(host.querySelector('[data-recent-mode="most"]')?.textContent)
      .toContain('Most visited');
  });

  it('shows the selected state immediately and remeasures after a hidden panel becomes visible', () => {
    const { controller, host } = createFixture();
    let visible = false;
    let resizeCallback: ResizeObserverCallback = () => {};
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      disconnect() {}

      observe() {}

      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
      const element = this;
      const left = element === host
        ? 100
        : element.dataset.recentMode === 'latest'
          ? 112
          : 190;
      const width = !visible
        ? 0
        : element === host
          ? 180
          : 70;
      return {
        bottom: 40,
        height: 32,
        left,
        right: left + width,
        top: 8,
        width,
        x: left,
        y: 8,
        toJSON() {
          return {};
        }
      } as DOMRect;
    });

    act(() => controller.render(model));
    const indicator = host.querySelector<HTMLElement>(
      '._x_extension_theme_indicator_2024_unique_'
    );
    expect(indicator?.dataset.ready).toBe('false');
    expect(host.querySelector('[data-recent-mode="latest"]')?.getAttribute('data-active'))
      .toBe('true');

    visible = true;
    act(() => resizeCallback([], {} as ResizeObserver));

    expect(indicator?.dataset.ready).toBe('true');
    expect(indicator?.style.width).toBe('70px');
    expect(indicator?.style.transform).toBe('translateX(12px)');
  });

  it('supports keyboard tab navigation and disabled state', () => {
    const { controller, host, onSelect } = createFixture();
    act(() => controller.render(model));

    const latest = host.querySelector<HTMLButtonElement>('[data-recent-mode="latest"]');
    act(() => {
      latest?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    });
    expect(onSelect).toHaveBeenCalledWith('most');

    act(() => controller.render({ ...model, disabled: true }));
    expect(host.querySelector<HTMLButtonElement>('[data-recent-mode="latest"]')?.disabled)
      .toBe(true);
    expect(host.querySelector('select')?.disabled).toBe(true);
  });

  it('acts as one radio group with a single tab stop that arrows move', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const { controller, host, onSelect } = createFixture();
    onSelect.mockImplementation((value: string) => {
      controller.render({ ...model, activeValue: value });
    });
    act(() => controller.render(model));

    expect(host.getAttribute('role')).toBe('radiogroup');
    const radios = () => Array.from(host.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(radios()).toHaveLength(2);
    expect(radios().map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([0, -1]);
    expect(radios().some((radio) => radio.hasAttribute('aria-pressed'))).toBe(false);

    radios()[0].focus();
    act(() => {
      radios()[0].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    });
    expect(onSelect).toHaveBeenLastCalledWith('most');
    expect(radios().map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, 0]);
    expect(document.activeElement).toBe(radios()[1]);
    expect(host.querySelector('select')?.value).toBe('most');

    act(() => {
      radios()[1].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    });
    expect(onSelect).toHaveBeenLastCalledWith('latest');
    expect(document.activeElement).toBe(radios()[0]);
  });

  it('keeps the first option tabbable when nothing is selected', () => {
    const { controller, host } = createFixture();
    act(() => controller.render({ ...model, activeValue: 'unknown' }));

    expect(Array.from(host.querySelectorAll<HTMLButtonElement>('[role="radio"]'), (radio) => radio.tabIndex))
      .toEqual([0, -1]);
  });

  it('unmounts cleanly', () => {
    const { controller, host } = createFixture();
    act(() => {
      controller.render(model);
      controller.destroy();
    });

    expect(host.childElementCount).toBe(0);
  });
});
