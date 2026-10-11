// The card a help center result shows while it is hovered or picked with the arrow keys: the
// passage around the match (src/shared/help-center-search.js builds it from the help center's
// index), laid out as the page has it, beside the result list. It wears the shared tooltip's
// look and theme (src/shared/tooltip.css), so it matches every other tooltip on both surfaces.

export interface HelpPassageBlock {
  kind: 'heading' | 'text' | 'bullet' | 'step' | 'row';
  text?: string;
  marker?: string;
  cells?: string[];
  header?: boolean;
}

export type HighlightParts = (
  text: string
) => Array<{ text: string; highlighted: boolean }>;

export interface HelpPassageCardOptions {
  document: Document;
  // Where the card lives: the overlay's shadow root, or the New Tab body.
  getHost: () => Node | null;
  // The result list; the card sits to its right, else its left, else under it.
  getList: () => HTMLElement | null;
  highlight: HighlightParts;
}

export interface HelpPassageCard {
  show(row: HTMLElement, blocks: HelpPassageBlock[], options?: { delay?: boolean }): void;
  place(): void;
  hide(): void;
  destroy(): void;
}

const TOOLTIP_CLASS = '_x_extension_tooltip_2026_unique_';
const CARD_CLASS = '_x_extension_help_passage_2026_unique_';
const part = (name: string): string => `_x_extension_help_passage_${name}_2026_unique_`;
const GAP = 8;
// The first card waits a moment so passing over the list doesn't flash it; the next follows at once.
const HOVER_DELAY_MS = 250;

export function isHelpPassage(value: unknown): value is HelpPassageBlock[] {
  return Array.isArray(value) && value.length > 0 && value.every(
    (block) => block && typeof block === 'object' && typeof (block as HelpPassageBlock).kind === 'string'
  );
}

export function createHelpPassageCard(options: HelpPassageCardOptions): HelpPassageCard {
  const doc = options.document;
  const win = doc.defaultView;
  let card: HTMLDivElement | null = null;
  let row: HTMLElement | null = null;
  let blocks: HelpPassageBlock[] | null = null;
  let timer = 0;

  function element(tag: string, className: string, parent: Node): HTMLElement {
    const node = doc.createElement(tag);
    node.className = className;
    parent.appendChild(node);
    return node;
  }

  function fill(target: HTMLElement, text: string): void {
    options.highlight(text).forEach((piece) => {
      if (piece.highlighted) {
        element('mark', part('mark'), target).textContent = piece.text;
      } else {
        target.appendChild(doc.createTextNode(piece.text));
      }
    });
  }

  function ensureCard(): HTMLDivElement | null {
    const host = options.getHost();
    if (!host) {
      return null;
    }
    if (!card) {
      card = doc.createElement('div');
      card.className = `${TOOLTIP_CLASS} ${CARD_CLASS}`;
      card.setAttribute('role', 'tooltip');
      card.setAttribute('translate', 'no');
      card.setAttribute('data-visible', 'false');
      card.setAttribute('aria-hidden', 'true');
    }
    if (card.parentNode !== host) {
      host.appendChild(card);
    }
    return card;
  }

  function render(target: HTMLDivElement, passage: HelpPassageBlock[]): void {
    target.replaceChildren();
    let list: HTMLElement | null = null;
    let table: HTMLElement | null = null;
    passage.forEach((block, index) => {
      const previous = passage[index - 1];
      if (block.kind === 'row') {
        if (!table || previous?.kind !== 'row') {
          table = element('table', part('table'), target);
        }
        const tr = element('tr', '', table);
        (block.cells || []).forEach((cell) => {
          fill(element(block.header ? 'th' : 'td', part(block.header ? 'th' : 'td'), tr), cell);
        });
        return;
      }
      if (block.kind === 'bullet' || block.kind === 'step') {
        if (!list || previous?.kind !== block.kind) {
          list = element(block.kind === 'step' ? 'ol' : 'ul', part('list'), target);
          const start = parseInt(String(block.marker || ''), 10);
          if (block.kind === 'step' && start > 1) {
            list.setAttribute('start', String(start));
          }
        }
        fill(element('li', part('item'), list), String(block.text || ''));
        return;
      }
      fill(
        element('p', block.kind === 'heading' ? part('heading') : part('text'), target),
        String(block.text || '')
      );
    });
  }

  function place(): void {
    const list = options.getList();
    if (!card || !row || !list || !win) {
      return;
    }
    const listRect = list.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const width = win.innerWidth;
    const height = win.innerHeight;
    const { offsetWidth: w, offsetHeight: h } = card;
    const clamp = (value: number, max: number): number => Math.max(GAP, Math.min(value, max - GAP));
    let placement = 'right';
    let x = listRect.right + GAP;
    let y = clamp(rowRect.top, height - h);
    if (x + w > width - GAP) {
      placement = 'left';
      x = listRect.left - GAP - w;
    }
    // No room beside the list: under it, never over the other results or the search box.
    if (x < GAP) {
      if (listRect.bottom + GAP + h > height - GAP) {
        card.setAttribute('data-visible', 'false');
        return;
      }
      placement = 'bottom';
      x = clamp(listRect.left, width - w);
      y = listRect.bottom + GAP;
    }
    card.setAttribute('data-placement', placement);
    card.style.setProperty('left', `${Math.round(x)}px`);
    card.style.setProperty('top', `${Math.round(y)}px`);
    card.setAttribute('data-visible', 'true');
    card.setAttribute('aria-hidden', 'false');
  }

  function reveal(nextRow: HTMLElement, passage: HelpPassageBlock[]): void {
    const target = ensureCard();
    if (!target) {
      return;
    }
    if (nextRow !== row || passage !== blocks) {
      render(target, passage);
    }
    row = nextRow;
    blocks = passage;
    place();
  }

  function clearTimer(): void {
    if (timer && win) {
      win.clearTimeout(timer);
    }
    timer = 0;
  }

  return {
    show(nextRow, passage, showOptions) {
      clearTimer();
      const visible = card?.getAttribute('data-visible') === 'true';
      if (showOptions?.delay && !visible && win) {
        timer = win.setTimeout(() => {
          timer = 0;
          if (nextRow.isConnected) {
            reveal(nextRow, passage);
          }
        }, HOVER_DELAY_MS);
        return;
      }
      reveal(nextRow, passage);
    },
    place,
    hide() {
      clearTimer();
      row = null;
      blocks = null;
      card?.setAttribute('data-visible', 'false');
      card?.setAttribute('aria-hidden', 'true');
    },
    destroy() {
      clearTimer();
      card?.remove();
      card = null;
      row = null;
      blocks = null;
    }
  };
}
