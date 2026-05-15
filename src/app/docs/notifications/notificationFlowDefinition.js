import { buildMermaidDefinition } from './buildMermaidDefinition';

const BODY = `
    %% Server
    worker["Worker Thread<br/><small>polls every ~20s</small>"]
    update["Update Route<br/><small>/api/h1/update</small>"]
    pushcheck["Push Notifier<br/><small>checkAndNotify()</small>"]

    %% Transport
    live["Live Endpoint<br/><small>GET /api/h1/live</small>"]
    pushapi["Subscriptions<br/><small>push_subscription DB</small>"]

    %% Push delivery
    sw["Service Worker<br/><small>Serwist + push handler</small>"]

    %% Client
    hook["useLiveData<br/><small>polling hook (10s)</small>"]

    %% Change Detection + Outputs
    detect["detectChanges<br/><small>client-side diff</small>"]
    toast["Sonner Toast<br/><small>persistent</small>"]
    webnoti["Web Notification<br/><small>leader tab only</small>"]

    %% Server: worker writes to DB
    worker -->|"HTTP"| update
    update -->|"DB write"| db[("Database")]

    %% Client: polls live endpoint which reads from DB
    hook -->|"fetch 10s"| live
    live -->|"getCampaign"| db
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
    class db,pushapi database
    class live transport
    class hook,detect client
    class toast,webnoti,sw notification
`;

export const { DEFINITION_LR, DEFINITION_TD } = buildMermaidDefinition(BODY);
