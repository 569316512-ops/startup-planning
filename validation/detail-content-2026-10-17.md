# 发布内容拆分与求租设施验证（2026-10-17）

网址：https://yiqizu-guiyang.coppershark1.chatgpt.site/?v=25

source: 1a0a6f55e6f4851a769111acd538793485b24b25
version: appgprj_6acf3606f92881919e76f18dea03390e~appgver_b93c6751240c819183b208f6189d3460
deployment: appgdep_6ad2567265e08191bbb9babff5bcca47，succeeded。

双表单必填个人介绍/合租要求/室友期待，房子与求租描述只填写住房本身。四段独立保存和展示，旧文仅保留原描述，新空栏待补充。房主标题共享正文栏目字体。求租21标准设施多选、去重存数组，可AND组合检索。

迁移0009仅新增三列，默认空串，不改旧note。兼容已打开旧客户端省略新字段；显式空/非法输入拒绝。新表单前端强制填写；此兼容取舍已在审查中明确。

通过：detail-content-test、seeker-amenities-test（均先失败后通过）、detail-content-browser-test、min-lease-test、min-lease-browser-test、explore-feedback-test、member-quota-test、member-race-test、member-login-resume-test、member-browser-test、explore-feedback-browser-test、detail-feedback-test、browser-contact-test、smoke-test、contact-smoke-test。新浏览器检查房主/发布者字体四宽度一致、两类型、草稿设施选中恢复、四段不重复。真实注册发布流程确认独立文本各出现一次；普通完整帖子API也验证独立字段。联系方式回归测试改radio group范围，适配新增fieldset后通过。

npx tsc --noEmit、npm run build、git diff --check通过，源工作树干净；Sites源main远端SHA一致。独立审查无未解决重要问题。源码22文件安全同步回GitHub工作区tongzhu-web，无冲突。

生产只读验收：两个表单新增字段和21设施存在；指定room帖子pilot-65085b81-8b9e-4c63-86c2-528c25c27cf8和seeker帖子pilot-57bb9f49-e12f-42ef-a312-af1e0d6c0017均新标题生效、旧原文仅一次，新个人/规则/期待空字段未克隆旧文。四宽度360/390/602/1280无溢出且h2字体/字号/字重/行高一致，无浏览器异常。带qa=1，TLS验证开启；没有写入生产账号/帖子/联系/支付数据。

结果：tongzhu-web/outputs/detail-content-online-results.json。截图：detail-content-room-online.png、detail-content-seeker-online.png、detail-content-seeker-form-online.png；本地虚构新内容示例：detail-content-mobile.png。
