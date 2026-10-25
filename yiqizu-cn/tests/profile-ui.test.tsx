// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ProfileForm } from "../src/components/ProfileForm";
import type { Profile } from "../shared/business-contracts";
afterEach(cleanup);
it("saves_bio_alone_without_requiring_unrelated_fields", async () => {
  const profile = {
      id: "one",
      email: "one@example.invalid",
      nickname: "新用户",
      city: "贵阳",
      gender: "不透露",
      bio: "",
      contact: { phone: "", wechat: "" },
    } as Profile,
    call = vi.fn().mockResolvedValue(profile);
  render(<ProfileForm profile={profile} onSave={() => {}} call={call} />);
  fireEvent.change(screen.getByLabelText("个人介绍"), {
    target: { value: "我喜欢跑步，作息规律" },
  });
  fireEvent.click(screen.getByText("保存个人介绍"));
  await screen.findByText("已保存");
  expect(call).toHaveBeenCalledWith("profile.update", {
    bio: "我喜欢跑步，作息规律",
  });
});
