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
      updateBookmarkSectionPosition,
      stableHashCode
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
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

    function renderCurrentBookmarkPage() {
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
      // With reduced motion asked for, the page switches without sliding.
      const crossSurfaceDrag = root.LumnoNewtabCrossSurfaceDrag;
      if (!pageState.bookmarkGrid || (crossSurfaceDrag && crossSurfaceDrag.prefersReducedMotion(window))) {
        pageState.bookmarkCurrentPage = targetPage;
        renderCurrentBookmarkPage();
        updateBookmarkSectionPosition();
        return;
      }
      const direction = targetPage > pageState.bookmarkCurrentPage ? 1 : -1;
      const offsetPx = 34;
      const durationMs = 220;
      const fadeDurationMs = 150;
      const colStaggerMs = 24;
      const rowStaggerMs = 10;
      const randomJitterRangeMs = 6;
      const handoffOverlapMs = 70;
      const cols = getBookmarkGridColumnCount();
      const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
      pageState.bookmarkPageAnimating = true;
      const getCards = () => Array.from(pageState.bookmarkGrid.children || []);
      const getDelayByIndex = (card, index, pageSeed) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const seedText = `${pageSeed || 0}|${index}|${card && card._xTitleText ? card._xTitleText : ''}`;
        const seed = Math.abs(stableHashCode(seedText));
        const jitter = (seed % (randomJitterRangeMs * 2 + 1)) - randomJitterRangeMs;
        return Math.max(0, (col * colStaggerMs) + (row * rowStaggerMs) + jitter);
      };

      const cleanupCards = (cards) => {
        cards.forEach((card) => {
          card.style.removeProperty('transition');
          card.style.removeProperty('transform');
          card.style.removeProperty('opacity');
          card.style.removeProperty('will-change');
        });
      };

      const cleanup = (cards) => {
        cleanupCards(cards);
        pageState.bookmarkPageAnimating = false;
      };

      const enterNextPage = () => {
        pageState.bookmarkCurrentPage = targetPage;
        renderCurrentBookmarkPage();
        updateBookmarkSectionPosition();
        const nextCards = getCards();
        if (nextCards.length === 0) {
          cleanup(nextCards);
          return;
        }
        nextCards.forEach((card, index) => {
          card.style.setProperty('will-change', 'transform, opacity');
          card.style.setProperty('transition', 'none');
          card.style.setProperty('opacity', '0');
          card.style.setProperty('transform', `translateX(${direction * offsetPx}px)`);
        });
        void pageState.bookmarkGrid.offsetHeight;
        let maxInDelay = 0;
        nextCards.forEach((card, index) => {
          const delay = getDelayByIndex(card, index, targetPage);
          if (delay > maxInDelay) {
            maxInDelay = delay;
          }
          card.style.setProperty(
            'transition',
            `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeDurationMs}ms ${easing} ${delay}ms`
          );
          card.style.setProperty('opacity', '1');
          card.style.setProperty('transform', 'translateX(0)');
        });
        const inTotalMs = durationMs + maxInDelay;
        window.setTimeout(() => cleanup(nextCards), inTotalMs + 20);
      };

      const currentCards = getCards();
      if (currentCards.length === 0) {
        enterNextPage();
        return;
      }
      let maxOutDelay = 0;
      currentCards.forEach((card, index) => {
        const delay = getDelayByIndex(card, index, pageState.bookmarkCurrentPage);
        if (delay > maxOutDelay) {
          maxOutDelay = delay;
        }
        card.style.setProperty('will-change', 'transform, opacity');
        card.style.setProperty(
          'transition',
          `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeDurationMs}ms ${easing} ${delay}ms`
        );
        card.style.setProperty('opacity', '0');
        card.style.setProperty('transform', `translateX(${direction * -offsetPx}px)`);
      });
      const outTotalMs = durationMs + maxOutDelay;
      const handoffDelayMs = Math.max(0, outTotalMs - handoffOverlapMs);
      window.setTimeout(() => {
        cleanupCards(currentCards);
        enterNextPage();
      }, handoffDelayMs);
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
