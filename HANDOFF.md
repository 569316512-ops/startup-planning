# 一起租项目交接文档

更新时间：2026-10-15（Asia/Shanghai）

## 项目概况

- GitHub：<https://github.com/569316512-ops/startup-planning>
- 主分支：`main`
- 当前产品目录：`tongzhu-web/`
- 线上站点：<https://yiqizu-guiyang.coppershark1.chatgpt.site>
- Sites 项目 ID：`appgprj_6acf3606f92881919e76f18dea03390e`
- 技术栈：React、Vinext/Vite、Cloudflare Workers、D1、R2
- 产品定位：覆盖上海、北京、深圳、杭州、广州、成都、重庆、贵阳的原户型合租、求租和室友匹配平台。

## 2026-10-15 八城扩展（当前状态）

用户审核确定首批八城：上海、北京、深圳、杭州、广州、成都、重庆、贵阳。

- 新增 `tongzhu-web/lib/cities.ts`，集中维护城市、区县和地图中心。重庆按市政府 2026 年区划更新为两江新区等 37 个区县；基础区县数据来源见文件注释。
- 页头和搜索栏支持切城，区域/热门区域联动；切城清空旧城市筛选，清除筛选保留当前城市，URL 与保存搜索携带城市。
- 注册、个人资料、问答建档和发布均可选择城市与区县；服务端验证配对，创建/编辑持久化 `posts.city`，推荐按城市过滤。
- 高德查询与地图概览使用所选城市。贵阳既有用户、帖子和分享链接保留；原有演示数据仍只属于贵阳，不复制成其他城市的虚构供给。
- 数据库已有城市字段，无需生产迁移。缺少城市的旧资料/请求按贵阳兼容。
- 顺带修正首页两种发布入口将仅含发布类型的初始化资料误当成编辑已有帖的问题。
- 验证：TypeScript 与正式构建通过；`node scripts/city-smoke-test.mjs http://127.0.0.1:5188` 的八城发布、跨城隔离、编辑迁城、资料切城、演示隔离和未开放城市拒绝检查通过。浏览器确认重庆切换、两江新区、清除筛选保留城市、桌面无横向溢出。
- 本机完整 `smoke-test.mjs` 在既有预期错误响应之后遇到 Windows Worker 重启，未跑完全套；不要将本轮专项通过表述为全套通过。专用城市检查只允许本地地址，并使用虚构测试资料。

## 此前界面调整

1. 首页改为两个明确入口：录入房源、填写住房需求。
2. 首页右侧使用原创房屋生活拼贴图 `tongzhu-web/public/hero-home-collage-v2.png`。
3. 删除首页顶部“发现 / 找房子 / 找室友 / 资料助手”导航栏。
4. 删除“我的搜索”快捷按钮、示例内容提示框和展示示例开关。
5. 调整头版与搜索框衔接，搜索框向上覆盖紫色背景，桌面和手机端均无横向溢出。
6. 帖子卡片标题和租金字号缩小；地址与户型信息避免重叠。
7. 卡片地址改为纯文字显示，不再使用毛玻璃或实色底板。
8. 详情页标题缩小，右侧仅保留发帖人资料和联系操作，删除重复租金。
9. 地址细化为区域、小区、附近交通及生活配套；详情页位置卡可跳转高德地图。
10. 生活偏好筛选改为真正多选；多个条件采用“同时满足”的筛选逻辑。
11. 个人资料增加职业、作息、做饭、清洁、宠物、访客、住房偏好和室友期待等维度。
12. 个人资料保存时要求头像、职业、预算、入住日期、介绍、生活习惯、日常信息、住房/室友期待、手机号及微信号完整填写。
13. 发帖时要求标题、区域、金额、入住日期、租期、介绍、生活习惯、设施、合租约定和照片完整填写；房源帖额外要求位置、交通、总租金、面积、卫生间和周边配套。
14. 服务端同步执行必填校验，不能通过直接调用接口绕过页面限制。

## 关键文件

| 路径 | 用途 |
| --- | --- |
| `tongzhu-web/components/TongzhuApp.tsx` | 页面入口、导航、搜索和主要业务弹窗 |
| `tongzhu-web/components/catalog-feedback.tsx` | 首页头版、搜索、多选筛选和帖子卡片 |
| `tongzhu-web/components/forms-feedback.tsx` | 个人资料、发帖和问答式建档表单 |
| `tongzhu-web/components/details-feedback.tsx` | 帖子详情、位置及发帖人信息 |
| `tongzhu-web/components/shared.tsx` | 标签多选、上传、弹窗等共用组件 |
| `tongzhu-web/lib/server.ts` | API、权限、必填校验、搜索筛选及高德补全 |
| `tongzhu-web/lib/models.ts` | Profile、Post、Filters 数据模型 |
| `tongzhu-web/lib/demo.ts` | 虚构示例资料与帖子 |
| `tongzhu-web/app/globals.css` | 桌面及手机端样式 |
| `tongzhu-web/scripts/smoke-test.mjs` | 本地端到端业务检查 |
| `tongzhu-web/.openai/hosting.json` | Sites 项目及 D1/R2 绑定 |

## 本地运行与验证

要求 Node.js 22.13 以上，建议 Node.js 24。

```powershell
cd tongzhu-web
npm ci
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-framework.mjs build
npm run dev
```

默认访问 `http://127.0.0.1:5173/`。在本地预览运行后执行：

```powershell
node scripts/smoke-test.mjs http://127.0.0.1:5173
```

最近验证结果：

- TypeScript `--noEmit`：通过。
- Vinext 正式构建：通过。
- Smoke test：通过，覆盖账户、未成年/隔断拒绝、必填发帖、上传、筛选、权限、收藏、意向、联系方式、消息、举报、验证、推广占位、CSRF、下架、屏蔽和退出。
- Playwright 桌面端：无横向溢出，多选偏好可同时选择两项。
- Playwright 手机端 390×844：无横向溢出。
- 地址展示计算样式：透明背景、0 padding、位置图标隐藏。

## 部署与配置

Sites 使用 D1 绑定 `DB`、R2 绑定 `BUCKET`。修改源代码后必须重新构建、保存版本并部署，GitHub 推送本身不会自动更新线上站点。

可选运行时变量：

| 变量 | 用途 |
| --- | --- |
| `AMAP_API_KEY` | 自动补充坐标、附近交通和生活配套 |
| `ADMIN_EMAIL` | 管理员邮箱 |
| `ADMIN_SETUP_TOKEN` | 管理员初始化令牌 |
| `AI_API_KEY` | 自然语言资料助手密钥 |
| `AI_BASE_URL` | OpenAI 兼容接口地址 |
| `AI_MODEL` | 服务端实际使用的模型 |

不得将实际密钥写入源码或 Git。

## 当前边界与后续建议

- 示例房源和用户均为虚构数据，不代表真实供给。
- 尚未接入邮箱验证、密码邮件找回、短信登录、正式支付、第三方身份调查和截图 OCR。
- 推广订单目前只记录申请，不产生扣款。
- 自然语言 AI 资料助手需要部署环境配置真实密钥。
- 高德自动补全在未设置 `AMAP_API_KEY` 时保留用户手工填写内容。
- 下一步优先用真实贵阳用户验证：资料完成率、发帖完成率、有效联系率及复访率。
