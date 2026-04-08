/**
 * Mermaid definition for the data flow architecture diagram.
 * Same color conventions as the docs (/docs/architecture).
 * Node IDs use underscores (Mermaid treats hyphens as minus operators).
 *
 * Two variants: LR (horizontal, desktop) and TD (vertical, mobile).
 */
const BODY = `
    subgraph Sources["DATA SOURCES"]
        api_status["get_campaign_status<br/><small>Live war state + stats</small>"]
        api_snapshot["get_snapshots<br/><small>Historical time-series</small>"]
        seed_files["prisma/seed/seasons/*.json<br/><small>Bootstrap (first deploy)</small>"]
        api_refresh["get_snapshots (forced)<br/><small>Re-fetch any season</small>"]
    end

    subgraph Processing["PROCESSING"]
        worker["Worker Thread<br/><small>cron.js — setTimeout loop<br/>poll > validate > upsert</small>"]
        seed_script["Seed Script<br/><small>prisma db seed / startup</small>"]
        refresh_handler["updateSeason()<br/><small>fetch + validate + upsert</small>"]
    end

    subgraph Raw["RAW CACHE"]
        rb_status["rebroadcast_status<br/><small>1 row/season — raw JSON</small>"]
        rb_snapshot["rebroadcast_snapshot<br/><small>1 row/season — raw JSON</small>"]
    end

    subgraph Normalized["NORMALIZED TABLES"]
        h1_season["h1_season"]
        h1_live["h1_live<br/><small>campaigns + stats + map</small>"]
        h1_event["h1_event"]
        h1_intro["h1_introduction_order"]
        h1_points["h1_points_max"]
    end

    subgraph Frontend["FRONTEND"]
        fe_live["Live Dashboard<br/><small>map + stats + players</small>"]
        fe_events["Event Alerts<br/><small>active defend/attack</small>"]
    end

    %% Sources → Processing
    api_status -->|"5-15s"| worker
    api_snapshot -->|"~1h"| worker
    seed_files -->|"once"| seed_script
    api_refresh -->|"on demand"| refresh_handler

    %% Processing → Raw Cache
    worker --> rb_status
    worker --> rb_snapshot

    %% Worker → Normalized
    worker --> h1_season
    worker --> h1_live
    worker --> h1_event
    worker --> h1_intro
    worker --> h1_points

    %% Seed → Normalized
    seed_script --> h1_season
    seed_script -.-> h1_event
    seed_script -.-> h1_intro
    seed_script -.-> h1_points

    %% Refresh → Raw + Normalized
    refresh_handler --> rb_snapshot
    refresh_handler --> h1_season
    refresh_handler --> h1_event
    refresh_handler --> h1_intro
    refresh_handler --> h1_points

    %% DB → Frontend
    h1_live -->|"read"| fe_live
    h1_event -->|"read"| fe_events

    %% Styles matching wiki color conventions
    classDef api fill:#1c1b1b,stroke:#3b82f6,color:#60a5fa
    classDef processing fill:#1c1b1b,stroke:#a855f7,color:#c084fc
    classDef raw fill:#1c1b1b,stroke:#f59e0b,color:#fbbf24
    classDef norm fill:#1c1b1b,stroke:#22c55e,color:#4ade80
    classDef seed fill:#1c1b1b,stroke:#ec4899,color:#f472b6
    classDef frontend fill:#1c1b1b,stroke:#06b6d4,color:#22d3ee

    class api_status,api_snapshot,api_refresh api
    class worker processing
    class rb_status,rb_snapshot raw
    class h1_season,h1_live,h1_event,h1_intro,h1_points norm
    class seed_files,seed_script seed
    class fe_live,fe_events frontend
    class refresh_handler api

    style Sources fill:#131313,stroke:#3b82f6,color:#60a5fa
    style Processing fill:#131313,stroke:#a855f7,color:#c084fc
    style Raw fill:#131313,stroke:#f59e0b,color:#fbbf24
    style Normalized fill:#131313,stroke:#22c55e,color:#4ade80
    style Frontend fill:#131313,stroke:#06b6d4,color:#22d3ee
`;

/** Horizontal layout (desktop) */
export const DEFINITION_LR = `graph LR\n${BODY}`;

/** Vertical layout (mobile) */
export const DEFINITION_TD = `graph TD\n${BODY}`;
