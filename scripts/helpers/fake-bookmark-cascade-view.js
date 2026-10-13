'use strict';

function createElement(documentObj, tagName, className) {
  const element = documentObj.createElement(tagName);
  element.className = className || '';
  return element;
}

function createFakeBookmarkCascadeView() {
  return {
    createMenu(documentObj) {
      return createElement(
        documentObj,
        'div',
        'x-nt-bookmark-cascade-menu x-extension-menu-surface'
      );
    },

    createLevel(config) {
      const documentObj = config.documentObj;
      const levelIndex = Math.max(0, Number.parseInt(config.levelIndex, 10) || 0);
      const element = createElement(
        documentObj,
        'div',
        `x-nt-bookmark-cascade-level${
          levelIndex > 0 ? ' x-nt-bookmark-cascade-submenu' : ''
        }`
      );
      const content = createElement(
        documentObj,
        'div',
        'x-nt-bookmark-cascade-content'
      );
      element.appendChild(content);
      if (config.folderTitle) {
        const title = createElement(
          documentObj,
          'div',
          'x-nt-bookmark-cascade-title'
        );
        title.textContent = String(config.folderTitle);
        content.appendChild(title);
      }
      const items = (Array.isArray(config.items) ? config.items : []).map(
        (item, index) => {
          const isFolder = item && item.type === 'folder';
          const row = createElement(
            documentObj,
            'div',
            `x-nt-bookmark-cascade-row${
              isFolder ? ' x-nt-bookmark-cascade-row--folder' : ''
            }`
          );
          const button = createElement(
            documentObj,
            'button',
            `x-nt-bookmark-cascade-item${
              isFolder ? ' x-nt-bookmark-cascade-item--folder' : ''
            }`
          );
          button.setAttribute('data-bookmark-id', String(item && item.id || ''));
          button.setAttribute('data-level', String(levelIndex));
          button.setAttribute('data-type', isFolder ? 'folder' : 'bookmark');
          button.setAttribute('role', 'menuitem');
          button.setAttribute('tabindex', '-1');
          if (isFolder) {
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-haspopup', 'menu');
          }
          const icon = createElement(
            documentObj,
            isFolder ? 'span' : 'img',
            `x-nt-bookmark-cascade-icon${
              isFolder ? ' x-nt-bookmark-cascade-icon--folder' : ''
            }`
          );
          const label = createElement(
            documentObj,
            'span',
            'x-nt-bookmark-cascade-label'
          );
          label.textContent = String(
            item && (item.title || item.url) || config.folderTitle || ''
          );
          button.appendChild(icon);
          button.appendChild(label);
          if (isFolder) {
            button.appendChild(
              createElement(
                documentObj,
                'span',
                'x-nt-bookmark-cascade-arrow'
              )
            );
          }
          row.appendChild(button);
          let copyButton = null;
          if (!isFolder && item && item.url) {
            copyButton = createElement(
              documentObj,
              'button',
              'x-nt-bookmark-cascade-copy-trigger'
            );
            copyButton.setAttribute(
              'aria-label',
              String(config.copyLabel || 'Copy link')
            );
            copyButton.setAttribute(
              'data-tooltip',
              String(config.copyLabel || 'Copy link')
            );
            row.appendChild(copyButton);
          }
          content.appendChild(row);
          return { row, button, icon, copyButton, index };
        }
      );
      return {
        element,
        content,
        items,
        destroy() {}
      };
    }
  };
}

module.exports = {
  createFakeBookmarkCascadeView
};
