# CloudBase 实测证据与适配修正（2026-10-25）

证据来源为用户转交的 WorkBuddy 分享报告，非本执行环境直接访问腾讯云。没有接收/存储云端令牌或密钥。

- 部署记录：https://workbuddy.link/p/K64TiFTZWEg6Mlc3Sj47Hn
- 链路记录：https://workbuddy.link/p/xK3uMYwFyZovcJp7oD80Mu
- 权限与收尾：https://workbuddy.link/p/Jkd8AIeev3Gb8vJXotXyIk

环境仍为上海 `yiqizu-mvp-test-d4fa3kk6dc43ea64`。Node20.19，Node SDK3.18.7，Web SDK3.10.3。报告称匿名SDK调用、REST PG事务并发true/false、单路径PNG签名上传、越权/覆写拒绝、服务端实际字节读取/5分钟签名读取/删除均实测通过。普通用户名密码账号对表/RPC返回403 DATABASE_42501，生成上传签名403 STORAGE_ACCESS_DENIED；对确实存在对象的info/下载为404，而服务端key为200。未登录/失效凭据的401不能替代权限证据。

报告称已删除PROBE_TOKEN，旧令牌401；关闭探针临时调用后访客403 EXCEED_AUTHORITY；撤销专用APIKey后旧key401 ACCESS_TOKEN_INVALID；清理确认的对象和12行探针数据，保留表/RLS；删除测试普通账号。匿名登录仍启用，不等于业务身份。不得为本地开发重新开放临时权限。

资源点314.38→668.81/3000，约354.43点，报告称主要为PG CU；小时延迟计量，不推算固定用户承载或永久免费。免费云函数固定256MB、3秒，匿名冷启动2664ms、health热86–88ms、verify约1.05秒。单个冷启动样本不证明稳定性。桶控制台仅整数MB，不能配置1024字节，需要业务层核验。

纠正：此前“上传后2秒元数据同步延迟”被后续报告撤回。最新测量上传305ms、紧接info415ms即成功，前次异常归因为SDK凭据尚未就绪。故不加固定等待或404重试。

适配修正：新增`cn_probe_take_slot_v2`返回`{taken:boolean}`，避免Node SDK把scalar false转换为{}。不把{}视作false。存储显式创建auth并等待getAccessToken。SQL增量只添加v2包装，不覆盖已存在对象；完整schema仅供新安装。44项本地测试（含9项真实PG）和typecheck通过。新适配器未云端复测，不能称为已部署。

实施裁定：底层平台能力门槛已由外部同口径真实调用及普通账号隔离证据满足，允许Phase B本地开发；适配器复测、实际业务冷启动与真机验收仍是预览部署的硬门槛。没有正式产品上线结论，旧Sites及CloudBase根页不变。
