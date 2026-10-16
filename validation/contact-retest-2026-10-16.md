# 联系方式功能复测

日期：2026-10-16（Asia/Shanghai）。用户明确要求“你测试一下”。所有写入只发生在专用本地D1/R2，未修改线上数据，未部署。

## 最终结果

| 检查 | 结果 |
| --- | --- |
| TypeScript检查、正式构建、差异格式检查 | 通过，退出码0 |
| 每日5位限额、同人重复查看、并发最后名额、普通帖共享额度 | 通过 |
| 上海时区午夜重置 | 受控时钟和真实内存SQLite检查通过 |
| 匿名拒绝、私有联系方式拒绝、错误管理凭证拒绝、撤回后不可读取 | 通过 |
| 旧数据库迁移 | 旧联系方式保留，展示范围默认为operator |
| 旧私有登记、测试登记不公开，列表与详情不泄露结构化联系方式 | 通过 |
| 原有账号、八城发帖、筛选、收藏、消息、举报、屏蔽等业务 | 原smoke-test退出码0 |
| 房屋字段、多图持久化、照片权限及撤回删除 | pilot-smoke-test退出码0 |
| Chromium实际点击流程与窄屏布局 | 7组检查通过，退出码0，未捕获异常0条 |

## 浏览器覆盖

使用环境已安装的Chromium与Playwright，没有安装新依赖。测试运行时为同一编译Worker与本地绑定，启用静态资源后加载实际页面及客户端脚本。

1. 390px手机视口打开快速登记：授权默认不勾选；填写求租资料、选择照片、明确同意公开和联系方式范围后，实际提交成功。
2. 点击“查看刚发布的帖子”进入对应ID的详情。首页卡片与详情均不显示虚构0岁或12个月租期。
3. 1280px桌面匿名点击“查看联系方式”，先进入登录；登录后自动显示授权微信，不要求先完善完整资料；点击复制后，剪贴板内容与微信号一致。
4. 登录弹窗打开后，由发布者关闭授权；登录恢复查看时，页面明确显示403拒绝提示，不把失败吞掉。
5. 本机重新打开登记，读取并保存联系方式范围；关闭后，已登录访客查询被拒绝。
6. 新表单授权选择与本机旧登记设置的单选组互不影响。
7. 360、390、430px下，页面、弹窗及弹窗正文均无横向溢出；管理区占据可用宽度。以上流程无未捕获浏览器异常。

证据（本地忽略产物）：

- [手机管理弹窗](../tongzhu-web/outputs/contact-mobile-retest.png)
- [桌面联系弹窗](../tongzhu-web/outputs/contact-desktop-retest.png)
- [浏览器结果JSON](../tongzhu-web/outputs/contact-browser-results.json)

## 本轮发现并修复

| 问题 | 原因 | 验证 |
| --- | --- | --- |
| 首页快速帖仍显示默认12个月租期和0岁 | 上次只处理详情，PostCard仍直接渲染默认模型值 | 浏览器断言先以“quick listing cards must not invent a 12-month lease”失败；卡片改为租期待沟通并隐藏无效年龄后通过 |
| 手机本机管理区文字挤窄、撤回按钮竖排 | 原CSS将日期、管理组件、撤回并排放在同一个flex行 | 管理字段宽度断言先失败；改为单列网格后通过，并检查截图 |

浏览器初始脚本还遇到networkidle等待超时、选择器重名及必填星号影响精确标签匹配；这些属于测试定位问题，已改为等待DOM/目标控件及明确定位，不计作产品缺陷。未通过的运行没有记为最终通过。

## 重现方法

先按实施报告初始化专用 `.wrangler/contact-tests` 库并构建，然后：

```sh
CONTACT_BROWSER_QA=1 node scripts/start-contact-test-server.mjs
```

另开终端执行：

```sh
node scripts/contact-day-test.mjs
node scripts/contact-smoke-test.mjs http://127.0.0.1:5188
node scripts/smoke-test.mjs http://127.0.0.1:5188
node scripts/pilot-smoke-test.mjs http://127.0.0.1:5188
node scripts/v19-public-audit.mjs http://127.0.0.1:5188 .wrangler/contact-tests
PLAYWRIGHT_MODULE=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/browser-contact-test.mjs
```

浏览器路径为本Cloud现有安装路径；其他环境可省略PLAYWRIGHT_MODULE使用自身安装的playwright，或指定对应路径。各套件会产生真实本地请求，连续执行可能碰到正常限流；本次在各独立场景之间只清理专用测试库的请求限流夹具，没有改变生产代码、每日去重表或生产限额。旧测试库在本轮前已移入忽略目录备份，没有删除。

所有浏览器创建的登记均在finally撤回，使用虚构账号、资料和1像素测试照片。浏览器自动化中的手机视口不能代替安卓/iPhone设备、输入法、移动网络或微信内的真人实测。当前线上仍未更新。
