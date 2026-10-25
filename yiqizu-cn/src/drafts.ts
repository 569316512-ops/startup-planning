import type { Kind } from "../shared/contracts";
import type {
  LeadDraft,
  PrivateLead,
  Profile,
} from "../shared/business-contracts";
import { fillProfileDefaults } from "../shared/profile-prefill";
export const draftKey = (userId: string | null, kind: Kind) =>
  `yiqizu-cn:draft:${userId ?? "visitor"}:${kind}`;
export function fromPost(p: PrivateLead): LeadDraft {
  return {
    ...p,
    budget: String(p.budget),
    minLeaseMonths: String(p.minLeaseMonths),
    housing: p.housing ?? undefined,
    adult: false,
    consent: false,
    publicConsent: false,
  };
}
export function mergeDraft({
  current,
  profile,
  draft,
  editing,
  touched,
}: {
  current: LeadDraft;
  profile: Profile | null;
  draft: LeadDraft | null;
  editing: PrivateLead | null;
  touched: ReadonlySet<string>;
}): LeadDraft {
  if (editing) return fromPost(editing);
  const combined = { ...current, ...draft };
  for (const key of touched)
    if (Object.hasOwn(current, key))
      Object.assign(combined, { [key]: current[key as keyof LeadDraft] });
  return fillProfileDefaults(combined, profile, touched);
}
export type SavedDraft = {
  data: LeadDraft;
  touched: string[];
  requestId: string;
};
export function loadDraft(key: string): SavedDraft | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      v &&
      typeof v === "object" &&
      v.data &&
      Array.isArray(v.touched) &&
      typeof v.requestId === "string"
    )
      return v as SavedDraft;
  } catch {}
  return null;
}
export function saveDraft(key: string, data: SavedDraft) {
  // Only form data: never session tokens, signed URLs, role claims or arbitrary response fields.
  const allowed = [
    "kind",
    "city",
    "district",
    "title",
    "budget",
    "moveIn",
    "minLeaseMonths",
    "preferredGender",
    "gender",
    "nickname",
    "occupation",
    "note",
    "coRentalRules",
    "roommateExpectations",
    "housing",
    "photoIds",
    "avatarUploadId",
    "contactType",
    "contact",
    "contactVisibility",
    "source",
  ];
  const form = Object.fromEntries(
    Object.entries(data.data).filter(([k]) => allowed.includes(k)),
  );
  try {
    localStorage.setItem(key, JSON.stringify({ ...data, data: form }));
  } catch {}
}
export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}
