import { useEffect, useId, useRef, useState } from 'react';
import { useExclusiveAsyncAction } from '../shared/use-exclusive-async-action';
import {
  PopconfirmContent,
  type PopconfirmCopy
} from '../shared/popconfirm-content';

export interface InlinePopconfirmCopy extends PopconfirmCopy {}

export function InlinePopconfirm({
  copy,
  onConfirm,
  triggerAriaLabel,
  triggerClassName,
  triggerIconClass,
  triggerDisabled = false
}: {
  copy: InlinePopconfirmCopy;
  onConfirm(): void | Promise<void>;
  triggerAriaLabel: string;
  triggerClassName: string;
  triggerIconClass: string;
  triggerDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreTriggerFocusRef = useRef(false);
  const popconfirmId = useId();
  const confirmAction = useExclusiveAsyncAction(onConfirm);

  const closeAndRestoreTriggerFocus = () => {
    restoreTriggerFocusRef.current = true;
    setOpen(false);
  };

  useEffect(() => {
    if (open || !restoreTriggerFocusRef.current) {
      return;
    }
    restoreTriggerFocusRef.current = false;
    triggerRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAndRestoreTriggerFocus();
      }
    };
    document.addEventListener('pointerdown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [open]);

  return (
    <div
      className="_x_extension_popconfirm_wrap_2024_unique_"
      data-react-surface="options-inline-popconfirm"
      ref={wrapRef}
    >
      <button
        aria-controls={popconfirmId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={triggerAriaLabel}
        className={triggerClassName}
        disabled={confirmAction.pending || triggerDisabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        ref={triggerRef}
        type="button"
      >
        <i aria-hidden="true" className={triggerIconClass} />
      </button>
      <div
        aria-hidden={!open}
        aria-label={copy.message}
        className="_x_extension_popconfirm_2024_unique_"
        data-open={open ? 'true' : 'false'}
        id={popconfirmId}
        role="dialog"
      >
        {open ? (
          <PopconfirmContent
            busy={confirmAction.pending}
            copy={copy}
            onCancel={closeAndRestoreTriggerFocus}
            onConfirm={() => {
              void confirmAction.run().then((outcome) => {
                if (outcome.status !== 'skipped') {
                  closeAndRestoreTriggerFocus();
                }
              });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
