# Member Intake Implementation Plan
> For agentic workers: use superpowers:executing-plans; user requested inline execution now.
**Goal:** Improve intake identity and launch manual membership without payment QR images yet.
**Architecture:** Additive D1 migration, shared atomic quotas on actual rows, membership orders with private R2 proof. Existing Sites audience stays public.
**Tech Stack:** React/Vinext, Cloudflare Worker D1/R2, SQLite.
**Spec:** docs/superpowers/specs/2026-10-16-member-intake.md

## Global Constraints
30 yuan/30 days. Free 5 contacts/3 posts, member 50/30 per Shanghai day. Never publish tests or payment proofs. Old records keep defaults. User will supply QR images later; no fake payable QR.

## Review Focus
- Concurrent final publish/contact slot does not exceed quota.
- Duplicate approval cannot extend membership twice.
- Private proof cannot be fetched anonymously or by another account.
- Failed validation/upload does not consume publish quota.
- Old anonymous receipt management and historical titles still work.

### Task 1: Intake identity and registration
Files: db/schema.ts, migration0005, lib/server.ts, lib/pilot-server.ts, components/quick-intake.tsx, components/forms*.tsx, lib/models.ts, public/avatars.
- [x] Write tests for email/password-only registration, password rejection, custom title/date/gender/avatar persist.
- [x] Observe failure; implement data/validation/UI and four local cartoons.
- [x] Run integration/browser regressions and typecheck.

### Task 2: Account quotas and manual membership
Files: lib/membership.ts, lib/contact-access.ts, server routers, components/membership.tsx, TongzhuApp.tsx.
Interfaces: membershipStatus(userId,db), atomic publish conditional INSERT; /membership GET, /membership/orders POST, /membership/orders/:id/proof POST, /membership/proofs/:id GET; /admin/membership GET/POST and QR upload POST.
- [x] Write failing real SQLite/runtime tests for concurrent free/member slots, expiry, order approval idempotency, proof privacy and disabled payment.
- [x] Implement atomic shared account quotas and private payment workflow; visible membership page and admin controls.
- [x] Run full relevant API and browser regression.

### Task 3: Review and publish
- [x] Fresh code review and resolve important findings with regression tests.
- [x] Build exact committed source, push Sites source, package dist, save/deploy original site preserving public access.
- [x] Readonly production checks; update handoff and report remaining QR setup.

Execution: inline per user “先做/继续”. Independent review completed; important login-state loss reproduced RED then GREEN. Contact limit copy corrected. Real concurrent approval and cross-entry publication races tested. Test commands and evidence: docs/validation/2026-10-16-member-intake.md.

Deployed v21 source 033209346eb7948c16360104ad142aa33dee2f42; succeeded deployment appgdep_6ad237f5582c819183a92be5683fc131. Production readonly checks passed; see root validation/member-intake-2026-10-16.md.
