'use client';

import { useState, useCallback, useEffect } from 'react';
import '@/shared/components/DataFlowDiagram/DataFlowDiagram.css';

const VIEWS = [
    { key: 'all', label: 'All Flows' },
    { key: 'sse', label: 'SSE Live Data' },
    { key: 'toast', label: 'Toast Notifications' },
    { key: 'push', label: 'Push Notifications' },
];

const FLOW_MAP = {
    sse: ['sse'],
    toast: ['toast'],
    push: ['push'],
};

const LEGEND = [
    { color: '#a855f7', label: 'Server / Worker' },
    { color: '#22c55e', label: 'Database' },
    { color: '#3b82f6', label: 'Transport' },
    { color: '#06b6d4', label: 'Client' },
    { color: '#f59e0b', label: 'Notification' },
];

const DETAIL_DATA = {
    worker: {
        title: 'Worker Thread',
        subtitle: 'public/workers/cron.js',
        sections: [
            {
                type: 'text',
                content:
                    'Dedicated Worker Thread that polls the official Helldivers 1 API every 10-15 seconds. Calls POST /api/h1/update via HTTP to the main Next.js process.',
            },
            {
                type: 'table',
                headers: ['Setting', 'Value'],
                rows: [
                    ['Poll interval', 'UPDATE_INTERVAL env (default 20s)'],
                    ['Method', 'setTimeout (prevents overlap)'],
                    ['Auth', 'Bearer token (UPDATE_KEY)'],
                ],
            },
        ],
    },
    update: {
        title: 'Update Route',
        subtitle: 'src/app/api/h1/update/route.js',
        sections: [
            {
                type: 'text',
                content:
                    'API route that runs updateStatus() and updateSeason(). After successful DB writes, fires pg NOTIFY and triggers push notification check (fire-and-forget).',
            },
            { type: 'heading', content: 'Sequence' },
            {
                type: 'text',
                content:
                    '1. Validate bearer token\n2. updateStatus() → DB writes\n3. updateSeason() → snapshot sync\n4. pg NOTIFY campaign_update\n5. checkAndNotify() (async, non-blocking)',
            },
        ],
    },
    notify: {
        title: 'pg NOTIFY',
        subtitle: 'src/update/notifyClient.mjs',
        sections: [
            {
                type: 'text',
                content:
                    'Dedicated pg.Client (not Prisma) that fires NOTIFY campaign_update after each successful update cycle. This is how the update route tells the SSE manager that fresh data is available.',
            },
            {
                type: 'text',
                content:
                    "NOTIFY is a Postgres feature for inter-process messaging. It's lightweight (single SQL statement, <1ms) and doesn't go through Prisma since Prisma doesn't support LISTEN/NOTIFY.",
            },
        ],
    },
    manager: {
        title: 'SSE Manager',
        subtitle: 'src/shared/utils/sse/sseManager.mjs',
        sections: [
            {
                type: 'text',
                content:
                    'Singleton that holds a persistent LISTEN connection and manages all SSE client connections. On each NOTIFY, queries getCampaign() once, caches the result, and broadcasts to all connected clients.',
            },
            { type: 'heading', content: 'Features' },
            {
                type: 'table',
                headers: ['Feature', 'Detail'],
                rows: [
                    ['Heartbeat', ':keepalive every 15s'],
                    ['Dedup', 'Skip re-query within 1s window'],
                    ['Limits', '5 per IP, 500 total'],
                    ['Reconnect', 'Exponential backoff 1s→30s'],
                    ['Shutdown', 'SIGTERM closes all connections'],
                ],
            },
        ],
    },
    stream: {
        title: 'SSE Endpoint',
        subtitle: 'src/app/api/h1/stream/route.js',
        sections: [
            {
                type: 'text',
                content:
                    'Next.js Route Handler returning a ReadableStream with Content-Type: text/event-stream. No authentication required — serves the same public data as the homepage.',
            },
            {
                type: 'table',
                headers: ['Header', 'Value'],
                rows: [
                    ['Content-Type', 'text/event-stream'],
                    ['Cache-Control', 'no-cache, no-store'],
                    ['X-Accel-Buffering', 'no (nginx)'],
                ],
            },
        ],
    },
    hook: {
        title: 'useLiveData Hook',
        subtitle: 'src/shared/hooks/useLiveData.mjs',
        sections: [
            {
                type: 'text',
                content:
                    'Client hook that connects to the SSE stream via EventSource. Returns live data, map state, connection status, and previous data for change detection.',
            },
            { type: 'heading', content: 'First-Message Baseline' },
            {
                type: 'text',
                content:
                    'The first SSE message is treated as a silent state reset — no prevData is set. This prevents false toasts when the SSR snapshot is stale.',
            },
            { type: 'heading', content: 'Leader Election' },
            {
                type: 'text',
                content:
                    'BroadcastChannel elects one tab as the leader for Web Notifications. All tabs show Sonner toasts, but only the leader fires OS notifications.',
            },
        ],
    },
    detect: {
        title: 'Change Detection',
        subtitle: 'src/shared/utils/game/detectChanges.mjs',
        sections: [
            {
                type: 'text',
                content:
                    'Pure function that compares previous and current event arrays. Used by both client (LiveToasts) and server (pushNotifier).',
            },
            {
                type: 'table',
                headers: ['Transition', 'Detection'],
                rows: [
                    ['Campaign started', 'New event_id appears'],
                    ['Campaign won', 'active → success'],
                    ['Campaign lost', 'active → fail'],
                ],
            },
        ],
    },
    toast: {
        title: 'Sonner Toasts',
        subtitle: 'src/features/notifications/LiveToasts.jsx',
        sections: [
            {
                type: 'text',
                content:
                    'Fires persistent toast notifications (duration: Infinity) on event transitions. Styled with faction colors and the same glow animation as contested regions on the map.',
            },
            {
                type: 'table',
                headers: ['Property', 'Value'],
                rows: [
                    ['Duration', 'Infinite (until dismissed)'],
                    ['Accent', 'Right-side, faction color'],
                    ['Animation', 'card-glow pulse'],
                    ['Position', 'Bottom-right'],
                ],
            },
        ],
    },
    webnoti: {
        title: 'Web Notifications',
        subtitle: 'Browser Notification API',
        sections: [
            {
                type: 'text',
                content:
                    'Native browser notifications for backgrounded tabs. Only fires when document.hidden is true and permission is granted. Leader tab only (BroadcastChannel election).',
            },
        ],
    },
    pushcheck: {
        title: 'Push Notifier',
        subtitle: 'src/update/pushNotifier.mjs',
        sections: [
            {
                type: 'text',
                content:
                    'Server-side change detection that runs after each update cycle (fire-and-forget). Keeps previous events in memory and sends web-push notifications on transitions.',
            },
            {
                type: 'table',
                headers: ['Feature', 'Detail'],
                rows: [
                    ['Concurrency', 'Max 50 simultaneous pushes'],
                    ['Cleanup', 'Removes 410/404 subscriptions'],
                    ['Blocking', 'Non-blocking (async)'],
                    ['Reset', 'On server restart (ok)'],
                ],
            },
        ],
    },
    pushapi: {
        title: 'Subscription API',
        subtitle: 'src/app/api/notifications/subscribe/route.js',
        sections: [
            {
                type: 'text',
                content:
                    'POST to subscribe (upserts endpoint + keys), DELETE to unsubscribe. Validated with Zod: endpoint URL max 2048, keys base64 max 256.',
            },
        ],
    },
    sw: {
        title: 'Service Worker',
        subtitle: 'public/sw.js',
        sections: [
            {
                type: 'text',
                content:
                    'Handles push events (showNotification), app shell caching (stale-while-revalidate), and notification clicks (focus/open). Never intercepts /api/* or SSE stream.',
            },
        ],
    },
};

function getVisibilityClass(elementFlows, activeView) {
    if (activeView === 'all') return '';
    const activeFlows = FLOW_MAP[activeView] || [activeView];
    const flows = elementFlows.split(' ');
    return flows.some((f) => activeFlows.includes(f)) ? 'diagram-highlighted' : (
            'diagram-dimmed'
        );
}

function Node({
    x,
    y,
    w,
    h,
    id,
    flows,
    category,
    label,
    sublabel,
    activeView,
    onSelect,
}) {
    const vis = getVisibilityClass(flows, activeView);
    return (
        <g
            className={`diagram-node ${category} ${vis}`}
            tabIndex={0}
            role="button"
            aria-label={label}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(id);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(id);
                }
            }}
        >
            <rect x={x} y={y} width={w} height={h} rx={0} ry={0} />
            <text
                className="label"
                x={x + w / 2}
                y={y + (sublabel ? 20 : 24)}
                textAnchor="middle"
                fontSize={13}
                fontWeight={600}
            >
                {label}
            </text>
            {sublabel && (
                <text
                    x={x + w / 2}
                    y={y + 38}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#666"
                >
                    {sublabel}
                </text>
            )}
        </g>
    );
}

function Arrow({ d, flows, arrowClass, markerEnd, activeView, dashed }) {
    const vis = getVisibilityClass(flows, activeView);
    return (
        <path
            className={`diagram-arrow ${arrowClass} ${dashed ? 'arrow-dashed' : ''} ${vis}`}
            d={d}
            markerEnd={markerEnd}
        />
    );
}

function Annotation({ x, y, bgW, text, flows, activeView }) {
    const vis = getVisibilityClass(flows, activeView);
    return (
        <g className={vis}>
            <rect
                className="diagram-annotation-bg"
                x={x - bgW / 2}
                y={y - 11}
                width={bgW}
                height={16}
            />
            <text className="diagram-annotation" x={x} y={y} textAnchor="middle">
                {text}
            </text>
        </g>
    );
}

function DetailPanel({ nodeId, onClose }) {
    const data = DETAIL_DATA[nodeId];
    if (!data) return null;
    return (
        <>
            <div className="diagram-detail-backdrop" onClick={onClose} />
            <div className="diagram-detail-panel">
                <button
                    className="diagram-detail-close"
                    onClick={onClose}
                    aria-label="Close detail panel"
                >
                    &times;
                </button>
                <h3>{data.title}</h3>
                <div className="diagram-detail-subtitle">{data.subtitle}</div>
                {data.sections.map((section, i) => {
                    if (section.type === 'text')
                        return (
                            <p key={i} style={{ whiteSpace: 'pre-line' }}>
                                {section.content}
                            </p>
                        );
                    if (section.type === 'heading')
                        return (
                            <h4 key={i} className="diagram-detail-heading">
                                {section.content}
                            </h4>
                        );
                    if (section.type === 'table')
                        return (
                            <table key={i} className="diagram-schema-table">
                                <thead>
                                    <tr>
                                        {section.headers.map((h) => (
                                            <th key={h}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {section.rows.map((row, ri) => (
                                        <tr key={ri}>
                                            {row.map((cell, ci) => (
                                                <td key={ci}>{cell}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        );
                    return null;
                })}
            </div>
        </>
    );
}

export default function NotificationFlowDiagram() {
    const [activeView, setActiveView] = useState('all');
    const [selectedNode, setSelectedNode] = useState(null);

    const handleSelect = useCallback((id) => setSelectedNode(id), []);
    const handleClose = useCallback(() => setSelectedNode(null), []);

    useEffect(() => {
        if (!selectedNode) return;
        const handler = (e) => {
            if (e.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [selectedNode, handleClose]);

    const v = activeView;

    return (
        <div className="diagram-wrapper">
            <div className="diagram-controls">
                {VIEWS.map((view) => (
                    <button
                        key={view.key}
                        className={v === view.key ? 'active' : ''}
                        onClick={() => setActiveView(view.key)}
                    >
                        {view.label}
                    </button>
                ))}
            </div>

            <div className="diagram-canvas">
                <svg
                    className="diagram-flow"
                    viewBox="0 0 960 520"
                    role="img"
                    aria-label="Notification system data flow diagram"
                >
                    <title>Notification Flow Diagram</title>
                    <defs>
                        {[
                            { id: 'nah-purple', fill: '#a855f7' },
                            { id: 'nah-green', fill: '#22c55e' },
                            { id: 'nah-blue', fill: '#3b82f6' },
                            { id: 'nah-cyan', fill: '#06b6d4' },
                            { id: 'nah-amber', fill: '#f59e0b' },
                        ].map((m) => (
                            <marker
                                key={m.id}
                                id={m.id}
                                markerWidth={8}
                                markerHeight={6}
                                refX={8}
                                refY={3}
                                orient="auto"
                            >
                                <polygon points="0 0, 8 3, 0 6" fill={m.fill} />
                            </marker>
                        ))}
                    </defs>

                    {/* === ROW 1: Server === */}
                    <Node
                        x={20}
                        y={20}
                        w={140}
                        h={45}
                        id="worker"
                        flows="sse toast push"
                        category="cat-purple"
                        label="Worker Thread"
                        sublabel="polls every 10-15s"
                        activeView={v}
                        onSelect={handleSelect}
                    />
                    <Node
                        x={220}
                        y={20}
                        w={160}
                        h={45}
                        id="update"
                        flows="sse toast push"
                        category="cat-purple"
                        label="Update Route"
                        sublabel="/api/h1/update"
                        activeView={v}
                        onSelect={handleSelect}
                    />
                    <Node
                        x={440}
                        y={20}
                        w={120}
                        h={45}
                        id="notify"
                        flows="sse toast"
                        category="cat-green"
                        label="pg NOTIFY"
                        sublabel="campaign_update"
                        activeView={v}
                        onSelect={handleSelect}
                    />

                    {/* === ROW 2: SSE Manager === */}
                    <Node
                        x={440}
                        y={120}
                        w={160}
                        h={45}
                        id="manager"
                        flows="sse toast"
                        category="cat-blue"
                        label="SSE Manager"
                        sublabel="LISTEN + broadcast"
                        activeView={v}
                        onSelect={handleSelect}
                    />

                    {/* === ROW 3: Transport === */}
                    <Node
                        x={440}
                        y={220}
                        w={160}
                        h={45}
                        id="stream"
                        flows="sse toast"
                        category="cat-blue"
                        label="SSE Stream"
                        sublabel="/api/h1/stream"
                        activeView={v}
                        onSelect={handleSelect}
                    />

                    {/* === ROW 4: Client === */}
                    <Node
                        x={440}
                        y={320}
                        w={160}
                        h={45}
                        id="hook"
                        flows="sse toast"
                        category="cat-cyan"
                        label="useLiveData"
                        sublabel="EventSource hook"
                        activeView={v}
                        onSelect={handleSelect}
                    />

                    {/* === ROW 5: Change Detection === */}
                    <Node
                        x={440}
                        y={420}
                        w={160}
                        h={45}
                        id="detect"
                        flows="toast"
                        category="cat-cyan"
                        label="detectChanges"
                        sublabel="client-side diff"
                        activeView={v}
                        onSelect={handleSelect}
                    />

                    {/* === Notification outputs === */}
                    <Node
                        x={280}
                        y={420}
                        w={120}
                        h={45}
                        id="toast"
                        flows="toast"
                        category="cat-amber"
                        label="Sonner Toast"
                        sublabel="persistent"
                        activeView={v}
                        onSelect={handleSelect}
                    />
                    <Node
                        x={640}
                        y={420}
                        w={140}
                        h={45}
                        id="webnoti"
                        flows="toast"
                        category="cat-amber"
                        label="Web Notification"
                        sublabel="leader tab only"
                        activeView={v}
                        onSelect={handleSelect}
                    />

                    {/* === Push path (right side) === */}
                    <Node
                        x={700}
                        y={20}
                        w={140}
                        h={45}
                        id="pushcheck"
                        flows="push"
                        category="cat-purple"
                        label="Push Notifier"
                        sublabel="checkAndNotify()"
                        activeView={v}
                        onSelect={handleSelect}
                    />
                    <Node
                        x={700}
                        y={120}
                        w={140}
                        h={45}
                        id="pushapi"
                        flows="push"
                        category="cat-green"
                        label="Subscriptions"
                        sublabel="push_subscription DB"
                        activeView={v}
                        onSelect={handleSelect}
                    />
                    <Node
                        x={700}
                        y={220}
                        w={140}
                        h={45}
                        id="sw"
                        flows="push"
                        category="cat-amber"
                        label="Service Worker"
                        sublabel="push handler"
                        activeView={v}
                        onSelect={handleSelect}
                    />

                    {/* === SSE flow arrows === */}
                    <Arrow
                        d="M 160,42 L 218,42"
                        flows="sse toast push"
                        arrowClass="arrow-purple"
                        markerEnd="url(#nah-purple)"
                        activeView={v}
                    />
                    <Arrow
                        d="M 380,42 L 438,42"
                        flows="sse toast"
                        arrowClass="arrow-green"
                        markerEnd="url(#nah-green)"
                        activeView={v}
                    />
                    <Arrow
                        d="M 520,65 L 520,118"
                        flows="sse toast"
                        arrowClass="arrow-blue"
                        markerEnd="url(#nah-blue)"
                        activeView={v}
                    />
                    <Arrow
                        d="M 520,165 L 520,218"
                        flows="sse toast"
                        arrowClass="arrow-blue"
                        markerEnd="url(#nah-blue)"
                        activeView={v}
                    />
                    <Arrow
                        d="M 520,265 L 520,318"
                        flows="sse toast"
                        arrowClass="arrow-cyan"
                        markerEnd="url(#nah-cyan)"
                        activeView={v}
                    />
                    <Arrow
                        d="M 520,365 L 520,418"
                        flows="toast"
                        arrowClass="arrow-cyan"
                        markerEnd="url(#nah-cyan)"
                        activeView={v}
                    />

                    {/* Toast + Web Notification arrows from detectChanges */}
                    <Arrow
                        d="M 440,442 L 402,442"
                        flows="toast"
                        arrowClass="arrow-amber"
                        markerEnd="url(#nah-amber)"
                        activeView={v}
                    />
                    <Arrow
                        d="M 600,442 L 638,442"
                        flows="toast"
                        arrowClass="arrow-amber"
                        markerEnd="url(#nah-amber)"
                        activeView={v}
                    />

                    {/* Push path arrows */}
                    <Arrow
                        d="M 380,52 L 380,52 Q 660,52 698,42"
                        flows="push"
                        arrowClass="arrow-purple"
                        markerEnd="url(#nah-purple)"
                        activeView={v}
                        dashed
                    />
                    <Arrow
                        d="M 770,65 L 770,118"
                        flows="push"
                        arrowClass="arrow-green"
                        markerEnd="url(#nah-green)"
                        activeView={v}
                    />
                    <Arrow
                        d="M 770,165 L 770,218"
                        flows="push"
                        arrowClass="arrow-amber"
                        markerEnd="url(#nah-amber)"
                        activeView={v}
                    />

                    {/* Annotations */}
                    <Annotation
                        x={190}
                        y={35}
                        bgW={48}
                        text="HTTP"
                        flows="sse toast push"
                        activeView={v}
                    />
                    <Annotation
                        x={410}
                        y={35}
                        bgW={48}
                        text="SQL"
                        flows="sse toast"
                        activeView={v}
                    />
                    <Annotation
                        x={540}
                        y={93}
                        bgW={80}
                        text="getCampaign"
                        flows="sse toast"
                        activeView={v}
                    />
                    <Annotation
                        x={540}
                        y={193}
                        bgW={56}
                        text="stream"
                        flows="sse toast"
                        activeView={v}
                    />
                    <Annotation
                        x={540}
                        y={293}
                        bgW={80}
                        text="EventSource"
                        flows="sse toast"
                        activeView={v}
                    />
                    <Annotation
                        x={540}
                        y={393}
                        bgW={48}
                        text="diff"
                        flows="toast"
                        activeView={v}
                    />
                    <Annotation
                        x={792}
                        y={93}
                        bgW={70}
                        text="web-push"
                        flows="push"
                        activeView={v}
                    />
                    <Annotation
                        x={792}
                        y={193}
                        bgW={88}
                        text="showNotification"
                        flows="push"
                        activeView={v}
                    />
                </svg>
            </div>

            {/* Legend */}
            <div
                style={{
                    display: 'flex',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    padding: '0.5rem 0',
                    fontSize: '12px',
                }}
            >
                {LEGEND.map((l) => (
                    <span
                        key={l.label}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                        <span
                            style={{
                                width: 10,
                                height: 10,
                                background: l.color,
                                display: 'inline-block',
                            }}
                        />
                        {l.label}
                    </span>
                ))}
            </div>

            {selectedNode && <DetailPanel nodeId={selectedNode} onClose={handleClose} />}
        </div>
    );
}
