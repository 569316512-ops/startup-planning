import {resetRates} from './member-test-fixtures.mjs';
resetRates();
// Local-only browser regression for mobile publishing feedback.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const {chromium,request}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.argv[2]||'http://127.0.0.1:5188';assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
await mkdir('outputs',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844}}),api=await request.newContext({baseURL:origin}),page=await context.newPage();page.setDefaultTimeout(10000);
const receipts=[],results=[],errors=[],timings=[];page.on('pageerror',e=>errors.push(e.message));
const pass=s=>{results.push(s);console.log('PASS:',s)};
async function openHome(test=false){await page.goto(origin+(test?'/?src=test&qa=1':''),{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'登记需求',exact:true}).waitFor();}
try{
 await context.request.post(origin+'/api/v1/auth/register',{data:{email:'mobile-'+crypto.randomUUID()+'@test.local',password:'Mobile1234'}});
 await openHome();
 assert.equal(await page.locator('.mobile-intro,.mobile-pilot-note').count(),0,'remove the marked introductory copy');
 const entries=page.locator('.mobile-entry-grid>button');assert.equal(await entries.count(),2);for(const button of await entries.all()){const box=await button.boundingBox();assert(box.height>=120,'entry cards should be prominent tappable controls');}
 pass('手机介绍文案删除，两个主入口至少120px高');
 await page.locator('.mobile-entry-grid').getByRole('button',{name:'有房找室友',exact:true}).click();const form=page.getByRole('dialog');
 await form.getByLabel(/^帖子标题/).fill('观山湖找个合拍的室友');await form.getByLabel(/^你的性别/).selectOption('女');await form.getByLabel(/^片区/).selectOption('观山湖区');await form.getByLabel(/^小区/).fill('本地虚构小区');await form.getByLabel(/^整套面积/).fill('89');
 await form.getByRole('button',{name:'电梯',exact:true}).click();await form.getByRole('checkbox',{name:/确认是原始户型/}).check();
 await form.getByLabel(/^每人月租/).fill('1200');await form.getByLabel(/^大致入住时间/).fill(new Date(Date.now()+14*86400000).toISOString().slice(0,10));
 await form.getByLabel(/^房子介绍与室友期待/).fill('本地测试，不是真实房源，希望一起保持公共区域整洁。');await form.getByLabel(/^怎么称呼你/).fill('本地有房测试');
 const job=form.getByLabel(/^你的职业/);await job.fill('产品设计师');assert(await job.evaluate(el=>Boolean(document.querySelector('input[autocomplete=nickname]').compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)));
 assert.equal(await form.getByRole('checkbox').count(),1,'only original-layout confirmation remains');
 await form.getByLabel(/^微信号/).fill('feedback_test01');await form.getByRole('radio',{name:/允许登录用户/}).check();
 const photos=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1200;c.height=900;const x=c.getContext('2d'),data=x.createImageData(c.width,c.height);let seed=1234567;for(let i=0;i<data.data.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;data.data[i]=seed&255;data.data[i+1]=(seed>>>8)&255;data.data[i+2]=(seed>>>16)&255;data.data[i+3]=255;}x.putImageData(data,0,0);return (await new Promise(resolve=>c.toBlob(b=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(b)},'image/png')))});
 const input=Buffer.from(photos,'base64');assert(input.length<=5*1024*1024);await form.getByLabel('选择房子照片',{exact:true}).setInputFiles([0,1,2].map(i=>({name:`room-${i}.png`,mimeType:'image/png',buffer:input})));
 let active=0,maxActive=0;const uploadSizes=[];
 await page.route('**/api/v1/pilot/uploads',async route=>{active++;maxActive=Math.max(maxActive,active);uploadSizes.push(route.request().postDataBuffer().length);await new Promise(resolve=>setTimeout(resolve,300));try{await route.continue()}finally{active--;}});
 const started=Date.now();await form.getByRole('button',{name:'免费发布，让合适的人找到我'}).click();await form.getByRole('heading',{name:'需求已发布',exact:true}).waitFor();timings.push({scenario:'3 photos with synthetic 300ms delay each',ms:Date.now()-started,inputBytes:input.length,uploadedBodyBytes:[...uploadSizes],maxActive});
 const receipt=await page.evaluate(()=>JSON.parse(localStorage.getItem('yiqizu-pilot-receipts-v2'))[0]);receipts.push(receipt);
 assert.equal(maxActive,2,'photos should upload with concurrency capped at two');assert(uploadSizes.every(size=>size<input.length),'photo preparation should reduce actual uploaded bytes');
 pass('有房职业字段、三个勾选框删除、照片压缩与最多2张并行上传通过');
 await form.getByRole('button',{name:'查看刚发布的帖子',exact:false}).click();await page.waitForURL(/view=detail/);assert(page.url().includes('pilot-'+receipt.id));
 const detail=await api.get('/api/v1/listings/pilot-'+receipt.id);assert.equal(detail.status(),200);assert.equal((await detail.json()).owner.occupation,'产品设计师');
 const feed=await api.get('/api/v1/listings?city=贵阳&demo=0');assert((await feed.json()).items.some(p=>p.id==='pilot-'+receipt.id));pass('正式发布后职业正确保存，帖子进入广场且直接定位详情');
 await page.screenshot({path:'outputs/mobile-feedback-post.png',fullPage:true});
 await openHome(true);await page.locator('.mobile-entry-grid').getByRole('button',{name:'无房找住处',exact:true}).click();const test=page.getByRole('dialog');await test.getByText(/测试入口.*不会/).waitFor();assert.equal(await test.getByRole('checkbox').count(),0);await test.getByRole('link',{name:'切换正式发布'}).waitFor();
 await test.getByLabel('选择个人照片',{exact:true}).setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')});
 await test.getByRole('radio',{name:/仅一起租运营/}).check();await test.getByRole('button',{name:'免费发布，让合适的人找到我'}).click();await test.getByRole('heading',{name:'测试登记已完成',exact:true}).waitFor();
 const testReceipt=await page.evaluate(()=>JSON.parse(localStorage.getItem('yiqizu-pilot-receipts-v2'))[0]);receipts.push(testReceipt);assert.equal((await api.get('/api/v1/listings/pilot-'+testReceipt.id)).status(),404);assert(!(await (await api.get('/api/v1/listings?city=贵阳&demo=0')).json()).items.some(p=>p.id==='pilot-'+testReceipt.id));
 pass('测试登记成功但不误报公开发布，仍隔离广场；入口类型不被旧草稿覆盖');
 await page.getByRole('button',{name:'关闭弹窗'}).click();
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'outputs/mobile-feedback-home.png',fullPage:true});assert.deepEqual(errors,[]);pass('360/390/430px无横向溢出，无未捕获浏览器异常');
 await page.unroute('**/api/v1/pilot/uploads');
 const helper=stripTypeScriptTypes(await readFile('lib/intake-upload.ts','utf8'));
 await page.route('**/__intake-upload-test.mjs',route=>route.fulfill({contentType:'text/javascript',body:helper}));
 const attempts={};
 await page.route('**/api/v1/pilot/uploads',async route=>{const r=route.request(),f=await new Request(r.url(),{method:'POST',headers:r.headers(),body:r.postDataBuffer()}).formData(),name=f.get('file').name;attempts[name]=(attempts[name]||0)+1;await new Promise(resolve=>setTimeout(resolve,name==='retry-b.png'?100:10));await route.fulfill({status:name==='retry-b.png'&&attempts[name]===1?500:201,contentType:'application/json',body:JSON.stringify(name==='retry-b.png'&&attempts[name]===1?{error:{message:'模拟上传失败'}}:{id:name})});});
 const recovered=await page.evaluate(async png64=>{const {uploadIntakePhotos}=await import('/__intake-upload-test.mjs');const bytes=Uint8Array.from(atob(png64),c=>c.charCodeAt(0)),files=['retry-a.png','retry-b.png','retry-c.png'].map(name=>new File([bytes],name,{type:'image/png'})),options={receiptToken:crypto.randomUUID(),sessionId:crypto.randomUUID(),uploaded:new Map(),onProgress:()=>{}};let failed=false;try{await uploadIntakePhotos(files,options)}catch{failed=true}const ids=await uploadIntakePhotos(files,options);return{failed,ids}},'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
 assert.equal(recovered.failed,true);assert.deepEqual(recovered.ids,['retry-a.png','retry-b.png','retry-c.png']);assert.deepEqual(attempts,{'retry-a.png':1,'retry-b.png':2,'retry-c.png':1});pass('部分照片上传失败后重试，只重传失败照片，顺序保持正确');

}catch(error){await page.screenshot({path:'outputs/mobile-feedback-failure.png',timeout:5000}).catch(()=>{});console.error('FORM STATE',await page.getByRole('dialog').innerText({timeout:3000}).catch(()=>''));throw error;}finally{
 await writeFile('outputs/mobile-feedback-results.json',JSON.stringify({results,errors,timings},null,2));
 for(const row of receipts)await api.delete('/api/v1/pilot/leads/'+row.id,{data:{receiptToken:row.token}});
 await browser.close();await api.dispose();
}
