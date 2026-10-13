const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const newtabJs = readNewtabRuntimeSource();

function getFunctionSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} function should exist`);
  const bodyStart = source.indexOf('{', start);
  assert.ok(bodyStart >= 0, `${name} function body should start`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  assert.fail(`${name} function body should end`);
  return '';
}

function assertShortcutContextMenuFolderVisuals() {
  function createTile(isFolder) {
    const attributes = new Map();
    const animations = [];
    return {
      animations,
      hasAttribute: (name) => attributes.has(name),
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: (name) => attributes.delete(name),
      ...(isFolder ? {
        _xSetBookmarkMenuVisualActive: (active) => animations.push(active)
      } : {})
    };
  }
  const folder = createTile(true);
  const otherFolder = createTile(true);
  const website = createTile(false);
  const tiles = [folder, otherFolder, website];
  const sandbox = {
    shortcutGrid: { querySelectorAll: () => tiles },
    shortcutContextMenu: { control: { open: false }, select: {} },
    shortcutContextMenuTarget: null,
    shortcutContextMenuSelectController: {
      isOpen: (control) => control.open,
      setOpen: (control, open) => { control.open = open; },
      sync() {},
      setOptions() {}
    },
    closeRecentContextMenu() {},
    hideShortcutTooltip() {},
    resetShortcutDockHover() {},
    setShortcutDockHover() {},
    getShortcutContextMenuAnchorX: () => 0,
    setShortcutContextMenuPosition() {},
    getShortcutContextMenuOptions: () => [],
    isShortcutContextMenuNode: (node) => node === 'menu',
    syncShortcutDockHoverFromPoint() {},
    NEWTAB_CONTEXT_MENU_OPEN_VALUE: 'open',
    SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE: 'hide',
    SHORTCUT_GROUP_MENU_VALUES: { addShortcut: 'shortcut-add', rename: 'group-rename' },
    reopenBlockedAnchor: null
  };
  vm.runInNewContext([
    'isShortcutContextMenuOpen',
    'clearShortcutContextMenuTileActive',
    'setShortcutContextMenuTileActive',
    'applyShortcutContextMenuDockHover',
    'openShortcutContextMenu',
    'closeShortcutContextMenu',
    'handleShortcutContextMenuDocumentPointerDown',
    'handleShortcutContextMenuDocumentKeyDown',
    'handleShortcutContextMenuDocumentFocusIn'
  ].map((name) => getFunctionSource(newtabJs, name)).join('\n'), sandbox);

  sandbox.openShortcutContextMenu({ kind: 'shortcut', shortcutId: 'folder', tile: folder });
  assert.deepStrictEqual(folder.animations, [true], 'opening a folder context menu should open its icon');
  assert.strictEqual(folder.hasAttribute('data-shortcut-context-menu-open'), true);
  assert.deepStrictEqual(otherFolder.animations, [], 'unrelated folders should keep their current visual state');

  sandbox.openShortcutContextMenu({ kind: 'shortcut', shortcutId: 'other-folder', tile: otherFolder });
  assert.deepStrictEqual(folder.animations, [true, false], 'switching targets should release the previous folder');
  assert.deepStrictEqual(otherFolder.animations, [true]);
  sandbox.closeShortcutContextMenu();
  assert.deepStrictEqual(otherFolder.animations, [true, false], 'closing the menu should release its folder icon');
  assert.strictEqual(otherFolder.hasAttribute('data-shortcut-context-menu-open'), false);

  sandbox.clearShortcutContextMenuTileActive();
  assert.deepStrictEqual(folder.animations, [true, false], 'routine dock cleanup should leave inactive folders alone');
  sandbox.openShortcutContextMenu({ kind: 'shortcut', shortcutId: 'website', tile: website });
  sandbox.closeShortcutContextMenu();
  assert.strictEqual(website.hasAttribute('data-shortcut-context-menu-open'), false);

  const dismissals = [
    () => sandbox.handleShortcutContextMenuDocumentPointerDown({ target: 'outside', clientX: 0, clientY: 0 }),
    () => sandbox.handleShortcutContextMenuDocumentKeyDown({ key: 'Escape' }),
    () => sandbox.handleShortcutContextMenuDocumentFocusIn({ target: 'outside' })
  ];
  dismissals.forEach((dismiss) => {
    folder.animations.length = 0;
    sandbox.openShortcutContextMenu({ kind: 'shortcut', shortcutId: 'folder', tile: folder });
    sandbox.handleShortcutContextMenuDocumentPointerDown({ target: 'menu' });
    sandbox.handleShortcutContextMenuDocumentFocusIn({ target: 'menu' });
    sandbox.handleShortcutContextMenuDocumentKeyDown({ key: 'ArrowDown' });
    assert.deepStrictEqual(folder.animations, [true], 'interacting within the menu should keep its folder open');
    dismiss();
    assert.deepStrictEqual(folder.animations, [true, false], 'every menu dismissal should release its folder icon');
    assert.strictEqual(sandbox.shortcutContextMenuTarget, null);
  });
}

assertShortcutContextMenuFolderVisuals();

console.log('shortcut folder context menu tests passed');
