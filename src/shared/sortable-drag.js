(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoSortableDrag = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // Pointer-driven reordering shared by Settings lists, chip rows and the search
  // scope panel. The dragged item follows the pointer and its peers slide into
  // the slots they would take, using transforms only, so a framework that owns
  // the DOM (React) never sees a node move. On drop the host gets one
  // `onReorder(item, fromIndex, toIndex, peers)` call and re-renders.
  const DEFAULT_THRESHOLD_PX = 5;
  const AUTO_SCROLL_EDGE_PX = 40;
  const AUTO_SCROLL_MAX_STEP_PX = 14;
  const SHIFT_TRANSITION = 'transform 160ms cubic-bezier(0.2, 0, 0, 1)';
  // Controls inside an item keep their own pointer behavior. An item that is
  // itself a button (a panel tile) still drags.
  const IGNORE_SELECTOR = [
    'input',
    'textarea',
    'select',
    'a[href]',
    'button',
    '[role="button"]',
    '[contenteditable="true"]',
    '[data-sort-ignore]'
  ].join(',');

  function isScrollable(element, win) {
    if (!element || element.nodeType !== 1) {
      return false;
    }
    const style = win.getComputedStyle(element);
    return /(auto|scroll|overlay)/.test(style.overflowY) &&
      element.scrollHeight > element.clientHeight + 1;
  }

  function findScrollParent(element, win) {
    let current = element ? element.parentElement : null;
    while (current) {
      if (isScrollable(current, win)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  // Written as !important so surfaces whose items reset everything with
  // `all: unset !important` (the search scope panel) still move.
  const STYLE_PROPS = ['transform', 'transition', 'z-index', 'position'];

  function saveStyles(element) {
    return STYLE_PROPS.map((prop) => [
      prop,
      element.style.getPropertyValue(prop),
      element.style.getPropertyPriority(prop)
    ]);
  }

  function restoreStyles(element, saved) {
    saved.forEach(([prop, value, priority]) => {
      if (prop === 'transition') {
        return;
      }
      if (value) {
        element.style.setProperty(prop, value, priority);
      } else {
        element.style.removeProperty(prop);
      }
    });
  }

  function setImportant(element, prop, value) {
    if (value) {
      element.style.setProperty(prop, value, 'important');
    } else {
      element.style.removeProperty(prop);
    }
  }

  function attach(container, options) {
    if (!container || typeof container.addEventListener !== 'function') {
      return () => {};
    }
    const settings = options && typeof options === 'object' ? options : {};
    const doc = container.ownerDocument;
    const win = doc.defaultView;
    const threshold = Number.isFinite(settings.threshold) ? settings.threshold : DEFAULT_THRESHOLD_PX;
    let pending = null;
    let drag = null;
    let frame = 0;

    function getScroll(scroller) {
      return {
        x: win.scrollX + (scroller ? scroller.scrollLeft : 0),
        y: win.scrollY + (scroller ? scroller.scrollTop : 0)
      };
    }

    function findItem(target) {
      const element = target && target.nodeType === 1 ? target : target && target.parentElement;
      const item = element && element.closest ? element.closest(settings.itemSelector) : null;
      if (!item || !container.contains(item)) {
        return null;
      }
      const control = element.closest(IGNORE_SELECTOR);
      if (control && control !== item && item.contains(control)) {
        return null;
      }
      return item;
    }

    function handlePointerDown(event) {
      if (drag || event.button !== 0 || event.isPrimary === false) {
        return;
      }
      const item = findItem(event.target);
      if (!item || (typeof settings.canStart === 'function' && !settings.canStart(item, event))) {
        return;
      }
      pending = { item, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      win.addEventListener('pointermove', handlePointerMove, true);
      win.addEventListener('pointerup', handlePointerUp, true);
      win.addEventListener('pointercancel', handlePointerCancel, true);
      win.addEventListener('keydown', handleKeyDown, true);
    }

    function begin(event) {
      const item = pending.item;
      const peers = typeof settings.getPeers === 'function'
        ? settings.getPeers(item).filter(Boolean)
        : [];
      const fromIndex = peers.indexOf(item);
      if (peers.length < 2 || fromIndex < 0) {
        return false;
      }
      const scroller = findScrollParent(item, win);
      const scroll = getScroll(scroller);
      const slots = peers.map((peer) => {
        const rect = peer.getBoundingClientRect();
        return {
          left: rect.left + scroll.x,
          top: rect.top + scroll.y,
          width: rect.width,
          height: rect.height
        };
      });
      const sameLeft = slots.every((slot) => Math.abs(slot.left - slots[0].left) < 2);
      const sameTop = slots.every((slot) => Math.abs(slot.top - slots[0].top) < 2);
      drag = {
        item,
        peers,
        slots,
        fromIndex,
        toIndex: fromIndex,
        scroller,
        layout: sameLeft ? 'column' : (sameTop ? 'row' : 'grid'),
        startPointer: { x: pending.x + scroll.x, y: pending.y + scroll.y },
        pointer: { x: event.clientX, y: event.clientY },
        bodyUserSelect: doc.body ? doc.body.style.userSelect : '',
        previous: peers.map(saveStyles)
      };
      peers.forEach((peer) => {
        if (peer !== item) {
          setImportant(peer, 'transition', SHIFT_TRANSITION);
        }
      });
      setImportant(item, 'transition', 'none');
      setImportant(item, 'z-index', '20');
      if (win.getComputedStyle(item).position === 'static') {
        setImportant(item, 'position', 'relative');
      }
      item.setAttribute('data-sort-dragging', 'true');
      container.setAttribute('data-sort-active', 'true');
      if (doc.body) {
        doc.body.style.userSelect = 'none';
      }
      const selection = win.getSelection && win.getSelection();
      if (selection && typeof selection.removeAllRanges === 'function') {
        selection.removeAllRanges();
      }
      if (typeof settings.onStart === 'function') {
        settings.onStart(item, peers);
      }
      return true;
    }

    function getTargetIndex(center) {
      let best = drag.fromIndex;
      let bestDistance = Infinity;
      drag.slots.forEach((slot, index) => {
        const dx = slot.left + slot.width / 2 - center.x;
        const dy = slot.top + slot.height / 2 - center.y;
        const distance = drag.layout === 'column'
          ? Math.abs(dy)
          : (drag.layout === 'row' ? Math.abs(dx) : Math.hypot(dx, dy));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      return best;
    }

    // Where peer `index` sits once the dragged item moves to `toIndex`.
    function getShift(index, toIndex) {
      const { fromIndex, slots, layout } = drag;
      const moved = slots[fromIndex];
      if (layout === 'column' || layout === 'row') {
        const axisSize = layout === 'column' ? 'height' : 'width';
        const axisStart = layout === 'column' ? 'top' : 'left';
        const neighbor = slots[fromIndex + 1] || slots[fromIndex - 1];
        const gap = neighbor
          ? Math.max(0, Math.abs(neighbor[axisStart] - moved[axisStart]) -
            (neighbor[axisStart] > moved[axisStart] ? moved[axisSize] : neighbor[axisSize]))
          : 0;
        const step = moved[axisSize] + gap;
        let delta = 0;
        if (fromIndex < toIndex && index > fromIndex && index <= toIndex) {
          delta = -step;
        } else if (fromIndex > toIndex && index < fromIndex && index >= toIndex) {
          delta = step;
        }
        return layout === 'column' ? { x: 0, y: delta } : { x: delta, y: 0 };
      }
      let slotIndex = index;
      if (fromIndex < toIndex && index > fromIndex && index <= toIndex) {
        slotIndex = index - 1;
      } else if (fromIndex > toIndex && index < fromIndex && index >= toIndex) {
        slotIndex = index + 1;
      }
      return {
        x: slots[slotIndex].left - slots[index].left,
        y: slots[slotIndex].top - slots[index].top
      };
    }

    function render() {
      if (!drag) {
        return;
      }
      const scroll = getScroll(drag.scroller);
      const dx = drag.pointer.x + scroll.x - drag.startPointer.x;
      const dy = drag.pointer.y + scroll.y - drag.startPointer.y;
      const moved = drag.slots[drag.fromIndex];
      const center = {
        x: moved.left + moved.width / 2 + dx,
        y: moved.top + moved.height / 2 + dy
      };
      const constrainedDx = drag.layout === 'column' ? 0 : dx;
      const constrainedDy = drag.layout === 'row' ? 0 : dy;
      setImportant(drag.item, 'transform', `translate(${constrainedDx}px, ${constrainedDy}px)`);
      const toIndex = getTargetIndex(center);
      if (toIndex !== drag.toIndex || !drag.rendered) {
        drag.toIndex = toIndex;
        drag.rendered = true;
        drag.peers.forEach((peer, index) => {
          if (peer === drag.item) {
            return;
          }
          const shift = getShift(index, toIndex);
          setImportant(peer, 'transform', shift.x || shift.y ? `translate(${shift.x}px, ${shift.y}px)` : '');
        });
      }
    }

    function autoScroll() {
      frame = 0;
      if (!drag) {
        return;
      }
      const bounds = drag.scroller
        ? drag.scroller.getBoundingClientRect()
        : { top: 0, bottom: win.innerHeight };
      const { y } = drag.pointer;
      let step = 0;
      if (y < bounds.top + AUTO_SCROLL_EDGE_PX) {
        step = -Math.ceil(AUTO_SCROLL_MAX_STEP_PX * Math.min(1, (bounds.top + AUTO_SCROLL_EDGE_PX - y) / AUTO_SCROLL_EDGE_PX));
      } else if (y > bounds.bottom - AUTO_SCROLL_EDGE_PX) {
        step = Math.ceil(AUTO_SCROLL_MAX_STEP_PX * Math.min(1, (y - bounds.bottom + AUTO_SCROLL_EDGE_PX) / AUTO_SCROLL_EDGE_PX));
      }
      if (step) {
        if (drag.scroller) {
          drag.scroller.scrollTop += step;
        } else {
          win.scrollBy(0, step);
        }
        render();
        frame = win.requestAnimationFrame(autoScroll);
      }
    }

    function handlePointerMove(event) {
      if (!pending || (pending.pointerId !== undefined && event.pointerId !== pending.pointerId)) {
        return;
      }
      if (!drag) {
        if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < threshold) {
          return;
        }
        if (!begin(event)) {
          stop();
          return;
        }
      }
      event.preventDefault();
      drag.pointer = { x: event.clientX, y: event.clientY };
      render();
      if (!frame) {
        frame = win.requestAnimationFrame(autoScroll);
      }
    }

    function suppressNextClick() {
      const swallow = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
      };
      win.addEventListener('click', swallow, { capture: true, once: true });
      // The click that ends a drag fires right after pointerup; nothing later.
      win.setTimeout(() => win.removeEventListener('click', swallow, true), 0);
    }

    function finish(commit) {
      const current = drag;
      stop();
      if (!current) {
        return;
      }
      current.peers.forEach((peer, index) => {
        const previous = current.previous[index];
        setImportant(peer, 'transition', 'none');
        restoreStyles(peer, previous);
        // Restore the author's transition after this frame so nothing animates
        // back from the drag offset.
        win.requestAnimationFrame(() => {
          const [, value, priority] = previous.find(([prop]) => prop === 'transition');
          if (value) {
            peer.style.setProperty('transition', value, priority);
          } else {
            peer.style.removeProperty('transition');
          }
        });
      });
      current.item.removeAttribute('data-sort-dragging');
      container.removeAttribute('data-sort-active');
      if (doc.body) {
        doc.body.style.userSelect = current.bodyUserSelect;
      }
      suppressNextClick();
      if (commit && current.toIndex !== current.fromIndex &&
          typeof settings.onReorder === 'function') {
        settings.onReorder(current.item, current.fromIndex, current.toIndex, current.peers);
      }
      if (typeof settings.onEnd === 'function') {
        settings.onEnd(current.item);
      }
    }

    function stop() {
      pending = null;
      win.removeEventListener('pointermove', handlePointerMove, true);
      win.removeEventListener('pointerup', handlePointerUp, true);
      win.removeEventListener('pointercancel', handlePointerCancel, true);
      win.removeEventListener('keydown', handleKeyDown, true);
      if (frame) {
        win.cancelAnimationFrame(frame);
        frame = 0;
      }
      drag = null;
    }

    function handlePointerUp(event) {
      if (!drag) {
        stop();
        return;
      }
      drag.pointer = { x: event.clientX, y: event.clientY };
      render();
      finish(true);
    }

    function handlePointerCancel() {
      if (drag) {
        finish(false);
      } else {
        stop();
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape' && drag) {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    }

    // A favicon or link inside an item would otherwise start a native drag,
    // which cancels the pointer stream.
    function handleNativeDragStart(event) {
      if (pending || drag) {
        event.preventDefault();
      }
    }

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('dragstart', handleNativeDragStart);
    return function detach() {
      if (drag) {
        finish(false);
      } else {
        stop();
      }
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('dragstart', handleNativeDragStart);
    };
  }

  return Object.freeze({
    attach
  });
});
