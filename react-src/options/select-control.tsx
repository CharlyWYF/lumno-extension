import { useLayoutEffect } from 'react';
import { SelectMenu } from '../shared/select-menu';
import {
  createReactRootController,
  type ReactRootController
} from './root-controller';

export interface SelectControlItemModel {
  badge?: string;
  iconUrl?: string;
  label: string;
  labelKey: string;
  value: string;
}

export interface SelectControlRenderModel {
  disabled?: boolean;
  id: string;
  items: SelectControlItemModel[];
  /** Id of the setting title; names the trigger together with the current value. */
  labelledBy?: string;
  value: string;
}

export interface SelectControlControllerOptions {
  /** Viewport space covered by sticky page chrome, so the menu never opens beneath it. */
  getViewportTopInset?(): number;
  kind: string;
  onSelect(value: string): void;
}

export type SelectControlController =
  ReactRootController<SelectControlRenderModel>;

// Options settings use the shared select so they get the same keyboard model,
// semantics and placement as New Tab menus. The menu stays inside the host to
// inherit the settings panel theme.
function SelectControl({
  host,
  model,
  options
}: {
  host: HTMLElement;
  model: SelectControlRenderModel;
  options: SelectControlControllerOptions;
}) {
  useLayoutEffect(() => {
    host.dataset.disabled = model.disabled ? 'true' : 'false';
  }, [host, model.disabled]);

  return (
    <SelectMenu
      config={{
        ariaLabelledBy: model.labelledBy,
        disabled: model.disabled,
        id: `${model.id}_control`,
        menuAlign: 'right',
        // Keep the trigger width as the minimum; longer translations expand the menu.
        menuMinWidth: '100%',
        menuPortal: false,
        menuWidth: 'content',
        onValueChange(value) {
          if (value !== model.value) {
            options.onSelect(value);
          }
        },
        options: model.items.map((item) => ({
          badge: item.badge || undefined,
          iconUrl: item.iconUrl || undefined,
          label: item.label,
          value: item.value
        })),
        selectId: model.id,
        value: model.value
      }}
      documentObj={host.ownerDocument}
      getViewportTopInset={options.getViewportTopInset}
      host={host}
      windowObj={host.ownerDocument.defaultView || window}
    />
  );
}

export function createSelectControlController(
  host: HTMLElement | null,
  options: SelectControlControllerOptions
): SelectControlController {
  if (host) {
    host.dataset.reactIsland = 'options-select-control';
    host.dataset.selectKind = options.kind;
  }
  return createReactRootController(
    host,
    (model: SelectControlRenderModel) => (host ? (
      <SelectControl host={host} model={model} options={options} />
    ) : null)
  );
}

export function createSelectControlApi() {
  return Object.freeze({
    implementation: 'react',
    createSelectControlController
  });
}
