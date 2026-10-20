# CloudBase 国内 H5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以现有免费 CloudBase 环境交付可供 5–10 人在大陆试用的“一起租”H5，完成浏览、登录、发帖、修改和授权联系。

**Architecture:** 在独立 `yiqizu-cn/` 中构建 React/Vite 静态前端，通过 SDK 调用 Node 云函数。应用会话和权限在云函数校验，PostgreSQL 数据库函数实现跨表事务，照片采用限定上传和短期读取；先完成独立能力探针，真实云端通过后才继续业务开发。

**Tech Stack:** React、TypeScript、Vite、CloudBase Web/Node SDK、PostgreSQL、Vitest、React Testing Library；SQL 集成测试使用真正 PostgreSQL 和测试用 `pg` 驱动。开发 Node >=22.13，云函数运行时与 SDK 版本在 Task 1 验证后锁定，不虚构可用版本。

**Spec:** `docs/superpowers/specs/2026-10-20-cloudbase-h5-design.md`（用户已于本轮回复“按设计继续”确认）。

## Global Constraints

- 环境 ID：`yiqizu-mvp-test-d4fa3kk6dc43ea64`；只操作已有上海免费体验资源，不购买、升级或开启到期自动付费。
- 原站 `tongzhu-web`、Sites v31、旧账号、帖子与照片不变；国内版首轮独立新账号和新数据。
- 静态预览目录 `/cn-preview/`；正式函数 `yiqizu-api`，查重后创建。探针另用 `yiqizu-capability-probe`；不能覆盖网站根目录。
- 日发布限额 3，日不同联系对象限额 5，北京时间零点重置；撤回不返还发布次数，编辑不扣发布额度。
- 列表每页 24，运营每页默认 200；登记保留北京时间六自然月，短月取月末；孤立照片 24 小时，访问/联系记录 30 天。
- PBKDF2-SHA256 >=100,000 次；密码 8–128 字符且含字母数字；32 字节随机应用会话，hash 入库，有效期最长 7 天。
- 联系范围无默认同意；资料预填保留手填/清空/草稿/原帖优先级，不自动确认成年、公开范围和房源权限。
- 照片 JPEG/PNG/WebP、5MB/张、最多12张、最多2张并发；大于512KiB按既有1600px压缩。实际平台上传限制不足时明确失败，不开放公共写入绕过。
- RLS + GRANT 阻止匿名/普通平台用户直读业务私密表及敏感 RPC；密钥不进入静态包、URL、日志、Git或对话。
- 收藏、聊天、会员、支付、AI及完整发布第二入口不交付。默认域名仅小范围测试；没有实际测量，不承诺任何容量或公开推广资格。
- 每个任务本地commit并更新进度；GitHub集中同步，不每任务push。本地、真实云端和大陆手机验收证据分别记录。

## Review Focus

1. **SDK身份被误当应用用户**：持有平台匿名token和伪造ownerId/role仍不能发帖、取联系或进入运营；Task 3覆盖。
2. **提交成功后客户端断网重试**：同一请求不新增帖子、不再扣额度，错误不能假报成功；Task 4/8覆盖。
3. **上传尚未完成或对象删除失败**：无法绑定未核验照片，撤回立即隐藏，删除失败可重试且不删有效头像；Task 5/6覆盖。
4. **多人/多窗口最后一个名额**：同日并发只能消费合法限额，上海跨日与UTC日期不混淆；Task 4覆盖。
5. **平台提示HTML、配额耗尽、签名过期、关标签页再打开**：分别展示重试/重新登录/刷新图片，不把HTML或SDK异常当业务成功；Task 7/8覆盖。

---

## 文件与职责

所有新产品代码在 `yiqizu-cn/`；下列路径均相对该目录，文档路径除外。

| 路径 | 职责 |
| --- | --- |
| `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.server.json`, `vite.config.ts`, `.gitignore`, `index.html` | 可重复安装、独立静态构建、Node函数打包、类型/测试命令和本地状态忽略 |
| `shared/contracts.ts`, `shared/rules.ts`, `shared/profile-prefill.ts` | 业务契约、校验与复用v31纯逻辑，不引用Cloudflare/Next服务端 |
| `probe/main.ts`, `probe/client.ts`, `probe/index.html`, `probe/schema.sql` | 受保护能力探针、SDK测试页及仅`cn_probe_`对象 |
| `server/cloudbase.ts`, `server/db.ts`, `server/storage.ts` | 锁定SDK适配、PG/RPC访问和限定文件访问 |
| `server/main.ts`, `server/errors.ts`, `server/auth.ts`, `server/profile.ts` | 白名单分派、错误映射、应用会话及资料 |
| `server/leads.ts`, `server/uploads.ts`, `server/cleanup.ts`, `server/operations.ts` | 帖子/联系、上传核验、可重试清理、运营/反馈/统计 |
| `migrations/0001_core.sql`, `0002_lead_transactions.sql`, `0003_cleanup_operations.sql` | 版本化表/约束/RLS/GRANT/RPC与删除重试状态 |
| `src/client.ts`, `src/session.ts`, `src/App.tsx`, `src/main.tsx`, `src/styles.css` | SDK业务传输、sessionStorage、查询参数路由与原视觉基础 |
| `src/components/{Catalog,Details,AuthForm,ProfileForm,IntakeForm,PhotoPicker,Operations,HelpCenter}.tsx` | 精简业务页面，复用现有界面/字段，隐藏未实现入口 |
| `tests/*.test.ts`, `tests/*.test.tsx`, `tests/pg-fixture.ts`, `tests/ui-fixture.tsx` | 单元/交互/真实PG集成与隔离测试数据 |
| `scripts/{build-functions,package-release,run-pg-tests}.mjs`, `cloudbaserc.json`, `.env.example` | 构建、无密钥打包、测试库保护、明确环境和部署配置 |
| `docs/cloudbase/*`, `validation/cloudbase-*`, 根`HANDOFF.md` | 平台证据、部署步骤、限制和交接 |

核心公共类型在 Task 1 定义并在所有任务复用：`Kind='room'|'seeker'`；`Actor={userId:string;role:'user'|'admin'}`；`UploadId`/`LeadId`为UUID字符串；`ApiRequest={version:1;action:string;sessionToken?:string;requestId:string;payload:unknown}`；`ApiResult<T>={ok:true;data:T;requestId:string}|{ok:false;error:{status:number;code:string;message:string};requestId:string}`。`action`最终由服务端字符串白名单收窄，不能变成任意函数或SQL。

## Phase A：独立能力验证（完成后可以单独交付）

### Task 1：提供可部署、权限关闭默认的能力探针包

**Files:** 建立工程必要配置；创建`shared/contracts.ts`、`probe/*`、`server/cloudbase.ts`、`server/db.ts`、`server/storage.ts`、`scripts/build-functions.mjs`；测试`tests/probe.test.ts`；更新既有`docs/cloudbase/2026-10-20-workbuddy-capability-check.md`。

**Interfaces:** `handleProbe(input:unknown,deps:ProbeDeps):Promise<ApiResult<ProbeReport>>`；`ProbeDeps`提供`authorize(token:string):boolean`、`takeSlot(runId:string):Promise<boolean>`、`probeStorage(runId:string):Promise<StorageReport>`。`ProbeReport`只含通过/失败/未执行、版本、限制及脱敏请求ID；`StorageReport={uploaded:boolean;readable:boolean;deleted:boolean}`。业务适配接口`rpc<T>(name:string,params:Record<string,unknown>):Promise<T>`和`StoragePort`在Task 5消费。

- [ ] 写`rejects_missing_probe_token`（401且依赖未调用）、`rejects_path_traversal_run_id`（400）、`does_not_return_secrets_or_signed_urls`（报告无token/APIKey/签名）、`reports_unsupported_capability_as_failure`，并运行`npm test -- tests/probe.test.ts`观察预期失败。
- [ ] 核对官方SDK文档和实际类型，锁定Web/Node SDK依赖。实现仅允许health和受保护探针操作；`PROBE_TOKEN`只由WorkBuddy在云函数环境配置，浏览器手输后仅驻留内存。云函数包装输出统一`ApiResult`，无通用SQL/对象路径入口。
- [ ] 编写`cn_probe_`隔离SQL和`takeSlot`RPC（同runId并发一次true、一次false），显式拒绝PUBLIC/anon/authenticated直接访问。存储仅在`cn-probe/<runId>/`写虚构1px图片，限制对象并验证读取/删除；不能签名时报告unsupported，不开启公共桶。
- [ ] 运行上述测试、`npm run typecheck`、`npm run build:probe`，生成仅探针静态页/函数/SQL及SHA256清单；检查没有旧站代码、密钥、node_modules、本地数据库和构建缓存混入。通过后提交`feat: add isolated CloudBase capability probe`。
- [ ] 将明确包和指令交给用户转给WorkBuddy。真实环境SDK调用、PG事务、匿名权限拒绝和安全照片链路全部有证据后才勾选Task 1完成。云端未执行/失败时，停在Phase A，记录阻塞，不能先开发整套业务再补平台验证。

**平台证据输出：** `validation/cloudbase-capability-2026-10-20.md`记录真实运行时、SDK版本、角色名/授予范围、输入输出限制、资源点变化及测试请求ID；不得附密钥和带签名URL。如果真实角色或签名接口不同于预期，仅在本任务修正适配并重测；需付费/架构改向则先报告用户。

## Phase B：平台通过后开发最小业务（按顺序）

### Task 2：建核心表、复用纯规则并锁定业务数据契约

**Files:** `shared/rules.ts`、`shared/profile-prefill.ts`、`shared/contracts.ts`、`migrations/0001_core.sql`、`tests/rules.test.ts`、`tests/schema.pg.test.ts`、`tests/pg-fixture.ts`、`scripts/run-pg-tests.mjs`。

**Interfaces:** `validateLead(input:unknown):LeadInput`；`retentionCutoff(now:Date):string`；`shanghaiDay(now:Date):string`；`fillProfileDefaults(current:LeadDraft,profile:Profile,touched:Set<string>):LeadDraft`。`LeadInput`沿用v31QuickIntake字段但没有ownerId/role/verified，`LeadDraft`数值为表单字符串；`Profile`精确定义设计§4资料字段及`id/email/avatarUploadId/isAdmin`，不把密码或会话加入资料。`PublicLead`只包含设计允许公开字段，`PrivateLead`加联系值但只能本人/运营读取。UUID、日期/版本、kind、房源状态及金额使用类型约束，禁止any贯穿业务。

- [ ] 写规则测试：上海跨日、2026-08-31减六月为2026-02-28、闰年、未知城市/类型、负租金、1–60月整数、自定义标签、房东/中介缺权限确认、求租移除设施/合租要求、手动清空不被预填覆盖。`npm test -- tests/rules.test.ts`观察失败。
- [ ] 从`tongzhu-web/lib/{cities,pilot-retention,profile-prefill,publisher,listing-filters}.ts`按需复用并注明来源。国内头像使用自己的uploadId，不能保留旧站`/api/v1/uploads/...`判定方式；身份与默认同意字段不纳入预填。
- [ ] 为设计中的9张`cn_`表定义SQL、索引/外键/唯一约束、私密联系字段、`version`、`visibility`与`followup_status`；RLS/GRANT按Task 1实测角色配置，不触碰系统表。migration登记表记录已应用版本，不能重置已有库。
- [ ] 在专用真实PostgreSQL数据库执行`npm run test:pg -- tests/schema.pg.test.ts`：非法JSON/枚举/重复邮箱被拒绝、匿名私表和RPC访问被拒绝，重复执行迁移无数据丢失。测试连接必须显式TEST_DATABASE_URL且库名以`yiqizu_test_`开头；没有本地PG就用隔离容器，不允许指向CloudBase生产环境。
- [ ] 规则/类型/SQL测试通过后提交`feat: define domestic MVP schema and shared rules`。

### Task 3：账号、会话、资料与服务端白名单

**Files:** `server/{auth,profile,main,errors}.ts`、`server/db.ts`；`tests/auth.pg.test.ts`、`tests/router.test.ts`。

**Interfaces:** `register(input:{email:string;password:string}):Promise<AuthSession>`；`login(input:{email:string;password:string}):Promise<AuthSession>`；`resolveActor(token?:string):Promise<Actor|null>`；`logout(token:string):Promise<void>`；`changePassword(actor:Actor,input:{oldPassword:string;password:string}):Promise<void>`；`updateProfile(actor:Actor,patch:Partial<Profile>):Promise<Profile>`；`dispatch(req:ApiRequest):Promise<ApiResult<unknown>>`。`AuthSession={token:string;profile:Profile}`仅登录/注册返回原始token。

- [ ] 写`duplicate_email_is_atomic`、`random_token_stored_only_as_hash`、`expired_or_revoked_session_denied`、`password_change_revokes_all_sessions`、`forged_role_owner_and_oai_headers_ignored`、`anonymous_cloudbase_identity_is_not_actor`、`profile_partial_save_cannot_set_admin`。运行`npm run test:pg -- tests/auth.pg.test.ts`和`npm test -- tests/router.test.ts`观察失败。
- [ ] 实现设计§5密码、令牌和常量时间比较；邮箱归一化；密码不自动trim。管理员名单只读部署环境；资料默认新用户且每项可保存，不强迫完整生活档案。数据库错误统一映射，不能返回SQL、堆栈或凭证。
- [ ] 白名单加入`auth.register/login/session/logout/changePassword`、`profile.get/update`；只给明确允许访客的注册/登录/浏览/反馈操作开放入口，其他操作必须应用会话。注册/登录按经平台验证的源身份及账号做数据库限频，不信任客户端IP。
- [ ] 运行本任务测试和类型检查；检查注册响应不可包含管理员配置/密码hash/盐，日志不含密码/会话，403与401可区分，退出后原token无效。
- [ ] 提交`feat: add application accounts and profile APIs`。

### Task 4：帖子、修改、分页与联系额度的真实事务

**Files:** `server/leads.ts`、`migrations/0002_lead_transactions.sql`、`shared/contracts.ts`；`tests/leads.pg.test.ts`、`tests/quota.pg.test.ts`。

**Interfaces:** `createLead(actor:Actor,input:LeadInput,requestId:string):Promise<{id:string;version:number}>`；`updateLead(actor:Actor,id:string,input:LeadInput,expectedVersion:number):Promise<{id:string;version:number}>`；`withdrawLead(actor:Actor,id:string):Promise<void>`；`listLeads(query:ListingQuery,actor:Actor|null):Promise<Page<PublicLead>>`；`getLead(id:string,actor:Actor|null):Promise<PublicLead>`；`getOwnedLead(actor:Actor,id:string):Promise<PrivateLead>`（编辑预填，仅本人）；`getContact(actor:Actor,id:string):Promise<{type:'wechat'|'phone';value:string;remaining:number}>`。`ListingQuery`含设计§4筛选、mine、cursor；`Page<T>={items:T[];nextCursor:string|null}`。私密编辑读取必须单独鉴权，不通过公开getLead夹带联系字段。

- [ ] 写测试：同requestId重试同ID不扣额度；同requestId不同payload返回409；两个并发最后发布名额只有一个成功；失败上传归属不扣额度；编辑并发一成功一409；撤回不返还次数；联系第5/6个并发不超额；重复对象不扣次数；上海零点重置；仅运营可见联系对普通用户403且不扣额度。
- [ ] 实现命名RPC`cn_create_lead`、`cn_update_lead`、`cn_withdraw_lead`、`cn_get_contact`，由应用Actor驱动，数据库按用户行锁串行化额度，所有写入与幂等/图片校验在同事务。RPC仅Task 1确认的服务端角色可执行，不能被浏览器传actor绕过云函数。
- [ ] 查询采用显式公开投影；无测试来源、隐藏/撤回/过期/停用用户内容；统一公开/本人列表；稳定键集分页，以created_at和id打破并列，不因相同时间漏帖。参数化过滤，前端任意limit不得突破24或运营200默认上限。
- [ ] `npm run test:pg -- tests/leads.pg.test.ts tests/quota.pg.test.ts`通过；用两个独立数据库连接测并发，不以串行mock代替。另测非法ID、分页同时间、私密字段不泄露、本人编辑合法而他人失败。
- [ ] 提交`feat: add transactional listings and contact quotas`。

### Task 5：安全上传、头像复用与临时读取

**Files:** `server/{storage,uploads}.ts`、`src/components/PhotoPicker.tsx`、`src/photos.ts`；`tests/uploads.test.ts`、`tests/uploads.pg.test.ts`。

**Interfaces:** `StoragePort={issueUpload(key:string,input:{type:string;maxBytes:number}):Promise<UploadGrant>;inspect(key:string):Promise<{size:number;type:string;header:Uint8Array}>;readUrl(key:string,seconds:number):Promise<string>;remove(key:string):Promise<void>}`；`beginUpload(actor:Actor,input:{type:string;size:number}):Promise<{uploadId:string;grant:UploadGrant}>`；`finalizeUpload(actor:Actor,id:string):Promise<{uploadId:string}>`；`getPhotoUrls(ids:string[],actor:Actor|null):Promise<Record<string,string>>`。`UploadGrant`只含Task 1验证的单对象临时上传参数，不含账户级凭证。

- [ ] 写测试：他人照片/跨帖重绑/未finalize被拒绝，MIME与魔数不符/超5MB被拒绝，同路径重放不能替换已绑定对象，发布失败上传可重试，未公开/撤回不能新签链接，本人头像可复用且引用仍有效。
- [ ] 基于Task 1实际验证的签名接口实现适配；服务端生成随机路径并校验归属。若平台无法使已finalize对象不可覆写，则上传到临时路径、核验后复制到只允许服务器写入的最终路径，再绑定数据库；不能只检查一次后允许覆盖。
- [ ] 前端复用v31压缩和最多2个worker的失败恢复；完成后只将uploadId带到提交，不信任fileID/URL/路径。公开只签允许展示照片，私密照片只给本人/运营，签名最长300秒；签名过期只刷新一次，撤回后刷新返回404。
- [ ] 执行本任务本地存储fake测试和真实PG归属测试；由WorkBuddy在预览实际验证上传/核验/私读拒绝/短链/删除，不将fake标记为真实云存储通过。
- [ ] 提交`feat: add owned uploads and expiring photo access`。

### Task 6：运营、统计、反馈与可恢复清理

**Files:** `server/{operations,cleanup}.ts`、`migrations/0003_cleanup_operations.sql`；`tests/operations.pg.test.ts`、`tests/cleanup.test.ts`、`tests/cleanup.pg.test.ts`。

**Interfaces:** `listOperations(actor:Actor,cursor?:string):Promise<Page<PrivateLead>>`；`updateFollowup(actor:Actor,id:string,status:FollowupStatus):Promise<void>`；`moderateLead(actor:Actor,id:string,visibility:'active'|'hidden'):Promise<void>`；`submitFeedback(input:FeedbackInput):Promise<{id:string}>`；`listFeedback(actor:Actor,cursor?:string):Promise<Page<FeedbackRecord>>`；`resolveFeedback(actor:Actor,id:string):Promise<void>`；`recordEvent(input:EventInput):Promise<void>`；`getMetrics(actor:Actor):Promise<Metrics>`；`runCleanup(now:Date,limit:number):Promise<{hidden:number;deleted:number;retry:number}>`。跟进六状态沿用`new/qualified/contacted/viewing/matched/invalid`，反馈`new/resolved`；`FeedbackInput={category:'bug'|'privacy'|'report';content:string;contact:string;postId?:string}`，content为4–2000字符、contact≤100；`FeedbackRecord`加id/createdAt/status；`EventInput={event:'visit'|'quick_open'|'detail_open'|'contact_click';eventId:string;sessionId:string;city:string;source:string}`；`Metrics`为近7天按event去重session计数、按source和followup_status登记计数。访客反馈回复方式只运营读取，事件来源沿用既有7种白名单。

- [ ] 写测试：普通账号/伪造admin不能查看列表或反馈；超过200条仍能翻页；运营下架对本人以外立即不可见；7天来源test排除、事件幂等；45/150天保留，半年外排除；孤立24小时清理；有效旧照片和头像引用保留；存储删除失败清单保留、重试成功后删元数据；当前日额度记录不可删。
- [ ] 实现分页运营查询与独立跟进/公开状态、反馈限频及事件白名单；隐私反馈不是自动删除账号。成功登记后台清理和运营访问触发分批删除，先标待删再删对象再删元数据，失败返回不泄露对象key的重试计数。
- [ ] `runCleanup`每批最多25个存储删除，默认不运行定时轮询；按服务器实际云函数完成机制等待任务，不能直接复制Cloudflare waitUntil。若响应延迟过高，在保持隐藏即时生效的前提下仅运营触发物理删除并记录说明，不暗改成收费定时任务。
- [ ] 运行本任务全部测试及类型检查；真实PG验证关联删除/引用保护，不复用SQLite假充。对反馈/联系/邮箱字段做公开响应和日志快照检查。
- [ ] 提交`feat: add operations feedback and retryable retention cleanup`。

### Task 7：SDK业务传输与精简页面骨架

**Files:** `src/client.ts`、`src/session.ts`、`src/App.tsx`、`src/main.tsx`、`src/styles.css`、`src/components/{Catalog,Details,HelpCenter}.tsx`、`index.html`、`vite.config.ts`；`tests/client.test.ts`、`tests/catalog.test.tsx`。

**Interfaces:** `api<T>(action:string,payload:unknown,options?:{requestId?:string;signal?:AbortSignal}):Promise<T>`发送Task 1契约；`session.get/set/clear`仅内存/sessionStorage；`Catalog`消费`listLeads`投影、`Details`消费`getLead`及`getPhotoUrls`，路由`?view=explore|detail|profile|operations&post=<uuid>`。

- [ ] 写测试：SDK抛错/超额错误、非ApiResult/HTML返回不能成功，401清会话、403不清会话；关标签页无会话时重新登录；query路由刷新可恢复；图片签名失效刷新失败显示占位，不无限请求。
- [ ] 实现SDK API适配、action白名单对应和错误文案，不使用原同源`/api/v1`/早期fetch缓存；预览构建base固定`/cn-preview/`。保留原紫色视觉、移动底栏仅首页/发布/我的，删除收藏/消息/会员入口与相关网络请求。
- [ ] 列表/详情复用现有cards/details视觉和字段，标签最多4个且不拉伸；空列表显示真实空状态，不混入演示帖子；图片懒加载。HelpCenter说明国内站独立账号、联系隐私、半年清理、运营联系配置和找回未启用，不写原城市首轮验证提示。
- [ ] `npm test -- tests/client.test.ts tests/catalog.test.tsx`、`npm run typecheck`、`npm run build`通过；检查静态包无Cloudflare引用/旧站远程资源/密钥、无不支持入口、无未授权HTML注入；CSP只放实际必需SDK域名。
- [ ] 提交`feat: add CloudBase H5 browsing shell and SDK transport`。

### Task 8：注册资料、发布编辑与运营的真实交互

**Files:** `src/components/{AuthForm,ProfileForm,IntakeForm,Operations}.tsx`、`src/drafts.ts`、`src/App.tsx`；`tests/{auth-ui,intake-ui,profile-ui,operations-ui}.test.tsx`。

**Interfaces:** UI只调用Task 3–6已定义actions；`draftKey(userId:string|null,kind:Kind):string`；`mergeDraft(input:{current:LeadDraft;profile:Profile|null;draft:LeadDraft|null;editing:PrivateLead|null;touched:Set<string>}):LeadDraft`；requestId在新发布开始生成，明确新发一帖才重置。编辑用原ID/version，不走create。

- [ ] 写交互测试：匿名填表后登录内容保留；换账号不带入他人草稿；主动清空/手填/原帖优先；资料不自动勾公开/成年/房源权限；关标签页丢会话但草稿可按账号恢复；断网重试保持requestId；双击只一次进行中；409保留填写并提示重新打开；成功后不显示原站链接。
- [ ] 实现最小注册/登录/退出/改密、逐项资料保存、头像与资料预填。发布保留原字段/自定义设施/性别/起租月数，求租只“预计租多久”且无设施/合租要求；房东/中介无需强填个人生活信息，权限确认独立。
- [ ] 完成本人“我的帖子”修改/撤回、授权联系与剩余额度、运营分页/跟进/下架/反馈。未同意直接联系显示仅运营可见，不展示无效聊天按钮。签名URL不写持久草稿，手机号/微信仅在明确私密UI展示。
- [ ] 运行本任务交互测试、全部单元/PG集成、类型检查和构建；能用批准的浏览器工具时补真实交互；工具不可用则记录缺口，不用shell浏览器替代或宣称已真机验收。
- [ ] 提交`feat: complete domestic MVP publish manage and contact flows`。

## Phase C：打包、预览部署与真实试用验收

### Task 9：交付无密钥部署包和可回滚预览

**Files:** `cloudbaserc.json`、`.env.example`、`scripts/package-release.mjs`、`README.md`、`docs/deploy-workbuddy.md`；根`validation/cloudbase-h5-acceptance.md`和`HANDOFF.md`；测试`tests/package.test.ts`。

**Interfaces:** `npm run release`生成忽略目录`release/`，含`static/`、`functions/yiqizu-api/`、`migrations/`、`SHA256SUMS`、版本来源和部署说明；示例配置只列环境ID及变量名。后端secret需`CLOUDBASE_APIKEY`（若Task 1选择此鉴权）、管理员邮箱名单和公开运营信息，由用户本机控制台设置。

- [ ] 写包测试：只包含允许产物、源码版本/契约一致、SHA校验、预览base正确、缺平台通过报告或测试失败拒绝标为release-ready；禁止.env真值/SQL连接串/数据库/依赖缓存/签名URL进入包。
- [ ] 实现确定性打包脚本；保存兼容升级说明及回滚规则：保留旧静态包、函数版本，SQL只增量不得删除真实数据，破坏性回滚需另案。部署说明指定环境、预览子目录、迁移顺序、函数白名单和RLS验证，拒绝重名覆盖/自动付费。
- [ ] 运行完整测试/类型/构建/包检查，提交`chore: package domestic MVP preview and acceptance handoff`。按用户既有GitHub批次规则决定集中同步时点；未经同步不能告诉WorkBuddy去远端拉不存在的提交，可通过用户转交实际包。
- [ ] 用户转交包给WorkBuddy并得到实际部署记录后，核对PG迁移、匿名权限拒绝、注册/发帖/编辑/联系/照片/运营流程及真实资源点变化；没有腾讯云执行权限则停在可交付包，不声称上线成功。
- [ ] 补大陆手机线路/微信和普通浏览器验收记录，标清设备、网络、时间及结果。通过后邀请5–10人受控测试；默认域名不公开投流，不自动将preview切根目录；公开推广需另核域名、套餐、备案及运营资料。

## 计划自检与交接

- 设计§1–3目标/环境/架构→Task 1/7/9；§4–5功能/账号权限→Task 2/3/4/7/8；§6数据与并发→Task 2/4；§7图片/清理→Task 5/6；§8旧站与发布→Task 1/9；§9验收→Task 1–9；§10能力门槛→Task 1。
- Review Focus五类已逐项分配测试；共同接口与任务引用已核对。未知平台能力只在Task 1验证，不用占位“已支持”继续业务。
- 当前仅计划文件；各任务均未开始，未安装依赖、创建产品代码、建表或部署。
- 执行建议：本会话由主代理逐任务实施（Native），减少频繁交接成本；按执行技能在阶段末安排审阅。用户也可明确选择分代理实现/审阅。计划须用户审阅并确认执行方式后实施，不把设计批准当作对尚不存在计划的提前批准。
