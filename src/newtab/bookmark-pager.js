(function(root) {
  // Bookmark grid paging: page slicing, pager buttons, grid height lock and
  // animated page switches.
  function createBookmarkPager(deps) {
    const {
      isBookmarkTopbarMode,
      getBookmarkLimit,
      NEWTAB_BOOKMARKS_STORE,
      hideTopActionTooltip,
      getBookmarkGridColumnCount,
      renderBookmarks,
      updateBookmarkSectionPosition
    } = deps;

    // The page state object shared with newtab.js and the other modules.
    const pageState = deps.pageState;

    function getBookmarkPageCount() {
      if (isBookmarkTopbarMode()) {
        return 1;
      }
      const total = Array.isArray(pageState.bookmarkAllItems) ? pageState.bookmarkAllItems.length : 0;
      return Math.max(1, Math.ceil(total / getBookmarkLimit()));
    }

    function getBookmarkPageItems() {
      if (!Array.isArray(pageState.bookmarkAllItems) || pageState.bookmarkAllItems.length === 0) {
        return [];
      }
      if (isBookmarkTopbarMode()) {
        pageState.bookmarkCurrentPage = 0;
        return pageState.bookmarkAllItems.slice();
      }
      const pageCount = getBookmarkPageCount();
      pageState.bookmarkCurrentPage = Math.min(Math.max(0, pageState.bookmarkCurrentPage), pageCount - 1);
      return NEWTAB_BOOKMARKS_STORE.getBookmarkPageItems(
        pageState.bookmarkAllItems,
        pageState.bookmarkCurrentPage,
        getBookmarkLimit()
      );
    }

    function setBookmarkPagerButtonAvailability(button, available) {
      if (!button) {
        return;
      }
      const enabled = Boolean(available);
      button.removeAttribute('disabled');
      button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      button.tabIndex = enabled ? 0 : -1;
      if (!enabled && document.activeElement === button) {
        button.blur();
        hideTopActionTooltip();
      }
    }

    function updateBookmarkPagerState() {
      if (!pageState.bookmarkPagerPrevButton || !pageState.bookmarkPagerNextButton) {
        return;
      }
      const pageCount = getBookmarkPageCount();
      const atStart = pageState.bookmarkCurrentPage <= 0;
      const atEnd = pageState.bookmarkCurrentPage >= (pageCount - 1);
      setBookmarkPagerButtonAvailability(pageState.bookmarkPagerPrevButton, !atStart);
      setBookmarkPagerButtonAvailability(pageState.bookmarkPagerNextButton, !atEnd);
    }

    function updateBookmarkGridHeightLock() {
      if (!pageState.bookmarkGrid) {
        return;
      }
      if (pageState.bookmarkGrid.getAttribute('data-bookmark-empty-drop-surface') === 'true') {
        pageState.bookmarkGrid.style.setProperty(
          'min-height',
          `${isBookmarkTopbarMode() ? 44 : 64}px`
        );
        return;
      }
      if (isBookmarkTopbarMode()) {
        pageState.bookmarkGrid.style.removeProperty('min-height');
        return;
      }
      const total = Array.isArray(pageState.bookmarkAllItems) ? pageState.bookmarkAllItems.length : 0;
      const cols = getBookmarkGridColumnCount();
      const firstCard = pageState.bookmarkGrid.querySelector('.x-nt-bookmark-card');
      const cardHeight = firstCard ? firstCard.getBoundingClientRect().height : 51;
      const gridStyle = window.getComputedStyle(pageState.bookmarkGrid);
      const rowGap = Number.parseFloat(gridStyle.rowGap) || 16;
      const isAtRoot = String(pageState.bookmarkCurrentFolderId || '') === String(pageState.bookmarkRootFolderId || '1');
      const pageLimit = getBookmarkLimit();
      let targetItemCount = 0;

      if (isAtRoot) {
        if (total <= pageLimit) {
          pageState.bookmarkGrid.style.removeProperty('min-height');
          return;
        }
        targetItemCount = pageLimit;
      } else {
        if (pageState.bookmarkRootTotalCount > pageLimit) {
          targetItemCount = pageLimit;
        } else {
          targetItemCount = Math.max(0, pageState.bookmarkRootVisibleCount);
        }
        if (targetItemCount <= 0) {
          if (total <= pageLimit) {
            pageState.bookmarkGrid.style.removeProperty('min-height');
            return;
          }
          targetItemCount = pageLimit;
        }
      }

      const rowsPerPage = Math.max(1, Math.ceil(targetItemCount / cols));
      const minHeight = (rowsPerPage * cardHeight) + ((rowsPerPage - 1) * rowGap);
      pageState.bookmarkGrid.style.setProperty('min-height', `${Math.ceil(minHeight)}px`);
    }

    let finishPageAnimation = null;

    function renderCurrentBookmarkPage() {
      if (finishPageAnimation) finishPageAnimation();
      renderBookmarks(getBookmarkPageItems());
      updateBookmarkPagerState();
    }

    function switchBookmarkPageDuringDrag(nextPage) {
      const pageCount = getBookmarkPageCount();
      const targetPage = Math.min(Math.max(0, Number(nextPage) || 0), pageCount - 1);
      if (targetPage === pageState.bookmarkCurrentPage || pageState.bookmarkPageAnimating) {
        return false;
      }
      pageState.bookmarkCurrentPage = targetPage;
      renderCurrentBookmarkPage();
      updateBookmarkSectionPosition();
      return true;
    }

    function switchBookmarkPage(nextPage) {
      const pageCount = getBookmarkPageCount();
      const targetPage = Math.min(Math.max(0, Number(nextPage) || 0), pageCount - 1);
      if (targetPage === pageState.bookmarkCurrentPage) {
        return;
      }
      if (pageState.bookmarkPageAnimating) {
        return;
      }
      const grid = pageState.bookmarkGrid;
      const crossSurfaceDrag = root.LumnoNewtabCrossSurfaceDrag;
      const motionDisabled = document.documentElement.getAttribute('data-lumno-motion-effects') === 'off';
      if (!grid || typeof grid.animate !== 'function' || motionDisabled ||
          (crossSurfaceDrag && crossSurfaceDrag.prefersReducedMotion(window))) {
        pageState.bookmarkCurrentPage = targetPage;
        renderCurrentBookmarkPage();
        updateBookmarkSectionPosition();
        return;
      }
      const direction = targetPage > pageState.bookmarkCurrentPage ? 1 : -1;
      const gridStyle = window.getComputedStyle(grid);
      const distance = grid.getBoundingClientRect().width + (Number.parseFloat(gridStyle.columnGap) || 0);
      const outgoing = grid.cloneNode(true);
      outgoing.removeAttribute('id');
      outgoing.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
      outgoing.setAttribute('aria-hidden', 'true');
      outgoing.inert = true;
      Object.assign(outgoing.style, {
        position: 'absolute', inset: '0', width: '100%', display: 'grid',
        gridTemplateColumns: gridStyle.gridTemplateColumns,
        columnGap: gridStyle.columnGap, rowGap: gridStyle.rowGap,
        alignContent: 'start', pointerEvents: 'none'
      });
      pageState.bookmarkCurrentPage = targetPage;
      renderCurrentBookmarkPage();
      updateBookmarkSectionPosition();
      const incomingCards = Array.from(grid.children);
      const previousOverflow = grid.style.getPropertyValue('overflow');
      const previousPriority = grid.style.getPropertyPriority('overflow');
      grid.style.setProperty('overflow', 'hidden');
      grid.appendChild(outgoing);
      pageState.bookmarkPageAnimating = true;
      // Slide directly to the destination with a long, smooth deceleration.
      const timing = { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' };
      const slideFrames = (from, to) => [
        { transform: `translateX(${from}px)`, offset: 0 },
        { transform: `translateX(${to}px)`, offset: 1 }
      ];
      const animations = [outgoing.animate(slideFrames(0, -direction * distance), timing),
        ...incomingCards.map((card) => card.animate(slideFrames(direction * distance, 0), timing))];
      const startTime = animations[0].startTime;
      if (startTime !== null) animations.forEach((animation) => { animation.startTime = startTime; });
      let finished = false;
      const cleanup = () => {
        if (finished) return;
        finished = true;
        animations.forEach((animation) => animation.cancel());
        outgoing.remove();
        if (previousOverflow) grid.style.setProperty('overflow', previousOverflow, previousPriority);
        else grid.style.removeProperty('overflow');
        pageState.bookmarkPageAnimating = false;
        finishPageAnimation = null;
      };
      finishPageAnimation = cleanup;
      Promise.all(animations.map((animation) => animation.finished)).then(cleanup).catch(cleanup);
    }

    return {
      getBookmarkPageCount,
      updateBookmarkPagerState,
      updateBookmarkGridHeightLock,
      renderCurrentBookmarkPage,
      switchBookmarkPageDuringDrag,
      switchBookmarkPage
    };
  }

  root.LumnoNewtabBookmarkPager = { createBookmarkPager };
})(globalThis);
