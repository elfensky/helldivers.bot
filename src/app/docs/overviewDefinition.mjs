import { buildMermaidDefinition } from '@/app/docs/_diagram.mjs';

const BODY = `
    subgraph Frontend["FRONTEND"]
        dash["Dashboard<br/><small>Live campaign view</small>"]
        archives["/archives<br/><small>War history</small>"]
        profile["/profile<br/><small>Account & API keys</small>"]
        docs["/docs<br/><small>Documentation</small>"]
    end

    subgraph Backend["BACKEND"]
        api_live["/api/h1/live<br/><small>Polling endpoint</small>"]
        api_rb["/api/h1/rebroadcast<br/><small>API proxy</small>"]
        api_update["/api/h1/update<br/><small>Worker trigger</small>"]
        auth_api["/api/auth/*<br/><small>BetterAuth OAuth</small>"]
    end

    subgraph Data["DATA LAYER"]
        worker["Worker Thread<br/><small>Polls every 10-20s</small>"]
        db[("PostgreSQL<br/><small>Prisma 7</small>")]
        hd1["Official HD1 API<br/><small>api.helldiversgame.com</small>"]
    end

    dash -->|"poll 10s"| api_live
    api_live --> db
    worker -->|"setTimeout loop"| api_update
    api_update --> db
    worker --> hd1

    %% Styles matching wiki color conventions
    classDef frontend fill:#1c1b1b,stroke:#a855f7,color:#c084fc
    classDef backend fill:#1c1b1b,stroke:#22c55e,color:#4ade80
    classDef data fill:#1c1b1b,stroke:#f59e0b,color:#fbbf24

    class dash,archives,profile,docs frontend
    class api_live,api_rb,api_update,auth_api backend
    class worker,db,hd1 data

    style Frontend fill:#131313,stroke:#a855f7,color:#c084fc
    style Backend fill:#131313,stroke:#22c55e,color:#4ade80
    style Data fill:#131313,stroke:#f59e0b,color:#fbbf24
`;

export const { DEFINITION_LR, DEFINITION_TD } = buildMermaidDefinition(BODY);
