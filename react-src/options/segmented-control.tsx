import {
  createReactRootController,
  type ReactRootController
} from './root-controller';
import { useRef, type KeyboardEvent } from 'react';
import { useSegmentedIndicator } from '../shared/segmented-indicator';

export interface SegmentedControlItemModel {
  iconClass?: string;
  label: string;
  labelKey: string;
  value: string;
}

export interface SegmentedControlSelectModel {
  id: string;
}

export interface SegmentedControlRenderModel {
  activeValue: string;
  dataAttribute: `data-${string}`;
  disabled?: boolean;
  items: SegmentedControlItemModel[];
  select?: SegmentedControlSelectModel;
}

export interface SegmentedControlControllerOptions {
  kind: string;
  onSelect(value: string): void;
}

export type SegmentedControlController =
  ReactRootController<SegmentedControlRenderModel>;

function SegmentedControl({
  model,
  onSelect
}: {
  model: SegmentedControlRenderModel;
  onSelect(value: string): void;
}) {
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const hasActiveItem = model.items.some((item) => item.value === model.activeValue);
  const itemSignature = model.items
    .map((item) => `${item.value}\u0000${item.label}`)
    .join('\u0001');

  useSegmentedIndicator(
    indicatorRef,
    `${model.activeValue}\u0002${model.dataAttribute}\u0002${itemSignature}`
  );

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    if (model.disabled || model.items.length < 2) {
      return;
    }
    // Radio group keys: arrows move the selection, wrapping; Home/End jump.
    const { key } = event;
    const step = key === 'ArrowRight' || key === 'ArrowDown'
      ? 1
      : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
    if (!step && key !== 'Home' && key !== 'End') {
      return;
    }
    event.preventDefault();
    const nextIndex = key === 'Home'
      ? 0
      : key === 'End'
        ? model.items.length - 1
        : (currentIndex + step + model.items.length) % model.items.length;
    const nextItem = model.items[nextIndex];
    const buttonGroup = event.currentTarget.parentElement;
    onSelect(nextItem.value);
    window.requestAnimationFrame(() => {
      const buttons = buttonGroup?.querySelectorAll<HTMLButtonElement>(
        `button[${model.dataAttribute}]`
      );
      buttons?.[nextIndex]?.focus();
    });
  };

  return (
    <>
      <span
        aria-hidden="true"
        className="_x_extension_theme_indicator_2024_unique_"
        data-ready="false"
        ref={indicatorRef}
      />
      {model.items.map((item, index) => {
        const active = item.value === model.activeValue;
        // Roving tab stop: only the selected option (or the first, when none
        // is selected) is in the tab order; arrows move between options.
        const tabStop = active || (index === 0 && !hasActiveItem);
        const dataProps = {
          [model.dataAttribute]: item.value
        };
        return (
          <button
            {...dataProps}
            aria-checked={active}
            className="_x_extension_theme_option_2024_unique_"
            data-active={active ? 'true' : 'false'}
            disabled={model.disabled}
            key={item.value}
            onClick={() => onSelect(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            role="radio"
            tabIndex={tabStop ? 0 : -1}
            type="button"
          >
            {item.iconClass ? (
              <i aria-hidden="true" className={item.iconClass} />
            ) : null}
            <span data-i18n={item.labelKey}>{item.label}</span>
          </button>
        );
      })}
      {model.select ? (
        <select
          aria-hidden="true"
          className="_x_extension_select_2024_unique_"
          id={model.select.id}
          onChange={(event) => onSelect(event.currentTarget.value)}
          disabled={model.disabled}
          style={{ display: 'none' }}
          tabIndex={-1}
          value={model.activeValue}
        >
          {model.items.map((item) => (
            <option data-i18n={item.labelKey} key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      ) : null}
    </>
  );
}

export function createSegmentedControlController(
  host: HTMLElement | null,
  options: SegmentedControlControllerOptions
): SegmentedControlController {
  if (host) {
    host.dataset.reactIsland = 'options-segmented-control';
    host.dataset.segmentedKind = options.kind;
    // The options inside are radios; the host keeps its own aria-label.
    host.setAttribute('role', 'radiogroup');
  }
  return createReactRootController(
    host,
    (model: SegmentedControlRenderModel) => (
      <SegmentedControl model={model} onSelect={options.onSelect} />
    )
  );
}

export function createSegmentedControlApi() {
  return Object.freeze({
    implementation: 'react',
    createSegmentedControlController
  });
}
