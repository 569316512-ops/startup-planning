import {it,expect} from 'vitest';
import {permissionDenied,signedUploadDenied,publicReport} from '../probe/report';
it('recognizes_actual_permissions_not_network_or_missing_tables',()=>{
 expect(permissionDenied({code:'42501'})).toBe(true);
 expect(permissionDenied({status:403})).toBe(true);
 for(const e of [null,{status:401},{status:404},{code:'PGRST205'},new Error('network error')])expect(permissionDenied(e)).toBe(false);
});
it('does_not_treat_signed_upload_network_failure_as_permission_proof',()=>{
 expect(signedUploadDenied({status:409})).toBe(true);
 expect(signedUploadDenied({statusCode:403})).toBe(true);
 expect(signedUploadDenied(new Error('network failure'))).toBe(false);
 expect(signedUploadDenied({status:503})).toBe(false);
});
it('exports_allowlisted_report_fields_only',()=>{
 const r=publicReport({runId:'test',checks:{sdk:'passed'},requestIds:['safe-id'],token:'secret',url:'https://private.invalid/?token=private'});
 expect(r.checks.sdk).toBe('passed');expect(r.overall).toBe('manual-verification-required');
 expect(JSON.stringify(r)).not.toMatch(/secret|https|token/);
});
