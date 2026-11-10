# Consent and Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Session replay, the account link (`umami.identify()`) and the preference snapshot run only after a yes; a complete GDPR Art. 13 notice lives on its own `/privacy` page.

**Architecture:** A visitor's replay choice lives in `localStorage` (the stored answer is strictly necessary to remember the choice). An account's terms acceptance and link consent live in three new `User` columns, exposed in the BetterAuth session as `additionalFields`. One client gate in the root layout shows the terms page to a signed-in user who has not accepted; the same page is the signup screen. A new feature folder `src/features/consent/` holds the prompt, the gate, the storage helpers and the server actions.

**Tech Stack:** Next.js 16 App Router, React 19, BetterAuth, Prisma 7, Vitest 5, Umami 3.4.1.

**Spec:** issue #617 (Decision, Done when) and issue #619 (Decision, Done when). Both bodies are the final spec; read them before Task 1. The privacy text follows the developer handbook's `analytics-standard` §5 (consent and control) and §7 (privacy notice template).

## Global Constraints

- Counting stays as it is: page views, click events and server events, without cookies (#617, analytics-standard option B).
- Replay is off by default and loads only after a yes. "No" is as easy to choose as "yes": same size, same screen. Replay never loads for an account with the link on (#617).
- The preference snapshot (`PreferenceTracker`) runs only after the same yes (#617).
- `identify()` is off by default. It runs only for an account whose link consent is on, and never on a page load that also loads replay (#617, analytics-standard trap 22).
- Signup: two boxes. The terms box is required; tongue-in-cheek Helldivers style, but the no-warranty and no-guaranteed-uptime lines stay plain. The optional box is empty by default, reads "the Ministry of Truth wants to know who you are", links to `/privacy` and says in one plain sentence what is linked (#617).
- Existing users: at their next login, a page that stays until they accept the terms; it offers the same optional box; "terms only" is as easy to choose as "both" (#617).
- A switch on the profile page withdraws the link consent as easily as it was given (GDPR Art. 7(3)) (#617).
- `identify()` ships only on Umami 3.4.0 or later. **Checked 2026-11-10: the running Umami is 3.4.1**, read without credentials from the public login-page bundle of the Umami instance (the `CURRENT_VERSION` constant beside `umami.currency` and `umami.date-range`). Re-check before release: the instance may change.
- Controller: the owner, by legal name, as a private person. Contact: `privacy@lav.ren` only — no contact form, no postal address, no Discord route (#619).
- The notice moves to `/privacy`; `/legal#privacy` points to it (#619).
- Every interactive element carries `data-umami-event="category-action"`; use `tryCatch`, not bare `try/catch`; dates render with `timeZone: 'UTC'` (AGENTS.md).
- Unit tests mirror the source tree under `src/__tests__/unit/` (AGENTS.md).

## Review Focus

1. **Storage blocked (private mode, site data off):** `readReplayConsent()` returns `null`, the prompt still shows, and a "yes" that cannot be stored keeps replay off (fail closed). Test in Task 2 and Task 3.
2. **Opted out of counting earlier (`umami.disabled` set):** the replay prompt does not show and replay never loads, whatever the stored replay answer. Test in Task 3 and Task 4.
3. **Signed-in user with link consent opens a page after saying yes to replay:** replay does not load; `identify()` runs. Test in Task 3.
4. **User without accepted terms opens `/legal` or `/privacy`:** the page renders, not the terms gate, so the terms can be read before accepting. Test in Task 6.
5. **Withdrawal of the link consent:** after the switch goes off, the next page load calls no `identify()`. Test in Task 7.

---

### Task 1: Consent columns on `User`

**Files:**
- Modify: `prisma/schema.prisma` (`model User`)
- Create: `prisma/migrations/<timestamp>_user_consent/migration.sql` (generated)
- Modify: `src/auth.js` (`user.additionalFields`)

**Interfaces:**
- Produces: `User.termsAcceptedAt DateTime?`, `User.identifyConsent Boolean @default(false)`, `User.identifyConsentAt DateTime?`; the same three fields on `session.user`, each with `input: false`.

- [ ] **Step 1:** Add the three fields to `model User`.
- [ ] **Step 2:** Run `npx prisma migrate dev --name user_consent --create-only` against a local throwaway database; check the SQL adds three nullable/defaulted columns and touches nothing else.
- [ ] **Step 3:** Add the three fields to `additionalFields` in `src/auth.js` (`termsAcceptedAt: { type: 'date', required: false, input: false }`, `identifyConsent: { type: 'boolean', defaultValue: false, input: false }`, `identifyConsentAt: { type: 'date', required: false, input: false }`).
- [ ] **Step 4:** Run `npx prisma generate && npm run typecheck`. Expected: pass.
- [ ] **Step 5:** Commit `feat(consent): consent columns on User`.

The migration applies on app start (AGENTS.md); staging holds a `prisma/` change until the hand-run staging migration.

### Task 2: Replay consent storage

**Files:**
- Create: `src/features/consent/replayConsent.mjs`
- Test: `src/__tests__/unit/features/consent/replayConsent.test.mjs`

**Interfaces:**
- Produces: `REPLAY_CONSENT_KEY = 'hd1.replay-consent'`; `readReplayConsent(): Promise<'yes' | 'no' | null | undefined>` (`undefined` = no answer yet, `null` = storage threw); `writeReplayConsent(answer: 'yes' | 'no' | null): Promise<boolean>` (`null` clears; returns false when storage threw).

- [ ] **Step 1: Write the failing tests**
  - `readReplayConsent` returns `undefined` on empty storage, `'yes'` after `writeReplayConsent('yes')`, `undefined` after `writeReplayConsent(null)`.
  - Any stored value other than `'yes'`/`'no'` reads as `undefined`.
  - With `localStorage.getItem` throwing, `readReplayConsent()` resolves `null`; with `setItem` throwing, `writeReplayConsent('yes')` resolves `false`.
- [ ] **Step 2:** Run `npx vitest run src/__tests__/unit/features/consent/replayConsent.test.mjs`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement with `tryCatch`, the same shape as `readOptOut`/`writeOptOut` in `src/shared/components/AnalyticsOptOut.jsx`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(consent): replay consent storage`.

### Task 3: Gate replay and the preference snapshot

**Files:**
- Modify: `src/shared/components/RecorderScript.jsx`, `src/shared/components/PreferenceTracker.jsx`, `src/app/layout.jsx`
- Test: `src/__tests__/unit/shared/components/RecorderScript.test.jsx` (extend), `src/__tests__/unit/shared/components/PreferenceTracker.test.jsx` (create)

**Interfaces:**
- Consumes: `readReplayConsent` (Task 2), `readOptOut` (`AnalyticsOptOut.jsx`), `session.user.identifyConsent` (Task 1).
- Produces: `canReplay({ consent, optOut, identified }): boolean` exported from `src/features/consent/replayConsent.mjs` — true only for `consent === 'yes' && optOut === false && identified === false`. `RecorderScript` takes a new prop `identified: boolean`; `PreferenceTracker` reads the same two stores and runs only when `canReplay` is true.

- [ ] **Step 1: Write the failing tests**
  - `canReplay` truth table: only `{ 'yes', false, false }` is true; `null` consent, `undefined` consent, `'no'`, `optOut: true`, `optOut: null` and `identified: true` are each false.
  - `RecorderScript` renders no `<script>` when consent is unanswered, and renders it after `writeReplayConsent('yes')` with `identified={false}`; with `identified` true it renders nothing.
  - `PreferenceTracker` calls `window.umami.track` zero times and writes no `sessionStorage` key without a yes; once with a yes.
- [ ] **Step 2:** Run the two test files. Expected: FAIL.
- [ ] **Step 3:** Implement. In `layout.jsx`, pass `identified={Boolean(session?.user?.identifyConsent)}` to `RecorderScript` and the same value to `PreferenceTracker`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(consent): replay and preference snapshot wait for a yes`.

### Task 4: Visitor prompt ("Ministry of Truth")

**Files:**
- Create: `src/features/consent/ReplayPrompt.jsx`
- Modify: `src/app/layout.jsx` (render it inside `MinistryProvider`, production analytics only — same condition as `RecorderScript`)
- Test: `src/__tests__/unit/features/consent/ReplayPrompt.test.jsx`

**Interfaces:**
- Consumes: `readReplayConsent`, `writeReplayConsent` (Task 2), `readOptOut`.
- Produces: `<ReplayPrompt />`, no props.

Copy (themed, plain where it matters): heading "The Ministry of Truth requests your cooperation"; body "May we record this visit to see where the site is hard to use? Text and everything you type are masked before anything leaves your browser. Recordings are never linked to an account. You can change this on the privacy page."; buttons "Allow recording" and "Decline"; link "privacy page" → `/privacy`.

- [ ] **Step 1: Write the failing tests**
  - Renders when the answer is `undefined` and the browser has not opted out; renders nothing when an answer exists or `umami.disabled` is set.
  - Both buttons have the same `className` and are siblings in one container (equal prominence); no checkbox is pre-ticked.
  - "Allow recording" calls `writeReplayConsent('yes')` and hides the prompt; "Decline" calls `writeReplayConsent('no')` and hides it.
  - Buttons carry `data-umami-event="consent-replay-allow"` and `data-umami-event="consent-replay-decline"`.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement as a non-modal bottom bar (`role="region"`, `aria-label="Recording consent"`), above `BottomNav` on mobile. After "Allow", recording starts from the next page load (`RecorderScript` reads storage after mount).
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(consent): Ministry of Truth replay prompt`.

### Task 5: Consent server actions

**Files:**
- Create: `src/features/consent/actions.mjs`
- Test: `src/__tests__/unit/features/consent/actions.test.mjs`

**Interfaces:**
- Consumes: `requireSession()` (`src/shared/utils/api/authGuards.mjs`), `db.user.update`.
- Produces (`'use server'`): `acceptTerms(formData: FormData): Promise<{ errors?: { auth?: string, terms?: string } }>` — requires `formData.get('terms') === 'on'`; sets `termsAcceptedAt = now`, and `identifyConsent = formData.get('identify') === 'on'` with `identifyConsentAt = now` when on. `setIdentifyConsent(on: boolean): Promise<{ errors?: { auth?: string } }>` — sets `identifyConsent` and `identifyConsentAt` (`null` when off). Both call `revalidatePath('/', 'layout')`.

- [ ] **Step 1: Write the failing tests** (mock pattern of `actions.userData.test.mjs`)
  - No session → `errors.auth`, no `db.user.update` call.
  - `acceptTerms` without `terms=on` → `errors.terms`, no update.
  - `acceptTerms` with `terms=on` only → update with `termsAcceptedAt` a `Date` and `identifyConsent: false`.
  - `acceptTerms` with both → `identifyConsent: true`, `identifyConsentAt` a `Date`.
  - `setIdentifyConsent(false)` → `identifyConsent: false, identifyConsentAt: null`, scoped `where: { id: session.user.id }`.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement with `tryCatch`; validate `formData` with a Zod schema in `src/validators/` (AGENTS.md: validate before any write).
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(consent): accept-terms and link-consent actions`.

### Task 6: Terms gate (signup and next login)

**Files:**
- Create: `src/features/consent/TermsGate.jsx`, `src/features/consent/TermsPrompt.jsx`
- Modify: `src/app/layout.jsx` (wrap `{children}` in `<TermsGate needsTerms={…}>`)
- Test: `src/__tests__/unit/features/consent/TermsGate.test.jsx`, `src/__tests__/unit/features/consent/TermsPrompt.test.jsx`

**Interfaces:**
- Consumes: `acceptTerms` (Task 5).
- Produces: `<TermsGate needsTerms={boolean}>{children}</TermsGate>` — renders `children` when `needsTerms` is false or `usePathname()` starts with `/legal` or `/privacy`; otherwise renders `<TermsPrompt />`. In `layout.jsx`: `needsTerms = Boolean(session?.user && !session.user.termsAcceptedAt)`.

`TermsPrompt` content: heading "Enlistment papers"; box 1 (required) "I accept the terms of service" linking `/legal#terms`, with the two plain lines beside it: "This site comes with no warranty." and "There is no guaranteed uptime."; box 2 (optional, unticked) "The Ministry of Truth wants to know who you are." plus one plain sentence: "If you tick this, the pages you visit and the buttons you use here are linked to your account in our own analytics, so that a problem you report can be traced in your visits." and a link to `/privacy`; one submit button "Report for duty" (`data-umami-event="consent-terms-submit"`). The purpose sentence is a proposal: analytics-standard §5.2 requires a concrete purpose, and the owner confirms or replaces it in the plan review. Terms only = leave box 2 empty; the effort is the same as ticking both.

- [ ] **Step 1: Write the failing tests**
  - `TermsGate` renders children when `needsTerms` is false; renders the prompt when true on `/`; renders children when true on `/legal` and `/privacy`.
  - `TermsPrompt`: box 2 is unchecked on first render; submit without box 1 shows the `errors.terms` message; submit with box 1 only sends `terms=on` and no `identify`; the `/privacy` link exists inside box 2's label.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement with `useActionState(acceptTerms, …)`; on success `router.refresh()`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(consent): terms gate for signup and next login`.

The OAuth `callbackURL` stays `/profile`: a first sign-in lands there and meets the gate.

### Task 7: `identify()` only with consent, and the profile switch

**Files:**
- Modify: `src/shared/components/Navigation/UserSection.jsx` (the `identify` effect)
- Create: `src/features/account/IdentifySwitch.jsx`
- Modify: `src/features/account/AccountSection.jsx` (render the switch)
- Test: `src/__tests__/unit/shared/components/Navigation/UserSection.test.jsx` (extend), `src/__tests__/unit/features/account/IdentifySwitch.test.jsx`

**Interfaces:**
- Consumes: `session.user.identifyConsent` (Task 1), `setIdentifyConsent` (Task 5).
- Produces: `<IdentifySwitch initial={boolean} />`.

- [ ] **Step 1: Write the failing tests**
  - `UserSection` calls `window.umami.identify` zero times when `identifyConsent` is false or missing, and once when true.
  - `IdentifySwitch` is a `role="switch"` with `aria-checked` equal to `initial`; one click calls `setIdentifyConsent(!initial)` and then `router.refresh()` (no `location.reload()`: AGENTS.md allows only `guardedReload()`, and that is for stale versions). The next page load runs no `identify()`. It carries `data-umami-event="account-identify-toggle"`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Switch label: "Link my use of this site to my account"; help text: the same plain sentence as box 2 in Task 6, and "Switch off at any time."
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(consent): identify only with consent, profile switch`.

Data already linked stays in Umami after withdrawal. Deleting that account's sessions through Umami's API needs an Umami API key and is an operator step (analytics-standard §5.2); record it in the privacy page as "on request".

### Task 8: The `/privacy` page (#619)

**Files:**
- Create: `src/app/privacy/page.jsx`
- Create: `src/features/consent/ReplayChoice.jsx` (the change-your-mind control on `/privacy`)
- Modify: `src/app/legal/page.jsx` (replace the `#privacy` section body with one paragraph and a link to `/privacy`; keep `id="privacy"`)
- Modify: `src/shared/components/Footer/Footer.jsx` (`/legal#privacy` → `/privacy`), `src/app/sitemap.js` (add `/privacy`)
- Test: `src/__tests__/unit/app/privacy/page.test.jsx`, `src/__tests__/unit/features/consent/ReplayChoice.test.jsx`, `src/__tests__/unit/app/legal/page.test.jsx` (create), `src/__tests__/unit/app/sitemap.test.mjs` (extend)

**Interfaces:**
- Consumes: `readReplayConsent`, `writeReplayConsent`, `AnalyticsOptOut`.
- Produces: `<ReplayChoice />` — shows the stored answer and one button to switch it; after a change to "no", reloads the page through `guardedReload()` (`src/shared/utils/reloadGuard.mjs`; AGENTS.md forbids a bare `location.reload()`) so a running recorder stops.

Sections, in this order (template: analytics-standard §7, slots filled):

| Section | Content |
|---|---|
| Who is responsible | The owner's legal name, a private person; `privacy@lav.ren`. No postal address, no form. |
| What is measured without asking you | The template text: page address, title, referrer, screen size, language, page-speed metrics; the daily-rotated pseudonymous hash; basis Art. 6(1)(f). |
| What happens only if you agree | Session recording (the prompt, Task 4) and the account link (the signup box, Task 6, and the profile switch, Task 7), with the concrete purpose sentence; basis Art. 6(1)(a) and Art. 10/2 of the Belgian Law of 30 July 2018. |
| Your account | Data from Discord, GitHub or Google sign-in (name, email, avatar, provider id); basis Art. 6(1)(b); kept until the account is deleted from the profile page. |
| Error tracking | Self-hosted GlitchTip: error reports with browser and page; basis Art. 6(1)(f). |
| Push notifications | The push subscription endpoint and keys, only after the browser's permission; basis Art. 6(1)(a); deleted on unsubscribe. |
| Your browser's privacy signals | GPC and DNT (see Preconditions). |
| What we do not do | The template text. |
| Server logs | IP per request, kept `{{log_days}}` days (see Preconditions). |
| Who else sees it | The hosting provider, Discord/GitHub/Google for sign-in, and the push services of the browser vendor; transfers outside the EEA for those three sign-in providers and the push services. |
| How long it is kept | Visit records 13 months, then monthly totals; recordings 30 days; server logs `{{log_days}}` days; account data until deletion; backups add their window. |
| Your rights | Access, rectification, erasure, restriction, portability, objection; write to `privacy@lav.ren`; an answer within one month (Art. 12(3)); complaint to the GBA/APD with the template's address. |
| Your choices | `<AnalyticsOptOut />` and `<ReplayChoice />`. |
| Last updated | The date, rendered with `timeZone: 'UTC'`. |

- [ ] **Step 1: Write the failing tests**
  - `/privacy` renders a heading for each section above and contains `privacy@lav.ren` exactly once as a `mailto:` link and no other email address.
  - `/legal` `#privacy` section contains a link to `/privacy`; the footer links to `/privacy`; the sitemap contains `${SITE_URL}/privacy`.
  - `ReplayChoice` shows "Recording: off" for `undefined`/`'no'` and "Recording: on" for `'yes'`; switching to off writes `'no'`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(privacy): GDPR Art. 13 notice on /privacy`.

**Preconditions (the notice must be true on the day it ships; check each, never guess):**
- Umami `SALT_ROTATION=day` (the "changes every day" wording) — **not checked**.
- The Umami retention jobs (13 months / 30 days, analytics-standard §6.1) run on the analytics server — **not checked**.
- GPC and DNT: the site honours them only after #631 lands. Until then the section says the site does not yet act on these signals and points to the opt-out switch — **not checked**.
- `{{log_days}}`: the reverse-proxy log retention on the production host — **not checked**.
- The backup window of the analytics and app databases — **not checked**.

### Task 9: Docs, changelog, gate

**Files:**
- Modify: `CHANGELOG.md`, and `package.json` only if the per-PR bump rule is still in force (#618)
- Modify: `src/app/docs/` pages that describe analytics or the opt-out, if any (`/usr/bin/grep -rln "opt-out\|replay\|identify" src/app/docs`)

- [ ] **Step 1:** Update the docs pages the grep finds.
- [ ] **Step 2:** Add the notes under `## Unreleased`.
- [ ] **Step 3:** Run `npm run lint && npm run typecheck && npm run test:unit && npm run build`. Expected: all pass.
- [ ] **Step 4:** Run `npm run dev`, then by hand: a fresh browser profile shows the prompt; "Decline" → no `/recorder.js` request on the next load; "Allow" → `/recorder.js` loads on the next load; a new account meets the terms page; ticking box 2 → `identify` call in the Network tab and no `/recorder.js`; the profile switch off → no `identify` on the next load.
- [ ] **Step 5:** Commit `docs(consent): changelog and docs for consent and /privacy`.

Ship #617 (Tasks 1–7) and #619 (Task 8) as two PRs, #617 first (#619's Decision: "write it after #617").
