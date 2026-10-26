# CloudBase 外部部署/联调记录（2026-10-26）

来源为用户转交的WorkBuddy报告，非Codex直接操作腾讯云：

- 初次部署失败：https://workbuddy.link/p/22Gm8fWzTjycKjy7C0clQi
- 标记函数诊断：https://workbuddy.link/p/dVfCdOsOhq7xTAH6DPCcsz
- H5真实流程：https://workbuddy.link/p/HkrrInZKvYrF1UxgQWgy3W
- 双账号/有房补测：https://workbuddy.link/p/Qn2HpIha6a4HHzreEDjOcl
- 图片/额度边界：https://workbuddy.link/p/ryvU4Z6ZtpVmOb7WcJaSdO

报告称业务迁移0001–0006已登记、角色直接权限拒绝，yiqizu-api与/cn-preview/已部署，根页保留。实际代码更新由固定返回001→002验证；InstallDependency TRUE失败，FALSE且自带依赖成功，不能仅用Active/ModTime/CodeSize证明发布。请求体约10MB限制，实际上传函数包经WorkBuddy裁剪，非仓库原始包原封部署。

报告已实测：SDK匿名传输→应用401、PG42501拒绝、注册/资料预填、两类发帖、900×600PNG上传/回显、修改/撤回、普通账号运营403、members跨账号查看扣1次/重复不扣、operator他人403不扣、第6个不同联系对象拒绝、声明6MB begin拒绝、5MB声明边界接受、伪PNG finalize拒绝。不能把5MB声明接受当作真实5MB整图端到端通过。测试账号/帖子/对象据报告已精确清理；没有由Codex复查实库。

编辑联系范围operator/members的数据与界面回填均复测正常。初次空值报告混有自动化直接赋select.value未同步React状态问题，原复杂触发路径未稳定重现，不据此修改权限默认值。新增本地两枚举回填回归均通过。

更明确的发布体验问题：浏览器原生必填验证阻止submit时，用户看不出原因。现已本地修复：表单顶部状态提示具体字段、定位并聚焦首个无效控件，保留草稿；不默认同意或放宽校验。需只更新H5静态文件后真实浏览器复验，无SQL/业务函数变更。

实际函数包报告SHA256为47b9e371365656bbc3c4c0b13d73d6bdca1792224ecc83c248fffed9029a3875；双SDK版本仍Node3.18.7/Web3.10.3，但手动移除了core-js-pure。本地真实签名与线上图片成功支持已测路径，不证明所有可选SDK路径完整。其命令使用npm install且未交付对应lock，ZIP还含时间戳，不能承诺重新构建相同SHA；后续应保留部署依赖lock/精确裁剪清单，并改为可审核打包方案。不要盲目复制rm -rf用户目录命令，不再凭一次成功删传递依赖。

资源点报告774.02→905.16→905.72→1037.06/3000，按小时结算，不能把变化全部归因于请求数量。空闲3分钟后137ms不是可确认冷启动；网关upstream-timecost样本23–65ms与浏览器图片2727ms是不同计时口径。

未完成：管理员完整运营流程（等用户本机创建/确认账号）、真机/三运营商、跨日及云端并发配额、12图/签名越路径及重试等完整边界。原探针3个静态文件据报仍残留但已无入口，临时凭据先前已吊销。不宣称正式上线验收通过，不公开投流。
