import {it,expect} from 'vitest';
import {validateLead,retentionCutoff,shanghaiDay} from '../shared/rules';
import {fillProfileDefaults} from '../shared/profile-prefill';
import type {Profile,LeadDraft} from '../shared/business-contracts';
export const roomInput={kind:'room',city:'贵阳',district:'观山湖区',title:'找室友',budget:1200,moveIn:'11月底',minLeaseMonths:3,preferredGender:'不限',gender:'男',nickname:'小陈',occupation:'教师',note:'朝南两室，采光好',coRentalRules:'公共卫生轮流打扫',roommateExpectations:'规律作息，愿意沟通',housing:{housingState:'rented',community:'龙腾园',bedrooms:2,bathrooms:1,area:88,roomsAvailable:1,originalLayout:true,amenities:['洗衣机','自定义标签']},photoIds:[],avatarUploadId:null,contactType:'wechat',contact:'chen123',contactVisibility:'operator',adult:true,consent:true,publicConsent:true,source:'direct'};
it('uses_shanghai_calendar_day_and_clamped_six_month_retention',()=>{
 expect(shanghaiDay(new Date('2026-10-24T16:00:00Z'))).toBe('2026-10-25');
 expect(retentionCutoff(new Date('2026-08-31T02:00:00Z'))).toBe('2026-02-28T02:00:00.000Z');
 expect(retentionCutoff(new Date('2024-08-31T02:00:00Z'))).toBe('2024-02-29T02:00:00.000Z');
});
it('accepts_custom_tags_and_strips_forged_privileged_fields',()=>{
 const lead=validateLead({...roomInput,ownerId:'someone',role:'admin',verified:true});
 expect(lead.housing?.amenities).toEqual(['洗衣机','自定义标签']);expect(lead).not.toHaveProperty('ownerId');expect(lead).not.toHaveProperty('role');
});
it.each([{city:'不存在'},{district:'南山区'},{kind:'other'},{budget:-1},{budget:NaN},{minLeaseMonths:0},{minLeaseMonths:61},{minLeaseMonths:1.5},{adult:false},{publicConsent:false},{photoIds:['../photo']},{housing:{...roomInput.housing,amenities:['x'.repeat(25)]}}])('rejects_invalid_lead_%j',patch=>{
 expect(()=>validateLead({...roomInput,...patch})).toThrow();
});
it.each(['landlord','agent'])('requires_%s_authority_confirmation',housingState=>{
 expect(()=>validateLead({...roomInput,housing:{...roomInput.housing,housingState}})).toThrow();
 expect(validateLead({...roomInput,occupation:'',roommateExpectations:'',housing:{...roomInput.housing,housingState,authorityConfirmed:true}}).housing?.housingState).toBe(housingState);
});
it('removes_room_only_content_from_seeker',()=>{
 const lead=validateLead({...roomInput,kind:'seeker'});expect(lead.housing).toBeNull();expect(lead.coRentalRules).toBe('');
});
it('prefills_only_blank_untouched_fields_and_never_consents',()=>{
 const profile={id:'user',nickname:'小李',city:'贵阳',district:'云岩区',budget:2000,moveIn:'下月',leaseMonths:6,gender:'女',occupation:'设计师',bio:'喜欢做饭',roommateExpectations:'爱干净',housingPreferences:'近地铁',contact:{wechat:'li123456',phone:''}} as Profile;
 const current={kind:'seeker',city:'贵阳',nickname:'',occupation:'手动填写',contact:'',adult:false,publicConsent:false} as LeadDraft;
 const draft=fillProfileDefaults(current,profile,new Set(['nickname']));
 expect(draft.nickname).toBe('');expect(draft.occupation).toBe('手动填写');expect(draft.budget).toBe('2000');expect(draft.note).toBe('近地铁');expect(draft.contact).toBe('li123456');expect(draft.adult).toBe(false);expect(draft.publicConsent).toBe(false);
 expect(draft).not.toHaveProperty('bio');expect(draft).not.toHaveProperty('authorityConfirmed');
});
