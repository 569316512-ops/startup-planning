# CloudBase 能力探针：本地交付与真实云端验收记录

2026-10-20（Asia/Shanghai）。范围：已批准国内H5计划Phase A/Task 1的独立能力探针。

## 当前状态

本地探针源码、隔离SQL、静态测试页和无密钥部署包已完成；独立代码审查发现的4项重要问题已修复并回归。真实CloudBase部署、角色、普通登录用户权限、资源点变化及手机浏览器尚未执行。Task 1不能标记完成，Task 2–9未开始。原Sites v31和现有CloudBase根目录测试页未修改。

当前没有腾讯云凭证或账号授权，执行环境仅能生成包；用户转交WorkBuddy使用自己已登录的账号部署。不需要向本对话发送任何密钥。

## 实现范围

- 工程`yiqizu-cn/`，Web SDK锁定3.10.3、Node SDK锁定3.18.7。仅health、受64hex随机探针令牌保护的prepare/verify；令牌只在本机输入和函数环境配置，报告不包含令牌或签名URL。
- 探针路径固定`cn-probe/<UUIDv4>/pixel.png`，图片为源码内的虚构1pxPNG。prepare用两次真实PG RPC竞争同一个唯一名额，再提供单路径不可覆盖上传签名；浏览器直传，服务端检查元信息与全部字节、5分钟签名读取、删除及对象确实不存在。
- 浏览器负向检查访客直读探针表、调用敏感RPC、读取私有照片、签名不能改路径或覆写。无法识别的错误不当权限通过；本地测试不证明真实云端SDK结果。
- `sql/schema.sql`只创建`cn_probe_slots`与`cn_probe_take_slot`，RLS和GRANT限制客户端角色；对象重名/平台角色缺失会回滚停止，不覆盖已有资源。私有逻辑桶和普通平台用户验证需控制台核对。
- 全部代码仅在独立工作树开发；部署说明要求免费套餐查验、精确环境和预览目录`/cn-preview/`，不采购、不开全局权限、不修改Sites。

## 已执行的本地验证

| 证据 | 结果 |
| --- | --- |
| `npm test`，启用专用PG容器 | 修正审查问题后34项通过；其中6项真实PostgreSQL，非SQLite模拟 |
| `npm run typecheck` | 通过 |
| 构建/包测试 | 浏览器静态包、可按`index.main`解析的CommonJS `index.js`、锁定依赖/SQL/说明和SHA256清单通过；测试从实际解包后的模块stem加载 |
| 解包完整性 | `node VERIFY.mjs`核对11个包内文件通过 |
| 独立运行依赖安装 | 从tar.gz解包后`npm ci --omit=dev --ignore-scripts`成功，安装94个运行包；独立require函数health成功、无令牌prepare返回401 |
| 原站基线 | `node tongzhu-web/scripts/pilot-retention-test.mjs`通过；本轮没有改变原站业务代码，未重复宣称整站已回归 |

PostgreSQL为本地`postgres:17-alpine`隔离容器，数据库`yiqizu_test_probe`，无网络、不暴露端口。先在无探针表/RPC时观察集成测试失败，应用实际探针SQL后通过；验证两独立连接竞争只有一个true、重复runId只有一行、anon/authenticated不能读表/执行RPC。它证明SQL逻辑，不证明CloudBase角色配置。

安全测试先观察缺失模块/功能失败，再实现；额外检查签名拒绝分类不把网络错误/503当成权限证明。存储SDK在本地使用可控依赖，未执行真实云存储操作。没有浏览器截图或真机通过证据。

本地详细日志将归档在同名目录；暂存执行记录位于当前工作树`.superpowers/sdd/2026-10-20-cloudbase-h5/`，不提交运行数据库/依赖/密钥。

## 真实云端结果：全部待WorkBuddy返回

| 项目 | 状态 |
| --- | --- |
| 套餐/免费期限/无自动付费 | 待部署时复核；既有WorkBuddy报告不等于本轮复核 |
| 普通云函数运行时、入口及SDK部署版本 | 未执行 |
| SDK访客调用、服务端PG/RPC并发 | 未执行 |
| 访客与普通平台用户数据/RPC/存储权限 | 未执行 |
| 浏览器签名上传、改路径/覆写拒绝 | 未执行 |
| 服务端字节核验、短链、实际删除 | 未执行 |
| 函数请求/响应大小、签名有效期、资源点增量 | 未执行 |
| 大陆手机流量/Wi-Fi/微信实际操作 | 未执行 |

只有全部必要能力有真实证据，才能继续Phase B。失败时记录脱敏错误和精确探针资源，不购买、不开放公共读写、不把默认域名当公开推广域名。用`yiqizu-cn/probe/DEPLOY.md`交给WorkBuddy执行，最终结果和限制回填此处。

## 执行裁定

1. 技能辅助脚本及测试附录资源在当前环境不可读/不存在，使用手工任务记录、日志与审查包替代；代价是进度记录自动化较弱，不改变产品行为。
2. 发布的Web SDK3.10.3把rdb类型声明为无rpc方法的MySqlClient；服务端Node SDK有PG RPC。因此浏览器负向PG测试采用官方PostgREST端点和SDK访客token，避免强行断言API存在；代价是若真实网关行为不同，探针失败后需按实际证据适配，再推进业务。

## 独立审查

由独立代理`cloudbase_probe_review`以新上下文审阅Phase A代码；未执行云部署。无Critical，4项Important进入一次修正回归：

1. 原先生成index.cjs，标准index.main处理器解析找不到文件：改为`type:commonjs`的index.js，解包后按模块stem加载回归。
2. 锁定SDK忽略签名上传的upsert选项：显式发送`x-upsert:true`，回归截获真实SDK传输并检查请求头；提交不同字节，服务端仍须核验原始fixture未改变。
3. 任意403/400/409可能被当成拒绝证明：PostgreSQL检查要求结构化SQLSTATE42501，存储拒绝要求可识别的结构化错误；HTML403、过期签名、通用坏请求和未知错误不算通过。
4. SDK exists()会将无效JWT的400当不存在：删除后直接查元数据，只接受明确的结构化对象不存在；删除确认但仍存在、无效JWT及未知结果不能通过。

上述回归已先观察失败、修正后全套34/34通过、类型检查通过；没有以作者自查冒充独立审查，也不把本地包交付称为国内产品上线。

Minor暂缓：浏览器当前步骤抛异常时，导出JSON可能仍标`not-run`且没有详细失败原因；页面显示通用错误，WorkBuddy需要附上本机脱敏错误码。影响排查效率，不会把该步骤误标通过。未为此额外扩大修正范围。

代码提交：`35ee476`初版、`da90692`审查修正；2026-10-20已集中push至GitHub的`9567e1c`（包括此前待推阶段）。此状态记录随本批后续文档提交，最终以远端HEAD核对为准。CloudBase/Sites未部署，云端证据仍需返回。

交付包`/workspace/outputs/yiqizu-cloudbase-probe.tar.gz`来源为9567e1c，SHA256为`4f890ab9e726f73095f6456e6b5f581e458fc2664fb6871f8a3d28764862a5b9`。修正后的最终包重新解压、11文件SHA验证、干净生产依赖安装以及按`index.main`模块stem的health/401验证通过。生成产物不进GitHub；无法转交tar时，可从已同步源码按README构建。
