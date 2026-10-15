import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from 'react';
import { SelectMenu, type SelectMenuOption } from './select-menu';
import type { SelectMenuControls } from '../shared/select-menu';
import { LinkButton } from '../shared/link-button';
import { RangeSliderField } from '../shared/range-slider';
import {
  PanelSlider,
  ref,
  SegmentedChoice,
  Switch,
  tooltipHandlers,
  useSliderValueBubble,
  type SegmentState,
  type SliderBubble,
  type SliderChange,
  type SliderState,
  type ToggleState,
  type TooltipActions
} from './wallpaper-panel-controls';

// The appearance panel renders from two inputs: a static model (asset URLs, icons,
// slider marks) given once, and the state the wallpaper runtime rebuilds whenever a
// setting changes. Every control reports through `state.actions`; the runtime owns
// the data and its storage. The bookmark, site card and quote sections are filled
// by their own runtimes through data-wallpaper-ref elements and stay static here.

export type WallpaperSourceTab = 'built-in' | 'local' | 'bing' | 'curated';
export type WallpaperMode = 'light' | 'dark';
export type ThemeScope = 'global' | 'home';
export type TopContentMode = 'brand' | 'time' | 'off';
export type EffectSliderKey =
  | 'strength'
  | 'size'
  | 'spacing'
  | 'texture'
  | 'crtBloom'
  | 'crtRgbOffset'
  | 'crtCurvature';

export const EFFECT_SLIDER_KEYS: EffectSliderKey[] = [
  'strength',
  'size',
  'spacing',
  'texture',
  'crtBloom',
  'crtRgbOffset',
  'crtCurvature'
];

type WallpaperItem = {
  id: string;
  path?: string;
  thumbnailUrl: string;
};

type FaviconItem = {
  id: string;
  inlineSvg?: string;
  previewUrl?: string;
};

export interface WallpaperPanelModel {
  appearanceOptions?: Array<{ imageUrl: string; mode: string }>;
  favicons?: FaviconItem[];
  icons?: Partial<Record<
    'add' | 'arrow' | 'check' | 'delete' | 'info' | 'link' | 'refresh' | 'restore' | 'wallpaper',
    string
  >>;
  quoteFontSize?: { defaultValue?: number; max?: number; min?: number };
  /** Notches (0-100) drawn on each slider's track. */
  marks?: Partial<Record<'searchWidth' | 'shortcutColumns' | 'shortcutSize' | 'shortcutGap' | 'timeWeight', number[]>>;
  wallpapers?: WallpaperItem[];
}

export interface TileState {
  id: string;
  label: string;
  path?: string;
  selected: boolean;
  thumbnailUrl: string;
}

export interface OnlineTileState extends TileState {
  disabled?: boolean;
  tooltip: string;
}

export interface SelectedSourceState {
  linkLabel: string;
  meta: string;
  title: string;
  url: string;
  visible: boolean;
}

export interface DailyState {
  infoTooltip: string;
  label: string;
  restoreLabel: string;
  restoreVisible: boolean;
  toggle: ToggleState;
}

export interface PanelSelectModel {
  ariaLabel: string;
  onChange(value: string): void;
  options: SelectMenuOption[];
  value: string;
}

export interface WallpaperPanelActions extends TooltipActions {
  clearUrlInvalid(): void;
  deleteWallpaper(id: string): void;
  importWallpaperFile(file: File): void;
  primeWallpaper(id: string): void;
  refreshBing(): void;
  resetShortcutGap(): void;
  resetShortcutSize(): void;
  resetTimeFontWeight(): void;
  restoreDailyWallpaper(): void;
  selectBingWallpaper(id: string): void;
  selectCuratedCategory(category: string): void;
  selectCuratedWallpaper(id: string): void;
  selectEffect(type: string): void;
  selectFavicon(id: string): void;
  selectInkTone(tone: string): void;
  selectSourceTab(tab: WallpaperSourceTab): void;
  selectThemeMode(mode: string): void;
  selectThemeScope(scope: ThemeScope): void;
  selectTopContent(mode: TopContentMode): void;
  selectWallpaper(id: string): void;
  selectWallpaperMode(mode: WallpaperMode): void;
  setBingDaily(enabled: boolean): void;
  setCuratedDaily(enabled: boolean): void;
  setEffectParameter(key: EffectSliderKey, value: number, change: SliderChange): void;
  setInputAutoFocus(enabled: boolean): void;
  setModeSync(enabled: boolean): void;
  setOverlay(value: number, change: SliderChange): void;
  setSearchWidth(value: number, change: SliderChange): void;
  setShortcutAddVisible(visible: boolean): void;
  setShortcutColumns(value: number, change: SliderChange): void;
  setShortcutDockMagnification(enabled: boolean): void;
  setShortcutGap(value: number, change: SliderChange): void;
  setShortcutSize(value: number, change: SliderChange): void;
  setShortcutsVisible(visible: boolean): void;
  setTimeFontWeight(value: number, change: SliderChange): void;
  setTimeSecondsVisible(visible: boolean): void;
  setWallpaperEnabled(enabled: boolean): void;
  showButtonTooltip(anchor: HTMLElement): void;
  showMoreCurated(): void;
  submitWallpaperUrl(url: string): void;
  togglePanel(): void;
  toggleUrlForm(): void;
}

export interface WallpaperPanelState {
  actions: WallpaperPanelActions;
  button: { active: boolean; label: string };
  favicon: {
    options: Array<{ id: string; label: string; selected: boolean }>;
    title: string;
  };
  header: {
    helpPrompt: string;
    helpText: string;
    helpUrl: string;
    moreSettingsLabel: string;
    moreSettingsUrl: string;
    title: string;
  };
  open: boolean;
  panelLabel: string;
  quote: { infoTooltip: string };
  search: {
    autoFocus: { infoLabel: string; infoTooltip: string; title: string; toggle: ToggleState };
    seconds: { title: string; toggle: ToggleState; visible: boolean };
    timeWeight: SliderState & { resetLabel: string; resetVisible: boolean; visible: boolean };
    title: string;
    topContent: { title: string; tabs: SegmentState<TopContentMode> };
    width: SliderState;
  };
  shortcuts: {
    add: { title: string; toggle: ToggleState };
    columns: SliderState;
    dock: { title: string; toggle: ToggleState };
    enabled: boolean;
    gap: SliderState & { resetLabel: string; resetVisible: boolean };
    size: SliderState & { resetLabel: string; resetVisible: boolean };
    title: string;
    toggle: ToggleState;
  };
  theme: {
    infoLabel: string;
    infoTooltip: string;
    modes: Array<{ ariaLabel: string; label: string; mode: string; selected: boolean }>;
    scope: SegmentState<ThemeScope>;
    title: string;
  };
  wallpaper: {
    activeTab: WallpaperSourceTab;
    bing: {
      busy: boolean;
      daily: DailyState & { busy: boolean };
      label: string;
      loading: boolean;
      recentLabel: string;
      refresh: { busy: boolean; disabled: boolean; label: string };
      selected: SelectedSourceState;
      status: string;
      tiles: OnlineTileState[];
    };
    builtIn: { label: string; tiles: TileState[] };
    curated: {
      category: { label: string; tabs: SegmentState };
      daily: DailyState;
      label: string;
      listLabel: string;
      refreshLabel: string;
      selected: SelectedSourceState;
      tiles: OnlineTileState[];
    };
    effect: {
      inkTone: { label: string; tabs: SegmentState; visible: boolean };
      label: string;
      select: { ariaLabel: string; options: SelectMenuOption[]; value: string };
      sliders: Record<EffectSliderKey, SliderState & { visible: boolean }>;
    };
    enabled: boolean;
    local: {
      deleteLabel: string;
      label: string;
      tiles: TileState[];
      upload: { label: string; loading: boolean };
      url: {
        clearToken: number;
        disabled: boolean;
        inputLabel: string;
        invalid: boolean;
        open: boolean;
        placeholder: string;
        submitLabel: string;
        tileLabel: string;
      };
    };
    mode: { label: string; tabs: SegmentState<WallpaperMode>; visible: boolean };
    modeSync: { title: string; toggle: ToggleState };
    overlay: SliderState;
    source: { label: string; tabs: SegmentState<WallpaperSourceTab> };
    title: string;
    toggle: ToggleState;
  };
}

const SOURCE_TAB_REFS: Record<WallpaperSourceTab, string> = {
  'built-in': 'builtInTab',
  local: 'localTab',
  bing: 'bingTab',
  curated: 'curatedTab'
};

const sourceTabId = (tab: string) => `_x_extension_newtab_wallpaper_tab_${tab}_2026_unique_`;
const sourcePanelId = (tab: string) => `_x_extension_newtab_wallpaper_panel_${tab}_2026_unique_`;

// Leading chevron + title form one disclosure hot area for every panel section.
function SectionTrigger({
  arrowIcon,
  bodyId,
  disabled,
  expanded,
  id,
  label,
  onToggle,
  title,
  titleClassName = '',
  titleRef,
  triggerRef
}: {
  arrowIcon: string;
  bodyId: string;
  disabled?: boolean;
  expanded: boolean;
  id?: string;
  label?: string;
  onToggle?(): void;
  title?: string;
  titleClassName?: string;
  titleRef: string;
  triggerRef: string;
}) {
  return (
    <button
      {...ref(triggerRef)}
      aria-controls={bodyId}
      aria-disabled={disabled === undefined ? undefined : (disabled ? 'true' : 'false')}
      aria-expanded={expanded ? 'true' : 'false'}
      aria-label={label || undefined}
      className="x-nt-section-trigger"
      disabled={disabled}
      id={id}
      onClick={onToggle}
      type="button"
    >
      <span
        aria-hidden="true"
        className="x-nt-section-chevron"
        dangerouslySetInnerHTML={{ __html: arrowIcon }}
      />
      <span
        {...ref(titleRef)}
        className={`x-nt-wallpaper-panel-title${titleClassName ? ` ${titleClassName}` : ''}`}
      >
        {title}
      </span>
    </button>
  );
}

function InfoButton({
  actions,
  icon,
  label,
  name,
  tooltip
}: {
  actions?: TooltipActions;
  icon: string;
  label?: string;
  name: string;
  tooltip?: string;
}) {
  return (
    <button
      {...ref(name)}
      {...(actions ? tooltipHandlers(actions, tooltip) : {})}
      aria-label={label || undefined}
      className="x-nt-appearance-info-button"
      dangerouslySetInnerHTML={{ __html: icon }}
      type="button"
    />
  );
}

// Sections whose content another runtime fills keep uncontrolled switches.
function StaticSwitch({ ariaLabel, name }: { ariaLabel?: string; name: string }) {
  return (
    <label className="x-nt-wallpaper-switch">
      <input {...ref(name)} aria-label={ariaLabel} role="switch" type="checkbox" />
      <span aria-hidden="true" className="x-nt-wallpaper-switch-slider" />
    </label>
  );
}

// A section whose header switch turns the page section on or off; the body ships
// collapsed and is filled in by its own runtime.
function ToggleSection({
  arrowIcon,
  children,
  name
}: {
  arrowIcon: string;
  children: ReactNode;
  name: string;
}) {
  const bodyId = `_x_extension_newtab_${name}_body_2026_unique_`;
  return (
    <div {...ref(`${name}Section`)} className="x-nt-wallpaper-section">
      <div className="x-nt-wallpaper-panel-header">
        <SectionTrigger
          arrowIcon={arrowIcon}
          bodyId={bodyId}
          expanded={false}
          titleRef={`${name}Title`}
          triggerRef={`${name}Trigger`}
        />
        <StaticSwitch name={`${name}Toggle`} />
      </div>
      <div
        {...ref(`${name}Body`)}
        className="x-nt-panel-section-body x-nt-panel-collapsible"
        hidden
        id={bodyId}
      >
        {children}
      </div>
    </div>
  );
}

function SettingRow({ children, titleRef }: { children: ReactNode; titleRef: string }) {
  return (
    <div className="x-nt-appearance-setting-row">
      <span {...ref(titleRef)} className="x-nt-appearance-setting-title" />
      {children}
    </div>
  );
}

// Segmented choice another runtime labels and selects.
function StaticRowTabs({
  attribute,
  labeled = false,
  name,
  values
}: {
  attribute: `data-${string}`;
  labeled?: boolean;
  name: string;
  values: string[];
}) {
  return (
    <div {...ref(`${name}Tabs`)} className="x-nt-segmented-tabs x-nt-wallpaper-tabs x-nt-row-tabs" role="group">
      <span
        {...ref(`${name}Indicator`)}
        aria-hidden="true"
        className="x-nt-segmented-tabs-indicator x-nt-wallpaper-tabs-indicator"
      />
      {values.map((value) => (
        <button
          {...{ [attribute]: value }}
          aria-pressed="false"
          className="x-nt-segmented-tab x-nt-wallpaper-tab"
          data-active="false"
          key={value}
          type="button"
        >
          {labeled ? value : null}
        </button>
      ))}
    </div>
  );
}

// Whole-number slider another runtime drives.
function StaticCountSlider({
  defaultValue,
  marks,
  max,
  min,
  name
}: {
  defaultValue: string;
  marks: number[];
  max: string;
  min: string;
  name: string;
}) {
  return (
    <div className="x-nt-overlay-control">
      <RangeSliderField
        label={<span {...ref(`${name}Label`)} className="x-nt-appearance-setting-title" />}
        {...ref(`${name}Slider`)}
        className="x-nt-overlay-slider-wrap"
        defaultValue={defaultValue}
        inputClass="x-nt-overlay-slider"
        max={max}
        min={min}
        rowClassName="x-nt-range-slider-row"
        step="1"
        valueInputProps={{
          ...ref(`${name}SliderValueInput`),
          defaultValue,
          inputMode: 'numeric'
        }}
        marks={marks}
      />
    </div>
  );
}

function WallpaperTile({
  checkIcon,
  onPrime,
  onSelect,
  tile
}: {
  checkIcon: string;
  onPrime?(): void;
  onSelect(): void;
  tile: TileState & { disabled?: boolean; tooltip?: string };
}) {
  return (
    <button
      aria-label={tile.label || undefined}
      aria-pressed={tile.selected ? 'true' : 'false'}
      className="x-nt-wallpaper-tile"
      data-selected={tile.selected ? 'true' : 'false'}
      data-wallpaper-id={tile.id}
      data-wallpaper-path={tile.path}
      disabled={tile.disabled}
      onClick={onSelect}
      onFocus={onPrime}
      onPointerDown={onPrime}
      onPointerEnter={onPrime}
      type="button"
    >
      <span className="x-nt-wallpaper-thumb">
        <img
          alt=""
          decoding="async"
          draggable={false}
          loading="lazy"
          src={tile.thumbnailUrl}
        />
      </span>
      <span
        className="x-nt-wallpaper-check"
        dangerouslySetInnerHTML={{
          __html: checkIcon
        }}
      />
    </button>
  );
}

function FaviconTile({
  checkIcon,
  item,
  label,
  onSelect,
  selected
}: {
  checkIcon: string;
  item: FaviconItem;
  label: string;
  onSelect(): void;
  selected: boolean;
}) {
  return (
    <button
      aria-label={label || undefined}
      aria-pressed={selected ? 'true' : 'false'}
      className="x-nt-wallpaper-tile x-nt-favicon-option"
      data-newtab-favicon-id={item.id}
      data-selected={selected ? 'true' : 'false'}
      onClick={onSelect}
      type="button"
    >
      <span className="x-nt-wallpaper-thumb x-nt-favicon-thumb">
        {item.inlineSvg ? (
          <span
            aria-hidden="true"
            className="x-nt-favicon-image x-nt-favicon-svg-preview"
            dangerouslySetInnerHTML={{ __html: item.inlineSvg }}
          />
        ) : (
          <img
            alt=""
            className="x-nt-favicon-image"
            draggable={false}
            src={item.previewUrl}
          />
        )}
      </span>
      <span
        className="x-nt-wallpaper-check"
        dangerouslySetInnerHTML={{ __html: checkIcon }}
      />
    </button>
  );
}

const activateOnKey = (activate: () => void) => (event: ReactKeyboardEvent<HTMLElement>) => {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }
  event.preventDefault();
  activate();
};

const isFromDeleteButton = (event: { target: EventTarget | null }) => Boolean(
  event.target instanceof Element && event.target.closest('.x-nt-wallpaper-delete-button')
);

function CustomWallpaperTile({
  actions,
  checkIcon,
  deleteIcon,
  deleteLabel,
  tile
}: {
  actions: WallpaperPanelActions;
  checkIcon: string;
  deleteIcon: string;
  deleteLabel: string;
  tile: TileState;
}) {
  const select = () => actions.selectWallpaper(tile.id);
  return (
    <div
      aria-label={tile.label || undefined}
      aria-pressed={tile.selected ? 'true' : 'false'}
      className="x-nt-wallpaper-tile x-nt-wallpaper-custom-tile"
      data-custom-wallpaper="true"
      data-selected={tile.selected ? 'true' : 'false'}
      data-wallpaper-id={tile.id}
      onClick={(event) => {
        if (!isFromDeleteButton(event)) select();
      }}
      onFocus={() => actions.primeWallpaper(tile.id)}
      onKeyDown={(event) => {
        if (!isFromDeleteButton(event)) activateOnKey(select)(event);
      }}
      onPointerDown={() => actions.primeWallpaper(tile.id)}
      onPointerEnter={() => actions.primeWallpaper(tile.id)}
      role="button"
      tabIndex={0}
    >
      <span className="x-nt-wallpaper-thumb">
        <img
          alt=""
          className="x-nt-wallpaper-custom-image"
          decoding="async"
          draggable={false}
          loading="lazy"
          src={tile.thumbnailUrl}
        />
      </span>
      <span
        className="x-nt-wallpaper-check"
        dangerouslySetInnerHTML={{ __html: checkIcon }}
      />
      <button
        aria-label={deleteLabel || undefined}
        className="x-nt-wallpaper-delete-button"
        dangerouslySetInnerHTML={{ __html: deleteIcon }}
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          event.stopPropagation();
          actions.deleteWallpaper(tile.id);
        }}
        type="button"
      />
    </div>
  );
}

function SelectedSource({ name, source }: { name: string; source: SelectedSourceState }) {
  return (
    <div {...ref(`${name}SelectedSource`)} className="x-nt-bing-source" hidden={!source.visible}>
      <LinkButton
        {...ref(`${name}SelectedLink`)}
        aria-label={source.linkLabel || undefined}
        className="x-nt-bing-source-link"
        external
        href={source.visible ? source.url : undefined}
        labelProps={ref(`${name}SelectedTitle`)}
      >
        {source.title}
      </LinkButton>
      <p {...ref(`${name}SelectedMeta`)} className="x-nt-bing-source-meta">{source.meta}</p>
    </div>
  );
}

function DailyRow({
  actions,
  daily: state,
  icons,
  name,
  onToggle
}: {
  actions: WallpaperPanelActions;
  daily: DailyState;
  icons: WallpaperPanelModel['icons'];
  name: string;
  onToggle(enabled: boolean): void;
}) {
  return (
    <div className="x-nt-wallpaper-mode-sync">
      <span className="x-nt-appearance-setting-title-group">
        <span {...ref(`${name}DailyLabel`)} className="x-nt-wallpaper-mode-sync-title">{state.label}</span>
        <InfoButton
          actions={actions}
          icon={String(icons?.info || '')}
          label={state.infoTooltip}
          name={`${name}DailyInfoButton`}
          tooltip={state.infoTooltip}
        />
      </span>
      <span className="x-nt-daily-actions">
        <button
          {...ref(`${name}DailyRestore`)}
          {...tooltipHandlers(actions, state.restoreLabel)}
          aria-label={state.restoreLabel || undefined}
          className="x-nt-panel-icon-button x-nt-daily-restore"
          dangerouslySetInnerHTML={{
            __html: String(icons?.restore || '')
          }}
          hidden={!state.restoreVisible}
          onClick={() => {
            actions.hideTooltip();
            actions.restoreDailyWallpaper();
          }}
          type="button"
        />
        <Switch name={`${name}DailyToggle`} onChange={onToggle} toggle={state.toggle} />
      </span>
    </div>
  );
}

function OnlineTiles({
  actions,
  checkIcon,
  name,
  onSelect,
  tiles
}: {
  actions: WallpaperPanelActions;
  checkIcon: string;
  name: string;
  onSelect(id: string): void;
  tiles: OnlineTileState[];
}) {
  return (
    <>
      {tiles.map((tile) => (
        <button
          {...tooltipHandlers(actions, tile.tooltip)}
          aria-label={tile.label || undefined}
          aria-pressed={tile.selected ? 'true' : 'false'}
          className="x-nt-wallpaper-tile"
          data-selected={tile.selected ? 'true' : 'false'}
          data-wallpaper-id={tile.id}
          disabled={tile.disabled}
          key={tile.id}
          onClick={() => onSelect(tile.id)}
          onPointerEnter={name === 'curated' ? () => actions.primeWallpaper(tile.id) : undefined}
          type="button"
        >
          <span className="x-nt-wallpaper-thumb">
            <img
              alt=""
              decoding="async"
              draggable={false}
              loading="lazy"
              src={tile.thumbnailUrl}
            />
          </span>
          <span
            className="x-nt-wallpaper-check"
            dangerouslySetInnerHTML={{ __html: checkIcon }}
          />
        </button>
      ))}
    </>
  );
}

function PanelSelect({
  documentObj,
  hostRef,
  id,
  registerControls,
  select
}: {
  documentObj: Document;
  hostRef: string;
  id: string;
  registerControls(id: string, controls: SelectMenuControls): void;
  select: PanelSelectModel | null | undefined;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <div
      {...ref(hostRef)}
      className="_x_extension_select_wrap_2024_unique_ _x_extension_custom_select_2024_unique_ x-nt-row-select"
      ref={setHost}
    >
      {host && select ? (
        <SelectMenu
          config={{
            id,
            selectId: `${id}-select`,
            ariaLabel: select.ariaLabel,
            options: select.options,
            value: select.value,
            menuAlign: 'left',
            menuPortal: true,
            menuPortalZIndex: 10020,
            menuWidth: 'trigger',
            onValueChange: select.onChange
          }}
          documentObj={documentObj}
          host={host}
          registerControls={(controls) => registerControls(id, controls)}
          windowObj={documentObj.defaultView || window}
        />
      ) : null}
    </div>
  );
}

const EFFECT_SELECT_ID = 'x-nt-wallpaper-effect';
const QUOTE_POSITION_SELECT_ID = 'x-nt-quote-position';
const BOOKMARK_VIEW_MODE_SELECT_ID = 'x-nt-bookmark-view-mode';
const BOOKMARK_TOPBAR_SURFACE_SELECT_ID = 'x-nt-bookmark-topbar-surface';
const SELECT_HOST_REFS: Record<string, string> = {
  [EFFECT_SELECT_ID]: 'effectSelectHost',
  [QUOTE_POSITION_SELECT_ID]: 'quotePositionSelectHost',
  [BOOKMARK_VIEW_MODE_SELECT_ID]: 'bookmarkViewModeSelectHost',
  [BOOKMARK_TOPBAR_SURFACE_SELECT_ID]: 'bookmarkTopbarSurfaceSelectHost'
};
const SELECT_IDS = Object.keys(SELECT_HOST_REFS);

type ExternalSelectKey = 'quotePosition' | 'bookmarkViewMode' | 'bookmarkTopbarSurface';

const EFFECT_SLIDER_REFS: Record<EffectSliderKey, string> = {
  strength: 'effectStrength',
  size: 'effectSize',
  spacing: 'effectSpacing',
  texture: 'effectTexture',
  crtBloom: 'effectCrtBloom',
  crtRgbOffset: 'effectCrtRgbOffset',
  crtCurvature: 'effectCrtCurvature'
};

function controlVisibility(visible: boolean) {
  return {
    'aria-hidden': visible ? 'false' as const : 'true' as const,
    'data-visible': visible ? 'true' : 'false'
  };
}

function collapsible(expanded: boolean, withHidden = true) {
  return {
    ...controlVisibility(expanded),
    ...(withHidden ? { hidden: !expanded } : {})
  };
}

function WallpaperPanel({
  documentObj,
  externalSelects,
  model,
  registerSelect,
  state
}: {
  documentObj: Document;
  externalSelects: Partial<Record<ExternalSelectKey, PanelSelectModel>>;
  model: WallpaperPanelModel;
  registerSelect(id: string, controls: SelectMenuControls): void;
  state: WallpaperPanelState;
}) {
  const { actions } = state;
  const checkIcon = String(model.icons?.check || '');
  const arrowIcon = String(model.icons?.arrow || '');
  const infoIcon = String(model.icons?.info || '');
  const marks = model.marks || {};
  const { bubble, node: bubbleNode } = useSliderValueBubble(documentObj, state.open);
  const fileInput = useRef<HTMLInputElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const [themeExpanded, setThemeExpanded] = useState(true);
  const [searchExpanded, setSearchExpanded] = useState(true);
  const [faviconExpanded, setFaviconExpanded] = useState(true);
  const [wallpaperExpanded, setWallpaperExpanded] = useState(true);
  const [shortcutsExpanded, setShortcutsExpanded] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const shortcuts = state.shortcuts;
  const wallpaper = state.wallpaper;
  const shortcutsOpen = shortcutsExpanded && shortcuts.enabled;
  const shortcutControlsDisabled = !shortcutsOpen;
  const wallpaperOpen = wallpaperExpanded && wallpaper.enabled;

  // Turning shortcuts off folds their details. Switching a section on here opens its
  // settings, like every other section; a change made elsewhere leaves them folded.
  useEffect(() => {
    if (!shortcuts.enabled) setShortcutsExpanded(false);
  }, [shortcuts.enabled]);
  // A saved link clears the field for the next one.
  useEffect(() => {
    setUrlDraft('');
  }, [wallpaper.local.url.clearToken]);

  const sliderBubble: SliderBubble = bubble;
  const local = wallpaper.local;
  const bing = wallpaper.bing;
  const curated = wallpaper.curated;
  const effect = wallpaper.effect;
  const sourceTabPanel = (tab: WallpaperSourceTab) => ({
    'aria-hidden': wallpaper.activeTab === tab ? 'false' as const : 'true' as const,
    'aria-labelledby': sourceTabId(tab),
    'data-wallpaper-panel': tab,
    id: sourcePanelId(tab),
    role: 'tabpanel'
  });
  const openFilePicker = () => {
    if (local.upload.loading) return;
    actions.hideTooltip();
    fileInput.current?.click();
  };
  const showUploadTooltip = (event: { currentTarget: HTMLElement }) => {
    if (local.upload.loading) {
      actions.hideTooltip();
      return;
    }
    actions.showTooltip(event.currentTarget, local.upload.label);
  };

  return (
    <>
      <div
        {...ref('panel')}
        aria-label={state.panelLabel || undefined}
        aria-modal="false"
        className="x-nt-wallpaper-panel"
        data-open={state.open ? 'true' : 'false'}
        onScrollCapture={() => sliderBubble.hide(null, true)}
        role="dialog"
      >
        <div className="x-nt-appearance-header">
          <div {...ref('appearanceTitle')} className="x-nt-wallpaper-panel-title">
            {state.header.title}
          </div>
          <LinkButton
            {...ref('moreSettingsLink')}
            aria-label={state.header.moreSettingsLabel || undefined}
            className="x-nt-appearance-more-settings"
            href={state.header.moreSettingsUrl}
            labelProps={{
              ...ref('moreSettingsText'),
              className: 'x-nt-appearance-more-settings-text'
            }}
          >
            {state.header.moreSettingsLabel}
          </LinkButton>
        </div>
        <div className="x-nt-wallpaper-panel-scroll">
          <div className="x-nt-appearance-section">
            <div className="x-nt-wallpaper-panel-header">
              <div className="x-nt-appearance-title-group">
                <SectionTrigger
                  arrowIcon={arrowIcon}
                  bodyId="_x_extension_newtab_theme_section_body_2026_unique_"
                  expanded={themeExpanded}
                  onToggle={() => setThemeExpanded(!themeExpanded)}
                  title={state.theme.title}
                  titleRef="themeSectionTitle"
                  triggerRef="themeSectionTrigger"
                />
                <InfoButton
                  actions={actions}
                  icon={infoIcon}
                  label={state.theme.infoLabel}
                  name="appearanceInfoButton"
                  tooltip={state.theme.infoTooltip}
                />
              </div>
              <SegmentedChoice
                buttonClassName="x-nt-segmented-tab x-nt-wallpaper-tab x-nt-appearance-scope-tab"
                className="x-nt-wallpaper-tabs x-nt-appearance-scope-tabs"
                indicatorClassName="x-nt-wallpaper-tabs-indicator"
                indicatorRef="appearanceScopeTabsIndicator"
                name="appearanceScopeTabs"
                onSelect={actions.selectThemeScope}
                role="group"
                segment={state.theme.scope}
                valueAttribute="data-theme-scope"
                visible={state.open}
              />
            </div>
            <div
              {...ref('themeSectionBody')}
              {...collapsible(themeExpanded)}
              className="x-nt-panel-section-body x-nt-panel-collapsible"
              id="_x_extension_newtab_theme_section_body_2026_unique_"
            >
              <div {...ref('appearanceOptions')} className="x-nt-appearance-options">
                {(model.appearanceOptions || []).map((item) => {
                  const option = state.theme.modes.find((mode) => mode.mode === item.mode);
                  return (
                    <button
                      aria-label={option?.ariaLabel || undefined}
                      aria-pressed={option?.selected ? 'true' : 'false'}
                      className="x-nt-appearance-option"
                      data-selected={option?.selected ? 'true' : 'false'}
                      data-theme-mode={item.mode}
                      key={item.mode}
                      onClick={() => actions.selectThemeMode(item.mode)}
                      type="button"
                    >
                      <span className="x-nt-appearance-option-content">
                        <span className="x-nt-appearance-preview">
                          <img alt="" draggable={false} src={item.imageUrl} />
                          <span
                            className="x-nt-appearance-check"
                            dangerouslySetInnerHTML={{ __html: checkIcon }}
                          />
                        </span>
                        <span className="x-nt-appearance-label">{option?.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="x-nt-panel-divider" />
          <div className="x-nt-wallpaper-section x-nt-search-section">
            <div className="x-nt-wallpaper-panel-header">
              <SectionTrigger
                arrowIcon={arrowIcon}
                bodyId="_x_extension_newtab_search_section_body_2026_unique_"
                expanded={searchExpanded}
                onToggle={() => setSearchExpanded(!searchExpanded)}
                title={state.search.title}
                titleRef="searchSectionTitle"
                triggerRef="searchSectionTrigger"
              />
            </div>
            <div
              {...ref('searchSectionBody')}
              {...collapsible(searchExpanded)}
              className="x-nt-panel-section-body x-nt-panel-collapsible"
              id="_x_extension_newtab_search_section_body_2026_unique_"
            >
              <div
                {...ref('searchWidthControl')}
                {...controlVisibility(true)}
                className="x-nt-overlay-control x-nt-search-width-control"
              >
                <PanelSlider
                  bubble={sliderBubble}
                  className="x-nt-overlay-slider-wrap x-nt-search-width-slider-wrap"
                  inputClass="x-nt-overlay-slider x-nt-search-width-slider"
                  labelRef="searchWidthLabel"
                  marks={marks.searchWidth}
                  name="searchWidthSlider"
                  onChange={actions.setSearchWidth}
                  slider={state.search.width}
                />
              </div>
              <div className="x-nt-appearance-setting-row">
                <span className="x-nt-appearance-setting-title-group">
                  <span {...ref('inputAutoFocusTitle')} className="x-nt-appearance-setting-title">
                    {state.search.autoFocus.title}
                  </span>
                  <InfoButton
                    actions={actions}
                    icon={infoIcon}
                    label={state.search.autoFocus.infoLabel}
                    name="inputAutoFocusInfoButton"
                    tooltip={state.search.autoFocus.infoTooltip}
                  />
                </span>
                <Switch
                  name="inputAutoFocusToggle"
                  onChange={actions.setInputAutoFocus}
                  toggle={state.search.autoFocus.toggle}
                />
              </div>
              <div className="x-nt-appearance-setting-row x-nt-top-content-header">
                <div {...ref('topContentTitle')} className="x-nt-appearance-setting-title">
                  {state.search.topContent.title}
                </div>
                <SegmentedChoice
                  buttonClassName="x-nt-segmented-tab x-nt-wallpaper-tab x-nt-top-content-tab"
                  className="x-nt-wallpaper-tabs x-nt-top-content-tabs"
                  indicatorClassName="x-nt-wallpaper-tabs-indicator"
                  indicatorRef="topContentTabsIndicator"
                  name="topContentTabs"
                  onSelect={actions.selectTopContent}
                  refFor={(value) => ({ brand: 'topContentBrandTab', time: 'topContentTimeTab', off: 'topContentOffTab' })[value]}
                  role="group"
                  segment={state.search.topContent.tabs}
                  valueAttribute="data-newtab-top-content"
                  visible={state.open && searchExpanded}
                />
              </div>
              <div
                {...ref('topContentWeightControl')}
                {...collapsible(state.search.timeWeight.visible)}
                className="x-nt-time-weight-control x-nt-panel-collapsible"
              >
                <PanelSlider
                  bubble={sliderBubble}
                  className="x-nt-overlay-slider-wrap x-nt-time-weight-slider-wrap"
                  inputClass="x-nt-overlay-slider x-nt-time-weight-slider"
                  labelRef="topContentWeightTitle"
                  marks={marks.timeWeight}
                  name="topContentWeightSlider"
                  onChange={actions.setTimeFontWeight}
                  reset={{
                    label: state.search.timeWeight.resetLabel,
                    name: 'topContentWeightResetButton',
                    onReset: actions.resetTimeFontWeight,
                    visible: state.search.timeWeight.resetVisible
                  }}
                  slider={state.search.timeWeight}
                />
              </div>
              <div
                {...ref('topContentSecondsRow')}
                {...collapsible(state.search.seconds.visible)}
                className="x-nt-top-content-seconds-row x-nt-panel-collapsible"
              >
                <span {...ref('topContentSecondsTitle')} className="x-nt-top-content-seconds-title">
                  {state.search.seconds.title}
                </span>
                <Switch
                  name="topContentSecondsToggle"
                  onChange={actions.setTimeSecondsVisible}
                  toggle={state.search.seconds.toggle}
                />
              </div>
            </div>
          </div>
          <div className="x-nt-panel-divider" />
          <div className="x-nt-wallpaper-section">
            <div
              {...ref('shortcutsAccordion')}
              className="x-nt-shortcuts-accordion"
              data-enabled={shortcuts.enabled ? 'true' : 'false'}
              data-expanded={shortcutsOpen ? 'true' : 'false'}
            >
              <div className="x-nt-wallpaper-panel-header x-nt-shortcuts-accordion-row">
                <SectionTrigger
                  arrowIcon={arrowIcon}
                  bodyId="_x_extension_newtab_shortcuts_settings_2026_unique_"
                  disabled={!shortcuts.enabled}
                  expanded={shortcutsOpen}
                  id="_x_extension_newtab_shortcuts_accordion_trigger_2026_unique_"
                  label={shortcuts.title}
                  onToggle={() => {
                    if (shortcuts.enabled) setShortcutsExpanded(!shortcutsExpanded);
                  }}
                  title={shortcuts.title}
                  titleRef="shortcutsTitle"
                  triggerRef="shortcutsAccordionTrigger"
                />
                <Switch
                  name="shortcutsToggle"
                  onChange={(checked) => {
                    if (checked) setShortcutsExpanded(true);
                    actions.setShortcutsVisible(checked);
                  }}
                  toggle={shortcuts.toggle}
                />
              </div>
              <div
                {...ref('shortcutsDetails')}
                {...collapsible(shortcutsOpen)}
                aria-labelledby="_x_extension_newtab_shortcuts_accordion_trigger_2026_unique_"
                className="x-nt-shortcuts-accordion-details x-nt-panel-collapsible"
                id="_x_extension_newtab_shortcuts_settings_2026_unique_"
                role="region"
              >
                <div className="x-nt-shortcuts-accordion-details-inner">
                  <div className="x-nt-appearance-setting-row">
                    <span {...ref('shortcutAddTitle')} className="x-nt-appearance-setting-title">
                      {shortcuts.add.title}
                    </span>
                    <Switch
                      name="shortcutAddToggle"
                      onChange={actions.setShortcutAddVisible}
                      toggle={{ ...shortcuts.add.toggle, disabled: shortcutControlsDisabled }}
                    />
                  </div>
                  <div className="x-nt-appearance-setting-row">
                    <span {...ref('shortcutDockMagnificationTitle')} className="x-nt-appearance-setting-title">
                      {shortcuts.dock.title}
                    </span>
                    <Switch
                      name="shortcutDockMagnificationToggle"
                      onChange={actions.setShortcutDockMagnification}
                      toggle={{ ...shortcuts.dock.toggle, disabled: shortcutControlsDisabled }}
                    />
                  </div>
                  <div
                    {...ref('shortcutColumnsControl')}
                    {...controlVisibility(shortcutsOpen)}
                    className="x-nt-overlay-control x-nt-shortcut-columns-control"
                  >
                    <PanelSlider
                      bubble={sliderBubble}
                      className="x-nt-overlay-slider-wrap x-nt-shortcut-columns-slider-wrap"
                      inputClass="x-nt-overlay-slider x-nt-shortcut-columns-slider"
                      labelRef="shortcutColumnsLabel"
                      marks={marks.shortcutColumns}
                      name="shortcutColumnsSlider"
                      onChange={actions.setShortcutColumns}
                      slider={{ ...shortcuts.columns, disabled: shortcutControlsDisabled }}
                    />
                  </div>
                  <div
                    {...ref('shortcutSizeControl')}
                    {...controlVisibility(shortcutsOpen)}
                    className="x-nt-overlay-control x-nt-shortcut-size-control"
                  >
                    <PanelSlider
                      bubble={sliderBubble}
                      className="x-nt-overlay-slider-wrap x-nt-shortcut-size-slider-wrap"
                      inputClass="x-nt-overlay-slider x-nt-shortcut-size-slider"
                      labelRef="shortcutSizeLabel"
                      marks={marks.shortcutSize}
                      name="shortcutSizeSlider"
                      onChange={actions.setShortcutSize}
                      reset={{
                        label: shortcuts.size.resetLabel,
                        name: 'shortcutSizeResetButton',
                        onReset: actions.resetShortcutSize,
                        visible: shortcuts.size.resetVisible
                      }}
                      slider={{ ...shortcuts.size, disabled: shortcutControlsDisabled }}
                    />
                  </div>
                  <div
                    {...ref('shortcutGapControl')}
                    {...controlVisibility(shortcutsOpen)}
                    className="x-nt-overlay-control x-nt-shortcut-gap-control"
                  >
                    <PanelSlider
                      bubble={sliderBubble}
                      className="x-nt-overlay-slider-wrap x-nt-shortcut-gap-slider-wrap"
                      inputClass="x-nt-overlay-slider x-nt-shortcut-gap-slider"
                      labelRef="shortcutGapLabel"
                      marks={marks.shortcutGap}
                      name="shortcutGapSlider"
                      onChange={actions.setShortcutGap}
                      reset={{
                        label: shortcuts.gap.resetLabel,
                        name: 'shortcutGapResetButton',
                        onReset: actions.resetShortcutGap,
                        visible: shortcuts.gap.resetVisible
                      }}
                      slider={{ ...shortcuts.gap, disabled: shortcutControlsDisabled }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="x-nt-panel-divider" />
          <ToggleSection arrowIcon={arrowIcon} name="bookmarkSettings">
            <SettingRow titleRef="bookmarkViewModeLabel">
              <PanelSelect
                documentObj={documentObj}
                hostRef="bookmarkViewModeSelectHost"
                id={BOOKMARK_VIEW_MODE_SELECT_ID}
                registerControls={registerSelect}
                select={externalSelects.bookmarkViewMode}
              />
            </SettingRow>
            {/* Rows and columns shape the bookmark grid; the top bar has its own shape and background. */}
            <div {...ref('bookmarkGridSettings')} className="x-nt-panel-field-group x-nt-panel-collapsible">
              <StaticCountSlider defaultValue="2" marks={[0, 300 / 7, 100]} max="8" min="1" name="bookmarkRows" />
              <StaticCountSlider defaultValue="6" marks={[0, 50, 100]} max="8" min="4" name="bookmarkColumns" />
              <SettingRow titleRef="bookmarkFolderIconsTitle">
                <StaticSwitch name="bookmarkFolderIconsToggle" />
              </SettingRow>
            </div>
            <div {...ref('bookmarkTopbarSettings')} className="x-nt-panel-field-group x-nt-panel-collapsible" hidden>
              <SettingRow titleRef="bookmarkTopbarLayoutLabel">
                <StaticRowTabs attribute="data-bookmark-topbar-layout" name="bookmarkTopbarLayout" values={['docked', 'floating']} />
              </SettingRow>
              <SettingRow titleRef="bookmarkTopbarSurfaceLabel">
                <PanelSelect
                  documentObj={documentObj}
                  hostRef="bookmarkTopbarSurfaceSelectHost"
                  id={BOOKMARK_TOPBAR_SURFACE_SELECT_ID}
                  registerControls={registerSelect}
                  select={externalSelects.bookmarkTopbarSurface}
                />
              </SettingRow>
            </div>
          </ToggleSection>
          <div className="x-nt-panel-divider" />
          <ToggleSection arrowIcon={arrowIcon} name="recentSettings">
            <SettingRow titleRef="recentModeLabel">
              <StaticRowTabs attribute="data-recent-mode" name="recentMode" values={['latest', 'most']} />
            </SettingRow>
            <SettingRow titleRef="recentRowsLabel">
              <StaticRowTabs attribute="data-recent-rows" labeled name="recentRows" values={['1', '2']} />
            </SettingRow>
          </ToggleSection>
          <div {...ref('quoteDivider')} className="x-nt-panel-divider" />
          <div {...ref('quoteSection')} className="x-nt-wallpaper-section x-nt-quote-settings">
            <div className="x-nt-wallpaper-panel-header">
              <span className="x-nt-appearance-title-group">
                <SectionTrigger
                  arrowIcon={arrowIcon}
                  bodyId="_x_extension_newtab_quote_section_body_2026_unique_"
                  expanded={false}
                  titleRef="quoteTitle"
                  triggerRef="quoteAccordionTrigger"
                />
                <InfoButton
                  actions={actions}
                  icon={infoIcon}
                  name="quoteInfoButton"
                  tooltip={state.quote.infoTooltip}
                />
              </span>
              <StaticSwitch name="quoteEnabledToggle" />
            </div>
            <div
              {...ref('quoteBody')}
              className="x-nt-quote-body x-nt-panel-collapsible"
              hidden
              id="_x_extension_newtab_quote_section_body_2026_unique_"
            >
              <div className="x-nt-appearance-setting-row">
                <span {...ref('quoteCategoryLabel')} className="x-nt-appearance-setting-title" />
                <div
                  {...ref('quoteCategory')}
                  className="x-nt-segmented-tabs x-nt-wallpaper-tabs x-nt-quote-tabs x-nt-row-tabs"
                  role="group"
                >
                  <span
                    {...ref('quoteCategoryIndicator')}
                    aria-hidden="true"
                    className="x-nt-segmented-tabs-indicator x-nt-wallpaper-tabs-indicator"
                  />
                  {['literature', 'poetry'].map((category) => (
                    <button
                      aria-pressed="false"
                      className="x-nt-segmented-tab x-nt-wallpaper-tab"
                      data-quote-category={category}
                      key={category}
                      type="button"
                    />
                  ))}
                </div>
              </div>
              <SettingRow titleRef="quotePositionLabel">
                <PanelSelect
                  documentObj={documentObj}
                  hostRef="quotePositionSelectHost"
                  id={QUOTE_POSITION_SELECT_ID}
                  registerControls={registerSelect}
                  select={externalSelects.quotePosition}
                />
              </SettingRow>
              <div {...ref('quoteFontSizeRow')} className="x-nt-overlay-control x-nt-quote-font-size">
                <RangeSliderField
                  label={<span {...ref('quoteFontSizeTitle')} className="x-nt-appearance-setting-title" />}
                  {...ref('quoteFontSizeSlider')}
                  className="x-nt-overlay-slider-wrap"
                  inputClass="x-nt-overlay-slider"
                  min={String(model.quoteFontSize?.min ?? 12)}
                  max={String(model.quoteFontSize?.max ?? 24)}
                  defaultValue={String(model.quoteFontSize?.defaultValue ?? 15)}
                  step="1"
                  rowClassName="x-nt-range-slider-row"
                  valueInputProps={{
                    ...ref('quoteFontSizeSliderValueInput'),
                    defaultValue: String(model.quoteFontSize?.defaultValue ?? 15),
                    inputMode: 'numeric'
                  }}
                />
              </div>
            </div>
          </div>
          <div className="x-nt-panel-divider" />
          <div className="x-nt-wallpaper-section">
            <div {...ref('panelHeader')} className="x-nt-wallpaper-panel-header">
              <SectionTrigger
                arrowIcon={arrowIcon}
                bodyId="_x_extension_newtab_wallpaper_body_2026_unique_"
                disabled={!wallpaper.enabled}
                expanded={wallpaperOpen}
                label={wallpaper.title}
                onToggle={() => {
                  if (wallpaper.enabled) setWallpaperExpanded(!wallpaperExpanded);
                }}
                title={wallpaper.title}
                titleRef="panelTitle"
                triggerRef="wallpaperAccordionTrigger"
              />
              <Switch
                name="enabledToggle"
                onChange={(checked) => {
                  if (checked) setWallpaperExpanded(true);
                  actions.setWallpaperEnabled(checked);
                }}
                toggle={wallpaper.toggle}
              />
            </div>
            <input
              {...ref('customInput')}
              accept="image/*"
              className="x-nt-wallpaper-file-input"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.currentTarget.files ? event.currentTarget.files[0] : null;
                // Reset so choosing the same file again still reports a change.
                event.currentTarget.value = '';
                if (file) actions.importWallpaperFile(file);
              }}
              ref={fileInput}
              tabIndex={-1}
              type="file"
            />
            <div
              {...ref('body')}
              {...controlVisibility(wallpaperOpen)}
              className="x-nt-wallpaper-body x-nt-panel-collapsible"
              data-active-tab={wallpaper.activeTab}
              id="_x_extension_newtab_wallpaper_body_2026_unique_"
            >
              <div className="x-nt-wallpaper-mode-sync">
                <span {...ref('modeSyncTitle')} className="x-nt-wallpaper-mode-sync-title">
                  {wallpaper.modeSync.title}
                </span>
                <Switch name="modeSyncToggle" onChange={actions.setModeSync} toggle={wallpaper.modeSync.toggle} />
              </div>
              <div className="x-nt-wallpaper-tab-group">
                <div
                  {...ref('modeRow')}
                  {...collapsible(wallpaper.mode.visible)}
                  className="x-nt-appearance-setting-row x-nt-wallpaper-mode-row x-nt-panel-collapsible"
                >
                  <span {...ref('modeLabel')} className="x-nt-appearance-setting-title">{wallpaper.mode.label}</span>
                  <SegmentedChoice
                    buttonClassName="x-nt-segmented-tab x-nt-wallpaper-tab x-nt-wallpaper-mode-tab"
                    className="x-nt-wallpaper-tabs x-nt-wallpaper-mode-tabs x-nt-row-tabs"
                    indicatorClassName="x-nt-wallpaper-tabs-indicator x-nt-wallpaper-mode-tabs-indicator"
                    indicatorRef="modeTabsIndicator"
                    name="modeTabs"
                    onSelect={actions.selectWallpaperMode}
                    refFor={(mode) => (mode === 'light' ? 'lightModeTab' : 'darkModeTab')}
                    role="tablist"
                    segment={wallpaper.mode.tabs}
                    valueAttribute="data-wallpaper-mode"
                    visible={state.open && wallpaperOpen && wallpaper.mode.visible}
                  />
                </div>
                <div className="x-nt-appearance-setting-row">
                  <span {...ref('sourceLabel')} className="x-nt-appearance-setting-title">{wallpaper.source.label}</span>
                  <SegmentedChoice<WallpaperSourceTab>
                    buttonClassName="x-nt-segmented-tab x-nt-wallpaper-tab"
                    className="x-nt-wallpaper-tabs x-nt-row-tabs"
                    idFor={sourceTabId}
                    indicatorClassName="x-nt-wallpaper-tabs-indicator"
                    indicatorRef="tabsIndicator"
                    name="tabs"
                    onSelect={actions.selectSourceTab}
                    panelIdFor={sourcePanelId}
                    refFor={(tab) => SOURCE_TAB_REFS[tab]}
                    role="tablist"
                    segment={wallpaper.source.tabs}
                    valueAttribute="data-wallpaper-tab"
                    visible={state.open && wallpaperOpen}
                  />
                </div>
              </div>
              <div
                {...ref('builtInGrid')}
                {...sourceTabPanel('built-in')}
                aria-label={wallpaper.builtIn.label || undefined}
                className="x-nt-wallpaper-grid x-nt-wallpaper-grid--built-in"
              >
                {wallpaper.builtIn.tiles.map((tile) => (
                  <WallpaperTile
                    checkIcon={checkIcon}
                    key={tile.id}
                    onPrime={() => actions.primeWallpaper(tile.id)}
                    onSelect={() => actions.selectWallpaper(tile.id)}
                    tile={tile}
                  />
                ))}
              </div>
              <div
                {...ref('localGrid')}
                {...sourceTabPanel('local')}
                aria-label={local.label || undefined}
                className="x-nt-wallpaper-grid x-nt-wallpaper-grid--local"
              >
                <div
                  {...ref('uploadTile')}
                  aria-busy={local.upload.loading ? 'true' : 'false'}
                  aria-disabled={local.upload.loading ? 'true' : 'false'}
                  aria-label={local.upload.label || undefined}
                  aria-pressed="false"
                  className="x-nt-wallpaper-tile x-nt-wallpaper-upload-tile"
                  data-loading={local.upload.loading ? 'true' : 'false'}
                  data-selected="false"
                  data-upload="true"
                  onBlur={(event) => {
                    const next = event.relatedTarget as Node | null;
                    if (!next || !event.currentTarget.contains(next)) actions.hideTooltip();
                  }}
                  onClick={openFilePicker}
                  onFocus={showUploadTooltip}
                  onKeyDown={activateOnKey(openFilePicker)}
                  onMouseEnter={showUploadTooltip}
                  onMouseLeave={() => actions.hideTooltip()}
                  role="button"
                  tabIndex={0}
                >
                  <span className="x-nt-wallpaper-thumb x-nt-wallpaper-upload-thumb">
                    <span
                      className="x-nt-wallpaper-upload-placeholder"
                      dangerouslySetInnerHTML={{
                        __html: String(model.icons?.add || '')
                      }}
                    />
                  </span>
                </div>
                <div
                  {...ref('urlTile')}
                  {...tooltipHandlers(actions, local.url.tileLabel)}
                  aria-controls="_x_extension_newtab_wallpaper_url_form_2026_unique_"
                  aria-disabled={local.url.disabled ? 'true' : 'false'}
                  aria-expanded={local.url.open ? 'true' : 'false'}
                  aria-label={local.url.tileLabel || undefined}
                  className="x-nt-wallpaper-tile x-nt-wallpaper-upload-tile x-nt-wallpaper-url-tile"
                  data-selected="false"
                  onClick={actions.toggleUrlForm}
                  onKeyDown={activateOnKey(actions.toggleUrlForm)}
                  role="button"
                  tabIndex={0}
                >
                  <span className="x-nt-wallpaper-thumb x-nt-wallpaper-upload-thumb">
                    <span
                      className="x-nt-wallpaper-upload-placeholder"
                      dangerouslySetInnerHTML={{
                        __html: String(model.icons?.link || '')
                      }}
                    />
                  </span>
                </div>
                {local.tiles.map((tile) => (
                  <CustomWallpaperTile
                    actions={actions}
                    checkIcon={checkIcon}
                    deleteIcon={String(model.icons?.delete || '')}
                    deleteLabel={local.deleteLabel}
                    key={tile.id}
                    tile={tile}
                  />
                ))}
              </div>
              <form
                {...ref('urlForm')}
                className="x-nt-wallpaper-url-form x-nt-panel-collapsible"
                hidden={!local.url.open}
                id="_x_extension_newtab_wallpaper_url_form_2026_unique_"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  actions.submitWallpaperUrl(urlInput.current ? urlInput.current.value : urlDraft);
                }}
              >
                <input
                  {...ref('urlInput')}
                  aria-invalid={local.url.invalid ? 'true' : undefined}
                  aria-label={local.url.inputLabel || undefined}
                  autoComplete="off"
                  className="_x_extension_shortcut_input_2024_unique_ x-nt-wallpaper-url-input"
                  disabled={local.url.disabled}
                  inputMode="url"
                  onChange={(event) => {
                    setUrlDraft(event.currentTarget.value);
                    if (local.url.invalid) actions.clearUrlInvalid();
                  }}
                  placeholder={local.url.placeholder || undefined}
                  ref={urlInput}
                  spellCheck={false}
                  type="url"
                  value={urlDraft}
                />
                <button
                  {...ref('urlSubmit')}
                  className="x-lumno-action-button x-lumno-action-button--secondary x-nt-wallpaper-url-submit"
                  disabled={local.url.disabled}
                  type="submit"
                >
                  {local.url.submitLabel}
                </button>
              </form>
              <div {...ref('bingPanel')} {...sourceTabPanel('bing')} aria-label={bing.label || undefined} className="x-nt-bing-panel">
                <DailyRow
                  actions={actions}
                  daily={{ ...bing.daily, toggle: { ...bing.daily.toggle, disabled: bing.daily.busy } }}
                  icons={model.icons}
                  name="bing"
                  onToggle={actions.setBingDaily}
                />
                <div className="x-nt-bing-recent">
                  <div className="x-nt-overlay-control-header">
                    <span {...ref('bingRecentLabel')} className="x-nt-appearance-setting-title">{bing.recentLabel}</span>
                    <button
                      {...ref('bingRefresh')}
                      {...tooltipHandlers(actions, bing.refresh.label)}
                      aria-busy={bing.refresh.busy ? 'true' : 'false'}
                      aria-label={bing.refresh.label || undefined}
                      className="x-nt-panel-icon-button x-nt-bing-refresh"
                      disabled={bing.refresh.disabled}
                      onClick={actions.refreshBing}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="x-nt-bing-refresh-glyph x-lumno-busy-spin"
                        dangerouslySetInnerHTML={{
                          __html: String(model.icons?.refresh || '')
                        }}
                      />
                    </button>
                  </div>
                  <div
                    {...ref('bingItemsHost')}
                    aria-busy={bing.busy ? 'true' : 'false'}
                    className="x-nt-wallpaper-grid x-nt-wallpaper-grid--bing"
                    data-loading={bing.loading ? 'true' : 'false'}
                  >
                    <OnlineTiles
                      actions={actions}
                      checkIcon={checkIcon}
                      name="bing"
                      onSelect={actions.selectBingWallpaper}
                      tiles={bing.tiles}
                    />
                  </div>
                  <div {...ref('bingStatus')} aria-live="polite" className="x-nt-bing-status" role="status">
                    {bing.status}
                  </div>
                  <SelectedSource name="bing" source={bing.selected} />
                </div>
              </div>
              <div {...ref('curatedPanel')} {...sourceTabPanel('curated')} aria-label={curated.label || undefined} className="x-nt-curated-panel">
                <DailyRow
                  actions={actions}
                  daily={curated.daily}
                  icons={model.icons}
                  name="curated"
                  onToggle={actions.setCuratedDaily}
                />
                <div className="x-nt-appearance-setting-row">
                  <span {...ref('curatedCategoryLabel')} className="x-nt-appearance-setting-title">
                    {curated.category.label}
                  </span>
                  <SegmentedChoice
                    buttonClassName="x-nt-segmented-tab x-nt-wallpaper-tab"
                    className="x-nt-wallpaper-tabs x-nt-row-tabs"
                    indicatorClassName="x-nt-wallpaper-tabs-indicator"
                    indicatorRef="curatedCategoryIndicator"
                    name="curatedCategoryTabs"
                    onSelect={actions.selectCuratedCategory}
                    role="group"
                    segment={curated.category.tabs}
                    valueAttribute="data-curated-category"
                    visible={state.open && wallpaperOpen && wallpaper.activeTab === 'curated'}
                  />
                </div>
                <div className="x-nt-bing-recent">
                  <div className="x-nt-overlay-control-header">
                    <span {...ref('curatedListLabel')} className="x-nt-appearance-setting-title">{curated.listLabel}</span>
                    <button
                      {...ref('curatedRefresh')}
                      {...tooltipHandlers(actions, curated.refreshLabel)}
                      aria-label={curated.refreshLabel || undefined}
                      className="x-nt-panel-icon-button x-nt-bing-refresh"
                      onClick={actions.showMoreCurated}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="x-nt-bing-refresh-glyph"
                        dangerouslySetInnerHTML={{
                          __html: String(model.icons?.refresh || '')
                        }}
                      />
                    </button>
                  </div>
                  <div {...ref('curatedItemsHost')} className="x-nt-wallpaper-grid x-nt-wallpaper-grid--curated">
                    <OnlineTiles
                      actions={actions}
                      checkIcon={checkIcon}
                      name="curated"
                      onSelect={actions.selectCuratedWallpaper}
                      tiles={curated.tiles}
                    />
                  </div>
                  <SelectedSource name="curated" source={curated.selected} />
                </div>
              </div>
              <div className="x-nt-panel-divider x-nt-panel-divider--inset" />
              <div className="x-nt-effect-control">
                <div
                  {...ref('overlayControl')}
                  {...controlVisibility(true)}
                  className="x-nt-overlay-control x-nt-overlay-control--effect"
                >
                  <PanelSlider
                    bubble={sliderBubble}
                    labelClass="x-nt-appearance-setting-title x-nt-effect-slider-label"
                    labelRef="overlayLabel"
                    marks={[50]}
                    name="overlaySlider"
                    onChange={actions.setOverlay}
                    slider={wallpaper.overlay}
                  />
                </div>
                <div className="x-nt-appearance-setting-row x-nt-effect-control-header">
                  <span {...ref('effectLabel')} className="x-nt-appearance-setting-title x-nt-effect-label">
                    {effect.label}
                  </span>
                  <PanelSelect
                    documentObj={documentObj}
                    hostRef="effectSelectHost"
                    id={EFFECT_SELECT_ID}
                    registerControls={registerSelect}
                    select={{ ...effect.select, onChange: actions.selectEffect }}
                  />
                </div>
                <div
                  {...ref('effectInkToneControl')}
                  {...collapsible(effect.inkTone.visible)}
                  className="x-nt-effect-slider-control x-nt-effect-ink-tone-control x-nt-panel-collapsible"
                >
                  <div className="x-nt-appearance-setting-row">
                    <span {...ref('effectInkToneLabel')} className="x-nt-appearance-setting-title">
                      {effect.inkTone.label}
                    </span>
                    <SegmentedChoice
                      buttonClassName="x-nt-segmented-tab x-nt-effect-option x-nt-effect-ink-tone-option"
                      className="x-nt-effect-options x-nt-effect-ink-tone-options x-nt-row-tabs"
                      indicatorClassName="x-nt-effect-indicator"
                      indicatorRef="effectInkToneIndicator"
                      name="effectInkToneOptions"
                      onSelect={actions.selectInkTone}
                      role="group"
                      segment={effect.inkTone.tabs}
                      valueAttribute="data-wallpaper-effect-ink-tone"
                      visible={state.open && wallpaperOpen && effect.inkTone.visible}
                    />
                  </div>
                </div>
                {EFFECT_SLIDER_KEYS.map((key) => {
                  const entry = effect.sliders[key];
                  const refName = EFFECT_SLIDER_REFS[key];
                  return (
                    <div
                      {...ref(`${refName}Control`)}
                      {...collapsible(entry.visible)}
                      className="x-nt-effect-slider-control x-nt-panel-collapsible"
                      key={key}
                    >
                      <PanelSlider
                        bubble={sliderBubble}
                        className="x-nt-overlay-slider-wrap x-nt-effect-slider-wrap"
                        inputClass="x-nt-overlay-slider x-nt-effect-slider"
                        labelClass="x-nt-appearance-setting-title x-nt-effect-slider-label"
                        labelRef={`${refName}Label`}
                        marks={[50]}
                        name={`${refName}Slider`}
                        onChange={(value, change) => actions.setEffectParameter(key, value, change)}
                        slider={entry}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="x-nt-panel-divider" />
          <div className="x-nt-wallpaper-section">
            <div className="x-nt-favicon-group">
              <div className="x-nt-wallpaper-panel-header">
                <SectionTrigger
                  arrowIcon={arrowIcon}
                  bodyId="_x_extension_newtab_favicon_section_body_2026_unique_"
                  expanded={faviconExpanded}
                  onToggle={() => setFaviconExpanded(!faviconExpanded)}
                  title={state.favicon.title}
                  titleClassName="x-nt-favicon-title"
                  titleRef="faviconTitle"
                  triggerRef="faviconSectionTrigger"
                />
              </div>
              <div
                {...ref('faviconSectionBody')}
                {...collapsible(faviconExpanded)}
                className="x-nt-panel-section-body x-nt-panel-collapsible"
                id="_x_extension_newtab_favicon_section_body_2026_unique_"
              >
                <div
                  {...ref('faviconOptions')}
                  aria-label={state.favicon.title || undefined}
                  className="x-nt-favicon-options"
                  role="group"
                >
                  {(model.favicons || []).map((item) => {
                    const option = state.favicon.options.find((entry) => entry.id === item.id);
                    return (
                      <FaviconTile
                        checkIcon={checkIcon}
                        item={item}
                        key={item.id}
                        label={option?.label || ''}
                        onSelect={() => actions.selectFavicon(item.id)}
                        selected={Boolean(option?.selected)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="x-nt-appearance-help-footer">
          <span {...ref('helpFooterPrompt')} className="x-nt-appearance-help-footer-prompt">
            {state.header.helpPrompt}
          </span>
          <LinkButton
            {...ref('helpFooterLink')}
            className="x-nt-appearance-help-footer-link"
            external
            href={state.header.helpUrl}
            labelProps={ref('helpFooterText')}
          >
            {state.header.helpText}
          </LinkButton>
        </p>
      </div>
      <button
        {...ref('button')}
        aria-expanded={state.open ? 'true' : 'false'}
        aria-haspopup="dialog"
        aria-label={state.button.label || undefined}
        aria-pressed={state.button.active ? 'true' : 'false'}
        className="x-nt-wallpaper-button"
        data-active={state.button.active ? 'true' : 'false'}
        data-open={state.open ? 'true' : 'false'}
        dangerouslySetInnerHTML={{
          __html: String(model.icons?.wallpaper || '')
        }}
        onBlur={() => actions.hideTooltip()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          actions.hideTooltip();
          actions.togglePanel();
        }}
        onFocus={(event) => actions.showButtonTooltip(event.currentTarget)}
        onMouseEnter={(event) => actions.showButtonTooltip(event.currentTarget)}
        onMouseLeave={() => actions.hideTooltip()}
        type="button"
      />
      {bubbleNode}
    </>
  );
}

export interface WallpaperViewController {
  button: HTMLButtonElement;
  closeOpenSelect(options?: { restoreFocus?: boolean }): boolean;
  containsSelectMenuTarget(target: Node | null): boolean;
  control: HTMLDivElement;
  destroy(): void;
  /** Moves focus to a rendered element, by its data-wallpaper-ref name. */
  focus(name: string): void;
  /** Elements by data-wallpaper-ref, for the sections other runtimes fill in. */
  getRefs(): Record<string, HTMLElement>;
  panel: HTMLDivElement;
  /** Renders the panel from new state; the DOM is up to date when this returns. */
  render(state: WallpaperPanelState): void;
  renderBookmarkTopbarSurfaceSelect(select: PanelSelectModel): void;
  renderBookmarkViewModeSelect(select: PanelSelectModel): void;
  renderQuotePositionSelect(select: PanelSelectModel): void;
}

export function createWallpaperViewController(
  config: { documentObj?: Document; model?: WallpaperPanelModel; state: WallpaperPanelState }
): WallpaperViewController {
  const documentObj: Document = config.documentObj || document;
  const model = config.model || {};
  let state = config.state;
  const externalSelects: Partial<Record<ExternalSelectKey, PanelSelectModel>> = {};
  const selectControls = new Map<string, SelectMenuControls>();
  const registerSelect = (id: string, controls: SelectMenuControls) => {
    selectControls.set(id, controls);
  };
  const control = documentObj.createElement('div');
  control.className = 'x-nt-wallpaper-control';
  control.dataset.reactIsland = 'newtab-wallpaper';
  const root: Root = createRoot(control);
  let destroyed = false;
  const renderRoot = () => {
    control.dataset.panelOpen = state.open ? 'true' : 'false';
    flushSync(() => root.render(
      <WallpaperPanel
        documentObj={documentObj}
        externalSelects={{ ...externalSelects }}
        model={model}
        registerSelect={registerSelect}
        state={state}
      />
    ));
  };
  renderRoot();
  const panel = control.querySelector<HTMLDivElement>('[data-wallpaper-ref="panel"]');
  const button = control.querySelector<HTMLButtonElement>('[data-wallpaper-ref="button"]');
  if (!panel || !button) {
    flushSync(() => root.unmount());
    throw new Error('Lumno React wallpaper view did not mount.');
  }
  const getRefs = () => {
    const refs: Record<string, HTMLElement> = {};
    control
      .querySelectorAll<HTMLElement>('[data-wallpaper-ref]')
      .forEach((element) => {
        const name = element.dataset.wallpaperRef;
        if (name) {
          refs[name] = element;
        }
      });
    return refs;
  };
  const renderExternalSelect = (key: ExternalSelectKey, select: PanelSelectModel) => {
    if (destroyed) return;
    externalSelects[key] = select;
    renderRoot();
  };
  const controller: WallpaperViewController = {
    button,
    control,
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      flushSync(() => root.unmount());
    },
    focus(name: string) {
      const element = control.querySelector<HTMLElement>(`[data-wallpaper-ref="${name}"]`);
      element?.focus();
    },
    getRefs,
    panel,
    render(nextState: WallpaperPanelState) {
      if (destroyed) return;
      state = nextState;
      renderRoot();
    },
    closeOpenSelect(options?: { restoreFocus?: boolean }) {
      const openId = SELECT_IDS.find((id) => selectControls.get(id)?.isOpen());
      if (!openId) {
        return false;
      }
      flushSync(() => selectControls.get(openId)?.setOpen(false));
      if (options?.restoreFocus) {
        control.querySelector<HTMLElement>(`[data-wallpaper-ref="${SELECT_HOST_REFS[openId]}"] button`)?.focus();
      }
      return true;
    },
    // The menus are portaled to the body but still belong to the panel.
    containsSelectMenuTarget(target: Node | null) {
      return Boolean(target && SELECT_IDS.some((id) => documentObj
        .querySelector(`[data-react-select-owner="${id}"]`)?.contains(target)));
    },
    renderQuotePositionSelect(select: PanelSelectModel) {
      renderExternalSelect('quotePosition', select);
    },
    renderBookmarkViewModeSelect(select: PanelSelectModel) {
      renderExternalSelect('bookmarkViewMode', select);
    },
    renderBookmarkTopbarSurfaceSelect(select: PanelSelectModel) {
      renderExternalSelect('bookmarkTopbarSurface', select);
    }
  };
  return Object.freeze(controller);
}

export function createWallpaperViewApi() {
  return Object.freeze({
    implementation: 'react',
    createController: createWallpaperViewController
  });
}
