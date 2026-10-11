import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createFeedbackSupportApi,
  createFeedbackSupportController,
  type FeedbackSupportController,
  type FeedbackSupportRenderModel
} from './feedback-support';

let controllers: FeedbackSupportController[] = [];

const model: FeedbackSupportRenderModel = {
  contact: {
    description: '遇到问题或有想法，欢迎告诉作者',
    descriptionKey: 'settings_feedback_contact_desc',
    title: '问题与建议',
    titleKey: 'settings_feedback_contact_title'
  },
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
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  controllers = [];
  document.body.textContent = '';
});

describe('Options feedback support React island', () => {
  it('lays the contact links out as one settings row of quiet icon buttons', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));

    expect(createFeedbackSupportApi().implementation).toBe('react');
    expect(host.dataset.reactIsland).toBe('options-feedback-support');
    const rows = host.querySelectorAll('._x_extension_feedback_support_row_2026_unique_');
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector('._x_extension_setting_title_2024_unique_')?.textContent).toBe('问题与建议');
    expect(rows[0].querySelector('._x_extension_setting_desc_2024_unique_')?.textContent)
      .toBe('遇到问题或有想法，欢迎告诉作者');
    const links = rows[0].querySelectorAll('nav a._x_extension_feedback_support_action_2026_unique_');
    expect(links).toHaveLength(4);
    links.forEach((link) => {
      expect(link.firstElementChild?.classList.contains('ri-icon')).toBe(true);
      expect(link.querySelector('span')?.textContent).toBeTruthy();
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
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('._x_extension_setting_title_2024_unique_')?.textContent).toBe('帮助中心');
    const link = rows[0].querySelector<HTMLAnchorElement>('[data-feedback-support="help-center"]');
    expect(link?.href).toBe('https://lumno.kubai.design/help/what-is-lumno/');
    expect(link?.target).toBe('_blank');
    expect(link?.textContent).toBe('查看');
    expect(link?.querySelector('.ri-external-link-line')).not.toBeNull();
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
