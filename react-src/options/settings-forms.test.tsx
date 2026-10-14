import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBlacklistFormController,
  createSettingsFormsApi,
  createSiteSearchFormController,
  type BlacklistFormController,
  type BlacklistFormRenderModel,
  type SiteSearchFormController,
  type SiteSearchFormRenderModel
} from './settings-forms';

let controllers: Array<BlacklistFormController | SiteSearchFormController> = [];

const siteModel: SiteSearchFormRenderModel = {
  copy: {
    addLabel: '添加站内搜索',
    aliasLabel: '别名',
    aliasPlaceholder: '例如 油管',
    cancelLabel: '取消',
    categoryLabel: '显示位置',
    keyLabel: '触发词',
    keyPlaceholder: '例如 yt',
    nameLabel: '显示名称',
    namePlaceholder: '选填',
    queryInsertLabel: '插入查询变量',
    searchEngineCategoryLabel: '搜索引擎',
    siteCategoryLabel: '站内搜索',
    templateHelp: '模板必须包含 {query}',
    templateLabel: '搜索模板',
    templatePlaceholder: 'https://example.com?q={query}'
  }
};

const blacklistModel: BlacklistFormRenderModel = {
  copy: {
    addLabel: '添加',
    cancelLabel: '取消',
    matchLabel: '匹配方式',
    modes: [
      {
        label: '当前页面',
        labelKey: 'blacklist_match_exact',
        mode: 'exact',
        placeholder: 'example.com/page',
        prefix: '',
        tooltip: '只屏蔽这一页',
        tooltipKey: 'blacklist_match_exact_tooltip',
        urlLabel: '完整 URL',
        urlLabelKey: 'blacklist_label_full_url'
      },
      {
        label: '当前站点路径',
        labelKey: 'blacklist_match_prefix',
        mode: 'prefix',
        placeholder: 'example.com/docs/',
        prefix: 'http(s)://',
        tooltip: '屏蔽路径',
        tooltipKey: 'blacklist_match_prefix_tooltip',
        urlLabel: 'URL 规则',
        urlLabelKey: 'blacklist_label_url'
      },
      {
        label: '整个网站',
        labelKey: 'blacklist_match_suffix',
        mode: 'suffix',
        placeholder: 'example.com',
        prefix: 'http(s)://',
        tooltip: '屏蔽整个网站',
        tooltipKey: 'blacklist_match_suffix_tooltip',
        urlLabel: '网站域名',
        urlLabelKey: 'blacklist_label_domain'
      }
    ]
  }
};

afterEach(() => {
  act(() => controllers.forEach((controller) => controller.destroy()));
  controllers = [];
  document.body.textContent = '';
});

describe('Options settings form React islands', () => {
  it('inserts the query token and submits a site-search draft', async () => {
    const host = document.createElement('div');
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    document.body.appendChild(host);
    const controller = createSiteSearchFormController(host, { onSave });
    controllers.push(controller);
    act(() => controller.render(siteModel));

    const buttons = host.querySelectorAll<HTMLButtonElement>('button:not(._x_extension_info_button_2026_unique_)');
    act(() => buttons[0]?.click());
    const inputs = host.querySelectorAll<HTMLInputElement>('input');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(inputs[1], 'yt');
      inputs[1]?.dispatchEvent(new Event('input', { bubbles: true }));
      buttons[1]?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>(
        '#_x_extension_site_search_add_2024_unique_'
      )?.click();
      await Promise.resolve();
    });

    expect(createSettingsFormsApi().implementation).toBe('react');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      key: 'yt',
      category: 'site',
      template: '{query}'
    }));
  });

  it('stores the selected search-engine placement in the custom draft', async () => {
    const host = document.createElement('div');
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    document.body.appendChild(host);
    const controller = createSiteSearchFormController(host, { onSave });
    controllers.push(controller);
    act(() => controller.render(siteModel));

    const categoryControl = host.querySelector<HTMLElement>(
      '._x_extension_site_search_category_tabs_2026_unique_'
    );
    expect(categoryControl?.getAttribute('role')).toBe('group');
    expect(
      categoryControl?.querySelector('[data-site-search-category="site"]')
        ?.getAttribute('aria-pressed')
    ).toBe('true');

    act(() => {
      host.querySelector<HTMLButtonElement>('button')?.click();
      host.querySelector<HTMLButtonElement>('[data-site-search-category="searchEngine"]')
        ?.click();
    });
    expect(
      categoryControl?.querySelector('[data-site-search-category="searchEngine"]')
        ?.getAttribute('aria-pressed')
    ).toBe('true');
    await act(async () => {
      host.querySelector<HTMLButtonElement>(
        '#_x_extension_site_search_add_2024_unique_'
      )?.click();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      category: 'searchEngine'
    }));
  });

  it('shows site-search validation errors without collapsing', async () => {
    const host = document.createElement('div');
    const controller = createSiteSearchFormController(host, {
      onSave: vi.fn().mockResolvedValue({ ok: false, error: '请填写触发词。' })
    });
    controllers.push(controller);
    act(() => controller.render(siteModel));
    const buttons = host.querySelectorAll<HTMLButtonElement>('button:not(._x_extension_info_button_2026_unique_)');
    act(() => buttons[0]?.click());
    await act(async () => {
      host.querySelector<HTMLButtonElement>(
        '#_x_extension_site_search_add_2024_unique_'
      )?.click();
      await Promise.resolve();
    });

    expect(host.dataset.expanded).toBe('true');
    expect(host.querySelector('._x_extension_shortcut_error_2024_unique_')?.textContent)
      .toBe('请填写触发词。');
  });

  it('recovers when an unexpected site-search save error rejects', async () => {
    const host = document.createElement('div');
    const controller = createSiteSearchFormController(host, {
      onSave: vi.fn().mockRejectedValue(new Error('Storage unavailable'))
    });
    controllers.push(controller);
    act(() => controller.render(siteModel));
    const buttons = host.querySelectorAll<HTMLButtonElement>('button:not(._x_extension_info_button_2026_unique_)');
    act(() => buttons[0]?.click());

    await act(async () => {
      host.querySelector<HTMLButtonElement>(
        '#_x_extension_site_search_add_2024_unique_'
      )?.click();
      await Promise.resolve();
    });

    expect(host.dataset.expanded).toBe('true');
    expect(host.querySelector<HTMLButtonElement>(
      '#_x_extension_site_search_add_2024_unique_'
    )?.disabled).toBe(false);
    expect(host.querySelector('._x_extension_shortcut_error_2024_unique_')?.textContent)
      .toBe('Storage unavailable');
  });

  it('switches blacklist presentation and submits the selected mode', async () => {
    const host = document.createElement('div');
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    document.body.appendChild(host);
    const controller = createBlacklistFormController(host, {
      kind: 'search',
      onSave
    });
    controllers.push(controller);
    act(() => controller.render(blacklistModel));
    const buttons = host.querySelectorAll<HTMLButtonElement>('button:not(._x_extension_info_button_2026_unique_)');
    const checkboxes = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    act(() => buttons[0]?.click());
    act(() => checkboxes[0]?.click());
    const textInput = host.querySelector<HTMLInputElement>('input:not([type="checkbox"])');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(textInput, 'example.com/page');
      textInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      buttons[2]?.click();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith('example.com/page', ['exact']);
    expect(host.dataset.expanded).toBe('false');
  });

  it('keeps a blacklist form open after adapter validation fails', async () => {
    const host = document.createElement('div');
    const controller = createBlacklistFormController(host, {
      kind: 'favicon',
      onSave: vi.fn().mockResolvedValue({ ok: false, error: '请输入网站域名。' })
    });
    controllers.push(controller);
    act(() => controller.render(blacklistModel));
    const buttons = host.querySelectorAll<HTMLButtonElement>('button:not(._x_extension_info_button_2026_unique_)');
    act(() => buttons[0]?.click());
    await act(async () => {
      buttons[2]?.click();
      await Promise.resolve();
    });

    expect(host.dataset.expanded).toBe('true');
    expect(host.querySelector('._x_extension_shortcut_error_2024_unique_')?.textContent)
      .toBe('请输入网站域名。');
  });

  it('lets the adapter reset React-owned blacklist form state', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const controller = createBlacklistFormController(host, {
      kind: 'search',
      onSave: vi.fn().mockResolvedValue({ ok: true })
    });
    controllers.push(controller);
    act(() => controller.render(blacklistModel));
    const openButton = host.querySelector<HTMLButtonElement>('button');
    const textInput = host.querySelector<HTMLInputElement>('input:not([type="checkbox"])');

    act(() => openButton?.click());
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(textInput, 'example.com');
      textInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => controller.reset());

    expect(host.dataset.expanded).toBe('false');
    expect(host.querySelector<HTMLInputElement>('input:not([type="checkbox"])')?.value)
      .toBe('');
    expect(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[2]?.checked)
      .toBe(true);
  });

  it('keeps the blacklist draft while closing and starts each open empty', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const controller = createBlacklistFormController(host, {
      kind: 'search',
      onSave: vi.fn().mockResolvedValue({ ok: true })
    });
    controllers.push(controller);
    act(() => controller.render(blacklistModel));
    const openButton = host.querySelector<HTMLButtonElement>('button');
    const fields = host.querySelector<HTMLElement>('._x_extension_shortcut_form_fields_2024_unique_');
    const textInput = host.querySelector<HTMLInputElement>('input:not([type="checkbox"])');
    const cancelButton = host.querySelector<HTMLButtonElement>(
      '._x_extension_shortcut_secondary_2024_unique_'
    );
    expect(fields?.hasAttribute('inert')).toBe(true);
    expect(cancelButton?.style.display).toBe('');

    act(() => openButton?.click());
    expect(fields?.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(textInput);
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(textInput, 'example.com');
      textInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => cancelButton?.click());

    expect(host.dataset.expanded).toBe('false');
    expect(fields?.hasAttribute('inert')).toBe(true);
    expect(textInput?.value).toBe('example.com');
    expect(cancelButton?.style.display).toBe('');
    expect(document.activeElement).toBe(openButton);

    act(() => openButton?.click());
    expect(textInput?.value).toBe('');
  });
});
