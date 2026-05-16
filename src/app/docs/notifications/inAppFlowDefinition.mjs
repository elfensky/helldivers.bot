import { buildMermaidDefinition } from '@/shared/utils/diagram.mjs';

const BODY = `
    %% Server write path
    hd1_api["Official HD1 API<br/><small>~1s updates</small>"]
    worker["Worker Thread<br/><small>polls every ~20s</small>"]
    post_update["POST /api/h1/update"]
    update_status["updateStatus()<br/><small>DB writes: h1_status, h1_event, h1_statistic</small>"]

    %% Client poll path
    poll["Client poll<br/><small>every 10s via setInterval</small>"]
    live_api["GET /api/h1/live"]
    get_campaign["getCampaign() + computeMapState()<br/><small>JSON response</small>"]
    hook["useLiveData hook<br/><small>fetch + state replacement</small>"]
    rerender["React re-render"]
    detect_changes["detectChanges<br/><small>client-side diff</small>"]

    %% Notification outputs
    sonner_toast["Sonner Toast<br/><small>always</small>"]
    web_noti["Web Notification<br/><small>tab hidden + leader + permission</small>"]

    %% Server write flow
    hd1_api --> worker
    worker --> post_update
    post_update --> update_status

    %% Client poll flow
    poll --> live_api
    live_api --> get_campaign
    get_campaign --> hook
    hook --> rerender
    rerender --> detect_changes
    detect_changes --> sonner_toast
    detect_changes --> web_noti

    %% Styles matching docs color conventions
    classDef source fill:#1c1b1b,stroke:#3b82f6,color:#60a5fa
    classDef server fill:#1c1b1b,stroke:#a855f7,color:#c084fc
    classDef database fill:#1c1b1b,stroke:#22c55e,color:#4ade80
    classDef transport fill:#1c1b1b,stroke:#3b82f6,color:#60a5fa
    classDef client fill:#1c1b1b,stroke:#06b6d4,color:#22d3ee
    classDef notification fill:#1c1b1b,stroke:#f59e0b,color:#fbbf24

    class hd1_api source
    class worker,post_update,update_status server
    class poll,live_api,get_campaign transport
    class hook,rerender,detect_changes client
    class sonner_toast,web_noti notification
`;

export const { DEFINITION_LR, DEFINITION_TD } = buildMermaidDefinition(BODY);
