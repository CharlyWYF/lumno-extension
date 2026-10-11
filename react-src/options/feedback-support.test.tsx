import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAskDemoFrames,
  createFeedbackSupportApi,
  createFeedbackSupportController,
  type FeedbackSupportController,
  type FeedbackSupportRenderModel
} from './feedback-support';

let controllers: FeedbackSupportController[] = [];

const model: FeedbackSupportRenderModel = {
  heading: '反馈与支持',
  headingKey: 'settings_feedback_support_section_title',
  items: [
    {
      href: 'https://example.com/qrcode.JPG',
      iconClass: 'ri-wechat-line',
      key: 'community',
      label: '加入反馈群',
      labelKey: 'settings_feedback_support_wechat_action'
    },
    {
      href: 'https://chromewebstore.google.com/example/reviews',
      iconClass: 'ri-star-line',
      key: 'chrome-review',
      label: '为 Lumno 评分',
      labelKey: 'settings_feedback_support_review_action'
    },
    {
      href: 'https://github.com/example/issues/new',
      iconClass: 'ri-github-line',
      key: 'github-issue',
      label: '创建 Issue',
      labelKey: 'settings_feedback_support_github_issue_action'
    },
    {
      href: 'https://x.com/example',
      iconClass: 'ri-twitter-x-line',
      key: 'contact-author',
      label: '联系作者',
      labelKey: 'settings_feedback_support_contact_author_action'
    }
  ]
};

function createFixture() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const controller = createFeedbackSupportController(host);
  controllers.push(controller);
  return { controller, host };
}

afterEach(() => {
  vi.useRealTimers();
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  controllers = [];
  document.body.textContent = '';
});

describe('Options feedback support React island', () => {
  it('lays the feedback channels out as one row of tiles under the heading', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));

    expect(createFeedbackSupportApi().implementation).toBe('react');
    expect(host.dataset.reactIsland).toBe('options-feedback-support');
    const nav = host.querySelector('nav._x_extension_feedback_support_links_2026_unique_');
    const tiles = nav?.querySelectorAll('a._x_extension_feedback_support_link_2026_unique_') || [];
    expect(tiles).toHaveLength(4);
    tiles.forEach((tile) => {
      expect(tile.firstElementChild?.classList.contains('ri-icon')).toBe(true);
      expect(tile.querySelector('span')?.textContent).toBeTruthy();
      expect(tile.lastElementChild?.classList.contains('ri-external-link-line')).toBe(true);
    });
  });

  it('uses secure external anchors and preserves the provided destinations', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));

    const community = host.querySelector<HTMLAnchorElement>(
      '[data-feedback-support="community"]'
    );
    expect(community?.href).toBe('https://example.com/qrcode.JPG');
    expect(community?.target).toBe('_blank');
    expect(community?.rel).toContain('noopener');
  });

  it('puts the help center first as its own row with an Open link', () => {
    const { controller, host } = createFixture();
    act(() => controller.render({
      ...model,
      help: {
        description: '不清楚某个功能怎么用？每个功能的用法都写在这里',
        descriptionKey: 'settings_help_center_desc',
        href: 'https://lumno.kubai.design/help/what-is-lumno/',
        label: '查看',
        labelKey: 'settings_help_center_action',
        title: '帮助中心',
        titleKey: 'settings_help_center_title'
      }
    }));

    const rows = host.querySelectorAll('._x_extension_feedback_support_row_2026_unique_');
    expect(rows).toHaveLength(1);
    expect(rows[0].nextElementSibling?.tagName).toBe('NAV');
    expect(rows[0].querySelector('._x_extension_setting_title_2024_unique_')?.textContent).toBe('帮助中心');
    const link = rows[0].querySelector<HTMLAnchorElement>('[data-feedback-support="help-center"]');
    expect(link?.href).toBe('https://lumno.kubai.design/help/what-is-lumno/');
    expect(link?.target).toBe('_blank');
    expect(link?.textContent).toBe('查看');
    expect(link?.querySelector('.ri-external-link-line')).not.toBeNull();
    // Without the Help Center site search there is nothing to demo.
    expect(rows[0].querySelector('[data-feedback-support="help-center-ask"]')).toBeNull();
  });

  it('plays a demo of asking the help center from the search box on hover or focus', () => {
    vi.useFakeTimers();
    const { controller, host } = createFixture();
    act(() => controller.render({
      ...model,
      help: {
        ask: {
          caption: '输入 lm，按 Tab，再写下你的问题。',
          captionKey: 'settings_help_center_ask_caption',
          iconUrl: 'chrome-extension://id/assets/images/site-search/glyph-lm.png',
          label: '在搜索框中提问',
          labelKey: 'settings_help_center_ask_action',
          prefix: 'lm',
          providerName: 'Lumno 帮助中心',
          query: '怎么改',
          results: [{ detail: '修改快捷键', title: '快捷键' }]
        },
        description: '不清楚某个功能怎么用？',
        descriptionKey: 'settings_help_center_desc',
        href: 'https://lumno.kubai.design/help/what-is-lumno/',
        label: '查看',
        labelKey: 'settings_help_center_action',
        title: '帮助中心',
        titleKey: 'settings_help_center_title'
      }
    }));

    const row = host.querySelector('._x_extension_feedback_support_row_2026_unique_');
    const trigger = row?.querySelector<HTMLButtonElement>('button[data-feedback-support="help-center-ask"]');
    expect(trigger?.nextElementSibling).not.toBeNull();
    expect(trigger?.closest('._x_extension_help_ask_anchor_2026_unique_')?.nextElementSibling
      ?.getAttribute('data-feedback-support')).toBe('help-center');
    const popover = host.querySelector<HTMLElement>('[role="tooltip"]');
    expect(popover?.dataset.open).toBe('false');
    expect(trigger?.getAttribute('aria-describedby')).toBe(popover?.id);

    act(() => {
      trigger?.focus();
      vi.advanceTimersByTime(0);
    });
    expect(popover?.dataset.open).toBe('true');

    const demo = popover?.querySelector<HTMLElement>('._x_extension_help_ask_demo_2026_unique_');
    const frames = buildAskDemoFrames('lm', '怎么改');
    const playUntil = (phase: string) => {
      for (let step = 0; step < frames.length * 2 && demo?.dataset.phase !== phase; step += 1) {
        act(() => {
          vi.advanceTimersByTime(3000);
        });
      }
    };
    // While the question is typed, placeholder rows stand in for each page about to appear.
    const skeletonRows = demo?.querySelectorAll('._x_extension_help_ask_demo_skeleton_2026_unique_ li');
    expect(skeletonRows).toHaveLength(1);
    expect(skeletonRows?.[0].textContent).toBe('');
    expect(demo?.querySelector<HTMLElement>('._x_extension_help_ask_demo_results_2026_unique_')?.dataset.visible)
      .toBe('false');
    playUntil('tab');
    expect(demo?.querySelector('._x_extension_help_ask_demo_text_2026_unique_')?.textContent).toBe('lm');
    expect(demo?.querySelector('kbd')?.dataset.pressed).toBe('true');
    playUntil('results');
    expect(demo?.querySelector('._x_extension_help_ask_demo_chip_2026_unique_')?.textContent).toBe('Lumno 帮助中心');
    expect(demo?.querySelector('._x_extension_help_ask_demo_text_2026_unique_')?.textContent).toBe('怎么改');
    const results = demo?.querySelector<HTMLElement>('._x_extension_help_ask_demo_results_2026_unique_');
    expect(results?.dataset.visible).toBe('true');
    expect(results?.querySelectorAll('._x_extension_help_ask_demo_list_2026_unique_ li')).toHaveLength(1);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });
    expect(popover?.dataset.open).toBe('false');
    expect(demo?.dataset.phase).toBe('idle');
  });

  it('builds one demo loop: keyword, Tab, the question letter by letter, then the pages', () => {
    const frames = buildAskDemoFrames('lm', '快捷键');
    expect(frames.map((frame) => frame.phase)).toEqual([
      'idle', 'prefix', 'prefix', 'tab', 'question', 'question', 'question', 'question', 'results'
    ]);
    expect(frames.every((frame) => frame.duration > 0)).toBe(true);
  });

  it('opens the WeChat group QR code in a popover instead of a new tab', () => {
    const { controller, host } = createFixture();
    act(() => controller.render({
      ...model,
      items: model.items.map((item) => item.key === 'community'
        ? {
            ...item,
            qr: {
              alt: 'Lumno 微信群二维码',
              closeLabel: '关闭',
              imageUrl: 'https://example.com/qrcode.webp',
              title: 'Bug 反馈 & 新功能提需'
            }
          }
        : item)
    }));

    const trigger = host.querySelector<HTMLButtonElement>('button[data-feedback-support="community"]');
    expect(trigger?.classList.contains('_x_extension_feedback_support_link_2026_unique_')).toBe(true);
    expect(trigger?.querySelector('.ri-qr-code-line')).not.toBeNull();
    const popover = host.querySelector<HTMLElement>('[role="dialog"]');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(popover?.dataset.open).toBe('false');
    expect(popover?.querySelector('img')?.getAttribute('src')).toBe('https://example.com/qrcode.webp');

    act(() => trigger?.click());
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(popover?.dataset.open).toBe('true');

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });
    expect(popover?.dataset.open).toBe('false');

    act(() => trigger?.click());
    act(() => popover?.querySelector<HTMLButtonElement>('button')?.click());
    expect(popover?.dataset.open).toBe('false');
  });

  it('updates the localized community entry in place', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));
    act(() => controller.render({
      ...model,
      heading: 'Feedback & Support',
      items: model.items.map((item) => item.key === 'community'
        ? {
            ...item,
            href: 'https://example.com/qr-v2.webp',
            label: '加入反馈群（新）',
            labelKey: 'settings_feedback_support_wechat_action'
          }
        : item)
    }));

    expect(host.querySelector('h2')?.textContent).toBe('Feedback & Support');
    expect(host.querySelector('[data-feedback-support="community"]')?.textContent)
      .toContain('加入反馈群（新）');
  });
});
