import type {
  DailyState,
  SelectedSourceState,
  WallpaperPanelActions,
  WallpaperPanelState
} from './wallpaper-view';
import type { SliderState, ToggleState } from './wallpaper-panel-controls';

// A complete panel state with English labels, for tests to edit; the runtime builds
// the real one (src/newtab/wallpaper.js).

const noop = () => {};

function createNoopActions(): WallpaperPanelActions {
  return new Proxy({} as WallpaperPanelActions, {
    get: () => noop
  });
}

const slider = (label: string, value: number, min: number, max: number, extra: Partial<SliderState> = {}): SliderState => ({
  label,
  max,
  min,
  value,
  ...extra
});

const toggle = (label: string, checked = false): ToggleState => ({ checked, label });

const daily = (label: string): DailyState => ({
  infoTooltip: '',
  label,
  restoreLabel: '',
  restoreVisible: false,
  toggle: toggle(label)
});

const noSource: SelectedSourceState = { linkLabel: '', meta: '', title: '', url: '', visible: false };

export function createDefaultPanelState(): WallpaperPanelState {
  const effectSlider = (label: string) => ({ ...slider(label, 50, 0, 100, { disabled: true }), visible: false });
  return {
    actions: createNoopActions(),
    button: { active: false, label: 'Appearance' },
    favicon: { options: [], title: 'New Tab favicon' },
    header: {
      helpPrompt: '',
      helpText: '',
      helpUrl: '',
      moreSettingsLabel: 'More settings',
      moreSettingsUrl: '',
      title: 'Appearance settings'
    },
    open: false,
    panelLabel: 'Appearance',
    quote: { infoTooltip: '' },
    search: {
      autoFocus: { infoLabel: '', infoTooltip: '', title: '', toggle: toggle('Automatically focus input') },
      seconds: { title: 'Show seconds', toggle: toggle('Show seconds'), visible: false },
      timeWeight: {
        ...slider('Time font weight', 320, 300, 800),
        resetLabel: '',
        resetVisible: false,
        visible: false
      },
      title: 'Search box',
      topContent: {
        tabs: {
          active: 'brand',
          options: [
            { label: 'Brand', value: 'brand' },
            { label: 'Time', value: 'time' },
            { label: 'Hide', value: 'off' }
          ]
        },
        title: 'Content above the search bar'
      },
      width: slider('Search box width', 920, 720, 1040, { suffix: ' px' })
    },
    shortcuts: {
      add: { title: 'Show “+”', toggle: toggle('Show “+”', true) },
      columns: slider('Shortcuts per row', 10, 4, 16),
      dock: { title: '', toggle: toggle('', true) },
      enabled: true,
      gap: { ...slider('Shortcut spacing', 4, 0, 24, { suffix: ' px' }), resetLabel: '', resetVisible: false },
      size: { ...slider('Shortcut size', 64, 48, 80, { suffix: ' px' }), resetLabel: '', resetVisible: false },
      title: 'Shortcuts',
      toggle: toggle('Shortcuts', true)
    },
    theme: {
      infoLabel: '',
      infoTooltip: '',
      modes: [],
      scope: {
        active: 'global',
        options: [
          { label: 'Global', value: 'global' },
          { label: 'New Tab', value: 'home' }
        ]
      },
      title: 'Theme mode'
    },
    wallpaper: {
      activeTab: 'built-in',
      bing: {
        busy: false,
        daily: { ...daily('Auto-update daily'), busy: false },
        label: 'Bing',
        loading: false,
        recentLabel: '',
        refresh: { busy: false, disabled: false, label: 'Refresh' },
        selected: noSource,
        status: '',
        tiles: []
      },
      builtIn: { label: 'Built-in', tiles: [] },
      curated: {
        category: { label: 'Category', tabs: { active: '', options: [] } },
        daily: daily('Auto-update daily'),
        label: 'Curated',
        listLabel: '',
        refreshLabel: '',
        selected: noSource,
        tiles: []
      },
      effect: {
        inkTone: {
          label: 'Sample tones',
          tabs: {
            active: 'dark',
            options: [
              { label: 'Shadows', value: 'dark' },
              { label: 'Highlights', value: 'light' }
            ]
          },
          visible: false
        },
        label: 'Wallpaper filter',
        select: { ariaLabel: 'Wallpaper filter', options: [], value: 'none' },
        sliders: {
          crtBloom: effectSlider('Bloom'),
          crtCurvature: effectSlider('Screen curvature'),
          crtRgbOffset: effectSlider('RGB offset'),
          size: effectSlider('Size'),
          spacing: effectSlider('Spacing'),
          strength: effectSlider('Sampling strength'),
          texture: effectSlider('Texture')
        }
      },
      enabled: true,
      local: {
        deleteLabel: '',
        label: 'Local',
        tiles: [],
        upload: { label: 'Add local wallpaper', loading: false },
        url: {
          clearToken: 0,
          disabled: false,
          inputLabel: 'Add image link',
          invalid: false,
          open: false,
          placeholder: '',
          submitLabel: 'Add',
          tileLabel: 'Add image link'
        }
      },
      mode: {
        label: 'Mode',
        tabs: {
          active: 'light',
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' }
          ]
        },
        visible: false
      },
      modeSync: { title: '', toggle: toggle('', true) },
      overlay: slider('Mask effect', 50, 0, 100),
      source: {
        label: 'Source',
        tabs: {
          active: 'built-in',
          options: [
            { label: 'Built-in', value: 'built-in' },
            { label: 'Local', value: 'local' },
            { label: 'Bing', value: 'bing' },
            { label: 'Curated', value: 'curated' }
          ]
        }
      },
      title: 'Wallpaper',
      toggle: toggle('Toggle wallpaper', true)
    }
  };
}

