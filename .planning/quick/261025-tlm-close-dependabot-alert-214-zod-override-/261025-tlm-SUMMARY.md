---
phase: quick-261025-tlm
plan: 01
subsystem: deps
tags: [security, dependabot, zod, eslint]
key-files:
    modified:
        - package.json
        - package-lock.json
        - eslint.config.mjs
        - .planning/codebase/STACK.md
        - .planning/codebase/CONVENTIONS.md
decisions:
    - "Root override zod: $zod resolves the four @serwist/* nested zod 4.6.5 copies to 4.6.7"
    - "Drop eslint-plugin-react-compiler; eslint-plugin-react-hooks 7 carries the compiler rules"
status: complete
commits: 1
plan_head_before: 10478b7b4d6628ab563d898a668904cc7fe99c3e
plan_head_after: 66122625408cf3bd36c09e4584a3635eb3092c7b
actuals:
    tokens: 6000
    tasks: 2
    commits: 1
---

# Quick 261025-tlm: Close Dependabot alert #214 Summary

Root `"zod": "$zod"` npm override plus removal of eslint-plugin-react-compiler leaves zod 4.6.7 as the only zod in package-lock.json (GHSA-mrhx-c7xc-m3w5, vulnerable < 4.6.6).

## Result

- Commit: `66122625` on `bugfix/zod-alert-214`, five files, not pushed.
- `npm ls zod --all` exits 0, only `zod@4.6.7`.
- Lockfile drift vs 10478b7b: changed `[]`, added `[]`. Removed keys:
    - `node_modules/@babel/helper-annotate-as-pure`, `helper-create-class-features-plugin`, `helper-member-expression-to-functions`, `helper-optimise-call-expression`, `helper-plugin-utils`, `helper-replace-supers`, `helper-skip-transparent-expression-wrappers`, `plugin-proposal-private-methods`
    - `node_modules/@serwist/{build,cli,next,webpack-plugin}/node_modules/zod`
    - `node_modules/eslint-plugin-react-compiler` and its nested `zod` and `zod-validation-error`
- Lint: 0 errors / 323 warnings before, 0 errors / 321 warnings after.
- typecheck exit 0; test:unit exit 0 (195 files, 2032 tests passed); build exit 0, `public/sw.js` written (201 precache URLs).
- The plugin removal was done by `npm uninstall`; the `$zod` override alone sufficed (no lockfile fallback script needed).

## Deviations from Plan

**1. Commit trailer.** The plan names `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The session attribution rule names the real model, so the trailer is `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. The plan's last automated gate greps for the Opus trailer and fails on this. Reword the commit if that gate must pass.

Otherwise: none.

## Follow-ups

- The gitignored `.claude/CLAUDE.md` in the main checkout still lists the removed plugin; regenerate it from the codebase maps.
- The orchestrator still owes the 0.96.3 CHANGELOG and version bump.

## Known Stubs

None.

## Self-Check: PASSED

Commit 66122625 exists on the branch; the five files are in it; the build output and `public/sw.js` exist.
