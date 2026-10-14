(function() {
  const optionsRuntimeStartedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
  let optionsStartupStorageBatchPending = false;
  let optionsStartupRefreshCoalescing = true;
  let optionsStartupRefreshDeferred = false;
  let optionsCustomSelectRefreshCount = 0;
  let optionsReadyMarked = false;

  function markOptionsPerformance(name) {
    try {
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        performance.mark(name);
      }
    } catch (e) {
      // Performance markers are diagnostics only.
    }
  }

  markOptionsPerformance('lumno-options-runtime-start');
  if (document.documentElement) {
    document.documentElement.setAttribute('data-lumno-options-runtime-started', 'true');
  }

  const NAVIGATION_DISPOSITION = globalThis.LumnoNavigationDisposition;
  const COMMUNITY_LINKS = globalThis.LumnoCommunityLinks;
  const SETTINGS = globalThis.LumnoSettings;
  const AGGREGATE_SEARCH_STORE = globalThis.LumnoAggregateSearchStore;
  const SHORTCUT_FAVICON = globalThis.LumnoShortcutFavicon;
  const panel = document.getElementById('_x_extension_settings_panel_2024_unique_');
  const optionsRoot = document.getElementById('_x_extension_options_root_2024_unique_');
  const tabsRow = document.querySelector('._x_extension_settings_tabs_row_2024_unique_');
  const appearanceContent = document.querySelector('._x_extension_settings_content_2024_unique_[data-content="appearance"]');
  const themePicker = appearanceContent
    ? appearanceContent.querySelector('._x_extension_theme_picker_2024_unique_')
    : null;
  const themeButtons = themePicker ? Array.from(themePicker.querySelectorAll('._x_extension_theme_option_2024_unique_')) : [];
  const tabButtons = Array.from(document.querySelectorAll('._x_extension_settings_tab_button_2024_unique_'));
  const tabContents = Array.from(document.querySelectorAll('._x_extension_settings_content_2024_unique_'));
  const tabsContainer = document.getElementById('_x_extension_settings_tabs_2024_unique_');
  const settingsVersion = document.getElementById('_x_extension_settings_version_2024_unique_');
  const languageSelect = document.getElementById('_x_extension_language_select_2024_unique_');
  const recentModeSelect = document.getElementById('_x_extension_recent_mode_select_2024_unique_');
  const recentModeTabButtons = Array.from(document.querySelectorAll('button[data-recent-mode]'));
  const recentModeTabsWrap = document.getElementById('_x_extension_recent_mode_tabs_wrap_2024_unique_');
  const recentCountControlHost = document.getElementById('_x_extension_recent_count_control_2026_unique_');
  const newtabWidthSelect = document.getElementById('_x_extension_newtab_width_select_2026_unique_');
  const newtabWidthTabsWrap = document.getElementById('_x_extension_newtab_width_tabs_wrap_2026_unique_');
  const newtabWidthTabButtons = Array.from(document.querySelectorAll('button[data-newtab-width]'));
  const overlaySizeTabButtons = Array.from(document.querySelectorAll('button[data-overlay-size]'));
  const overlaySizeTabsWrap = document.getElementById('_x_extension_overlay_size_tabs_wrap_2026_unique_');
  const overlayEnterAnimationTabButtons = Array.from(document.querySelectorAll('button[data-overlay-enter-animation]'));
  const overlayEnterAnimationTabsWrap = document.getElementById('_x_extension_overlay_enter_animation_tabs_wrap_2026_unique_');
  const bookmarkRowsControlHost = document.getElementById('_x_extension_bookmark_rows_control_2026_unique_');
  const bookmarkColumnsSettingRow = document.getElementById('_x_extension_bookmark_columns_setting_row_2026_unique_');
  const bookmarkColumnsControlHost = document.getElementById('_x_extension_bookmark_columns_control_2026_unique_');
  const searchResultDisplayLimitControlHost = document.getElementById('_x_extension_search_result_display_limit_control_2026_unique_');
  const bookmarkFolderIconsVisibleRow = document.getElementById('_x_extension_bookmark_folder_icons_visible_row_2026_unique_');
  const aggregateSearchAutoGroupToggle = document.getElementById(
    '_x_extension_aggregate_search_auto_group_toggle_2026_unique_'
  );
  const selectionQuickActionsToggle = document.getElementById('_x_extension_selection_quick_actions_toggle_2026_unique_');
  const selectionQuickActionsProviderRow = document.getElementById('_x_extension_selection_quick_actions_provider_row_2026_unique_');
  const selectionQuickActionsProviderSelect = document.getElementById('_x_extension_selection_quick_actions_provider_select_2026_unique_');
  const selectionQuickActionsGroupRow = document.getElementById('_x_extension_selection_quick_actions_group_row_2026_unique_');
  const selectionQuickActionsGroupToggle = document.getElementById('_x_extension_selection_quick_actions_group_toggle_2026_unique_');
  const newtabTopContentTabsWrap = document.getElementById('_x_extension_newtab_top_content_tabs_wrap_2026_unique_');
  const newtabTimeFontWeightRow = document.getElementById('_x_extension_newtab_time_font_weight_row_2026_unique_');
  const newtabTimeFontWeightControlHost = document.getElementById('_x_extension_newtab_time_font_weight_control_2026_unique_');
  const newtabTimeSecondsRow = document.getElementById('_x_extension_newtab_time_seconds_row_2026_unique_');
  const newtabShortcutsToggle = document.getElementById('_x_extension_newtab_shortcuts_toggle_2026_unique_');
  const newtabShortcutAddRow = document.getElementById('_x_extension_newtab_shortcut_add_row_2026_unique_');
  const newtabShortcutAddToggle = document.getElementById('_x_extension_newtab_shortcut_add_toggle_2026_unique_');
  const newtabShortcutDockMagnificationRow = document.getElementById('_x_extension_newtab_shortcut_dock_magnification_row_2026_unique_');
  const newtabShortcutDockMagnificationToggle = document.getElementById('_x_extension_newtab_shortcut_dock_magnification_toggle_2026_unique_');
  const newtabShortcutColumnsRow = document.getElementById('_x_extension_newtab_shortcut_columns_setting_row_2026_unique_');
  const newtabShortcutColumnsControlHost = document.getElementById('_x_extension_newtab_shortcut_columns_control_2026_unique_');
  const newtabShortcutSizeRow = document.getElementById('_x_extension_newtab_shortcut_size_setting_row_2026_unique_');
  const newtabShortcutSizeControlHost = document.getElementById('_x_extension_newtab_shortcut_size_control_2026_unique_');
  const newtabShortcutGapRow = document.getElementById('_x_extension_newtab_shortcut_gap_setting_row_2026_unique_');
  const newtabShortcutGapControlHost = document.getElementById('_x_extension_newtab_shortcut_gap_control_2026_unique_');
  const restrictedActionSelect = document.getElementById('_x_extension_restricted_action_select_2024_unique_');
  const searchResultPrioritySelect = document.getElementById('_x_extension_search_result_priority_select_2026_unique_');
  const searchResultTabPositionSelect = document.getElementById('_x_extension_search_result_tab_position_select_2026_unique_');
  const searchResultSourceTypeGroupHost = document.getElementById('_x_extension_search_result_source_types_2026_unique_');
  const searchResultSourceTypeInputs = Array.from(document.querySelectorAll('input[data-search-result-source-type]'));
  const overlayPageThemeAdaptationRow = document.getElementById('_x_extension_overlay_page_theme_adaptation_row_2026_unique_');
  const overlayPageThemeAdaptationInfoHost = document.getElementById('_x_extension_overlay_page_theme_adaptation_info_2026_unique_');
  const restrictedActionInfoHost = document.getElementById('_x_extension_restricted_action_info_2026_unique_');
  const bookmarkRowsInfoHost = document.getElementById('_x_extension_bookmark_rows_info_2026_unique_');
  const bookmarkColumnsInfoHost = document.getElementById('_x_extension_bookmark_columns_info_2026_unique_');
  const faviconBlacklistEditor = document.getElementById('_x_extension_favicon_blacklist_editor_2026_unique_');
  const faviconBlacklistList = document.getElementById('_x_extension_favicon_blacklist_list_2026_unique_');
  const faviconBlacklistForm = document.getElementById('_x_extension_favicon_blacklist_form_2026_unique_');
  const faviconBlacklistClearButton = document.getElementById('_x_extension_favicon_blacklist_clear_2026_unique_');
  const syncStatus = document.getElementById('_x_extension_sync_status_2024_unique_');
  const syncStatusText = document.getElementById('_x_extension_sync_status_text_2024_unique_');
  const syncNowButton = document.getElementById('_x_extension_sync_now_2024_unique_');
  const shortcutSyncSummary = document.getElementById('_x_extension_shortcut_sync_summary_2026_unique_');
  const syncExportButton = document.getElementById('_x_extension_sync_export_2024_unique_');
  const syncImportButton = document.getElementById('_x_extension_sync_import_2024_unique_');
  const syncImportInput = document.getElementById('_x_extension_sync_import_input_2024_unique_');
  const newtabOpenInNewTabToggles = Array.from(document.querySelectorAll('input[data-newtab-open-in-new-tab-surface]'));
  const fallbackShortcutInput = document.getElementById('_x_extension_shortcuts_input_2024_unique_');
  const fallbackShortcutTokens = document.getElementById('_x_extension_shortcuts_tokens_2024_unique_');
  const fallbackShortcutWrap = document.querySelector('._x_extension_shortcuts_hotkey_wrap_2024_unique_');
  const restrictedActionSelectWrap = document.getElementById('_x_extension_restricted_action_tabs_wrap_2024_unique_');
  const restrictedActionTabButtons = Array.from(document.querySelectorAll('button[data-restricted-action]'));
  const searchResultPriorityTabsWrap = document.getElementById('_x_extension_search_result_priority_tabs_wrap_2026_unique_');
  const searchResultPriorityTabButtons = Array.from(document.querySelectorAll('button[data-search-result-priority]'));
  const clearShortcutButton = document.getElementById('_x_extension_clear_shortcut_2024_unique_');
  const resetShortcutButton = document.getElementById('_x_extension_reset_shortcut_2024_unique_');
  const shortcutsStatus = document.getElementById('_x_extension_shortcuts_status_2024_unique_');
  const shortcutReferenceList = document.getElementById('_x_extension_shortcut_reference_list_2026_unique_');
  const openOnboardingPageButton = document.getElementById('_x_extension_open_onboarding_page_2026_unique_');
  const feedbackSupportHost = document.getElementById('_x_extension_feedback_support_2026_unique_');
  const openShortcutsPageButton = document.getElementById('_x_extension_open_shortcuts_page_2026_unique_');
  const siteSearchEngineBuiltinList = document.getElementById('_x_extension_search_engine_builtin_list_2026_unique_');
  const aggregateSearchList = document.getElementById('_x_extension_aggregate_search_list_2026_unique_');
  const aggregateSearchClearButton = document.getElementById('_x_extension_aggregate_search_clear_2026_unique_');
  const siteSearchCustomList = document.getElementById('_x_extension_site_search_custom_list_2024_unique_');
  const siteSearchBuiltinList = document.getElementById('_x_extension_site_search_builtin_list_2024_unique_');
  const siteSearchAiGroup = document.getElementById('_x_extension_site_search_ai_group_2026_unique_');
  const siteSearchAiBuiltinList = document.getElementById('_x_extension_site_search_ai_builtin_list_2026_unique_');
  const siteSearchKeyInput = document.getElementById('_x_extension_site_search_key_2024_unique_');
  const siteSearchNameInput = document.getElementById('_x_extension_site_search_name_2024_unique_');
  const siteSearchTemplateInput = document.getElementById('_x_extension_site_search_template_2024_unique_');
  const siteSearchInsertQueryButton = document.getElementById('_x_extension_site_search_insert_query_2026_unique_');
  const siteSearchAliasInput = document.getElementById('_x_extension_site_search_alias_2024_unique_');
  const siteSearchCategoryButtons = Array.from(document.querySelectorAll(
    'button[data-site-search-category]'
  ));
  const siteSearchForm = document.querySelector('._x_extension_settings_content_2024_unique_[data-content="shortcuts"] ._x_extension_shortcut_form_2024_unique_');
  const siteSearchFormTrigger = document.getElementById('_x_extension_site_search_expand_2024_unique_');
  const siteSearchAddButton = document.getElementById('_x_extension_site_search_add_2024_unique_');
  const siteSearchCancelButton = document.getElementById('_x_extension_site_search_cancel_2024_unique_');
  const siteSearchError = document.getElementById('_x_extension_site_search_error_2024_unique_');
  const builtinResetButton = document.getElementById('_x_extension_builtin_reset_2024_unique_');
  const customClearButton = document.getElementById('_x_extension_custom_clear_2024_unique_');
  const blacklistList = document.getElementById('_x_extension_blacklist_list_2026_unique_');
  const blacklistForm = document.getElementById('_x_extension_blacklist_form_2026_unique_');
  const blacklistClearButton = document.getElementById('_x_extension_blacklist_clear_2026_unique_');
  const toastElement = document.getElementById('_x_extension_toast_2024_unique_');
  const optionsBlacklistListApi = globalThis.LumnoOptionsBlacklistList;
  const optionsAggregateSearchListApi = globalThis.LumnoOptionsAggregateSearchList;
  const optionsFeedbackSupportApi = globalThis.LumnoOptionsFeedbackSupport;
  const optionsInfoButtonApi = globalThis.LumnoOptionsInfoButton;
  const optionsToastApi = globalThis.LumnoOptionsToast;
  const optionsPopconfirmApi = globalThis.LumnoOptionsPopconfirm;
  const optionsSegmentedControlApi = globalThis.LumnoOptionsSegmentedControl;
  const optionsSelectControlApi = globalThis.LumnoOptionsSelectControl;
  const optionsSettingsControlsApi = globalThis.LumnoOptionsSettingsControls;
  const optionsSettingsFormsApi = globalThis.LumnoOptionsSettingsForms;
  const optionsSettingsNavigationApi = globalThis.LumnoOptionsSettingsNavigation;
  const optionsShortcutReferenceApi = globalThis.LumnoOptionsShortcutReference;
  const optionsShortcutHotkeyApi = globalThis.LumnoOptionsShortcutHotkey;
  const optionsSiteSearchListApi = globalThis.LumnoOptionsSiteSearchList;
  const optionsThemePickerApi = globalThis.LumnoOptionsThemePicker;
  const shortcutDisplay = globalThis.LumnoShortcutDisplay;
  const toastController = optionsToastApi.createToastController(toastElement, {
    windowObj: window,
    duration: 2200
  });
  const feedbackSupportSection = globalThis.LumnoOptionsFeedbackSupportSection.createFeedbackSupportSection({
    communityLinks: COMMUNITY_LINKS,
    controller: optionsFeedbackSupportApi.createFeedbackSupportController(feedbackSupportHost),
    getLocale: () => (currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(currentLanguageMode)),
    getMessage,
    helpIconUrl: chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function'
      ? chrome.runtime.getURL('assets/images/site-search/glyph-lm.png')
      : '../../assets/images/site-search/glyph-lm.png',
    isHelpCenterSearchEnabled: () => helpCenterSearchEnabled
  });
  function createOptionsInfoButtonController(host) {
    return optionsInfoButtonApi.createInfoButtonController(host);
  }
  const restrictedActionInfoController = createOptionsInfoButtonController(restrictedActionInfoHost);
  const bookmarkRowsInfoController = createOptionsInfoButtonController(bookmarkRowsInfoHost);
  const bookmarkColumnsInfoController = createOptionsInfoButtonController(bookmarkColumnsInfoHost);
  const overlayPageThemeAdaptationInfoController = createOptionsInfoButtonController(
    overlayPageThemeAdaptationInfoHost
  );
  const shortcutReferenceController =
    optionsShortcutReferenceApi.createShortcutReferenceController(shortcutReferenceList);
  const shortcutHotkeyController =
    optionsShortcutHotkeyApi.createShortcutHotkeyController(
      fallbackShortcutTokens,
      { onContentReady: updateFallbackShortcutWrapWidthForContent }
    );
  const themePickerController =
    optionsThemePickerApi.createThemePickerController(themePicker, {
      onSelect(mode, button) {
        playThemeOptionClickEffect(button);
        setThemeMode(mode);
      }
    });
  function createOptionsSegmentedControlController(host, kind, onSelect) {
    return optionsSegmentedControlApi.createSegmentedControlController(host, {
      kind,
      onSelect
    });
  }
  const recentModeTabsController = createOptionsSegmentedControlController(
    recentModeTabsWrap,
    'recent-mode',
    handleRecentModeSelection
  );
  const newtabWidthTabsController = createOptionsSegmentedControlController(
    newtabWidthTabsWrap,
    'newtab-width',
    handleNewtabWidthSelection
  );
  const overlaySizeTabsController = createOptionsSegmentedControlController(
    overlaySizeTabsWrap,
    'overlay-size',
    handleOverlaySizeSelection
  );
  const overlayEnterAnimationTabsController = createOptionsSegmentedControlController(
    overlayEnterAnimationTabsWrap,
    'overlay-enter-animation',
    handleOverlayEnterAnimationSelection
  );
  const restrictedActionTabsController = createOptionsSegmentedControlController(
    restrictedActionSelectWrap,
    'restricted-action',
    handleRestrictedActionSelection
  );
  const searchResultPriorityTabsController = createOptionsSegmentedControlController(
    searchResultPriorityTabsWrap,
    'search-result-priority',
    handleSearchResultPrioritySelection
  );
  const newtabTopContentTabsController = createOptionsSegmentedControlController(
    newtabTopContentTabsWrap,
    'newtab-top-content',
    handleNewtabTopContentSelection
  );
  const optionsToggleControlRecords = new Map();
  const unsupportedSettingInputIds = new Set();
  function registerOptionsToggleControl(input, kind) {
    if (!input) {
      return null;
    }
    const host = input.closest('._x_extension_switch_2024_unique_');
    if (!host) {
      return null;
    }
    const model = {
      ariaLabel: input.getAttribute('aria-label') || undefined,
      ariaLabelKey: input.getAttribute('data-i18n-aria-label') || undefined,
      checked: Boolean(input.checked),
      disabled: Boolean(input.disabled),
      id: input.id
    };
    const controller = optionsSettingsControlsApi.createToggleControlController(host, {
      kind,
      onChange(next) {
        input.checked = Boolean(next);
        input.dispatchEvent(new Event('change'));
      }
    });
    const record = { controller, model };
    optionsToggleControlRecords.set(input, record);
    controller.render(model);
    return controller;
  }
  function setOptionsToggleState(input, checked, disabled) {
    if (!input) {
      return;
    }
    // Stays off without touching the synced value other browsers use.
    if (unsupportedSettingInputIds.has(input.id)) {
      checked = false;
      disabled = true;
    }
    input.checked = Boolean(checked);
    if (typeof disabled === 'boolean') {
      input.disabled = disabled;
    }
    const record = optionsToggleControlRecords.get(input);
    if (!record) {
      return;
    }
    record.model = Object.assign({}, record.model, {
      checked: Boolean(checked),
      disabled: Boolean(input.disabled)
    });
    record.controller.render(record.model);
  }

  function syncSelectionQuickActionsProviderAvailability() {
    const disabled = Boolean(selectionQuickActionsToggle && !selectionQuickActionsToggle.checked);
    if (selectionQuickActionsProviderSelect) {
      selectionQuickActionsProviderSelect.disabled = disabled;
      renderOptionsSelectControl(selectionQuickActionsProviderSelect);
    }
    if (selectionQuickActionsProviderRow) {
      selectionQuickActionsProviderRow.setAttribute('data-disabled', disabled ? 'true' : 'false');
      selectionQuickActionsProviderRow.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
    if (selectionQuickActionsGroupToggle) {
      setOptionsToggleState(
        selectionQuickActionsGroupToggle,
        selectionQuickActionsGroupToggle.checked,
        disabled
      );
    }
    if (selectionQuickActionsGroupRow) {
      selectionQuickActionsGroupRow.setAttribute('data-disabled', disabled ? 'true' : 'false');
      selectionQuickActionsGroupRow.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
  }
  const TOGGLE_SETTINGS = globalThis.LumnoOptionsToggleSettings.getToggleSettings(SETTINGS, {
    faviconBlacklistEditor: setFaviconBlacklistEditorEnabled,
    newtabShortcutSubcontrols: syncNewtabShortcutSubcontrolAvailability,
    selectionQuickActionsAvailability: syncSelectionQuickActionsProviderAvailability
  });
  // Each switch's React view replaces its <input> in the document. The page
  // keeps working with the original element: the view reports clicks to it as
  // change events and re-renders from it, so look every control up once, now.
  const toggleSettingControls = new Map(TOGGLE_SETTINGS.map((entry) => [
    entry,
    document.getElementById(entry.inputId)
  ]));
  TOGGLE_SETTINGS.forEach((entry) => {
    if (entry.kind) {
      registerOptionsToggleControl(toggleSettingControls.get(entry), entry.kind);
    }
  });
  newtabOpenInNewTabToggles.forEach((input) => registerOptionsToggleControl(input, 'newtab-open-in-new-tab'));

  // Settings this browser cannot honor stay visible but disabled, with the
  // reason in a tooltip that follows the cursor: <div
  // data-browser-unsupported="firefox" data-unsupported-reason-key="...">.
  function markBrowserUnsupportedSettings() {
    const family = document.documentElement.getAttribute('data-browser-family');
    let reasonTooltip = null;
    document.querySelectorAll('[data-browser-unsupported]').forEach((row) => {
      if (row.getAttribute('data-browser-unsupported') !== family) {
        return;
      }
      row.setAttribute('data-unsupported', 'true');
      row.setAttribute('aria-disabled', 'true');
      reasonTooltip = reasonTooltip || globalThis.LumnoCursorTooltip.createController({
        documentObj: document,
        windowObj: window,
        id: '_x_extension_options_unsupported_cursor_tooltip_2026_unique_',
        appendTo: document.body,
        maxWidth: 360,
        offsetX: 14,
        offsetY: 16
      });
      const reasonKey = row.getAttribute('data-unsupported-reason-key') || '';
      reasonTooltip.bind(row, () => getMessage(reasonKey, ''));
      // The toggle's React view replaces its <input>; the label keeps the id.
      row.querySelectorAll('label[for]').forEach((label) => unsupportedSettingInputIds.add(label.htmlFor));
    });
    optionsToggleControlRecords.forEach((record, input) => {
      if (unsupportedSettingInputIds.has(input.id)) {
        setOptionsToggleState(input, false, true);
      }
    });
  }
  markBrowserUnsupportedSettings();

  const searchResultSourceTypeItems = searchResultSourceTypeInputs.map((input) => {
    const label = input.closest('label');
    const text = label ? label.querySelector('span[data-i18n]') : null;
    return {
      checked: Boolean(input.checked),
      id: input.id,
      labelFallback: text ? text.textContent : '',
      labelKey: text ? text.getAttribute('data-i18n') : '',
      value: input.getAttribute('data-search-result-source-type') || ''
    };
  }).filter((item) => item.value);
  const searchResultSourceTypeController =
    optionsSettingsControlsApi.createRequiredCheckboxGroupController(
      searchResultSourceTypeGroupHost,
      {
        kind: 'search-result-sources',
        onChange(values) {
          const selected = new Set(values);
          let changedInput = null;
          searchResultSourceTypeInputs.forEach((input) => {
            const next = selected.has(input.getAttribute('data-search-result-source-type'));
            if (input.checked !== next && !changedInput) {
              changedInput = input;
            }
            input.checked = next;
          });
          if (changedInput) {
            changedInput.dispatchEvent(new Event('change'));
          }
        }
      }
    );
  function renderSearchResultSourceTypeControl(value) {
    if (!searchResultSourceTypeController) {
      return;
    }
    const selected = new Set(normalizeSearchResultSourceTypes(value));
    searchResultSourceTypeController.render({
      items: searchResultSourceTypeItems.map((item) => Object.assign({}, item, {
        checked: selected.has(item.value),
        label: getMessage(item.labelKey, item.labelFallback)
      }))
    });
  }
  const settingsNavigationController =
    optionsSettingsNavigationApi.createSettingsNavigationController(tabsContainer, {
      onSelect: handleSettingsTabSelection
    });
  const searchBlacklistListController =
    optionsBlacklistListApi.createBlacklistListController(blacklistList, {
      kind: 'search',
      onRemove: handleSearchBlacklistRemove,
      onSave: handleSearchBlacklistSave
    });
  const faviconBlacklistListController =
    optionsBlacklistListApi.createBlacklistListController(faviconBlacklistList, {
      kind: 'favicon',
      onRemove: handleFaviconBlacklistRemove
    });
  function createSiteSearchListController(host, kind) {
    return optionsSiteSearchListApi.createSiteSearchListController(host, {
      kind,
      onLocateDuplicate: locateBuiltinSiteSearchProvider,
      onRemove: removeSiteSearchItem,
      onSave: handleSiteSearchProviderSave
    });
  }
  const siteSearchCustomListController = createSiteSearchListController(
    siteSearchCustomList,
    'custom'
  );
  const siteSearchEngineBuiltinListController = createSiteSearchListController(
    siteSearchEngineBuiltinList,
    'builtin-engine'
  );
  const siteSearchBuiltinListController = createSiteSearchListController(
    siteSearchBuiltinList,
    'builtin-search'
  );
  const siteSearchAiBuiltinListController = createSiteSearchListController(
    siteSearchAiBuiltinList,
    'builtin-ai'
  );
  const aggregateSearchListController =
    optionsAggregateSearchListApi.createAggregateSearchListController(aggregateSearchList, {
      onRemove: handleAggregateSearchRemove,
      onSave: handleAggregateSearchSave
    });
  const siteSearchFormController =
    optionsSettingsFormsApi.createSiteSearchFormController(siteSearchForm, {
      onSave: handleReactSiteSearchFormSave
    });
  const searchBlacklistFormController =
    optionsSettingsFormsApi.createBlacklistFormController(blacklistForm, {
      kind: 'search',
      onSave: handleReactSearchBlacklistFormSave
    });
  const faviconBlacklistFormController =
    optionsSettingsFormsApi.createBlacklistFormController(faviconBlacklistForm, {
      kind: 'favicon',
      onSave: handleReactFaviconBlacklistFormSave
    });

  // 使用系统字体，避免外链字体依赖。
  if (!panel || themeButtons.length === 0 || tabButtons.length === 0) {
    return;
  }

  const SEARCH_UTILS = globalThis.LumnoSearchUtils;
  const SITE_SEARCH = globalThis.LumnoOptionsSiteSearch;
  const siteSearchModel = SITE_SEARCH.createSiteSearchModel({
    searchUtils: SEARCH_UTILS,
    aggregateSearchStore: AGGREGATE_SEARCH_STORE
  });
  const {
    getActiveBuiltinSiteSearchProviders,
    getSiteSearchBuiltinKey,
    normalizeAliases
  } = SITE_SEARCH;
  const enqueueSiteSearchProviderStorageOperation = SITE_SEARCH.createOperationQueue();
  const AGGREGATE_SEARCH = globalThis.LumnoOptionsAggregateSearch;
  const aggregateSearchModel = AGGREGATE_SEARCH.createAggregateSearchModel({
    aggregateSearchStore: AGGREGATE_SEARCH_STORE
  });
  const syncTransfer = globalThis.LumnoOptionsSyncTransfer.createSyncTransfer({
    deriveLegacyAutoGroupEnabled: aggregateSearchModel.deriveLegacyAutoGroupEnabled,
    settings: SETTINGS
  });
  const {
    runtime: providerStorageRuntime,
    area: rawStorageArea
  } = SETTINGS.getProviderStorage(chrome);
  // Device-only values (the language copy, the shortcut overflow, WebDAV
  // status) and the local-to-sync migration always use chrome.storage.local,
  // whichever area holds the synced settings.
  const localStorageArea = chrome && chrome.storage ? chrome.storage.local || null : null;
  const startupStorageReadBatch = SETTINGS.createStorageReadBatch(rawStorageArea);
  const storageArea = startupStorageReadBatch.area;
  optionsStartupStorageBatchPending = true;
  const SETTING_BINDINGS = globalThis.LumnoOptionsSettingBindings;
  // Each section registers its storage change handlers here, next to the
  // code that renders it; one chrome.storage listener dispatches to them.
  const storageChanges = SETTING_BINDINGS.createStorageChangeRegistry({
    isPrimaryAreaName: isPrimaryStorageAreaName
  });
  const settingBinder = SETTING_BINDINGS.createSettingBinder({
    storageArea,
    registry: storageChanges,
    refreshCustomSelects,
    setToggleState: setOptionsToggleState,
    setSelectState: setOptionsSelectState
  });

  function finishOptionsStartupStorageBatch(metrics) {
    optionsStartupStorageBatchPending = false;
    const root = document.documentElement;
    const values = metrics && typeof metrics === 'object' ? metrics : {};
    if (root) {
      root.setAttribute(
        'data-lumno-options-bootstrap-storage-reads',
        String(Number.isFinite(values.underlyingReadCount) ? values.underlyingReadCount : 0)
      );
      root.setAttribute(
        'data-lumno-options-bootstrap-storage-requests',
        String(Number.isFinite(values.requestCount) ? values.requestCount : 0)
      );
      root.setAttribute(
        'data-lumno-options-bootstrap-storage-keys',
        values.keyCount === null ? 'all' : String(Number.isFinite(values.keyCount) ? values.keyCount : 0)
      );
    }
    if (optionsStartupRefreshDeferred) {
      optionsStartupRefreshDeferred = false;
      refreshCustomSelects({ force: true });
    }
    const markOptionsReady = () => {
      if (optionsReadyMarked) {
        return;
      }
      optionsReadyMarked = true;
      optionsStartupRefreshCoalescing = false;
      if (optionsStartupRefreshDeferred) {
        optionsStartupRefreshDeferred = false;
        refreshCustomSelects({ force: true });
      }
      const readyAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
      if (root) {
        root.setAttribute('data-lumno-options-ready', 'true');
        root.setAttribute(
          'data-lumno-options-ready-ms',
          Math.max(0, readyAt - optionsRuntimeStartedAt).toFixed(2)
        );
        root.setAttribute(
          'data-lumno-options-ready-navigation-ms',
          Math.max(0, readyAt).toFixed(2)
        );
      }
      markOptionsPerformance('lumno-options-ready');
      try {
        if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
          performance.measure(
            'lumno-options-startup',
            'lumno-options-runtime-start',
            'lumno-options-ready'
          );
        }
      } catch (e) {
        // Performance measures are diagnostics only.
      }
    };
    // Ready means the startup values have been painted, so changes from here
    // on may animate: wait for the frame that paints them. A hidden page gets
    // no frames until it is shown and has nothing on screen to animate, so it
    // is ready as soon as the values are in.
    if (document.visibilityState === 'hidden' || typeof requestAnimationFrame !== 'function') {
      markOptionsReady();
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(markOptionsReady);
    });
  }

  startupStorageReadBatch.ready.then(finishOptionsStartupStorageBatch);

  function getActivePrimaryAreaName() {
    return providerStorageRuntime.getActiveAreaName();
  }
  function isPrimaryStorageAreaName(areaName) {
    return providerStorageRuntime.isActiveAreaName(areaName);
  }
  function addStorageChangeListener(listener) {
    return SETTINGS.addStorageChangeListener(chrome, listener);
  }

  const PANEL_MOTION = globalThis.LumnoOptionsPanelMotion;
  const panelHeightAnimator = PANEL_MOTION.createPanelHeightAnimator({
    documentObj: document,
    panel,
    reserveHost: optionsRoot,
    windowObj: window
  });
  const { setConditionalSettingsElementVisibility } = PANEL_MOTION;
  function animateOptionsPanelHeight(mutateLayout) {
    return panelHeightAnimator.animate(mutateLayout);
  }

  const {
    THEME_STORAGE_KEY,
    OPTIONS_THEME_PRELOAD_STORAGE_KEY,
    LANGUAGE_STORAGE_KEY,
    RECENT_MODE_STORAGE_KEY,
    RECENT_COUNT_STORAGE_KEY,
    NEWTAB_WIDTH_MODE_STORAGE_KEY,
    OVERLAY_SIZE_MODE_STORAGE_KEY,
    OVERLAY_ENTER_ANIMATION_STORAGE_KEY,
    BOOKMARK_COUNT_STORAGE_KEY,
    BOOKMARK_COLUMNS_STORAGE_KEY,
    NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
    NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY,
    NEWTAB_SHORTCUT_WIDTH_MIN,
    NEWTAB_SHORTCUT_WIDTH_MAX,
    NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
    NEWTAB_SHORTCUT_COLUMNS_MIN,
    NEWTAB_SHORTCUT_COLUMNS_MAX,
    NEWTAB_SHORTCUT_COLUMNS_DEFAULT,
    NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
    NEWTAB_SHORTCUT_SIZE_MIN,
    NEWTAB_SHORTCUT_SIZE_MAX,
    NEWTAB_SHORTCUT_SIZE_DEFAULT,
    NEWTAB_SHORTCUT_GAP_STORAGE_KEY,
    NEWTAB_SHORTCUT_GAP_MIN,
    NEWTAB_SHORTCUT_GAP_MAX,
    NEWTAB_SHORTCUT_GAP_DEFAULT,
    NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY,
    NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY,
    NEWTAB_TIME_FONT_WEIGHT_MIN,
    NEWTAB_TIME_FONT_WEIGHT_MAX,
    NEWTAB_TIME_FONT_WEIGHT_DEFAULT,
    RESTRICTED_ACTION_STORAGE_KEY,
    RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY,
    SEARCH_RESULT_PRIORITY_STORAGE_KEY,
    SEARCH_RESULT_TAB_POSITION_STORAGE_KEY,
    SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY,
    SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY,
    FALLBACK_SHORTCUT_STORAGE_KEY,
    SITE_SEARCH_STORAGE_KEY,
    SITE_SEARCH_DISABLED_STORAGE_KEY,
    AGGREGATE_SEARCH_STORAGE_KEY,
    AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY,
    SEARCH_BLACKLIST_STORAGE_KEY,
    FAVICON_REQUEST_BLACKLIST_STORAGE_KEY,
    SYNC_META_STORAGE_KEY,
    NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY
  } = SETTINGS;
  const SYNC_KEYS = SETTINGS.CHROME_SYNC_STORAGE_KEYS;
  // Grouped shortcut state. Its three keys are one save and move together.
  const blacklistModel = globalThis.LumnoOptionsBlacklist.createBlacklistModel({
    blacklistUtils: globalThis.LumnoBlacklistUtils
  });
  const {
    buildItemKey: buildBlacklistItemKey,
    formatPatternForDisplay: formatBlacklistPatternForDisplay,
    getInputConfig: getBlacklistInputConfig,
    getPatternInputValue: getBlacklistPatternInputValue,
    normalizeItems: normalizeBlacklistItems,
    normalizeMatchModes: normalizeBlacklistMatchModes
  } = blacklistModel;
  let currentMessages = null;
  let currentLanguageMode = 'system';
  const webDavSettingsController = globalThis.LumnoWebDavOptions.createController({ chromeApi: chrome, getMessage,
      animateLayout: animateOptionsPanelHeight });
  if (searchResultSourceTypeController) {
    renderSearchResultSourceTypeControl(
      searchResultSourceTypeItems.filter((item) => item.checked).map((item) => item.value)
    );
  }
  const DEBUG_DUPLICATE_CUSTOM_KEY = 'dup';
  const SHORTCUT_KEYS = globalThis.LumnoOptionsShortcutKeys;
  const { buildShortcutFromEvent, normalizeFallbackShortcut } = SHORTCUT_KEYS;
  const shortcutPlatform = shortcutDisplay.getNavigatorPlatform(typeof navigator !== 'undefined' ? navigator : null);
  const isMacPlatform = shortcutPlatform === 'mac';
  const OPTIONS_TARGET_SITE_SEARCH_AI = 'site-search-ai';
  const OPTIONS_TARGET_DOCUMENT_PIP = 'document-pip';
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let mediaListenerAttached = false;
  let defaultSiteSearchProviders = [];
  let customSiteSearchProviders = [];
  let customSiteSearchProviderIdsReady = true;
  let disabledSiteSearchKeys = new Set();
  // Whether the Help Center site search (lm) is on; unknown (null) until the providers load,
  // so the "ask in the search box" demo never shows for someone who turned it off.
  let helpCenterSearchEnabled = null;
  let siteSearchProvidersLoaded = false;
  let aggregateSearches = [];
  let aggregateSearchesReady = false;
  let aggregateSearchStateCoordinator = null;
  let languageApplyRequestId = 0;
  let editingSiteSearchKey = null;
  let siteSearchDraftCategory = 'site';
  let activePopconfirm = null;
  // A closed popconfirm renders its aria-label once; applyI18n re-renders each
  // after a language change so the label follows the chosen language.
  const popconfirmLanguageRefreshers = new Set();
  let siteSearchFormExpanded = false;
  let siteSearchRefreshSuppressUntil = 0;
  let siteSearchRefreshTimer = null;
  let siteSearchProviderRefreshCoordinator = null;
  let pendingOptionsScrollTarget = '';
  let currentShortcutLabel = null;
  let isCapturingFallbackShortcut = false;
  let cancelCaptureOnMouseLeave = false;
  let fallbackCaptureStopTimer = null;
  let fallbackShortcutBaseWidth = 0;
  let isFallbackWidthReady = false;
  let searchBlacklistItems = [];
  let faviconRequestBlacklistItems = [];
  const tooltipController = globalThis.LumnoTooltip.createController({
    documentObj: document,
    windowObj: window,
    id: '_x_extension_options_tooltip_2026_unique_',
    appendTo: document.body,
    maxWidth: 'min(360px, calc(100vw - 24px))'
  });
  function renderOptionsInfoButtons() {
    const bookmarkTooltip = getMessage(
      'settings_bookmark_adaptive_count_tooltip',
      '该值为宽度充足时的最大数量，实际显示数量会根据可用空间自适应。'
    );
    [bookmarkRowsInfoController, bookmarkColumnsInfoController].forEach((controller) => {
      if (controller) {
        controller.render({
          tooltip: bookmarkTooltip,
          tooltipKey: 'settings_bookmark_adaptive_count_tooltip'
        });
      }
    });
    if (restrictedActionInfoController) {
      restrictedActionInfoController.render({
        tooltip: getMessage(
          'settings_restricted_tooltip',
          '受限页（如 chrome://、扩展商店、部分 file:// 页面）无法开启聚焦搜索；按下快捷键将按此处规则处理。'
        ),
        tooltipKey: 'settings_restricted_tooltip'
      });
    }
    if (overlayPageThemeAdaptationInfoController) {
      overlayPageThemeAdaptationInfoController.render({
        tooltip: getMessage(
          'settings_overlay_page_theme_adaptation_tooltip',
          '仅在“深浅色模式”=“跟随系统”时显示，关闭后将不再基于网页主题色变更深浅模式。'
        ),
        tooltipKey: 'settings_overlay_page_theme_adaptation_tooltip'
      });
    }
  }
  renderOptionsInfoButtons();
  const fallbackSiteSearchProviders = SEARCH_UTILS.getDefaultSiteSearchProviders();

  function createPersistentId(prefix) {
    const safePrefix = String(prefix || 'item').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'item';
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return `${safePrefix}-${globalThis.crypto.randomUUID()}`;
    }
    return `${safePrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  let currentThemeMode = 'system';
  let currentRecentMode = 'most';
  let currentNewtabWidthMode = 'wide';
  let currentOverlaySizeMode = 'standard';
  let currentOverlayEnterAnimation = 'elastic';
  let currentRestrictedAction = 'default';
  let currentSearchResultPriority = 'autocomplete';
  let currentSearchResultDisplayLimit = 10;
  let currentRecentCount = 4;
  let currentBookmarkCount = 8;
  let currentBookmarkColumns = 6;
  let currentNewtabTopContentMode = 'brand';
  let currentNewtabTimeFontWeight = NEWTAB_TIME_FONT_WEIGHT_DEFAULT;
  let currentNewtabShortcutColumns = NEWTAB_SHORTCUT_COLUMNS_DEFAULT;
  let currentNewtabShortcutSize = NEWTAB_SHORTCUT_SIZE_DEFAULT;
  let currentNewtabShortcutGap = NEWTAB_SHORTCUT_GAP_DEFAULT;
  let currentActiveSettingsTab = 'general';
  const optionsSelectControlRecords = new Map();
  function registerOptionsSelectControl(select, kind) {
    if (!select) {
      return null;
    }
    const host = select.closest('._x_extension_custom_select_2024_unique_');
    if (!host) {
      return null;
    }
    const items = Array.from(select.options).map((option) => {
      const iconPath = option.getAttribute('data-icon-path') || '';
      return {
        fallback: option.textContent || option.value,
        iconUrl: iconPath && chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function'
          ? chrome.runtime.getURL(iconPath)
          : (iconPath ? `../../${iconPath}` : ''),
        labelKey: option.getAttribute('data-i18n') || '',
        value: option.value
      };
    });
    // The setting title plus the current value name the trigger for assistive tech.
    const title = host.closest('._x_extension_setting_row_2024_unique_')
      ?.querySelector('._x_extension_setting_title_2024_unique_');
    if (title && !title.id) {
      title.id = `${select.id}_title`;
    }
    const controller = optionsSelectControlApi.createSelectControlController(host, {
      getViewportTopInset() {
        // The settings tabs stay pinned at the top; a menu that flips upward must clear them.
        const tabsRect = tabsRow ? tabsRow.getBoundingClientRect() : null;
        return tabsRect ? Math.max(0, tabsRect.bottom + 8) : 8;
      },
      kind,
      onSelect(next) {
        select.value = next;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    const record = { controller, items, labelledBy: title ? title.id : '', select };
    optionsSelectControlRecords.set(select, record);
    return record;
  }
  function renderOptionsSelectControl(select) {
    const record = optionsSelectControlRecords.get(select);
    if (!record) {
      return;
    }
    record.controller.render({
      disabled: Boolean(select.disabled),
      id: select.id,
      labelledBy: record.labelledBy || undefined,
      items: record.items.map((item) => ({
        iconUrl: item.iconUrl,
        label: item.labelKey ? getMessage(item.labelKey, item.fallback) : item.fallback,
        labelKey: item.labelKey,
        value: item.value
      })),
      value: select.value
    });
  }
  function setOptionsSelectState(select, value) {
    if (!select) {
      return;
    }
    select.value = String(value);
    renderOptionsSelectControl(select);
  }
  [
    [languageSelect, 'language'],
    [searchResultTabPositionSelect, 'search-result-tab-position'],
    [selectionQuickActionsProviderSelect, 'selection-quick-actions-provider']
  ].forEach(([select, kind]) => {
    const record = registerOptionsSelectControl(select, kind);
    if (record) {
      renderOptionsSelectControl(select);
    }
  });
  const newtabTimeFontWeightController =
    optionsSettingsControlsApi.createRangeSliderControlController(
      newtabTimeFontWeightControlHost,
      {
        kind: 'newtab-time-font-weight',
        onInput(value) {
          const nextWeight = normalizeNewtabTimeFontWeight(value);
          currentNewtabTimeFontWeight = nextWeight;
          if (storageArea) {
            storageArea.set({ [NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY]: nextWeight });
          }
        }
      }
    );
  function renderNewtabTimeFontWeightControl(value) {
    if (!newtabTimeFontWeightController) {
      return;
    }
    currentNewtabTimeFontWeight = normalizeNewtabTimeFontWeight(value);
    newtabTimeFontWeightController.render({
      ariaLabel: getMessage('newtab_time_font_weight_title', 'Time font weight'),
      id: '_x_extension_newtab_time_font_weight_slider_2026_unique_',
      min: NEWTAB_TIME_FONT_WEIGHT_MIN,
      max: NEWTAB_TIME_FONT_WEIGHT_MAX,
      step: 1,
      ticks: [
        { align: 'start', label: String(NEWTAB_TIME_FONT_WEIGHT_MIN) },
        { label: String(Math.round((NEWTAB_TIME_FONT_WEIGHT_MIN + NEWTAB_TIME_FONT_WEIGHT_MAX) / 2)) },
        { align: 'end', label: String(NEWTAB_TIME_FONT_WEIGHT_MAX) }
      ],
      value: currentNewtabTimeFontWeight
    });
  }
  const newtabShortcutColumnsController =
    optionsSettingsControlsApi.createRangeSliderControlController(
      newtabShortcutColumnsControlHost,
      {
        kind: 'newtab-shortcut-columns',
        onInput(value) {
          const nextColumns = normalizeNewtabShortcutColumns(value);
          currentNewtabShortcutColumns = nextColumns;
          if (storageArea) {
            storageArea.set({ [NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY]: nextColumns });
          }
        }
      }
    );
  function renderNewtabShortcutColumnsControl(value, disabled) {
    if (!newtabShortcutColumnsController) {
      return;
    }
    currentNewtabShortcutColumns = normalizeNewtabShortcutColumns(value);
    newtabShortcutColumnsController.render({
      ariaLabel: getMessage(
        'settings_newtab_shortcut_columns_title',
        'Shortcuts per row'
      ),
      disabled: Boolean(disabled),
      id: '_x_extension_newtab_shortcut_columns_slider_2026_unique_',
      min: NEWTAB_SHORTCUT_COLUMNS_MIN,
      max: NEWTAB_SHORTCUT_COLUMNS_MAX,
      step: 1,
      ticks: [
        { align: 'start', label: '4', percent: 0 },
        { label: '8', percent: 100 / 3 },
        { label: '12', percent: 200 / 3 },
        { align: 'end', label: '16', percent: 100 }
      ],
      value: currentNewtabShortcutColumns
    });
  }
  const newtabShortcutSizeController =
    optionsSettingsControlsApi.createRangeSliderControlController(
      newtabShortcutSizeControlHost,
      {
        kind: 'newtab-shortcut-size',
        onInput(value) {
          const nextSize = normalizeNewtabShortcutSize(value);
          currentNewtabShortcutSize = nextSize;
          if (storageArea) {
            storageArea.set({ [NEWTAB_SHORTCUT_SIZE_STORAGE_KEY]: nextSize });
          }
        }
      }
    );
  function renderNewtabShortcutSizeControl(value, disabled) {
    if (!newtabShortcutSizeController) {
      return;
    }
    currentNewtabShortcutSize = normalizeNewtabShortcutSize(value);
    const label = getMessage('settings_newtab_shortcut_size_title', 'Shortcut size');
    newtabShortcutSizeController.render({
      ariaLabel: label,
      defaultValue: NEWTAB_SHORTCUT_SIZE_DEFAULT,
      disabled: Boolean(disabled),
      id: '_x_extension_newtab_shortcut_size_slider_2026_unique_',
      min: NEWTAB_SHORTCUT_SIZE_MIN,
      max: NEWTAB_SHORTCUT_SIZE_MAX,
      resetAriaLabel: getMessage(
        'settings_newtab_shortcut_size_reset',
        'Reset shortcut size'
      ),
      resetButtonId: '_x_extension_newtab_shortcut_size_reset_2026_unique_',
      step: 1,
      ticks: [
        { align: 'start', label: String(NEWTAB_SHORTCUT_SIZE_MIN), percent: 0 },
        { label: String(NEWTAB_SHORTCUT_SIZE_DEFAULT), percent: 50 },
        { align: 'end', label: String(NEWTAB_SHORTCUT_SIZE_MAX), percent: 100 }
      ],
      value: currentNewtabShortcutSize,
      valueSuffix: ' px'
    });
  }
  const newtabShortcutGapController =
    optionsSettingsControlsApi.createRangeSliderControlController(
      newtabShortcutGapControlHost,
      {
        kind: 'newtab-shortcut-gap',
        onInput(value) {
          const nextGap = normalizeNewtabShortcutGap(value);
          currentNewtabShortcutGap = nextGap;
          if (storageArea) {
            storageArea.set({ [NEWTAB_SHORTCUT_GAP_STORAGE_KEY]: nextGap });
          }
        }
      }
    );
  function renderNewtabShortcutGapControl(value, disabled) {
    if (!newtabShortcutGapController) {
      return;
    }
    currentNewtabShortcutGap = normalizeNewtabShortcutGap(value);
    const label = getMessage('settings_newtab_shortcut_gap_title', 'Shortcut spacing');
    newtabShortcutGapController.render({
      ariaLabel: label,
      defaultValue: NEWTAB_SHORTCUT_GAP_DEFAULT,
      disabled: Boolean(disabled),
      id: '_x_extension_newtab_shortcut_gap_slider_2026_unique_',
      min: NEWTAB_SHORTCUT_GAP_MIN,
      max: NEWTAB_SHORTCUT_GAP_MAX,
      resetAriaLabel: getMessage(
        'settings_newtab_shortcut_gap_reset',
        'Reset shortcut spacing'
      ),
      resetButtonId: '_x_extension_newtab_shortcut_gap_reset_2026_unique_',
      step: 1,
      ticks: [
        { align: 'start', label: '0', percent: 0 },
        { label: '8', percent: 100 / 3 },
        { label: '16', percent: 200 / 3 },
        { align: 'end', label: '24', percent: 100 }
      ],
      value: currentNewtabShortcutGap,
      valueSuffix: ' px'
    });
  }
  function syncNewtabShortcutSubcontrolAvailability() {
    const disabled = Boolean(newtabShortcutsToggle && !newtabShortcutsToggle.checked);
    [newtabShortcutAddToggle, newtabShortcutDockMagnificationToggle].forEach((toggle) => {
      if (toggle) {
        setOptionsToggleState(toggle, toggle.checked, disabled);
      }
    });
    [
      newtabShortcutAddRow,
      newtabShortcutDockMagnificationRow,
      newtabShortcutColumnsRow,
      newtabShortcutSizeRow,
      newtabShortcutGapRow
    ]
      .forEach((row) => {
        if (!row) {
          return;
        }
        row.setAttribute('data-disabled', disabled ? 'true' : 'false');
        row.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      });
    renderNewtabShortcutColumnsControl(currentNewtabShortcutColumns, disabled);
    renderNewtabShortcutSizeControl(currentNewtabShortcutSize, disabled);
    renderNewtabShortcutGapControl(currentNewtabShortcutGap, disabled);
  }
  const bookmarkRowsController =
    optionsSettingsControlsApi.createRangeSliderControlController(
      bookmarkRowsControlHost,
      {
        kind: 'bookmark-rows',
        onInput(value) {
          const nextCount = normalizeBookmarkCount(Number(value) * 4);
          currentBookmarkCount = nextCount;
          updateBookmarkColumnsSettingVisibility(nextCount);
          if (!storageArea) {
            return;
          }
          storageArea.set({ [BOOKMARK_COUNT_STORAGE_KEY]: nextCount });
          notifyNewtabSectionsRefresh('bookmarks');
        }
      }
    );
  function renderBookmarkRowsControl(value) {
    if (!bookmarkRowsController) {
      return;
    }
    currentBookmarkCount = normalizeBookmarkCount(value);
    bookmarkRowsController.render({
      ariaLabel: getMessage('settings_bookmarks_title', 'Bookmark rows'),
      id: '_x_extension_bookmark_rows_slider_2026_unique_',
      min: 0,
      max: 8,
      step: 1,
      ticks: [
        { align: 'start', label: '0' },
        { label: '4' },
        { align: 'end', label: '8' }
      ],
      value: currentBookmarkCount / 4
    });
  }
  const recentCountController =
    optionsSettingsControlsApi.createRangeSliderControlController(
      recentCountControlHost,
      {
        kind: 'recent-count',
        onInput(value) {
          const nextCount = normalizeRecentCount(Math.round(Number(value)) * 4);
          currentRecentCount = nextCount;
          updateRecentModeTabsVisibility(nextCount);
          if (!storageArea) {
            return;
          }
          storageArea.set({ [RECENT_COUNT_STORAGE_KEY]: nextCount });
          notifyNewtabSectionsRefresh('recent');
        }
      }
    );
  function renderRecentCountControl(value) {
    if (!recentCountController) {
      return;
    }
    currentRecentCount = normalizeRecentCount(value);
    recentCountController.render({
      ariaLabel: getMessage('settings_recent_sites_title', 'Recent site cards'),
      id: '_x_extension_recent_count_slider_2026_unique_',
      min: 0,
      max: 2,
      step: 1,
      ticks: [
        { align: 'start', label: '0' },
        { label: '1' },
        { align: 'end', label: '2' }
      ],
      value: currentRecentCount / 4
    });
  }
  const bookmarkColumnsController =
    optionsSettingsControlsApi.createRangeSliderControlController(
      bookmarkColumnsControlHost,
      {
        kind: 'bookmark-columns',
        onInput(value) {
          const nextColumns = normalizeBookmarkColumns(value);
          if (!storageArea) {
            return;
          }
          storageArea.set({ [BOOKMARK_COLUMNS_STORAGE_KEY]: nextColumns });
          notifyNewtabSectionsRefresh('bookmarks');
        }
      }
    );
  function renderBookmarkColumnsControl(value) {
    if (!bookmarkColumnsController) {
      return;
    }
    currentBookmarkColumns = normalizeBookmarkColumns(value);
    bookmarkColumnsController.render({
      ariaLabel: getMessage('settings_bookmark_columns_title', 'Bookmarks per row'),
      id: '_x_extension_bookmark_columns_slider_2026_unique_',
      min: 4,
      max: 8,
      step: 1,
      ticks: [
        { align: 'start', label: '4' },
        { label: '6' },
        { align: 'end', label: '8' }
      ],
      value: currentBookmarkColumns
    });
  }
  const searchResultDisplayLimitController =
    optionsSettingsControlsApi.createRangeSliderControlController(
      searchResultDisplayLimitControlHost,
      {
        kind: 'search-result-display-limit',
        onInput(value) {
          const nextLimit = normalizeSearchResultDisplayLimit(value);
          currentSearchResultDisplayLimit = nextLimit;
          if (storageArea) {
            storageArea.set({ [SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY]: nextLimit });
          }
        }
      }
    );
  function renderSearchResultDisplayLimitControl(value) {
    if (!searchResultDisplayLimitController) {
      return;
    }
    currentSearchResultDisplayLimit = normalizeSearchResultDisplayLimit(value);
    searchResultDisplayLimitController.render({
      ariaLabel: getMessage('settings_search_result_display_limit_title', 'Maximum Visible Results'),
      id: '_x_extension_search_result_display_limit_slider_2026_unique_',
      min: 5,
      max: 10,
      step: 1,
      ticks: [
        { align: 'start', label: '5' },
        { align: 'end', label: '10' }
      ],
      value: currentSearchResultDisplayLimit
    });
  }
  renderNewtabTimeFontWeightControl(NEWTAB_TIME_FONT_WEIGHT_DEFAULT);
  renderNewtabShortcutColumnsControl(NEWTAB_SHORTCUT_COLUMNS_DEFAULT, false);
  renderNewtabShortcutSizeControl(NEWTAB_SHORTCUT_SIZE_DEFAULT, false);
  renderNewtabShortcutGapControl(NEWTAB_SHORTCUT_GAP_DEFAULT, false);
  syncNewtabShortcutSubcontrolAvailability();
  renderRecentCountControl(4);
  renderBookmarkRowsControl(8);
  renderBookmarkColumnsControl(6);
  renderSearchResultDisplayLimitControl(10);
  syncSelectionQuickActionsProviderAvailability();
  const SETTINGS_TAB_KEYS = Object.freeze([
    'general',
    'account',
    'appearance',
    'shortcuts',
    'blacklist',
    'labs'
  ]);

  function migrateStorageIfNeeded(keys) {
    if (!storageArea || !localStorageArea || getActivePrimaryAreaName() === 'local') {
      return;
    }
    localStorageArea.get(keys, (localResult) => {
      const hasLocal = keys.some((key) => typeof localResult[key] !== 'undefined');
      if (!hasLocal) {
        return;
      }
      storageArea.get(keys, (syncResult) => {
        const missingSyncValues = {};
        keys.forEach((key) => {
          if (typeof localResult[key] !== 'undefined' && typeof syncResult[key] === 'undefined') {
            missingSyncValues[key] = localResult[key];
          }
        });
        // Grouped shortcuts move only as a whole save, never chunk by chunk.
        const [shortcutsHeadKey] = SETTINGS.NEWTAB_SHORTCUTS_V2_STORAGE_KEYS;
        SETTINGS.NEWTAB_SHORTCUTS_V2_STORAGE_KEYS.forEach((key) => {
          if (!Object.prototype.hasOwnProperty.call(missingSyncValues, shortcutsHeadKey)) {
            delete missingSyncValues[key];
          } else if (typeof localResult[key] !== 'undefined') {
            missingSyncValues[key] = localResult[key];
          }
        });
        const missingKeys = Object.keys(missingSyncValues);
        if (missingKeys.length === 0) {
          return;
        }
        storageArea.get(missingKeys, (latestSyncResult) => {
          const stillMissingSyncValues = {};
          missingKeys.forEach((key) => {
            if (typeof latestSyncResult[key] === 'undefined') {
              stillMissingSyncValues[key] = missingSyncValues[key];
            }
          });
          if (Object.keys(stillMissingSyncValues).length > 0) {
            storageArea.set(stillMissingSyncValues);
          }
        });
      });
    });
  }

  function getMessage(key, fallback) {
    if (currentMessages && Object.prototype.hasOwnProperty.call(currentMessages, key)) {
      const entry = currentMessages[key];
      if (entry && typeof entry.message === 'string') {
        return entry.message;
      }
    }
    if (currentLanguageMode !== 'system') {
      return fallback || '';
    }
    if (chrome && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key);
      if (message) {
        return message;
      }
    }
    return fallback || '';
  }

  function renderFeedbackSupport() {
    feedbackSupportSection.render();
  }

  renderFeedbackSupport();
  feedbackSupportSection.loadLinks();

  function formatTemplate(text, params) {
    return String(text || '').replace(/\{(\w+)\}/g, (match, key) => {
      if (params && Object.prototype.hasOwnProperty.call(params, key)) {
        return String(params[key]);
      }
      return match;
    });
  }

  function getSiteSearchFormRenderModel() {
    return {
      copy: {
        addLabel: getMessage('shortcuts_add', '添加自定义搜索'),
        aliasLabel: getMessage('shortcuts_label_alias', '别名'),
        aliasPlaceholder: getMessage(
          'shortcuts_placeholder_alias',
          '选填，例如 小破站、油管等'
        ),
        cancelLabel: getMessage('shortcuts_cancel', '取消'),
        categoryLabel: getMessage('shortcuts_label_display_group', '显示位置'),
        keyLabel: getMessage('shortcuts_label_key', '触发词'),
        keyPlaceholder: getMessage(
          'shortcuts_placeholder_required',
          '必填，如有多个用英文逗号分隔，如 jd,bili'
        ),
        nameLabel: getMessage('shortcuts_label_name', '显示名称'),
        namePlaceholder: getMessage(
          'shortcuts_placeholder_optional_default',
          '选填，默认使用触发词'
        ),
        queryInsertLabel: getMessage('shortcuts_insert_query', '插入查询变量'),
        searchEngineCategoryLabel: getMessage(
          'search_scope_group_engines',
          '搜索引擎'
        ),
        siteCategoryLabel: getMessage('search_scope_group_sites', '站内搜索'),
        templateHelp: getMessage(
          'shortcuts_template_help',
          '1.打开你想添加的网站\n2.输入任一搜索词，触发搜索\n3.将搜索结果页面 url 粘贴在此处\n4.将关键词替换为{query}'
        ),
        templateLabel: getMessage('shortcuts_label_template', '搜索模板'),
        templatePlaceholder: getMessage(
          'shortcuts_placeholder_template',
          'https://example.com/search?q={query}'
        )
      }
    };
  }

  function getBlacklistFormRenderModel(addKey, addFallback) {
    const modeCopy = [
      {
        labelFallback: '\u5f53\u524d\u9875\u9762',
        labelKey: 'blacklist_match_exact',
        mode: 'exact',
        tooltipFallback: '\u53ea\u5c4f\u853d\u8fd9\u4e00\u9875',
        tooltipKey: 'blacklist_match_exact_tooltip'
      },
      {
        labelFallback: '\u5f53\u524d\u7ad9\u70b9\u8def\u5f84',
        labelKey: 'blacklist_match_prefix',
        mode: 'prefix',
        tooltipFallback: '\u53ea\u5c4f\u853d\u8fd9\u4e2a\u7ad9\u70b9\u4e0b\u8fd9\u4e00\u8def\u5f84\u7684\u9875\u9762',
        tooltipKey: 'blacklist_match_prefix_tooltip'
      },
      {
        labelFallback: '\u6574\u4e2a\u7f51\u7ad9',
        labelKey: 'blacklist_match_suffix',
        mode: 'suffix',
        tooltipFallback: '\u5c4f\u853d\u8fd9\u4e2a\u7f51\u7ad9\u7684\u6240\u6709\u9875\u9762\uff0c\u4e5f\u5305\u62ec\u5b83\u7684\u5b50\u7f51\u7ad9',
        tooltipKey: 'blacklist_match_suffix_tooltip'
      }
    ];
    return {
      copy: {
        addLabel: getMessage(addKey, addFallback),
        cancelLabel: getMessage('shortcuts_cancel', '取消'),
        matchLabel: getMessage('blacklist_match_label', '匹配方式'),
        modes: modeCopy.map((item) => {
          const presentation = getBlacklistInputConfig([item.mode]);
          return {
            label: getMessage(item.labelKey, item.labelFallback),
            labelKey: item.labelKey,
            mode: item.mode,
            placeholder: getMessage(
              presentation.placeholderKey,
              presentation.placeholderFallback
            ),
            prefix: presentation.prefixText,
            tooltip: getMessage(item.tooltipKey, item.tooltipFallback),
            tooltipKey: item.tooltipKey,
            urlLabel: getMessage(
              presentation.labelKey,
              presentation.labelFallback
            ),
            urlLabelKey: presentation.labelKey
          };
        })
      }
    };
  }

  function renderSettingsForms() {
    if (siteSearchFormController) {
      siteSearchFormController.render(getSiteSearchFormRenderModel());
    }
    if (searchBlacklistFormController) {
      searchBlacklistFormController.render(
        getBlacklistFormRenderModel('blacklist_add', '\u6dfb\u52a0')
      );
    }
    if (faviconBlacklistFormController) {
      faviconBlacklistFormController.render(
        getBlacklistFormRenderModel(
          'favicon_blacklist_add',
          '\u6dfb\u52a0\u6392\u9664\u89c4\u5219'
        )
      );
    }
  }

  async function handleReactSiteSearchFormSave(draft) {
    suspendSiteSearchRefresh(260);
    const result = siteSearchModel.addCustomSiteSearchProvider(draft, {
      createId: () => createPersistentId('source'),
      custom: customSiteSearchProviders,
      disabledKeys: disabledSiteSearchKeys,
      hasKeyConflict: (key, allowedKey) => Boolean(findSiteSearchKeyConflict(key, allowedKey))
    });
    if (!result.ok) {
      return { ok: false, error: getSiteSearchErrorMessage(result.error) };
    }
    try {
      await saveSiteSearchProviderState(result.custom, result.disabledKeys);
      applySavedSiteSearchProviders(result.custom, result.disabledKeys);
      refreshSiteSearchProviders();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: getMessage('toast_error', '操作失败，请重试。') };
    }
  }

  function getSiteSearchErrorMessage(errorKey) {
    switch (errorKey) {
      case 'shortcuts_error_key':
        return getMessage('shortcuts_error_key', '请填写触发词。');
      case 'shortcuts_error_key_space':
        return getMessage('shortcuts_error_key_space', '触发词不能包含空格。');
      case 'shortcuts_error_key_duplicate':
        return getMessage('shortcuts_error_key_duplicate', '该触发词已存在，请更换。');
      case 'toast_error_template':
        return getMessage('toast_error_template', '搜索模板必须包含 {query}。');
      default:
        return getMessage('toast_error', '操作失败，请重试。');
    }
  }

  function applySavedSiteSearchProviders(custom, disabledKeys) {
    customSiteSearchProviders = custom;
    customSiteSearchProviderIdsReady = true;
    disabledSiteSearchKeys = disabledKeys;
    renderSiteSearchList();
    showToast(getMessage('toast_saved', '已保存'), false);
  }

  async function handleReactSearchBlacklistFormSave(value, modes) {
    const draft = buildBlacklistRuleDraft(value, modes);
    if (!draft.item) {
      return { ok: false, error: draft.error || '' };
    }
    try {
      await persistBlacklistItems(
        upsertBlacklistItems(draft.item, ''),
        getMessage('toast_saved', '已保存')
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: getMessage('toast_error', '操作失败，请重试。') };
    }
  }

  async function handleReactFaviconBlacklistFormSave(value, modes) {
    const draft = buildBlacklistRuleDraft(value, modes);
    if (!draft.item) {
      return { ok: false, error: draft.error || '' };
    }
    const nextKey = buildBlacklistItemKey(draft.item);
    const nextItems = [draft.item].concat(
      faviconRequestBlacklistItems.filter(
        (item) => buildBlacklistItemKey(item) !== nextKey
      )
    );
    try {
      faviconRequestBlacklistItems = await saveFaviconRequestBlacklistItems(nextItems);
      renderFaviconRequestBlacklistList();
      showToast(getMessage('toast_saved', '已保存'), false);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: getMessage('toast_error', '操作失败，请重试。') };
    }
  }

  function normalizeBookmarkCount(value) {
    return SETTINGS.normalizeBookmarkCount(value);
  }

  function normalizeRecentCount(value) {
    const parsed = Number.parseInt(value, 10);
    if (parsed === 0 || parsed === 4 || parsed === 8) {
      return parsed;
    }
    return 4;
  }

  function resetBlacklistForm() {
    searchBlacklistFormController?.reset();
  }

  function resetFaviconBlacklistForm() {
    faviconBlacklistFormController?.reset();
  }

  function setFaviconBlacklistEditorEnabled(enabled) {
    const editable = enabled === true;
    if (!faviconBlacklistEditor) {
      return;
    }
    faviconBlacklistEditor.setAttribute('aria-disabled', editable ? 'false' : 'true');
    faviconBlacklistEditor.inert = !editable;
    if (editable) {
      faviconBlacklistEditor.removeAttribute('inert');
    } else {
      faviconBlacklistEditor.setAttribute('inert', '');
      resetFaviconBlacklistForm();
    }
  }

  function getBlacklistMatchBadgeConfig(modes) {
    const tone = blacklistModel.getMatchTone(modes);
    if (tone === 'exact') {
      return { tone, text: getMessage('blacklist_match_exact', '当前页面') };
    }
    if (tone === 'suffix') {
      return { tone, text: getMessage('blacklist_match_suffix', '整个网站') };
    }
    return { tone, text: getMessage('blacklist_match_prefix', '当前站点路径') };
  }

  function buildBlacklistRuleDraft(inputValue, matchModes) {
    const draft = blacklistModel.buildRuleDraft(inputValue, matchModes);
    if (draft.item) {
      return draft;
    }
    if (draft.error === 'blacklist_error_match_mode') {
      return { error: getMessage('blacklist_error_match_mode', '请选择至少一种匹配方式') };
    }
    return {
      error: draft.error === 'blacklist_error_domain'
        ? getMessage('blacklist_error_domain', '请输入网站域名。')
        : getMessage('blacklist_error_url', '请输入站点域名或完整 URL。')
    };
  }

  function upsertBlacklistItems(nextItem, replacedRuleKey) {
    return blacklistModel.upsertItems(searchBlacklistItems, nextItem, replacedRuleKey);
  }

  function persistBlacklistItems(nextItems, successMessage) {
    return saveSearchBlacklistItems(nextItems).then((savedItems) => {
      searchBlacklistItems = savedItems;
      renderSearchBlacklistList();
      notifyNewtabSectionsRefresh('recent');
      if (successMessage) {
        showToast(successMessage, false);
      }
      return savedItems;
    });
  }

  function normalizeBookmarkColumns(value) {
    return SETTINGS.normalizeBookmarkColumns(value);
  }

  function normalizeNewtabWidthMode(value) {
    return SETTINGS.normalizeNewtabWidthMode(value);
  }

  function normalizeOverlaySizeMode(value) {
    return SETTINGS.normalizeOverlaySizeMode(value);
  }

  function normalizeOverlayEnterAnimation(value) {
    return SETTINGS.normalizeOverlayEnterAnimation(value);
  }

  function updateBookmarkColumnsSettingVisibility(countValue) {
    if (!bookmarkColumnsSettingRow) {
      return;
    }
    const parsed = Number.parseInt(countValue, 10);
    const shouldHide = Number.isFinite(parsed) ? parsed <= 0 : false;
    animateOptionsPanelHeight(() => {
      const columnsChanged = setConditionalSettingsElementVisibility(bookmarkColumnsSettingRow, !shouldHide);
      const folderIconsChanged = setConditionalSettingsElementVisibility(bookmarkFolderIconsVisibleRow, !shouldHide);
      return columnsChanged || folderIconsChanged;
    });
  }

  function normalizeNewtabTopContentMode(value) {
    return SETTINGS.normalizeNewtabTopContentMode(value);
  }

  function normalizeNewtabTimeFontWeight(value) {
    return SETTINGS.normalizeNewtabTimeFontWeight(value);
  }

  function normalizeNewtabShortcutsVisible(value) {
    return SETTINGS.normalizeNewtabShortcutsVisible(value);
  }

  function normalizeNewtabShortcutAddVisible(value) {
    return SETTINGS.normalizeNewtabShortcutAddVisible(value);
  }

  function normalizeNewtabShortcutDockMagnificationEnabled(value) {
    return SETTINGS.normalizeNewtabShortcutDockMagnificationEnabled(value);
  }

  function normalizeNewtabShortcutColumns(value) {
    return SETTINGS.normalizeNewtabShortcutColumns(value, {
      min: NEWTAB_SHORTCUT_COLUMNS_MIN,
      max: NEWTAB_SHORTCUT_COLUMNS_MAX,
      fallback: NEWTAB_SHORTCUT_COLUMNS_DEFAULT
    });
  }

  function normalizeNewtabShortcutSize(value) {
    return SETTINGS.normalizeNewtabShortcutSize(value, {
      min: NEWTAB_SHORTCUT_SIZE_MIN,
      max: NEWTAB_SHORTCUT_SIZE_MAX,
      fallback: NEWTAB_SHORTCUT_SIZE_DEFAULT
    });
  }

  function normalizeNewtabShortcutGap(value) {
    return SETTINGS.normalizeNewtabShortcutGap(value, {
      min: NEWTAB_SHORTCUT_GAP_MIN,
      max: NEWTAB_SHORTCUT_GAP_MAX,
      fallback: NEWTAB_SHORTCUT_GAP_DEFAULT
    });
  }

  function inferNewtabShortcutColumnsFromWidth(value) {
    return SETTINGS.inferNewtabShortcutColumnsFromWidth(value, {
      widthMin: NEWTAB_SHORTCUT_WIDTH_MIN,
      widthMax: NEWTAB_SHORTCUT_WIDTH_MAX,
      columnsMin: NEWTAB_SHORTCUT_COLUMNS_MIN,
      columnsMax: NEWTAB_SHORTCUT_COLUMNS_MAX
    });
  }

  function normalizeAggregateSearchAutoGroupEnabled(value) {
    return SETTINGS.normalizeAggregateSearchAutoGroupEnabled(value);
  }

  function normalizeSearchResultPriority(value) {
    return SETTINGS.normalizeSearchResultPriority(value);
  }

  function normalizeSearchResultDisplayLimit(value) {
    return SETTINGS.normalizeSearchResultDisplayLimit(value);
  }

  function normalizeSearchResultSourceTypes(value) {
    return SETTINGS.normalizeSearchResultSourceTypes(value);
  }

  function collectCheckedSearchResultSourceTypes() {
    const checked = [];
    searchResultSourceTypeInputs.forEach((input) => {
      if (!input || !input.checked) {
        return;
      }
      checked.push(input.getAttribute('data-search-result-source-type'));
    });
    return checked.filter(Boolean);
  }

  function setSearchResultSourceTypeState(value) {
    const normalized = normalizeSearchResultSourceTypes(value);
    const selected = new Set(normalized);
    searchResultSourceTypeInputs.forEach((input) => {
      const type = input.getAttribute('data-search-result-source-type');
      input.checked = selected.has(type);
    });
    renderSearchResultSourceTypeControl(normalized);
  }

  function persistSearchResultSourceTypes(value) {
    const normalized = normalizeSearchResultSourceTypes(value);
    setSearchResultSourceTypeState(normalized);
    if (!storageArea) {
      return;
    }
    storageArea.set({ [SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY]: normalized });
  }

  function renderSegmentedControlState(
    controller,
    model
  ) {
    controller.render(model);
  }

  function setRecentModeTabState(mode) {
    const nextMode = mode === 'most' ? 'most' : 'latest';
    currentRecentMode = nextMode;
    renderSegmentedControlState(
      recentModeTabsController,
      {
        activeValue: nextMode,
        dataAttribute: 'data-recent-mode',
        items: [
          {
            value: 'latest',
            labelKey: 'recent_mode_latest',
            label: getMessage('recent_mode_latest', '最近访问')
          },
          {
            value: 'most',
            labelKey: 'recent_mode_most',
            label: getMessage('recent_mode_most', '最常访问')
          }
        ],
        select: {
          id: '_x_extension_recent_mode_select_2024_unique_'
        }
      },
      recentModeTabButtons,
      'data-recent-mode',
      (value) => value === 'most' ? 'most' : 'latest'
    );
  }

  function setOverlaySizeTabState(mode) {
    const nextMode = normalizeOverlaySizeMode(mode);
    currentOverlaySizeMode = nextMode;
    renderSegmentedControlState(
      overlaySizeTabsController,
      {
        activeValue: nextMode,
        dataAttribute: 'data-overlay-size',
        items: [
          {
            value: 'compact',
            labelKey: 'overlay_size_compact',
            label: getMessage('overlay_size_compact', '小')
          },
          {
            value: 'standard',
            labelKey: 'overlay_size_standard',
            label: getMessage('overlay_size_standard', '标准')
          },
          {
            value: 'large',
            labelKey: 'overlay_size_large',
            label: getMessage('overlay_size_large', '大')
          }
        ]
      },
      overlaySizeTabButtons,
      'data-overlay-size',
      normalizeOverlaySizeMode
    );
  }

  function setOverlayEnterAnimationTabState(mode) {
    const nextMode = normalizeOverlayEnterAnimation(mode);
    currentOverlayEnterAnimation = nextMode;
    renderSegmentedControlState(
      overlayEnterAnimationTabsController,
      {
        activeValue: nextMode,
        dataAttribute: 'data-overlay-enter-animation',
        items: [
          {
            value: 'elastic',
            labelKey: 'overlay_enter_animation_elastic',
            label: getMessage('overlay_enter_animation_elastic', '弹性')
          },
          {
            value: 'fade',
            labelKey: 'overlay_enter_animation_fade',
            label: getMessage('overlay_enter_animation_fade', '淡入')
          }
        ]
      }
    );
  }

  function setNewtabWidthTabState(mode) {
    const nextMode = normalizeNewtabWidthMode(mode);
    currentNewtabWidthMode = nextMode;
    renderSegmentedControlState(
      newtabWidthTabsController,
      {
        activeValue: nextMode,
        dataAttribute: 'data-newtab-width',
        items: [
          {
            value: 'standard',
            labelKey: 'newtab_width_standard',
            label: getMessage('newtab_width_standard', '标准')
          },
          {
            value: 'wide',
            labelKey: 'newtab_width_wide',
            label: getMessage('newtab_width_wide', '宽屏（推荐）')
          }
        ],
        select: {
          id: '_x_extension_newtab_width_select_2026_unique_'
        }
      },
      newtabWidthTabButtons,
      'data-newtab-width',
      normalizeNewtabWidthMode
    );
  }

  function setNewtabTopContentTabState(mode) {
    const nextMode = normalizeNewtabTopContentMode(mode);
    currentNewtabTopContentMode = nextMode;
    renderSegmentedControlState(
      newtabTopContentTabsController,
      {
        activeValue: nextMode,
        dataAttribute: 'data-newtab-top-content',
        items: [
          {
            value: 'brand',
            labelKey: 'newtab_top_content_brand',
            label: getMessage('newtab_top_content_brand', '品牌标识')
          },
          {
            value: 'time',
            labelKey: 'newtab_top_content_time',
            label: getMessage('newtab_top_content_time', '时间')
          },
          {
            value: 'off',
            labelKey: 'newtab_top_content_off',
            label: getMessage('newtab_top_content_off', '隐藏')
          }
        ]
      }
    );
    syncNewtabTimeSecondsVisibility();
  }

  function syncNewtabTimeSecondsVisibility() {
    const visible = currentNewtabTopContentMode === 'time';
    animateOptionsPanelHeight(() => {
      let changed = false;
      [newtabTimeFontWeightRow, newtabTimeSecondsRow].forEach((row) => {
        changed = setConditionalSettingsElementVisibility(row, visible) || changed;
      });
      return changed;
    });
  }

  function updateRecentModeTabsVisibility(countValue) {
    if (!recentModeTabsWrap) {
      return;
    }
    const parsed = Number.parseInt(countValue, 10);
    const shouldHide = Number.isFinite(parsed) ? parsed <= 0 : false;
    animateOptionsPanelHeight(() =>
      setConditionalSettingsElementVisibility(recentModeTabsWrap, !shouldHide, 'flex')
    );
    if (!shouldHide) {
      requestAnimationFrame(() => {
      });
    }
  }

  function setRestrictedActionTabState(action) {
    const nextAction = action === 'none' ? 'none' : 'default';
    currentRestrictedAction = nextAction;
    renderSegmentedControlState(
      restrictedActionTabsController,
      {
        activeValue: nextAction,
        dataAttribute: 'data-restricted-action',
        items: [
          {
            value: 'default',
            labelKey: 'restricted_action_default',
            label: getMessage('restricted_action_default', '前往 Lumno 新标签页')
          },
          {
            value: 'none',
            labelKey: 'restricted_action_none',
            label: getMessage('restricted_action_none', '遵循浏览器设置')
          }
        ],
        select: {
          id: '_x_extension_restricted_action_select_2024_unique_'
        }
      },
      restrictedActionTabButtons,
      'data-restricted-action',
      (value) => value === 'none' ? 'none' : 'default'
    );
  }

  function createRestrictedActionStorageUpdate(action) {
    return {
      [RESTRICTED_ACTION_STORAGE_KEY]: action === 'none' ? 'none' : 'default',
      [RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY]: true
    };
  }

  function setSearchResultPriorityTabState(priority) {
    const nextPriority = normalizeSearchResultPriority(priority);
    currentSearchResultPriority = nextPriority;
    renderSegmentedControlState(
      searchResultPriorityTabsController,
      {
        activeValue: nextPriority,
        dataAttribute: 'data-search-result-priority',
        items: [
          {
            value: 'autocomplete',
            labelKey: 'search_result_priority_autocomplete',
            label: getMessage('search_result_priority_autocomplete', '补全优先')
          },
          {
            value: 'search',
            labelKey: 'search_result_priority_search',
            label: getMessage('search_result_priority_search', '搜索优先')
          }
        ],
        select: {
          id: '_x_extension_search_result_priority_select_2026_unique_'
        }
      },
      searchResultPriorityTabButtons,
      'data-search-result-priority',
      normalizeSearchResultPriority
    );
  }

  function handleNewtabWidthSelection(value) {
    const nextMode = normalizeNewtabWidthMode(value);
    setNewtabWidthTabState(nextMode);
    if (newtabWidthSelect) {
      newtabWidthSelect.value = nextMode;
    }
    if (!storageArea) {
      return;
    }
    storageArea.set({ [NEWTAB_WIDTH_MODE_STORAGE_KEY]: nextMode });
    notifyNewtabSectionsRefresh('all');
  }

  function handleOverlaySizeSelection(value) {
    const nextMode = normalizeOverlaySizeMode(value);
    setOverlaySizeTabState(nextMode);
    if (!storageArea) {
      return;
    }
    storageArea.set({ [OVERLAY_SIZE_MODE_STORAGE_KEY]: nextMode });
  }

  function handleOverlayEnterAnimationSelection(value) {
    const nextMode = normalizeOverlayEnterAnimation(value);
    setOverlayEnterAnimationTabState(nextMode);
    if (!storageArea) {
      return;
    }
    storageArea.set({ [OVERLAY_ENTER_ANIMATION_STORAGE_KEY]: nextMode });
  }

  function handleSearchResultPrioritySelection(value) {
    const nextPriority = normalizeSearchResultPriority(value);
    setSearchResultPriorityTabState(nextPriority);
    if (searchResultPrioritySelect) {
      searchResultPrioritySelect.value = nextPriority;
    }
    if (!storageArea) {
      return;
    }
    storageArea.set({ [SEARCH_RESULT_PRIORITY_STORAGE_KEY]: nextPriority });
  }

  function handleNewtabTopContentSelection(value) {
    const nextMode = normalizeNewtabTopContentMode(value);
    setNewtabTopContentTabState(nextMode);
    if (!storageArea) {
      return;
    }
    storageArea.set({ [NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY]: nextMode });
  }

  function handleRecentModeSelection(value) {
    const nextMode = value === 'most' ? 'most' : 'latest';
    setRecentModeTabState(nextMode);
    if (recentModeSelect) {
      recentModeSelect.value = nextMode;
    }
    if (!storageArea) {
      return;
    }
    storageArea.set({ [RECENT_MODE_STORAGE_KEY]: nextMode });
    notifyNewtabSectionsRefresh('recent');
  }

  function handleRestrictedActionSelection(value) {
    const nextAction = value === 'none' ? 'none' : 'default';
    setRestrictedActionTabState(nextAction);
    if (restrictedActionSelect) {
      restrictedActionSelect.value = nextAction;
    }
    if (!storageArea) {
      return;
    }
    storageArea.set(createRestrictedActionStorageUpdate(nextAction));
  }

  setNewtabWidthTabState(currentNewtabWidthMode);
  setOverlaySizeTabState(currentOverlaySizeMode);
  setOverlayEnterAnimationTabState(currentOverlayEnterAnimation);
  setSearchResultPriorityTabState(currentSearchResultPriority);
  setRecentModeTabState(currentRecentMode);
  setRestrictedActionTabState(currentRestrictedAction);
  setNewtabTopContentTabState(currentNewtabTopContentMode);

  function notifyNewtabSectionsRefresh(section) {
    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    try {
      chrome.runtime.sendMessage(
        { action: 'lumno:newtab-refresh-sections', section: section || 'all' },
        () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            return;
          }
        }
      );
    } catch (error) {
      // Ignore runtime messaging errors.
    }
  }

  function applyI18n() {
    if (webDavSettingsController) webDavSettingsController.render();
    popconfirmLanguageRefreshers.forEach((refresh) => refresh());
    const browserName = globalThis.LumnoBrowserProfile?.getBrowserInternalProfile(navigator).name || 'Chrome';
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (!key) {
        return;
      }
      const fallback = node.textContent || '';
      const rawMessage = getMessage(key, fallback);
      const message = formatTemplate(rawMessage, {
        name: 'Lumno',
        browser: browserName,
        shortcut: formatShortcutForDisplay('Alt+Q') || (isMacPlatform ? '⌥Q' : 'Alt+Q')
      });
      node.textContent = message;
      if (node.tagName === 'OPTION') {
        node.label = message;
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      const key = node.getAttribute('data-i18n-placeholder');
      if (!key) {
        return;
      }
      const fallback = node.getAttribute('placeholder') || '';
      const message = getMessage(key, fallback);
      node.setAttribute('placeholder', message);
    });
    document.querySelectorAll('[data-i18n-tooltip]').forEach((node) => {
      const key = node.getAttribute('data-i18n-tooltip');
      if (!key) {
        return;
      }
      const fallback = node.getAttribute('data-tooltip') || '';
      const message = getMessage(key, fallback);
      node.setAttribute('data-tooltip', message);
      if (node.getAttribute('title')) {
        node.removeAttribute('title');
      }
      if (node.getAttribute('aria-label')) {
        node.setAttribute('aria-label', message);
      }
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
      const key = node.getAttribute('data-i18n-aria-label');
      if (!key) {
        return;
      }
      const fallback = node.getAttribute('aria-label') || '';
      const message = getMessage(key, fallback);
      node.setAttribute('aria-label', message);
    });
    if (fallbackShortcutInput && fallbackShortcutTokens) {
      fallbackShortcutTokens.setAttribute('data-placeholder', fallbackShortcutInput.getAttribute('placeholder') || '');
      renderFallbackShortcutTokens(currentShortcutLabel || '');
    }
  }

  function showTooltipFor(target) {
    if (!target) {
      return;
    }
    const text = target.getAttribute('data-tooltip');
    if (!text) {
      return;
    }
    tooltipController.show(target, text, {
      maxWidth: 'min(360px, calc(100vw - 24px))',
      spacing: 8
    });
  }

  function initTooltips() {
    const nodes = Array.from(document.querySelectorAll('[data-tooltip]'));
    nodes.forEach((node) => {
      tooltipController.bind(node, () => node.getAttribute('data-tooltip'), {
        maxWidth: 'min(360px, calc(100vw - 24px))',
        spacing: 8
      });
    });
  }

  function refreshCustomSelects(options) {
    const config = options && typeof options === 'object' ? options : {};
    if ((optionsStartupStorageBatchPending || optionsStartupRefreshCoalescing) && !config.force) {
      optionsStartupRefreshDeferred = true;
      return;
    }
    optionsCustomSelectRefreshCount += 1;
    if (document.documentElement) {
      document.documentElement.setAttribute(
        'data-lumno-options-control-refreshes',
        String(optionsCustomSelectRefreshCount)
      );
    }
    renderSettingsForms();
    optionsSelectControlRecords.forEach((record, select) => {
      renderOptionsSelectControl(select);
    });
    syncFallbackShortcutWrapWidth();
  }

  function syncFallbackShortcutWrapWidth() {
    if (!fallbackShortcutWrap || !restrictedActionSelectWrap) {
      return;
    }
    const width = Math.round(restrictedActionSelectWrap.getBoundingClientRect().width);
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    fallbackShortcutBaseWidth = width;
    updateFallbackShortcutWrapWidthForContent();
  }

  function updateFallbackShortcutWrapWidthForContent() {
    if (!fallbackShortcutWrap) {
      return;
    }
    const fallbackBase = Math.max(120, Number.isFinite(fallbackShortcutBaseWidth) ? fallbackShortcutBaseWidth : 0);
    let nextWidth = fallbackBase || Math.round(fallbackShortcutWrap.getBoundingClientRect().width) || 180;
    if (fallbackShortcutTokens) {
      const tokenEls = Array.from(fallbackShortcutTokens.children || []);
      if (tokenEls.length > 0) {
        const style = window.getComputedStyle(fallbackShortcutTokens);
        const gap = Number.parseFloat(style.columnGap || style.gap) || 0;
        const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
        const paddingRight = Number.parseFloat(style.paddingRight) || 0;
        const contentWidth = tokenEls.reduce((sum, el) => sum + Math.ceil(el.getBoundingClientRect().width), 0)
          + Math.max(0, tokenEls.length - 1) * gap;
        const requiredWidth = Math.ceil(contentWidth + paddingLeft + paddingRight + 2);
        nextWidth = Math.max(nextWidth, requiredWidth);
      }
    }
    fallbackShortcutWrap.style.width = `${nextWidth}px`;
    if (!isFallbackWidthReady) {
      requestAnimationFrame(() => {
        isFallbackWidthReady = true;
        if (fallbackShortcutWrap) {
          fallbackShortcutWrap.setAttribute('data-width-ready', 'true');
        }
      });
    }
  }

  function updateBuiltinResetTooltip() {
    if (!builtinResetButton) {
      return;
    }
    const text = getMessage('shortcuts_reset_builtin', '重置为初始列表');
    builtinResetButton.removeAttribute('title');
    builtinResetButton.setAttribute('aria-label', text);
    builtinResetButton.setAttribute('data-tooltip', text);
  }

  function updateCustomClearTooltip() {
    if (!customClearButton) {
      return;
    }
    const text = getMessage('shortcuts_clear_custom', '清空自定义');
    customClearButton.removeAttribute('title');
    customClearButton.setAttribute('aria-label', text);
    customClearButton.setAttribute('data-tooltip', text);
  }

  function updateAggregateSearchClearTooltip() {
    if (!aggregateSearchClearButton) {
      return;
    }
    const text = getMessage('aggregate_search_clear', '清空聚合搜索');
    aggregateSearchClearButton.removeAttribute('title');
    aggregateSearchClearButton.setAttribute('aria-label', text);
    aggregateSearchClearButton.setAttribute('data-tooltip', text);
  }

  function updateBlacklistClearTooltip() {
    if (!blacklistClearButton) {
      return;
    }
    const text = getMessage('blacklist_clear', '清空黑名单');
    blacklistClearButton.removeAttribute('title');
    blacklistClearButton.setAttribute('aria-label', text);
    blacklistClearButton.setAttribute('data-tooltip', text);
  }

  function setToastAnnouncement(errorToast) {
    if (toastElement) {
      toastElement.setAttribute('role', errorToast ? 'alert' : 'status');
      toastElement.setAttribute('aria-live', errorToast ? 'assertive' : 'polite');
      toastElement.setAttribute('aria-atomic', 'true');
    }
  }

  function showToast(message, isError) {
    const errorToast = Boolean(isError);
    setToastAnnouncement(errorToast);
    toastController.show(message, {
      error: errorToast
    });
  }

  // A task that may run long: its loading Toast turns into the result in place.
  function beginToast(message) {
    setToastAnnouncement(false);
    const task = toastController.begin(message);
    return {
      done(result) {
        setToastAnnouncement(false);
        task.done(result);
      },
      fail(result) {
        setToastAnnouncement(true);
        task.fail(result);
      },
      cancel() {
        task.cancel();
      }
    };
  }

  function setSyncButtonEnabled(button, enabled) {
    if (!button) {
      return;
    }
    const isEnabled = enabled === true;
    button.disabled = !isEnabled;
    button.setAttribute('data-disabled', isEnabled ? 'false' : 'true');
  }

  function formatSyncTime(timestamp) {
    if (!timestamp) {
      return '';
    }
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return '';
    }
  }

  function updateSyncStatusText(statusKey, fallback, params) {
    if (!syncStatus) {
      return;
    }
    let statusStyle = '';
    let tooltipKey = 'sync_status_hint';
    if (statusKey === 'sync_status_ready' || statusKey === 'sync_status_done') {
      statusStyle = 'success';
      tooltipKey = 'sync_status_hint';
    } else if (statusKey === 'sync_status_failed' || statusKey === 'sync_status_failed_reason' || statusKey === 'sync_status_unavailable') {
      statusStyle = 'danger';
      tooltipKey = 'sync_status_unavailable_hint';
    }
    if (statusStyle) {
      syncStatus.setAttribute('data-status', statusStyle);
    } else {
      syncStatus.removeAttribute('data-status');
    }
    if (syncStatus.hasAttribute('data-i18n-tooltip')) {
      syncStatus.setAttribute('data-i18n-tooltip', tooltipKey);
    }
    syncStatus.setAttribute('data-tooltip', getMessage(tooltipKey, syncStatus.getAttribute('data-tooltip') || ''));
    const template = getMessage(statusKey, fallback);
    const target = syncStatusText || syncStatus;
    target.textContent = params ? formatTemplate(template, params) : template;
  }

  function updateSyncNowTooltip(timeText) {
    if (!syncNowButton) {
      return;
    }
    if (!timeText) {
      syncNowButton.setAttribute('data-tooltip', getMessage('sync_tooltip_default', '手动同步'));
      return;
    }
    const template = getMessage('sync_tooltip_last_manual', '最近导入/手动同步 {time}');
    syncNowButton.setAttribute('data-tooltip', formatTemplate(template, { time: timeText }));
    if (syncNowButton.matches(':hover') || syncNowButton.matches(':focus')) {
      showTooltipFor(syncNowButton);
    }
  }

  // Says how many New Tab shortcuts browser sync carries and where the
  // rest are kept, since what does not fit stays on this device or goes
  // through WebDAV.
  let shortcutSyncSummaryRevision = 0;
  function refreshShortcutSyncSummary() {
    const store = globalThis.LumnoNewtabShortcutsStore;
    if (!shortcutSyncSummary || !store || !storageArea || getActivePrimaryAreaName() !== 'sync' ||
        !localStorageArea) {
      if (shortcutSyncSummary) shortcutSyncSummary.hidden = true;
      return;
    }
    const revision = ++shortcutSyncSummaryRevision;
    storageArea.get(store.SHORTCUT_STORAGE_KEYS.slice(), (values) => {
      localStorageArea.get([store.SHORTCUTS_LOCAL_OVERFLOW_KEY, SETTINGS.WEBDAV_STATUS_STORAGE_KEY], (local) => {
        if (revision !== shortcutSyncSummaryRevision) return;
        const summary = store.summarizeShortcutSync(values || {}, local && local[store.SHORTCUTS_LOCAL_OVERFLOW_KEY]);
        const webdavStatus = local && local[SETTINGS.WEBDAV_STATUS_STORAGE_KEY];
        const webdav = Boolean(webdavStatus && webdavStatus.enabled === true);
        let text = '';
        if (summary.total <= 0) {
          text = '';
        } else if (summary.syncFailed) {
          text = formatTemplate(webdav
            ? getMessage('options_shortcut_sync_failed_webdav', 'Shortcuts couldn’t be saved to browser sync; all {count} sync through WebDAV for now.')
            : getMessage('options_shortcut_sync_failed_local', 'Shortcuts couldn’t be saved to browser sync; all {count} stay on this device for now.'),
          { count: summary.total });
        } else if (!summary.synced) {
          text = formatTemplate(webdav
            ? getMessage('options_shortcut_sync_none_webdav', 'Shortcuts: browser sync is full, so all {count} sync through WebDAV.')
            : getMessage('options_shortcut_sync_none_local', 'Shortcuts: browser sync is full, so all {count} stay on this device. Turn on WebDAV to sync them.'),
          { count: summary.total });
        } else if (!summary.localOnly) {
          text = formatTemplate(getMessage('options_shortcut_sync_all', 'Shortcuts: all {count} sync with the browser.'),
            { count: summary.total });
        } else {
          text = formatTemplate(webdav
            ? getMessage('options_shortcut_sync_split_webdav', 'Shortcuts: {synced} sync with the browser; the other {local} sync through WebDAV.')
            : getMessage('options_shortcut_sync_split_local', 'Shortcuts: {synced} sync with the browser; {local} exceed its sync space and stay on this device. Turn on WebDAV to sync them too.'),
          { synced: summary.synced, local: summary.localOnly });
        }
        shortcutSyncSummary.textContent = text;
        shortcutSyncSummary.hidden = !text;
      });
    });
  }

  function refreshSyncStatus() {
    refreshShortcutSyncSummary();
    if (!syncStatus) {
      return;
    }
    if (!storageArea) {
      updateSyncStatusText('sync_status_unavailable', '同步不可用');
      setSyncButtonEnabled(syncNowButton, false);
      setSyncButtonEnabled(syncExportButton, false);
      setSyncButtonEnabled(syncImportButton, false);
      return;
    }
    setSyncButtonEnabled(syncNowButton, true);
    setSyncButtonEnabled(syncExportButton, true);
    setSyncButtonEnabled(syncImportButton, true);
    updateSyncStatusText('sync_status_ready', '同步已开启');
    // The last-sync time describes the browser's own sync service.
    (chrome.storage.sync || storageArea).get([SYNC_META_STORAGE_KEY], (result) => {
      const meta = result ? result[SYNC_META_STORAGE_KEY] : null;
      const lastSyncAt = meta && meta.lastSyncAt ? meta.lastSyncAt : '';
      updateSyncNowTooltip(lastSyncAt ? formatSyncTime(lastSyncAt) : '');
    });
  }

  storageChanges.on(SETTINGS.WEBDAV_STATUS_STORAGE_KEY, refreshSyncStatus, { area: 'local' });
  storageChanges.on(
    globalThis.LumnoNewtabShortcutsStore && globalThis.LumnoNewtabShortcutsStore.SHORTCUTS_LOCAL_OVERFLOW_KEY,
    refreshShortcutSyncSummary,
    { area: 'local' }
  );
  storageChanges.on([SYNC_META_STORAGE_KEY, ...SYNC_KEYS], refreshSyncStatus);

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function closeActivePopconfirm() {
    if (activePopconfirm) {
      const popconfirm = activePopconfirm;
      const closePopconfirm = popconfirm._xOptionsClosePopconfirm;
      if (typeof closePopconfirm === 'function') {
        closePopconfirm();
      } else {
        popconfirm.setAttribute('data-open', 'false');
        activePopconfirm = null;
      }
    }
  }

  // A clear-all action has nothing to confirm on an empty list.
  function syncClearButtonAvailability(button, hasItems) {
    if (!button) {
      return;
    }
    const disabled = !hasItems;
    if (button.disabled === disabled) {
      return;
    }
    button.disabled = disabled;
    const popconfirm = button.getAttribute('aria-controls')
      ? document.getElementById(button.getAttribute('aria-controls'))
      : null;
    if (disabled && popconfirm && popconfirm === activePopconfirm) {
      closeActivePopconfirm();
    }
  }

  function initializePopconfirmWrap(wrap, trigger, messageKey, fallbackMessage, onConfirm) {
    if (!wrap || !trigger) {
      return null;
    }
    const reactApi = typeof optionsPopconfirmApi !== 'undefined'
      ? optionsPopconfirmApi
      : {};
    wrap.className = '_x_extension_popconfirm_wrap_2024_unique_';
    const popconfirm = document.createElement('div');
    popconfirm.className = '_x_extension_popconfirm_2024_unique_';
    popconfirm.setAttribute('data-open', 'false');
    wrap.appendChild(trigger);
    wrap.appendChild(popconfirm);

    let popconfirmController = null;

    function getPopconfirmRenderModel(open) {
      return {
        open: Boolean(open),
        messageKey,
        message: getMessage(messageKey, fallbackMessage),
        cancelLabel: getMessage('confirm_cancel', '取消'),
        confirmLabel: getMessage('confirm_ok', '确认')
      };
    }

    function setPopconfirmOpen(open) {
      const nextOpen = Boolean(open);
      popconfirmController.render(getPopconfirmRenderModel(nextOpen));
      trigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    }

    function closePopconfirm(closeOptions) {
      const shouldRestoreFocus = Boolean(closeOptions && closeOptions.restoreFocus);
      setPopconfirmOpen(false);
      if (activePopconfirm === popconfirm) {
        activePopconfirm = null;
      }
      if (shouldRestoreFocus && trigger.isConnected && typeof trigger.focus === 'function') {
        trigger.focus({ preventScroll: true });
      }
    }
    popconfirm._xOptionsClosePopconfirm = closePopconfirm;

    popconfirmController = reactApi.createPopconfirmController(popconfirm, {
      onCancel() {
        closePopconfirm({ restoreFocus: true });
      },
      onConfirm() {
        closePopconfirm({ restoreFocus: true });
        if (typeof onConfirm === 'function') {
          onConfirm();
        }
      }
    });
    const refreshPopconfirmLanguage = () => {
      popconfirmController.render(getPopconfirmRenderModel(popconfirm.getAttribute('data-open') === 'true'));
    };
    popconfirmLanguageRefreshers.add(refreshPopconfirmLanguage);
    popconfirm._xOptionsDestroyPopconfirm = () => {
      closePopconfirm();
      popconfirmLanguageRefreshers.delete(refreshPopconfirmLanguage);
      popconfirmController.destroy();
      popconfirmController = null;
    };
    setPopconfirmOpen(false);
    if (trigger.id) {
      popconfirm.id = `${trigger.id}_popconfirm`;
      trigger.setAttribute('aria-controls', popconfirm.id);
    }
    trigger.setAttribute('aria-haspopup', 'dialog');

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      if (activePopconfirm && activePopconfirm !== popconfirm) {
        closeActivePopconfirm();
      }
      const isOpen = popconfirm.getAttribute('data-open') === 'true';
      if (isOpen) {
        closePopconfirm();
      } else {
        setPopconfirmOpen(true);
        activePopconfirm = popconfirm;
      }
    });
    return wrap;
  }

  function attachPopconfirm(trigger, messageKey, fallbackMessage, onConfirm) {
    if (!trigger || !trigger.parentNode) {
      return;
    }
    const parent = trigger.parentNode;
    const wrap = document.createElement('div');
    parent.insertBefore(wrap, trigger);
    initializePopconfirmWrap(wrap, trigger, messageKey, fallbackMessage, onConfirm);
  }

  function removeSiteSearchItem(key, isBuiltin) {
    if (isBuiltin) {
      const nextDisabledKeys = new Set(disabledSiteSearchKeys);
      nextDisabledKeys.add(key.toLowerCase());
      return saveDisabledSiteSearchKeys(nextDisabledKeys).then(() => {
        disabledSiteSearchKeys = nextDisabledKeys;
        refreshSiteSearchProviders();
        if (editingSiteSearchKey === key) {
          resetSiteSearchForm();
        }
        showToast(getMessage('toast_removed', '已移除'), false);
      }).catch(() => {
        showToast(getMessage('toast_error', '操作失败，请重试。'), true);
      });
    }
    const removedItem = customSiteSearchProviders.find(
      (item) => String(item.key || '') === key
    );
    const nextCustom = customSiteSearchProviders.filter(
      (item) => String(item.key || '') !== key
    );
    const nextDisabledKeys = new Set(disabledSiteSearchKeys);
    const builtinKey = getSiteSearchBuiltinKey(removedItem);
    if (builtinKey) {
      nextDisabledKeys.delete(builtinKey);
    }
    return saveSiteSearchProviderState(nextCustom, nextDisabledKeys).then(() => {
      customSiteSearchProviders = nextCustom;
      customSiteSearchProviderIdsReady = true;
      disabledSiteSearchKeys = nextDisabledKeys;
      refreshSiteSearchProviders();
      if (editingSiteSearchKey === key) {
        resetSiteSearchForm();
      }
      showToast(getMessage('toast_removed', '已移除'), false);
    }).catch(() => {
      showToast(getMessage('toast_error', '操作失败，请重试。'), true);
    });
  }

  function normalizeLocale(locale) {
    return SETTINGS.normalizeLocale(locale);
  }

  function localeToHtmlLang(locale) {
    return SETTINGS.localeToHtmlLang(locale);
  }

  function applyDocumentLanguage(locale) {
    if (!document.documentElement) {
      return;
    }
    document.documentElement.lang = localeToHtmlLang(locale);
  }

  function getSystemLocale() {
    if (chrome && chrome.i18n && chrome.i18n.getUILanguage) {
      return normalizeLocale(chrome.i18n.getUILanguage());
    }
    return normalizeLocale(navigator.language || 'en');
  }

  function normalizeLanguageMode(mode) {
    const raw = String(mode || '').trim();
    if (!raw) {
      return 'system';
    }
    const lower = raw.toLowerCase();
    if (lower === 'system') {
      return 'system';
    }
    if (lower === 'en' || lower.startsWith('en-') || lower.startsWith('en_')) {
      return 'en';
    }
    if (lower === 'ja' || lower.startsWith('ja-') || lower.startsWith('ja_')) {
      return 'ja';
    }
    if (lower === 'zh-hk' || lower === 'zh_hk') {
      return 'zh-TW';
    }
    if (lower === 'zh-tw' || lower === 'zh_tw' || lower === 'zh-mo' || lower === 'zh_mo' || lower.includes('hant')) {
      return 'zh-TW';
    }
    if (lower === 'zh-cn' || lower === 'zh_cn' || lower === 'zh-hans' || lower === 'zh_hans' || lower.startsWith('zh')) {
      return 'zh-CN';
    }
    return 'system';
  }

  function loadLocaleMessages(locale) {
    const normalized = normalizeLocale(locale);
    const localePath = chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function'
      ? chrome.runtime.getURL(`_locales/${normalized}/messages.json`)
      : `../../_locales/${normalized}/messages.json`;
    const fetchFromBackground = () => new Promise((resolve) => {
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({});
        return;
      }
      chrome.runtime.sendMessage({ action: 'getLocaleMessages', locale: normalized }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve({});
          return;
        }
        resolve(response && response.messages ? response.messages : {});
      });
    });
    return fetch(localePath, { cache: 'no-store' })
      .then((response) => {
        if (!response || !response.ok) {
          throw new Error('locale fetch failed');
        }
        return response.json();
      })
      .catch(() => fetchFromBackground());
  }

  function applyLanguageMode(mode, options) {
    const requestId = ++languageApplyRequestId;
    const normalizedMode = normalizeLanguageMode(mode);
    currentLanguageMode = normalizedMode;
    const targetLocale = normalizedMode === 'system' ? getSystemLocale() : normalizeLocale(normalizedMode);
    applyDocumentLanguage(targetLocale);
    const shouldPersist = Boolean(options && options.persist);
    if (shouldPersist) {
      const payload = {
        [LANGUAGE_STORAGE_KEY]: normalizedMode
      };
      if (localStorageArea) {
        localStorageArea.set(payload);
      }
      if (storageArea) {
        storageArea.set(payload);
      }
    }
    loadLocaleMessages(targetLocale).then((messages) => {
      if (requestId !== languageApplyRequestId) {
        return;
      }
      currentMessages = messages || {};
      if (languageSelect) {
        setOptionsSelectState(languageSelect, normalizedMode);
        if (languageSelect.value !== normalizedMode) {
          setOptionsSelectState(languageSelect, 'system');
        }
      }
      applyI18n();
      renderOptionsInfoButtons();
      renderFeedbackSupport();
      refreshCustomSelects();
      setEditingState(editingSiteSearchKey);
      updateBuiltinResetTooltip();
      updateCustomClearTooltip();
      updateAggregateSearchClearTooltip();
      updateBlacklistClearTooltip();
      refreshSyncStatus();
      refreshShortcutsStatus();
      renderShortcutReferenceList();
      updateThemeButtons(currentThemeMode);
      setNewtabWidthTabState(currentNewtabWidthMode);
      setOverlaySizeTabState(currentOverlaySizeMode);
      setOverlayEnterAnimationTabState(currentOverlayEnterAnimation);
      setSearchResultPriorityTabState(currentSearchResultPriority);
      setRecentModeTabState(currentRecentMode);
      setRestrictedActionTabState(currentRestrictedAction);
      setNewtabTopContentTabState(currentNewtabTopContentMode);
      renderNewtabTimeFontWeightControl(currentNewtabTimeFontWeight);
      renderNewtabShortcutColumnsControl(currentNewtabShortcutColumns);
      renderNewtabShortcutSizeControl(currentNewtabShortcutSize);
      renderNewtabShortcutGapControl(currentNewtabShortcutGap);
      syncNewtabShortcutSubcontrolAvailability();
      renderRecentCountControl(currentRecentCount);
      renderBookmarkRowsControl(currentBookmarkCount);
      renderBookmarkColumnsControl(currentBookmarkColumns);
      renderSearchResultDisplayLimitControl(currentSearchResultDisplayLimit);
      renderSettingsNavigation(currentActiveSettingsTab);
      renderSiteSearchList();
      renderAggregateSearchList();
      renderSearchBlacklistList();
    });
  }

  storageChanges.on(LANGUAGE_STORAGE_KEY, (changes) => {
    applyLanguageMode(changes[LANGUAGE_STORAGE_KEY].newValue || 'system');
  });

  function refreshShortcutsStatus() {
    if (!shortcutsStatus) return;
    shortcutsStatus.textContent = currentShortcutLabel
      ? (formatShortcutForDisplay(currentShortcutLabel) || currentShortcutLabel)
      : getMessage('settings_shortcuts_unset', '未设置');
  }

  function getDefaultFallbackShortcut() {
    return isMacPlatform ? 'Command+Shift+K' : 'Ctrl+Shift+K';
  }

  function formatShortcutForDisplay(shortcut) {
    return shortcutDisplay.formatShortcutChord(shortcut, {
      platform: isMacPlatform ? 'mac' : 'windows'
    });
  }

  function renderFallbackShortcutTokens(shortcut, animate) {
    if (!shortcutHotkeyController) {
      return;
    }
    const tokens = SHORTCUT_KEYS.getShortcutDisplayTokens(shortcut, { macSymbols: isMacPlatform });
    const emptyPlaceholder = isCapturingFallbackShortcut
      ? (fallbackShortcutInput ? (fallbackShortcutInput.getAttribute('placeholder') || '') : '')
      : getMessage('settings_shortcuts_empty_state', '无');
    shortcutHotkeyController.render({
      animate: Boolean(animate),
      placeholder: emptyPlaceholder,
      tokens
    });
  }

  function setFallbackShortcutLabel(value, animate) {
    currentShortcutLabel = value || '';
    if (fallbackShortcutInput) {
      fallbackShortcutInput.value = '';
    }
    renderFallbackShortcutTokens(currentShortcutLabel, animate);
    updateFallbackShortcutResetVisibility();
    refreshShortcutsStatus();
  }

  function updateFallbackShortcutResetVisibility() {
    if (!resetShortcutButton) {
      return;
    }
    const normalizedCurrent = normalizeFallbackShortcut(currentShortcutLabel || '');
    const normalizedDefault = normalizeFallbackShortcut(getDefaultFallbackShortcut());
    const canReset = normalizedCurrent !== normalizedDefault;
    resetShortcutButton.setAttribute('data-can-reset', canReset ? 'true' : 'false');
    if (canReset) {
      resetShortcutButton.removeAttribute('disabled');
    } else {
      resetShortcutButton.setAttribute('disabled', 'disabled');
    }
  }

  function stopFallbackShortcutCapture() {
    if (fallbackCaptureStopTimer) {
      clearTimeout(fallbackCaptureStopTimer);
      fallbackCaptureStopTimer = null;
    }
    isCapturingFallbackShortcut = false;
    cancelCaptureOnMouseLeave = false;
    if (fallbackShortcutWrap) {
      fallbackShortcutWrap.removeAttribute('data-capturing');
    }
    if (fallbackShortcutInput && document.activeElement === fallbackShortcutInput) {
      fallbackShortcutInput.blur();
    }
    if (!currentShortcutLabel) {
      renderFallbackShortcutTokens('');
    }
  }

  function stopFallbackShortcutCaptureDeferred(delayMs) {
    if (fallbackCaptureStopTimer) {
      clearTimeout(fallbackCaptureStopTimer);
      fallbackCaptureStopTimer = null;
    }
    fallbackCaptureStopTimer = setTimeout(() => {
      fallbackCaptureStopTimer = null;
      stopFallbackShortcutCapture();
    }, Math.max(0, Number(delayMs) || 0));
  }

  function persistFallbackShortcut(value, onDone) {
    if (!storageArea) {
      if (typeof onDone === 'function') {
        onDone(true);
      }
      return;
    }
    storageArea.set({ [FALLBACK_SHORTCUT_STORAGE_KEY]: value }, () => {
      const ok = !(chrome.runtime && chrome.runtime.lastError);
      if (typeof onDone === 'function') {
        onDone(ok);
      }
    });
  }

  function loadCurrentShortcut() {
    const defaultShortcut = getDefaultFallbackShortcut();
    if (!chrome || !chrome.commands || typeof chrome.commands.getAll !== 'function') {
      setFallbackShortcutLabel(defaultShortcut);
      return;
    }
    chrome.commands.getAll((commands) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        setFallbackShortcutLabel(defaultShortcut);
        return;
      }
      const items = Array.isArray(commands) ? commands : [];
      const command = items.find((item) => item && item.name === 'show-search');
      const shortcut = command && typeof command.shortcut === 'string'
        ? String(command.shortcut).trim()
        : '';
      const effectiveShortcut = shortcut || defaultShortcut;
      setFallbackShortcutLabel(effectiveShortcut);
    });
  }

  storageChanges.on(FALLBACK_SHORTCUT_STORAGE_KEY, () => loadCurrentShortcut());

  function getShortcutReferencePartLabel(part) {
    const text = String(part || '').trim();
    if (!text) {
      return '';
    }
    return shortcutDisplay.formatShortcutReferencePart(text, {
      platform: isMacPlatform ? 'mac' : 'windows'
    });
  }

  function getShortcutReferenceParts(shortcut) {
    const value = String(shortcut || '').trim();
    if (!value) {
      return [];
    }
    return value
      .split(/\s*\/\s*/)
      .map(getShortcutReferencePartLabel)
      .filter(Boolean);
  }

  function renderShortcutReferenceGroups(groups) {
    if (!shortcutReferenceList) {
      return;
    }
    const visibleGroups = groups.map((group) => ({
      ...group,
      items: (group.items || []).filter((item) => !(item && item.commandName === 'show-search'))
    })).filter((group) => group.items.length > 0);
    shortcutReferenceController.render({
      groups: visibleGroups.map((group) => ({
        id: group && group.id ? String(group.id) : '',
        titleKey: group && group.titleKey ? String(group.titleKey) : '',
        title: getMessage(group.titleKey, group.titleFallback || ''),
        // The search group hangs off the "show-search" row above the list.
        nested: group.id === 'search',
        items: group.items.map((item) => {
          const parts = getShortcutReferenceParts(item.shortcut || '');
          const customShortcutLabel = item.shortcutLabelKey
            ? formatTemplate(getMessage(
              item.shortcutLabelKey,
              item.shortcutLabelFallback || ''
            ), {
              modifier: isMacPlatform ? '⌘' : 'Ctrl'
            })
            : '';
          return {
            id: item && item.id ? String(item.id) : '',
            commandName: item && item.commandName ? String(item.commandName) : '',
            editable: Boolean(item && item.editable),
            titleKey: item && item.titleKey ? String(item.titleKey) : '',
            title: getMessage(item.titleKey, item.titleFallback || ''),
            shortcutEmpty: !customShortcutLabel && parts.length === 0,
            shortcutLabel: customShortcutLabel || (parts.length > 0
              ? parts.join(' / ')
              : getMessage('shortcut_reference_unset', '未设置'))
          };
        })
      }))
    });
  }

  function renderShortcutReferenceList() {
    if (!shortcutReferenceList) {
      return;
    }
    const shortcutReference = globalThis.LumnoShortcutReference;
    const platform = isMacPlatform ? 'mac' : 'default';
    const renderWithCommands = (commands) => {
      const groups = shortcutReference.getShortcutReferenceGroups({
        commands,
        platform
      });
      renderShortcutReferenceGroups(groups);
    };
    if (!chrome || !chrome.commands || typeof chrome.commands.getAll !== 'function') {
      renderWithCommands(null);
      return;
    }
    chrome.commands.getAll((commands) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        renderWithCommands(null);
        return;
      }
      renderWithCommands(Array.isArray(commands) ? commands : null);
    });
  }

  function getSettingsNavigationItems() {
    return [
      {
        key: 'general',
        labelKey: 'settings_tab_general',
        label: getMessage('settings_tab_general', '常规'),
        iconClass: 'ri-icon ri-command-fill'
      },
      {
        key: 'account',
        labelKey: 'settings_tab_account',
        label: getMessage('settings_tab_account', '账号与同步'),
        iconClass: 'ri-icon ri-user-3-line'
      },
      {
        key: 'appearance',
        labelKey: 'settings_tab_appearance',
        label: getMessage('settings_tab_appearance', '外观'),
        iconClass: 'ri-icon ri-moon-clear-fill'
      },
      {
        key: 'shortcuts',
        labelKey: 'settings_tab_shortcuts',
        label: getMessage('settings_tab_shortcuts', '搜索源'),
        iconClass: 'ri-icon ri-search-line'
      },
      {
        key: 'blacklist',
        labelKey: 'settings_tab_blacklist',
        label: getMessage('settings_tab_blacklist', '黑名单'),
        iconClass: 'ri-icon ri-forbid-2-fill'
      },
      {
        key: 'labs',
        labelKey: 'settings_tab_labs',
        label: getMessage('settings_tab_labs', '实验室功能'),
        iconClass: 'ri-icon ri-test-tube-fill'
      }
    ];
  }

  function renderSettingsNavigation(tabKey) {
    settingsNavigationController.render({
      activeKey: tabKey,
      items: getSettingsNavigationItems()
    });
  }

  function normalizeSettingsTabKey(tabKey) {
    return SETTINGS_TAB_KEYS.includes(tabKey) ? tabKey : 'general';
  }

  function setActiveTab(tabKey) {
    const nextTabKey = normalizeSettingsTabKey(tabKey);
    panelHeightAnimator.cancel();
    currentActiveSettingsTab = nextTabKey;
    renderSettingsNavigation(nextTabKey);
    tabContents.forEach((content) => {
      const isActive = content.getAttribute('data-content') === nextTabKey;
      content.setAttribute('data-active', isActive ? 'true' : 'false');
    });
    if (nextTabKey === 'general') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          syncFallbackShortcutWrapWidth();
          updateFallbackShortcutWrapWidthForContent();
        });
      });
    }
    if (nextTabKey) {
      const nextHash = `#${nextTabKey}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextHash);
      }
    }
  }

  function handleSettingsTabSelection(value) {
    const tabKey = normalizeSettingsTabKey(value);
    const currentTabKey = currentActiveSettingsTab;
    setActiveTab(tabKey);
    if (tabKey !== currentTabKey) {
      resetPageScrollToDefault();
    }
    if (tabKey === 'shortcuts') {
      refreshSiteSearchProviders();
    }
  }

  function updateTabsStickyVisualState() {
    if (!tabsRow) return;
    const stickyTop = parseFloat(window.getComputedStyle(tabsRow).top || '0') || 0;
    const isStuck = tabsRow.getBoundingClientRect().top <= stickyTop + 0.5;
    tabsRow.setAttribute('data-stuck', isStuck ? 'true' : 'false');
  }

  let optionsScrollFrame = 0;
  let optionsResizeFrame = 0;
  function scheduleOptionsScrollRefresh() {
    if (optionsScrollFrame) {
      return;
    }
    optionsScrollFrame = window.requestAnimationFrame(() => {
      optionsScrollFrame = 0;
      updateTabsStickyVisualState();
    });
  }

  function scheduleOptionsViewportLayoutRefresh() {
    if (optionsResizeFrame) {
      return;
    }
    optionsResizeFrame = window.requestAnimationFrame(() => {
      optionsResizeFrame = 0;
      updateTabsStickyVisualState();
      syncFallbackShortcutWrapWidth();
    });
  }

  function resetPageScrollToDefault() {
    window.scrollTo({ top: 0, behavior: 'auto' });
    updateTabsStickyVisualState();
  }

  function getOptionsRouteState() {
    const rawHash = window.location.hash.replace('#', '').trim();
    if (!rawHash) {
      return {
        tabKey: '',
        targetKey: ''
      };
    }
    const parts = rawHash.split(':').map((part) => String(part || '').trim()).filter(Boolean);
    return {
      tabKey: parts[0] || '',
      targetKey: parts.slice(1).join(':')
    };
  }

  function getOptionsTargetElement(targetKey) {
    if (targetKey === OPTIONS_TARGET_DOCUMENT_PIP) {
      return document.getElementById('_x_extension_document_pip_row_2026_unique_');
    }
    if (targetKey !== OPTIONS_TARGET_SITE_SEARCH_AI) {
      return null;
    }
    return siteSearchAiGroup || (siteSearchAiBuiltinList
      ? siteSearchAiBuiltinList.closest('._x_extension_shortcut_group_2024_unique_')
      : null);
  }

  function scrollToOptionsTarget(targetKey, options) {
    const target = getOptionsTargetElement(targetKey);
    if (!target || typeof target.scrollIntoView !== 'function') {
      return false;
    }
    const behavior = options && options.behavior ? options.behavior : 'smooth';
    const block = options && options.block ? options.block : 'start';
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior, block });
      updateTabsStickyVisualState();
      if (options && options.flash) {
        flashOptionsTarget(target);
      }
    });
    return true;
  }

  // Points the eye at the row a deep link opened, e.g. the web clip switch
  // that the toolbar button leads to while web clip is off.
  function flashOptionsTarget(target) {
    target.removeAttribute('data-flash');
    void target.offsetWidth;
    target.setAttribute('data-flash', 'true');
    const onFlashEnd = () => {
      target.removeAttribute('data-flash');
      target.removeEventListener('animationend', onFlashEnd);
    };
    target.addEventListener('animationend', onFlashEnd);
  }

  if (settingsVersion && chrome?.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (manifest?.version) {
      settingsVersion.textContent = `v${manifest.version}`;
    }
    function getOpenDisposition(event, fallback) {
      return NAVIGATION_DISPOSITION.getDisposition(event, fallback);
    }
    function openSettingsVersionRelease(event) {
      event.preventDefault();
      event.stopPropagation();
      if (!chrome?.runtime?.sendMessage) {
        return;
      }
      chrome.runtime.sendMessage({
        action: 'openReleasePage',
        reason: 'options-version',
        disposition: getOpenDisposition(event, 'newTab')
      }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          return;
        }
      });
    }
    settingsVersion.addEventListener('click', openSettingsVersionRelease);
    settingsVersion.addEventListener('auxclick', (event) => {
      if (!event || Number(event.button) !== 1) {
        return;
      }
      openSettingsVersionRelease(event);
    });
  }

  function applyResolvedTheme(resolvedTheme) {
    document.body.setAttribute('data-theme', resolvedTheme);
    panel.setAttribute('data-theme', resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', resolvedTheme === 'dark' ? '#111111' : '#f1f5f9');
    }
  }

  function resolveTheme(mode) {
    if (mode === 'dark') {
      return 'dark';
    }
    if (mode === 'light') {
      return 'light';
    }
    return mediaQuery.matches ? 'dark' : 'light';
  }

  function getThemeStorageUpdate(mode) {
    return SETTINGS.createGlobalThemeModeStorageUpdate(mode);
  }

  function updateThemeButtons(mode) {
    const nextMode = mode === 'dark' || mode === 'light' ? mode : 'system';
    currentThemeMode = nextMode;
    updateOverlayPageThemeAdaptationVisibility(nextMode);
    themePickerController.render({
      activeMode: nextMode,
      options: [
        {
          mode: 'system',
          labelKey: 'settings_theme_system',
          label: getMessage('settings_theme_system', '跟随系统'),
          previewSrc: '../../assets/images/system.svg'
        },
        {
          mode: 'light',
          labelKey: 'settings_theme_light',
          label: getMessage('settings_theme_light', '浅色'),
          previewSrc: '../../assets/images/light.svg'
        },
        {
          mode: 'dark',
          labelKey: 'settings_theme_dark',
          label: getMessage('settings_theme_dark', '深色'),
          previewSrc: '../../assets/images/dark.svg'
        }
      ]
    });
  }

  function updateOverlayPageThemeAdaptationVisibility(mode) {
    const nextMode = mode === 'dark' || mode === 'light' ? mode : 'system';
    const visible = nextMode === 'system';
    if (!overlayPageThemeAdaptationRow) {
      document.documentElement.setAttribute('data-options-theme-mode', nextMode);
      return;
    }
    animateOptionsPanelHeight(() => {
      document.documentElement.setAttribute('data-options-theme-mode', nextMode);
      return setConditionalSettingsElementVisibility(overlayPageThemeAdaptationRow, visible);
    });
  }

  function onMediaChange() {
    if (!storageArea) {
      return;
    }
    storageArea.get([THEME_STORAGE_KEY], (result) => {
      const mode = result[THEME_STORAGE_KEY] || 'system';
      if (mode === 'system') {
        applyResolvedTheme(resolveTheme(mode));
      }
    });
  }

  function setThemeMode(mode) {
    if (!storageArea) {
      return;
    }
    const updates = getThemeStorageUpdate(mode);
    const nextMode = updates[THEME_STORAGE_KEY];
    cacheOptionsThemeMode(nextMode);
    storageArea.set(updates, () => {
      updateThemeButtons(nextMode);
      applyResolvedTheme(resolveTheme(nextMode));
      if (nextMode === 'system' && !mediaListenerAttached) {
        mediaQuery.addEventListener('change', onMediaChange);
        mediaListenerAttached = true;
        return;
      }
      if (nextMode !== 'system' && mediaListenerAttached) {
        mediaQuery.removeEventListener('change', onMediaChange);
        mediaListenerAttached = false;
      }
    });
  }

  function getStoredThemeMode() {
    return new Promise((resolve) => {
      if (!storageArea) {
        resolve('system');
        return;
      }
      storageArea.get([THEME_STORAGE_KEY], (result) => {
        resolve((result && result[THEME_STORAGE_KEY]) || 'system');
      });
    });
  }

  function cacheOptionsThemeMode(mode) {
    const nextMode = mode === 'dark' || mode === 'light' ? mode : 'system';
    try {
      if (window.localStorage) {
        window.localStorage.setItem(OPTIONS_THEME_PRELOAD_STORAGE_KEY, nextMode);
      }
    } catch (e) {
      // The early theme preloader falls back to the system theme when caching is unavailable.
    }
  }

  // theme-preload.js has already painted the cached (or system) theme and
  // marked the page ready before this runs, so there is nothing to fall back
  // to while the stored preference loads.
  async function initTheme() {
    const storedMode = await getStoredThemeMode();
    cacheOptionsThemeMode(storedMode);
    updateThemeButtons(storedMode);
    applyResolvedTheme(resolveTheme(storedMode));
    if (storedMode === 'system' && !mediaListenerAttached) {
      mediaQuery.addEventListener('change', onMediaChange);
      mediaListenerAttached = true;
    }
    document.documentElement.setAttribute('data-theme-ready', 'true');
  }

  initTheme();
  storageChanges.on(THEME_STORAGE_KEY, (changes) => {
    const nextMode = changes[THEME_STORAGE_KEY].newValue || 'system';
    updateThemeButtons(nextMode);
    applyResolvedTheme(resolveTheme(nextMode));
  });

  function playThemeOptionClickEffect(button) {
    if (!button) {
      return;
    }
    button.classList.remove('x-theme-clicking');
    void button.offsetWidth;
    button.classList.add('x-theme-clicking');
    window.setTimeout(() => {
      button.classList.remove('x-theme-clicking');
    }, 260);
  }

  themeButtons.forEach((button) => {
    button.addEventListener('click', function() {
      playThemeOptionClickEffect(button);
      setThemeMode(button.getAttribute('data-mode'));
    });
  });

  if (!storageArea) {
    applyLanguageMode('system');
  }
  initTooltips();

  function getInitialTabKey() {
    const routeState = getOptionsRouteState();
    const tabKey = routeState.tabKey;
    if (!tabKey) {
      return 'general';
    }
    return SETTINGS_TAB_KEYS.includes(tabKey) ? tabKey : 'general';
  }

  function getInitialOptionsTargetKey() {
    const routeState = getOptionsRouteState();
    return routeState.targetKey || '';
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', function() {
      handleSettingsTabSelection(button.getAttribute('data-tab'));
    });
  });

  const initialTab = getInitialTabKey();
  const initialOptionsTargetKey = getInitialOptionsTargetKey();
  pendingOptionsScrollTarget = initialTab === 'shortcuts' ? initialOptionsTargetKey : '';
  setActiveTab(initialTab);
  if (initialTab === 'labs') {
    scrollToOptionsTarget(initialOptionsTargetKey, { behavior: 'auto', block: 'center', flash: true });
  }
  if (initialTab === 'shortcuts') {
    refreshSiteSearchProviders();
  }
  window.addEventListener('scroll', scheduleOptionsScrollRefresh, { passive: true });
  updateTabsStickyVisualState();
  window.addEventListener('resize', scheduleOptionsViewportLayoutRefresh, { passive: true });
  providerStorageRuntime.ready.then(() => {
    migrateStorageIfNeeded(SYNC_KEYS);
    refreshSyncStatus();
  });

  function normalizeSiteSearchTemplate(template) {
    return SEARCH_UTILS.normalizeSiteSearchTemplate(template);
  }

  function isAiSiteSearchProvider(item) {
    return SEARCH_UTILS.isAiSiteSearchProvider(item);
  }

  function isSearchEngineSiteSearchProvider(item) {
    return SEARCH_UTILS.isSearchEngineSiteSearchProvider(item);
  }

  function normalizeSiteSearchProvider(item, baseItem) {
    return SEARCH_UTILS.normalizeSiteSearchProvider(item, baseItem);
  }

  function findSiteSearchKeyConflict(key, allowedKey, allowedAggregateId) {
    return siteSearchModel.findSiteSearchKeyConflict(key, allowedKey, allowedAggregateId, {
      aggregateSearches,
      providers: defaultSiteSearchProviders.concat(customSiteSearchProviders)
    });
  }

  function setSiteSearchError(message) {
    if (!siteSearchError) {
      return;
    }
    if (!message) {
      siteSearchError.textContent = '';
      siteSearchError.style.display = 'none';
      return;
    }
    siteSearchError.textContent = message;
    siteSearchError.style.display = 'block';
  }

  function setLegacySiteSearchDraftCategory(category) {
    siteSearchDraftCategory = category === 'searchEngine' ? 'searchEngine' : 'site';
    siteSearchCategoryButtons.forEach((button) => {
      const active = button.dataset.siteSearchCategory === siteSearchDraftCategory;
      button.dataset.active = active ? 'true' : 'false';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setSiteSearchFormExpanded(expanded) {
    siteSearchFormExpanded = Boolean(expanded);
    if (siteSearchForm) {
      siteSearchForm.setAttribute('data-expanded', siteSearchFormExpanded ? 'true' : 'false');
    }
    if (siteSearchFormTrigger) {
      siteSearchFormTrigger.setAttribute('aria-expanded', siteSearchFormExpanded ? 'true' : 'false');
    }
    if (siteSearchCancelButton) {
      siteSearchCancelButton.style.display = siteSearchFormExpanded ? 'inline-flex' : 'none';
      if (siteSearchCancelButton.textContent) {
        siteSearchCancelButton.textContent = getMessage('shortcuts_cancel', siteSearchCancelButton.textContent);
      }
    }
    if (siteSearchFormExpanded && siteSearchKeyInput) {
      siteSearchKeyInput.focus();
    }
  }

  function setEditingState(key) {
    editingSiteSearchKey = key;
    if (siteSearchAddButton) {
      siteSearchAddButton.textContent = key
        ? getMessage('shortcuts_save', '保存修改')
        : getMessage('shortcuts_add', '添加自定义搜索');
      siteSearchAddButton.classList.add('_x_extension_shortcut_save_2024_unique_');
    }
  }

  function insertSiteSearchQueryToken() {
    if (!siteSearchTemplateInput) {
      return;
    }
    const token = '{query}';
    const currentValue = String(siteSearchTemplateInput.value || '');
    const existingIndex = currentValue.indexOf(token);
    if (existingIndex >= 0) {
      const nextCursor = existingIndex + token.length;
      siteSearchTemplateInput.focus();
      if (typeof siteSearchTemplateInput.setSelectionRange === 'function') {
        siteSearchTemplateInput.setSelectionRange(nextCursor, nextCursor);
      }
      return;
    }
    const selectionStart = Number.isInteger(siteSearchTemplateInput.selectionStart)
      ? siteSearchTemplateInput.selectionStart
      : currentValue.length;
    const selectionEnd = Number.isInteger(siteSearchTemplateInput.selectionEnd)
      ? siteSearchTemplateInput.selectionEnd
      : selectionStart;
    const safeStart = Math.max(0, Math.min(selectionStart, currentValue.length));
    const safeEnd = Math.max(safeStart, Math.min(selectionEnd, currentValue.length));
    const nextValue = `${currentValue.slice(0, safeStart)}${token}${currentValue.slice(safeEnd)}`;
    const nextCursor = safeStart + token.length;
    siteSearchTemplateInput.value = nextValue;
    siteSearchTemplateInput.focus();
    if (typeof siteSearchTemplateInput.setSelectionRange === 'function') {
      siteSearchTemplateInput.setSelectionRange(nextCursor, nextCursor);
    }
    siteSearchTemplateInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function attachSaveButtonAnimation(button) {
    if (!button) {
      return;
    }
    button.addEventListener('click', () => {
      if (!button.classList.contains('_x_extension_shortcut_save_2024_unique_')) {
        return;
      }
      button.classList.remove('_x_extension_shortcut_save_pulse_2024_unique_');
      void button.offsetWidth;
      button.classList.add('_x_extension_shortcut_save_pulse_2024_unique_');
    });
    button.addEventListener('animationend', () => {
      button.classList.remove('_x_extension_shortcut_save_pulse_2024_unique_');
    });
  }

  function suspendSiteSearchRefresh(durationMs) {
    const now = Date.now();
    siteSearchRefreshSuppressUntil = Math.max(siteSearchRefreshSuppressUntil, now + durationMs);
  }

  if (languageSelect) {
    languageSelect.addEventListener('change', () => {
      const next = languageSelect.value || 'system';
      applyLanguageMode(next, { persist: true });
    });
  }

  if (newtabWidthSelect) {
    newtabWidthSelect.addEventListener('change', () => {
      handleNewtabWidthSelection(newtabWidthSelect.value);
    });
  }
  if (newtabWidthTabButtons.length > 0) {
    newtabWidthTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        handleNewtabWidthSelection(button.getAttribute('data-newtab-width'));
      });
    });
  }
  if (overlaySizeTabButtons.length > 0) {
    overlaySizeTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        handleOverlaySizeSelection(button.getAttribute('data-overlay-size'));
      });
    });
  }
  if (overlayEnterAnimationTabButtons.length > 0) {
    overlayEnterAnimationTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        handleOverlayEnterAnimationSelection(button.getAttribute('data-overlay-enter-animation'));
      });
    });
  }
  if (searchResultPrioritySelect) {
    searchResultPrioritySelect.addEventListener('change', () => {
      handleSearchResultPrioritySelection(searchResultPrioritySelect.value);
    });
  }
  if (searchResultTabPositionSelect) {
    searchResultTabPositionSelect.addEventListener('change', () => {
      const position = SETTINGS.normalizeSearchResultTabPosition(searchResultTabPositionSelect.value);
      searchResultTabPositionSelect.value = position;
      if (storageArea) {
        storageArea.set({ [SEARCH_RESULT_TAB_POSITION_STORAGE_KEY]: position });
      }
      refreshCustomSelects();
    });
  }
  if (searchResultPriorityTabButtons.length > 0) {
    searchResultPriorityTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        handleSearchResultPrioritySelection(button.getAttribute('data-search-result-priority'));
      });
    });
  }
  if (searchResultSourceTypeInputs.length > 0) {
    searchResultSourceTypeInputs.forEach((input) => {
      input.addEventListener('change', () => {
        persistSearchResultSourceTypes(collectCheckedSearchResultSourceTypes());
      });
    });
  }
  if (recentModeSelect) {
    recentModeSelect.addEventListener('change', () => {
      handleRecentModeSelection(recentModeSelect.value);
    });
  }
  if (recentModeTabButtons.length > 0) {
    recentModeTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        handleRecentModeSelection(button.getAttribute('data-recent-mode'));
      });
    });
  }
  function setNewtabOpenInNewTabState(value) {
    const normalized = SETTINGS.normalizeNewtabOpenInNewTab(value);
    newtabOpenInNewTabToggles.forEach((input) => {
      setOptionsToggleState(input, normalized[input.getAttribute('data-newtab-open-in-new-tab-surface')]);
    });
  }
  newtabOpenInNewTabToggles.forEach((input) => {
    input.addEventListener('change', () => {
      const next = {};
      newtabOpenInNewTabToggles.forEach((item) => {
        next[item.getAttribute('data-newtab-open-in-new-tab-surface')] = Boolean(item.checked);
      });
      const normalized = SETTINGS.normalizeNewtabOpenInNewTab(next);
      setNewtabOpenInNewTabState(normalized);
      if (!storageArea) {
        return;
      }
      storageArea.set({ [NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY]: normalized });
    });
  });

  if (restrictedActionSelect) {
    restrictedActionSelect.addEventListener('change', () => {
      handleRestrictedActionSelection(restrictedActionSelect.value);
    });
  }
  if (restrictedActionTabButtons.length > 0) {
    restrictedActionTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        handleRestrictedActionSelection(button.getAttribute('data-restricted-action'));
      });
    });
  }

  function openExtensionShortcutsPage() {
    chrome.runtime.sendMessage({ action: 'openExtensionShortcutsPage' }, (response) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        showToast(getMessage('toast_error', '操作失败，请重试。'), true);
        return;
      }
      if (!response || response.ok === false) {
        showToast(getMessage('toast_error', '操作失败，请重试。'), true);
      }
    });
  }
  if (openShortcutsPageButton) {
    openShortcutsPageButton.addEventListener('click', openExtensionShortcutsPage);
  }
  if (openOnboardingPageButton) {
    openOnboardingPageButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openOnboardingPage' }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          showToast(getMessage('toast_error', '操作失败，请重试。'), true);
          return;
        }
        if (!response || response.ok === false) {
          showToast(getMessage('toast_error', '操作失败，请重试。'), true);
        }
      });
    });
  }

  if (fallbackShortcutInput) {
    const handleFallbackShortcutKeydown = (event) => {
      if (!event) {
        return;
      }
      if (event.key === 'Tab') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        fallbackShortcutInput.value = '';
        renderFallbackShortcutTokens(currentShortcutLabel || getDefaultFallbackShortcut());
        stopFallbackShortcutCapture();
        return;
      }
      const nextShortcut = buildShortcutFromEvent(event);
      if (nextShortcut) {
        fallbackShortcutInput.value = '';
        const normalized = normalizeFallbackShortcut(nextShortcut);
        if (!normalized) {
          return;
        }
        if (normalized === currentShortcutLabel) {
          renderFallbackShortcutTokens(normalized, true);
          stopFallbackShortcutCaptureDeferred(260);
          return;
        }
        setFallbackShortcutLabel(normalized, true);
        persistFallbackShortcut(normalized, (ok) => {
          if (!ok) {
            showToast(getMessage('toast_error', '操作失败，请重试。'), true);
          }
        });
        stopFallbackShortcutCaptureDeferred(260);
      }
    };
    const captureWindowKeydown = (event) => {
      if (!isCapturingFallbackShortcut) {
        return;
      }
      handleFallbackShortcutKeydown(event);
    };
    window.addEventListener('keydown', captureWindowKeydown, true);
    if (fallbackShortcutWrap) {
      fallbackShortcutWrap.addEventListener('pointerdown', (event) => {
        const target = event && event.target;
        if (target && target.closest && target.closest('button')) {
          return;
        }
        event.preventDefault();
        fallbackShortcutInput.focus();
      });
      fallbackShortcutWrap.addEventListener('mouseleave', () => {
        if (!cancelCaptureOnMouseLeave) {
          return;
        }
        cancelCaptureOnMouseLeave = false;
        stopFallbackShortcutCapture();
      });
    }
    fallbackShortcutInput.addEventListener('focus', () => {
      isCapturingFallbackShortcut = true;
      if (fallbackShortcutWrap) {
        fallbackShortcutWrap.setAttribute('data-capturing', 'true');
      }
      fallbackShortcutInput.value = '';
      if (!currentShortcutLabel) {
        renderFallbackShortcutTokens('');
      }
    });
    fallbackShortcutInput.addEventListener('blur', () => {
      stopFallbackShortcutCapture();
    });
    fallbackShortcutInput.addEventListener('input', () => {
      fallbackShortcutInput.value = '';
    });
    fallbackShortcutInput.addEventListener('keydown', handleFallbackShortcutKeydown);
  }

  if (clearShortcutButton) {
    clearShortcutButton.addEventListener('click', () => {
      setFallbackShortcutLabel('');
      persistFallbackShortcut('', (ok) => {
        if (!ok) {
          showToast(getMessage('toast_error', '操作失败，请重试。'), true);
        }
      });
      cancelCaptureOnMouseLeave = true;
      if (fallbackShortcutInput) {
        fallbackShortcutInput.focus();
      }
    });
  }

  if (resetShortcutButton) {
    resetShortcutButton.addEventListener('click', () => {
      const defaultShortcut = getDefaultFallbackShortcut();
      setFallbackShortcutLabel(defaultShortcut, true);
      persistFallbackShortcut(defaultShortcut, (ok) => {
        if (!ok) {
          showToast(getMessage('toast_error', '操作失败，请重试。'), true);
        }
      });
      cancelCaptureOnMouseLeave = true;
      if (fallbackShortcutInput) {
        fallbackShortcutInput.focus();
      }
    });
  }

  loadCurrentShortcut();
  renderShortcutReferenceList();
  requestAnimationFrame(syncFallbackShortcutWrapWidth);
  window.addEventListener('focus', () => {
    loadCurrentShortcut();
    renderShortcutReferenceList();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadCurrentShortcut();
      renderShortcutReferenceList();
    }
  }, true);

  function getSyncFailureMessage() {
    const reason = chrome.runtime && chrome.runtime.lastError
      ? chrome.runtime.lastError.message
      : '';
    return formatTemplate(getMessage('sync_status_failed_reason', '同步失败：{reason}'), {
      reason: reason || getMessage('sync_status_failed', '同步失败')
    });
  }

  if (syncNowButton) {
    syncNowButton.addEventListener('click', () => {
      // Pushes the values browser sync already holds, stamped as a manual sync.
      const browserSyncArea = chrome.storage.sync;
      if (!browserSyncArea) {
        updateSyncStatusText('sync_status_unavailable', '同步不可用');
        return;
      }
      if (syncNowButton.getAttribute('aria-busy') === 'true') {
        return;
      }
      syncNowButton.setAttribute('aria-busy', 'true');
      browserSyncArea.get(SYNC_KEYS, (result) => {
        browserSyncArea.set(syncTransfer.buildManualSyncPayload(result, Date.now()), () => {
          syncNowButton.removeAttribute('aria-busy');
          if (chrome.runtime && chrome.runtime.lastError) {
            showToast(getSyncFailureMessage(), true);
            return;
          }
          showToast(getMessage('sync_status_done', '同步完成'), false);
          updateSyncNowTooltip(formatSyncTime(Date.now()));
        });
      });
    });
  }

  if (syncExportButton) {
    syncExportButton.addEventListener('click', () => {
      if (!storageArea) {
        return;
      }
      storageArea.get(SYNC_KEYS, (result) => {
        downloadJson(
          `lumno-settings-${Date.now()}.json`,
          syncTransfer.buildExportFile(result, new Date().toISOString())
        );
        showToast(getMessage('sync_export_done', '已导出配置'), false);
      });
    });
  }

  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('file-read-failed'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsText(file);
    });
  }

  function applySyncImport(plan, toastTask) {
    storageArea.set(plan.payload, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        toastTask.fail(getSyncFailureMessage());
        return;
      }
      const finishImport = () => {
        toastTask.done(getMessage('sync_import_done', '导入完成'));
        refreshSyncStatus();
      };
      if (!plan.keysToClear.length) {
        finishImport();
        return;
      }
      storageArea.remove(plan.keysToClear, finishImport);
    });
  }

  if (syncImportButton && syncImportInput) {
    syncImportButton.addEventListener('click', () => {
      syncImportInput.click();
    });
    syncImportInput.addEventListener('change', (event) => {
      const file = event.target && event.target.files ? event.target.files[0] : null;
      if (!file) {
        return;
      }
      const toastTask = beginToast(getMessage('sync_importing', '正在导入配置…'));
      const failInvalid = () => toastTask.fail(getMessage('sync_import_invalid', '配置文件无效'));
      readTextFile(file).then((text) => {
        const data = syncTransfer.parseImportFile(text);
        const plan = data ? syncTransfer.buildImportPlan(data, Date.now()) : null;
        if (!plan) {
          failInvalid();
        } else if (storageArea) {
          applySyncImport(plan, toastTask);
        } else {
          toastTask.cancel();
        }
      }, failInvalid).finally(() => {
        syncImportInput.value = '';
      });
    });
  }

  // Keeps a copy of the language in chrome.storage.local and moves a value
  // found only there into the primary area. With nothing stored yet the page
  // shows the system language without writing it, so a choice another page is
  // still saving is not overwritten; the language change handler applies that
  // choice once it lands.
  function loadLanguageSetting() {
    if (!storageArea) {
      return;
    }
    storageArea.get([LANGUAGE_STORAGE_KEY], (result) => {
      if (Object.prototype.hasOwnProperty.call(result, LANGUAGE_STORAGE_KEY)) {
        const storedRaw = result[LANGUAGE_STORAGE_KEY];
        const stored = normalizeLanguageMode(storedRaw);
        if (storedRaw !== stored) {
          storageArea.set({ [LANGUAGE_STORAGE_KEY]: stored });
        }
        if (localStorageArea) {
          localStorageArea.set({ [LANGUAGE_STORAGE_KEY]: stored });
        }
        applyLanguageMode(stored);
        return;
      }
      if (getActivePrimaryAreaName() !== 'sync' || !localStorageArea) {
        applyLanguageMode('system');
        return;
      }
      localStorageArea.get([LANGUAGE_STORAGE_KEY], (localResult) => {
        if (!Object.prototype.hasOwnProperty.call(localResult, LANGUAGE_STORAGE_KEY)) {
          applyLanguageMode('system');
          return;
        }
        const localMode = normalizeLanguageMode(localResult[LANGUAGE_STORAGE_KEY]);
        localStorageArea.set({ [LANGUAGE_STORAGE_KEY]: localMode });
        storageArea.set({ [LANGUAGE_STORAGE_KEY]: localMode });
        applyLanguageMode(localMode);
      });
    });
  }

  // The New Tab shortcut switches and sliders are read together because the
  // column count falls back to one inferred from the older width setting.
  function loadNewtabShortcutSettings() {
    if (!storageArea) {
      return;
    }
    storageArea.get([
      NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
      NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
      NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
      NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY,
      NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
      NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
      NEWTAB_SHORTCUT_GAP_STORAGE_KEY
    ], (result) => {
      const rawColumns = result[NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY];
      const values = {
        [NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY]:
          normalizeNewtabShortcutsVisible(result[NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY]),
        [NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY]:
          normalizeNewtabShortcutAddVisible(result[NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY]),
        [NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY]:
          normalizeNewtabShortcutDockMagnificationEnabled(
            result[NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY]
          ),
        [NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY]: rawColumns === undefined
          ? inferNewtabShortcutColumnsFromWidth(result[NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY])
          : normalizeNewtabShortcutColumns(rawColumns),
        [NEWTAB_SHORTCUT_SIZE_STORAGE_KEY]:
          normalizeNewtabShortcutSize(result[NEWTAB_SHORTCUT_SIZE_STORAGE_KEY]),
        [NEWTAB_SHORTCUT_GAP_STORAGE_KEY]:
          normalizeNewtabShortcutGap(result[NEWTAB_SHORTCUT_GAP_STORAGE_KEY])
      };
      setOptionsToggleState(newtabShortcutsToggle, values[NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY]);
      setOptionsToggleState(newtabShortcutAddToggle, values[NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY]);
      setOptionsToggleState(
        newtabShortcutDockMagnificationToggle,
        values[NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY]
      );
      renderNewtabShortcutColumnsControl(values[NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY]);
      renderNewtabShortcutSizeControl(values[NEWTAB_SHORTCUT_SIZE_STORAGE_KEY]);
      renderNewtabShortcutGapControl(values[NEWTAB_SHORTCUT_GAP_STORAGE_KEY]);
      syncNewtabShortcutSubcontrolAvailability();
      const repairs = {};
      Object.keys(values).forEach((key) => {
        if (result[key] !== values[key]) {
          repairs[key] = values[key];
        }
      });
      if (Object.keys(repairs).length > 0) {
        storageArea.set(repairs);
      }
    });
  }

  // Older installs have aggregate searches but no auto-group choice; it is
  // derived from those searches the first time.
  function loadAggregateSearchAutoGroupSetting() {
    if (!storageArea) {
      return;
    }
    storageArea.get([
      AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY,
      AGGREGATE_SEARCH_STORAGE_KEY
    ], (result) => {
      const rawValue = result[AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY];
      const stored = typeof rawValue === 'undefined'
        ? deriveLegacyAggregateSearchAutoGroupEnabled(result[AGGREGATE_SEARCH_STORAGE_KEY])
        : normalizeAggregateSearchAutoGroupEnabled(rawValue);
      setOptionsToggleState(aggregateSearchAutoGroupToggle, stored);
      if (rawValue !== stored) {
        storageArea.set({ [AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY]: stored });
      }
      refreshCustomSelects();
    });
  }

  function loadSearchResultSourceTypes() {
    if (!storageArea) {
      return;
    }
    storageArea.get([SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY], (result) => {
      const stored = result[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY];
      const sourceTypes = normalizeSearchResultSourceTypes(stored);
      setSearchResultSourceTypeState(sourceTypes);
      if (!Array.isArray(stored) || JSON.stringify(stored) !== JSON.stringify(sourceTypes)) {
        storageArea.set({ [SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY]: sourceTypes });
      }
    });
  }
  storageChanges.on(SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY, (changes) => {
    setSearchResultSourceTypeState(changes[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY].newValue);
  });

  loadLanguageSetting();
  settingBinder.bindSetting({
    key: RECENT_COUNT_STORAGE_KEY,
    normalize: normalizeRecentCount,
    apply(count) {
      renderRecentCountControl(count);
      updateRecentModeTabsVisibility(count);
    },
    repairOnChange: false,
    refreshSelects: true
  });
  settingBinder.bindSetting({
    key: NEWTAB_WIDTH_MODE_STORAGE_KEY,
    normalize: normalizeNewtabWidthMode,
    apply(mode) {
      if (newtabWidthSelect) {
        newtabWidthSelect.value = mode;
      }
      setNewtabWidthTabState(mode);
    },
    repairOnChange: false,
    refreshSelects: true
  });
  settingBinder.bindSetting({
    key: OVERLAY_SIZE_MODE_STORAGE_KEY,
    normalize: normalizeOverlaySizeMode,
    apply: setOverlaySizeTabState,
    repairOnChange: false,
    refreshSelects: true
  });
  settingBinder.bindSetting({
    key: OVERLAY_ENTER_ANIMATION_STORAGE_KEY,
    normalize: normalizeOverlayEnterAnimation,
    apply: setOverlayEnterAnimationTabState,
    repairOnChange: false
  });
  settingBinder.bindSetting({
    key: SEARCH_RESULT_PRIORITY_STORAGE_KEY,
    normalize: normalizeSearchResultPriority,
    apply(priority) {
      if (searchResultPrioritySelect) {
        searchResultPrioritySelect.value = priority;
      }
      setSearchResultPriorityTabState(priority);
    },
    repairOnChange: false,
    refreshSelects: true
  });
  settingBinder.bindSetting({
    key: SEARCH_RESULT_TAB_POSITION_STORAGE_KEY,
    normalize: SETTINGS.normalizeSearchResultTabPosition,
    apply(position) {
      if (searchResultTabPositionSelect) {
        searchResultTabPositionSelect.value = position;
      }
    },
    repairOnLoad: false,
    repairOnChange: false,
    refreshSelects: true
  });
  loadSearchResultSourceTypes();
  settingBinder.bindSetting({
    key: SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY,
    normalize: normalizeSearchResultDisplayLimit,
    apply: renderSearchResultDisplayLimitControl
  });
  settingBinder.bindSetting({
    key: RECENT_MODE_STORAGE_KEY,
    // A missing or unknown mode starts as "most visited"; a later change to
    // anything but "most" shows "latest", as the switch only offers the two.
    normalize: (value) => (value === 'latest' || value === 'most' ? value : 'most'),
    normalizeChange: (value) => (value === 'most' ? 'most' : 'latest'),
    apply(mode) {
      if (recentModeSelect) {
        recentModeSelect.value = mode;
      }
      setRecentModeTabState(mode);
    },
    repairOnChange: false,
    refreshSelects: true
  });
  settingBinder.bindSetting({
    key: BOOKMARK_COUNT_STORAGE_KEY,
    normalize: normalizeBookmarkCount,
    apply(count) {
      renderBookmarkRowsControl(count);
      updateBookmarkColumnsSettingVisibility(count);
    },
    repairOnChange: false
  });
  settingBinder.bindSetting({
    key: BOOKMARK_COLUMNS_STORAGE_KEY,
    normalize: normalizeBookmarkColumns,
    apply: renderBookmarkColumnsControl,
    repairOnChange: false,
    refreshSelects: true
  });
  settingBinder.bindSetting({
    key: NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY,
    normalize: normalizeNewtabTopContentMode,
    apply: setNewtabTopContentTabState,
    refreshSelects: true
  });
  settingBinder.bindSetting({
    key: NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY,
    normalize: normalizeNewtabTimeFontWeight,
    apply: renderNewtabTimeFontWeightControl
  });
  [
    [NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY, normalizeNewtabShortcutColumns, renderNewtabShortcutColumnsControl],
    [NEWTAB_SHORTCUT_SIZE_STORAGE_KEY, normalizeNewtabShortcutSize, renderNewtabShortcutSizeControl],
    [NEWTAB_SHORTCUT_GAP_STORAGE_KEY, normalizeNewtabShortcutGap, renderNewtabShortcutGapControl]
  ].forEach(([key, normalize, render]) => {
    settingBinder.bindSetting({
      key,
      normalize,
      apply(value) {
        render(value, Boolean(newtabShortcutsToggle && !newtabShortcutsToggle.checked));
      },
      load: false
    });
  });
  loadNewtabShortcutSettings();
  settingBinder.bindSetting({
    key: NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY,
    normalize: SETTINGS.normalizeNewtabOpenInNewTab,
    apply: setNewtabOpenInNewTabState,
    repairOnLoad: false,
    repairOnChange: false
  });
  TOGGLE_SETTINGS.forEach((entry) => {
    const spec = Object.assign({}, entry, { input: toggleSettingControls.get(entry) });
    if (entry.control === 'select') {
      settingBinder.bindSelect(spec);
    } else {
      settingBinder.bindToggle(spec);
    }
  });
  loadAggregateSearchAutoGroupSetting();
  settingBinder.bindSetting({
    key: RESTRICTED_ACTION_STORAGE_KEY,
    // "lumno" is the old name of the default action.
    normalize: (value) => (value === 'none' ? 'none' : 'default'),
    apply(action) {
      if (restrictedActionSelect) {
        restrictedActionSelect.value = action;
      }
      setRestrictedActionTabState(action);
    },
    refreshSelects: true
  });

  refreshCustomSelects();

  document.addEventListener('click', (event) => {
    if (!activePopconfirm) {
      return;
    }
    const wrap = activePopconfirm.closest('._x_extension_popconfirm_wrap_2024_unique_');
    if (wrap && wrap.contains(event.target)) {
      return;
    }
    closeActivePopconfirm();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !activePopconfirm) {
      return;
    }
    const popconfirm = activePopconfirm;
    const closePopconfirm = popconfirm._xOptionsClosePopconfirm;
    if (typeof closePopconfirm !== 'function') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    closePopconfirm({ restoreFocus: true });
  });

  function resetSiteSearchForm() {
    if (siteSearchKeyInput) siteSearchKeyInput.value = '';
    if (siteSearchNameInput) siteSearchNameInput.value = '';
    if (siteSearchTemplateInput) siteSearchTemplateInput.value = '';
    if (siteSearchAliasInput) siteSearchAliasInput.value = '';
    setSiteSearchError('');
    setLegacySiteSearchDraftCategory('site');
    setEditingState(null);
    setSiteSearchFormExpanded(false);
  }

  setSiteSearchFormExpanded(false);

  function getLocalizedBuiltinProviderName(item) {
    if (!item || item._xIsCustom) {
      return item && (item.name || item.key) ? (item.name || item.key) : '';
    }
    const mapping = SEARCH_UTILS.getSiteSearchProviderDisplayNameMessage(item);
    if (!mapping) {
      return item.name || item.key;
    }
    return getMessage(mapping.messageKey, mapping.fallback);
  }

  function getSiteSearchItemIconUrl(item) {
    if (!item) {
      return '';
    }
    const localIconAsset = !item._xIsCustom
      ? SHORTCUT_FAVICON.getSiteSearchPinnedIconAssetPath(item)
      : '';
    if (localIconAsset) {
      return chrome.runtime.getURL(localIconAsset);
    }
    if (item.icon) {
      return String(item.icon || '').trim();
    }
    if (item.iconUrl) {
      return String(item.iconUrl || '').trim();
    }
    try {
      const template = normalizeSiteSearchTemplate(String(item.template || '').trim());
      const url = template.replace(/\{query\}/g, 'test');
      const hostname = new URL(url).hostname;
      return hostname
        ? `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(`https://${hostname}/`)}&size=64`
        : '';
    } catch (error) {
      return '';
    }
  }

  function getSiteSearchListCopy() {
    return {
      aliasLabel: getMessage('shortcuts_label_alias', '别名'),
      aliasPlaceholder: getMessage('shortcuts_placeholder_alias', '选填，例如 小破站、油管等'),
      cancelLabel: getMessage('shortcuts_cancel', '取消'),
      categoryLabel: getMessage('shortcuts_label_display_group', '显示位置'),
      confirmLabel: getMessage('confirm_ok', '确认'),
      confirmMessage: getMessage('confirm_remove_item', '确认移除该项？'),
      confirmMessageKey: 'confirm_remove_item',
      editLabel: getMessage('shortcuts_edit', '编辑'),
      keyLabel: getMessage('shortcuts_label_key', '触发词'),
      keyPlaceholder: getMessage(
        'shortcuts_placeholder_required',
        '必填，如有多个用英文逗号分隔，如 jd,bili'
      ),
      nameLabel: getMessage('shortcuts_label_name', '显示名称'),
      namePlaceholder: getMessage(
        'shortcuts_placeholder_optional_default',
        '选填，默认使用触发词'
      ),
      removeLabel: getMessage('shortcuts_remove', '移除'),
      saveLabel: getMessage('shortcuts_save', '保存修改'),
      searchEngineCategoryLabel: getMessage(
        'search_scope_group_engines',
        '搜索引擎'
      ),
      siteCategoryLabel: getMessage('search_scope_group_sites', '站内搜索'),
      templateHelp: getMessage(
        'shortcuts_template_help',
        '1.打开你想添加的网站\n2.输入任一搜索词，触发搜索\n3.将搜索结果页面 url 粘贴在此处\n4.将关键词替换为{query}'
      ),
      templateLabel: getMessage('shortcuts_label_template', '搜索模板')
    };
  }

  function getSiteSearchProviderItemModel(item, builtinTemplateSet) {
    const normalizedTemplate = normalizeSiteSearchTemplate(
      String(item && item.template ? item.template : '').trim()
    );
    const isCustom = Boolean(item && item._xIsCustom);
    const isSearchEngine = isSearchEngineSiteSearchProvider(item);
    const duplicate = isCustom && normalizedTemplate && builtinTemplateSet.has(normalizedTemplate);
    return {
      aliasesText: Array.isArray(item.aliases) ? item.aliases.join(',') : '',
      badgeText: isCustom
        ? getMessage('shortcuts_badge_custom', '自定义')
        : isSearchEngine
          ? getMessage('search_scope_group_engines', '搜索引擎')
          : isAiSiteSearchProvider(item)
            ? getMessage('shortcuts_badge_ai', 'AI')
            : getMessage('shortcuts_badge_builtin', '内置'),
      category: isSearchEngine ? 'searchEngine' : 'site',
      duplicateLabel: duplicate
        ? getMessage('shortcuts_duplicate_tag', '与内置重复')
        : '',
      duplicateTemplate: duplicate ? normalizedTemplate : '',
      duplicateTooltip: duplicate
        ? getMessage('shortcuts_duplicate_action', '定位内置项')
        : '',
      iconUrl: getSiteSearchItemIconUrl(item),
      id: `${isCustom ? 'custom' : 'builtin'}:${String(item.key || '')}`,
      isBuiltin: !isCustom,
      key: String(item.key || ''),
      meta: `${item.key || ''} · ${item.template || ''}`,
      name: getLocalizedBuiltinProviderName(item),
      normalizedTemplate,
      secondaryBadgeText: isCustom
        ? (isSearchEngine
            ? getMessage('search_scope_group_engines', '搜索引擎')
            : getMessage('search_scope_group_sites', '站内搜索'))
        : isSearchEngine
          ? getMessage('shortcuts_badge_builtin', '内置')
          : '',
      template: String(item.template || ''),
      templateEditable: isCustom
    };
  }

  function renderSiteSearchListController(
    controller,
    items,
    placeholder,
    builtinTemplateSet
  ) {
    if (!controller || typeof controller.render !== 'function') {
      return false;
    }
    controller.render({
      copy: getSiteSearchListCopy(),
      items: (Array.isArray(items) ? items : []).map(
        (item) => getSiteSearchProviderItemModel(item, builtinTemplateSet)
      ),
      placeholder: placeholder || ''
    });
    return true;
  }

  function locateBuiltinSiteSearchProvider(normalizedTemplate) {
    const targetRow = Array.from(document.querySelectorAll(
      '[data-type="builtin"][data-template]'
    )).find((row) => row.getAttribute('data-template') === normalizedTemplate);
    if (!targetRow) {
      return;
    }
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetRow.removeAttribute('data-flash');
    void targetRow.offsetWidth;
    targetRow.setAttribute('data-flash', 'true');
    const onFlashEnd = () => {
      targetRow.removeAttribute('data-flash');
      targetRow.removeEventListener('animationend', onFlashEnd);
    };
    targetRow.addEventListener('animationend', onFlashEnd);
  }

  function handleSiteSearchProviderSave(key, isBuiltin, draft) {
    suspendSiteSearchRefresh(260);
    const item = (isBuiltin ? defaultSiteSearchProviders : customSiteSearchProviders)
      .find((entry) => String(entry.key || '') === key);
    const result = item
      ? siteSearchModel.editSiteSearchProvider(item, isBuiltin, draft, {
        createId: () => createPersistentId('source'),
        custom: customSiteSearchProviders,
        defaults: defaultSiteSearchProviders,
        disabledKeys: disabledSiteSearchKeys,
        hasKeyConflict: (value, allowedKey) => Boolean(findSiteSearchKeyConflict(value, allowedKey))
      })
      : { ok: false, error: 'toast_error' };
    if (!result.ok) {
      return Promise.resolve({ ok: false, error: getSiteSearchErrorMessage(result.error) });
    }
    return saveSiteSearchProviderState(result.custom, result.disabledKeys).then(() => {
      applySavedSiteSearchProviders(result.custom, result.disabledKeys);
      renderAggregateSearchList();
      return { ok: true };
    }).catch(() => {
      const error = getMessage('toast_error', '操作失败，请重试。');
      showToast(error, true);
      return { ok: false, error };
    });
  }

  function syncHelpCenterSearchEnabled() {
    if (!siteSearchProvidersLoaded) {
      return;
    }
    const enabled = [
      ...getActiveBuiltinSiteSearchProviders(
        defaultSiteSearchProviders,
        customSiteSearchProviders,
        disabledSiteSearchKeys
      ),
      ...customSiteSearchProviders
    ].some((item) => SEARCH_UTILS.isHelpCenterSiteSearchProvider(item));
    if (enabled !== helpCenterSearchEnabled) {
      helpCenterSearchEnabled = enabled;
      renderFeedbackSupport();
    }
  }

  function renderSiteSearchList() {
    syncHelpCenterSearchEnabled();
    if (!siteSearchEngineBuiltinList || !siteSearchCustomList || !siteSearchBuiltinList) {
      return;
    }
    const customKeys = new Set(
      customSiteSearchProviders.map((item) =>
        String(item.key || '').toLowerCase()
      )
    );
    const displayDefaults = defaultSiteSearchProviders.filter((item) => {
      const key = String(item.key || '').toLowerCase();
      return key && !customKeys.has(key) && !disabledSiteSearchKeys.has(key);
    });
    const displayEngineDefaults = displayDefaults.filter(isSearchEngineSiteSearchProvider);
    const displayAiDefaults = displayDefaults.filter(isAiSiteSearchProvider);
    const displaySearchDefaults = displayDefaults.filter(
      (item) => (
        !isSearchEngineSiteSearchProvider(item) && !isAiSiteSearchProvider(item)
      )
    );
    const builtinTemplateSet = new Set(
      getActiveBuiltinSiteSearchProviders(
        defaultSiteSearchProviders,
        customSiteSearchProviders,
        disabledSiteSearchKeys
      )
        .map((item) =>
          normalizeSiteSearchTemplate(String(item.template || '').trim())
        )
        .filter(Boolean)
    );
    const customItems = customSiteSearchProviders.map((item) => ({
      ...item,
      _xIsCustom: true
    }));
    const engineItems = displayEngineDefaults.map((item) => ({
      ...item,
      _xIsCustom: false
    }));
    const searchItems = displaySearchDefaults.map((item) => ({
      ...item,
      _xIsCustom: false
    }));
    const aiItems = displayAiDefaults.map((item) => ({
      ...item,
      _xIsCustom: false
    }));

    renderSiteSearchListController(
      siteSearchEngineBuiltinListController,
      engineItems,
      getMessage('shortcuts_empty_engines', '暂无内置搜索引擎'),
      builtinTemplateSet
    );
    syncClearButtonAvailability(customClearButton, customItems.length > 0);
    renderSiteSearchListController(
      siteSearchCustomListController,
      customItems,
      '',
      builtinTemplateSet
    );
    renderSiteSearchListController(
      siteSearchBuiltinListController,
      searchItems,
      getMessage('shortcuts_empty_builtin', '暂无内置站内搜索'),
      builtinTemplateSet
    );
    if (siteSearchAiBuiltinList) {
      renderSiteSearchListController(
        siteSearchAiBuiltinListController,
        aiItems,
        getMessage('shortcuts_empty_ai', '暂无内置 AI'),
        builtinTemplateSet
      );
    }
    initTooltips();
    if (
      pendingOptionsScrollTarget &&
      scrollToOptionsTarget(pendingOptionsScrollTarget, { behavior: 'auto' })
    ) {
      pendingOptionsScrollTarget = '';
    }
  }

  function loadDefaultSiteSearchProviders() {
    const localUrl = chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function'
      ? chrome.runtime.getURL('assets/data/site-search.json')
      : '../../assets/data/site-search.json';
    return fetch(localUrl)
      .then((resp) => resp.json())
      .then((data) => {
        const items = data && Array.isArray(data.items) ? data.items : [];
        const source = items.length > 0 ? items : fallbackSiteSearchProviders;
        return source.map((item) => normalizeSiteSearchProvider(item)).filter(Boolean);
      })
      .catch(() => new Promise((resolve) => {
        if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
          resolve(fallbackSiteSearchProviders.slice());
          return;
        }
        chrome.runtime.sendMessage({ action: 'getSiteSearchProviders' }, (response) => {
          const items = response && Array.isArray(response.items) ? response.items : [];
          const source = items.length > 0 ? items : fallbackSiteSearchProviders;
          resolve(source.map((item) => normalizeSiteSearchProvider(item)).filter(Boolean));
        });
      }));
  }

  function loadCustomSiteSearchProviders(baseItems) {
    return SETTINGS.readStorageValue(
      storageArea,
      chrome,
      SITE_SEARCH_STORAGE_KEY
    ).then((value) => {
      const items = Array.isArray(value) ? value : [];
      const baseMap = new Map((baseItems || []).map((item) => [
        String(item && item.key ? item.key : '').toLowerCase(),
        item
      ]));
      return items.map((item) => {
        const key = String(item && item.key ? item.key : '').toLowerCase();
        const builtinKey = getSiteSearchBuiltinKey(item);
        return normalizeSiteSearchProvider(item, baseMap.get(builtinKey || key));
      }).filter(Boolean);
    });
  }

  function loadDisabledSiteSearchKeys() {
    return SETTINGS.readStorageValue(
      storageArea,
      chrome,
      SITE_SEARCH_DISABLED_STORAGE_KEY
    ).then((value) => {
      const items = Array.isArray(value) ? value : [];
      return items.map((item) => String(item).toLowerCase()).filter(Boolean);
    });
  }

  function writeDisabledSiteSearchKeys(keys) {
    const payload = Array.from(keys || [])
      .map((item) => String(item).toLowerCase())
      .filter(Boolean);
    return SETTINGS.writeStorageValue(
      rawStorageArea,
      chrome,
      SITE_SEARCH_DISABLED_STORAGE_KEY,
      payload
    );
  }

  function writeSiteSearchProviderState(items, keys) {
    const providersPayload = (items || [])
      .map((item) => normalizeSiteSearchProvider(item))
      .filter(Boolean);
    const disabledPayload = Array.from(keys || [])
      .map((item) => String(item).toLowerCase())
      .filter(Boolean);
    const payload = {
      [SITE_SEARCH_STORAGE_KEY]: providersPayload,
      [SITE_SEARCH_DISABLED_STORAGE_KEY]: disabledPayload
    };
    return SETTINGS.writeStorageValues(rawStorageArea, chrome, payload);
  }

  function saveDisabledSiteSearchKeys(keys) {
    return enqueueSiteSearchProviderStorageOperation(
      () => writeDisabledSiteSearchKeys(keys)
    );
  }

  function saveSiteSearchProviderState(items, keys) {
    return enqueueSiteSearchProviderStorageOperation(
      () => writeSiteSearchProviderState(items, keys)
    );
  }

  function normalizeAggregateSearches(value) {
    return AGGREGATE_SEARCH_STORE.normalizeAggregateSearches(value);
  }

  function deriveLegacyAggregateSearchAutoGroupEnabled(value) {
    return aggregateSearchModel.deriveLegacyAutoGroupEnabled(value);
  }

  function getAggregateSearchProviderSourceRef(provider) {
    return AGGREGATE_SEARCH_STORE.getProviderSourceRef(provider);
  }

  function getAggregateSearchAvailableProviders() {
    const activeDefaults = defaultSiteSearchProviders.filter((item) => {
      const key = String(item && item.key ? item.key : '').trim().toLowerCase();
      return key && !disabledSiteSearchKeys.has(key);
    });
    const aggregateCustomProviders = customSiteSearchProviderIdsReady
      ? customSiteSearchProviders
      : customSiteSearchProviders.filter((item) => String(item && item.id ? item.id : '').trim());
    return SEARCH_UTILS.mergeCustomProviders(activeDefaults, aggregateCustomProviders);
  }

  function getAggregateSearchProviderGroup(provider) {
    if (isAiSiteSearchProvider(provider)) {
      return {
        group: 'aiSearch',
        label: getMessage('shortcuts_group_ai', 'AI')
      };
    }
    if (isSearchEngineSiteSearchProvider(provider)) {
      return {
        group: 'searchEngine',
        label: getMessage('search_scope_group_engines', '搜索引擎')
      };
    }
    return {
      group: 'site',
      label: getMessage('search_scope_group_sites', '站内搜索')
    };
  }

  function getAggregateSearchListCopy() {
    return {
      addLabel: getMessage('aggregate_search_add', '添加聚合搜索'),
      cancelLabel: getMessage('shortcuts_cancel', '取消'),
      confirmLabel: getMessage('confirm_ok', '确认'),
      confirmMessage: getMessage('confirm_remove_item', '确认移除该项？'),
      confirmMessageKey: 'confirm_remove_item',
      defaultNameBase: getMessage('aggregate_search_default_name', '聚合搜索'),
      editLabel: getMessage('shortcuts_edit', '编辑'),
      groupBadge: getMessage('aggregate_search_badge', '聚合'),
      keyLabel: getMessage('shortcuts_label_key', '触发词'),
      keyPlaceholder: getMessage('aggregate_search_key_placeholder', '例如 tech'),
      keyRequiredError: getMessage('shortcuts_error_key', '请填写触发词。'),
      keySpaceError: getMessage('shortcuts_error_key_space', '触发词不能包含空格。'),
      maxSourcesError: getMessage(
        'aggregate_search_max_sources_error',
        '最多可选择 10 个搜索源。'
      ),
      minSourcesError: getMessage(
        'aggregate_search_min_sources_error',
        '请至少选择 2 个搜索源。'
      ),
      nameLabel: getMessage('aggregate_search_name_label', '名称'),
      nameRequiredError: getMessage(
        'aggregate_search_name_required_error',
        '请填写聚合搜索名称。'
      ),
      removeLabel: getMessage('shortcuts_remove', '移除'),
      saveLabel: getMessage('shortcuts_save', '保存修改'),
      selectedCountLabel: getMessage('aggregate_search_selected_count', '已选 {count}/{max}'),
      sourcesLabel: getMessage('aggregate_search_sources_label', '搜索源'),
      unavailableGroupLabel: getMessage(
        'aggregate_search_unavailable_group',
        '不可用的搜索源'
      ),
      unavailableSourceLabel: getMessage(
        'aggregate_search_unavailable_name',
        '不可用的搜索源（{source}）'
      )
    };
  }

  function getAggregateSearchProviderModels() {
    const providers = getAggregateSearchAvailableProviders();
    const availableRefs = new Set();
    const models = providers.map((provider) => {
      const sourceRef = getAggregateSearchProviderSourceRef(provider);
      if (!sourceRef) {
        return null;
      }
      availableRefs.add(sourceRef);
      const grouping = getAggregateSearchProviderGroup(provider);
      return {
        available: true,
        group: grouping.group,
        groupLabel: grouping.label,
        iconUrl: getSiteSearchItemIconUrl(provider),
        name: getLocalizedBuiltinProviderName(provider),
        sourceRef
      };
    }).filter(Boolean);
    const unavailableRefs = Array.from(new Set(
      aggregateSearches.flatMap((item) => Array.isArray(item.sourceRefs) ? item.sourceRefs : [])
    )).filter((ref) => !availableRefs.has(ref));
    unavailableRefs.forEach((sourceRef) => {
      models.push({
        available: false,
        group: 'unavailable',
        groupLabel: getMessage('aggregate_search_unavailable_group', '不可用的搜索源'),
        name: formatTemplate(
          getMessage('aggregate_search_unavailable_name', '不可用的搜索源（{source}）'),
          { source: sourceRef }
        ),
        sourceRef
      });
    });
    return models;
  }

  function getAggregateSearchItemModel(item) {
    const count = Array.isArray(item && item.sourceRefs) ? item.sourceRefs.length : 0;
    const providers = getAggregateSearchAvailableProviders();
    const availability = AGGREGATE_SEARCH_STORE.getAggregateSearchAvailability(item, providers);
    if (!availability.available) {
      return {
        id: String(item && item.id ? item.id : ''),
        key: String(item && item.key ? item.key : ''),
        name: String(item && item.name ? item.name : ''),
        sourceRefs: Array.isArray(item && item.sourceRefs) ? item.sourceRefs.slice() : [],
        sourceSummary: formatTemplate(
          getMessage(
            'aggregate_search_source_summary_unavailable',
            '{count} sources · {unavailable} unavailable · Update required'
          ),
          {
            count,
            unavailable: Number(availability.unavailableSourceCount) || 0
          }
        )
      };
    }
    return {
      id: String(item && item.id ? item.id : ''),
      key: String(item && item.key ? item.key : ''),
      name: String(item && item.name ? item.name : ''),
      sourceRefs: Array.isArray(item && item.sourceRefs) ? item.sourceRefs.slice() : [],
      sourceSummary: formatTemplate(
        getMessage('aggregate_search_source_summary', '{count} sources'),
        { count }
      )
    };
  }

  function renderAggregateSearchList() {
    if (!aggregateSearchListController || typeof aggregateSearchListController.render !== 'function') {
      return;
    }
    syncClearButtonAvailability(aggregateSearchClearButton, aggregateSearches.length > 0);
    aggregateSearchListController.render({
      copy: getAggregateSearchListCopy(),
      items: aggregateSearches.map(getAggregateSearchItemModel),
      maxKeyLength: aggregateSearchModel.limits.maxKeyLength,
      maxNameLength: aggregateSearchModel.limits.maxNameLength,
      maxSourceCount: aggregateSearchModel.limits.maxSources,
      minSourceCount: aggregateSearchModel.limits.minSources,
      providers: getAggregateSearchProviderModels()
    });
  }

  function saveAggregateSearches(items) {
    const serialized = AGGREGATE_SEARCH_STORE.serializeAggregateSearches(items);
    const serializedBytes = AGGREGATE_SEARCH_STORE.getSerializedStorageByteLength(
      serialized,
      AGGREGATE_SEARCH_STORAGE_KEY
    );
    const byteBudget = Number(AGGREGATE_SEARCH_STORE.SYNC_ITEM_BYTE_BUDGET) || 7800;
    if (getActivePrimaryAreaName() === 'sync' && serializedBytes > byteBudget) {
      return Promise.reject(new Error('aggregate-search-sync-item-quota-exceeded'));
    }
    return SETTINGS.writeStorageValue(
      rawStorageArea,
      chrome,
      AGGREGATE_SEARCH_STORAGE_KEY,
      serialized
    ).then(() => serialized.items);
  }

  function getAggregateSearchStateCoordinator() {
    if (!aggregateSearchStateCoordinator) {
      aggregateSearchStateCoordinator = AGGREGATE_SEARCH.createAggregateSearchStateCoordinator({
        apply(items) {
          aggregateSearches = items;
          aggregateSearchesReady = true;
          renderAggregateSearchList();
        },
        getCurrent() {
          return aggregateSearches;
        },
        load() {
          const loader = AGGREGATE_SEARCH_STORE.loadAggregateSearches;
          if (typeof loader !== 'function') {
            throw new Error('aggregate-search-runtime-unavailable');
          }
          return loader(rawStorageArea, AGGREGATE_SEARCH_STORAGE_KEY, chrome);
        },
        normalize: normalizeAggregateSearches,
        onLoadError(error) {
          aggregateSearchesReady = false;
          console.warn('[Lumno] Could not load aggregate searches.', error);
          showToast(getMessage('toast_error', '操作失败，请重试。'), true);
        },
        save: saveAggregateSearches
      });
    }
    return aggregateSearchStateCoordinator;
  }

  function refreshAggregateSearches() {
    return getAggregateSearchStateCoordinator().refresh();
  }

  storageChanges.on(AGGREGATE_SEARCH_STORAGE_KEY, (changes) => {
    getAggregateSearchStateCoordinator().applyStorageChange(
      changes[AGGREGATE_SEARCH_STORAGE_KEY].newValue
    );
  });

  function handleAggregateSearchSave(id, draft) {
    if (!aggregateSearchesReady) {
      return Promise.resolve({ ok: false, error: getAggregateSearchErrorMessage('storage_unavailable') });
    }
    const built = aggregateSearchModel.buildAggregateSearchItem(id, draft, {
      availableProviders: getAggregateSearchAvailableProviders(),
      createId: () => createPersistentId('aggregate'),
      hasKeyConflict: (key, currentId) => Boolean(findSiteSearchKeyConflict(key, '', currentId)),
      items: aggregateSearches
    });
    if (!built.ok) {
      return Promise.resolve({ ok: false, error: getAggregateSearchErrorMessage(built.error) });
    }
    return getAggregateSearchStateCoordinator().enqueueMutation((items) => {
      const merged = aggregateSearchModel.mergeAggregateSearchItem(items, built.item, id);
      return merged.ok ? merged : { ok: false, error: getAggregateSearchErrorMessage(merged.error) };
    }).then((result) => {
      if (!result || !result.ok) {
        return result;
      }
      showToast(getMessage('toast_saved', '已保存'), false);
      return { ok: true };
    }).catch(() => {
      const error = getMessage('toast_error', '操作失败，请重试。');
      showToast(error, true);
      return { ok: false, error };
    });
  }

  function getAggregateSearchErrorMessage(errorKey) {
    switch (errorKey) {
      case 'storage_unavailable':
        return getMessage(
          'aggregate_search_storage_unavailable_error',
          'Aggregate searches could not be loaded. Reload Settings and try again.'
        );
      case 'aggregate_search_name_required_error':
        return getMessage('aggregate_search_name_required_error', '请填写聚合搜索名称。');
      case 'aggregate_search_min_sources_error':
        return getMessage('aggregate_search_min_sources_error', '请至少选择 2 个搜索源。');
      case 'aggregate_search_max_sources_error':
        return getMessage('aggregate_search_max_sources_error', '最多可选择 10 个搜索源。');
      case 'aggregate_search_source_selection_unavailable_error':
        return getMessage(
          'aggregate_search_source_selection_unavailable_error',
          'Remove unavailable sources and select at least two available sources.'
        );
      case 'aggregate_search_max_items_error':
        return getMessage('aggregate_search_max_items_error', '最多可创建 8 个聚合搜索。');
      case 'aggregate_search_name_duplicate_error':
        return getMessage('aggregate_search_name_duplicate_error', '已存在同名的聚合搜索。');
      default:
        return getSiteSearchErrorMessage(errorKey);
    }
  }

  function handleAggregateSearchRemove(id) {
    if (!aggregateSearchesReady) {
      showToast(getAggregateSearchErrorMessage('storage_unavailable'), true);
      return Promise.resolve();
    }
    return getAggregateSearchStateCoordinator().enqueueMutation((items) => ({
      items: items.filter((item) => String(item.id || '') !== String(id || '')),
      ok: true
    })).then(() => {
      showToast(getMessage('toast_removed', '已移除'), false);
    }).catch(() => {
      showToast(getMessage('toast_error', '操作失败，请重试。'), true);
    });
  }

  function handleAggregateSearchClear() {
    if (!aggregateSearchesReady) {
      showToast(getAggregateSearchErrorMessage('storage_unavailable'), true);
      return Promise.resolve();
    }
    return getAggregateSearchStateCoordinator().enqueueMutation(() => ({
      items: [],
      ok: true
    })).then(() => {
      showToast(getMessage('toast_cleared', '已清空'), false);
    }).catch(() => {
      showToast(getMessage('toast_error', '操作失败，请重试。'), true);
    });
  }

  function loadSearchBlacklistItems() {
    return new Promise((resolve) => {
      if (!storageArea) {
        resolve([]);
        return;
      }
      storageArea.get([SEARCH_BLACKLIST_STORAGE_KEY], (result) => {
        resolve(normalizeBlacklistItems(result && result[SEARCH_BLACKLIST_STORAGE_KEY]));
      });
    });
  }

  function saveSearchBlacklistItems(items) {
    return new Promise((resolve) => {
      if (!storageArea) {
        resolve([]);
        return;
      }
      const normalized = normalizeBlacklistItems(items);
      storageArea.set({ [SEARCH_BLACKLIST_STORAGE_KEY]: normalized }, () => resolve(normalized));
    });
  }

  function loadFaviconRequestBlacklistItems() {
    return new Promise((resolve) => {
      if (!storageArea) {
        resolve([]);
        return;
      }
      storageArea.get([FAVICON_REQUEST_BLACKLIST_STORAGE_KEY], (result) => {
        resolve(normalizeBlacklistItems(result && result[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]));
      });
    });
  }

  function saveFaviconRequestBlacklistItems(items) {
    return new Promise((resolve) => {
      const normalized = normalizeBlacklistItems(items);
      if (!storageArea) {
        resolve(normalized);
        return;
      }
      storageArea.set({ [FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]: normalized }, () => resolve(normalized));
    });
  }

  function getBlacklistListCopy() {
    return {
      cancelLabel: getMessage('shortcuts_cancel', '取消'),
      confirmLabel: getMessage('confirm_ok', '确认'),
      confirmMessage: getMessage('confirm_remove_item', '确认移除该项？'),
      confirmMessageKey: 'confirm_remove_item',
      editLabel: getMessage('shortcuts_edit', '编辑'),
      matchLabel: getMessage('blacklist_match_label', '匹配方式'),
      modeOptions: [
        {
          mode: 'suffix',
          label: getMessage('blacklist_match_suffix', '整个网站'),
          tooltip: getMessage(
            'blacklist_match_suffix_tooltip',
            '屏蔽这个网站的所有页面，也包括它的子网站\n────────\n例如，填 baidu.com 后，baidu.com/search 和 tieba.baidu.com 都不会出现。'
          )
        },
        {
          mode: 'exact',
          label: getMessage('blacklist_match_exact', '当前页面'),
          tooltip: getMessage(
            'blacklist_match_exact_tooltip',
            '只屏蔽这一页\n────────\n例如，填 x.com/home 后，只有这一页不会出现，其他页面不受影响。'
          )
        },
        {
          mode: 'prefix',
          label: getMessage('blacklist_match_prefix', '当前站点路径'),
          tooltip: getMessage(
            'blacklist_match_prefix_tooltip',
            '只屏蔽这个站点下这一路径的页面\n────────\n例如，填 baidu.com/search 后，baidu.com/search 和 baidu.com/search/1 不会出现，但 baidu.com/news 不受影响。'
          )
        }
      ],
      placeholderDomain: getMessage('blacklist_placeholder_domain', 'baidu.com'),
      placeholderExact: getMessage('blacklist_placeholder_exact', 'example.com/path'),
      placeholderPrefix: getMessage(
        'blacklist_placeholder_prefix',
        'baidu.com or baidu.com/search'
      ),
      removeLabel: getMessage('shortcuts_remove', '移除'),
      saveLabel: getMessage('shortcuts_save', '保存修改'),
      urlLabel: getMessage('blacklist_label_url', 'URL rule')
    };
  }

  function getBlacklistListItemModel(item) {
    const badgeConfig = getBlacklistMatchBadgeConfig(item.matchModes);
    return {
      key: buildBlacklistItemKey(item),
      badgeText: badgeConfig.text,
      badgeTone: badgeConfig.tone,
      displayPattern: formatBlacklistPatternForDisplay(item),
      inputValue: getBlacklistPatternInputValue(item),
      matchModes: normalizeBlacklistMatchModes(item.matchModes)
    };
  }

  function renderBlacklistListWithReact(controller, items, editable) {
    if (!controller || typeof controller.render !== 'function') {
      return false;
    }
    controller.render({
      copy: getBlacklistListCopy(),
      editable: Boolean(editable),
      items: (Array.isArray(items) ? items : []).map(getBlacklistListItemModel)
    });
    initTooltips();
    return true;
  }

  function handleFaviconBlacklistRemove(itemKey) {
    const nextItems = faviconRequestBlacklistItems.filter(
      (entry) => buildBlacklistItemKey(entry) !== itemKey
    );
    return saveFaviconRequestBlacklistItems(nextItems).then((savedItems) => {
      faviconRequestBlacklistItems = savedItems;
      renderFaviconRequestBlacklistList();
      showToast(getMessage('favicon_blacklist_removed_toast', '已移除排除规则'), false);
    }).catch(() => {
      showToast(getMessage('toast_error', '操作失败，请重试。'), true);
    });
  }

  function handleSearchBlacklistRemove(itemKey) {
    const nextItems = searchBlacklistItems.filter(
      (entry) => buildBlacklistItemKey(entry) !== itemKey
    );
    return saveSearchBlacklistItems(nextItems).then((savedItems) => {
      searchBlacklistItems = savedItems;
      renderSearchBlacklistList();
      notifyNewtabSectionsRefresh('recent');
      showToast(getMessage('blacklist_removed_toast', '已从黑名单移除'), false);
    }).catch(() => {
      showToast(getMessage('toast_error', '操作失败，请重试。'), true);
    });
  }

  function handleSearchBlacklistSave(itemKey, inputValue, matchModes) {
    const draft = buildBlacklistRuleDraft(inputValue, matchModes);
    if (!draft.item) {
      return Promise.resolve({
        ok: false,
        error: draft.error || getMessage('toast_error', '操作失败，请重试。')
      });
    }
    const nextItems = upsertBlacklistItems(draft.item, itemKey);
    return persistBlacklistItems(
      nextItems,
      getMessage('toast_saved', '已保存')
    ).then(() => ({
      ok: true
    })).catch(() => {
      const error = getMessage('toast_error', '操作失败，请重试。');
      showToast(error, true);
      return {
        ok: false,
        error
      };
    });
  }

  function renderFaviconRequestBlacklistList() {
    if (!faviconBlacklistList) {
      return;
    }
    syncClearButtonAvailability(faviconBlacklistClearButton, faviconRequestBlacklistItems.length > 0);
    renderBlacklistListWithReact(
      faviconBlacklistListController,
      faviconRequestBlacklistItems,
      false
    );
  }

  function renderSearchBlacklistList() {
    if (!blacklistList) {
      return;
    }
    syncClearButtonAvailability(blacklistClearButton, searchBlacklistItems.length > 0);
    renderBlacklistListWithReact(
      searchBlacklistListController,
      searchBlacklistItems,
      true
    );
  }

  storageChanges.on(SEARCH_BLACKLIST_STORAGE_KEY, (changes) => {
    searchBlacklistItems = normalizeBlacklistItems(changes[SEARCH_BLACKLIST_STORAGE_KEY].newValue);
    renderSearchBlacklistList();
  });
  storageChanges.on(FAVICON_REQUEST_BLACKLIST_STORAGE_KEY, (changes) => {
    faviconRequestBlacklistItems = normalizeBlacklistItems(
      changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY].newValue
    );
    renderFaviconRequestBlacklistList();
  });

  function prepareSiteSearchProviderSnapshot(snapshot) {
    return siteSearchModel.prepareSiteSearchProviderSnapshot(snapshot, {
      debugDuplicateKey: DEBUG_DUPLICATE_CUSTOM_KEY
    });
  }

  async function loadSiteSearchProviderSnapshot() {
    const defaults = await loadDefaultSiteSearchProviders();
    const [custom, disabled] = await Promise.all([
      loadCustomSiteSearchProviders(defaults),
      loadDisabledSiteSearchKeys()
    ]);
    return { custom, defaults, disabled };
  }

  function getSiteSearchProviderRefreshCoordinator() {
    if (!siteSearchProviderRefreshCoordinator) {
      siteSearchProviderRefreshCoordinator = SITE_SEARCH.createSiteSearchProviderRefreshCoordinator({
        apply(prepared) {
          defaultSiteSearchProviders = prepared.defaults;
          customSiteSearchProviders = prepared.custom;
          customSiteSearchProviderIdsReady = true;
          disabledSiteSearchKeys = prepared.disabledKeys;
          siteSearchProvidersLoaded = true;
          renderSiteSearchList();
          renderAggregateSearchList();
        },
        load: loadSiteSearchProviderSnapshot,
        onError(error) {
          customSiteSearchProviderIdsReady = false;
          renderAggregateSearchList();
          console.warn('[Lumno] Could not load site search providers.', error);
          showToast(getMessage('toast_error', '操作失败，请重试。'), true);
        },
        persist: SITE_SEARCH.createSnapshotPersister({
          enqueue: enqueueSiteSearchProviderStorageOperation,
          load: loadSiteSearchProviderSnapshot,
          prepare: prepareSiteSearchProviderSnapshot,
          write: writeSiteSearchProviderState
        }),
        prepare: prepareSiteSearchProviderSnapshot
      });
    }
    return siteSearchProviderRefreshCoordinator;
  }

  function invalidateSiteSearchProviderRefresh() {
    if (siteSearchProviderRefreshCoordinator) {
      siteSearchProviderRefreshCoordinator.invalidate();
    }
  }

  function refreshSiteSearchProviders() {
    syncHelpCenterSearchEnabled();
    if (!siteSearchEngineBuiltinList || !siteSearchCustomList || !siteSearchBuiltinList) {
      return Promise.resolve();
    }
    if (defaultSiteSearchProviders.length === 0) {
      defaultSiteSearchProviders = fallbackSiteSearchProviders.slice();
      renderSiteSearchList();
    }
    customSiteSearchProviderIdsReady = false;
    renderAggregateSearchList();
    // A failed refresh was already reported through onError; one overtaken by
    // a newer refresh is dropped on purpose.
    return getSiteSearchProviderRefreshCoordinator().refresh().catch(() => {});
  }

  // A save on this page suspends refreshes briefly so its own write does not
  // re-render the list mid-edit; a change during that window refreshes after.
  storageChanges.on([SITE_SEARCH_STORAGE_KEY, SITE_SEARCH_DISABLED_STORAGE_KEY], () => {
    invalidateSiteSearchProviderRefresh();
    const now = Date.now();
    if (siteSearchRefreshSuppressUntil && now < siteSearchRefreshSuppressUntil) {
      if (siteSearchRefreshTimer) {
        clearTimeout(siteSearchRefreshTimer);
      }
      const delay = Math.max(siteSearchRefreshSuppressUntil - now, 0) + 40;
      siteSearchRefreshTimer = setTimeout(() => {
        siteSearchRefreshTimer = null;
        refreshSiteSearchProviders();
      }, delay);
      return;
    }
    refreshSiteSearchProviders();
  });

  if (siteSearchEngineBuiltinList && siteSearchCustomList && siteSearchBuiltinList) {
    refreshSiteSearchProviders();
  }
  if (aggregateSearchList) {
    // Load failures are reported through onLoadError.
    refreshAggregateSearches().catch(() => {});
  }
  if (blacklistList) {
    loadSearchBlacklistItems().then((items) => {
      searchBlacklistItems = items;
      renderSearchBlacklistList();
    });
  }
  if (faviconBlacklistList) {
    loadFaviconRequestBlacklistItems().then((items) => {
      faviconRequestBlacklistItems = items;
      renderFaviconRequestBlacklistList();
    });
  }

  function handleSiteSearchListClick(event) {
      if (event.currentTarget &&
          event.currentTarget.getAttribute('data-react-island') === 'options-site-search-list') {
        return;
      }
      const target = event.target;
      if (!target) {
        return;
      }
      const editTarget = target.closest ? target.closest('button[data-edit-key]') : null;
      if (editTarget) {
        const key = String(editTarget.dataset.editKey || '');
        const isBuiltin = editTarget.dataset.editType === 'builtin';
        const match = isBuiltin
          ? defaultSiteSearchProviders.find((item) => String(item.key || '') === key)
          : customSiteSearchProviders.find((item) => String(item.key || '') === key);
        if (match) {
          const row = editTarget.closest('._x_extension_shortcut_item_2024_unique_');
          if (row) {
            row.setAttribute('data-expanded', row.getAttribute('data-expanded') === 'true' ? 'false' : 'true');
          }
          return;
        }
        return;
      }
      if (target.closest && target.closest('._x_extension_popconfirm_2024_unique_')) {
        return;
      }
    }

  if (siteSearchCustomList) {
    siteSearchCustomList.addEventListener('click', handleSiteSearchListClick);
  }
  if (siteSearchEngineBuiltinList) {
    siteSearchEngineBuiltinList.addEventListener('click', handleSiteSearchListClick);
  }
  if (siteSearchBuiltinList) {
    siteSearchBuiltinList.addEventListener('click', handleSiteSearchListClick);
  }
  if (siteSearchAiBuiltinList) {
    siteSearchAiBuiltinList.addEventListener('click', handleSiteSearchListClick);
  }

  if (siteSearchCancelButton) {
    siteSearchCancelButton.addEventListener('click', function() {
      resetSiteSearchForm();
    });
  }

  if (siteSearchFormTrigger) {
    siteSearchFormTrigger.addEventListener('click', () => {
      setSiteSearchFormExpanded(true);
    });
  }

  if (siteSearchInsertQueryButton) {
    siteSearchInsertQueryButton.addEventListener('click', () => {
      setSiteSearchFormExpanded(true);
      insertSiteSearchQueryToken();
    });
  }

  siteSearchCategoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setLegacySiteSearchDraftCategory(button.dataset.siteSearchCategory);
    });
  });

  if (siteSearchAddButton) {
    attachSaveButtonAnimation(siteSearchAddButton);
    siteSearchAddButton.addEventListener('click', function() {
      if (!siteSearchFormExpanded) {
        setSiteSearchFormExpanded(true);
        return;
      }
      suspendSiteSearchRefresh(260);
      setSiteSearchError('');
      const key = String(siteSearchKeyInput ? siteSearchKeyInput.value : '').trim();
      const name = String(siteSearchNameInput ? siteSearchNameInput.value : '').trim();
      const templateRaw = String(siteSearchTemplateInput ? siteSearchTemplateInput.value : '').trim();
      const aliases = normalizeAliases(siteSearchAliasInput ? siteSearchAliasInput.value : '');
      if (!key) {
        setSiteSearchError(getMessage('shortcuts_error_key', '请填写触发词。'));
        return;
      }
      if (/\s/.test(key)) {
        setSiteSearchError(getMessage('shortcuts_error_key_space', '触发词不能包含空格。'));
        return;
      }
      if (findSiteSearchKeyConflict(key, editingSiteSearchKey || '')) {
        setSiteSearchError(getMessage('shortcuts_error_key_duplicate', '该触发词已存在，请更换。'));
        return;
      }
      const template = normalizeSiteSearchTemplate(templateRaw);
      if (!template || !template.includes('{query}')) {
        setSiteSearchError(getMessage('toast_error_template', '搜索模板必须包含 {query}。'));
        return;
      }
      const normalizedKey = key.toLowerCase();
      const editingItem = customSiteSearchProviders.find(
        (item) => String(item.key || '').toLowerCase() === String(editingSiteSearchKey || '').toLowerCase()
      );
      const builtinKey = getSiteSearchBuiltinKey(editingItem);
      let next = customSiteSearchProviders.filter((item) => String(item.key || '').toLowerCase() !== normalizedKey);
      if (editingSiteSearchKey && editingSiteSearchKey.toLowerCase() !== normalizedKey) {
        next = next.filter((item) => String(item.key || '').toLowerCase() !== editingSiteSearchKey.toLowerCase());
      }
      const nextItem = normalizeSiteSearchProvider({
        ...(editingItem || {}),
        id: String(editingItem && editingItem.id ? editingItem.id : '').trim() || createPersistentId('source'),
        key: key,
        name: name || key,
        template: template,
        aliases: aliases,
        category: siteSearchDraftCategory === 'searchEngine' ? 'searchEngine' : 'site',
        ...(builtinKey ? { builtinKey } : {})
      });
      if (!nextItem) {
        setSiteSearchError(getMessage('toast_error', '操作失败，请重试。'));
        return;
      }
      next.unshift(nextItem);
      const lowerKey = normalizedKey;
      const nextDisabledKeys = new Set(disabledSiteSearchKeys);
      if (builtinKey) {
        nextDisabledKeys.add(builtinKey);
      } else {
        nextDisabledKeys.delete(lowerKey);
      }
      saveSiteSearchProviderState(next, nextDisabledKeys).then(() => {
        customSiteSearchProviders = next;
        customSiteSearchProviderIdsReady = true;
        disabledSiteSearchKeys = nextDisabledKeys;
        renderSiteSearchList();
        refreshSiteSearchProviders();
        resetSiteSearchForm();
        showToast(getMessage('toast_saved', '已保存'), false);
      }).catch(() => {
        setSiteSearchError(getMessage('toast_error', '操作失败，请重试。'));
        showToast(getMessage('toast_error', '操作失败，请重试。'), true);
      });
    });
  }

  if (builtinResetButton) {
    attachPopconfirm(
      builtinResetButton,
      'confirm_reset_builtin',
      '确认重置内置列表？',
      () => {
        loadDefaultSiteSearchProviders().then((defaults) => Promise.all([
          Promise.resolve(defaults),
          loadCustomSiteSearchProviders(defaults)
        ])).then(([defaults, custom]) => {
          const defaultKeys = new Set((defaults || []).map((item) => String(item.key || '').toLowerCase()));
          const filteredCustom = (custom || []).filter((item) => {
            const key = String(item && item.key ? item.key : '').toLowerCase();
            const builtinKey = getSiteSearchBuiltinKey(item);
            return key && !defaultKeys.has(key) && !defaultKeys.has(builtinKey);
          });
          saveSiteSearchProviderState(filteredCustom, new Set()).then(() => {
            customSiteSearchProviders = filteredCustom;
            customSiteSearchProviderIdsReady = true;
            disabledSiteSearchKeys = new Set();
            renderSiteSearchList();
            renderAggregateSearchList();
          }).catch(() => {
            showToast(getMessage('toast_error', '操作失败，请重试。'), true);
          });
        }).catch(() => {
          showToast(getMessage('toast_error', '操作失败，请重试。'), true);
        });
      }
    );
  }

  if (customClearButton) {
    attachPopconfirm(
      customClearButton,
      'confirm_clear_custom',
      '确认清空自定义搜索？',
      () => {
        const nextDisabledKeys = new Set(disabledSiteSearchKeys);
        customSiteSearchProviders.forEach((item) => {
          const builtinKey = getSiteSearchBuiltinKey(item);
          if (builtinKey) {
            nextDisabledKeys.delete(builtinKey);
          }
        });
        saveSiteSearchProviderState([], nextDisabledKeys).then(() => {
          customSiteSearchProviders = [];
          customSiteSearchProviderIdsReady = true;
          disabledSiteSearchKeys = nextDisabledKeys;
          renderSiteSearchList();
          renderAggregateSearchList();
          showToast(getMessage('toast_cleared', '已清空'), false);
        }).catch(() => {
          showToast(getMessage('toast_error', '操作失败，请重试。'), true);
        });
      }
    );
  }

  if (aggregateSearchClearButton) {
    attachPopconfirm(
      aggregateSearchClearButton,
      'confirm_clear_aggregate_search',
      '确认清空聚合搜索？',
      handleAggregateSearchClear
    );
  }

  if (blacklistClearButton) {
    attachPopconfirm(
      blacklistClearButton,
      'confirm_clear_blacklist',
      '确认清空黑名单？',
      () => {
        saveSearchBlacklistItems([]).then((savedItems) => {
          searchBlacklistItems = savedItems;
          renderSearchBlacklistList();
          resetBlacklistForm();
          notifyNewtabSectionsRefresh('recent');
          showToast(getMessage('toast_cleared', '已清空'), false);
        }).catch(() => {
          showToast(getMessage('toast_error', '操作失败，请重试。'), true);
        });
      }
    );
  }
  if (faviconBlacklistClearButton) {
    attachPopconfirm(
      faviconBlacklistClearButton,
      'confirm_clear_favicon_blacklist',
      '确认清空排除规则？',
      () => {
        saveFaviconRequestBlacklistItems([]).then((savedItems) => {
          faviconRequestBlacklistItems = savedItems;
          renderFaviconRequestBlacklistList();
          resetFaviconBlacklistForm();
          showToast(getMessage('toast_cleared', '已清空'), false);
        }).catch(() => showToast(getMessage('toast_error', '操作失败，请重试。'), true));
      }
    );
  }
  addStorageChangeListener(storageChanges.dispatch);
})();
