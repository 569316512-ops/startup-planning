// Evaluated inside the same D1 transaction as the lead write. Temporary
// upload receipts can be consumed by only one post, including racing creates.
export function pilotUploadGuard(photoIds:string[],avatarId:string,receiptHash:string,currentHash=receiptHash,leadId=''){
 const ids=[...new Set([...photoIds,...(avatarId?[avatarId]:[])])];
 return {sql:"NOT EXISTS (SELECT 1 FROM json_each(?) selected WHERE NOT EXISTS (SELECT 1 FROM pilot_uploads upload WHERE upload.id=selected.value AND upload.receipt_hash IN (?,?))) AND NOT EXISTS (SELECT 1 FROM pilot_leads bound WHERE bound.receipt_hash=? AND bound.id<>?)",args:[JSON.stringify(ids),receiptHash,currentHash,receiptHash,leadId]};
}
