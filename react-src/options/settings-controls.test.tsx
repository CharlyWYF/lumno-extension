import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRangeSliderControlController,
  createRequiredCheckboxGroupController,
  createSettingsControlsApi,
  createToggleControlController,
  type RangeSliderControlController,
  type RequiredCheckboxGroupController,
  type ToggleControlController
} from './settings-controls';

let controllers: Array<
  RangeSliderControlController |
  RequiredCheckboxGroupController |
  ToggleControlController
> = [];

afterEach(() => {
  act(() => controllers.forEach((controller) => controller.destroy()));
  controllers = [];
  document.body.textContent = '';
});

describe('Options settings controls React islands', () => {
  it('renders a controlled switch and reports changes', () => {
    const host = document.createElement('label');
    const onChange = vi.fn();
    document.body.appendChild(host);
    const controller = createToggleControlController(host, {
      kind: 'auto-pip',
      onChange
    });
    controllers.push(controller);

    act(() => controller.render({
      checked: true,
      id: 'auto-pip'
    }));
    const input = host.querySelector<HTMLInputElement>('input');
    expect(createSettingsControlsApi().implementation).toBe('react');
    expect(host.dataset.reactIsland).toBe('options-toggle-control');
    expect(input?.checked).toBe(true);

    act(() => input?.click());
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('moves a sortable checkbox with Alt and the arrow keys', () => {
    const host = document.createElement('div');
    const onMove = vi.fn();
    document.body.appendChild(host);
    const controller = createRequiredCheckboxGroupController(host, {
      kind: 'search-result-sources',
      onChange: vi.fn(),
      onMove
    });
    controllers.push(controller);
    const items = ['topSite', 'bookmark', 'history'].map((value) => ({
      checked: true,
      id: value,
      label: value,
      labelKey: `search_tag_${value}`,
      value
    }));

    act(() => controller.render({ items, sortable: true }));
    const labels = host.querySelectorAll('label');
    expect(Array.from(labels).map((label) => label.getAttribute('data-sortable'))).toEqual(['true', 'true', 'true']);
    const inputs = host.querySelectorAll<HTMLInputElement>('input');
    act(() => {
      inputs[1]?.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, bubbles: true, key: 'ArrowLeft' }));
      inputs[1]?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' }));
      inputs[0]?.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, bubbles: true, key: 'ArrowLeft' }));
      inputs[2]?.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, bubbles: true, key: 'ArrowRight' }));
    });
    expect(onMove.mock.calls).toEqual([[1, 0]]);

    act(() => controller.render({ items }));
    expect(host.querySelector('[data-sortable]')).toBeNull();
  });

  it('keeps at least one required checkbox selected', () => {
    const host = document.createElement('div');
    const onChange = vi.fn();
    document.body.appendChild(host);
    const controller = createRequiredCheckboxGroupController(host, {
      kind: 'search-result-sources',
      onChange
    });
    controllers.push(controller);

    act(() => controller.render({
      items: [
        {
          checked: true,
          id: 'bookmark',
          label: '书签',
          labelKey: 'search_tag_bookmark',
          value: 'bookmark'
        },
        {
          checked: false,
          id: 'history',
          label: '历史',
          labelKey: 'search_tag_history',
          value: 'history'
        }
      ]
    }));
    const inputs = host.querySelectorAll<HTMLInputElement>('input');

    act(() => inputs[0]?.click());
    expect(inputs[0]?.checked).toBe(true);
    expect(onChange).not.toHaveBeenCalled();

    act(() => inputs[1]?.click());
    expect(onChange).toHaveBeenLastCalledWith(['bookmark', 'history']);
  });

  it('accepts adapter-driven state refreshes', () => {
    const host = document.createElement('label');
    document.body.appendChild(host);
    const controller = createToggleControlController(host, {
      kind: 'updates',
      onChange: vi.fn()
    });
    controllers.push(controller);

    act(() => controller.render({ checked: true, id: 'updates' }));
    act(() => controller.render({ checked: false, id: 'updates' }));

    expect(host.querySelector<HTMLInputElement>('input')?.checked).toBe(false);
  });

  it('renders the shared range slider and reports every integer step', () => {
    const host = document.createElement('div');
    const onInput = vi.fn();
    document.body.appendChild(host);
    const controller = createRangeSliderControlController(host, {
      kind: 'bookmark-columns',
      onInput
    });
    controllers.push(controller);

    act(() => controller.render({
      ariaLabel: '书签每行最多显示',
      id: 'bookmark-columns',
      max: 8,
      min: 4,
      step: 1,
      ticks: [
        { align: 'start', label: '4' },
        { label: '6' },
        { align: 'end', label: '8' }
      ],
      value: 6
    }));

    const input = host.querySelector<HTMLInputElement>('input[type="range"]');
    const valueInput = host.querySelector<HTMLInputElement>('input[type="number"]');
    expect(host.dataset.reactIsland).toBe('options-range-slider-control');
    expect(input?.classList.contains('x-lumno-range-slider-input')).toBe(true);
    expect(input?.value).toBe('6');
    // Only the interior tick becomes a notch; the ends are implied by the track.
    expect(input?.style.getPropertyValue('--x-range-slider-marks')
      .match(/linear-gradient/g)).toHaveLength(1);
    expect(input?.style.getPropertyValue('--x-range-slider-marks')).toContain('* 0.5)');
    expect(host.querySelector('.x-lumno-range-slider-tick')).toBeNull();
    expect(valueInput?.value).toBe('6');
    expect(valueInput?.getAttribute('aria-label')).toBe('书签每行最多显示');
    expect(valueInput?.max).toBe(input?.max);
    expect(valueInput?.max).toBe('8');
    expect(valueInput?.classList.contains('_x_extension_shortcut_input_2024_unique_'))
      .toBe(true);
    expect(valueInput?.classList.contains(
      '_x_extension_range_slider_value_input_2026_unique_'
    )).toBe(true);
    expect(valueInput?.style.width).toBe('var(--x-range-slider-value-width, 52px)');
    expect(valueInput?.style.height).toBe('var(--x-range-slider-value-height, 30px)');

    act(() => {
      if (!input) return;
      input.value = '7';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onInput).toHaveBeenCalledWith(7);
    expect(valueInput?.value).toBe('7');
  });

  it('keeps every slider step and commits a fixed-width editable value', () => {
    const host = document.createElement('div');
    const onInput = vi.fn();
    document.body.appendChild(host);
    const controller = createRangeSliderControlController(host, {
      kind: 'newtab-shortcut-columns',
      onInput
    });
    controllers.push(controller);

    act(() => controller.render({
      ariaLabel: '快捷方式每行数量',
      id: 'newtab-shortcut-columns',
      max: 16,
      min: 4,
      step: 1,
      ticks: [
        { align: 'start', label: '4', percent: 0 },
        { label: '8', percent: 100 / 3 },
        { label: '12', percent: 200 / 3 },
        { align: 'end', label: '16', percent: 100 }
      ],
      value: 10
    }));

    const slider = host.querySelector<HTMLInputElement>('input[type="range"]');
    const valueInput = host.querySelector<HTMLInputElement>('input[type="number"]');
    const setNativeInputValue = (input: HTMLInputElement, next: string) => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set?.call(input, next);
    };
    expect(valueInput?.disabled).toBe(false);
    expect(valueInput?.max).toBe(slider?.max);
    expect(valueInput?.max).toBe('16');
    expect(valueInput?.classList.contains('_x_extension_shortcut_input_2024_unique_'))
      .toBe(true);
    expect(valueInput?.style.width).toBe('var(--x-range-slider-value-width, 52px)');
    expect(valueInput?.style.height).toBe('var(--x-range-slider-value-height, 30px)');
    expect(slider?.style.getPropertyValue('--x-range-slider-marks')).toContain('* 0.3333)');
    expect(slider?.style.getPropertyValue('--x-range-slider-marks')).toContain('* 0.6667)');

    act(() => {
      if (!slider) return;
      slider.value = '7';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onInput).toHaveBeenLastCalledWith(7);
    expect(slider?.value).toBe('7');
    expect(valueInput?.value).toBe('7');

    act(() => {
      valueInput?.focus();
      if (!valueInput) return;
      setNativeInputValue(valueInput, '11');
      valueInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      if (!valueInput) return;
      valueInput.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter'
      }));
    });
    expect(onInput).toHaveBeenLastCalledWith(11);
    expect(slider?.value).toBe('11');
    expect(valueInput?.value).toBe('11');

    act(() => {
      valueInput?.focus();
      if (!valueInput) return;
      setNativeInputValue(valueInput, '99');
      valueInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      if (!valueInput) return;
      valueInput.blur();
    });
    expect(onInput).toHaveBeenLastCalledWith(16);
    expect(valueInput?.value).toBe('16');
    expect(valueInput?.style.width).toBe('var(--x-range-slider-value-width, 52px)');
  });

  it('aligns a two-tick range to both slider endpoints', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const controller = createRangeSliderControlController(host, {
      kind: 'search-result-display-limit',
      onInput: vi.fn()
    });
    controllers.push(controller);

    act(() => controller.render({
      ariaLabel: '最多显示结果',
      id: 'search-result-display-limit',
      max: 10,
      min: 5,
      step: 1,
      ticks: [
        { align: 'start', label: '5' },
        { align: 'end', label: '10' }
      ],
      value: 10
    }));

    const slider = host.querySelector<HTMLInputElement>('input[type="range"]');
    expect(slider?.classList.contains('x-range-slider-input')).toBe(true);
    expect(slider?.style.getPropertyValue('--x-range-slider-marks')).toBe('');
  });

  it('resets a slider to its component-provided default value', () => {
    const host = document.createElement('div');
    const onInput = vi.fn();
    document.body.appendChild(host);
    const controller = createRangeSliderControlController(host, {
      kind: 'newtab-shortcut-size',
      onInput
    });
    controllers.push(controller);

    act(() => controller.render({
      ariaLabel: '快捷方式大小',
      defaultValue: 64,
      id: 'newtab-shortcut-size',
      max: 80,
      min: 48,
      resetAriaLabel: '恢复默认大小',
      resetButtonId: 'newtab-shortcut-size-reset',
      step: 1,
      ticks: [
        { align: 'start', label: '48' },
        { label: '64' },
        { align: 'end', label: '80' }
      ],
      value: 72,
      valueSuffix: ' px'
    }));

    const slider = host.querySelector<HTMLInputElement>('input[type="range"]');
    const reset = host.querySelector<HTMLButtonElement>('#newtab-shortcut-size-reset');
    const valueInput = host.querySelector<HTMLInputElement>('input[type="number"]');
    expect(reset?.getAttribute('aria-label')).toBe('恢复默认大小');
    expect(reset?.querySelector('.ri-reset-left-line')).not.toBeNull();
    expect(reset?.querySelector('.ri-size-14')).not.toBeNull();
    expect(reset?.classList.contains(
      '_x_extension_shortcut_group_action_2024_unique_'
    )).toBe(true);
    // Unlabelled fields hang reset beside the track instead of shortening it.
    expect(reset?.parentElement).toBe(slider?.parentElement);
    expect(slider?.parentElement?.nextElementSibling).toBe(valueInput);
    expect(reset?.disabled).toBe(false);

    act(() => reset?.click());
    expect(onInput).toHaveBeenLastCalledWith(64);
    expect(slider?.value).toBe('64');
    expect(reset?.disabled).toBe(true);

    act(() => {
      if (!slider) return;
      slider.value = '76';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(reset?.disabled).toBe(false);
    act(() => slider?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(onInput).toHaveBeenLastCalledWith(64);
    expect(reset?.disabled).toBe(true);

    onInput.mockClear();
    act(() => slider?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(onInput).not.toHaveBeenCalled();
  });

  it('keeps adapter-provided localized labels after an interaction rerender', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const controller = createRequiredCheckboxGroupController(host, {
      kind: 'search-result-sources',
      onChange: vi.fn()
    });
    controllers.push(controller);

    act(() => controller.render({
      items: [
        {
          checked: true,
          id: 'bookmark',
          label: 'Bookmarks',
          labelKey: 'search_tag_bookmark',
          value: 'bookmark'
        },
        {
          checked: false,
          id: 'history',
          label: 'History',
          labelKey: 'search_tag_history',
          value: 'history'
        }
      ]
    }));
    const inputs = host.querySelectorAll<HTMLInputElement>('input');

    act(() => inputs[1]?.click());

    expect(Array.from(host.querySelectorAll('span')).map((node) => node.textContent))
      .toEqual(['Bookmarks', 'History']);
  });
});
