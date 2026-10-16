# 个人介绍、帖子编辑与UI反馈验证（2026-10-17）

网址：https://yiqizu-guiyang.coppershark1.chatgpt.site/?v=26
source: 002544fbba9bbe258bfcceb60575304825b8c6fe
version: appgprj_6acf3606f92881919e76f18dea03390e~appgver_9e4b49d7825c819190fc9b450569e741
deployment: appgdep_6ad25ee97a648191b8cb32426b57d4b3，succeeded，runtime revision1未变，public，没有新迁移。

范围：个人介绍在我的单独保存并同步普通/快速帖；本人原帖编辑、原图保留/新增/移除、头像替换/重置、仅本人GET编辑联系数据、同ID、不占发帖次数、乐观锁；我的帖子包含快速帖并正确分页。求租删除设施/合租要求、预计租多久；房源保留自定义设施。卡片等高/4标签，地图白底，会员突出，AI/资料助手/建档入口隐藏。

新增profile-edit-test先在旧构建404失败后通过。post-edit-photos-test先重现跨帖receipt错误迁图200后修复；覆盖交叉凭证拒绝、原图和新增图片/头像、并发修改单赢家、删除图片公开权限、额度不变。pilot-upload-guard-test模拟外部检查都成功后的edit→create/create→edit/edit→edit顺序，事务内拒绝二次消费，失败发布无额度事件；审查者独立运行通过。profile-edit-browser-test真实账号完成我的单独保存、我的帖子分页/编辑求租、详情编辑房源保留图片/自定义设施、同ID、两个帖子简介同步、发帖计数不变，以及草稿/receipt不受编辑覆盖。

顺序回归通过：detail-content-test、seeker-amenities-test（改为验证已删除内容不通过旧payload重新出现）、min-lease-test、member-quota-test、member-race-test、explore-feedback-test（设施别名fixture改房源）、smoke-test、contact-smoke-test、member-login-resume-test、member-browser-test、min-lease-browser-test、detail-content-browser-test、explore-feedback-browser-test、detail-feedback-test、browser-contact-test。TypeScript、build和diff检查通过。最终独立审查没有未解决重要问题。

线上只读浏览器通过：360/390/602/731/1280真实卡片同行等高、最多4标签、AI入口不存在；双表单个人介绍移除，求租规则/设施移除，预计租多久，房源自定义设施仍在；当前公开房源65085b81和求租57bb9f49位置白底、简介字段一致，匿名GET编辑资料401且没有修改入口，无浏览器异常。qa=1、TLS验证开启，没有写入生产账号/帖子/联系/支付数据。截图里的6d0eae81房源当前404且不在公开列表，改用仍公开的65085b81核对，未推断原因或修改其数据。

源码29个变动文件同步回tongzhu-web无冲突；Sites main与发布SHA一致，GitHub根工作区保留未提交改动。线上结果：tongzhu-web/outputs/profile-edit-online-results.json；截图profile-edit-home-online.png、profile-edit-seeker-form-online.png、profile-edit-room-online.png、profile-edit-seeker-online.png。本地编辑端到端结果profile-edit-browser-results.json及虚构数据截图profile-edit-detail.png。
