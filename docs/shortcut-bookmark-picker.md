# 从收藏夹添加快捷方式

适用版本：本 fork 的 1.0.3 及以上。

1. 点击新标签页的“添加快捷方式”按钮，在原有菜单中选择“添加网站”。
2. 在添加窗口点击“从收藏夹选择”。列表包含收藏夹栏、其他收藏夹及其子文件夹中的可用网址。
3. 搜索名称、网址或文件夹路径，选中网站后自动填入名称和网址。也可以按 Enter 选择首个可添加的匹配项。
4. 按需要修改名称、网址或图标来源，然后点击“完成”。快捷方式加入原有的目标分组，继续使用已有的图标、排序和编辑功能。

此操作只读取原生收藏夹，创建独立的快捷方式；不会移动、修改或删除收藏夹中的网站。原收藏发生变化后，已经创建的快捷方式不会自动跟随修改。“自定义最常访问”保留，两种手动管理方式可同时使用，互不合并。

已经存在于快捷方式中的相同规范化网址会显示“已添加”，不能重复选择。列表不显示文件夹本身、不支持的网址协议或带用户名／密码的网址。空收藏夹和搜索无结果时仍可在下方手动填写网址；读取失败可点击“重试”。

每次展开读取现有收藏夹运行时缓存，收藏夹变更事件会使缓存失效。初始显示 30 个搜索结果，点击“显示更多”继续展开；搜索覆盖全部候选，不限于已显示的结果。关闭窗口或选择区后，迟到的读取结果不会重新打开界面。

搜索框支持中文输入法；输入法确认不触发选择。ArrowDown 可进入首个可选结果，Tab 沿窗口控件导航。选择区内按 Esc 收起选择区并返回展开按钮，再按 Esc 关闭添加窗口；选中后焦点转到名称输入框，便于修改。

收藏夹读取复用扩展已有的 `bookmarks` 权限，不增加权限或联网搜索服务。

## 验证

- `node scripts/test-shortcut-bookmark-choices.js`：所有文件夹、路径、网址过滤、重复标记和源数据不变。
- `react-src/newtab/shortcut-dialog.test.tsx`：搜索、自动填入、沿用保存逻辑、分页、键盘／输入法、失败重试、空状态及迟到响应。
- 隔离的 Edge 扩展实机检查：原入口菜单、真实收藏夹读取、保存和刷新恢复、原收藏夹不变、重复禁选、浅色／深色／窄屏及自定义模式保留。

## Direction contract

THESIS: Select existing bookmarks instead of retyping their URLs.
OWN-WORLD: Preserve Lumno's dialog, tokens, themes, groups and icon controls.
STORY: Add site; expand bookmark choices; search; select; optionally edit; save.
FIRST VIEWPORT: Inline chooser above the name field in the original 420px modal; bounded result scrolling.
FORM: Narrow Operate extension of the incumbent surface; no new identity or comp.
FINISH: Verify desktop, dark, mobile, keyboard, persistence and read-only bookmark access; finish review and scope-bound documentation.
