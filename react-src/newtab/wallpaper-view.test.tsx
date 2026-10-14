import { act } from 'react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createDefaultPanelState } from './wallpaper-view.fixtures';
import {
  createWallpaperViewApi,
  createWallpaperViewController,
  type WallpaperPanelActions,
  type WallpaperPanelModel,
  type WallpaperPanelState,
  type WallpaperViewController
} from './wallpaper-view';

let controller: WallpaperViewController | null = null;

afterEach(() => {
  if (controller) {
    act(() => controller?.destroy());
  }
  controller = null;
  document.body.innerHTML = '';
});

type MockActions = { [K in keyof WallpaperPanelActions]: WallpaperPanelActions[K] & Mock };

function createActions(): MockActions {
  const calls: Record<string, Mock> = {};
  return new Proxy(calls, {
    get(target, key: string) {
      if (!target[key]) target[key] = vi.fn();
      return target[key];
    }
  }) as MockActions;
}

const MODEL: WallpaperPanelModel = {
  appearanceOptions: [
    { mode: 'system', imageUrl: '/system.svg' },
    { mode: 'light', imageUrl: '/light.svg' },
    { mode: 'dark', imageUrl: '/dark.svg' }
  ],
  favicons: [{ id: 'default', previewUrl: '/favicon.png' }, { id: 'alternate', inlineSvg: '<svg></svg>' }],
  icons: {
    arrow: '<i class="ri-arrow-right-s-line"></i>',
    info: '<i class="ri-icon ri-information-line"></i>'
  },
  marks: { shortcutColumns: [0, 100 / 3, 200 / 3, 100] }
};

function createState(edit?: (state: WallpaperPanelState, actions: MockActions) => void) {
  const actions = createActions();
  const state = createDefaultPanelState();
  state.actions = actions;
  state.header.helpUrl = 'https://lumno.kubai.design/help/newtab-wallpaper/';
  state.header.helpText = 'Visit the Help Center';
  state.theme.infoTooltip = 'Global: the default theme for all pages.';
  state.wallpaper.builtIn.tiles = [
    { id: 'coast', label: 'Select Coast', path: '/coast.webp', selected: true, thumbnailUrl: '/coast-thumb.webp' },
    { id: 'field', label: 'Select Field', path: '/field.webp', selected: false, thumbnailUrl: '/field-thumb.webp' }
  ];
  state.theme.modes = ['system', 'light', 'dark'].map((mode) => ({
    ariaLabel: `Switch to ${mode}`,
    label: mode,
    mode,
    selected: mode === 'system'
  }));
  state.favicon.options = [
    { id: 'default', label: 'Select Default favicon', selected: true },
    { id: 'alternate', label: 'Select Alternate favicon', selected: false }
  ];
  edit?.(state, actions);
  return { actions, state };
}

function mount(state: WallpaperPanelState, model: WallpaperPanelModel = MODEL) {
  act(() => {
    controller = createWallpaperViewController({ documentObj: document, model, state });
  });
  if (!controller) {
    throw new Error('Expected wallpaper view controller');
  }
  document.body.appendChild(controller.control);
  return controller;
}

function rerender(state: WallpaperPanelState) {
  act(() => controller?.render(state));
}

function refs() {
  return controller!.getRefs();
}

function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
}

function typeInto(input: HTMLInputElement, value: string) {
  act(() => {
    setNativeValue(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function key(target: HTMLElement, name: string) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: name }));
  });
}

describe('New Tab React wallpaper view', () => {
  it('renders the complete appearance panel contract', () => {
    const { state } = createState();
    mount(state);
    const view = controller!;
    expect(createWallpaperViewApi().implementation).toBe('react');
    expect(view.control.dataset.reactIsland).toBe('newtab-wallpaper');
    expect(view.control.dataset.panelOpen).toBe('false');
    expect(refs().builtInGrid).toBeTruthy();
    // Sections other runtimes fill in keep their element contract.
    expect(refs().quoteEnabledToggle.getAttribute('role')).toBe('switch');
    expect(refs().quoteBody.hidden).toBe(true);
    const quoteTabGroups = refs().quoteBody.querySelectorAll('.x-nt-segmented-tabs');
    expect(Array.from(quoteTabGroups, (group) => group.getAttribute('data-wallpaper-ref')))
      .toEqual(['quoteCategory']);
    expect(quoteTabGroups[0].querySelector('.x-nt-segmented-tabs-indicator')).not.toBeNull();
    const onQuotePositionChange = vi.fn();
    act(() => {
      view.renderQuotePositionSelect({
        ariaLabel: 'Quote position',
        onChange: onQuotePositionChange,
        options: ['top', 'input', 'search', 'bottom'].map((value) => ({ value, label: value })),
        value: 'search'
      });
    });
    const quotePositionHost = refs().quotePositionSelectHost;
    expect(quotePositionHost.classList.contains('_x_extension_custom_select_2024_unique_')).toBe(true);
    expect(quotePositionHost.querySelector('select')?.value).toBe('search');
    const topOption = document.querySelector<HTMLElement>(
      '[data-react-select-owner="x-nt-quote-position"] [data-value="top"]'
    );
    expect(view.containsSelectMenuTarget(topOption)).toBe(true);
    act(() => {
      topOption?.click();
    });
    expect(onQuotePositionChange).toHaveBeenCalledWith('top');
    expect(refs().quoteInfoButton.previousElementSibling).toBe(refs().quoteAccordionTrigger);
    const sectionTriggers = Array.from(
      view.control.querySelectorAll<HTMLButtonElement>('.x-nt-section-trigger')
    );
    expect(sectionTriggers.map((trigger) => trigger.dataset.wallpaperRef)).toEqual([
      'themeSectionTrigger',
      'searchSectionTrigger',
      'shortcutsAccordionTrigger',
      'bookmarkSettingsTrigger',
      'recentSettingsTrigger',
      'quoteAccordionTrigger',
      'wallpaperAccordionTrigger',
      'faviconSectionTrigger'
    ]);
    sectionTriggers.forEach((trigger) => {
      expect(trigger.firstElementChild?.classList.contains('x-nt-section-chevron')).toBe(true);
      expect(trigger.lastElementChild?.classList.contains('x-nt-wallpaper-panel-title')).toBe(true);
      expect(view.control.querySelector(`#${trigger.getAttribute('aria-controls')}`)).not.toBeNull();
    });
    expect(refs().bingDailyInfoButton.closest('.x-nt-appearance-setting-title-group')).not.toBeNull();
    expect(refs().bingSelectedLink.classList.contains('x-lumno-link-button')).toBe(true);
    expect(refs().bingSelectedLink.getAttribute('target')).toBe('_blank');
    expect(refs().moreSettingsLink.querySelector('.ri-external-link-line')).not.toBeNull();
    const helpFooterLink = refs().helpFooterLink;
    expect(helpFooterLink.getAttribute('href')).toBe('https://lumno.kubai.design/help/newtab-wallpaper/');
    expect(helpFooterLink.textContent).toBe('Visit the Help Center');
    expect(refs().helpFooterPrompt.parentElement).toBe(helpFooterLink.parentElement);
    // Pinned under the scroll area, so it stays visible while settings scroll.
    expect(helpFooterLink.closest('.x-nt-wallpaper-panel-scroll')).toBeNull();
    expect(helpFooterLink.closest('.x-nt-wallpaper-panel')?.lastElementChild)
      .toBe(helpFooterLink.parentElement);
    expect(refs().bingTab.textContent).toBe('Bing');
    expect(refs().bingSelectedSource.hidden).toBe(true);
    expect(refs().bingRefresh.closest('.x-nt-overlay-control-header')).not.toBeNull();
    expect(refs().effectSelectHost.closest('.x-nt-appearance-setting-row'))
      .toBe(refs().effectLabel.parentElement);
    const sliderRows = view.control.querySelectorAll<HTMLElement>('.x-nt-range-slider-row');
    expect(sliderRows).toHaveLength(16);
    sliderRows.forEach((row) => {
      const slider = row.querySelector<HTMLInputElement>('input[type="range"]');
      const valueInput = row.querySelector<HTMLInputElement>('input[type="number"]');
      expect(slider).not.toBeNull();
      expect(row.classList.contains('x-range-slider-field')).toBe(true);
      expect(valueInput?.max).toBe(slider?.max);
      expect(valueInput?.classList.contains('_x_extension_range_slider_value_input_2026_unique_')).toBe(true);
    });
    [refs().effectInkToneOptions, refs().topContentTabs, refs().modeTabs, refs().tabs].forEach((group) => {
      expect(group.classList.contains('x-nt-segmented-tabs')).toBe(true);
      expect(group.querySelector('.x-nt-segmented-tabs-indicator')).not.toBeNull();
    });
    // Shortcuts follow input auto-focus in the search section's reading order.
    expect(refs().inputAutoFocusToggle.compareDocumentPosition(refs().shortcutsAccordion)
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refs().topContentTabs.getAttribute('role')).toBe('group');
    expect(refs().topContentBrandTab.getAttribute('aria-pressed')).toBe('true');
    expect(refs().inputAutoFocusInfoButton.querySelector('.ri-information-line')).not.toBeNull();
  });

  it('renders every setting from the state and re-renders in place', () => {
    const { state } = createState();
    mount(state);
    const panel = controller!.panel;
    const { state: next } = createState((draft) => {
      draft.open = true;
      draft.button = { active: true, label: 'Appearance' };
      draft.search.topContent.tabs.active = 'time';
      draft.search.timeWeight = { ...draft.search.timeWeight, value: 600, visible: true };
      draft.search.seconds = { ...draft.search.seconds, visible: true, toggle: { checked: true, label: 'Show seconds' } };
      draft.wallpaper.overlay = { ...draft.wallpaper.overlay, value: 72 };
      draft.wallpaper.effect.sliders.spacing = {
        ...draft.wallpaper.effect.sliders.spacing,
        suffix: '%',
        value: 40,
        valueText: '40%',
        visible: true
      };
      draft.wallpaper.builtIn.tiles = draft.wallpaper.builtIn.tiles.map((tile) => ({
        ...tile,
        selected: tile.id === 'field'
      }));
      draft.favicon.options = draft.favicon.options.map((option) => ({ ...option, selected: option.id === 'alternate' }));
    });
    // Another runtime opened its section; a re-render must leave that alone.
    refs().quoteBody.hidden = false;
    rerender(next);
    expect(controller!.panel).toBe(panel);
    expect(refs().quoteBody.hidden).toBe(false);
    expect(panel.dataset.open).toBe('true');
    expect(controller!.control.dataset.panelOpen).toBe('true');
    expect(refs().button.getAttribute('aria-expanded')).toBe('true');
    expect(refs().button.dataset.active).toBe('true');
    expect(refs().topContentTimeTab.dataset.active).toBe('true');
    expect(refs().topContentBrandTab.dataset.active).toBe('false');
    expect(refs().topContentWeightControl.hidden).toBe(false);
    expect((refs().topContentWeightSlider as HTMLInputElement).value).toBe('600');
    expect((refs().topContentSecondsToggle as HTMLInputElement).checked).toBe(true);
    expect((refs().overlaySlider as HTMLInputElement).value).toBe('72');
    expect((refs().overlaySliderValueInput as HTMLInputElement).value).toBe('72');
    expect(refs().effectSpacingControl.dataset.visible).toBe('true');
    expect(refs().effectSpacingSlider.getAttribute('aria-valuetext')).toBe('40%');
    expect(refs().effectSpacingSlider.closest('.x-nt-range-slider-row')?.getAttribute('data-value-suffix')).toBe('%');
    expect(refs().effectSizeSlider.parentElement?.dataset.disabled).toBe('true');
    const selectedTiles = Array.from(
      refs().builtInGrid.querySelectorAll<HTMLElement>('.x-nt-wallpaper-tile'),
      (tile) => [tile.dataset.wallpaperId, tile.dataset.selected, tile.getAttribute('aria-pressed')]
    );
    expect(selectedTiles).toEqual([['coast', 'false', 'false'], ['field', 'true', 'true']]);
    expect(refs().faviconOptions.querySelector('[data-newtab-favicon-id="alternate"]')?.getAttribute('data-selected'))
      .toBe('true');
  });

  it('reports every control through the actions', () => {
    const { actions, state } = createState((draft) => {
      draft.wallpaper.local.tiles = [
        { id: 'custom-1', label: 'Select Mine', selected: false, thumbnailUrl: 'data:image/png;base64,AA==' }
      ];
      draft.wallpaper.bing.tiles = [
        { id: 'bing-1', label: 'Select Bridge', selected: false, thumbnailUrl: '/b.jpg', tooltip: 'Bridge · 2026-10-01' }
      ];
      draft.wallpaper.curated.tiles = [
        { id: 'picsum-28', label: 'Select Photo', selected: false, thumbnailUrl: '/c.jpg', tooltip: 'Photo' }
      ];
      draft.wallpaper.curated.category.tabs = {
        active: 'nature',
        options: [{ label: 'Nature', value: 'nature' }, { label: 'City', value: 'city' }]
      };
    });
    mount(state);
    act(() => (refs().button as HTMLButtonElement).click());
    expect(actions.togglePanel).toHaveBeenCalledTimes(1);
    act(() => refs().builtInGrid.querySelector<HTMLElement>('[data-wallpaper-id="field"]')!.click());
    expect(actions.selectWallpaper).toHaveBeenCalledWith('field');
    const customTile = refs().localGrid.querySelector<HTMLElement>('[data-wallpaper-id="custom-1"]')!;
    act(() => customTile.querySelector<HTMLElement>('.x-nt-wallpaper-delete-button')!.click());
    expect(actions.deleteWallpaper).toHaveBeenCalledWith('custom-1');
    expect(actions.selectWallpaper).toHaveBeenCalledTimes(1);
    key(customTile, 'Enter');
    expect(actions.selectWallpaper).toHaveBeenLastCalledWith('custom-1');
    act(() => refs().bingItemsHost.querySelector<HTMLElement>('[data-wallpaper-id="bing-1"]')!.click());
    expect(actions.selectBingWallpaper).toHaveBeenCalledWith('bing-1');
    act(() => {
      refs().bingItemsHost.querySelector('[data-wallpaper-id="bing-1"]')!
        .dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(actions.showTooltip).toHaveBeenCalledWith(expect.any(HTMLElement), 'Bridge · 2026-10-01');
    act(() => refs().curatedItemsHost.querySelector<HTMLElement>('[data-wallpaper-id="picsum-28"]')!.click());
    expect(actions.selectCuratedWallpaper).toHaveBeenCalledWith('picsum-28');
    act(() => refs().curatedCategoryTabs.querySelector<HTMLElement>('[data-curated-category="city"]')!.click());
    expect(actions.selectCuratedCategory).toHaveBeenCalledWith('city');
    act(() => (refs().enabledToggle as HTMLInputElement).click());
    expect(actions.setWallpaperEnabled).toHaveBeenCalledWith(false);
    act(() => (refs().modeSyncToggle as HTMLInputElement).click());
    expect(actions.setModeSync).toHaveBeenCalledWith(false);
    act(() => (refs().bingDailyToggle as HTMLInputElement).click());
    expect(actions.setBingDaily).toHaveBeenCalledWith(true);
    act(() => (refs().bingRefresh as HTMLButtonElement).click());
    expect(actions.refreshBing).toHaveBeenCalled();
    act(() => refs().appearanceScopeTabs.querySelector<HTMLElement>('[data-theme-scope="home"]')!.click());
    expect(actions.selectThemeScope).toHaveBeenCalledWith('home');
    act(() => refs().appearanceOptions.querySelector<HTMLElement>('[data-theme-mode="dark"]')!.click());
    expect(actions.selectThemeMode).toHaveBeenCalledWith('dark');
    act(() => refs().effectInkToneOptions.querySelector<HTMLElement>('[data-wallpaper-effect-ink-tone="light"]')!.click());
    expect(actions.selectInkTone).toHaveBeenCalledWith('light');
    act(() => refs().faviconOptions.querySelector<HTMLElement>('[data-newtab-favicon-id="alternate"]')!.click());
    expect(actions.selectFavicon).toHaveBeenCalledWith('alternate');
    act(() => refs().topContentTimeTab.click());
    expect(actions.selectTopContent).toHaveBeenCalledWith('time');
    act(() => (refs().inputAutoFocusToggle as HTMLInputElement).click());
    expect(actions.setInputAutoFocus).toHaveBeenCalledWith(true);
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const fileInput = refs().customInput as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    act(() => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(actions.importWallpaperFile).toHaveBeenCalledWith(file);
    act(() => refs().appearanceInfoButton.focus());
    expect(actions.showTooltip).toHaveBeenLastCalledWith(refs().appearanceInfoButton, state.theme.infoTooltip);
  });

  it('selects the filter from the state and reports a new one', () => {
    const { actions, state } = createState((draft) => {
      draft.wallpaper.effect.select = {
        ariaLabel: 'Wallpaper filter',
        options: [{ value: 'none', label: 'Off' }, { value: 'grain', label: 'Grain' }],
        value: 'none'
      };
    });
    mount(state);
    const host = refs().effectSelectHost;
    expect(host.querySelector('select')?.value).toBe('none');
    expect(host.querySelector('._x_extension_select_label_2024_unique_')?.textContent).toBe('Off');
    const grainOption = document.querySelector<HTMLElement>(
      '[data-react-select-owner="x-nt-wallpaper-effect"] [data-value="grain"]'
    );
    expect(controller!.containsSelectMenuTarget(grainOption)).toBe(true);
    act(() => grainOption?.click());
    expect(actions.selectEffect).toHaveBeenCalledWith('grain');
  });

  it('moves between source tabs with the arrow keys as one tab stop', () => {
    const { actions, state } = createState();
    mount(state);
    const tabs = Array.from(refs().tabs.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(refs().tabs.getAttribute('role')).toBe('tablist');
    expect(tabs.map((tab) => [tab.dataset.wallpaperTab, tab.tabIndex, tab.getAttribute('aria-selected')])).toEqual([
      ['built-in', 0, 'true'],
      ['local', -1, 'false'],
      ['bing', -1, 'false'],
      ['curated', -1, 'false']
    ]);
    tabs.forEach((tab) => {
      const panel = document.getElementById(tab.getAttribute('aria-controls') || '');
      expect(panel?.getAttribute('role')).toBe('tabpanel');
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
    });
    expect(refs().builtInGrid.getAttribute('aria-hidden')).toBe('false');
    expect(refs().bingPanel.getAttribute('aria-hidden')).toBe('true');

    key(tabs[0], 'ArrowRight');
    expect(actions.selectSourceTab).toHaveBeenLastCalledWith('local');
    expect(document.activeElement).toBe(tabs[1]);
    key(tabs[0], 'ArrowLeft');
    expect(actions.selectSourceTab).toHaveBeenLastCalledWith('curated');
    expect(document.activeElement).toBe(tabs[3]);
    key(tabs[0], 'End');
    expect(actions.selectSourceTab).toHaveBeenLastCalledWith('curated');
    const callsBeforeHome = actions.selectSourceTab.mock.calls.length;
    key(tabs[0], 'Home');
    // Home lands on the tab that is already selected, so nothing changes.
    expect(actions.selectSourceTab.mock.calls.length).toBe(callsBeforeHome);
    expect(document.activeElement).toBe(tabs[0]);

    const { state: next } = createState((draft) => {
      draft.wallpaper.activeTab = 'bing';
      draft.wallpaper.source.tabs.active = 'bing';
    });
    rerender(next);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, -1, 0, -1]);
    expect(refs().body.dataset.activeTab).toBe('bing');
    expect(refs().bingPanel.getAttribute('aria-hidden')).toBe('false');
    expect(refs().builtInGrid.getAttribute('aria-hidden')).toBe('true');
  });

  it('slides the segmented indicator under the selected option', () => {
    // jsdom has no layout: give each source tab a box from its position in the row.
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const tab = (this as HTMLElement).dataset?.wallpaperTab;
      const index = ['built-in', 'local', 'bing', 'curated'].indexOf(tab || '');
      const left = index >= 0 ? 10 + index * 60 : 0;
      const width = index >= 0 ? 56 : 300;
      return { bottom: 30, height: 30, left, right: left + width, top: 0, width, x: left, y: 0, toJSON() {} } as DOMRect;
    });
    const offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
    const { state } = createState();
    mount(state);
    const indicator = refs().tabsIndicator;
    expect(indicator.style.width).toBe('56px');
    expect(indicator.style.transform).toBe('translateX(10px)');
    expect(indicator.dataset.ready).toBe('true');
    const { state: next } = createState((draft) => {
      draft.wallpaper.activeTab = 'bing';
      draft.wallpaper.source.tabs.active = 'bing';
    });
    rerender(next);
    expect(indicator.style.transform).toBe('translateX(130px)');
    rect.mockRestore();
    offsetWidth.mockRestore();
  });

  it('shows the light and dark tabs only for separate wallpapers, with keyboard support', () => {
    const { actions, state } = createState();
    mount(state);
    expect(refs().modeRow.dataset.visible).toBe('false');
    const { state: split } = createState((draft) => {
      draft.wallpaper.mode.visible = true;
      draft.wallpaper.mode.tabs.active = 'dark';
      draft.wallpaper.modeSync.toggle = { checked: false, label: 'Same wallpaper' };
    });
    split.actions = actions;
    rerender(split);
    expect(refs().modeRow.dataset.visible).toBe('true');
    expect(refs().modeRow.getAttribute('aria-hidden')).toBe('false');
    expect((refs().modeSyncToggle as HTMLInputElement).checked).toBe(false);
    expect(refs().darkModeTab.getAttribute('aria-selected')).toBe('true');
    expect(refs().darkModeTab.tabIndex).toBe(0);
    expect(refs().lightModeTab.tabIndex).toBe(-1);
    key(refs().darkModeTab, 'ArrowRight');
    expect(actions.selectWallpaperMode).toHaveBeenCalledWith('light');
  });

  it('reports slider moves, drags and typed values', () => {
    const { actions, state } = createState((draft) => {
      draft.shortcuts.columns = { ...draft.shortcuts.columns, value: 10 };
    });
    mount(state);
    act(() => (refs().shortcutsAccordionTrigger as HTMLButtonElement).click());
    const slider = refs().shortcutColumnsSlider as HTMLInputElement;
    const valueInput = refs().shortcutColumnsSliderValueInput as HTMLInputElement;
    expect([slider.min, slider.max, slider.step, slider.value]).toEqual(['4', '16', '1', '10']);
    const marks = slider.style.getPropertyValue('--x-range-slider-marks');
    expect(marks.match(/linear-gradient/g)).toHaveLength(2);

    typeInto(slider, '7');
    expect(actions.setShortcutColumns).toHaveBeenLastCalledWith(7, { dragging: false, final: false });
    // The runtime answers with the new value; the end of the move then saves it.
    const { state: moved } = createState((draft) => {
      draft.shortcuts.columns = { ...draft.shortcuts.columns, value: 7 };
    });
    moved.actions = actions;
    rerender(moved);
    act(() => {
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(actions.setShortcutColumns).toHaveBeenLastCalledWith(7, { dragging: false, final: true });
    act(() => {
      slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    typeInto(slider, '9');
    expect(actions.setShortcutColumns).toHaveBeenLastCalledWith(9, { dragging: true, final: false });
    act(() => {
      slider.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });

    // The value box keeps a draft until it is committed.
    act(() => valueInput.focus());
    typeInto(valueInput, '11');
    const callsWhileTyping = actions.setShortcutColumns.mock.calls.length;
    expect(valueInput.value).toBe('11');
    key(valueInput, 'Enter');
    expect(actions.setShortcutColumns.mock.calls.length).toBe(callsWhileTyping + 1);
    expect(actions.setShortcutColumns).toHaveBeenLastCalledWith(11, { dragging: false, final: true });
    expect(valueInput.value).toBe('7');
    // Digits beyond the range snap to its end while typing.
    act(() => valueInput.focus());
    typeInto(valueInput, '99');
    expect(valueInput.value).toBe('16');
    act(() => valueInput.blur());
    expect(actions.setShortcutColumns).toHaveBeenLastCalledWith(16, { dragging: false, final: true });
    // An empty draft falls back to the current value without reporting anything.
    const callsBeforeEmpty = actions.setShortcutColumns.mock.calls.length;
    act(() => valueInput.focus());
    typeInto(valueInput, '');
    act(() => valueInput.blur());
    expect(actions.setShortcutColumns.mock.calls.length).toBe(callsBeforeEmpty);
    expect(valueInput.value).toBe('7');
  });

  it('shows the slider value in a bubble while the thumb is dragged', async () => {
    const { state } = createState((draft) => {
      draft.wallpaper.overlay = { ...draft.wallpaper.overlay, value: 64 };
    });
    mount(state);
    const slider = refs().overlaySlider as HTMLInputElement;
    act(() => {
      slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    });
    const bubble = document.getElementById('_x_extension_newtab_slider_value_bubble_2026_unique_');
    expect(bubble?.textContent).toBe('64');
    expect(bubble?.dataset.visible).toBe('true');
    expect(bubble?.parentElement).toBe(document.body);
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup'));
    });
    expect(bubble?.dataset.visible).toBe('false');
  });

  it('folds the shortcut details and keeps them folded while shortcuts are off', () => {
    const { actions, state } = createState();
    mount(state);
    const trigger = refs().shortcutsAccordionTrigger as HTMLButtonElement;
    const details = refs().shortcutsDetails;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(details.getAttribute('role')).toBe('region');
    expect(details.hidden).toBe(true);
    expect((refs().shortcutAddToggle as HTMLInputElement).disabled).toBe(true);
    expect((refs().shortcutColumnsSlider as HTMLInputElement).disabled).toBe(true);
    expect((refs().shortcutColumnsSliderValueInput as HTMLInputElement).disabled).toBe(true);
    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(details.hidden).toBe(false);
    expect((refs().shortcutAddToggle as HTMLInputElement).disabled).toBe(false);
    expect((refs().shortcutDockMagnificationToggle as HTMLInputElement).disabled).toBe(false);
    expect((refs().shortcutColumnsSlider as HTMLInputElement).disabled).toBe(false);
    act(() => (refs().shortcutAddToggle as HTMLInputElement).click());
    expect(actions.setShortcutAddVisible).toHaveBeenCalledWith(false);
    const sizeReset = refs().shortcutSizeResetButton as HTMLButtonElement;
    expect(sizeReset.disabled).toBe(true);
    expect(sizeReset.parentElement?.classList.contains('x-range-slider-field-label')).toBe(true);

    const { state: off } = createState((draft) => {
      draft.shortcuts.enabled = false;
      draft.shortcuts.toggle = { checked: false, label: 'Shortcuts' };
    });
    rerender(off);
    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(details.hidden).toBe(true);
    act(() => trigger.click());
    expect(details.hidden).toBe(true);
    const { state: on } = createState((draft) => {
      draft.shortcuts.size = { ...draft.shortcuts.size, value: 72, resetVisible: true };
    });
    on.actions = actions;
    rerender(on);
    expect(trigger.disabled).toBe(false);
    expect(details.hidden).toBe(true);
    act(() => trigger.click());
    expect(sizeReset.disabled).toBe(false);
    act(() => sizeReset.click());
    expect(actions.resetShortcutSize).toHaveBeenCalled();
  });

  it('opens a section when its switch turns it on', () => {
    const { actions, state } = createState((draft) => {
      draft.shortcuts.enabled = false;
      draft.shortcuts.toggle = { checked: false, label: 'Shortcuts' };
    });
    mount(state);
    act(() => (refs().shortcutsToggle as HTMLInputElement).click());
    expect(actions.setShortcutsVisible).toHaveBeenCalledWith(true);
    const { state: shortcutsOn } = createState();
    shortcutsOn.actions = actions;
    rerender(shortcutsOn);
    expect(refs().shortcutsAccordionTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(refs().shortcutsDetails.hidden).toBe(false);

    act(() => refs().wallpaperAccordionTrigger.click());
    expect(refs().body.getAttribute('data-visible')).toBe('false');
    const { state: wallpaperOff } = createState((draft) => {
      draft.wallpaper.enabled = false;
      draft.wallpaper.toggle = { ...draft.wallpaper.toggle, checked: false };
    });
    wallpaperOff.actions = actions;
    rerender(wallpaperOff);
    act(() => (refs().enabledToggle as HTMLInputElement).click());
    expect(actions.setWallpaperEnabled).toHaveBeenCalledWith(true);
    rerender(shortcutsOn);
    expect(refs().body.getAttribute('data-visible')).toBe('true');
  });

  it('folds and unfolds the sections without switches', () => {
    const { state } = createState();
    mount(state);
    [
      ['themeSectionTrigger', 'themeSectionBody'],
      ['searchSectionTrigger', 'searchSectionBody'],
      ['faviconSectionTrigger', 'faviconSectionBody']
    ].forEach(([triggerName, bodyName]) => {
      const trigger = refs()[triggerName];
      const body = refs()[bodyName];
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(body.hidden).toBe(false);
      act(() => trigger.click());
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(body.hidden).toBe(true);
      expect(body.getAttribute('aria-hidden')).toBe('true');
    });
    const wallpaperTrigger = refs().wallpaperAccordionTrigger;
    expect(refs().body.dataset.visible).toBe('true');
    act(() => wallpaperTrigger.click());
    expect(refs().body.dataset.visible).toBe('false');
    expect(wallpaperTrigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('submits the link form and clears it once the runtime saves the link', () => {
    const { actions, state } = createState((draft) => {
      draft.wallpaper.local.url = { ...draft.wallpaper.local.url, open: true, placeholder: 'Paste' };
    });
    mount(state);
    expect(refs().urlForm.hidden).toBe(false);
    expect(refs().urlTile.getAttribute('aria-expanded')).toBe('true');
    expect(refs().urlTile.getAttribute('aria-controls')).toBe(refs().urlForm.id);
    const input = refs().urlInput as HTMLInputElement;
    typeInto(input, 'https://example.com/a.jpg');
    act(() => {
      refs().urlForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(actions.submitWallpaperUrl).toHaveBeenCalledWith('https://example.com/a.jpg');
    const { state: invalid } = createState((draft) => {
      draft.wallpaper.local.url = { ...draft.wallpaper.local.url, invalid: true, open: true };
    });
    invalid.actions = actions;
    rerender(invalid);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('https://example.com/a.jpg');
    typeInto(input, 'https://example.com/b.jpg');
    expect(actions.clearUrlInvalid).toHaveBeenCalled();
    const { state: saved } = createState((draft) => {
      draft.wallpaper.local.url = { ...draft.wallpaper.local.url, clearToken: 1, open: false };
    });
    saved.actions = actions;
    rerender(saved);
    expect(refs().urlForm.hidden).toBe(true);
    expect(input.value).toBe('');
    act(() => refs().urlTile.click());
    expect(actions.toggleUrlForm).toHaveBeenCalled();
  });

  it('renders the bookmark and site card sections for their runtime', () => {
    const { state } = createState();
    mount(state);
    const shortcutsSection = refs().shortcutsAccordion.parentElement;
    expect(shortcutsSection?.nextElementSibling?.nextElementSibling).toBe(refs().bookmarkSettingsSection);
    expect(refs().bookmarkSettingsSection.nextElementSibling?.nextElementSibling).toBe(refs().recentSettingsSection);
    expect(refs().recentSettingsSection.nextElementSibling).toBe(refs().quoteDivider);
    [
      [refs().bookmarkSettingsTrigger, refs().bookmarkSettingsBody, refs().bookmarkSettingsToggle],
      [refs().recentSettingsTrigger, refs().recentSettingsBody, refs().recentSettingsToggle]
    ].forEach(([trigger, body, toggle]) => {
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-controls')).toBe(body.id);
      expect(body.hidden).toBe(true);
      expect(toggle.getAttribute('role')).toBe('switch');
    });
    const rows = refs().bookmarkRowsSlider as HTMLInputElement;
    expect([rows.min, rows.max, rows.step]).toEqual(['1', '8', '1']);
    expect(Array.from(refs().recentRowsTabs.querySelectorAll('button'), (button) => button.textContent))
      .toEqual(['1', '2']);
    const onViewModeChange = vi.fn();
    const onSurfaceChange = vi.fn(() => false);
    act(() => {
      controller?.renderBookmarkViewModeSelect({
        ariaLabel: 'Display mode',
        onChange: onViewModeChange,
        options: ['folder', 'list', 'top'].map((value) => ({ value, label: value })),
        value: 'folder'
      });
      controller?.renderBookmarkTopbarSurfaceSelect({
        ariaLabel: 'Bar background',
        onChange: onSurfaceChange,
        options: ['adaptive', 'custom'].map((value) => ({
          value,
          label: value,
          radio: true,
          checked: value === 'adaptive'
        })),
        value: 'adaptive'
      });
    });
    expect(refs().bookmarkViewModeSelectHost.querySelector('select')?.value).toBe('folder');
    const topOption = document.querySelector<HTMLElement>(
      '[data-react-select-owner="x-nt-bookmark-view-mode"] [data-value="top"]'
    );
    act(() => topOption?.click());
    expect(onViewModeChange).toHaveBeenCalledWith('top');
    const customOption = document.querySelector<HTMLElement>(
      '[data-react-select-owner="x-nt-bookmark-topbar-surface"] [data-value="custom"]'
    );
    act(() => customOption?.click());
    expect(onSurfaceChange).toHaveBeenCalledWith('custom');
    // Declined until the picker returns a color.
    expect(refs().bookmarkTopbarSurfaceSelectHost.querySelector('select')?.value).toBe('adaptive');
    // A panel re-render keeps the selects other runtimes rendered, with their own state.
    const viewModeSelect = refs().bookmarkViewModeSelectHost.querySelector('select');
    rerender(createState().state);
    expect(refs().bookmarkViewModeSelectHost.querySelector('select')).toBe(viewModeSelect);
    expect(viewModeSelect?.value).toBe('top');
  });

  it('closes an open select menu on request', () => {
    const { state } = createState((draft) => {
      draft.wallpaper.effect.select = {
        ariaLabel: 'Wallpaper filter',
        options: [{ value: 'none', label: 'Off' }, { value: 'grain', label: 'Grain' }],
        value: 'none'
      };
    });
    mount(state);
    expect(controller!.closeOpenSelect()).toBe(false);
    act(() => refs().effectSelectHost.querySelector<HTMLButtonElement>('button')!.click());
    expect(refs().effectSelectHost.dataset.open).toBe('true');
    let closed = false;
    act(() => {
      closed = controller!.closeOpenSelect({ restoreFocus: true });
    });
    expect(closed).toBe(true);
    expect(refs().effectSelectHost.dataset.open).toBe('false');
    expect(document.activeElement).toBe(refs().effectSelectHost.querySelector('button'));
  });

  it('preserves zero as an explicit shortcut spacing value', () => {
    const { state } = createState((draft) => {
      draft.shortcuts.gap = { ...draft.shortcuts.gap, value: 0 };
    });
    mount(state);
    expect((refs().shortcutGapSlider as HTMLInputElement).value).toBe('0');
    expect((refs().shortcutGapSliderValueInput as HTMLInputElement).value).toBe('0');
  });
});
