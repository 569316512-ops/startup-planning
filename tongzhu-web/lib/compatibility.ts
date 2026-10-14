import type { Compatibility } from './roomdate/types';
import type { Profile } from './models';
// Port of upstream RoomDate/internal/users/compatibility.go. RMB proximity: 300.
export function compare(a:Profile,b:Profile):Compatibility {
 return {sameCity:!!a.city&&a.city===b.city,similarBudget:a.budgetMax>0&&b.budgetMax>0&&Math.abs(a.budgetMax-b.budgetMax)<=300,sharedTags:a.lifestyleTags.filter(t=>b.lifestyleTags.includes(t)),smokingMismatch:(a.lifestyleTags.includes('吸烟')&&b.lifestyleTags.includes('不吸烟'))||(b.lifestyleTags.includes('吸烟')&&a.lifestyleTags.includes('不吸烟'))};
}
