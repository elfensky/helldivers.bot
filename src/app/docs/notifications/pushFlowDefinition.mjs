import { buildMermaidDefinition } from '@/shared/utils/diagram.mjs';

const BODY = `
    post_update["POST /api/h1/update"]
    check_notify["checkAndNotify()<br/><small>fire-and-forget, non-blocking</small>"]
    detect_changes["detectChanges()<br/><small>prevEvents vs currentEvents</small>"]
    query_subs["Query push_subscription<br/><small>table</small>"]
    web_push["web-push fan-out<br/><small>max 50 concurrent</small>"]
    sw_push["Service Worker<br/><small>push event handler</small>"]
    show_noti["showNotification()<br/><small>self.registration</small>"]

    post_update --> check_notify
    check_notify --> detect_changes
    detect_changes --> query_subs
    query_subs --> web_push
    web_push --> sw_push
    sw_push --> show_noti

    %% Styles matching docs color conventions
    classDef server fill:#1c1b1b,stroke:#a855f7,color:#c084fc
    classDef database fill:#1c1b1b,stroke:#22c55e,color:#4ade80
    classDef transport fill:#1c1b1b,stroke:#3b82f6,color:#60a5fa
    classDef notification fill:#1c1b1b,stroke:#f59e0b,color:#fbbf24

    class post_update,check_notify,detect_changes server
    class query_subs database
    class web_push transport
    class sw_push,show_noti notification
`;

export const { DEFINITION_LR, DEFINITION_TD } = buildMermaidDefinition(BODY);
