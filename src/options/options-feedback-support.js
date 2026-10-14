(function(root) {
  'use strict';

  // The "Feedback & support" section on the General tab: the Help Center
  // card (with the "ask in the search box" demo while the lm site search is
  // on) and the community, review, GitHub and contact links. Links come from
  // the shared remote community-links file, with its bundled fallback first.

  // Options locale (zh_CN, zh_TW, ja, other) -> the website's locale.
  function getFeedbackSupportWebLocale(locale) {
    if (locale === 'zh_CN') {
      return 'zh-CN';
    }
    if (locale === 'zh_TW') {
      return 'zh-TW';
    }
    return locale === 'ja' ? 'ja' : 'en';
  }

  //   getMessage(key, fallback), communityLinks (LumnoCommunityLinks),
  //   links, webLocale, helpCenterSearchEnabled, helpIconUrl
  function buildFeedbackSupportModel(input) {
    const { communityLinks, getMessage, links, webLocale } = input;
    const communityIsWechat = communityLinks.getCommunityChannel(links, webLocale) === 'wechat';
    return {
      heading: getMessage('settings_feedback_support_section_title', '反馈与支持'),
      headingKey: 'settings_feedback_support_section_title',
      help: {
        ask: input.helpCenterSearchEnabled !== true ? null : {
          caption: getMessage('settings_help_center_ask_caption', '在新标签页或命令栏输入 lm 或「帮助中心」，按 Tab，再写下你的问题。'),
          captionKey: 'settings_help_center_ask_caption',
          iconUrl: input.helpIconUrl,
          label: getMessage('settings_help_center_ask_action', '在搜索框中提问'),
          labelKey: 'settings_help_center_ask_action',
          prefix: 'lm',
          providerName: getMessage('site_search_name_lumno_help', 'Lumno 帮助中心'),
          query: getMessage('settings_help_center_ask_demo_query', '怎么修改快捷键'),
          results: [
            {
              detail: getMessage('settings_help_center_ask_demo_result_1_detail', '修改快捷键'),
              title: getMessage('settings_help_center_ask_demo_result_1_title', '快捷键')
            },
            {
              detail: getMessage('settings_help_center_ask_demo_result_2_detail', '快捷键没反应怎么办？'),
              title: getMessage('settings_help_center_ask_demo_result_2_title', '常见问题')
            }
          ]
        },
        description: getMessage('settings_help_center_desc', '不清楚某个功能怎么用？每个功能的用法都写在这里。'),
        descriptionKey: 'settings_help_center_desc',
        href: communityLinks.getHelpUrl(webLocale),
        label: getMessage('settings_help_center_action', '查看'),
        labelKey: 'settings_help_center_action',
        title: getMessage('settings_help_center_title', '帮助中心'),
        titleKey: 'settings_help_center_title'
      },
      items: [
        // Chinese readers get the WeChat group; elsewhere "contact the author" (X) below is the community entry.
        ...(communityIsWechat
          ? [{
              href: links.wechatQr,
              iconClass: 'ri-wechat-line',
              key: 'community',
              label: getMessage('settings_feedback_support_wechat_action', '加入反馈群'),
              labelKey: 'settings_feedback_support_wechat_action',
              qr: {
                alt: getMessage('newtab_feedback_wechat_qr_alt', 'Lumno 微信群二维码'),
                closeLabel: getMessage('newtab_feedback_wechat_close_tooltip', '关闭'),
                imageUrl: links.wechatQr,
                title: getMessage('newtab_feedback_wechat_panel_title', 'Bug 反馈 & 新功能提需')
              }
            }]
          : []),
        {
          href: communityLinks.getReviewUrl(links),
          iconClass: 'ri-star-line',
          key: 'chrome-review',
          label: getMessage('settings_feedback_support_review_action', '为 Lumno 评分'),
          labelKey: 'settings_feedback_support_review_action'
        },
        {
          href: links.githubIssue,
          iconClass: 'ri-github-line',
          key: 'github-issue',
          label: getMessage('settings_feedback_support_github_issue_action', '创建 Issue'),
          labelKey: 'settings_feedback_support_github_issue_action'
        },
        {
          href: links.x,
          iconClass: 'ri-twitter-x-line',
          key: 'contact-author',
          label: getMessage('settings_feedback_support_contact_author_action', '联系作者'),
          labelKey: 'settings_feedback_support_contact_author_action'
        }
      // Firefox has no store listing to review yet (empty review URL).
      ].filter((item) => Boolean(item.href))
    };
  }

  //   controller            the section's React controller (may be null)
  //   communityLinks        LumnoCommunityLinks
  //   getMessage, getLocale(), isHelpCenterSearchEnabled(), helpIconUrl
  function createFeedbackSupportSection(options) {
    const communityLinks = options.communityLinks;
    let links = communityLinks.FALLBACK_LINKS;

    function render() {
      if (!options.controller) {
        return;
      }
      options.controller.render(buildFeedbackSupportModel({
        communityLinks,
        getMessage: options.getMessage,
        helpCenterSearchEnabled: options.isHelpCenterSearchEnabled(),
        helpIconUrl: options.helpIconUrl,
        links,
        webLocale: getFeedbackSupportWebLocale(options.getLocale())
      }));
    }

    // Shows the bundled links at once, then the remote ones once they load.
    function loadLinks() {
      return communityLinks.load().then((loaded) => {
        links = loaded || communityLinks.FALLBACK_LINKS;
        render();
        return links;
      });
    }

    return Object.freeze({ loadLinks, render });
  }

  const api = Object.freeze({
    buildFeedbackSupportModel,
    createFeedbackSupportSection,
    getFeedbackSupportWebLocale
  });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LumnoOptionsFeedbackSupportSection = api;
})(globalThis);
