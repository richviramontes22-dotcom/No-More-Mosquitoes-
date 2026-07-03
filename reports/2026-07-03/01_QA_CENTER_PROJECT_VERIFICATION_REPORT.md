# 01 — QA Center Project Verification Report

**Date:** 2026-07-03  
**Sprint:** Admin QA Center + Customer/Employee App Audit + Premium Add-On Store

---

## Git Identity

| Field | Value |
|---|---|
| Working directory | `c:\Users\elija\OneDrive\Desktop\NMM2` |
| Branch | `main` |
| Remote URL | `https://github.com/richviramontes22-dotcom/No-More-Mosquitoes-.git` |
| Latest commit | `50625f6` Security closure: RLS fixes, private storage, GPS consent audit, arrived_at fix |
| Uncommitted files | None (clean working tree) |
| Unpushed commits | None (branch up to date with origin/main) |

**Confirmed: This is the No More Mosquitoes project. Not FairDebate. Not any other project.**

---

## Netlify

- Linked site: confirmed via prior session (Netlify CLI connected)
- Production URL: `https://nomoremosquitoes.us`
- Netlify account: richviramontes22-dotcom

---

## Supabase

| Field | Value |
|---|---|
| Project ref | `qamfxqbtvwwlzlmqrqbh` |
| Total profiles | 59 |
| Profile breakdown | 3 admin, 52 customer, 1 customer_service, 2 employee, 1 technician |

**Data classification:**

The production database contains 59 profiles. Based on prior sprint history, this is a **mixed database** — it contains the developer/owner accounts (admin), seed/test customer accounts created during dev testing, and potentially some real customers from pre-launch testing. The `profiles` table does not have an `is_test` column.

Individual emails were not read (PII protection). All QA work this sprint will use dedicated `@test.com` accounts only, never real customer accounts, and never mutate existing data.

---

## Project Identity Confirmed

- ✅ Repo: `richviramontes22-dotcom/No-More-Mosquitoes-`
- ✅ Branch: `main`
- ✅ Domain: `nomoremosquitoes.us`
- ✅ Supabase project ref: `qamfxqbtvwwlzlmqrqbh`
- ✅ Clean working tree — no uncommitted changes from prior sprint
- ✅ Not FairDebate
- ✅ Not any other project

**PROCEED.**
