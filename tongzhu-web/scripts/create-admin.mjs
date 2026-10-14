// ADMIN_EMAIL and ADMIN_SETUP_TOKEN must match server configuration.
// Supply secrets only through the current process environment, never CLI arguments.
const origin=process.env.SITE_ORIGIN;
const email=process.env.ADMIN_EMAIL;
const adminSetupToken=process.env.ADMIN_SETUP_TOKEN;
const password=process.env.ADMIN_PASSWORD;
if(!origin||!email||!adminSetupToken||!password)throw new Error('Configure SITE_ORIGIN, ADMIN_EMAIL, ADMIN_SETUP_TOKEN, ADMIN_PASSWORD in process environment.');
if(new URL(origin).protocol!=='https:'&&!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Use HTTPS for remote admin initialization.');
const response=await fetch(new URL('/api/v1/auth/register',origin),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,adminSetupToken,firstName:'一起租运营',age:25,gender:'不透露',district:'观山湖区',budgetMax:0,isPublic:false,userType:'seeker',lifestyleTags:[],contact:{visible:false}})});
const result=await response.json();
if(!response.ok||!result.isAdmin)throw new Error(result.error?.message||'Administrator setup rejected; verify the server configuration.');
console.log('Administrator created. Sign in with the configured email and password.');
