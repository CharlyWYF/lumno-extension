(function(root) {
  'use strict';

  // Search sources order on the Options page: the search panel group chips at
  // the top of Search sources, the per-list moves of the provider and aggregate
  // lists, and the browser content order on the result type checkboxes. All of
  // them edit one synced record (LumnoSearchSourceOrder); the page re-renders
  // its lists through `onChange`.
  const ORDER = root.LumnoSearchSourceOrder;
  const SORTABLE = root.LumnoSortableDrag;

  function createSearchSourceOrderController(config) {
    const options = config && typeof config === 'object' ? config : {};
    const getMessage = typeof options.getMessage === 'function'
      ? options.getMessage
      : (key, fallback) => fallback;
    const groupHost = options.groupHost || null;
    let order = ORDER.normalizeOrder(null);
    let writeQueue = Promise.resolve();
    const detachers = [];
    const history = ORDER.createHistory();

    function notify() {
      if (typeof options.onChange === 'function') {
        options.onChange(order);
      }
      renderGroupChips();
    }

    function accept(value) {
      order = ORDER.normalizeOrder(value);
      notify();
    }

    function load() {
      return Promise.resolve(options.read ? options.read() : undefined)
        .then((value) => accept(value))
        .catch(() => notify());
    }

    function persist(next, persistOptions) {
      if (!persistOptions || persistOptions.record !== false) {
        history.record(order, next);
      }
      order = next;
      notify();
      writeQueue = writeQueue
        .then(() => options.write(next))
        .catch(() => {
          if (typeof options.showToast === 'function') {
            options.showToast(getMessage('settings_search_source_order_failed', '排序保存失败，请重试。'), true);
          }
          // Show what storage really holds rather than an order that never landed.
          return load();
        });
      return writeQueue;
    }

    // Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z step through this page's moves, one at a
    // time and as many times as there are moves to step through.
    function stepHistory(direction) {
      const target = direction === 'redo' ? history.redo(order) : history.undo(order);
      if (!target) {
        return false;
      }
      persist(target, { record: false });
      if (typeof options.showToast === 'function') {
        options.showToast(direction === 'redo'
          ? getMessage('settings_search_source_order_redone', '已恢复排序')
          : getMessage('settings_search_source_order_undone', '已撤销排序'));
      }
      return true;
    }

    // Text fields keep their own undo.
    function isTextEditingTarget(target) {
      if (!target || target.nodeType !== 1) {
        return false;
      }
      if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return true;
      }
      return target.tagName === 'INPUT' &&
        !['checkbox', 'radio', 'button', 'range'].includes(String(target.type || '').toLowerCase());
    }

    function handleHistoryKeydown(event) {
      const direction = ORDER.getHistoryShortcut(event);
      if (!direction || event.defaultPrevented || isTextEditingTarget(event.target)) {
        return;
      }
      if (!(direction === 'redo' ? history.canRedo() : history.canUndo())) {
        return;
      }
      event.preventDefault();
      stepHistory(direction);
    }

    const historyDocument = options.document || root.document;
    if (historyDocument) {
      historyDocument.addEventListener('keydown', handleHistoryKeydown);
      detachers.push(() => historyDocument.removeEventListener('keydown', handleHistoryKeydown));
    }

    function sortList(items, listId, getKey) {
      return ORDER.sortList(items, order, listId, getKey);
    }

    // `renderedKeys` is the list as shown; keys the record holds but the page
    // does not show (a disabled built-in) keep their relative slot.
    function moveListItem(listId, renderedKeys, fromIndex, toIndex) {
      const moved = ORDER.moveIndex(renderedKeys, fromIndex, toIndex);
      return persist(ORDER.applyMove(order, listId, renderedKeys, moved));
    }

    function sortLocalSourceTypes(sourceTypes) {
      return ORDER.sortLocalSourceTypes(sourceTypes, order);
    }

    function moveLocal(renderedTypes, fromIndex, toIndex) {
      const moved = ORDER.moveIndex(renderedTypes, fromIndex, toIndex);
      return persist(ORDER.applyMove(order, 'local', renderedTypes, moved));
    }

    function moveGroup(fromIndex, toIndex) {
      return persist(ORDER.withGroups(order, ORDER.moveIndex(order.groups, fromIndex, toIndex)));
    }

    function getGroupLabel(group) {
      if (group === 'aggregate') {
        return getMessage('search_scope_group_aggregates', '聚合搜索');
      }
      if (group === 'engine') {
        return getMessage('search_scope_group_engines', '搜索引擎');
      }
      if (group === 'site') {
        return getMessage('search_scope_group_sites', '站内搜索');
      }
      if (group === 'ai') {
        return getMessage('search_scope_group_ai', 'AI 搜索');
      }
      return getMessage('search_scope_group_local', '浏览器内容');
    }

    function renderGroupChips() {
      if (!groupHost) {
        return;
      }
      const doc = groupHost.ownerDocument;
      const focusedGroup = doc.activeElement && groupHost.contains(doc.activeElement)
        ? doc.activeElement.getAttribute('data-group')
        : '';
      groupHost.textContent = '';
      order.groups.forEach((group, index) => {
        const chip = doc.createElement('div');
        chip.className = '_x_extension_order_chip_2026_unique_';
        chip.setAttribute('role', 'listitem');
        chip.setAttribute('tabindex', '0');
        chip.setAttribute('data-sortable', 'true');
        chip.setAttribute('data-group', group);
        const label = getGroupLabel(group);
        chip.setAttribute('aria-label', label);
        chip.setAttribute(
          'aria-description',
          getMessage('settings_search_source_order_keyboard_hint', '按 Alt + 左右方向键调整位置')
        );
        const grip = doc.createElement('i');
        grip.className = 'ri-icon ri-size-14 ri-draggable';
        grip.setAttribute('aria-hidden', 'true');
        const text = doc.createElement('span');
        text.textContent = label;
        chip.append(grip, text);
        chip.addEventListener('keydown', (event) => {
          if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
            return;
          }
          event.preventDefault();
          const target = index + (event.key === 'ArrowLeft' ? -1 : 1);
          if (target >= 0 && target < order.groups.length) {
            moveGroup(index, target);
          }
        });
        groupHost.appendChild(chip);
      });
      if (focusedGroup) {
        const chip = groupHost.querySelector(`[data-group="${focusedGroup}"]`);
        if (chip) {
          chip.focus({ preventScroll: true });
        }
      }
    }

    // Drag for one container. Rows reorder only among their own siblings, and
    // a list with an open editor stays put so heights cannot shift mid-drag.
    function attachDrag(host, onReorder, attachOptions) {
      if (!host || !SORTABLE) {
        return;
      }
      const settings = attachOptions || {};
      const detach = SORTABLE.attach(host, {
        itemSelector: '[data-sortable="true"]',
        getPeers: (item) => Array.from(item.parentElement.children)
          .filter((child) => child.getAttribute('data-sortable') === 'true'),
        canStart: (item) => !item.parentElement.querySelector('[data-expanded="true"]') &&
          (typeof settings.canStart !== 'function' || settings.canStart(item)),
        onReorder: (item, fromIndex, toIndex, peers) => onReorder(fromIndex, toIndex, peers)
      });
      detachers.push(detach);
    }

    function attachListDrag(host, listId, getKey) {
      attachDrag(host, (fromIndex, toIndex, peers) => {
        moveListItem(listId, peers.map(getKey), fromIndex, toIndex);
      });
    }

    function attachLocalDrag(host) {
      attachDrag(host, (fromIndex, toIndex, peers) => {
        moveLocal(peers.map((peer) => peer.getAttribute('data-value')), fromIndex, toIndex);
      });
    }

    attachDrag(groupHost, (fromIndex, toIndex) => moveGroup(fromIndex, toIndex));

    return Object.freeze({
      accept,
      attachListDrag,
      attachLocalDrag,
      getOrder: () => order,
      load,
      moveListItem,
      moveLocal,
      redo: () => stepHistory('redo'),
      sortList,
      sortLocalSourceTypes,
      undo: () => stepHistory('undo'),
      destroy() {
        detachers.splice(0).forEach((detach) => detach());
      }
    });
  }

  root.LumnoOptionsSearchSourceOrder = Object.freeze({
    createSearchSourceOrderController
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
