// Flip an Uptime Kuma maintenance window on/off around a deploy.
//
// ⚠️  DRAFT / UNTESTED. Uptime Kuma has no REST API — this drives its Socket.IO
//     interface, whose event shapes vary by Kuma version. Verify against your
//     running Kuma before trusting it. It is intentionally NON-FATAL: a Kuma
//     hiccup logs a warning and exits 0, so it can never block a deploy (the
//     banner is a nice-to-have, not a gate).
//
// Usage:  node kuma-maintenance.mjs start   # opens a "manual" maintenance, active now
//         node kuma-maintenance.mjs end     # deletes the maintenance opened by `start`
//
// Env:
//   KUMA_URL          e.g. https://kuma.example.com
//   KUMA_USERNAME / KUMA_PASSWORD
//   KUMA_MONITOR_IDS  comma-separated monitor ids the banner covers (start only)
//   MAINT_ID          the maintenance id to delete (end only; `start` writes it to $GITHUB_ENV)
//
// Requires `socket.io-client` — the workflow installs it ephemerally before running this.

const stage = process.argv[2];
const { KUMA_URL, KUMA_USERNAME, KUMA_PASSWORD, KUMA_MONITOR_IDS, MAINT_ID } =
    process.env;

function warnAndExit(msg) {
    console.warn(`kuma-maintenance: ${msg} — skipping (non-fatal).`);
    process.exit(0);
}

if (!['start', 'end'].includes(stage)) warnAndExit(`unknown stage "${stage}"`);
if (!KUMA_URL || !KUMA_USERNAME || !KUMA_PASSWORD) warnAndExit('Kuma not configured');

const { io } = await import('socket.io-client').catch(() =>
    warnAndExit('socket.io-client not installed'),
);

const socket = io(KUMA_URL, { transports: ['websocket'], timeout: 10000 });
const emit = (event, ...args) =>
    new Promise((resolve, reject) => {
        socket.timeout(10000).emit(event, ...args, (err, res) => {
            if (err) return reject(err);
            if (res && res.ok === false) return reject(new Error(res.msg || event));
            resolve(res);
        });
    });

const fail = setTimeout(() => warnAndExit('timed out talking to Kuma'), 30000);

socket.on('connect', async () => {
    try {
        await emit('login', {
            username: KUMA_USERNAME,
            password: KUMA_PASSWORD,
            token: '',
        });

        if (stage === 'start') {
            const res = await emit('addMaintenance', {
                title: 'Deploying a new version',
                description: 'A new release is rolling out — back to normal shortly.',
                strategy: 'manual', // active until `end` deletes it
                active: true,
                intervalDay: 1,
                weekdays: [],
                daysOfMonth: [],
                timeRange: [
                    { hours: 0, minutes: 0 },
                    { hours: 23, minutes: 59 },
                ],
            });
            const id = res.maintenanceID;
            const monitors = (KUMA_MONITOR_IDS || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((mid) => ({ id: Number(mid) }));
            if (monitors.length) await emit('addMonitorMaintenance', id, monitors);
            // Hand the id to the `end` step via the workflow env file.
            if (process.env.GITHUB_ENV) {
                const { appendFileSync } = await import('node:fs');
                appendFileSync(process.env.GITHUB_ENV, `MAINT_ID=${id}\n`);
            }
            console.log(`kuma-maintenance: opened maintenance ${id}`);
        } else {
            if (!MAINT_ID) warnAndExit('no MAINT_ID to close');
            await emit('deleteMaintenance', Number(MAINT_ID));
            console.log(`kuma-maintenance: closed maintenance ${MAINT_ID}`);
        }
        clearTimeout(fail);
        socket.close();
        process.exit(0);
    } catch (e) {
        clearTimeout(fail);
        warnAndExit(e.message);
    }
});

socket.on('connect_error', (e) => warnAndExit(`connect_error: ${e.message}`));
