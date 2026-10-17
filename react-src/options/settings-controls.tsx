import {
  type CSSProperties,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  createReactRootController,
  type ReactRootController
} from './root-controller';
import {
  RangeSliderField
} from '../shared/range-slider';

export interface ToggleControlRenderModel {
  ariaLabel?: string;
  ariaLabelKey?: string;
  checked: boolean;
  disabled?: boolean;
  id: string;
}

export interface ToggleControlControllerOptions {
  kind: string;
  onChange(checked: boolean): void;
}

export type ToggleControlController =
  ReactRootController<ToggleControlRenderModel>;

export interface RangeSliderControlRenderModel {
  ariaLabel: string;
  defaultValue?: number;
  disabled?: boolean;
  id: string;
  max: number;
  min: number;
  step: number;
  ticks: Array<{
    align?: 'start' | 'center' | 'end';
    label: string;
    percent?: number;
  }>;
  value: number;
  valueSuffix?: string;
  resetAriaLabel?: string;
  resetButtonId?: string;
}

export interface RangeSliderControlControllerOptions {
  kind: string;
  onInput(value: number): void;
}

export type RangeSliderControlController =
  ReactRootController<RangeSliderControlRenderModel>;

export interface RequiredCheckboxItemModel {
  checked: boolean;
  id: string;
  label: string;
  labelKey: string;
  value: string;
}

export interface RequiredCheckboxGroupRenderModel {
  items: RequiredCheckboxItemModel[];
  // The items can be reordered: dragged (wired by the page) or moved with
  // Alt+Left and Alt+Right from a focused checkbox.
  sortable?: boolean;
}

export interface RequiredCheckboxGroupControllerOptions {
  kind: string;
  onChange(values: string[]): void;
  onMove?(fromIndex: number, toIndex: number): void;
}

export type RequiredCheckboxGroupController =
  ReactRootController<RequiredCheckboxGroupRenderModel>;

function ToggleControl({
  model,
  onChange
}: {
  model: ToggleControlRenderModel;
  onChange(checked: boolean): void;
}) {
  const [checked, setChecked] = useState(model.checked);

  useEffect(() => {
    setChecked(model.checked);
  }, [model.checked]);

  const ariaProps = model.ariaLabelKey
    ? { 'data-i18n-aria-label': model.ariaLabelKey }
    : {};

  return (
    <>
      <input
        {...ariaProps}
        aria-label={model.ariaLabel}
        checked={checked}
        disabled={model.disabled}
        id={model.id}
        onChange={(event) => {
          const next = event.currentTarget.checked;
          setChecked(next);
          onChange(next);
        }}
        type="checkbox"
      />
      <span
        aria-hidden="true"
        className="_x_extension_switch_slider_2024_unique_"
      />
    </>
  );
}

function RequiredCheckboxGroup({
  model,
  onChange,
  onMove
}: {
  model: RequiredCheckboxGroupRenderModel;
  onChange(values: string[]): void;
  onMove?(fromIndex: number, toIndex: number): void;
}) {
  const sortable = Boolean(model.sortable && onMove && model.items.length > 1);
  const serializedValues = model.items
    .filter((item) => item.checked)
    .map((item) => item.value)
    .join('\u0000');
  const [selected, setSelected] = useState(
    () => new Set(serializedValues ? serializedValues.split('\u0000') : [])
  );

  useEffect(() => {
    setSelected(new Set(serializedValues ? serializedValues.split('\u0000') : []));
  }, [serializedValues]);

  return (
    <>
      {model.items.map((item, index) => (
        <label
          className="_x_extension_checkbox_2026_unique_"
          data-sortable={sortable ? 'true' : undefined}
          data-value={item.value}
          key={item.value}
        >
          <input
            checked={selected.has(item.value)}
            data-search-result-source-type={item.value}
            id={item.id}
            onKeyDown={sortable ? (event) => {
              if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
                return;
              }
              const target = index + (event.key === 'ArrowLeft' ? -1 : 1);
              event.preventDefault();
              if (target >= 0 && target < model.items.length && onMove) {
                onMove(index, target);
              }
            } : undefined}
            onChange={(event) => {
              const next = new Set(selected);
              if (event.currentTarget.checked) {
                next.add(item.value);
              } else {
                next.delete(item.value);
              }
              if (next.size === 0) {
                return;
              }
              setSelected(next);
              onChange(model.items
                .map((entry) => entry.value)
                .filter((value) => next.has(value)));
            }}
            type="checkbox"
          />
          <span data-i18n={item.labelKey}>{item.label}</span>
        </label>
      ))}
    </>
  );
}

function RangeSliderControl({
  model,
  onInput
}: {
  model: RangeSliderControlRenderModel;
  onInput(value: number): void;
}) {
  const [value, setValue] = useState(model.value);
  const [draftValue, setDraftValue] = useState(String(model.value));
  const valueRef = useRef(model.value);

  useEffect(() => {
    valueRef.current = model.value;
    setValue(model.value);
    setDraftValue(String(model.value));
  }, [model.value]);

  const normalizeValue = (next: number) => {
    const min = Number(model.min);
    const max = Number(model.max);
    const step = Number(model.step) > 0 ? Number(model.step) : 1;
    if (!Number.isFinite(next)) {
      return valueRef.current;
    }
    const stepped = min + Math.round((next - min) / step) * step;
    return Math.min(max, Math.max(min, stepped));
  };
  const handleValueChange = (next: number) => {
    const normalized = normalizeValue(next);
    setDraftValue(String(normalized));
    if (normalized === valueRef.current) {
      return;
    }
    valueRef.current = normalized;
    setValue(normalized);
    onInput(normalized);
  };
  const commitDraftValue = () => {
    const next = Number(draftValue);
    if (!draftValue.trim() || !Number.isFinite(next)) {
      setDraftValue(String(valueRef.current));
      return;
    }
    handleValueChange(next);
  };
  const valueText = `${value}${model.valueSuffix || ''}`;
  return (
    <div className="_x_extension_range_slider_control_2026_unique_">
      <RangeSliderField
        aria-label={model.ariaLabel}
        aria-valuetext={valueText}
        className="x-lumno-range-slider"
        disabled={model.disabled}
        id={model.id}
        inputClass="x-lumno-range-slider-input"
        max={model.max}
        min={model.min}
        resetButtonProps={Number.isFinite(model.defaultValue) && model.resetAriaLabel
          ? {
              'aria-label': model.resetAriaLabel,
              disabled: Boolean(model.disabled || value === model.defaultValue),
              id: model.resetButtonId,
              onClick: (event) => {
                handleValueChange(Number(model.defaultValue));
                event.currentTarget.blur();
              },
              title: model.resetAriaLabel
            }
          : undefined}
        onChange={(event) => {
          handleValueChange(Number(event.currentTarget.value));
        }}
        onInput={(event) => {
          handleValueChange(Number(event.currentTarget.value));
        }}
        step={model.step}
        style={{
          '--x-range-slider-percent': `${
            ((value - model.min) / (model.max - model.min)) * 100
          }%`
        } as CSSProperties}
        value={value}
        valueInputProps={{
          'aria-label': model.ariaLabel,
          disabled: model.disabled,
          inputMode: 'numeric',
          onBlur: commitDraftValue,
          onChange: (event) => {
            setDraftValue(event.currentTarget.value);
          },
          onKeyDown: (event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDraftValue();
              event.currentTarget.blur();
            }
          },
          value: draftValue
        }}
        marks={model.ticks.map((tick, index) =>
          Number.isFinite(tick.percent)
            ? Number(tick.percent)
            : (index / Math.max(1, model.ticks.length - 1)) * 100
        )}
      />
    </div>
  );
}

export function createToggleControlController(
  host: HTMLElement | null,
  options: ToggleControlControllerOptions
): ToggleControlController {
  if (host) {
    host.dataset.reactIsland = 'options-toggle-control';
    host.dataset.toggleKind = options.kind;
  }
  return createReactRootController(
    host,
    (model: ToggleControlRenderModel) => (
      <ToggleControl model={model} onChange={options.onChange} />
    )
  );
}

export function createRequiredCheckboxGroupController(
  host: HTMLElement | null,
  options: RequiredCheckboxGroupControllerOptions
): RequiredCheckboxGroupController {
  if (host) {
    host.dataset.reactIsland = 'options-required-checkbox-group';
    host.dataset.checkboxGroupKind = options.kind;
  }
  return createReactRootController(
    host,
    (model: RequiredCheckboxGroupRenderModel) => (
      <RequiredCheckboxGroup
        model={model}
        onChange={options.onChange}
        onMove={options.onMove}
      />
    )
  );
}

export function createRangeSliderControlController(
  host: HTMLElement | null,
  options: RangeSliderControlControllerOptions
): RangeSliderControlController {
  if (host) {
    host.dataset.reactIsland = 'options-range-slider-control';
    host.dataset.rangeSliderKind = options.kind;
  }
  return createReactRootController(
    host,
    (model: RangeSliderControlRenderModel) => (
      <RangeSliderControl model={model} onInput={options.onInput} />
    )
  );
}

export function createSettingsControlsApi() {
  return Object.freeze({
    implementation: 'react',
    createRangeSliderControlController,
    createRequiredCheckboxGroupController,
    createToggleControlController
  });
}
