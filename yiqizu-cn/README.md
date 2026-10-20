# 一起租国内版：能力验证阶段

这是已批准迁移计划Task 1的独立探针，不是正式国内产品。现有Sites v31未改变；账号、帖子、聊天、付费等业务未迁移。

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
