export interface ReorderCopyModel {
  moveDownLabel: string;
  moveUpLabel: string;
}

/**
 * Move up and move down for one row of a reorderable Settings list. Dragging
 * the row itself is wired by the page (LumnoSortableDrag); these buttons keep
 * the same move reachable without a pointer. They sit before the row actions
 * and only show while the row is hovered or focused, so the row keeps its
 * layout.
 */
export function ReorderButtons({
  copy,
  index,
  onMove,
  total
}: {
  copy: ReorderCopyModel;
  index: number;
  onMove(fromIndex: number, toIndex: number): void;
  total: number;
}) {
  if (total < 2) {
    return null;
  }
  const move = (delta: number) => {
    const target = index + delta;
    if (target >= 0 && target < total) {
      onMove(index, target);
    }
  };
  return (
    <div className="_x_extension_shortcut_reorder_2026_unique_">
      <button
        aria-label={copy.moveUpLabel}
        className="_x_extension_shortcut_move_2026_unique_"
        data-move="up"
        disabled={index === 0}
        onClick={(event) => {
          event.stopPropagation();
          move(-1);
        }}
        type="button"
      >
        <i aria-hidden="true" className="ri-icon ri-size-14 ri-arrow-up-s-line" />
      </button>
      <button
        aria-label={copy.moveDownLabel}
        className="_x_extension_shortcut_move_2026_unique_"
        data-move="down"
        disabled={index === total - 1}
        onClick={(event) => {
          event.stopPropagation();
          move(1);
        }}
        type="button"
      >
        <i aria-hidden="true" className="ri-icon ri-size-14 ri-arrow-down-s-line" />
      </button>
    </div>
  );
}
