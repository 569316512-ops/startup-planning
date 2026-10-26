// @vitest-environment jsdom
import {it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {IntakeForm} from '../src/components/IntakeForm';
import {draftKey} from '../src/drafts';
import type {Profile} from '../shared/business-contracts';
import type {PrivateLead} from '../shared/business-contracts';
afterEach(()=>{cleanup();localStorage.clear()});
const p={id:'account',nickname:'昵称',city:'贵阳',contact:{wechat:'',phone:''}} as Profile;
const props={kind:'room' as const,city:'贵阳',onLogin:()=>{},onDone:()=>{}};
it('explains_native_validation_failure_and_focuses_first_invalid_field',()=>{
 render(<IntakeForm {...props} kind="seeker" profile={p}/>);
 const title=screen.getByLabelText('标题');fireEvent.invalid(title);
 expect(screen.getAllByRole('status').map(x=>x.textContent).join('')).toContain('标题');expect(document.activeElement).toBe(title);
});
it.each(['operator','members'] as const)('editing_preserves_explicit_contact_visibility_%s',contactVisibility=>{
 const editing={id:'post',kind:'seeker',city:'贵阳',title:'原帖标题',budget:1200,minLeaseMonths:3,photoIds:[],housing:null,contactType:'wechat',contact:'test123',contactVisibility} as unknown as PrivateLead;
 render(<IntakeForm {...props} kind="seeker" profile={p} editing={editing}/>);
 expect((screen.getByLabelText('谁可以查看') as HTMLSelectElement).value).toBe(contactVisibility);
});
it('restores_persisted_touched_housing_photos_and_request_id',()=>{
 const data={kind:'room',city:'贵阳',photoIds:['photo'],contactType:'phone',housing:{housingState:'agent',community:'已保存小区',bedrooms:3,bathrooms:2,amenities:[]}};
 localStorage.setItem(draftKey(p.id,'room'),JSON.stringify({data,touched:['housing','photoIds','contactType'],requestId:'saved-request'}));
 render(<IntakeForm {...props} profile={p}/>);
 expect((screen.getByLabelText('小区 / 公寓') as HTMLInputElement).value).toBe('已保存小区');expect(screen.getByText('照片1')).toBeTruthy();
 fireEvent.click(screen.getByText('清除草稿'));
 const saved=JSON.parse(localStorage.getItem(draftKey(p.id,'room'))!);expect(saved.data.housing.housingState).toBe('rented');expect(saved.data.gender).toBe('不透露');
});
it('restores_account_draft_on_guest_to_account_without_new_input',()=>{
 localStorage.setItem(draftKey(p.id,'room'),JSON.stringify({data:{kind:'room',city:'贵阳',title:'账号草稿'},touched:['title'],requestId:'original-id'}));
 const {rerender}=render(<IntakeForm {...props} profile={null}/>);rerender(<IntakeForm {...props} profile={p}/>);
 expect((screen.getByLabelText('标题') as HTMLInputElement).value).toBe('账号草稿');expect(JSON.parse(localStorage.getItem(draftKey(p.id,'room'))!).requestId).toBe('original-id');
});
