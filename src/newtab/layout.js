(function() {
  const SUGGESTIONS_HEIGHT_LAYOUT = globalThis.LumnoSuggestionsHeightLayout;

  function resolveElement(value) {
    if (typeof value === 'function') {
      return value();
    }
    return value || null;
  }

  function getOptionNumber(options, key, fallback) {
    const value = Number(options && options[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  function getFiniteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getGridContentWidthForColumns(columnCount, columnWidth, gap) {
    const columns = Math.max(1, Math.floor(getFiniteNumber(columnCount, 1)));
    const trackWidth = Math.max(1, getFiniteNumber(columnWidth, 1));
    const gapWidth = Math.max(0, getFiniteNumber(gap, 0));
    return Math.ceil((columns * trackWidth) + (Math.max(0, columns - 1) * gapWidth));
  }

  function getResponsiveContentWidth(options) {
    const config = options || {};
    const viewportWidth = Math.max(0, getFiniteNumber(config.viewportWidth, 0));
    const viewportRatio = Math.max(0, getFiniteNumber(config.viewportRatio, 0.96));
    const contentMaxWidth = Math.max(
      0,
      getFiniteNumber(config.contentMaxWidth, viewportWidth * viewportRatio)
    );
    return Math.max(0, Math.min(Math.floor(viewportWidth * viewportRatio), contentMaxWidth));
  }

  function getAdaptiveGridColumnCount(options) {
    const config = options || {};
    const viewportWidth = Math.max(0, getFiniteNumber(config.viewportWidth, 0));
    const mobileBreakpointPx = Math.max(0, getFiniteNumber(config.mobileBreakpointPx, 0));
    if (mobileBreakpointPx > 0 && viewportWidth <= mobileBreakpointPx) {
      return Math.max(1, Math.floor(getFiniteNumber(config.mobileColumns, 1)));
    }
    const compactBreakpointPx = Math.max(0, getFiniteNumber(config.compactBreakpointPx, 0));
    if (compactBreakpointPx > 0 && viewportWidth <= compactBreakpointPx) {
      return Math.max(1, Math.floor(getFiniteNumber(config.compactColumns, 1)));
    }
    const minColumns = Math.max(1, Math.floor(getFiniteNumber(config.minColumns, 1)));
    const maxColumns = Math.max(minColumns, Math.floor(getFiniteNumber(config.maxColumns, minColumns)));
    const targetColumnWidth = Math.max(1, getFiniteNumber(config.targetColumnWidth, 1));
    const gap = Math.max(0, getFiniteNumber(config.gap, 0));
    const containerWidth = getResponsiveContentWidth(config);
    const idealColumns = Math.floor((containerWidth + gap) / (targetColumnWidth + gap));
    return Math.max(minColumns, Math.min(maxColumns, idealColumns || minColumns));
  }

  function createLayoutController(options) {
    options = options || {};
    const documentObj = options && options.documentObj ? options.documentObj : document;
    const windowObj = options && options.windowObj ? options.windowObj : window;
    const constants = (options && options.constants) || {};
    const minTopPx = getOptionNumber(constants, 'minTopPx', 28);
    const minBottomPx = getOptionNumber(constants, 'minBottomPx', 20);
    const upshiftRatio = getOptionNumber(constants, 'upshiftRatio', 0.06);
    const upshiftMinPx = getOptionNumber(constants, 'upshiftMinPx', 24);
    const upshiftMaxPx = getOptionNumber(constants, 'upshiftMaxPx', 80);
    const contentSectionsExtraUpshiftPx = getOptionNumber(constants, 'contentSectionsExtraUpshiftPx', 20);
    const emptySectionsExtraUpshiftPx = getOptionNumber(constants, 'emptySectionsExtraUpshiftPx', 96);
    const narrowViewportMinWidthPx = getOptionNumber(constants, 'narrowViewportMinWidthPx', 0);
    const narrowViewportMaxWidthPx = getOptionNumber(constants, 'narrowViewportMaxWidthPx', 0);
    const narrowTopInsetPx = getOptionNumber(constants, 'narrowTopInsetPx', 0);
    const narrowTopInsetTransitionPx = Math.max(
      1,
      getOptionNumber(constants, 'narrowTopInsetTransitionPx', 64)
    );
    const shortViewportMaxHeightPx = getOptionNumber(constants, 'shortViewportMaxHeightPx', 0);
    const shortMinTopPx = getOptionNumber(constants, 'shortMinTopPx', minTopPx);
    const occupiedTopUpshiftMaxPx = getOptionNumber(constants, 'occupiedTopUpshiftMaxPx', 36);
    const bottomDockTopReservePx = getOptionNumber(constants, 'bottomDockTopReservePx', 240);
    const compactDockViewportMaxHeightPx = getOptionNumber(constants, 'compactDockViewportMaxHeightPx', 0);
    const compactDockSearchGapPx = getOptionNumber(constants, 'compactDockSearchGapPx', 32);
    const compactDockShortcutGapPx = getOptionNumber(constants, 'compactDockShortcutGapPx', 8);
    const compactDockMinTopReservePx = getOptionNumber(constants, 'compactDockMinTopReservePx', 168);
    // A tall shortcut area stops above the bottom dock, leaves the dock at
    // least this much room, and scrolls inside.
    const shortcutAreaDockGapPx = getOptionNumber(constants, 'shortcutAreaDockGapPx', 8);
    const shortcutAreaMinHeightPx = getOptionNumber(constants, 'shortcutAreaMinHeightPx', 120);
    const shortcutAreaMinDockHeightPx = getOptionNumber(constants, 'shortcutAreaMinDockHeightPx', 220);
    const mobileFlowBreakpointPx = getOptionNumber(constants, 'mobileFlowBreakpointPx', 0);
    const mobileMinTopPx = getOptionNumber(constants, 'mobileMinTopPx', 48);
    const mobileUpshiftRatio = getOptionNumber(constants, 'mobileUpshiftRatio', 0.04);
    const mobileMinTopGapPx = getOptionNumber(constants, 'mobileMinTopGapPx', 12);
    const suggestionsBottomInsetPx = getOptionNumber(constants, 'suggestionsBottomInsetPx', 14);
    const scrollbarControlGapPx = getOptionNumber(constants, 'scrollbarControlGapPx', 8);
    // Includes the track's 10px top margin.
    const scrollbarMinTrackPx = getOptionNumber(constants, 'scrollbarMinTrackPx', 72);
    const cornerControlSelector = '.x-nt-wallpaper-control, .x-nt-feedback-control';
    const suggestionsViewportFitMaxHeightProperty =
      '--x-nt-suggestions-viewport-fit-max-height';
    const visibleAttribute = 'data-visible';
    const suggestionsOpenAttribute = 'data-nt-suggestions-open';
    let dockDensityPromotionLock = null;
    let shortcutAreaRelayout = false;
    const getTopInsetPx = typeof options.getTopInsetPx === 'function'
      ? options.getTopInsetPx
      : function() {
        return 0;
      };

    function getRoot() {
      return resolveElement(options.root);
    }

    function getSearchLayer() {
      return resolveElement(options.searchLayer);
    }

    function getInputParts() {
      return resolveElement(options.inputParts);
    }

    function getTopContentContainer() {
      return resolveElement(options.topContentContainer);
    }

    function getBottomDock() {
      return resolveElement(options.bottomDock);
    }

    function getShortcutSection() {
      return resolveElement(options.shortcutSection);
    }

    function getInlineQuoteSection() {
      const element = resolveElement(options.quoteSection);
      const position = element && element.getAttribute('data-position');
      return element && !element.hidden && (position === 'search' || position === 'input') ? element : null;
    }

    function getTopQuoteSection() {
      const element = resolveElement(options.quoteSection);
      return element && !element.hidden && element.getAttribute('data-position') === 'top' ? element : null;
    }

    function getBookmarkSection() {
      return resolveElement(options.bookmarkSection);
    }

    function getRecentSection() {
      return resolveElement(options.recentSection);
    }

    function getSectionSafeCorridor() {
      return resolveElement(options.sectionSafeCorridor);
    }

    function getSuggestionsContainer() {
      return resolveElement(options.suggestionsContainer);
    }

    function getSuggestionsSurface() {
      return resolveElement(options.suggestionsSurface);
    }

    function getSuggestionsOutline() {
      return resolveElement(options.suggestionsOutline);
    }

    function isMobileFlowViewport() {
      const viewportWidth = Math.max(0, windowObj.innerWidth || 0);
      return mobileFlowBreakpointPx > 0 && viewportWidth <= mobileFlowBreakpointPx;
    }

    function setBooleanAttribute(element, name, value) {
      if (!element || typeof element.setAttribute !== 'function') {
        return;
      }
      element.setAttribute(name, value ? 'true' : 'false');
    }

    function setSuggestionsOpenState(open) {
      const body = documentObj && documentObj.body;
      setBooleanAttribute(body, suggestionsOpenAttribute, Boolean(open));
    }

    function setPixelStyle(element, property, value) {
      if (!element || !element.style) {
        return;
      }
      element.style.setProperty(property, `${Math.round(value)}px`);
    }

    function setFixedFrame(element, frame) {
      if (!element || !frame) {
        return;
      }
      setPixelStyle(element, 'left', frame.left);
      setPixelStyle(element, 'top', frame.top);
      setPixelStyle(element, 'width', frame.width);
      setPixelStyle(element, 'height', frame.height);
    }

    function updateSuggestionsSurfaceFrame() {
      const suggestionsContainer = getSuggestionsContainer();
      const inputParts = getInputParts();
      if (!suggestionsContainer || !inputParts || !inputParts.container) {
        return;
      }
      const searchLayer = getSearchLayer();
      const root = getRoot();
      const suggestionsSurface = getSuggestionsSurface();
      const suggestionsOutline = getSuggestionsOutline();
      if (!suggestionsSurface && !suggestionsOutline) {
        return;
      }
      const anchor = searchLayer || inputParts.container;
      const anchorRect = anchor.getBoundingClientRect();
      const rootRect = root ? root.getBoundingClientRect() : anchorRect;
      const suggestionsRect = suggestionsContainer.getBoundingClientRect();
      const surfaceBottom = Math.max(rootRect.bottom, suggestionsRect.bottom);
      const surfaceFrame = {
        left: rootRect.left,
        top: rootRect.top,
        width: Math.max(0, rootRect.width),
        height: Math.max(0, surfaceBottom - rootRect.top)
      };
      setFixedFrame(suggestionsSurface, surfaceFrame);
      setFixedFrame(suggestionsOutline, surfaceFrame);
    }

    function commitSuggestionsNaturalHeightAfterRender() {
      const suggestionsContainer = getSuggestionsContainer();
      if (!suggestionsContainer) {
        return false;
      }
      SUGGESTIONS_HEIGHT_LAYOUT.applyNaturalSuggestionsHeightLayout(
        suggestionsContainer
      );
      [getSuggestionsSurface(), getSuggestionsOutline()].forEach((element) => {
        if (!element || !element.style) {
          return;
        }
        element.style.removeProperty('transition');
        element.style.removeProperty('will-change');
      });
      updateSuggestionsFloatingLayout();
      return true;
    }

    function applyWidthMode(config) {
      const rawSearchMax = Number(config && config.searchMaxWidth);
      const searchMax = Number.isFinite(rawSearchMax) ? Math.max(1, rawSearchMax) : 720;
      const contentMax = Math.max(1040, Number((config && config.contentMaxWidth) || 1040));
      if (documentObj && documentObj.documentElement) {
        documentObj.documentElement.style.setProperty('--x-nt-search-max-width', `${searchMax}px`);
        documentObj.documentElement.style.setProperty('--x-nt-content-max-width', `${contentMax}px`);
      }
    }

    function getElementOuterHeight(element) {
      if (!element) {
        return 0;
      }
      const style = windowObj.getComputedStyle(element);
      if (!style || style.display === 'none') {
        return 0;
      }
      if (element.getAttribute && element.getAttribute('data-visible') === 'false') {
        return 0;
      }
      const rect = element.getBoundingClientRect();
      const marginTop = Number.parseFloat(style.marginTop) || 0;
      const marginBottom = Number.parseFloat(style.marginBottom) || 0;
      const targetHeight = element.getAttribute && element.getAttribute('data-visible') === 'true'
        ? Math.max(rect.height, Number(element.scrollHeight) || 0)
        : rect.height;
      return Math.max(0, targetHeight + marginTop + marginBottom);
    }

    function isSectionVisible(section) {
      if (!section) {
        return false;
      }
      const visibleAttr = typeof section.getAttribute === 'function'
        ? section.getAttribute(visibleAttribute)
        : '';
      if (visibleAttr === 'true') {
        return true;
      }
      if (visibleAttr === 'false') {
        return false;
      }
      return section.style.getPropertyValue('display') !== 'none';
    }

    function getDockDensityRank(density) {
      if (density === 'tiny') {
        return 2;
      }
      if (density === 'compact') {
        return 1;
      }
      return 0;
    }

    function getDockDensityLayoutContext(
      shortcutSection,
      shortcutVisible,
      bottomDockTopReserve
    ) {
      const viewportWidth = Math.max(0, windowObj.innerWidth || 0);
      const viewportHeight = Math.max(0, windowObj.innerHeight || 0);
      const topReserve = Math.round(Math.max(0, Number(bottomDockTopReserve) || 0));
      if (!shortcutVisible || !shortcutSection) {
        return `${viewportWidth}:${viewportHeight}:${topReserve}:hidden`;
      }
      const shortcutRect = shortcutSection.getBoundingClientRect();
      const sectionWidth = Math.round(Math.max(0, Number(shortcutRect && shortcutRect.width) || 0));
      let tileCount = -1;
      if (typeof shortcutSection.querySelectorAll === 'function') {
        tileCount = shortcutSection.querySelectorAll('.x-nt-shortcut-tile').length;
      }
      return `${viewportWidth}:${viewportHeight}:${topReserve}:${sectionWidth}:${tileCount}`;
    }

    function getDockDensityForAvailableHeight(availableHeight, mobileFlow) {
      if (mobileFlow) {
        return 'mobile';
      }
      if (availableHeight <= 260) {
        return 'tiny';
      }
      if (availableHeight <= 360) {
        return 'compact';
      }
      return 'default';
    }

    function getBottomDockTopReserve(viewportHeight) {
      let topReserve = bottomDockTopReservePx;
      if (compactDockViewportMaxHeightPx <= 0 ||
          viewportHeight > compactDockViewportMaxHeightPx) {
        return topReserve;
      }
      const root = getRoot();
      const rootRect = root ? root.getBoundingClientRect() : null;
      const rootBottom = rootRect ? Number(rootRect.bottom) || 0 : 0;
      let compactTopReserve = compactDockMinTopReservePx;
      if (rootBottom > 0) {
        compactTopReserve = Math.max(
          compactTopReserve,
          Math.ceil(rootBottom + compactDockSearchGapPx)
        );
      }
      const shortcutSection = getShortcutSection();
      const quoteSection = getInlineQuoteSection();
      if (quoteSection) {
        compactTopReserve = Math.max(compactTopReserve,
          Math.ceil(quoteSection.getBoundingClientRect().bottom + compactDockShortcutGapPx));
      }
      if (isSectionVisible(shortcutSection)) {
        const shortcutRect = shortcutSection.getBoundingClientRect();
        const shortcutBottom = shortcutRect ? Number(shortcutRect.bottom) || 0 : 0;
        if (shortcutBottom > 0) {
          compactTopReserve = Math.max(
            compactTopReserve,
            Math.ceil(shortcutBottom + compactDockShortcutGapPx)
          );
        }
      }
      topReserve = compactTopReserve;
      return topReserve;
    }

    function restoreAttribute(element, name, value) {
      if (!element || typeof element.setAttribute !== 'function') {
        return;
      }
      if (value === null || typeof value === 'undefined') {
        if (typeof element.removeAttribute === 'function') {
          element.removeAttribute(name);
        }
        return;
      }
      element.setAttribute(name, value);
    }

    function isDockDensityPromotionStable(
      body,
      bottomDock,
      candidateDensity,
      viewportHeight
    ) {
      if (!body || !bottomDock || !candidateDensity) {
        return true;
      }
      const bodyDensityAttribute = 'data-nt-bottom-dock-density';
      const dockDensityAttribute = 'data-density';
      const previousBodyDensity = body.getAttribute(bodyDensityAttribute);
      const previousDockDensity = bottomDock.getAttribute(dockDensityAttribute);
      body.setAttribute(bodyDensityAttribute, candidateDensity);
      bottomDock.setAttribute(dockDensityAttribute, candidateDensity);
      const candidateTopReserve = getBottomDockTopReserve(viewportHeight);
      const candidateAvailableHeight = Math.max(0, viewportHeight - candidateTopReserve);
      const resolvedDensity = getDockDensityForAvailableHeight(
        candidateAvailableHeight,
        false
      );
      restoreAttribute(body, bodyDensityAttribute, previousBodyDensity);
      restoreAttribute(bottomDock, dockDensityAttribute, previousDockDensity);
      return resolvedDensity === candidateDensity;
    }

    function getCssPixelValue(style, property) {
      if (!style || !property) {
        return 0;
      }
      const value = Number.parseFloat(style.getPropertyValue(property));
      return Number.isFinite(value) ? value : 0;
    }

    function getVerticalFrameHeight(element, options) {
      if (!element) {
        return 0;
      }
      const style = windowObj.getComputedStyle(element);
      if (!style || style.display === 'none') {
        return 0;
      }
      const includeMargin = Boolean(options && options.includeMargin);
      const boxFrame =
        getCssPixelValue(style, 'padding-top') +
        getCssPixelValue(style, 'padding-bottom') +
        getCssPixelValue(style, 'border-top-width') +
        getCssPixelValue(style, 'border-bottom-width');
      if (!includeMargin) {
        return boxFrame;
      }
      return boxFrame +
        getCssPixelValue(style, 'margin-top') +
        getCssPixelValue(style, 'margin-bottom');
    }

    function getElementMinHeight(element) {
      if (!element) {
        return 0;
      }
      const style = windowObj.getComputedStyle(element);
      if (!style || style.display === 'none') {
        return 0;
      }
      return getCssPixelValue(style, 'min-height');
    }

    function getSearchEntryBlockHeight() {
      const root = getRoot();
      const inputParts = getInputParts();
      const searchLayer = getSearchLayer();
      const rootFrameHeight = getVerticalFrameHeight(root);
      const rootMinHeight = getElementMinHeight(root);
      const inputHeight = inputParts && inputParts.container
        ? Math.max(0, Number(inputParts.container.getBoundingClientRect().height) || 0)
        : 44;
      const searchLayerFrameHeight = getVerticalFrameHeight(searchLayer, { includeMargin: true });
      const searchLayerMinHeight = getElementMinHeight(searchLayer);
      const searchLayerBaseHeight = Math.max(
        searchLayerMinHeight,
        inputHeight + searchLayerFrameHeight
      );
      return Math.max(55, rootMinHeight, rootFrameHeight + searchLayerBaseHeight);
    }

    function getCurrentBodyPaddingTop(body) {
      if (!body || !body.style) {
        return null;
      }
      const rawValue = body.style.getPropertyValue('padding-top');
      const value = Number.parseFloat(rawValue);
      return Number.isFinite(value) ? Math.round(value) : null;
    }

    function isSearchEntryEngaged(body) {
      if (body.getAttribute && body.getAttribute(suggestionsOpenAttribute) === 'true') {
        return true;
      }
      const root = getRoot();
      const activeElement = documentObj && documentObj.activeElement;
      return Boolean(
        root && activeElement && activeElement !== body &&
        typeof root.contains === 'function' && root.contains(activeElement)
      );
    }

    // Mobile keeps the desktop composition in document flow: the dock rests at the
    // bottom (CSS margin-top: auto) and the logo, search and shortcuts are centered
    // in the space above it. Content taller than the screen falls back to the minimum
    // top inset and scrolls.
    function updateMobileSearchEntryLayout(body, layoutOptions) {
      const viewportHeight = Math.max(0, windowObj.innerHeight || 0);
      if (viewportHeight <= 0) {
        return;
      }
      const hasCurrentTop = getCurrentBodyPaddingTop(body) !== null;
      // The soft keyboard resizes the viewport while typing; keep the entry still.
      if (hasCurrentTop && (
        (layoutOptions && layoutOptions.preserveCurrentTop) || isSearchEntryEngaged(body)
      )) {
        return;
      }
      const bottomDock = getBottomDock();
      const dockHeight = bottomDock && bottomDock.style.getPropertyValue('display') !== 'none'
        ? Math.max(0, Number(bottomDock.getBoundingClientRect().height) || 0)
        : 0;
      const shortcutSection = getShortcutSection();
      const groupHeight = getElementOuterHeight(getTopContentContainer()) +
        getElementOuterHeight(getTopQuoteSection()) +
        getSearchEntryBlockHeight() +
        (isSectionVisible(shortcutSection) ? getElementOuterHeight(shortcutSection) : 0) +
        getElementOuterHeight(getInlineQuoteSection());
      // Center below the bookmark top bar, not under it.
      const occupiedTopHeight = Math.max(0, Number(getTopInsetPx()) || 0);
      const availableHeight = Math.max(0, viewportHeight - occupiedTopHeight - dockHeight);
      const upwardOffset = Math.min(
        upshiftMaxPx,
        Math.max(0, availableHeight * mobileUpshiftRatio)
      );
      const minTop = Math.max(mobileMinTopPx, occupiedTopHeight + mobileMinTopGapPx);
      let targetTop = occupiedTopHeight + ((availableHeight - groupHeight) / 2) - upwardOffset;
      if (!Number.isFinite(targetTop)) {
        targetTop = minTop;
      }
      const nextTop = `${Math.round(Math.max(minTop, targetTop))}px`;
      if (body.style.getPropertyValue('padding-top') !== nextTop) {
        body.style.setProperty('padding-top', nextTop, 'important');
      }
    }

    // Marks the edges with rows beyond them, which the section fades out.
    function updateShortcutAreaEdges(section) {
      const scrollable = section.getAttribute('data-shortcuts-scrollable') === 'true';
      const top = Number(section.scrollTop) || 0;
      const rest = (Number(section.scrollHeight) || 0) - (Number(section.clientHeight) || 0) - top;
      setBooleanAttribute(section, 'data-shortcuts-more-above', scrollable && top > 1);
      setBooleanAttribute(section, 'data-shortcuts-more-below', scrollable && rest > 1);
    }

    // The section scrolls only when its grid is taller than the room above
    // the dock. Mobile flow scrolls the page instead. Returns whether the
    // limit changed, since the dock's own reserve can depend on it.
    function updateShortcutAreaLimit() {
      const section = getShortcutSection();
      if (!section || !section.style || typeof section.getBoundingClientRect !== 'function') {
        return false;
      }
      const grid = typeof section.querySelector === 'function'
        ? section.querySelector('.x-nt-shortcuts-grid')
        : null;
      const bottomDock = getBottomDock();
      const viewportHeight = Math.max(0, windowObj.innerHeight || 0);
      let limit = 0;
      if (grid && isSectionVisible(section) && !isMobileFlowViewport() && bottomDock &&
          bottomDock.style.getPropertyValue('display') !== 'none' && viewportHeight > 0) {
        const sectionTop = Number(section.getBoundingClientRect().top) || 0;
        // The dock's scroller reaches above the dock itself, and drops count
        // from where it starts.
        const dockSurface = bottomDock.firstElementChild || null;
        const dockTop = Math.min(
          Number(bottomDock.getBoundingClientRect().top) || viewportHeight,
          dockSurface ? Number(dockSurface.getBoundingClientRect().top) || viewportHeight : viewportHeight
        );
        // The dock keeps what its content needs, up to the usual floor: on
        // short screens recent cards alone need less, and that room is
        // where a last row of shortcuts or the add tile fits.
        const dockOverflow = dockSurface
          ? Math.max(0, (Number(dockSurface.scrollHeight) || 0) - (Number(dockSurface.clientHeight) || 0))
          : 0;
        const dockNeed = dockSurface && Number(dockSurface.scrollHeight) > 0
          ? Math.min(shortcutAreaMinDockHeightPx, viewportHeight - dockTop + dockOverflow)
          : shortcutAreaMinDockHeightPx;
        const room = Math.min(
          dockTop - shortcutAreaDockGapPx,
          viewportHeight - dockNeed
        ) - sectionTop;
        const gridHeight = Math.max(0, Number(grid.offsetHeight) || 0);
        if (gridHeight > Math.max(shortcutAreaMinHeightPx, room)) {
          limit = Math.floor(Math.max(shortcutAreaMinHeightPx, room));
        }
      }
      if (!section._xShortcutAreaEdgesBound && typeof section.addEventListener === 'function') {
        section._xShortcutAreaEdgesBound = true;
        section.addEventListener('scroll', () => updateShortcutAreaEdges(section), { passive: true });
      }
      const previous = section.style.getPropertyValue('--x-nt-shortcuts-max-height');
      const next = limit > 0 ? `${limit}px` : '';
      if (previous === next) {
        updateShortcutAreaEdges(section);
        return false;
      }
      if (next) {
        section.style.setProperty('--x-nt-shortcuts-max-height', next);
        section.setAttribute('data-shortcuts-scrollable', 'true');
        // Keep the columns' width when a classic scrollbar takes some of it.
        const gutter = Math.max(0, (Number(section.offsetWidth) || 0) - (Number(section.clientWidth) || 0));
        section.style.setProperty('--x-nt-shortcuts-scrollbar-gutter', `${gutter}px`);
      } else {
        section.style.removeProperty('--x-nt-shortcuts-max-height');
        section.style.removeProperty('--x-nt-shortcuts-scrollbar-gutter');
        section.removeAttribute('data-shortcuts-scrollable');
      }
      updateShortcutAreaEdges(section);
      return true;
    }

    function updateSearchEntryLayout(layoutOptions) {
      positionSearchEntry(layoutOptions);
      updateShortcutAreaLimit();
    }

    function positionSearchEntry(layoutOptions) {
      const body = documentObj && documentObj.body;
      const root = getRoot();
      if (!body || !root) {
        return;
      }
      if (isMobileFlowViewport()) {
        updateMobileSearchEntryLayout(body, layoutOptions);
        return;
      }
      const viewportHeight = Math.max(0, windowObj.innerHeight || 0);
      if (viewportHeight <= 0) {
        return;
      }
      const bottomDock = getBottomDock();
      const bottomDockVisible = Boolean(
        bottomDock &&
        bottomDock.style.getPropertyValue('display') !== 'none'
      );
      let occupiedBottomHeight = 0;
      if (bottomDockVisible && bottomDock) {
        const dockRect = bottomDock.getBoundingClientRect();
        occupiedBottomHeight = Math.max(0, Number(dockRect && dockRect.height) || 0);
      }
      const occupiedTopHeight = Math.max(0, Number(getTopInsetPx()) || 0);
      const centeringHeight = Math.max(
        0,
        viewportHeight - occupiedBottomHeight
      );
      const topContentOuterHeight = getElementOuterHeight(getTopContentContainer());
      // Inline quotes below the search entry must not shift it upward; one above it is part of the block.
      const searchBlockHeight = topContentOuterHeight +
        getElementOuterHeight(getTopQuoteSection()) + getSearchEntryBlockHeight();
      const bookmarkSection = getBookmarkSection();
      const recentSection = getRecentSection();
      const bookmarkVisible = isSectionVisible(bookmarkSection);
      const recentVisible = isSectionVisible(recentSection);
      const viewportWidth = Math.max(0, windowObj.innerWidth || 0);
      const minimumTopGap = shortViewportMaxHeightPx > 0 && viewportHeight <= shortViewportMaxHeightPx
        ? Math.max(minTopPx, shortMinTopPx)
        : minTopPx;
      const extraUpshift = (!bookmarkVisible && !recentVisible)
        ? emptySectionsExtraUpshiftPx
        : contentSectionsExtraUpshiftPx;
      const upwardOffset = Math.min(
        upshiftMaxPx,
        Math.max(upshiftMinPx, centeringHeight * upshiftRatio)
      ) + extraUpshift;
      const occupiedTopUpshift = Math.min(
        occupiedTopHeight,
        Math.max(0, occupiedTopUpshiftMaxPx)
      );
      const effectiveMinTopPx = occupiedTopHeight + minimumTopGap;
      const maxTop = Math.max(
        effectiveMinTopPx,
        centeringHeight - searchBlockHeight - minBottomPx
      );
      let targetTop =
        ((centeringHeight - searchBlockHeight) / 2) -
        upwardOffset -
        occupiedTopUpshift;
      if (!Number.isFinite(targetTop)) {
        targetTop = effectiveMinTopPx;
      }
      if (narrowTopInsetPx > 0 && narrowViewportMaxWidthPx > 0) {
        if (viewportWidth > narrowViewportMinWidthPx && viewportWidth <= narrowViewportMaxWidthPx) {
          const narrowViewportRange = Math.max(
            1,
            narrowViewportMaxWidthPx - narrowViewportMinWidthPx
          );
          const transitionWidth = Math.min(
            narrowTopInsetTransitionPx,
            narrowViewportRange
          );
          const narrowProgress = Math.min(
            1,
            Math.max(0, (narrowViewportMaxWidthPx - viewportWidth) / transitionWidth)
          );
          targetTop += narrowTopInsetPx * narrowProgress;
        }
      }
      targetTop = Math.max(effectiveMinTopPx, Math.min(maxTop, targetTop));
      const nextTop = Math.round(targetTop);
      if (layoutOptions && layoutOptions.preserveCurrentTop && getCurrentBodyPaddingTop(body) !== null) {
        return;
      }
      if (body.style.getPropertyValue('padding-top') === `${nextTop}px`) {
        return;
      }
      body.style.setProperty('padding-top', `${nextTop}px`, 'important');
    }

    function setStylePixels(element, property, value) {
      if (!element || !element.style || typeof element.style.setProperty !== 'function') {
        return;
      }
      const next = `${Math.max(0, Math.ceil(Number(value) || 0))}px`;
      if (element.style.getPropertyValue(property) !== next) {
        element.style.setProperty(property, next);
      }
    }

    // The dock reserves a stable scrollbar gutter beside the cards. Feed its
    // width back to CSS so the cards keep the dock's width, and end the track
    // above the corner controls when they sit over the scrollbar.
    function updateBottomDockScrollbarInsets(scroller, mobileFlow) {
      if (!scroller || typeof scroller.getBoundingClientRect !== 'function') {
        return;
      }
      const gutter = mobileFlow
        ? 0
        : Math.max(0, (Number(scroller.offsetWidth) || 0) - (Number(scroller.clientWidth) || 0));
      setStylePixels(scroller, '--x-nt-bottom-dock-scrollbar-gutter', gutter);
      let endInset = 0;
      if (gutter > 0 && typeof documentObj.querySelectorAll === 'function') {
        const rect = scroller.getBoundingClientRect();
        const barLeft = rect.right - gutter;
        documentObj.querySelectorAll(cornerControlSelector).forEach((control) => {
          const controlRect = control.getBoundingClientRect();
          if (!controlRect.width || !controlRect.height ||
              controlRect.left >= rect.right || controlRect.right <= barLeft ||
              controlRect.top >= rect.bottom || controlRect.bottom <= rect.top) {
            return;
          }
          endInset = Math.max(endInset, rect.bottom - controlRect.top + scrollbarControlGapPx);
        });
        // Keep a usable track on very short docks; the controls then cover its end.
        endInset = Math.min(endInset, Math.max(0, rect.height - scrollbarMinTrackPx));
      }
      setStylePixels(scroller, '--x-nt-bottom-dock-scrollbar-end-inset', endInset);
    }

    function updateBottomDockLayout(callbacks) {
      const body = documentObj && documentObj.body;
      const bookmarkSection = getBookmarkSection();
      const recentSection = getRecentSection();
      const bottomDock = getBottomDock();
      const sectionSafeCorridor = getSectionSafeCorridor();
      if (!body || !bookmarkSection || !recentSection || !bottomDock || !sectionSafeCorridor) {
        return;
      }
      const viewportHeight = Math.max(0, windowObj.innerHeight || 0);
      const mobileFlow = isMobileFlowViewport();
      const bottomDockTopReserve = getBottomDockTopReserve(viewportHeight);
      const bottomDockMaxHeight = Math.max(0, viewportHeight - bottomDockTopReserve);
      const bookmarkVisible = isSectionVisible(bookmarkSection);
      const recentVisible = isSectionVisible(recentSection);
      if (!recentVisible && callbacks && typeof callbacks.onRecentHidden === 'function') {
        callbacks.onRecentHidden();
      }
      body.classList.remove('x-nt-stack-layout');
      body.classList.add('x-nt-bottom-layout');
      body.classList.toggle('x-nt-mobile-flow', mobileFlow);
      body.classList.toggle('x-nt-no-bookmarks', !bookmarkVisible);
      bottomDock.setAttribute('data-layout', mobileFlow ? 'flow' : 'fixed');
      const previousDockDensity = typeof bottomDock.getAttribute === 'function'
        ? bottomDock.getAttribute('data-density')
        : '';
      const shortcutSection = getShortcutSection();
      const shortcutVisible = isSectionVisible(shortcutSection);
      const densityLayoutContext = getDockDensityLayoutContext(
        shortcutSection,
        shortcutVisible,
        bottomDockTopReserve
      );
      const releaseDockDensityLock = Boolean(callbacks && callbacks.releaseDockDensityLock);
      if (dockDensityPromotionLock &&
          dockDensityPromotionLock.context !== densityLayoutContext) {
        dockDensityPromotionLock = null;
      }
      let dockDensity = getDockDensityForAvailableHeight(bottomDockMaxHeight, mobileFlow);
      const isDensityPromotion = !mobileFlow &&
        previousDockDensity &&
        getDockDensityRank(dockDensity) < getDockDensityRank(previousDockDensity);
      const releaseWouldOscillate = releaseDockDensityLock &&
        isDensityPromotion &&
        !isDockDensityPromotionStable(
          body,
          bottomDock,
          dockDensity,
          viewportHeight
        );
      const shouldKeepCompactedDensity = isDensityPromotion && (
        Boolean(callbacks && callbacks.stabilizeDockDensity) ||
        releaseWouldOscillate ||
        Boolean(
          !releaseDockDensityLock &&
          dockDensityPromotionLock &&
          dockDensityPromotionLock.context === densityLayoutContext &&
          dockDensityPromotionLock.density === previousDockDensity
        )
      );
      if (shouldKeepCompactedDensity) {
        dockDensity = previousDockDensity;
        dockDensityPromotionLock = {
          context: densityLayoutContext,
          density: previousDockDensity
        };
      } else if (releaseDockDensityLock || dockDensity !== previousDockDensity) {
        dockDensityPromotionLock = null;
      }
      body.setAttribute('data-nt-bottom-dock-density', dockDensity);
      bottomDock.setAttribute('data-density', dockDensity);
      sectionSafeCorridor.style.setProperty('display', (bookmarkVisible && recentVisible) ? 'block' : 'none', 'important');
      if (mobileFlow) {
        bottomDock.style.removeProperty('max-height');
      } else {
        bottomDock.style.setProperty('max-height', `${bottomDockMaxHeight}px`, 'important');
      }
      bottomDock.style.setProperty('display', (bookmarkVisible || recentVisible) ? 'flex' : 'none', 'important');
      updateBottomDockScrollbarInsets(sectionSafeCorridor.parentElement, mobileFlow);
      positionSearchEntry({
        preserveCurrentTop: Boolean(callbacks && callbacks.preserveSearchEntryLayout)
      });
      // On short screens the dock sits below the shortcuts, so a new limit
      // moves the dock too; lay it out once more against the limited area.
      if (updateShortcutAreaLimit() && !shortcutAreaRelayout) {
        shortcutAreaRelayout = true;
        try {
          updateBottomDockLayout({ ...(callbacks || {}), preserveSearchEntryLayout: true });
        } finally {
          shortcutAreaRelayout = false;
        }
        return;
      }
      updateSuggestionsFloatingLayout();
      if (previousDockDensity !== dockDensity && typeof windowObj.requestAnimationFrame === 'function') {
        windowObj.requestAnimationFrame(() => {
          updateBottomDockLayout({
            preserveSearchEntryLayout: true,
            stabilizeDockDensity: true
          });
        });
      }
    }

    function setSuggestionsVisible(visible) {
      const shouldShow = Boolean(visible);
      const suggestionsContainer = getSuggestionsContainer();
      const suggestionsSurface = getSuggestionsSurface();
      const suggestionsOutline = getSuggestionsOutline();
      if (!suggestionsContainer) {
        return;
      }
      setSuggestionsOpenState(shouldShow);
      setBooleanAttribute(suggestionsContainer, visibleAttribute, shouldShow);
      setBooleanAttribute(suggestionsSurface, visibleAttribute, shouldShow);
      setBooleanAttribute(suggestionsOutline, visibleAttribute, shouldShow);
      commitSuggestionsNaturalHeightAfterRender();
      if (shouldShow) {
        if (typeof windowObj.requestAnimationFrame === 'function') {
          windowObj.requestAnimationFrame(updateSuggestionsFloatingLayout);
        } else {
          windowObj.setTimeout(updateSuggestionsFloatingLayout, 0);
        }
      }
    }

    function updateSuggestionsFloatingLayout() {
      const suggestionsContainer = getSuggestionsContainer();
      const inputParts = getInputParts();
      if (!suggestionsContainer || !inputParts || !inputParts.container) {
        return;
      }
      const searchLayer = getSearchLayer();
      const anchor = searchLayer || inputParts.container;
      const anchorRect = anchor.getBoundingClientRect();
      const visualViewport = windowObj.visualViewport;
      const viewportBottom = visualViewport && Number.isFinite(visualViewport.height)
        ? visualViewport.offsetTop + visualViewport.height
        : Math.max(0, windowObj.innerHeight || 0);
      const dropdownTopViewport = anchorRect.bottom - 1;
      const left = Math.round(anchorRect.left);
      const top = Math.round(dropdownTopViewport);
      const width = Math.max(0, Math.round(anchorRect.width));
      const availableWithoutInset = Math.max(0, viewportBottom - dropdownTopViewport);
      const available = Math.max(0, availableWithoutInset - suggestionsBottomInsetPx);
      const maxHeight = Math.floor(available);
      setPixelStyle(suggestionsContainer, 'left', left);
      setPixelStyle(suggestionsContainer, 'top', top);
      setPixelStyle(suggestionsContainer, 'width', width);
      suggestionsContainer.style.removeProperty('max-height');
      setPixelStyle(
        suggestionsContainer,
        suggestionsViewportFitMaxHeightProperty,
        maxHeight
      );
      updateSuggestionsSurfaceFrame();
    }

    return {
      applyWidthMode,
      updateBottomDockLayout,
      updateSearchEntryLayout,
      setSuggestionsVisible,
      updateSuggestionsFloatingLayout,
      commitSuggestionsNaturalHeightAfterRender
    };
  }

  globalThis.LumnoNewtabLayout = {
    createLayoutController,
    getAdaptiveGridColumnCount,
    getGridContentWidthForColumns,
    getResponsiveContentWidth
  };
})();
