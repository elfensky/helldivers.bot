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
        api_snapshot["get_snapshots<br/><small>Historical snapshots (current + backfill)</small>"]
        seed_files["prisma/seed/seasons/*.json<br/><small>Bootstrap (first deploy)</small>"]
    end

    subgraph Processing["PROCESSING"]
        worker["Worker Thread<br/><small>cron.js — setTimeout loop<br/>poll > validate > bucket-upsert</small>"]
        seed_script["Seed Script<br/><small>prisma db seed / startup</small>"]
    end

    subgraph Normalized["NORMALIZED TABLES (5)"]
        h1_season["h1_season<br/><small>per-season metadata + intro_order[] + points_max[]</small>"]
        h1_status["h1_status<br/><small>bucketed campaign timeseries</small>"]
        h1_statistic["h1_statistic<br/><small>bucketed stats timeseries</small>"]
        h1_event["h1_event<br/><small>current event state (mutable)</small>"]
        h1_event_progress["h1_event_progress<br/><small>bucketed event progression</small>"]
    end

    subgraph Frontend["FRONTEND"]
        fe_live["Live Dashboard<br/><small>latest bucket per faction</small>"]
        fe_archives["Archives<br/><small>full timeseries</small>"]
        fe_rebroadcast["Rebroadcast API<br/><small>reconstructed wire format</small>"]
    end

    %% Sources → Processing
    api_status -->|"~15s"| worker
    api_snapshot -->|"~15s + on demand"| worker
    seed_files -->|"once"| seed_script

    %% Processing → Normalized
    worker --> h1_season
    worker --> h1_status
    worker --> h1_statistic
    worker --> h1_event
    worker --> h1_event_progress
    seed_script --> h1_season
    seed_script --> h1_status
    seed_script --> h1_event

    %% DB → Frontend
    h1_status -->|"latest bucket"| fe_live
    h1_event -->|"active events"| fe_live
    h1_season -->|"arrays"| fe_live
    h1_status -->|"full history"| fe_archives
    h1_event -->|"all events"| fe_archives
    h1_event_progress -->|"progression"| fe_archives
    h1_season -->|"reconstruct"| fe_rebroadcast
    h1_status -->|"reconstruct"| fe_rebroadcast
    h1_statistic -->|"reconstruct"| fe_rebroadcast
    h1_event -->|"reconstruct"| fe_rebroadcast

    %% Styles
    classDef api fill:#1c1b1b,stroke:#3b82f6,color:#60a5fa
    classDef processing fill:#1c1b1b,stroke:#a855f7,color:#c084fc
    classDef norm fill:#1c1b1b,stroke:#22c55e,color:#4ade80
    classDef seed fill:#1c1b1b,stroke:#ec4899,color:#f472b6
    classDef frontend fill:#1c1b1b,stroke:#06b6d4,color:#22d3ee

    class api_status,api_snapshot api
    class worker processing
    class h1_season,h1_status,h1_statistic,h1_event,h1_event_progress norm
    class seed_files,seed_script seed
    class fe_live,fe_archives,fe_rebroadcast frontend

    style Sources fill:#131313,stroke:#3b82f6,color:#60a5fa
    style Processing fill:#131313,stroke:#a855f7,color:#c084fc
    style Normalized fill:#131313,stroke:#22c55e,color:#4ade80
    style Frontend fill:#131313,stroke:#06b6d4,color:#22d3ee
`;

/** Horizontal layout (desktop) */
export const DEFINITION_LR = `graph LR\n${BODY}`;

/** Vertical layout (mobile) */
export const DEFINITION_TD = `graph TD\n${BODY}`;
