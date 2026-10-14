# 创业梳理项目交接文档

更新时间：2026-10-14（Asia/Shanghai）。本文件依据当前工作目录中的源码及说明整理；产品能力以实际运行验收为准。

## 项目与仓库

- GitHub： https://github.com/569316512-ops/startup-planning
- 汇总分支：`main`。本次归档接续远端既有提交，不覆盖远端历史。
- 本地目录：`D:\zzitao\gpt project\创业梳理`。
- 当前具体产品是「一起租」：面向贵阳用户的原户型合租、求租和室友联系平台。
- 创业背景、时间投入约束及其他探索方向见 [个人背景与创业方向.md](个人背景与创业方向.md)。该文件区分明确事实与暂时判断，后续应持续修订。

## 文件导航

| 路径 | 内容与用途 |
| --- | --- |
| `个人背景与创业方向.md` | 个人背景、城市＋AI 和内容创业探索 |
| `roomdate-web/` | RoomDate 原版 React/Vite + Go/PostgreSQL 项目，供参考与独立开发 |
| `tongzhu-web/` | 一起租当前实现，React + vinext/Vite + Cloudflare D1/R2 |
| `tongzhu-web/upstream/roomdate/` | 改造时保留的上游源码及数据契约 |
| `tongzhu-web/lib/server.ts` | 当前账户、帖子、聊天、收藏、举报等服务逻辑 |
| `tongzhu-web/components/TongzhuApp.tsx` | 应用前端入口，其他界面拆分在 `components/` |
| `tongzhu-web/lib/models.ts`、`lib/compatibility.ts` | 贵阳区域、业务模型、可解释习惯匹配 |
| `tongzhu-web/db/schema.ts`、`drizzle/` | D1 数据模型及已生成迁移 |
| `tongzhu-web/.openai/hosting.json` | Sites 项目关联与 DB/BUCKET 绑定名称 |
| `一起租预览.png` | 现有页面预览截图 |
| `yiqizu-deploy.tar.gz` | 现有构建部署包，内含 `dist/`；它是归档快照，后续改代码须重新构建 |
| `tongzhu-web/需求实现对照.md` | 原需求与实现位置对应表 |
| `tongzhu-web/UPSTREAM.md` | 源码来源、授权信息及改造边界 |

## 当前产品状态

项目说明及源码记录了图文房源/求租帖、贵阳六区筛选、预算和习惯匹配、账户资料、收藏、保存搜索、房源意向名单、私有联系方式授权、聊天、举报屏蔽、管理员审核和 R2 图片上传。管理员初始化要求服务器配置的邮箱和私有引导令牌同时匹配。

演示用户及房源来自 `lib/demo.ts`，是虚构数据，不写入生产数据库；不能作为真实房源或真实运营反馈。当前聊天采用服务器存储及成员权限控制，HTTPS 由部署平台提供，未移植原 RoomDate 的端到端加密协议。两套项目的安全能力和运行方式不能直接混用。

尚未接入邮箱验证/邮件找回、短信登录、微信/支付宝支付、第三方身份或背景调查、邮件通知、截图 OCR、实时 AI 房源抓取。推广订单仅记录申请，不扣款；人工验证需管理员审核。自然语言 AI 资料咨询需实际服务密钥。

## 接手运行：一起租

要求 Node.js >=22.13，项目建议 Node.js 24，并安装 npm。先在新克隆目录执行：

```powershell
git clone https://github.com/569316512-ops/startup-planning.git
cd startup-planning/tongzhu-web
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_soft_scalphunter.sql
npm run dev
```

通常访问 `http://127.0.0.1:5173`。现有 SQL 已入库，新本地数据库直接应用一次即可；不需要为启动重复执行 `db:generate`。更改模型时再生成新迁移，避免重写已应用迁移。

本地类型与业务检查：

```powershell
node node_modules/typescript/bin/tsc --noEmit
node scripts/smoke-test.mjs http://127.0.0.1:5173
```

Smoke test 仅允许本地地址，会创建虚构账号和测试数据，并在结束时删除测试帖子；它不保证清理全部测试账户。应在专用本地数据库运行。当前电脑的便携 npm 和执行配置位于被忽略的 `.sites-runtime/`，新电脑须使用自己的 Node/npm 环境。

## 配置、部署与数据

`tongzhu-web/.openai/hosting.json` 当前关联项目 `appgprj_6acf3606f92881919e76f18dea03390e`，绑定 `DB`（D1）和 `BUCKET`（R2）。GitHub 克隆并不复制云数据库、图片桶内容或平台访问权限；换账号部署需要重新关联平台项目和资源。

可选服务器变量写入本地忽略的 `.dev.vars` 或平台环境变量管理：

| 变量 | 用途 |
| --- | --- |
| `ADMIN_EMAIL`、`ADMIN_SETUP_TOKEN` | 管理员首次建档；可用 `scripts/create-admin.mjs` 初始化 |
| `AI_API_KEY` | 真实 AI 接口密钥，仅供服务端读取 |
| `AI_BASE_URL` | OpenAI 兼容接口地址 |
| `AI_MODEL` | 实际账户可用的模型名称 |

不得将实际密钥写入源码。部署包已有 `dist/client`、`dist/server` 及迁移相关文件；部署流程参考项目 README 和现有 Sites 配置。当前可访问的源码未提供可核验的“一起租”生产 URL，本次 GitHub 推送不等同于网站已发布，也不改变站点访问范围。公开运营前应完成管理员配置、运营主体与正式隐私政策，并验证生产资源及上传、聊天等流程。

## 原 RoomDate 的接手方式

`roomdate-web/README.md` 是上游项目说明，包含其 Vercel 示例地址，不能据此当成一起租的线上地址。该项目需要 Go 1.26+、Node.js 20+ 和开发 PostgreSQL；复制 `.env.example` 到 `.env.local` 后配置开发库，再运行 `npm ci`、`npm run db:migrate`、`npm run dev:api` 和 `npm run dev`。具体环境、R2、Pusher 及密码恢复机制以原项目 README 为准。

上游来源是 `yeddaTech/roomdate`，基准提交 `fc6cd1359ede350daa79ae3998ffc280fd4eed03`。使用许可依据用户已有确认记录，详见 `UPSTREAM.md`，不据此新增 MIT 等许可证声明。

## 归档范围与验证记录

本次收录项目源码、说明、锁文件、SQL 迁移、公开托管配置、截图和现有部署压缩包。根目录采用普通文件方式收录两个子项目，避免 Git 将其仅记录为嵌套仓库引用；子项目本机 `.git` 元数据保留，本次不迁移它们的独立 Git 历史。

依赖 `node_modules/`、构建缓存 `.next/`/`.vinext/`、本地 D1/R2 状态 `.wrangler/`、便携工具 `.sites-runtime/`、TypeScript 缓存、私有环境文件和子项目原有忽略项不推送。这些内容留在本机；构建结果保留在根目录部署包中。

- 2026-10-14：在现有 Windows 工作目录执行一起租 `tsc --noEmit`，退出码 0。
- 本次以归档和交接为目的，未执行全套功能测试、生产部署或云端数据迁移；上述功能状态来自项目说明和源码检查。
- 推送后以本地 `HEAD` 与 GitHub `refs/heads/main` 的提交一致作为上传完成依据。

## 下一步建议

1. 从 GitHub 新克隆，在专用本地数据库启动一起租并执行 smoke test，验证环境可复现。
2. 核实平台访问范围、DB/R2 资源、管理员建档与真实图片上传，完成小范围真实用户验收。
3. 补齐原始需求材料：项目引用的 `D:/zzitao/idea/找室友app.docx` 在本项目目录外，本次不包含该文件。
4. 围绕贵阳真实供需、发帖量、有效联系量和复访情况验证 MVP，再确定 OCR、实时 AI 和付费推广优先级。
