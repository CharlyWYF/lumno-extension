import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import {
  PopconfirmContent,
  type PopconfirmCopy
} from '../shared/popconfirm-content';

export interface PopconfirmRenderModel extends PopconfirmCopy {
  open: boolean;
}

export interface PopconfirmControllerOptions {
  onCancel(): void;
  onConfirm(): void;
}

export interface PopconfirmController {
  render(model: PopconfirmRenderModel): void;
  destroy(): void;
}

export function createPopconfirmController(
  host: HTMLElement | null,
  options: PopconfirmControllerOptions
): PopconfirmController {
  if (!host) {
    return Object.freeze({
      render() {},
      destroy() {}
    });
  }

  const hostElement = host;
  const reactRoot: Root = createRoot(hostElement);
  let destroyed = false;
  hostElement.className = '_x_extension_popconfirm_2024_unique_';
  hostElement.dataset.open = 'false';
  hostElement.dataset.reactIsland = 'options-popconfirm';

  function render(model: PopconfirmRenderModel): void {
    if (destroyed) {
      return;
    }
    hostElement.dataset.open = model.open ? 'true' : 'false';
    hostElement.setAttribute('aria-hidden', model.open ? 'false' : 'true');
    hostElement.setAttribute('aria-label', model.message);
    hostElement.setAttribute('role', 'dialog');
    flushSync(() => {
      reactRoot.render(model.open ? (
        <PopconfirmContent
          copy={model}
          onCancel={options.onCancel}
          onConfirm={options.onConfirm}
        />
      ) : null);
    });
  }

  return Object.freeze({
    render,
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      hostElement.dataset.open = 'false';
      flushSync(() => {
        reactRoot.unmount();
      });
    }
  });
}

export function createPopconfirmApi() {
  return Object.freeze({
    implementation: 'react',
    createPopconfirmController
  });
}
