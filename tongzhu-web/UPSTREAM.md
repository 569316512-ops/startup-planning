# RoomDate 来源与改造说明

上游：https://github.com/yeddaTech/roomdate

基准提交：fc6cd1359ede350daa79ae3998ffc280fd4eed03

用户在当前任务中确认已与作者沟通代码使用许可；此说明仅记录用户提供的授权信息，不替作者声明 MIT 等许可证。

`upstream/roomdate/` 保留所参考的 Go 服务、React 页面、共享选项、数据契约和上游 README。`lib/roomdate/client.ts` 和 `types.ts` 来自原 API 客户端与契约，前者中文化错误提示；`lib/compatibility.ts` 移植原 `internal/users/compatibility.go` 的可解释匹配逻辑。

保留 `/api/v1` 路径习惯、账户/公开资料/房源/收藏/聊天/举报分离的模型。为支持 Sites Cloudflare 托管，将原 Go/PostgreSQL 的服务层改造为 TypeScript/D1；新增贵阳区域、微信电话私有联系、求租帖子、已租/组队两种状态、原户型规则、房源意向用户、问答建档、保存搜索和推广申请。

当前聊天是受会话成员权限保护的服务器存储聊天，未移植原 E2EE 密钥协议，界面不声称端到端加密。原 Go 实现留在 upstream 供后续恢复或迁移参考。
