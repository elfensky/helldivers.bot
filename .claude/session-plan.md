# Session Plan — Auth Consistency + Test Health

**Created:** 2026-03-27
**Intent Contract:** See .claude/session-intent.md

## What You'll End Up With

Auth consistency dimension fixed from 65% toward 80%+, with:

- `'use server'` exposure hardened on data pipeline functions
- MD5 API key hashing migrated to SHA-256 (no migration, keys will have to be recreated)
- Consistent auth failure patterns across all server actions
- Update endpoint moved from query-string secret to Authorization header

## How We'll Get There

### Phase Weights

- Discover: 30% — Investigate each auth issue's blast radius, verify what's actually exposed, check worker pipeline dependencies
- Define: 15% — Lock down which fixes are safe to ship vs need migration planning
- Develop: 35% — Implement fixes with tests
- Deliver: 20% — Verify build, run desloppify re-review, validate no regressions

### Execution Plan

#### DISCOVER (30%) — Investigation

1. **`'use server'` exposure audit**
    - Which functions in `update/status.mjs` and `season.mjs` are actually callable as server actions?
    - Are they only imported by server-side code, or could a client reach them?
    - What's the real risk vs theoretical risk?

2. **MD5→SHA-256 migration analysis**
    - How many API keys exist in production?
    - Can we dual-hash (check SHA-256 first, fall back to MD5, re-hash on match)?
    - Do we need a Prisma migration to add a `hash_algo` column or just swap in place?

3. **Worker pipeline dependency map**
    - `public/workers/cron.js` → calls update endpoint → how does it authenticate?
    - If we move the secret from query param to header, what needs to change in the worker?

4. **deleteApiKey pattern investigation**
    - Why does it return errors while siblings throw? Is the caller (`useActionState`) handling differently?

#### DEFINE (15%) — Scope Lock

Based on discovery, classify each fix:

- **Ship now:** Low-risk, clear implementation
- **Ship with migration:** Needs data migration or coordinated deploy
- **Defer:** Too risky or low ROI for this session

#### DEVELOP (35%) — Implementation

Likely fix order (pending discovery):

1. Normalize `deleteApiKey` auth pattern (low risk)
2. Harden `'use server'` exposure (medium risk — verify worker isn't affected)
3. Move update secret to Authorization header (medium risk — worker change)
4. MD5→SHA-256 migration (higher risk — needs migration strategy)

Each fix gets:

- Implementation
- Unit tests
- Build verification

#### DELIVER (20%) — Validation

1. Full build + test suite (210+ tests)
2. Desloppify rescan + re-review of auth_consistency dimension
3. Verify worker pipeline still functions (ask user to test with dev server)

### Execution Commands

To execute this plan:

```
/octo:embrace "Fix auth consistency issues and improve test health per desloppify findings"
```

Or execute phases individually:

- `/octo:discover` — Investigate blast radius of each auth issue
- `/octo:define` — Lock scope based on discovery
- `/octo:develop` — Implement fixes
- `/octo:deliver` — Validate and rescan

## Provider Availability

🔴 Codex CLI: Available ✓
🟡 Gemini CLI: Available ✓
🟤 OpenCode: Available ✓
🔵 Claude: Available ✓

## Debate Checkpoints

🔸 **After Discover phase:** "Is the MD5→SHA-256 migration safe to ship in this session, or should it be a separate tracked issue?"
→ Triggers: 1-round adversarial debate on migration risks

🔸 **After Develop phase:** "Have the auth fixes introduced any new attack surface?"
→ Triggers: 1-round collaborative review of security implications

## Success Criteria

- Auth consistency dimension ≥ 75% on re-review (from 65%)
- All 210+ tests passing
- Build succeeds
- No regression in other desloppify dimensions
- Worker pipeline unaffected

## Next Steps

1. Review this plan
2. Adjust if needed (re-run /octo:plan)
3. Execute with /octo:embrace when ready
