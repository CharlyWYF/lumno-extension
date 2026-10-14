import { useId } from 'react';
import {
  createReactRootController,
  type ReactRootController
} from './root-controller';

export interface InfoButtonRenderModel {
  className?: string;
  iconClass?: string;
  label?: string;
  tooltip: string;
  tooltipKey?: string;
}

export type InfoButtonController = ReactRootController<InfoButtonRenderModel>;

export function InfoButton({
  className = '',
  iconClass = 'ri-information-line',
  label,
  tooltip,
  tooltipKey
}: InfoButtonRenderModel) {
  const descriptionId = useId();
  const classes = [
    '_x_extension_info_button_2026_unique_',
    '_x_extension_tooltip_host_2026_unique_',
    className
  ].filter(Boolean).join(' ');
  // The floating tooltip is drawn from data-tooltip; screen readers get the
  // same text as the name, or as a description when a separate label names it.
  const describesTooltip = Boolean(label) && label !== tooltip;

  return (
    <button
      aria-describedby={describesTooltip ? descriptionId : undefined}
      aria-label={label || tooltip}
      className={classes}
      data-i18n-tooltip={tooltipKey || undefined}
      data-tooltip={tooltip}
      type="button"
    >
      <i
        aria-hidden="true"
        className={`ri-icon ri-size-14 ${iconClass}`}
      />
      {describesTooltip ? <span hidden id={descriptionId}>{tooltip}</span> : null}
    </button>
  );
}

export function createInfoButtonController(
  host: HTMLElement | null
): InfoButtonController {
  if (host) {
    host.dataset.reactIsland = 'options-info-button';
  }
  return createReactRootController(
    host,
    (model: InfoButtonRenderModel) => <InfoButton {...model} />
  );
}

export function createInfoButtonApi() {
  return Object.freeze({
    implementation: 'react',
    createInfoButtonController
  });
}
