# Search Sources Ordering Design

## Goal

Let a reader decide the order of every list on the Search sources settings page, and make the
search scope panel in the command bar and New Tab follow that order. Before this change the
order was whatever the built-in registry happened to declare, and a new custom search was always
pushed to the top of its group.

## Scope

Five surfaces are covered, and each one keeps its own group:

| List | Group id | Storage today |
| --- | --- | --- |
| Aggregate search | `aggregate` | order of the stored definitions array |
| AI search | `ai` | position inside the site-search provider arrays |
| Search engines | `engine` | position inside `assets/data/site-search.json` |
| Browser content | `local` | fixed order of enabled result source types |
| Site search | `site` | position inside `assets/data/site-search.json` |

The group blocks themselves are also orderable, because a reader who puts Site search first on the
settings page expects it first in the panel.

## Storage

One additive preference holds every custom order:

```
_x_extension_search_source_order_2026_unique_
{ version: 1,
  groups:    ['aggregate', 'ai', 'engine', 'local', 'site'],
  providers: [{ key: 'yt', group: 'site' }, ...],
  local:     ['topSite', 'bookmark', 'history'],
  aggregates:['<id>', ...] }
```

Design rules:

- **Flat, not nested.** Chrome Sync limits one item to 8 KB, and the record has to carry every
  provider, so it stores a flat list of short keys plus one group label per key. The record is
  1517 bytes for the 47 bundled providers, leaving room for custom searches.
- **Byte-bounded, not just entry-bounded.** `MAX_ORDER_ENTRIES` alone would allow a record above
  the 8 KB item limit once a reader imports several hundred custom providers, and an oversized
  preference fails the whole sync write and the whole WebDAV apply. `trimOrderToByteBudget` drops
  trailing aggregate then provider entries until the serialized record fits `MAX_RECORD_BYTES`.
  Group order and the browser content list are kept: they are a handful of short strings and carry
  the most visible part of the order.
- **Absent value means the alphabetical default, and it is not written.** Adding the key therefore
  needs no migration. The default is deterministic, so every device derives the same one; writing
  it on first load could overwrite an order another device has already synced, so a missing record
  is resolved on read and left alone. A failed read stays a failure for the same reason.
- **Positional, not numeric.** A stored entry is a position in a list, so removing or adding a
  provider does not require rewriting ranks.
- **Derived grouping stays derived.** Group membership continues to come from provider capability
  (`searchEngine` category, AI submit action, browser result source type). Only the order and the
  block order are stored, so a provider can never appear in two groups.

## Resolution

`normalizeOrder` reconciles the stored record against what the surface can actually render:

- A stored key that no longer exists is dropped, so a stale record cannot grow without bound.
- A provider the record does not mention is appended to the end of its group, alphabetized by
  display name. A provider added by a newer version therefore never displaces a chosen position.
- A stored key whose provider is currently disabled keeps its slot but is not rendered.

`rankMenuItems` gives the search scope panel a total order: group block first, then the configured
position inside the block, then the surface's own insertion order. A browser content item reads its
position from the `local` list, an aggregate search from `aggregates`, and everything else from
`providers`, so a source type can never borrow a provider's or an aggregate's rank. Both the
overlay and New Tab keep building their item list the way they always did and sort the finished
list, so the two surfaces cannot drift apart.

## Panel ordering is order-independent

The provider list a panel receives is the reader's order, so two providers can now resolve to the
same suggestion in a different sequence than before. `findProviderForSiteSearchSuggestion` ranks
its matches by how much of the provider's own template the suggested URL matches (Google Maps and
the Google engine share a host and are told apart by their route, with a search engine winning a
bare-root tie), and the selection-quick-action fallback is key-based instead of index-based. Both
keep their previous answers whatever the reader's order is.

## First-run default

Groups and providers sort alphabetically by display name, which puts **AI search** ahead of
**Search engines** and **Site search**, matching the request. `compareByDisplayName` uses
`localeCompare` with `numeric` and `sensitivity: 'base'`.

## Settings page

Each of the five lists gets one ordering affordance per row:

- a drag handle, so the row can be dragged; and
- up/down buttons, so the same operation stays available from the keyboard.

Both paths call one `onReorder(fromIndex, toIndex)` callback. The page rebuilds the whole provider
record positionally from its four displayed lists, which keeps disabled and not-yet-displayed
providers in the record. Group blocks are reordered from a dedicated panel above the lists.

## Copy

The AI list label read `AI` and its empty state `No built-in AI providers`. Both now read
`AI search` / `AI 搜索` / `AI 搜尋` / `AI検索`, matching the search scope group label.

## Contract impact

- `CHROME_SYNC_STORAGE_KEYS` gains one additive key; `options.js` `SYNC_KEYS` must stay identical
  to it, and the frozen key lists in `test-storage-data-safety.js` and `test-settings.js` are
  updated in the same change.
- WebDAV carries the key automatically through `PREFERENCE_KEYS`, so export and import follow
  without a separate contract change.
- No manifest, permission, storage-area, or extension-identity change.

## Validation

- `scripts/test-search-source-order.js` covers the record shape, the alphabetical default, the
  positional sort, reconciliation, rank composition and label keys.
- `scripts/test-search-source-order-integration.js` runs the same helpers against the real
  `assets/data/site-search.json` registry and the real merge path used by the background.
- `scripts/test-options-search-source-order.js` extracts the ordering functions from the real
  `options.js` and checks the rebuilt record, the group order, first-run seeding and load.
- React tests cover the reorder controls in both list islands, including the drag-drop index
  arithmetic.
- Full `npm run verify`, `npm run audit:i18n` and `npm run package:store`.
