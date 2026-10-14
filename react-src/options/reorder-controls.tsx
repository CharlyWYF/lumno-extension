import type { DragEvent } from 'react';

export interface ReorderCopyModel {
  moveDownLabel: string;
  moveUpLabel: string;
  reorderHandleLabel: string;
}

export interface RowDragHandlers {
  onDragEnd(): void;
  onDragOver(event: DragEvent<HTMLElement>): void;
  onDragStart(event: DragEvent<HTMLElement>): void;
  onDrop(event: DragEvent<HTMLElement>): void;
}

export interface RowDragOptions {
  getFromIndex(): number | null;
  index: number;
  onReorder(fromIndex: number, toIndex: number): void;
  setFromIndex(value: number | null): void;
}

/**
 * Row drag wiring shared by the Search sources lists. Dropping above or below a
 * row's midpoint inserts before or after it, and the dragged row is removed
 * from its old slot first, so the resolved index already accounts for that.
 */
export function createRowDragHandlers(options: RowDragOptions): RowDragHandlers {
  const { getFromIndex, index, onReorder, setFromIndex } = options;
  return {
    onDragEnd: () => setFromIndex(null),
    onDragOver: (event) => {
      if (getFromIndex() === null) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    onDragStart: (event) => {
      setFromIndex(index);
      event.dataTransfer.effectAllowed = 'move';
      // Firefox refuses to start a drag unless some data is set.
      event.dataTransfer.setData('text/plain', String(index));
    },
    onDrop: (event) => {
      const from = getFromIndex();
      setFromIndex(null);
      if (from === null) {
        return;
      }
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      let to = event.clientY > bounds.top + bounds.height / 2 ? index + 1 : index;
      if (from < to) {
        to -= 1;
      }
      if (to !== from) {
        onReorder(from, to);
      }
    }
  };
}

/**
 * Ordering affordance for one row: a drag handle for pointer users plus up and
 * down buttons that keep the same operation reachable from the keyboard. Both
 * paths call one `onReorder(fromIndex, toIndex)` callback so callers store a
 * single order.
 */
export function ReorderControls({
  copy,
  dragStart,
  index,
  onReorder,
  total
}: {
  copy: ReorderCopyModel;
  dragStart?(event: DragEvent<HTMLElement>): void;
  index: number;
  onReorder(fromIndex: number, toIndex: number): void;
  total: number;
}) {
  const step = (delta: number) => {
    const to = index + delta;
    if (to >= 0 && to < total) {
      onReorder(index, to);
    }
  };
  return (
    <div
      className="_x_extension_shortcut_reorder_2026_unique_"
      data-reorder-index={String(index)}
    >
      <button
        aria-label={copy.moveUpLabel}
        className="_x_extension_shortcut_reorder_button_2026_unique_"
        data-reorder-action="up"
        disabled={index === 0}
        onClick={(event) => {
          event.stopPropagation();
          step(-1);
        }}
        type="button"
      >
        <i aria-hidden="true" className="ri-icon ri-size-14 ri-arrow-up-s-line" />
      </button>
      <span
        aria-label={copy.reorderHandleLabel}
        className="_x_extension_shortcut_reorder_handle_2026_unique_"
        data-reorder-handle="true"
        draggable
        onDragStart={dragStart}
        role="img"
        title={copy.reorderHandleLabel}
      >
        <i aria-hidden="true" className="ri-icon ri-size-14 ri-draggable" />
      </span>
      <button
        aria-label={copy.moveDownLabel}
        className="_x_extension_shortcut_reorder_button_2026_unique_"
        data-reorder-action="down"
        disabled={index === total - 1}
        onClick={(event) => {
          event.stopPropagation();
          step(1);
        }}
        type="button"
      >
        <i aria-hidden="true" className="ri-icon ri-size-14 ri-arrow-down-s-line" />
      </button>
    </div>
  );
}
