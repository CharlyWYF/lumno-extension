import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSiteSearchListApi,
  createSiteSearchListController,
  type SiteSearchListController,
  type SiteSearchListRenderModel
} from './site-search-list';

let controllers: SiteSearchListController[] = [];

const model: SiteSearchListRenderModel = {
  copy: {
    aliasLabel: '别名',
    aliasPlaceholder: '例如 小破站、油管等',
    cancelLabel: '取消',
    categoryLabel: '显示位置',
    confirmLabel: '确认',
    confirmMessage: '确认移除该项？',
    confirmMessageKey: 'confirm_remove_item',
    editLabel: '编辑',
    keyLabel: '触发词',
    keyPlaceholder: '必填，如有多个用英文逗号分隔',
    moveDownLabel: '下移',
    moveUpLabel: '上移',
    nameLabel: '显示名称',
    namePlaceholder: '选填，默认使用触发词',
    reorderHandleLabel: '拖动排序',
    removeLabel: '移除',
    saveLabel: '保存修改',
    searchEngineCategoryLabel: '搜索引擎',
    siteCategoryLabel: '站内搜索',
    templateHelp: '搜索模板需要包含 {query}',
    templateLabel: '搜索模板'
  },
  items: [
    {
      aliasesText: '视频',
      badgeText: '自定义',
      category: 'site',
      duplicateLabel: '与内置重复',
      duplicateTemplate: 'https://example.com/?q={query}',
      duplicateTooltip: '定位内置项',
      iconUrl: 'https://example.com/favicon.ico',
      id: 'custom:ex',
      isBuiltin: false,
      key: 'ex',
      meta: 'ex · https://example.com/?q={query}',
      name: 'Example',
      normalizedTemplate: 'https://example.com/?q={query}',
      secondaryBadgeText: '站内搜索',
      template: 'https://example.com/?q={query}',
      templateEditable: true
    }
  ],
  placeholder: ''
};

function createFixture() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const options = {
    kind: 'custom',
    onLocateDuplicate: vi.fn(),
    onRemove: vi.fn(),
    onReorder: vi.fn(),
    onSave: vi.fn().mockResolvedValue({ ok: true })
  };
  const controller = createSiteSearchListController(host, options);
  controllers.push(controller);
  return { controller, host, options };
}

afterEach(() => {
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  controllers = [];
  document.body.textContent = '';
});

describe('Options site-search list React island', () => {
  it('renders provider metadata, legacy classes, and host contracts', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));

    expect(createSiteSearchListApi().implementation).toBe('react');
    expect(host.dataset.reactIsland).toBe('options-site-search-list');
    expect(host.dataset.providerKind).toBe('custom');
    expect(host.querySelector('[data-provider-id="custom:ex"]')).not.toBeNull();
    expect(host.querySelector('._x_extension_shortcut_item_meta_2024_unique_')
      ?.textContent).toContain('{query}');
    expect(host.querySelector('[data-badge-kind="secondary"]')?.textContent)
      .toBe('站内搜索');
  });

  it('renders both category and built-in badges for search-engine cards', () => {
    const { controller, host } = createFixture();
    act(() => controller.render({
      ...model,
      items: [{
        ...model.items[0],
        badgeText: '搜索引擎',
        category: 'searchEngine',
        duplicateLabel: '',
        duplicateTemplate: '',
        duplicateTooltip: '',
        id: 'builtin:gg',
        isBuiltin: true,
        key: 'gg',
        name: 'Google',
        secondaryBadgeText: '内置',
        templateEditable: false
      }]
    }));

    const badges = host.querySelectorAll('._x_extension_shortcut_badge_2024_unique_');
    expect(Array.from(badges).map((badge) => badge.textContent)).toEqual([
      '搜索引擎',
      '内置'
    ]);
  });

  it('edits a provider draft and routes save through the adapter', async () => {
    const { controller, host, options } = createFixture();
    act(() => controller.render(model));
    act(() => {
      host.querySelector<HTMLButtonElement>('._x_extension_shortcut_edit_2024_unique_')
        ?.click();
    });
    const nameInput = host.querySelector<HTMLInputElement>('[data-provider-field="name"]');
    act(() => {
      if (nameInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set;
        valueSetter?.call(nameInput, 'Updated');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      host.querySelector<HTMLButtonElement>('[data-site-search-category="searchEngine"]')
        ?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>(
        '._x_extension_shortcut_editor_2024_unique_ ._x_extension_shortcut_submit_primary_2024_unique_'
      )?.click();
      await Promise.resolve();
    });

    expect(options.onSave).toHaveBeenCalledWith(
      'ex',
      false,
      expect.objectContaining({ category: 'searchEngine', name: 'Updated' })
    );
  });

  it('keeps the editor expanded when the adapter returns an error', async () => {
    const { controller, host, options } = createFixture();
    options.onSave.mockResolvedValue({ ok: false, error: '触发词不能为空' });
    act(() => controller.render(model));
    act(() => {
      host.querySelector<HTMLButtonElement>('._x_extension_shortcut_edit_2024_unique_')
        ?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>(
        '._x_extension_shortcut_editor_2024_unique_ ._x_extension_shortcut_submit_primary_2024_unique_'
      )?.click();
      await Promise.resolve();
    });

    expect(host.querySelector('._x_extension_shortcut_error_2024_unique_')?.textContent)
      .toBe('触发词不能为空');
    expect(host.querySelector('[data-expanded="true"]')).not.toBeNull();
  });

  it('routes duplicate location and confirmed removal actions', async () => {
    const { controller, host, options } = createFixture();
    act(() => controller.render(model));
    act(() => {
      host.querySelector<HTMLButtonElement>('._x_extension_shortcut_badge_warn_2024_unique_')
        ?.click();
      host.querySelector<HTMLButtonElement>('._x_extension_shortcut_remove_2024_unique_')
        ?.click();
    });
    const confirmButtons = host.querySelectorAll<HTMLButtonElement>(
      '._x_extension_popconfirm_actions_2024_unique_ button'
    );
    await act(async () => {
      confirmButtons[1]?.click();
      await Promise.resolve();
    });

    expect(options.onLocateDuplicate).toHaveBeenCalledWith(
      'https://example.com/?q={query}'
    );
    expect(options.onRemove).toHaveBeenCalledWith('ex', false);
  });

  it('offers one reorder control per row with keyboard move buttons', () => {
    const { controller, host, options } = createFixture();
    act(() => controller.render({
      ...model,
      items: [
        { ...model.items[0], id: 'a', key: 'aa', name: 'A' },
        { ...model.items[0], id: 'b', key: 'bb', name: 'B' },
        { ...model.items[0], id: 'c', key: 'cc', name: 'C' }
      ]
    }));

    const rows = host.querySelectorAll('[data-reorder-row="true"]');
    expect(rows.length).toBe(3);
    // The drag source is the handle, so an open editor never starts a drag.
    expect(host.querySelectorAll('[data-reorder-handle="true"][draggable="true"]').length).toBe(3);

    const firstUp = rows[0].querySelector<HTMLButtonElement>('[data-reorder-action="up"]');
    const firstDown = rows[0].querySelector<HTMLButtonElement>('[data-reorder-action="down"]');
    const lastDown = rows[2].querySelector<HTMLButtonElement>('[data-reorder-action="down"]');
    expect(firstUp?.disabled).toBe(true);
    expect(firstDown?.disabled).toBe(false);
    expect(lastDown?.disabled).toBe(true);

    act(() => firstDown?.click());
    expect(options.onReorder).toHaveBeenCalledWith(0, 1);
    act(() => {
      rows[2].querySelector<HTMLButtonElement>('[data-reorder-action="up"]')?.click();
    });
    expect(options.onReorder).toHaveBeenLastCalledWith(2, 1);
  });

  it('resolves a drag drop into a reorder that accounts for the removed row', () => {
    const { controller, host, options } = createFixture();
    act(() => controller.render({
      ...model,
      items: [
        { ...model.items[0], id: 'a', key: 'aa', name: 'A' },
        { ...model.items[0], id: 'b', key: 'bb', name: 'B' },
        { ...model.items[0], id: 'c', key: 'cc', name: 'C' }
      ]
    }));

    const rows = Array.from(host.querySelectorAll<HTMLElement>('[data-reorder-row="true"]'));
    const handle = rows[0].querySelector<HTMLElement>('[data-reorder-handle="true"]');
    const dataTransfer = {
      dropEffect: '',
      effectAllowed: '',
      setData: vi.fn()
    };
    act(() => {
      handle?.dispatchEvent(Object.assign(
        new Event('dragstart', { bubbles: true }),
        { dataTransfer }
      ));
    });

    // Dropping on the lower half of row 2 means "after row 2", which lands at
    // index 2 once the dragged row is removed from its original slot.
    rows[2].getBoundingClientRect = () => ({
      bottom: 40,
      height: 20,
      left: 0,
      right: 0,
      top: 20,
      width: 0,
      x: 0,
      y: 20,
      toJSON: () => ({})
    });
    act(() => {
      rows[2].dispatchEvent(Object.assign(
        new Event('drop', { bubbles: true, cancelable: true }),
        { clientY: 35, dataTransfer }
      ));
    });

    expect(options.onReorder).toHaveBeenCalledWith(0, 2);
  });
});
