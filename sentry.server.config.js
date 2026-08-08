// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment:
        process.env.NEXT_PUBLIC_DEPLOY_ENV ||
        process.env.DEPLOY_ENV ||
        process.env.NODE_ENV,
    // Without this every event lands untagged and GlitchTip cannot answer "did
    // the release fix it?" — the only version signal was the ?dpl= query Next
    // glues onto client chunk URLs, which server events never carry.
    // Inlined at build time by next.config.mjs's `env` block.
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    // The SDK defaults server_name to os.hostname(), which inside Docker is the
    // container ID — a fresh random value every redeploy, so the tag splits one
    // server's history across dozens of meaningless names. Swarm fills this
    // with `{{.Node.Hostname}}` so the tag names the machine instead. Unset
    // (local dev) falls back to the SDK default, which is the real hostname.
    serverName: process.env.SENTRY_SERVER_NAME || undefined,
    sendDefaultPii: true,
    tracesSampleRate: 1.0,
    debug: false,
});
