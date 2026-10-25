import type { Kind } from "./contracts";
export type Gender = "男" | "女" | "其他" | "不透露";
export type HousingState = "rented" | "teamup" | "landlord" | "agent";
export type FollowupStatus =
  | "new"
  | "qualified"
  | "contacted"
  | "viewing"
  | "matched"
  | "invalid";
export type Visibility = "active" | "hidden" | "withdrawn";
export type ContactType = "wechat" | "phone";
export type ContactVisibility = "operator" | "members";
export type Profile = {
  id: string;
  email: string;
  isAdmin: boolean;
  nickname: string;
  occupation: string;
  gender: Gender;
  city: string;
  district: string;
  budget: number | null;
  moveIn: string;
  leaseMonths: number | null;
  bio: string;
  roommateExpectations: string;
  housingPreferences: string;
  avatarUploadId: string | null;
  contact: { wechat: string; phone: string };
};
export type Housing = {
  housingState: HousingState;
  community: string;
  bedrooms: 2 | 3;
  bathrooms: number;
  area: number;
  roomsAvailable: number;
  originalLayout: true;
  amenities: string[];
  authorityConfirmed: boolean;
};
export type LeadInput = {
  kind: Kind;
  city: string;
  district: string;
  title: string;
  budget: number;
  moveIn: string;
  minLeaseMonths: number;
  preferredGender: "男" | "女" | "不限";
  gender: Gender;
  nickname: string;
  occupation: string;
  note: string;
  coRentalRules: string;
  roommateExpectations: string;
  housing: Housing | null;
  photoIds: string[];
  avatarUploadId: string | null;
  contactType: ContactType;
  contact: string;
  contactVisibility: ContactVisibility;
  adult: true;
  consent: true;
  publicConsent: true;
  source: string;
};
export type LeadDraft = Partial<
  Omit<
    LeadInput,
    | "budget"
    | "minLeaseMonths"
    | "adult"
    | "consent"
    | "publicConsent"
    | "housing"
  >
> & {
  kind: Kind;
  city: string;
  budget?: string;
  minLeaseMonths?: string;
  adult?: boolean;
  consent?: boolean;
  publicConsent?: boolean;
  housing?: Partial<Omit<Housing, "originalLayout">> & {
    originalLayout?: boolean;
  };
};
// No contact fields or private account fields in public projections.
export type PublicLead = Omit<
  LeadInput,
  | "contact"
  | "contactType"
  | "contactVisibility"
  | "adult"
  | "consent"
  | "publicConsent"
> & {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  publisher: {
    nickname: string;
    occupation: string;
    bio: string;
    avatarUploadId: string | null;
  };
  contactAvailable: boolean;
};
export type PrivateLead = PublicLead & {
  ownerId: string;
  contact: string;
  contactType: ContactType;
  contactVisibility: ContactVisibility;
  visibility: Visibility;
  followupStatus: FollowupStatus;
};
export type Page<T> = { items: T[]; nextCursor: string | null };
export type ListingQuery = {
  city?: string;
  district?: string;
  kind?: Kind;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: 2 | 3;
  amenities?: string[];
  mine?: boolean;
  cursor?: string;
  limit?: number;
};
