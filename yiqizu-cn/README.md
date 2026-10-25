# 一起租国内H5：受控预览候选

2026-10-25：已实现独立账号/资料预填、两类发帖/修改/撤回、公开浏览与筛选、授权联系/免费额度、私有图片、运营/反馈/统计及半年清理。UI为React/Vite，业务云函数`yiqizu-api`使用服务端PostgREST；浏览器不直读业务表。原Sites v31及云端根测试页保持不变，国内版使用独立新账号/数据。

本地新建隔离PostgreSQL从零迁移0001–0005，107项测试（39项真实PG）与类型/构建/打包检查通过。尚未云端业务部署或真机验收。免费函数3秒、默认测试域名、首次SDK约209KiB gzip仍是实测关注项；完整部署说明见[WorkBuddy部署说明](docs/deploy-workbuddy.md)。

```sh
npm ci --ignore-scripts
npm run typecheck
npm run build
npm run build:api
npm run package:preview
```

生成`release/yiqizu-cn-preview.tar.gz`（不含密钥/node_modules）。包内`node VERIFY.mjs`核验文件完整性，不代表云端功能通过。开发用`npm run dev`，base固定`/cn-preview/`。完整发布验证命令`TEST_DATABASE_URL=docker://yiqizu-probe-pg-<数字>/yiqizu_test_<name> CN_PROBE_PG_CONTAINER=yiqizu-probe-pg-<数字> npm run release`只接受本地隔离容器；没有显式fixture就拒绝，不假装跳过PG检查仍可发布。

管理员不能按未核验邮箱自动开通。注册一律普通用户，用户在本机登录自己的运营账号并确认UUID/邮箱后，通过控制台精确授权；撤权同时撤销会话。不要将密码、API Key、会话或签名URL发进对话。

## 历史：独立能力探针

以下为计划Task1独立探针说明；平台实测及收尾记录在根validation/cloudbase-capability-2026-10-25.md。probe v2新增JSON返回适配仍需云端复验；不恢复已吊销凭据。聊天/付费不在国内MVP范围内。

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build:probe
npm run package:probe
```

包位于忽略目录`release/yiqizu-cloudbase-probe.tar.gz`，含静态页面、可调用CommonJS云函数、锁定运行依赖清单、隔离SQL、逐文件SHA256及部署说明，不含密钥和node_modules。云端部署前必须安装运行依赖，详见`probe/DEPLOY.md`。

SDK锁定为Web 3.10.3、Node 3.18.7。Node SDK提供真实PG RPC接口；Web SDK发布类型的`rdb()`不含rpc，因此浏览器的两项负向PG权限检查使用官方PostgREST端点和SDK访客token，不使用类型强制转换假装接口存在。PG存储使用JS SDK的Node入口，只在服务器配置API Key。

安全探针只接收health、受令牌保护的prepare/verify，路径固定`cn-probe/<UUIDv4>/pixel.png`。prepare并发消耗一个隔离名额后签发指定对象的不可覆盖上传权限；浏览器直传虚构1pxPNG，verify校验实际字节、签名读取及删除后确实不存在。非授权不初始化云连接，原始SDK错误不返回给客户端。

本地真实PG测试使用**无网络且不暴露端口**的独立Docker容器，并通过`CN_PROBE_PG_CONTAINER=yiqizu-probe-pg-<数字>`启用`tests/probe.pg.test.ts`；默认单元测试会明确跳过该组，不会连接生产环境。实际CloudBase权限/SDK调用及手机浏览器仍须用户通过WorkBuddy验证，不能用本地通过代替。

完整设计及实施计划在仓库根`docs/superpowers/`；过程证据和handoff区分本地完成、已同步GitHub与真正上线。
