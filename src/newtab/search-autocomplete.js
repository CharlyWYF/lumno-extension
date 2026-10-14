(function(root) {
  // Inline autocomplete for the search input.
  function createSearchAutocomplete(deps) {
    const {
      getUrlDisplay,
      isEnglishQuery,
      getKeywordSearchSuggestionState
    } = deps;

    // The page state object shared with newtab.js and the other modules.
    const pageState = deps.pageState;

    function getAutocompleteCandidate(allSuggestions, rawQuery) {
      if (!Array.isArray(allSuggestions) || !rawQuery) {
        return null;
      }
      const rawLower = rawQuery.toLowerCase();
      const passes = [true, false];
      for (let passIndex = 0; passIndex < passes.length; passIndex += 1) {
        const skipGoogleSuggest = passes[passIndex];
        for (let i = 0; i < allSuggestions.length; i += 1) {
          const suggestion = allSuggestions[i];
          if (!suggestion || suggestion.type === 'newtab') {
            continue;
          }
          if (skipGoogleSuggest && suggestion.type === 'googleSuggest') {
            continue;
          }
          if (suggestion.commandText) {
            const commandText = String(suggestion.commandText).toLowerCase();
            if (commandText.startsWith(rawLower)) {
              return {
                completion: suggestion.commandText,
                url: '',
                title: suggestion.title || '',
                type: 'command'
              };
            }
            const aliases = Array.isArray(suggestion.commandAliases) ? suggestion.commandAliases : [];
            for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex += 1) {
              const alias = String(aliases[aliasIndex] || '').toLowerCase();
              if (alias && alias.startsWith(rawLower)) {
                return {
                  completion: aliases[aliasIndex],
                  url: '',
                  title: suggestion.title || '',
                  type: 'command'
                };
              }
            }
          }
          const urlText = getUrlDisplay(suggestion.url);
          if (urlText && urlText.toLowerCase().startsWith(rawLower)) {
            return {
              completion: urlText,
              url: suggestion.url || '',
              title: suggestion.title || '',
              type: 'url'
            };
          }
          const titleText = suggestion.title || '';
          if (titleText && titleText.toLowerCase().startsWith(rawLower)) {
            return {
              completion: titleText,
              url: suggestion.url || '',
              title: suggestion.title || '',
              type: 'title'
            };
          }
        }
      }
      return null;
    }

    function getDomainPrefixCandidate(allSuggestions, rawQuery) {
      if (!Array.isArray(allSuggestions) || !rawQuery) {
        return null;
      }
      const rawLower = rawQuery.toLowerCase();
      for (let i = 0; i < allSuggestions.length; i += 1) {
        const suggestion = allSuggestions[i];
        if (!suggestion || suggestion.type === 'newtab') {
          continue;
        }
        const urlText = getUrlDisplay(suggestion.url);
        if (!urlText) {
          continue;
        }
        const host = urlText.split('/')[0] || '';
        if (host.toLowerCase().startsWith(rawLower)) {
          return {
            completion: urlText,
            url: suggestion.url || '',
            title: suggestion.title || '',
            type: 'url'
          };
        }
      }
      return null;
    }

    function getAutocompleteCandidateFromSuggestion(suggestion, rawQuery) {
      if (!suggestion || !rawQuery || suggestion.type === 'newtab') {
        return null;
      }
      const rawLower = rawQuery.toLowerCase();
      if (suggestion.commandText) {
        const commandText = String(suggestion.commandText).toLowerCase();
        if (commandText.startsWith(rawLower)) {
          return {
            completion: suggestion.commandText,
            url: '',
            title: suggestion.title || '',
            type: 'command'
          };
        }
        const aliases = Array.isArray(suggestion.commandAliases) ? suggestion.commandAliases : [];
        for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex += 1) {
          const alias = String(aliases[aliasIndex] || '');
          if (alias.toLowerCase().startsWith(rawLower)) {
            return {
              completion: alias,
              url: '',
              title: suggestion.title || '',
              type: 'command'
            };
          }
        }
      }
      const urlText = getUrlDisplay(suggestion.url);
      if (urlText) {
        const host = urlText.split('/')[0] || '';
        if (host.toLowerCase().startsWith(rawLower) || urlText.toLowerCase().startsWith(rawLower)) {
          return {
            completion: urlText,
            url: suggestion.url || '',
            title: suggestion.title || '',
            type: 'url'
          };
        }
      }
      const titleText = suggestion.title || '';
      if (titleText && titleText.toLowerCase().startsWith(rawLower)) {
        return {
          completion: titleText,
          url: suggestion.url || '',
          title: suggestion.title || '',
          type: 'title'
        };
      }
      return null;
    }

    function clearAutocomplete() {
      pageState.autocompleteState = null;
    }

    function restoreUserAuthoredSearchInput() {
      if (!pageState.autocompleteState || !pageState.autocompleteState.completion) {
        return false;
      }
      const rawQuery = typeof pageState.autocompleteState.rawQuery === 'string'
        ? pageState.autocompleteState.rawQuery
        : String(pageState.latestRawQuery || '');
      if (pageState.inputParts && pageState.inputParts.input && pageState.inputParts.input.value !== rawQuery) {
        pageState.inputParts.input.value = rawQuery;
        pageState.inputParts.input.setSelectionRange(rawQuery.length, rawQuery.length);
      }
      pageState.latestRawQuery = rawQuery;
      pageState.latestQuery = rawQuery.trim();
      clearAutocomplete();
      return true;
    }

    function dismissAutocompletePreviewOnNonTabKey(event) {
      if (!event || event.key === 'Tab') {
        return false;
      }
      const isModifierOnly = event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta';
      if (isModifierOnly) {
        return false;
      }
      return restoreUserAuthoredSearchInput();
    }

    function applyAutocomplete(allSuggestions, primarySuggestion, primaryHighlightReason) {
      const rawQuery = pageState.latestRawQuery;
      const trimmedQuery = rawQuery.trim();
      if (pageState.searchResultPriorityMode === 'search') {
        if (pageState.inputParts && pageState.inputParts.input && pageState.inputParts.input.value !== rawQuery) {
          pageState.inputParts.input.value = rawQuery;
          pageState.inputParts.input.setSelectionRange(rawQuery.length, rawQuery.length);
        }
        clearAutocomplete();
        return;
      }
      if (Date.now() - pageState.lastDeletionAt < 250) {
        clearAutocomplete();
        return;
      }
      if (pageState.siteSearchState) {
        clearAutocomplete();
        return;
      }
      if (!isEnglishQuery(trimmedQuery) || !rawQuery) {
        clearAutocomplete();
        return;
      }
      if (!allSuggestions || !Array.isArray(allSuggestions)) {
        clearAutocomplete();
        return;
      }
      if (pageState.inputParts.input.selectionStart !== pageState.inputParts.input.value.length ||
          pageState.inputParts.input.selectionEnd !== pageState.inputParts.input.value.length) {
        return;
      }
      const shouldForcePrimaryAlignment = Boolean(
        primarySuggestion &&
        primaryHighlightReason &&
        primaryHighlightReason !== 'autocomplete' &&
        primaryHighlightReason !== 'default'
      );
      let candidate = null;
      if (primarySuggestion) {
        candidate = getAutocompleteCandidateFromSuggestion(primarySuggestion, rawQuery);
      }
      if (!candidate && shouldForcePrimaryAlignment) {
        clearAutocomplete();
        return;
      }
      if (!candidate) {
        const autocompleteSuggestions = getKeywordSearchSuggestionState(allSuggestions).autocompleteSuggestions;
        candidate = getDomainPrefixCandidate(autocompleteSuggestions, rawQuery) ||
          getAutocompleteCandidate(autocompleteSuggestions, rawQuery);
      }
      if (!candidate || !candidate.completion) {
        clearAutocomplete();
        return;
      }
      if (candidate.type === 'title') {
        clearAutocomplete();
        return;
      }
      if (candidate.completion.length <= rawQuery.length) {
        clearAutocomplete();
        return;
      }
      if (!candidate.completion.toLowerCase().startsWith(rawQuery.toLowerCase())) {
        clearAutocomplete();
        return;
      }
      const displayText = candidate.completion;
      pageState.inputParts.input.value = displayText;
      pageState.inputParts.input.setSelectionRange(rawQuery.length, displayText.length);
      pageState.autocompleteState = {
        completion: candidate.completion,
        displayText: displayText,
        url: candidate.url || '',
        rawQuery: rawQuery,
        title: candidate.title || '',
        type: candidate.type || ''
      };
    }

    return {
      getAutocompleteCandidate,
      clearAutocomplete,
      restoreUserAuthoredSearchInput,
      dismissAutocompletePreviewOnNonTabKey,
      applyAutocomplete
    };
  }

  root.LumnoNewtabSearchAutocomplete = { createSearchAutocomplete };
})(globalThis);
