import fs from 'node:fs';
import path from 'node:path';

const [mode,configPath,target]=process.argv.slice(2);
if(!['prepare','review'].includes(mode)||!configPath||!target)throw new Error('Usage: node validate.mjs prepare CONFIG OUTPUT_DIRECTORY | review CONFIG RESULTS_JSON');
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
for(const key of ['slug','product','audience','scene','promise','coreAction','strongAction','url'])if(typeof config[key]!=='string'||!config[key].trim())throw new Error(`Missing config field: ${key}`);
if(!/^[a-z][a-z0-9-]{1,63}$/.test(config.slug))throw new Error('Use a lowercase product slug');
const url=new URL(config.url);if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')throw new Error('Use HTTPS for a real launch URL');
if([...url.searchParams.keys()].some(k=>/token|secret|password|api.?key/i.test(k)))throw new Error('Do not place credentials in acquisition links');
const fields=['qualifiedVisitors','submissions','conversations','strongActions'];
for(const key of fields)if(!Number.isFinite(config.targets?.[key])||config.targets[key]<1)throw new Error(`Set an evidence threshold for ${key}`);
if(!Number.isFinite(config.budgetCNY)||config.budgetCNY<0||!Number.isFinite(config.founderHours)||config.founderHours<=0)throw new Error('Set explicit cash/time limits');
if(!Array.isArray(config.channels)||config.channels.length<1||config.channels.length>3)throw new Error('Choose 1-3 focused channels');
for(const channel of config.channels)if(!/^[a-z][a-z0-9_-]{1,39}$/.test(channel.id)||!channel.name||!Number.isFinite(channel.quota)||channel.quota<1)throw new Error('Each channel needs a source id, name and target quota');

if(mode==='review'){
 const r=JSON.parse(fs.readFileSync(target,'utf8'));
 if(r.targetRegionMobileWorks!==true||r.anonymousAccessWorks!==true||r.coreActionWorks!==true){console.log('待补发布验收：先修复或实测普通用户访问、目标地区手机和核心动作，暂不判断需求。');process.exit(0)}
 if(fields.some(k=>!Number.isFinite(r[k])||r[k]<0)){console.log('待补真实漏斗数据：未知字段保留 null，不以0代替未测。');process.exit(0)}
 if(!Array.isArray(r.evidence)||!r.evidence.length){console.log('待补证据：附上匿名回访记录或实测来源，不能只填写数字。');process.exit(0)}
 if(r.qualifiedVisitors<config.targets.qualifiedVisitors){console.log('目标用户样本不足：先补合格触达，不能判定没有需求。');process.exit(0)}
 if(r.submissions<config.targets.submissions)console.log('调整：检查价值表达、信任和提交阻力；访谈拒绝者后只改变一个主要变量。');
 else if(r.conversations<config.targets.conversations)console.log('调整：检查交付/匹配供给及联系流程，提交量不能替代有效使用。');
 else if(r.strongActions<config.targets.strongActions)console.log('调整：核实结果质量和下一步价值；强行动尚未达到本轮假设。');
 else console.log(`达到本轮继续验证门槛：已观察到“${config.strongAction}”。这是早期证据，不是规模化或盈利验证。`);
 if((Number.isFinite(r.spentCNY)&&r.spentCNY>config.budgetCNY)||(Number.isFinite(r.founderHours)&&r.founderHours>config.founderHours))console.log('已超本轮预算或时间上限：记录实际成本，下一轮先重新确定边界。');
 process.exit(0);
}

const output=path.resolve(target);if(fs.existsSync(output)&&fs.readdirSync(output).length)throw new Error('Choose an empty output directory to preserve earlier experiments');fs.mkdirSync(output,{recursive:true});
const links=config.channels.map(channel=>{const link=new URL(config.url);link.searchParams.set('src',channel.id);return {...channel,url:link.href}});
const text=`# ${config.product}：${config.days||7}天验证执行包

产品假设：${config.audience}在“${config.scene}”时，愿意${config.coreAction}，并进一步${config.strongAction}。

本轮现金上限：${config.budgetCNY}元；创始人投入上限：${config.founderHours}小时。阈值为本轮假设，不是行业基准。

## 发布门槛

- [ ] 普通用户不依赖开发者账号即可打开。
- [ ] 核心动作可完成，失败后可重试，重复提交不产生重复业务记录。
- [ ] 私有联系信息与运营权限已用匿名访问验证。
- [ ] 至少5名${config.region||'中国大陆'}真实手机用户，无特殊网络，含安卓/iPhone与微信内浏览器；未测不能标通过。
- [ ] 有真实可交付的供给或任务结果；演示与测试不计入转化。

## 渠道链接与目标分母

${links.map(c=>`- ${c.name}：${c.quota}位合格目标用户；[入口](${c.url})`).join('\n')}

## 可复制招募文案（获得渠道许可后发送）

我在做「${config.product}」的小范围测试，想找${config.audience}。如果你最近正遇到${config.scene}，可以试试：${config.promise}。测试免费，不用为了支持我而填写；没有实际需求也请直接告诉我。愿意体验的话，我会在你同意后回访一次。入口请使用上面对应渠道的链接。

## 固定回复与回访

1. 资格确认：你什么时候需要解决？目前怎么做？哪一步最费力？
2. 体验邀请：请自己在手机上完成“${config.coreAction}”，卡住时告诉我在哪一步。
3. 回访：实际完成了吗？有没有进一步${config.strongAction}？如果没有，卡在哪里？
4. 如需运营代办，单独标记；不冒充用户自行完成。

## 逐日动作

- 第1天：完成访问与手机验收，找首批真实供给/任务样本。
- 第2—3天：按渠道配额触达目标人群，记录分母、拒绝原因与来源。
- 第4—6天：固定一次回访，核实有效使用与强行动；每天只修最明显的一个阻力。
- 第${config.days||7}天：填写结果JSON，运行 review，决定继续、改一个变量或暂缓。

## 证据记录表

| 匿名编号 | 来源 | 近期真实需求 | 实际看过 | 完成提交 | 有效联系/使用 | 强行动 | 运营是否代办 | 拒绝/失败原因 |
|---|---|---|---|---|---|---|---|---|
| 待填写 | | | | | | | | |

双边产品另用配对编号记录双方，避免重复计数。不要在公开记录表填写手机号、微信号或私人资料。

## 本轮门槛

合格目标用户 ${config.targets.qualifiedVisitors}；有效提交 ${config.targets.submissions}；有效联系/使用 ${config.targets.conversations}；强行动 ${config.targets.strongActions}。

访问会话不是去重人数，点击不是沟通，朋友帮忙不是自然需求。没有实测数据的格子留空。
`;
fs.writeFileSync(path.join(output,'执行包.md'),text);
fs.writeFileSync(path.join(output,'渠道链接.json'),JSON.stringify(links,null,2)+'\n');
fs.writeFileSync(path.join(output,'结果待填写.json'),JSON.stringify({product:config.slug,targetRegionMobileWorks:null,anonymousAccessWorks:null,coreActionWorks:null,qualifiedVisitors:null,submissions:null,conversations:null,strongActions:null,spentCNY:null,founderHours:null,evidence:[],notes:''},null,2)+'\n');
console.log(`Prepared ${output}. No deployment, outreach or paid actions were performed.`);
