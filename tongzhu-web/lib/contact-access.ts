type ContactDB={
 first:(sql:string,...args:any[])=>Promise<Record<string,any>|null>;
 run:(sql:string,...args:any[])=>Promise<unknown>;
 throttle:(key:string,limit:number,seconds:number)=>Promise<void>;
 sha:(value:string)=>Promise<string>;
};

// A single INSERT ... SELECT keeps the final daily slot atomic under concurrent requests.
// The stable hash groups anonymous listings using the same contact as one publisher.
export async function recordContactView(request:Request,viewerId:string,contactKey:string,db:ContactDB){
 await db.throttle('contact-view-user:'+viewerId,20,60);
 await db.throttle('contact-view-ip:'+request.headers.get('cf-connecting-ip'),60,60);
 const day=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
 const target=await db.sha(contactKey);
 await db.run(`INSERT OR IGNORE INTO contact_views (viewer_id,day,target_hash,created_at)
 SELECT ?,?,?,? WHERE
 (SELECT COUNT(*) FROM contact_views WHERE viewer_id=? AND day=?) < CASE WHEN (SELECT member_until FROM users WHERE id=?)>? THEN 50 ELSE 5 END
 OR EXISTS (SELECT 1 FROM contact_views WHERE viewer_id=? AND day=? AND target_hash=?)`,
 viewerId,day,target,new Date().toISOString(),viewerId,day,viewerId,new Date().toISOString(),viewerId,day,target);
 return Boolean(await db.first('SELECT 1 FROM contact_views WHERE viewer_id=? AND day=? AND target_hash=?',viewerId,day,target));
}
