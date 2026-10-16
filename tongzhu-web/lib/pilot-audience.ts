// Keep bound-account visibility consistent across feed, detail, contact and saves.
// `table` is a hard-coded SQL alias, never request input.
export function pilotAudience(viewerId?:string,table='pilot_leads'){
 const owner=`${table}.user_id`;
 let clause=` AND (${owner} IS NULL OR EXISTS (SELECT 1 FROM users pilot_owner WHERE pilot_owner.id=${owner} AND pilot_owner.suspended=0))`;
 const args:string[]=[];
 if(viewerId){clause+=` AND NOT EXISTS (SELECT 1 FROM blocks pilot_block WHERE (pilot_block.user_id=? AND pilot_block.target_id=${owner}) OR (pilot_block.target_id=? AND pilot_block.user_id=${owner}))`;args.push(viewerId,viewerId)}
 return {clause,args};
}
