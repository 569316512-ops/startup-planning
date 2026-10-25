// @vitest-environment jsdom
import { it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { IntakeForm } from "../src/components/IntakeForm";
import { mergeDraft, draftKey } from "../src/drafts";
import type { Profile, LeadDraft } from "../shared/business-contracts";
import {sampleLead} from './lead-fixture';
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it('guest_login_preserves_input_and_network_retry_reuses_request_without_double_submit',async()=>{
 const requestId=crypto.randomUUID(),data={...sampleLead,kind:'seeker',housing:undefined,budget:'1200',minLeaseMonths:'3',nickname:'手动昵称',adult:false,consent:false,publicConsent:false};
 localStorage.setItem(draftKey(null,'seeker'),JSON.stringify({data,touched:['nickname'],requestId}));
 const login=vi.fn(),done=vi.fn(),call=vi.fn().mockRejectedValueOnce(new Error('网络断开，请重试')).mockResolvedValue({id:'saved'});
 const props={kind:'seeker' as const,city:'贵阳',onLogin:login,onDone:done,call,upload:async()=>''};
 const {rerender}=render(<IntakeForm {...props} profile={null}/>);
 const form=screen.getByLabelText('标题').closest('form')!;
 fireEvent.submit(form);expect(login).toHaveBeenCalledTimes(1);expect(call).not.toHaveBeenCalled();
 const profile={id:'new-user',nickname:'资料昵称',city:'贵阳',contact:{wechat:'profile123',phone:''}} as Profile;
 rerender(<IntakeForm {...props} profile={profile}/>);
 expect((screen.getByLabelText('怎么称呼你') as HTMLInputElement).value).toBe('手动昵称');
 for(const checkbox of screen.getAllByRole('checkbox'))fireEvent.click(checkbox);
 fireEvent.submit(form);fireEvent.submit(form);await screen.findByText('网络断开，请重试');expect(call).toHaveBeenCalledTimes(1);
 fireEvent.submit(form);await screen.findByText('发布帖子');expect(call).toHaveBeenCalledTimes(2);expect(call.mock.calls[0][2]).toEqual({requestId});expect(call.mock.calls[1][2]).toEqual({requestId});expect(done).toHaveBeenCalledWith('saved');
});
it("manual_clear_and_existing_post_beat_profile_and_account_drafts_are_separate", () => {
  const profile = {
    nickname: "资料昵称",
    budget: 1000,
    city: "贵阳",
    district: "云岩区",
    contact: { wechat: "li123456", phone: "" },
  } as Profile;
  const current = { kind: "seeker", city: "贵阳", nickname: "" } as LeadDraft;
  expect(
    mergeDraft({
      current,
      profile,
      draft: null,
      editing: null,
      touched: new Set(["nickname"]),
    }).nickname,
  ).toBe("");
  expect(
    mergeDraft({
      current,
      profile,
      draft: { ...current, nickname: "旧草稿" },
      editing: null,
      touched: new Set(["nickname"]),
    }).nickname,
  ).toBe("");
  expect(draftKey("one", "room")).not.toBe(draftKey("two", "room"));
});
it("seeker_form_has_expected_duration_but_no_amenities_or_corental_rules", () => {
  render(
    <IntakeForm
      kind="seeker"
      city="贵阳"
      profile={null}
      onLogin={() => {}}
      onDone={() => {}}
      call={vi.fn()}
      upload={async () => ""}
    />,
  );
  expect(screen.getByLabelText(/预计租多久/)).toBeTruthy();
  expect(screen.queryByText("合租要求")).toBeNull();
  expect(screen.queryByText("期待的房屋设施")).toBeNull();
  fireEvent.change(screen.getByLabelText(/标题/), {
    target: { value: "想找安静的住处" },
  });
  expect(localStorage.getItem(draftKey(null, "seeker"))).toContain(
    "想找安静的住处",
  );
});
it("does_not_carry_one_accounts_form_into_another_account", () => {
  const profile = (id: string) =>
    ({
      id,
      nickname: id,
      city: "贵阳",
      gender: "不透露",
      contact: { wechat: "", phone: "" },
    }) as Profile;
  const props = {
    kind: "seeker" as const,
    city: "贵阳",
    onLogin: () => {},
    onDone: () => {},
    call: vi.fn(),
    upload: async () => "",
  };
  const { rerender } = render(
    <IntakeForm {...props} profile={profile("one")} />,
  );
  fireEvent.change(screen.getByLabelText("标题"), {
    target: { value: "账号一的私密草稿" },
  });
  rerender(<IntakeForm {...props} profile={profile("two")} />);
  expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("");
  expect(localStorage.getItem(draftKey("two", "seeker"))).not.toContain(
    "账号一的私密草稿",
  );
});
