---
name: project_priorities
description: Current roadmap priorities and shelved items as of 2026-03-24
type: project
---

**Current priorities (in order):**
1. Mobile-first fundamental redesign (Stitch design exists)
2. PWA + push notifications for mobile
3. Consistent style guide / design system
4. WebSockets for live updates
5. Database schema rework (unified events, interval stats, historic player counts)
6. War history page (`/war/:id` with animated map playback)
7. Footer links cleanup (many are empty href="")
8. Roadmap section — link to GitHub Issues/Projects (low priority)
9. Buy/Play section — small card on homepage
10. Ultrawide support (2xl+)

**Why:** Most users visit from mobile — the entire layout needs a fundamental mobile-first shift, not just responsive patches.

**Shelved (2026-03-24):**
- Discord bot rewrite — deferred until website + API are stable
- SwiftUI app with Live Activities
- Helmet photoshop for about section

**How to apply:** All frontend work should start from mobile viewport and scale up. Don't add desktop-only features without mobile equivalents.
