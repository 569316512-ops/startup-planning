# 一起租 贵阳租房找室友

基于已获用户确认授权的 RoomDate 源码与 Roomies 的产品流程，按照 `D:/zzitao/idea/找室友app.docx` 的需求实现。首期城市贵阳，提供网页端原户型合租与室友联系。

## 已实现

- 两种图文帖子：有房/看好房招室友；先发布个人资料和求租需求。
- 四种房源状态：已租好、一起租、房东直租、中介房源；后两种须匹配个人发布身份。
- 贵阳六区、关键词、月预算、两居/三居、生活偏好与设施筛选，价格/时间/共同习惯排序。
- 个人资料、生活标签、预算、入住时间、微信电话授权；邮箱不对外展示。
- 房源意向名单：感兴趣的人登记后展示公开个人资料，方便互相联系。
- 注册、登录、账户会话、密码修改、服务器持久收藏、保存搜索、帖子编辑/上架/下架/删除。
- 权限保护的服务器聊天，每4秒刷新；双向屏蔽、举报、人工验证申请和管理员审核。
- R2 图片上传，JPEG/PNG/WebP，每张5MB以内，每帖最多8张。
- 问答建档、可解释习惯匹配；可配置真实大模型资料咨询。
- 区域地图、外链高德搜索、合租约定文本下载、浏览器本地看房清单。
- 推广申请保存在服务器，支付渠道接通前不扣款、不展示付费推广。
- 桌面和移动端适配，可分享的帖子链接与保存在URL中的筛选条件。

## 运行

Node.js >=22.13，建议24；npm或对应包管理器。

```text
npm ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_soft_scalphunter.sql
npm run dev
```

已有迁移只需在新本地数据库执行一次，不要重复生成或修改已应用SQL。预览地址通常是 http://127.0.0.1:5173 。如npm在PATH不可用，可直接 `node scripts/run-framework.mjs dev`，安装仍需包管理器。

```text
node node_modules/typescript/bin/tsc --noEmit
node scripts/smoke-test.mjs http://127.0.0.1:5173
```

Smoke test仅支持本地地址，创建虚构测试账号并在结束时删除测试帖子，不修改线上数据。

## 数据与配置

`.openai/hosting.json` 绑定 `DB`（Cloudflare D1）与 `BUCKET`（R2）。公开页面未登录可浏览，发布/联系/收藏需要本站账号。Sites预览站默认是仅站点所有者可见；公开运营须另行更改站点访问范围。

可选运行环境变量，通过本地忽略的 `.dev.vars` 或 Sites 环境变量工具设置：

- `ADMIN_EMAIL` 与 `ADMIN_SETUP_TOKEN`：管理员首次建档需邮箱与私有引导令牌同时匹配。令牌仅在服务器配置，普通网页注册不能成为管理员。可用 `scripts/create-admin.mjs` 从本地终端完成初始化；不要把令牌写入源码。
- `AI_API_KEY`：真实大模型接口密钥，仅在服务器使用。
- `AI_BASE_URL`：OpenAI兼容接口地址，默认 https://api.openai.com/v1。
- `AI_MODEL`：默认 gpt-4.1-mini；按照实际账户可用模型设置。
- `AMAP_API_KEY`：可选的高德 Web 服务 Key。配置后，发布房源时会按小区位置补全经纬度、最近公共交通和附近生活配套；未配置时保留发布者填写的信息，并提供高德地图核对入口。

当前没有邮箱验证或密码找回服务；没有短信登录。默认聊天未移植上游E2EE协议，而是HTTPS及成员权限保护。部署侧HTTPS由平台提供。

## 演示与外部能力

示例房源和用户由 `lib/demo.ts` 生成，全部虚构，图片为Unsplash场景示意。示例不会写入生产数据库，不能联系、收藏或登记真实意向。主页可关闭示例数据。无图真实帖展示暂无照片的占位状态。

真实身份/征信/背景调查、微信/支付宝支付、邮件通知均未接入；相关界面只支持申请或说明，不伪造通过状态。管理员核实身份后才能显示人工验证标记。截图OCR导入按需求文档保留为后续计划。

当前自然语言AI仅做资料和租房问题咨询，不自动访问实时房源；相同习惯排序是确定性比较。公开运营前需配置管理员、完善运营主体和正式隐私政策，并接通支付及验证供应商。

源码来源及具体复用见 `UPSTREAM.md`。原RoomDate Go服务和React源码留存在 `upstream/roomdate/`；当前上线使用TypeScript/D1适配层。
