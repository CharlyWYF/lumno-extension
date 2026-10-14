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
  let isOpen = false;
  // What had focus when the bubble opened (its trigger), to return to on close.
  let returnFocusTarget: HTMLElement | null = null;
  hostElement.className = '_x_extension_popconfirm_2024_unique_';
  hostElement.dataset.open = 'false';
  hostElement.dataset.reactIsland = 'options-popconfirm';

  // Escape works like Cancel while the bubble holds focus.
  function onHostKeyDown(event: KeyboardEvent): void {
    if (!isOpen || event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    options.onCancel();
  }
  hostElement.addEventListener('keydown', onHostKeyDown);

  function render(model: PopconfirmRenderModel): void {
    if (destroyed) {
      return;
    }
    const opening = model.open && !isOpen;
    const closing = !model.open && isOpen;
    const ownerDocument = hostElement.ownerDocument;
    if (opening) {
      const active = ownerDocument.activeElement;
      returnFocusTarget = active instanceof HTMLElement && active !== ownerDocument.body ? active : null;
    }
    // Only take focus back when it was inside the bubble; an outside click
    // that closed it keeps focus where the user put it.
    const focusWasInside = closing && hostElement.contains(ownerDocument.activeElement);
    isOpen = model.open;
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
    if (opening) {
      hostElement.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    } else if (closing) {
      const target = returnFocusTarget;
      returnFocusTarget = null;
      if (focusWasInside && target?.isConnected) {
        target.focus({ preventScroll: true });
      }
    }
  }

  return Object.freeze({
    render,
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      isOpen = false;
      returnFocusTarget = null;
      hostElement.removeEventListener('keydown', onHostKeyDown);
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
