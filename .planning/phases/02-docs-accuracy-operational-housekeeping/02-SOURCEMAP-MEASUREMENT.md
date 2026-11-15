# Phase 2: Sourcemap strip, image measurement (D-15 step 2)

Measured 2026-11-15. Plan 02-10, task 3.

- Merge commit S: `ca7e661c0176885a797186154f6814e32c1eacb8` (PR #660, rebase-merged into `develop`).
- Build: Staging run: `43664483511` (success). `Build App Image (amd64)` and `Build App Image (arm64)` each logged one `Successfully uploaded source maps to Sentry` line.
- `origin/deploy/staging` pins `ghcr.io/elfensky/helldiversbot:sha-ca7e661c0176885a797186154f6814e32c1eacb8`.
- Images: `ghcr.io/elfensky/helldiversbot:v0.97.2` (digest `sha256:c5534747...`) and `ghcr.io/elfensky/helldiversbot:sha-ca7e661c0176885a797186154f6814e32c1eacb8`. Both `linux/amd64`.
- Method: `docker create`, then `docker export | tar -x` of `app/.next/static`, `app/.next/server` and `app/public/sw.js` into a new empty scratch folder. The tree was listed, counted and read. Nothing from it was executed.

| Measure | v0.97.2 | sha-S |
|---|---|---|
| static map count | 142 | 0 |
| static map bytes | 31057870 | 0 |
| server map count | 48 | 48 |
| static js count | 135 | 135 |
| static js bytes | 7264852 | 7259101 |
| sourceMappingURL lines | 131 | 0 |
| debugId lines | 131 | 131 |
| sw.js map refs | 3 | 3 |
| content size | 119MB | 207MB |

## Notes

- Baseline: v0.97.2 matches the RESEARCH measurement on every row it had (142 static maps, 31,057,870 bytes, 48 server maps, 135 static `.js` files, 7,264,852 bytes). RESEARCH has no figures for the other rows.
- Counts of `sourceMappingURL=` and `debugId=` are lines in static `.js` files (`grep -h`, then `wc -l`). Both equal the number of files that hold them: 131 of 135 files.
- `debugId lines` stays at 131 after the strip. The debug IDs are injected into the bundles and are the key GlitchTip uses to find the uploaded maps. The strip removes the maps and the comments, not the IDs.
- `sw.js map refs` counts the string `.map`. All 3 hits are `Array.prototype.map` calls. A count of `.js.map` and `sourceMappingURL` in `sw.js` is 0 in both images, so the service worker never referenced a source map (A8 holds).
- Server maps (48, 6,672 bytes in v0.97.2) stay in the image, as D-16 requires. They are not served over HTTP.
- Content size grew from 119MB to 207MB although 31 MB of maps are gone. The growth is outside `.next/static` and `.next/server` (static `.js` bytes are unchanged within 6 KB). It comes from the other changes between 0.97.2 and 0.98.1 and was not attributed. It does not bear on the verdict.
- The 4 static `.js` files without a `debugId=` line are not examined here. Symbolication of a real staging event is plan 02-09's proof.
- This record is not posted on #502. Plan 02-09 posts D-15 (1) first, then these numbers.

Verdict: STRIPPED
