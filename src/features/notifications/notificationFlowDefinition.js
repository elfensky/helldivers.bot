/**
 * Mermaid definition for the notification system flow diagram.
 * Same color conventions as the wiki (Real-Time.md).
 *
 * Two variants: LR (horizontal, desktop) and TD (vertical, mobile).
 */
const BODY = `
    %% Server
    worker["Worker Thread<br/><small>polls every 10-15s</small>"]
    update["Update Route<br/><small>/api/h1/update</small>"]
    notify["pg NOTIFY<br/><small>campaign_update</small>"]
    pushcheck["Push Notifier<br/><small>checkAndNotify()</small>"]

    %% Transport
    manager["SSE Manager<br/><small>LISTEN + broadcast</small>"]
    pushapi["Subscriptions<br/><small>push_subscription DB</small>"]

    %% Stream / Push delivery
    stream["SSE Stream<br/><small>/api/h1/stream</small>"]
    sw["Service Worker<br/><small>push handler</small>"]

    %% Client
    hook["useLiveData<br/><small>EventSource hook</small>"]

    %% Change Detection + Outputs
    detect["detectChanges<br/><small>client-side diff</small>"]
    toast["Sonner Toast<br/><small>persistent</small>"]
    webnoti["Web Notification<br/><small>leader tab only</small>"]

    %% SSE path
    worker -->|"HTTP"| update
    update -->|"SQL"| notify
    notify --> manager
    manager -->|"getCampaign"| stream
    stream -->|"EventSource"| hook
    hook -->|"diff"| detect

    %% Toast + Web Notification from detectChanges
    detect --> toast
    detect --> webnoti

    %% Push path (from Update Route)
    update -.-> pushcheck
    pushcheck -->|"web-push"| pushapi
    pushapi -->|"showNotification"| sw

    %% Styles matching wiki color conventions
    classDef server fill:#1c1b1b,stroke:#a855f7,color:#c084fc
    classDef database fill:#1c1b1b,stroke:#22c55e,color:#4ade80
    classDef transport fill:#1c1b1b,stroke:#3b82f6,color:#60a5fa
    classDef client fill:#1c1b1b,stroke:#06b6d4,color:#22d3ee
    classDef notification fill:#1c1b1b,stroke:#f59e0b,color:#fbbf24

    class worker,update,pushcheck server
    class notify,pushapi database
    class manager,stream transport
    class hook,detect client
    class toast,webnoti,sw notification
`;

/** Horizontal layout (desktop) */
export const DEFINITION_LR = `graph LR\n${BODY}`;

/** Vertical layout (mobile) */
export const DEFINITION_TD = `graph TD\n${BODY}`;
