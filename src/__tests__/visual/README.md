# Visual regression tests

```bash
npm run test:visual          # compare against the committed baselines
npm run test:visual:update   # accept current rendering as the new baselines
```

Both run inside the Playwright Docker image (`scripts/visual-tests.sh`) because
baseline PNGs are platform-specific. Docker must be running.

Full write-up — what is covered, how determinism is pinned, why each stub
exists — lives in [`/docs/testing`](../../app/docs/testing/page.mdx). Keep it
there, not here.
