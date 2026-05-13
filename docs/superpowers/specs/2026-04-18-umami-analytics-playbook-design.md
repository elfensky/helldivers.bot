# Umami Analytics Playbook for helldivers.bot

**Date:** 2026-04-18
**Goal:** Translate the existing Umami instrumentation into a working Umami v3 dashboard — reports, funnels, and journeys that answer "what's actually happening on my site?" without building new product metrics from scratch.
**Audience:** You, new to Umami, wondering what the 55+ events you're already firing can tell you.

---

## Context

You're self-hosting Umami v3 (cookieless, at `umami.drunik.be`, proxied through `/api/send` → `/api/umami`). Your tracking is already dense: 55+ named events, session-deduped `umami.identify()` for authed users, a once-per-session `preference-snapshot` of user settings, and server-side timing events on two API routes. The instrumentation is not the bottleneck — the bottleneck is that Umami, unlike GA, ships empty. Every insight is a report you configure.

This doc tells you which reports to build, in what order, and what each one will reveal.

---

## 1. Mental model: how Umami v3 thinks

GA hands you dozens of pre-built dashboards. Umami hands you six report *types* and expects you to compose them. That's the whole delta.

| Umami report | What it does | Closest GA analogue |
| --- | --- | --- |
| **Insights** | Slice-and-dice any event by country, browser, referrer, URL, custom property | Explorations / Free-form |
| **Funnel** | Ordered sequence of events/URLs — "did they do A → B → C?" | Funnel exploration |
| **Retention** | Cohort return rate over days/weeks | Cohort exploration |
| **Journey** | "After event X, what did users do next?" (tree view) | Path exploration |
| **Goals** | Conversion count vs. a target (pageviews, events, or revenue) | Conversions |
| **UTM** | Campaign source/medium/term breakdown | Acquisition |

Your existing **Events** tab already shows counts per event — that's the baseline. The reports above are what you *add on top* to turn counts into narrative.

**One non-obvious thing:** Umami events fire with optional `data` payloads (your `{ faction: id }`, `{ season }`, etc.). In the Umami UI, each property key/value becomes a filterable dimension. So `faction-toggle-bugs` with `data: { faction: "bugs" }` is queryable two ways: by event name, or by property. Prefer the property form for grouped reports — it's cleaner than N separate event names.

---

## 2. Day-1 reports (build these first — no code changes needed)

Ordered by "most likely to surprise you." All use data you're already collecting.

### 2.1 Faction affinity (Insights)
- **Question:** Which faction do people actually care about?
- **Data:** `faction-toggle-*` events, or property `faction` on all such events
- **Setup:** Insights → Events = `faction-toggle` → group by property `faction`
- **Look for:** I'd bet Illuminate dominates since they're the "new" enemy faction — but this will confirm vs. a Bugs/Cyborg nostalgia preference
- **Why interesting:** Justifies (or doesn't) how much screen real estate each faction gets on the dashboard

### 2.2 Archive season popularity (Insights)
- **Question:** Which war seasons do people revisit? Is the on-demand backfill worth it?
- **Data:** `archive-season-select` events, property `season`
- **Setup:** Insights → Events = `archive-season-select` → group by `season`, sort desc
- **Look for:** Long-tail of old seasons means archives have replay value; heavy concentration on current-ish seasons means archives are more of a "recent history" tool
- **Why interesting:** Tells you if `reseedSeason` backfill caching strategy is worth tuning, and whether to build out archive-specific analytics

### 2.3 Preference distribution (Insights)
- **Question:** What does a "typical" visitor's setup look like?
- **Data:** `preference-snapshot` event, properties `faction`, `regions_view`, `sort_order`
- **Setup:** Three separate Insights views, one per property, all filtered to this event
- **Look for:** The skew on `regions_view` (campaign vs sector) is the real tell — if 80%+ pick one, the default is wrong; if it's 50/50, the toggle is pulling its weight
- **Why interesting:** Unlike raw toggle counts (power-users dominate those), the snapshot fires once per session, giving you the average-user picture

### 2.4 Map pin feature usage (Insights + ratio)
- **Question:** Does anyone use the sticky galaxy map toggle?
- **Data:** `home-map-toggle` events vs. home pageviews
- **Setup:** Insights for `home-map-toggle` count, compare against `/` pageview count from the Pages tab
- **Look for:** If toggle-count / home-pageviews is <1%, the feature is dead weight; 5–10% means niche-but-used; >20% means default it on
- **Why interesting:** Classic "do we kill this feature?" question answered with one ratio

### 2.5 Docs engagement depth (Insights + Journey)
- **Question:** Do people actually read the docs diagrams, or bounce?
- **Data:** `diagram-*-{view}` tab switches, `diagram-node-click` events, pageviews of `/docs/*`
- **Setup:**
  - Insights: `diagram-node-click` grouped by property `node` — which nodes get clicked most
  - Journey: starting from `/docs` pageview, what do people do next?
- **Look for:** Ratio of diagram events per `/docs` pageview. <0.5 = people skim, 1–3 = they engage, >3 = power-user behavior worth building more of
- **Why interesting:** Validates whether the Mermaid investment is paying off

### 2.6 API rebroadcast usage (Insights)
- **Question:** Is anyone using your API? Which action?
- **Data:** `api-rebroadcast` events, property `action` (and `season` when applicable)
- **Setup:** Insights → `api-rebroadcast` → group by `action`
- **Look for:** `get_campaign_status` will dominate (it's the "what's happening now" call). If `get_snapshots` with varying `season` values shows up, you have actual researchers/historians using the API — worth a blog post or a nudge in the docs
- **Why interesting:** The only honest answer to "is my API a product?" lives in this report

### 2.7 API performance distribution (Insights, property = `ms`)
- **Question:** P50 / P95 / P99 of API response time, seen from the server
- **Data:** `api-campaign` and `api-rebroadcast` events, property `ms`
- **Setup:** Insights → event, show property `ms` as a distribution
- **Look for:** Tail latency. If P95 is 10x P50, you have cold-start or DB contention issues worth investigating; if it's tight, you're fine
- **Why interesting:** Free performance monitoring without running a proper APM

### 2.8 Global overview dashboard (pinned)
Build an Umami Dashboard with these panels (top row, left-to-right):
1. **Sessions today + 7-day trend** (built in)
2. **Top pages** (built in)
3. **Top referrers** (built in) — this answers your B-adjacent curiosity about where people come from
4. **Faction affinity** (§2.1)
5. **Archive season popularity** (§2.2)
6. **Notification funnel conversion** (§3.1 — once you build it)

That's your "homepage" for checking on the site each morning.

---

## 3. Funnels to build (Funnel report)

Each of these answers a "how far do people get?" question. Umami funnels take 2–5 steps; steps can be pageviews or events.

### 3.1 Notification opt-in funnel
- `/` pageview → `notification-enable` → `push-subscribe`
- Alternate failure branch: `/` → `notification-enable` → `notification-permission-denied`
- **What it tells you:** Conversion rate of "people who saw the site" → "people who asked for notifications" → "people who actually subscribed." The permission-denied branch quantifies "I tried but said no to the browser prompt," which is different from "I never tapped."
- **Actionable:** If enable-rate is <1% of sessions, the toggle is invisible — move it or add a nudge. If enable-rate is high but subscribe-rate is low, your browser-prompt copy or timing is the problem.

### 3.2 Auth funnel (per provider)
- `/` pageview → `auth-signin` → `auth-signin-{discord|github|google}`
- Build three funnels, one per provider, or one funnel with the provider tier as a branch
- **What it tells you:** Which provider wins, and whether the sign-in page is a drop-off (people clicked "Sign in" but bailed at the provider picker).
- **Actionable:** If Discord wins 5:1 and Google is near-zero, reorder the buttons. If people hit `/sign-in` and then leave without picking, the page is confusing or too noisy.

### 3.3 Discovery funnel
- `/` pageview → `/docs` pageview → any `diagram-*-*` event
- **What it tells you:** Does the "check the docs" path actually get used, or is documentation for you-and-LLMs only?
- **Actionable:** If the funnel collapses at step 2, the homepage doesn't surface docs. If it collapses at step 3, diagrams aren't rendering or are too visually dense to engage with.

### 3.4 Archive deep-dive funnel
- `/` pageview → `/archives` pageview → `archive-season-select` → `archive-season-refresh`
- **What it tells you:** Proportion of visitors who not only browse archives but hit refresh on a specific season (i.e., trigger the on-demand backfill).
- **Actionable:** A healthy refresh rate validates the backfill architecture; a near-zero rate suggests most people see stale data and don't notice.

---

## 4. Journey and Retention reports

### 4.1 Homepage journey (Journey)
- **Starting event:** `/` pageview
- **What it shows:** A tree of "next steps" — most people probably just stay on `/` and scroll, but the long tail is where the interesting paths live (→ `/docs`, → faction toggle, → notification enable)
- **Look for:** The second-most-common path after "no action." That's your hidden primary use case.

### 4.2 Return visitor retention (Retention)
- **Cohort:** All new visitors in a week
- **Measure:** % returning on day 1, 2, 7, 14, 30
- **Look for:** Does enabling notifications change retention? To answer this, split the cohort — see §5.1 for the small tracking addition that makes this possible.
- **Why interesting:** If push-enabled users retain 3x better than anonymous, the notification feature is your real product; if not, reconsider how much effort it gets.

### 4.3 Authed vs. anonymous engagement (Insights with identify segment)
- **Question:** Do logged-in users behave meaningfully differently?
- **Data:** Everything — segment any event by "has user ID" vs. not
- **Look for:** Session length, events per session, faction toggle usage. If authed users engage 2x+, auth is worth the complexity; if they're identical, reconsider why you have auth at all.

---

## 5. Low-cost tracking additions (unlock outsized insight)

Each is small (<20 LOC) and each unlocks a whole category of reporting that isn't possible today. Listed roughly by impact-per-line-of-code.

### 5.1 `push_enabled` as an identify property (highest leverage)
- **Change:** In the existing `umami.identify()` call at `src/shared/components/Navigation/UserSection.jsx:28-36`, add a `push_enabled` boolean derived from `Notification.permission === 'granted'` AND an active push subscription. For anonymous users, fire a one-shot `session-context` event at session start with the same boolean.
- **Unlocks:** Segment *every* report by push-enabled vs not. Directly answers "do notifications drive retention/engagement?" (§4.2).
- **Cost:** ~10 LOC.

### 5.2 Referrer category as a session-once event
- **Change:** On first pageview per session, classify `document.referrer` into a small set — `direct`, `discord`, `reddit`, `github`, `twitter`, `google`, `other` — and fire `session-source` with the category as a property.
- **Why:** Umami already tracks raw referrers, but the long tail of Reddit subpaths / Discord CDN URLs fragments the data. A clean 7-bucket classification makes the referrer dashboard actually readable.
- **Unlocks:** UTM-style acquisition reports without requiring UTM tags on every inbound link.
- **Cost:** ~30 LOC, one component mounted in layout (similar to `PreferenceTracker`).

### 5.3 Session engagement score (preference-snapshot v2)
- **Change:** Extend `usePreferenceSnapshot` to also capture, at session-end or after 30s, counts of `faction_toggles`, `region_view_toggles`, `sort_toggles`, `diagram_clicks` as properties of a single `session-engagement` event.
- **Unlocks:** A single event that captures "how engaged was this user" — segments everything else cleanly. Lets you answer "do engaged users come back?" without compositing across a dozen event types.
- **Cost:** ~40 LOC. Uses `visibilitychange` + `beforeunload` to fire-and-forget.

### 5.4 Track the remaining API routes server-side
- **Change:** Extend `umamiTrackEvent` calls to the routes that aren't yet covered — `/api/h1/live`, admin routes, push subscription endpoints. Mirror the `{ ms, action? }` pattern already used on campaign/rebroadcast.
- **Unlocks:** Full API-usage picture, including from the service worker. Today you only see two routes.
- **Cost:** ~5 LOC per route × ~6 routes.

### 5.5 404 recovery rate
- **Change:** Already have `nav-404-home`. Add `nav-404-abandon` by firing on `beforeunload` if no nav event fired, OR just compare `nav-404-home` count to pageviews of `/_not-found`.
- **Unlocks:** A clean "what % of 404s recover?" ratio. Useful when you're deciding whether to fix a broken link or let it rot.
- **Cost:** Measurement via ratio requires zero code. Abandon-event is ~10 LOC if you want the direct signal.

---

## 6. Recommended build order

**Week 1 (no code, all Umami UI):**
1. Build the overview dashboard (§2.8) with the 6 panels.
2. Build the notification funnel (§3.1) — this is your single highest-signal report.
3. Build faction affinity + archive popularity + preference distribution (§2.1–2.3).

**Week 2 (a little code):**
4. Ship the `push_enabled` identify property (§5.1).
5. Build return-visitor retention split by push-enabled (§4.2).
6. Ship session-source classification (§5.2) and add a referrer-category panel to the overview dashboard.

**Later (when curious, not urgent):**
7. Session engagement score (§5.3) and authed-vs-anon engagement comparison (§4.3).
8. Backfill API tracking on remaining routes (§5.4).
9. Homepage journey report (§4.1) — most useful once you've got a month of data.

---

## 7. Pitfalls and gotchas

- **Production-only tracking** — `src/shared/utils/umami.mjs` gates server-side events on `NODE_ENV === 'production'`, and the client `<Script>` only loads when `UMAMI_SITE_ID` is set. You cannot validate new events locally by just looking at Umami; you'll need to test in a production-like environment. Consider a `UMAMI_DEV_ENABLED=true` override for a staging instance if you want to iterate on new events without shipping to prod first.
- **Cookieless sessions hash on IP + UA + hostname**, so VPN hops or UA changes start a new session. Retention numbers will be slightly conservative vs. GA. This is generally fine — just don't read single-digit-percent differences as signal.
- **Property cardinality** — if you add a property like `timestamp` or `user_id` directly to an event, you'll blow up Umami's groupable-values view. Keep per-event property values low-cardinality (enum-like). Your existing payloads all follow this rule.
- **Funnel steps are strict ordering, not "eventually"** — if a user fires step 1, then 3, then 2, Umami funnels drop them at step 2. This matters for your auth funnel if people click around before committing.
- **Preference snapshot fires once per session** (gated by `sessionStorage`). In Insights, compare it against *sessions*, not pageviews, or the percentages will be wrong.

---

## 8. Not doing

- **Revenue/Goals reports** — no monetization, skip.
- **UTM tagging campaigns** — you don't run paid acquisition; §5.2 gives you 80% of the insight for 0% of the effort.
- **Session recording** — not supported by Umami; if you want this, it's a separate tool (PostHog, Clarity) and a separate privacy conversation.
- **Custom property backfill** — don't retroactively rename events to be "cleaner." Umami aggregates history by event name; renaming breaks charts. If an event name is awkward, leave it and add new ones going forward.

---

## Verification plan

This is a strategy doc, not a code change — "verification" here means: after building Week 1 in the Umami UI, check that (a) each report renders data from the last 7 days without errors, (b) the event counts on each report match the totals on the Events tab (for cross-check), and (c) the overview dashboard loads in <2s. If any report is empty, check production Umami ingestion first (`/api/umami` route logs), not the event definitions.

When you later ship §5.1 (`push_enabled`), verify end-to-end: enable notifications in a production browser session, check that the next `umami.identify()` call includes `push_enabled: true` in the network tab, and confirm the property appears as a filterable dimension in Umami within a few minutes.
