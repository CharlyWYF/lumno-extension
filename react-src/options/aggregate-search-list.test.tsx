import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAggregateSearchListApi,
  createAggregateSearchListController,
  getNextAggregateSearchDefaultName,
  type AggregateSearchListController,
  type AggregateSearchListRenderModel
} from './aggregate-search-list';

let controllers: AggregateSearchListController[] = [];

const model: AggregateSearchListRenderModel = {
  copy: {
    addLabel: '添加聚合搜索',
    cancelLabel: '取消',
    confirmLabel: '确认',
    confirmMessage: '确认移除？',
    confirmMessageKey: 'confirm_remove_item',
    defaultNameBase: '聚合搜索',
    editLabel: '编辑',
    groupBadge: '聚合',
    keyLabel: '触发词',
    keyPlaceholder: '例如 tech',
    keyRequiredError: '请输入触发词',
    keySpaceError: '触发词不能包含空格。',
    maxSourcesError: '最多 10 个',
    minSourcesError: '至少 2 个',
    moveDownLabel: '下移',
    moveUpLabel: '上移',
    nameLabel: '名称',
    nameRequiredError: '请输入名称',
    reorderHandleLabel: '拖动排序',
    removeLabel: '移除',
    saveLabel: '保存',
    selectedCountLabel: '已选 {count}/{max}',
    sourcesLabel: '搜索源',
    unavailableGroupLabel: '不可用的搜索源',
    unavailableSourceLabel: '不可用的搜索源（{source}）'
  },
  items: [],
  maxKeyLength: 32,
  maxNameLength: 80,
  maxSourceCount: 10,
  minSourceCount: 2,
  providers: [
    {
      available: true,
      group: 'engine',
      groupLabel: '搜索引擎',
      name: 'Google',
      sourceRef: 'builtin:gg'
    },
    {
      available: true,
      group: 'site',
      groupLabel: '站内搜索',
      name: 'GitHub',
      sourceRef: 'builtin:gh'
    },
    {
      available: true,
      group: 'site',
      groupLabel: '站内搜索',
      name: 'Docs',
      sourceRef: 'custom:docs'
    }
  ]
};

function createFixture(renderModel = model) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const options = {
    onRemove: vi.fn().mockResolvedValue(undefined),
    onReorder: vi.fn(),
    onSave: vi.fn().mockResolvedValue({ ok: true })
  };
  const controller = createAggregateSearchListController(host, options);
  controllers.push(controller);
  act(() => controller.render(renderModel));
  return { controller, host, options };
}

function setInputValue(input: HTMLInputElement | null, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set;
  setter?.call(input, value);
  input?.dispatchEvent(new Event('input', { bubbles: true }));
}

// Closed editors stay mounted (inert) so they can animate, so queries go
// through the open one.
const OPEN_EDITOR = '[data-expanded="true"] ._x_extension_aggregate_search_editor_2026_unique_';

function getOpenEditor(host: HTMLElement) {
  return host.querySelector<HTMLElement>(OPEN_EDITOR);
}

function expectNoOpenEditor(host: HTMLElement) {
  expect(getOpenEditor(host)).toBeNull();
  host.querySelectorAll<HTMLElement>(
    '._x_extension_aggregate_search_editor_2026_unique_'
  ).forEach((editor) => expect(editor.hasAttribute('inert')).toBe(true));
}

async function clickSave(host: HTMLElement) {
  await act(async () => {
    getOpenEditor(host)?.querySelector<HTMLButtonElement>(
      '._x_extension_shortcut_save_2024_unique_'
    )?.click();
    await Promise.resolve();
  });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function openAddEditorWithValidDraft(host: HTMLElement) {
  act(() => {
    host.querySelector<HTMLButtonElement>(
      '._x_extension_aggregate_search_add_2026_unique_'
    )?.click();
  });
  const editor = getOpenEditor(host);
  act(() => {
    setInputValue(
      editor?.querySelector<HTMLInputElement>('[data-aggregate-field="name"]') || null,
      '技术检索'
    );
    setInputValue(
      editor?.querySelector<HTMLInputElement>('[data-aggregate-field="key"]') || null,
      'tech'
    );
    editor?.querySelector<HTMLInputElement>('[data-source-ref="builtin:gg"]')
      ?.click();
    editor?.querySelector<HTMLInputElement>('[data-source-ref="builtin:gh"]')
      ?.click();
  });
}

afterEach(() => {
  act(() => controllers.forEach((controller) => controller.destroy()));
  controllers = [];
  document.body.textContent = '';
});

describe('Options aggregate-search React island', () => {
  it('prefills and saves the first default name without a placeholder', async () => {
    const { host, options } = createFixture();

    expect(createAggregateSearchListApi().implementation).toBe('react');
    expect(host.dataset.reactIsland).toBe('options-aggregate-search-list');
    expect(host.querySelector(
      '._x_extension_settings_placeholder_2024_unique_'
    )).toBeNull();
    const addButton = host.querySelector<HTMLButtonElement>(
      '._x_extension_aggregate_search_add_2026_unique_'
    );
    const addForm = addButton?.closest<HTMLElement>(
      '._x_extension_shortcut_form_2024_unique_'
    );
    expect(addForm?.dataset.expanded).toBe('false');
    expect(addButton?.parentElement?.classList.contains(
      '_x_extension_shortcut_form_trigger_2024_unique_'
    )).toBe(true);

    act(() => {
      addButton?.click();
    });
    expect(addForm?.dataset.expanded).toBe('true');
    expect(host.querySelector('[data-aggregate-field="name"]')?.closest(
      '._x_extension_shortcut_form_fields_2024_unique_'
    )).toBe(addForm?.querySelector(
      '._x_extension_shortcut_form_fields_2024_unique_'
    ));
    const nameInput = host.querySelector<HTMLInputElement>(
      '[data-aggregate-field="name"]'
    );
    expect(nameInput?.maxLength).toBe(80);
    expect(nameInput?.value).toBe('聚合搜索');
    expect(nameInput?.hasAttribute('placeholder')).toBe(false);
    const keyInput = host.querySelector<HTMLInputElement>(
      '[data-aggregate-field="key"]'
    );
    expect(keyInput?.maxLength).toBe(32);
    expect(keyInput?.placeholder).toBe(model.copy.keyPlaceholder);
    act(() => setInputValue(keyInput, 'all'));
    expect(addForm?.querySelector<HTMLButtonElement>(
      '._x_extension_shortcut_save_2024_unique_'
    )?.textContent).toBe(model.copy.addLabel);
    act(() => {
      host.querySelector<HTMLInputElement>('[data-source-ref="builtin:gg"]')
        ?.click();
      host.querySelector<HTMLInputElement>('[data-source-ref="builtin:gh"]')
        ?.click();
    });
    await clickSave(host);

    expect(options.onSave).toHaveBeenCalledWith(null, {
      key: 'all',
      name: '聚合搜索',
      sourceRefs: ['builtin:gg', 'builtin:gh']
    });
  });

  it('numbers later defaults from the item count and skips occupied candidates', () => {
    const firstItem = {
      id: 'aggregate:first',
      key: 'all',
      name: '聚合搜索',
      sourceRefs: ['builtin:gg', 'builtin:gh'],
      sourceSummary: '2 个搜索源'
    };
    const secondItem = {
      ...firstItem,
      id: 'aggregate:second',
      name: '聚合搜索 2'
    };

    expect(getNextAggregateSearchDefaultName([firstItem], '聚合搜索'))
      .toBe('聚合搜索 2');
    expect(getNextAggregateSearchDefaultName(
      [firstItem, secondItem],
      '聚合搜索'
    )).toBe('聚合搜索 3');
    expect(getNextAggregateSearchDefaultName([
      { ...firstItem, name: '自定义名称' },
      { ...secondItem, name: '聚合搜索 3' }
    ], '聚合搜索')).toBe('聚合搜索 4');
  });

  it('shows trigger, required-name, and minimum-source validation before saving', async () => {
    const { host, options } = createFixture();
    act(() => {
      host.querySelector<HTMLButtonElement>(
        '._x_extension_aggregate_search_add_2026_unique_'
      )?.click();
    });
    await clickSave(host);
    expect(host.querySelector('[role="alert"]')?.textContent)
      .toBe(model.copy.keyRequiredError);
    expect(host.querySelector('[data-aggregate-field="key"]')
      ?.getAttribute('aria-invalid')).toBe('true');

    act(() => {
      setInputValue(
        host.querySelector<HTMLInputElement>('[data-aggregate-field="key"]'),
        'two words'
      );
    });
    await clickSave(host);
    expect(host.querySelector('[role="alert"]')?.textContent)
      .toBe(model.copy.keySpaceError);

    act(() => {
      setInputValue(
        host.querySelector<HTMLInputElement>('[data-aggregate-field="key"]'),
        'tech'
      );
      setInputValue(
        host.querySelector<HTMLInputElement>('[data-aggregate-field="name"]'),
        ''
      );
    });

    await clickSave(host);
    expect(host.querySelector('[role="alert"]')?.textContent)
      .toBe(model.copy.nameRequiredError);
    expect(host.querySelector('[data-aggregate-field="name"]')
      ?.getAttribute('aria-invalid')).toBe('true');

    act(() => {
      setInputValue(
        host.querySelector<HTMLInputElement>('[data-aggregate-field="name"]'),
        '技术检索'
      );
      host.querySelector<HTMLInputElement>('[data-source-ref="builtin:gg"]')
        ?.click();
    });
    await clickSave(host);

    expect(options.onSave).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent)
      .toBe(model.copy.minSourcesError);
    expect(host.querySelector('._x_extension_aggregate_search_sources_2026_unique_')
      ?.getAttribute('aria-invalid')).toBe('true');
  });

  it('prevents selecting more than the configured maximum', () => {
    const limitModel = {
      ...model,
      copy: {
        ...model.copy,
        maxSourcesError: '最多 2 个'
      },
      maxSourceCount: 2
    };
    const { host } = createFixture(limitModel);
    act(() => {
      host.querySelector<HTMLButtonElement>(
        '._x_extension_aggregate_search_add_2026_unique_'
      )?.click();
    });
    act(() => {
      host.querySelector<HTMLInputElement>('[data-source-ref="builtin:gg"]')
        ?.click();
      host.querySelector<HTMLInputElement>('[data-source-ref="builtin:gh"]')
        ?.click();
    });
    act(() => {
      host.querySelector<HTMLInputElement>('[data-source-ref="custom:docs"]')
        ?.click();
    });

    expect(host.querySelector<HTMLInputElement>('[data-source-ref="custom:docs"]')
      ?.checked).toBe(false);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('最多 2 个');
    expect(host.querySelector('._x_extension_aggregate_search_count_2026_unique_')
      ?.textContent).toBe('已选 2/2');
  });

  it('keeps the editor open and shows a rejected save error', async () => {
    const { host, options } = createFixture();
    options.onSave.mockRejectedValueOnce(new Error('存储暂时不可用'));
    openAddEditorWithValidDraft(host);

    await clickSave(host);

    expect(host.querySelector('[role="alert"]')?.textContent)
      .toBe('存储暂时不可用');
    expect(host.querySelector('[data-aggregate-field="name"]')).not.toBeNull();
    expect(host.querySelector<HTMLButtonElement>(
      '._x_extension_shortcut_save_2024_unique_'
    )?.disabled).toBe(false);
  });

  it('keeps the editor open and shows an unsuccessful save result', async () => {
    const { host, options } = createFixture();
    options.onSave.mockResolvedValueOnce({
      ok: false,
      error: '名称已被使用'
    });
    openAddEditorWithValidDraft(host);

    await clickSave(host);

    expect(host.querySelector('[role="alert"]')?.textContent)
      .toBe('名称已被使用');
    expect(host.querySelector('[data-aggregate-field="name"]')).not.toBeNull();
  });

  it('prevents a second save while the first save is pending', async () => {
    const deferred = createDeferred<{ ok: boolean }>();
    const { host, options } = createFixture();
    options.onSave.mockReturnValueOnce(deferred.promise);
    openAddEditorWithValidDraft(host);
    const saveButton = host.querySelector<HTMLButtonElement>(
      '._x_extension_shortcut_save_2024_unique_'
    );

    await act(async () => {
      saveButton?.click();
      await Promise.resolve();
    });
    expect(saveButton?.disabled).toBe(true);
    expect(saveButton?.getAttribute('aria-busy')).toBe('true');

    act(() => {
      saveButton?.click();
    });
    expect(options.onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ ok: true });
      await deferred.promise;
    });
    expectNoOpenEditor(host);
  });

  it('keeps a selected source visible and removable if it disappears while editing', async () => {
    const unavailableItem = {
      id: 'aggregate:needs-repair',
      key: 'repair',
      name: '待修复聚合',
      sourceRefs: ['builtin:gg', 'custom:docs'],
      sourceSummary: '2 个搜索源 · 1 个不可用'
    };
    const initialModel = {
      ...model,
      items: [unavailableItem]
    };
    const { controller, host, options } = createFixture(initialModel);
    act(() => {
      host.querySelector<HTMLButtonElement>(
        '._x_extension_shortcut_edit_2024_unique_'
      )?.click();
    });

    act(() => controller.render({
      ...initialModel,
      providers: initialModel.providers.filter(
        (provider) => provider.sourceRef !== 'custom:docs'
      )
    }));
    const unavailableInput = host.querySelector<HTMLInputElement>(
      '[data-source-ref="custom:docs"]'
    );
    expect(unavailableInput?.checked).toBe(true);
    expect(unavailableInput?.disabled).toBe(false);
    expect(unavailableInput?.closest('label')?.dataset.available).toBe('false');
    expect(unavailableInput?.closest('[role="group"]')
      ?.getAttribute('aria-label')).toBe(model.copy.unavailableGroupLabel);
    expect(unavailableInput?.closest('label')?.textContent)
      .toContain('不可用的搜索源（custom:docs）');

    act(() => {
      unavailableInput?.click();
      host.querySelector<HTMLInputElement>('[data-source-ref="builtin:gh"]')
        ?.click();
    });
    await clickSave(host);

    expect(options.onSave).toHaveBeenCalledWith(unavailableItem.id, {
      key: unavailableItem.key,
      name: unavailableItem.name,
      sourceRefs: ['builtin:gg', 'builtin:gh']
    });
  });

  it('restores focus after cancelling or successfully saving an editor', async () => {
    const item = {
      id: 'aggregate:focus',
      key: 'focus',
      name: '焦点测试',
      sourceRefs: ['builtin:gg', 'builtin:gh'],
      sourceSummary: '2 个搜索源'
    };
    const { host } = createFixture({
      ...model,
      items: [item]
    });
    const editButton = host.querySelector<HTMLButtonElement>(
      '._x_extension_shortcut_edit_2024_unique_'
    );
    const addButton = host.querySelector<HTMLButtonElement>(
      '._x_extension_aggregate_search_add_2026_unique_'
    );

    act(() => editButton?.click());
    const editCancelButton = getOpenEditor(host)?.querySelector<HTMLButtonElement>(
      '._x_extension_shortcut_secondary_2024_unique_'
    );
    act(() => {
      editCancelButton?.focus();
      editCancelButton?.click();
    });
    expectNoOpenEditor(host);
    expect(document.activeElement).toBe(editButton);

    act(() => editButton?.click());
    await clickSave(host);
    expectNoOpenEditor(host);
    expect(document.activeElement).toBe(editButton);

    act(() => addButton?.click());
    const addCancelButton = getOpenEditor(host)?.querySelector<HTMLButtonElement>(
      '._x_extension_shortcut_secondary_2024_unique_'
    );
    act(() => {
      addCancelButton?.focus();
      addCancelButton?.click();
    });
    expectNoOpenEditor(host);
    expect(document.activeElement).toBe(addButton);

    openAddEditorWithValidDraft(host);
    await clickSave(host);
    expectNoOpenEditor(host);
    expect(document.activeElement).toBe(addButton);
  });

  it('focuses the adjacent edit action, then Add, after confirmed removals unmount items', async () => {
    const items = [
      {
        id: 'aggregate:first',
        key: 'first',
        name: '第一个',
        sourceRefs: ['builtin:gg', 'builtin:gh'],
        sourceSummary: '2 个搜索源'
      },
      {
        id: 'aggregate:second',
        key: 'second',
        name: '第二个',
        sourceRefs: ['builtin:gg', 'builtin:gh'],
        sourceSummary: '2 个搜索源'
      }
    ];
    const renderModel = { ...model, items };
    const { controller, host, options } = createFixture(renderModel);
    let remainingItems = items;
    options.onRemove.mockImplementation(async (id: string) => {
      remainingItems = remainingItems.filter((item) => item.id !== id);
      controller.render({ ...renderModel, items: remainingItems });
    });

    const confirmRemoval = async (itemId: string) => {
      const card = host.querySelector<HTMLElement>(
        `[data-aggregate-id="${itemId}"]`
      );
      act(() => card?.querySelector<HTMLButtonElement>(
        '._x_extension_shortcut_remove_2024_unique_'
      )?.click());
      const confirmButton = card?.querySelectorAll<HTMLButtonElement>(
        '._x_extension_popconfirm_actions_2024_unique_ button'
      )[1];
      await act(async () => {
        confirmButton?.focus();
        confirmButton?.click();
        await Promise.resolve();
        await Promise.resolve();
      });
    };

    await confirmRemoval(items[0].id);
    expect(host.querySelector(`[data-aggregate-id="${items[0].id}"]`))
      .toBeNull();
    expect(document.activeElement).toBe(host.querySelector(
      `[data-aggregate-id="${items[1].id}"] `
      + '._x_extension_shortcut_edit_2024_unique_'
    ));

    await confirmRemoval(items[1].id);
    expect(host.querySelector(`[data-aggregate-id="${items[1].id}"]`))
      .toBeNull();
    expect(document.activeElement).toBe(host.querySelector(
      '._x_extension_aggregate_search_add_2026_unique_'
    ));
  });

  it('starts each reopened editor from the saved item and focuses its name', () => {
    const item = {
      id: 'aggregate:reopen',
      key: 'reopen',
      name: '重开测试',
      sourceRefs: ['builtin:gg', 'builtin:gh'],
      sourceSummary: '2 个搜索源'
    };
    const { host } = createFixture({ ...model, items: [item] });
    const editButton = host.querySelector<HTMLButtonElement>(
      '._x_extension_shortcut_edit_2024_unique_'
    );
    expect(document.activeElement).toBe(document.body);

    act(() => editButton?.click());
    const nameInput = getOpenEditor(host)?.querySelector<HTMLInputElement>(
      '[data-aggregate-field="name"]'
    );
    expect(document.activeElement).toBe(nameInput);
    act(() => {
      setInputValue(nameInput || null, '未保存的名称');
      getOpenEditor(host)?.querySelector<HTMLInputElement>(
        '[data-source-ref="custom:docs"]'
      )?.click();
    });
    act(() => editButton?.click());
    expectNoOpenEditor(host);

    act(() => editButton?.click());
    expect(nameInput?.value).toBe(item.name);
    expect(getOpenEditor(host)?.querySelector<HTMLInputElement>(
      '[data-source-ref="custom:docs"]'
    )?.checked).toBe(false);
    expect(document.activeElement).toBe(nameInput);
  });

  it('edits and removes an existing aggregate', async () => {
    const item = {
      id: 'aggregate:tech',
      key: 'tech',
      name: '技术检索',
      sourceRefs: ['builtin:gg', 'builtin:gh'],
      sourceSummary: '2 个搜索源 · 不创建标签页组'
    };
    const { host, options } = createFixture({
      ...model,
      items: [item]
    });
    const aggregateCard = host.querySelector<HTMLElement>('[data-aggregate-id="aggregate:tech"]');
    expect(aggregateCard?.dataset.expanded).toBe('false');
    expect(aggregateCard?.querySelector<HTMLElement>(
      '._x_extension_shortcut_editor_2024_unique_'
    )?.hasAttribute('inert')).toBe(true);

    act(() => {
      host.querySelector<HTMLButtonElement>(
        '._x_extension_shortcut_edit_2024_unique_'
      )?.click();
    });
    expect(aggregateCard?.querySelector<HTMLButtonElement>(
      '._x_extension_shortcut_editor_actions_2024_unique_ ._x_extension_shortcut_save_2024_unique_'
    )?.textContent).toBe(model.copy.saveLabel);
    act(() => {
      setInputValue(
        host.querySelector<HTMLInputElement>('[data-aggregate-field="name"]'),
        '开发检索'
      );
      setInputValue(
        host.querySelector<HTMLInputElement>('[data-aggregate-field="key"]'),
        'dev'
      );
      host.querySelector<HTMLInputElement>('[data-source-ref="builtin:gh"]')
        ?.click();
      host.querySelector<HTMLInputElement>('[data-source-ref="custom:docs"]')
        ?.click();
    });
    await clickSave(host);

    expect(options.onSave).toHaveBeenCalledWith(item.id, {
      key: 'dev',
      name: '开发检索',
      sourceRefs: ['builtin:gg', 'custom:docs']
    });

    act(() => {
      host.querySelector<HTMLButtonElement>(
        '._x_extension_shortcut_remove_2024_unique_'
      )?.click();
    });
    const confirmButtons = host.querySelectorAll<HTMLButtonElement>(
      '._x_extension_popconfirm_actions_2024_unique_ button'
    );
    await act(async () => {
      confirmButtons[1]?.click();
      await Promise.resolve();
    });

    expect(options.onRemove).toHaveBeenCalledWith(item.id);
  });

  it('offers one reorder control per aggregate row with move buttons', () => {
    const item = {
      id: 'one',
      key: 'one',
      name: 'One',
      sourceRefs: ['builtin:gg', 'builtin:bi'],
      sourceSummary: '2 sources'
    };
    const { controller, host, options } = createFixture({
      ...model,
      items: [
        item,
        { ...item, id: 'two', key: 'two', name: 'Two' }
      ]
    });

    const rows = host.querySelectorAll('[data-reorder-row="true"]');
    expect(rows.length).toBe(2);
    expect(host.querySelectorAll('[data-reorder-handle="true"][draggable="true"]').length).toBe(2);
    const firstUp = rows[0].querySelector<HTMLButtonElement>('[data-reorder-action="up"]');
    const lastDown = rows[1].querySelector<HTMLButtonElement>('[data-reorder-action="down"]');
    expect(firstUp?.disabled).toBe(true);
    expect(lastDown?.disabled).toBe(true);

    act(() => {
      rows[0].querySelector<HTMLButtonElement>('[data-reorder-action="down"]')?.click();
    });
    expect(options.onReorder).toHaveBeenCalledWith(0, 1);
  });
});
