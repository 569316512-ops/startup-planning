// Adapted from v31 profile-prefill.ts; upload IDs replace old same-origin URLs.
import type { LeadDraft, Profile } from "./business-contracts";
export function fillProfileDefaults(
  current: LeadDraft,
  profile: Profile | null,
  touched: ReadonlySet<string> = new Set(),
): LeadDraft {
  if (!profile) return { ...current };
  const defaults: Partial<LeadDraft> = {
    nickname: profile.nickname === "新用户" ? "" : profile.nickname,
    occupation: profile.occupation,
    gender: profile.gender,
    moveIn: profile.moveIn,
    roommateExpectations: profile.roommateExpectations,
    avatarUploadId: profile.avatarUploadId,
  };
  if (profile.budget && profile.budget > 0)
    defaults.budget = String(profile.budget);
  if (profile.city === current.city) defaults.district = profile.district;
  if (current.kind === "seeker") {
    defaults.note = profile.housingPreferences;
    if (profile.leaseMonths)
      defaults.minLeaseMonths = String(profile.leaseMonths);
  }
  const result = { ...current };
  // Explicit field whitelist; visibility, identity claims, and consents never prefill.
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    if (
      !touched.has(key) &&
      (current[key] === undefined ||
        current[key] === null ||
        current[key] === "")
    )
      Object.assign(result, { [key]: defaults[key] });
  }
  if (!touched.has("contact") && !current.contact) {
    if (touched.has("contactType"))
      result.contact =
        current.contactType === "phone"
          ? profile.contact.phone
          : profile.contact.wechat;
    else if (profile.contact.wechat) {
      result.contactType = "wechat";
      result.contact = profile.contact.wechat;
    } else if (profile.contact.phone) {
      result.contactType = "phone";
      result.contact = profile.contact.phone;
    }
  }
  return result;
}
