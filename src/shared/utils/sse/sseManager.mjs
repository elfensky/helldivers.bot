import pg from 'pg';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { computeMapState } from '@/shared/utils/game/computeMapState.mjs';
import { EVENT_STATUS } from '@/shared/enums/events';

const HEARTBEAT_INTERVAL_MS = 15_000;
const DEDUP_WINDOW_MS = 1_000;
const MAX_CONNECTIONS = 500;
const MAX_PER_IP = 5;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

let eventId = 0;

class SSEManager {
    constructor() {
        this.clients = new Set();
        this.ipCounts = new Map();
        this.cachedPayload = null;
        this.healthy = false;
        this.listener = null;
        this.heartbeatTimer = null;
        this.lastNotifyTime = 0;
        this.reconnectDelay = RECONNECT_BASE_MS;
        this.shuttingDown = false;
    }

    async init() {
        if (this.listener || this.shuttingDown) return;
        await this._connectListener();
        this._startHeartbeat();
        this._setupShutdown();
    }

    async _connectListener() {
        const { error: connError } = await tryCatch(this._createAndConnect());
        if (connError) {
            console.error('SSE LISTEN connection failed:', connError.message);
            this.healthy = false;
            this._scheduleReconnect();
        }
    }

    async _createAndConnect() {
        this.listener = new pg.Client({
            connectionString: process.env.POSTGRES_URL,
            ssl:
                process.env.POSTGRES_SSL === 'false' ?
                    false
                :   { rejectUnauthorized: true },
        });

        await this.listener.connect();
        await this.listener.query('LISTEN campaign_update');

        this.listener.on('notification', () => this._onNotification());
        this.listener.on('error', (err) => {
            console.error('SSE LISTEN client error:', err.message);
            this.healthy = false;
            this.listener = null;
            if (!this.shuttingDown) this._scheduleReconnect();
        });
        this.listener.on('end', () => {
            this.healthy = false;
            this.listener = null;
            if (!this.shuttingDown) this._scheduleReconnect();
        });

        this.healthy = true;
        this.reconnectDelay = RECONNECT_BASE_MS;
        console.log('SSE LISTEN connection established');

        // Fetch initial state
        await this._fetchAndCache();
    }

    _scheduleReconnect() {
        if (this.shuttingDown) return;
        const delay = this.reconnectDelay;
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
        console.log(`SSE LISTEN reconnecting in ${delay}ms...`);
        setTimeout(() => this._connectListener(), delay);
    }

    async _onNotification() {
        const now = Date.now();
        if (now - this.lastNotifyTime < DEDUP_WINDOW_MS) return;
        this.lastNotifyTime = now;

        await this._fetchAndCache();
        this._broadcast();
    }

    async _fetchAndCache() {
        const { data, error } = await tryCatch(getCampaign());
        if (error || !data) {
            console.error('SSE getCampaign failed:', error?.message);
            return;
        }

        const activeEvents = (data.events ?? []).filter(
            (e) => e.status === EVENT_STATUS.ACTIVE,
        );
        const mapState = computeMapState(data.live, activeEvents);

        eventId++;
        const json = JSON.stringify({ data, mapState }, (_, v) =>
            typeof v === 'bigint' ? Number(v) : v,
        );
        this.cachedPayload = `id: ${eventId}\ndata: ${json}\n\n`;
    }

    _broadcast() {
        if (!this.cachedPayload) return;
        const encoder = new TextEncoder();
        const encoded = encoder.encode(this.cachedPayload);

        for (const client of this.clients) {
            const { error } = tryCatchSync(() => client.enqueue(encoded));
            if (error) {
                this.clients.delete(client);
                this._decrementIp(client._ip);
            }
        }
    }

    _startHeartbeat() {
        if (this.heartbeatTimer) return;
        const encoder = new TextEncoder();
        const keepalive = encoder.encode(':keepalive\n\n');

        this.heartbeatTimer = setInterval(() => {
            for (const client of this.clients) {
                const { error } = tryCatchSync(() => client.enqueue(keepalive));
                if (error) {
                    this.clients.delete(client);
                    this._decrementIp(client._ip);
                }
            }
        }, HEARTBEAT_INTERVAL_MS);
    }

    subscribe(controller, ip) {
        // Check limits
        if (this.clients.size >= MAX_CONNECTIONS) return false;
        const ipCount = this.ipCounts.get(ip) || 0;
        if (ipCount >= MAX_PER_IP) return false;

        // Track connection
        controller._ip = ip;
        this.clients.add(controller);
        this.ipCounts.set(ip, ipCount + 1);

        // Send current state immediately
        if (this.cachedPayload) {
            const encoder = new TextEncoder();
            const { error } = tryCatchSync(() =>
                controller.enqueue(encoder.encode(this.cachedPayload)),
            );
            if (error) {
                this.clients.delete(controller);
                this._decrementIp(ip);
                return false;
            }
        }

        return true;
    }

    unsubscribe(controller) {
        if (!this.clients.has(controller)) return;
        this.clients.delete(controller);
        this._decrementIp(controller._ip);
    }

    _decrementIp(ip) {
        if (!ip) return;
        const count = (this.ipCounts.get(ip) || 1) - 1;
        if (count <= 0) {
            this.ipCounts.delete(ip);
        } else {
            this.ipCounts.set(ip, count);
        }
    }

    _setupShutdown() {
        const shutdown = () => {
            this.shuttingDown = true;
            if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
            for (const client of this.clients) {
                tryCatchSync(() => client.close());
            }
            this.clients.clear();
            this.ipCounts.clear();
            if (this.listener) {
                this.listener.end().catch(() => {});
                this.listener = null;
            }
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }

    get clientCount() {
        return this.clients.size;
    }
}

// Synchronous tryCatch for controller operations that may throw
function tryCatchSync(fn) {
    try {
        const result = fn();
        return { data: result, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

// Singleton
const sseManager = globalThis.__sseManager || new SSEManager();
if (!globalThis.__sseManager) {
    globalThis.__sseManager = sseManager;
}

export default sseManager;
