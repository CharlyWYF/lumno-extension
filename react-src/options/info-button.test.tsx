import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createInfoButtonApi,
  createInfoButtonController,
  InfoButton,
  type InfoButtonController
} from './info-button';

let controller: InfoButtonController | null = null;

afterEach(() => {
  act(() => controller?.destroy());
  controller = null;
  document.body.textContent = '';
});

describe('Options InfoButton', () => {
  it('owns the shared icon, tooltip, focus, and accessibility contract', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => root.render(
      <InfoButton
        className="custom-info"
        tooltip="关闭后的行为说明"
        tooltipKey="settings_example_tooltip"
      />
    ));

    const button = host.querySelector<HTMLElement>(
      '._x_extension_info_button_2026_unique_'
    );
    expect(button?.classList.contains('custom-info')).toBe(true);
    expect(button?.getAttribute('data-tooltip')).toBe('关闭后的行为说明');
    expect(button?.getAttribute('data-i18n-tooltip')).toBe('settings_example_tooltip');
    expect(button?.getAttribute('aria-label')).toBe('关闭后的行为说明');
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.hasAttribute('role')).toBe(false);
    expect(button?.tabIndex).toBe(0);
    expect(button?.hasAttribute('aria-describedby')).toBe(false);
    expect(button?.querySelector('.ri-information-line')).not.toBeNull();
    expect(button?.querySelector('.ri-question-line')).toBeNull();

    act(() => root.unmount());
  });

  it('names the button with its label and describes it with the tooltip text', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => root.render(<InfoButton label="Template help" tooltip="Use %s for the query" />));

    const button = host.querySelector<HTMLButtonElement>('button')!;
    expect(button.getAttribute('aria-label')).toBe('Template help');
    const description = document.getElementById(button.getAttribute('aria-describedby') || '');
    expect(description?.textContent).toBe('Use %s for the query');
    expect(button.contains(description)).toBe(true);
    expect(description?.hidden).toBe(true);
    expect(button.getAttribute('data-tooltip')).toBe('Use %s for the query');

    button.focus();
    expect(document.activeElement).toBe(button);

    act(() => root.unmount());
  });

  it('exposes a reusable controller for static Options hosts', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    controller = createInfoButtonController(host);

    act(() => controller?.render({ tooltip: '说明' }));

    expect(createInfoButtonApi().implementation).toBe('react');
    expect(host.dataset.reactIsland).toBe('options-info-button');
    expect(host.querySelector('.ri-information-line')).not.toBeNull();
  });
});
