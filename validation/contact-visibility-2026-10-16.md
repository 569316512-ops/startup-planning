# 自助联系方式授权：实施与验证

日期：2026-10-16（Asia/Shanghai）。基于 GitHub `db3ab70` 的第19版源码实施；**本地已实现，尚未发布**。未改生产数据、未开放旧登记的联系方式。

## 后续复测补充（2026-10-16）

用户要求复测后，已完成Chromium桌面与360/390/430px视口的真实浏览器交互检查，补测通过。本文件下方“没有浏览器交互”的表述记录首次实现时的验证边界，当前以 [复测报告](contact-retest-2026-10-16.md) 为准；真实手机/微信仍待测。新增修复：首页卡片不再显示0岁和默认12个月租期，本机管理区改为纵向排列。

## 行为

- 快速登记主动选择 `members` 或 `operator`，没有默认勾选；未选择/非法值均400。联系方式类型仍二选一，仅展示所选微信或电话。
- 公开列表、详情及首页不提供结构化号码；`contactPublic` 只表示是否开放。
- `POST /api/v1/pilot/leads/:id/contact`：登录后查看授权联系方式。401未登录、403未授权、404无效/已匹配/超30天/已撤回，429触发限额。响应 `Cache-Control: no-store`。
- `POST /api/v1/pilot/leads/:id/contact-settings`：凭正文中的 `receiptToken` 读取展示范围；PUT同路径明确保存新选择。凭证错误404，不能靠知道登记ID管理别人。
- 原普通账号联系方式接口也使用同一限额。每个账号按上海日历日计5个不同联系方式身份（类型加值的哈希），重复查看及同联系方式多条帖子不重复计数。并发最后一个名额只放行一次；账号20次/分钟、IP60次/分钟限制仍适用。哈希不是联系方式加密备份，不对外返回。
- 关闭授权后再次查询被拒绝，即使当天已看过；撤回删除后同样不可再查。无法收回别人已经复制的信息。
- 快速帖删除无效聊天/合租意向入口；未授权时显示“未开放直接联系”。已授权时登录/注册完成后恢复原操作，不强制先完成完整资料；失败提示保留在应用中。
- 多个本机登记的展示范围使用独立单选组。旧私有登记可明确授权联系方式，但不会因此自动变为公开帖子。
- 提交后定位新帖详情；快速帖详情隐藏0岁与默认12个月租期。公开照片改为不缓存，既有缓存/下载副本不能主动收回。

## 数据迁移

追加 `0003_round_praxagora.sql` 与对应快照、journal；旧迁移不变。新增 `contact_visibility TEXT NOT NULL DEFAULT 'operator'`，以及按 viewer/day/target_hash 唯一的 `contact_views`。

已用内存SQLite应用0000至0002、插入旧记录，再应用0003，确认旧值不变且展示范围为operator。部署必须带上迁移，Sites正常发布流程会在Worker更新前应用。

## 验证证据

- 首次联系方式专项在缺少接口时以404代替预期401失败，证明测试覆盖新增行为。
- 生命周期回归在失效帖仍出现在列表时失败，修正列表、详情、公开照片及联系接口的一致资格判断后通过。
- TypeScript `--noEmit`、正式构建：退出码0。
- `node scripts/contact-day-test.mjs`：真实内存SQLite与受控时钟，上海23:59:59至次日00:00:00恢复名额，退出码0。
- `node scripts/contact-smoke-test.mjs http://127.0.0.1:5188`：未授权/匿名拒绝、列表和详情不泄露号码、回执权限、关停再启、微信/电话正确返回、重复身份去重、并发最终名额、普通帖共用额度、隔日隔离、失效与过期一致隐藏、撤回后不可读取，退出码0。创建的登记在finally撤回；虚构账号只在本地。
- 原 `smoke-test.mjs`：账户、两种帖子、八城、筛选、权限、收藏、意向、联系方式、双用户聊天、举报、验证、CSRF、屏蔽与退出通过，退出码0。
- 原 `pilot-smoke-test.mjs`：房屋字段、多图持久化、上传权限、撤回删除、测试数据隔离等通过，退出码0。
- 首页HTTP200；没有浏览器交互、移动端视觉或大陆微信真机验收证据。

本地Wrangler曾出现明确的“Your worker restarted mid-request”503和请求超时；失败运行未计为通过。最终在同一编译Worker、独立本地D1/R2上使用固定Miniflare测试运行时完成回归，未修改业务逻辑来绕过校验，最终专项无重试。

## 重现测试

准备专用本地测试库，不能指向生产；首次运行：

```sh
cd tongzhu-web
npm ci
npm run build
for migration in drizzle/*.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/contact-tests --file "$migration" || break
done
node scripts/start-contact-test-server.mjs
```

另一个终端执行上述测试命令。测试服务只供API回归，无生产绑定，不用它代替真实浏览器验收。`contact-smoke-test.mjs` 为模拟隔日及失效场景会修改专用测试SQLite夹具，必须使用该专用库。重复跑套件可能触发真实请求限额，等待窗口或另建专用测试库，不改生产限额。

## 代码审查及发布状态

专项审查和复审已完成，无剩余阻塞级代码问题。待补浏览器回归：多个登记单选组互不干扰、登录后失败提示可见、手机表单及直接联系流程。

Cloud未找到 Sites 指定的 `site-workflow.mjs`、`build-site.mjs` 插件脚本，对应技能资源也未返回脚本。因此本轮未源同步、未保存Sites版本、未生产部署。现有线上仍是第19版；本地验证不等于上线。

后续在具备插件脚本的环境，保留项目 `appgprj_6acf3606f92881919e76f18dea03390e` 及public访问范围，正常源同步/构建/打包/保存版本/部署。部署后先匿名复核权限，再请真实手机验收；不要将普通登录宣传成手机认证。
