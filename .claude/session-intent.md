# Session Intent Contract

**Created:** 2026-03-27
**Source:** Desloppify auth consistency (65%) and test health (0%) findings

## Job Statement

Fix auth consistency issues and improve test health to push desloppify strict score from 77.4 toward 85. Auth changes must be production-safe and fit existing architecture.

## Success Criteria

- Auth issues fixed with tests passing (working solution)
- MD5→SHA-256 migration planned and implemented (production-ready)
- Desloppify strict score moves meaningfully toward 85 (score improvement)

## Boundaries

- Must not break the worker pipeline or existing auth flow
- Auth changes affect production security — high stakes, careful approach
- Scope needs investigation before committing (general direction, not fully specified)

## Context

- Knowledge: Well-informed (desloppify findings are specific, but implementation needs investigation)
- Clarity: General direction — know the areas but need to verify before acting
- Constraints: Must fit architecture + high stakes
- Current score: 77.4/100 strict (target 85)
