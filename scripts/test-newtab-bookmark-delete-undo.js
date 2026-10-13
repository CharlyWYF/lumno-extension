const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const newtabJs = readNewtabRuntimeSource();
const newtabHtml = readPageSource('newtab.html');
const bookmarksRuntimeJs = fs.readFileSync(
  path.join(repoRoot, 'src', 'newtab', 'bookmarks-runtime.js'),
  'utf8'
);
const bookmarkDragJs = fs.readFileSync(
  path.join(repoRoot, 'src', 'newtab', 'bookmark-drag.js'),
  'utf8'
);
const bookmarksViewJs = fs.readFileSync(path.join(repoRoot, 'react-src', 'newtab', 'bookmarks.tsx'), 'utf8');
const cascadeJs = fs.readFileSync(path.join(repoRoot, 'src', 'newtab', 'bookmark-cascade-menu.js'), 'utf8');
const backgroundJs = fs.readFileSync(path.join(repoRoot, 'src', 'background', 'background.js'), 'utf8');
const {
  cloneBookmarkSnapshot,
  createBookmarkMoveHistory,
  createDeleteRecord
} = require(path.join(repoRoot, 'src', 'newtab', 'bookmark-move-history.js'));

const sourceTree = {
  id: 'folder-a',
  parentId: '1',
  index: 3,
  title: 'Folder A',
  children: [
    {
      id: 'link-a',
      title: 'Link A',
      url: 'https://example.com/a'
    },
    {
      id: 'folder-b',
      title: 'Folder B',
      children: [
        {
          id: 'link-b',
          title: 'Link B',
          url: 'https://example.com/b'
        }
      ]
    }
  ]
};
const snapshot = cloneBookmarkSnapshot(sourceTree);
assert.deepStrictEqual(snapshot, {
  title: 'Folder A',
  url: '',
  children: [
    {
      title: 'Link A',
      url: 'https://example.com/a',
      children: []
    },
    {
      title: 'Folder B',
      url: '',
      children: [
        {
          title: 'Link B',
          url: 'https://example.com/b',
          children: []
        }
      ]
    }
  ]
});
assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.children));

const deleteRecord = createDeleteRecord({
  bookmarkId: sourceTree.id,
  title: sourceTree.title,
  parentId: sourceTree.parentId,
  index: sourceTree.index,
  snapshot: sourceTree
});
assert.strictEqual(deleteRecord.kind, 'delete');
assert.strictEqual(deleteRecord.parentId, '1');
assert.strictEqual(deleteRecord.index, 3);
assert.strictEqual(deleteRecord.runtime.currentBookmarkId, '');

const history = createBookmarkMoveHistory({ maxEntries: 4 });
assert.strictEqual(history.push(deleteRecord), true);
const storedRecord = history.peekUndo();
assert.strictEqual(storedRecord.kind, 'delete');
storedRecord.runtime.currentBookmarkId = 'restored-folder-a';
assert.strictEqual(history.commitUndo().runtime.currentBookmarkId, 'restored-folder-a');
assert.strictEqual(history.peekRedo().runtime.currentBookmarkId, 'restored-folder-a');

assert.ok(
  bookmarksViewJs.includes('onContextMenu={(event) => {') &&
    bookmarksViewJs.includes('onItemContextMenu({'),
  'bookmark cards should expose the shared context-menu action'
);
assert.ok(
  cascadeJs.includes("itemButton.addEventListener('contextmenu'") &&
    cascadeJs.includes("sourceKind: 'cascade'"),
  'every cascade level should expose the same context-menu action'
);
assert.ok(
  newtabJs.includes("className: 'x-nt-shortcut-context-menu x-nt-bookmark-context-menu'") &&
    newtabJs.includes("label: t('bookmarks_delete', 'Delete')"),
  'bookmark deletion should reuse the shortcut context-menu surface'
);
assert.ok(
  newtabJs.includes("BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE = 'open-in-new-tab-group'") &&
    newtabJs.includes("label: t('newtab_open_in_new_tab', 'Open in new tab')") &&
    newtabJs.includes("openExternalNewTabUrl(target.url, 'newTab')") &&
    newtabJs.includes('dividerBefore: options.length > 0') &&
    newtabJs.includes("label: t('bookmarks_open_in_new_tab_group'") &&
    newtabJs.includes('disabled: getBookmarkFolderOpenCount(target) <= 0') &&
    newtabJs.includes("option.getAttribute('aria-disabled') === 'true'") &&
    newtabJs.includes("menu.addEventListener('click', handleBookmarkContextMenuActionClick)") &&
    newtabJs.includes('confirmationTitle: formatMessage(') &&
    newtabJs.includes("action: 'openBookmarkFolderInNewTabGroup'") &&
    backgroundJs.includes("chrome.runtime.getURL('src/background/bookmark-tab-groups.js')"),
  'folder actions should stay visible when empty, confirm recursively counted tabs, and route grouping through the background'
);
assert.ok(
  newtabJs.includes('bookmarksRuntime.remove(record.bookmarkId, {') &&
    newtabJs.includes('bookmarksRuntime.restore(record.snapshot, {') &&
    bookmarksRuntimeJs.includes('async function restore(snapshot, options)'),
  'deletion should remove folders recursively and restore the complete snapshot at its original location'
);
assert.ok(
  newtabJs.includes("if (record.kind === 'delete')") &&
    newtabJs.includes("'bookmarks_delete_undone'") &&
    newtabJs.includes("'bookmarks_delete_redone'"),
  'keyboard undo and redo should handle deletion records and show feedback only after the shortcut'
);
assert.ok(
  bookmarkDragJs.includes('visualElement.style.left = `${position.left}px`') &&
    bookmarkDragJs.includes("visualElement.style.transform = 'translate3d(0, 0, 0)'") &&
    newtabJs.includes('draggedLayoutRect && !state.dragPreviewElement'),
  'the floating drag preview should stay in viewport coordinates across page rerenders'
);
assert.ok(
  newtabJs.includes('function queueBookmarkLayoutAnimation(excludedBookmarkId, animationOptions)') &&
    newtabJs.includes('function playPendingBookmarkLayoutAnimation()') &&
    newtabJs.includes('draggedBookmarkId: state.bookmarkId'),
  'a completed drag should animate the dragged card and other cards from their pre-drop positions'
);
assert.ok(
  newtabHtml.includes('[data-bookmark-context-menu-open="true"]') &&
    cascadeJs.includes('shouldKeepOpenForExternalNode(target)'),
  'the source item should remain visibly active and an open cascade should survive context-menu interaction'
);
assert.ok(
  newtabJs.includes('bookmarksRuntime.runControlledMutation') &&
    newtabJs.includes('if (change.isControlled)') &&
    bookmarksRuntimeJs.includes('controlledMutationDepth > 0') &&
    bookmarksRuntimeJs.includes("'onCreated'") &&
    bookmarksRuntimeJs.includes("'onRemoved'"),
  'Chrome bookmark events from controlled moves, deletes, or restores should not repeatedly refresh the cascade'
);

['en', 'zh_CN', 'zh_TW', 'ja'].forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(
    path.join(repoRoot, '_locales', locale, 'messages.json'),
    'utf8'
  ));
  [
    'bookmarks_delete',
    'newtab_open_in_new_tab',
    'bookmarks_open_in_new_tab_group',
    'bookmarks_open_group_confirm_title',
    'bookmarks_open_group_confirm_description',
    'bookmarks_open_group_confirm_button',
    'bookmarks_open_group_partial_failed',
    'bookmarks_open_group_failed',
    'bookmarks_context_menu_label',
    'bookmarks_delete_undone',
    'bookmarks_delete_redone',
    'bookmarks_delete_failed'
  ].forEach((key) => {
    assert.ok(messages[key] && messages[key].message, `${locale} should include ${key}`);
  });
});

console.log('New tab bookmark delete and undo tests passed.');
