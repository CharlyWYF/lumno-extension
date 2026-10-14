Tags: Release

## Features

- 搜索源支持自定义排序：可在设置中拖动或使用上/下移按钮排列站内搜索、搜索引擎、AI 搜索、聚合搜索与浏览器内容，并调整搜索框面板中分组块的先后顺序；排序结果会同步到搜索框面板，且随配置一起同步与导出。默认按名称首字母排序，因此 AI 搜索排在搜索引擎与站内搜索之前。
- 将搜索源中的「AI」统一更正为「AI 搜索」，与搜索框面板的分组名称保持一致。
- 新增动态视频／阅读进度卡片：在 New Tab 固定剧集或小说页面后，可开启进度跟踪，卡片会随同一作品的后续集数、章节更新，并支持查看和恢复近期历史。可在常规设置及卡片上的跟踪按钮中控制。特别感谢 @JIANG-R98（JIANG）对动态更新卡片功能的建议与支持！
- 新增 WebDAV 同步，支持坚果云和自定义服务器、多连接管理，以及配置、快捷方式图标和自定义壁纸的同步；遇到冲突可查看本地与服务器差异后选择保留版本。
- 新增每日一言，中文界面可选择文学或诗词，调整位置和字号，并查看出处；新增 Bing 每日壁纸与近期壁纸浏览。感谢 #53 的建议。
- 支持快捷方式与书签之间双向拖动转换，也可将快捷方式拖入书签文件夹。感谢 @Gitnapp 在 PR #64 中的贡献！
- 支持自定义书签文件夹颜色，完善 New Tab 外观、壁纸、一言面板及快捷键参考页。
- 快捷方式支持 Chrome／Edge 内置页面，包括 `chrome://inspect/#devices`（#62）；搜索结果可选择在当前标签页左侧、右侧或标签栏末尾打开（#60）。
- 聚合搜索标签页组现在以“聚合搜索名称：查询内容”命名，便于识别并配置其他分组扩展的排除规则（#63）。
- New Tab、设置与新手引导适配手机宽度，统一控件、菜单、加载状态与操作反馈。

## Bug Fixes

- 已保存的快捷方式优先复用持久化图标，减少重复获取及通知数字造成的图标变化；完善内置图标与回退策略（#61）。
- 改进进度匹配，结合导航、页面提示和更严格的 URL 规则区分作品，减少跨作品误更新。
- 修复 WebDAV 连接管理边界问题，完善同步冲突处理、恢复流程及禅模式同步。
- 修复错误 Toast 文字难以辨认的问题，统一网页内容浮窗选择器的提示与加载反馈。
- 整理 New Tab 模块和 React 公共资源，避免将仅单页使用的组件放入共享包。

---

## Features

- Added custom ordering for search sources. Drag a row or use the up and down buttons to arrange site searches, search engines, AI search, aggregate searches and browser content, and reorder the group blocks in the search scope panel. The panel follows the saved order, and the order syncs and exports with the rest of the settings. Groups and providers sort alphabetically by name by default, so AI search comes before Search engines and Site search.
- Renamed the search sources "AI" label to "AI search" so it matches the search scope group name.
- Added dynamic watching and reading progress cards. Pin an episode or novel page in New Tab and enable tracking to follow later episodes or chapters of the same work, with recent history that can be reviewed and restored. Controls are available in General settings and on each card. Special thanks to @JIANG-R98 (JIANG) for the suggestions and support behind dynamic progress cards!
- Added WebDAV sync with Nutstore and custom servers, multiple connections, and syncing for settings, shortcut icons, and custom wallpapers. Compare local and server changes before resolving conflicts.
- Added daily quotes for Chinese UI languages, with literature and poetry categories, adjustable placement and font size, and source information. Added Bing daily wallpapers and a recent-wallpaper gallery. Thanks for the suggestion in #53.
- Added drag-and-drop conversion between shortcuts and bookmarks, including dropping shortcuts into bookmark folders. Thanks to @Gitnapp for the contribution in PR #64!
- Added custom bookmark folder colors and refined New Tab appearance, wallpaper and quote panels, and the keyboard shortcut reference.
- Shortcuts now support Chrome/Edge internal pages, including `chrome://inspect/#devices` (#62). Search results can open to the left or right of the current tab, or at the end of the tab strip (#60).
- Aggregate search tab groups now use “Aggregate name: query” naming, making groups easier to identify and exclude in other tab-grouping extensions (#63).
- Adapted New Tab, Settings, and onboarding to phone-sized screens, with consistent controls, menus, loading states, and feedback.

## Bug Fixes

- Saved shortcuts reuse persisted icons to reduce repeated fetching and changes caused by notification badges; improved bundled artwork and fallback behavior (#61).
- Improved progress matching with navigation context, page hints, and stricter URL rules to reduce updates from unrelated works.
- Fixed WebDAV connection-management edge cases and improved conflict handling, restoration, and Zen mode sync.
- Fixed unreadable error Toast text and unified feedback from the web-content floating-window picker and loading states.
- Refactored New Tab modules and React bundles to keep single-page components out of shared resources.
