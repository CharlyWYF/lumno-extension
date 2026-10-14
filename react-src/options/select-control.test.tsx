import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSelectControlApi,
  createSelectControlController,
  type SelectControlController
} from './select-control';

let controllers: SelectControlController[] = [];

const items = [
  { iconUrl: '/system.png', label: '跟随系统', labelKey: 'language_system', value: 'system' },
  { iconUrl: '/zh-cn.png', label: '简体中文', labelKey: 'language_zh_cn', value: 'zh-CN' }
];

afterEach(() => {
  act(() => controllers.forEach((controller) => controller.destroy()));
  controllers = [];
  document.body.textContent = '';
});

describe('Options select control React island', () => {
  it('renders selected labels and legacy classes', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const controller = createSelectControlController(host, {
      kind: 'language',
      onSelect: vi.fn()
    });
    controllers.push(controller);

    act(() => controller.render({ id: 'language', items, value: 'system' }));

    expect(createSelectControlApi().implementation).toBe('react');
    expect(host.dataset.reactIsland).toBe('options-select-control');
    expect(host.querySelector('._x_extension_select_label_2024_unique_')?.textContent)
      .toBe('跟随系统');
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(host.querySelector<HTMLImageElement>('._x_extension_select_value_icon_2026_unique_')?.src)
      .toContain('/system.png');
    expect(host.querySelectorAll('._x_extension_select_option_icon_2026_unique_'))
      .toHaveLength(2);
  });

  it('disables the trigger when the adapter marks the control unavailable', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const controller = createSelectControlController(host, {
      kind: 'provider',
      onSelect: vi.fn()
    });
    controllers.push(controller);

    act(() => controller.render({ disabled: true, id: 'provider', items, value: 'system' }));

    expect(host.dataset.disabled).toBe('true');
    expect(host.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
  });

  it('opens the menu and reports a selected value', () => {
    const host = document.createElement('div');
    const onSelect = vi.fn();
    document.body.appendChild(host);
    const controller = createSelectControlController(host, {
      kind: 'language',
      onSelect
    });
    controllers.push(controller);
    act(() => controller.render({ id: 'language', items, value: 'system' }));

    act(() => {
      host.querySelector<HTMLButtonElement>('button')?.click();
    });
    expect(host.dataset.open).toBe('true');
    const options = host.querySelectorAll<HTMLElement>('[role="option"]');
    act(() => options[1]?.click());

    expect(onSelect).toHaveBeenCalledWith('zh-CN');
    expect(host.dataset.open).toBe('false');
    expect(host.querySelector('._x_extension_select_label_2024_unique_')?.textContent)
      .toBe('简体中文');
  });

  it('accepts adapter-driven selection and copy updates', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const controller = createSelectControlController(host, {
      kind: 'language',
      onSelect: vi.fn()
    });
    controllers.push(controller);
    act(() => controller.render({ id: 'language', items, value: 'system' }));
    act(() => controller.render({
      id: 'language',
      items: items.map((item) => ({
        ...item,
        label: item.value === 'system' ? 'System' : 'Simplified Chinese'
      })),
      value: 'zh-CN'
    }));

    expect(host.querySelector('._x_extension_select_label_2024_unique_')?.textContent)
      .toBe('Simplified Chinese');
  });

  it('chooses an option with the keyboard and returns focus to the trigger', () => {
    const host = document.createElement('div');
    const onSelect = vi.fn();
    document.body.appendChild(host);
    const controller = createSelectControlController(host, { kind: 'language', onSelect });
    controllers.push(controller);
    act(() => controller.render({ id: 'language', items, value: 'system' }));

    const trigger = host.querySelector<HTMLButtonElement>('button')!;
    trigger.focus();
    const press = (key: string) => act(() => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }));
    });
    press('ArrowDown');
    expect(host.dataset.open).toBe('true');
    expect(trigger.getAttribute('aria-activedescendant')).toBe('language_control_option_0');
    press('ArrowDown');
    expect(trigger.getAttribute('aria-activedescendant')).toBe('language_control_option_1');
    press('Enter');

    expect(onSelect).toHaveBeenCalledWith('zh-CN');
    expect(host.dataset.open).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape without reporting a change', () => {
    const host = document.createElement('div');
    const onSelect = vi.fn();
    document.body.appendChild(host);
    const controller = createSelectControlController(host, { kind: 'language', onSelect });
    controllers.push(controller);
    act(() => controller.render({ id: 'language', items, value: 'system' }));

    act(() => host.querySelector<HTMLButtonElement>('button')?.click());
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });

    expect(host.dataset.open).toBe('false');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('names the trigger with the setting title and the current value', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const controller = createSelectControlController(host, { kind: 'language', onSelect: vi.fn() });
    controllers.push(controller);
    act(() => controller.render({
      id: 'language',
      items,
      labelledBy: 'language_title',
      value: 'zh-CN'
    }));

    const trigger = host.querySelector<HTMLButtonElement>('button')!;
    expect(trigger.getAttribute('aria-labelledby')).toBe('language_title language_control_value');
    expect(trigger.hasAttribute('aria-label')).toBe(false);
    expect(document.getElementById('language_control_value')?.textContent).toBe('简体中文');
  });
});
