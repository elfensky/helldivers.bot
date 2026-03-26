# Database Schema Reference

**Project:** helldivers.bot
**Schema file:** `prisma/schema.prisma`
**Last reviewed:** 2026-03-26

This document is the canonical reference for the PostgreSQL schema managed by Prisma. It covers every model, field, constraint, and index. Cross-references to data flow and API behaviour are noted inline.

---

## Table of Contents

1. [Schema Configuration](#1-schema-configuration)
2. [Entity Relationship Diagram](#2-entity-relationship-diagram)
3. [Game Data Models](#3-game-data-models)
    - [h1_season](#h1_season)
    - [h1_introduction_order](#h1_introduction_order)
    - [h1_points_max](#h1_points_max)
    - [h1_snapshot](#h1_snapshot)
    - [h1_event](#h1_event)
    - [h1_event_snapshot](#h1_event_snapshot)
    - [h1_live](#h1_live)
    - [h1_live_snapshot](#h1_live_snapshot)
4. [Rebroadcast Models](#4-rebroadcast-models)
    - [rebroadcast_status](#rebroadcast_status)
    - [rebroadcast_snapshot](#rebroadcast_snapshot)
5. [Auth and User Models](#5-auth-and-user-models)
    - [User](#user)
    - [Account](#account)
    - [Session](#session)
    - [VerificationToken](#verificationtoken)
    - [Authenticator](#authenticator)
    - [Settings](#settings)
    - [Review](#review)
    - [ApiKey](#apikey)
6. [App Configuration Model](#6-app-configuration-model)
7. [Index and Constraint Summary](#7-index-and-constraint-summary)

---

## 1. Schema Configuration

Prisma 7 separates schema definition from connection configuration. The schema file (`prisma/schema.prisma`) defines the provider and generator. The connection URL lives in `prisma.config.mjs`.

### Schema file

```prisma
datasource db {
    provider = "postgresql"
}

generator client {
    provider = "prisma-client"
    output   = "../src/generated/prisma"
}
```

| Setting       | Value                     | Notes                                                            |
| ------------- | ------------------------- | ---------------------------------------------------------------- |
| Provider      | `postgresql`              | Connection URL configured externally in `prisma.config.mjs`      |
| Generator     | `prisma-client`           | Prisma 7 standard generator (replaces legacy `prisma-client-js`) |
| Client output | `../src/generated/prisma` | Import path: `@/generated/prisma/client`                         |

### Connection configuration (`prisma.config.mjs`)

```js
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: { path: 'prisma/migrations' },
    datasource: { url: env('POSTGRES_URL') },
});
```

This file is read by the Prisma CLI for migrations and introspection. The `dotenv/config` import loads `.env` for local CLI usage; in Docker, `POSTGRES_URL` is injected as a real environment variable.

### Runtime client (`src/db/db.js`)

Prisma 7 requires a JavaScript driver adapter instead of the Rust query engine. The project uses `@prisma/adapter-pg` (which bundles `pg` internally):

```js
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prismaClientSingleton = () => {
    const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
    return new PrismaClient({ adapter });
};
```

The singleton pattern caches the client on `globalThis.prismaGlobal` to survive Next.js hot reloads in development.

---

## 2. Entity Relationship Diagram

```mermaid
erDiagram
    h1_season ||--o| h1_introduction_order : "OneSeasonToOneIntroductionOrder"
    h1_season ||--o| h1_points_max : "OneSeasonToOnePointsMax"
    h1_season ||--o{ h1_snapshot : "OneSeasonToManySnapshots"
    h1_season ||--o{ h1_event : "OneSeasonToManyEvents"
    h1_season ||--o{ h1_live : "OneSeasonToManyLive"
    h1_season ||--o{ h1_live_snapshot : "OneSeasonToManyLiveSnapshots"
    h1_season ||--o{ h1_event_snapshot : "OneSeasonToManyEventSnapshots"
    h1_event ||--o{ h1_event_snapshot : "OneEventToManySnapshots"

    h1_season {
        String   id           PK
        DateTime last_updated "nullable"
        Int      season       UK
    }

    h1_introduction_order {
        String id    PK
        Int    season FK-UK
        Int[]  order
    }

    h1_points_max {
        String id     PK
        Int    season FK-UK
        Int[]  points
    }

    h1_snapshot {
        String id     PK
        Int    season FK
        Int    time
        Json   data
    }

    h1_event {
        String id       PK
        Int    season   FK
        String type
        Int    event_id
        Int    region
        String status
    }

    h1_event_snapshot {
        String id       PK
        Int    season   FK
        String type
        Int    event_id FK
        Int    time
        Int    points
        Int    points_max
    }

    h1_live {
        String id     PK
        Int    season FK
        Int    enemy
        Int    points
        String status
        Json   map    "nullable"
    }

    h1_live_snapshot {
        String id     PK
        Int    season FK
        Int    time
        Int    enemy
        BigInt deaths
        BigInt kills
    }

    rebroadcast_status {
        String   id           PK
        Int      season       UK
        DateTime last_updated
        Json     json
    }

    rebroadcast_snapshot {
        String   id           PK
        Int      season       UK
        DateTime last_updated
        Json     json
    }

    User ||--o{ Account : "accounts"
    User ||--o{ Session : "sessions"
    User ||--o{ Authenticator : "Authenticator"
    User ||--o| Settings : "settings"
    User ||--o{ Review : "reviews"
    User ||--o{ ApiKey : "apiKeys"

    User {
        String   id            PK
        String   username      UK
        String   email         UK
        String   role
        DateTime createdAt
        DateTime updatedAt
    }

    Account {
        String id               PK
        String userId           FK-UK
        String provider
        String providerAccountId
    }

    Session {
        String   id           PK
        String   sessionToken UK
        String   userId       FK
        DateTime expires
    }

    VerificationToken {
        String   identifier
        String   token
        DateTime expires
    }

    Authenticator {
        String  credentialID UK
        String  userId       FK
    }

    Settings {
        String userId PK-FK
        Json   settings
    }

    Review {
        String  id        PK
        String  authorId  FK
        Boolean published
    }

    ApiKey {
        String  id      PK
        String  hash    UK
        String  userId  FK
        Boolean enabled
    }

    App {
        String id             PK
        String version
        Int    active_season
    }
```

> `rebroadcast_status` and `rebroadcast_snapshot` link to game seasons via the `season` integer field but carry **no Prisma-level foreign key** to `h1_season`. They are intentionally independent: they can be written before an `h1_season` row exists, and they store raw API responses regardless of normalisation state.

---

## 3. Game Data Models

### h1_season

The root anchor for all game data. Every normalised game table points back to this row via `season` (the integer game season number, not the surrogate `id`).

| Field          | Prisma Type | PostgreSQL Type | Constraints / Notes                                                                                                                                                           |
| -------------- | ----------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | `String`    | `TEXT`          | `@id @default(uuid(7))` — surrogate PK, UUIDv7                                                                                                                                |
| `last_updated` | `DateTime?` | `TIMESTAMPTZ`   | Nullable. `null` means the season row was pre-seeded but has not yet received a successful data update. Set to the current timestamp at the end of a successful update cycle. |
| `season`       | `Int`       | `INTEGER`       | `@unique` — the game season number. Used as the FK target by all child tables.                                                                                                |

**Indexes:**

| Index                     | Fields       |
| ------------------------- | ------------ |
| `@@index([season])`       | season       |
| `@@index([last_updated])` | last_updated |

**Relations (outbound):**

| Relation name                     | Target model            | Cardinality           |
| --------------------------------- | ----------------------- | --------------------- |
| `OneSeasonToOneIntroductionOrder` | `h1_introduction_order` | one-to-one (optional) |
| `OneSeasonToOnePointsMax`         | `h1_points_max`         | one-to-one (optional) |
| `OneSeasonToManySnapshots`        | `h1_snapshot`           | one-to-many           |
| `OneSeasonToManyEvents`           | `h1_event`              | one-to-many           |
| `OneSeasonToManyLive`             | `h1_live`               | one-to-many           |
| `OneSeasonToManyLiveSnapshots`    | `h1_live_snapshot`      | one-to-many           |
| `OneSeasonToManyEventSnapshots`   | `h1_event_snapshot`     | one-to-many           |

**Design note:** Child tables reference `season` (Int) rather than the surrogate `id` (UUID). This keeps foreign keys human-readable, avoids UUID joins in queries that filter by season number, and matches the season integer used in the official API response.

---

### h1_introduction_order

One row per season. Stores the ordered list of planets (by their integer identifiers) for that season.

| Field    | Prisma Type | PostgreSQL Type | Constraints / Notes                                                                                                        |
| -------- | ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`     | `String`    | `TEXT`          | `@id @default(uuid(7))`                                                                                                    |
| `season` | `Int`       | `INTEGER`       | `@unique` FK → `h1_season.season`. The `@unique` constraint is what enforces the one-to-one relationship with `h1_season`. |
| `order`  | `Int[]`     | `INTEGER[]`     | Native PostgreSQL integer array. The ordered sequence of `introduction_order` values for all planets in this season.       |

**Indexes:**

| Index               | Fields |
| ------------------- | ------ |
| `@@index([season])` | season |

---

### h1_points_max

One row per season. Stores the maximum liberation points for each planet in the season.

| Field    | Prisma Type | PostgreSQL Type | Constraints / Notes                                                                                  |
| -------- | ----------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| `id`     | `String`    | `TEXT`          | `@id @default(uuid(7))`                                                                              |
| `season` | `Int`       | `INTEGER`       | `@unique` FK → `h1_season.season`. Enforces one-to-one with `h1_season`.                             |
| `points` | `Int[]`     | `INTEGER[]`     | Native PostgreSQL integer array. Each index position corresponds to a planet's `introduction_order`. |

**Indexes:**

| Index               | Fields |
| ------------------- | ------ |
| `@@index([season])` | season |

---

### h1_snapshot

Historical time-series data. Each row is a point-in-time snapshot of campaign state for a season, keyed by the original Unix timestamp from the API.

| Field    | Prisma Type | PostgreSQL Type | Constraints / Notes                                                                                       |
| -------- | ----------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `id`     | `String`    | `TEXT`          | `@id @default(uuid(7))`                                                                                   |
| `season` | `Int`       | `INTEGER`       | FK → `h1_season.season`                                                                                   |
| `time`   | `Int`       | `INTEGER`       | Unix timestamp as returned by the official API. Used as the natural deduplication key alongside `season`. |
| `data`   | `Json`      | `JSONB`         | Parsed and structured snapshot data.                                                                      |

**Constraints:**

| Type       | Fields           | Notes                                                           |
| ---------- | ---------------- | --------------------------------------------------------------- |
| `@@unique` | `[season, time]` | Prevents duplicate snapshots for the same timestamp in a season |
| `@@index`  | `[season]`       | Supports fetching all snapshots for a season                    |

---

### h1_event

A unified table that holds both attack and defend events in a single model. The `type` column discriminates between the two event kinds, eliminating the need for UNION queries across separate tables.

| Field              | Prisma Type | PostgreSQL Type | Constraints / Notes                                                                                                       |
| ------------------ | ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`               | `String`    | `TEXT`          | `@id @default(uuid(7))`                                                                                                   |
| `season`           | `Int`       | `INTEGER`       | FK → `h1_season.season`                                                                                                   |
| `type`             | `String`    | `TEXT`          | `"attack"` or `"defend"` — discriminator column                                                                           |
| `event_id`         | `Int`       | `INTEGER`       | Official API event identifier                                                                                             |
| `start_time`       | `Int`       | `INTEGER`       | Unix timestamp                                                                                                            |
| `end_time`         | `Int`       | `INTEGER`       | Unix timestamp                                                                                                            |
| `region`           | `Int`       | `INTEGER`       | Actual region integer for defend events. Sentinel value `11` for attack events (attack events have no region in the API). |
| `enemy`            | `Int`       | `INTEGER`       | Enemy faction identifier                                                                                                  |
| `points_max`       | `Int`       | `INTEGER`       |                                                                                                                           |
| `points`           | `Int`       | `INTEGER`       |                                                                                                                           |
| `status`           | `String`    | `TEXT`          | `"active"`, `"success"`, or `"fail"`                                                                                      |
| `players_at_start` | `Int?`      | `INTEGER`       | Nullable. Player count when the event started. May be unavailable for older events.                                       |

**Constraints and indexes:**

| Type       | Fields             | Notes                                                              |
| ---------- | ------------------ | ------------------------------------------------------------------ |
| `@@unique` | `[type, event_id]` | Compound unique — event IDs are unique within a type               |
| `@@index`  | `[season, type]`   | Filter events by type within a season                              |
| `@@index`  | `[season, status]` | Filter events by status within a season (e.g., active events only) |
| `@@index`  | `[season, enemy]`  | Filter events by enemy faction within a season                     |

**Relations:**

| Relation name             | Target model        | Cardinality |
| ------------------------- | ------------------- | ----------- |
| `OneSeasonToManyEvents`   | `h1_season`         | many-to-one |
| `OneEventToManySnapshots` | `h1_event_snapshot` | one-to-many |

---

### h1_event_snapshot

Time-series point data for individual events. Each row captures the `points` and `points_max` of an event at a specific timestamp, enabling progress-over-time visualisations. Links to `h1_event` via the compound `(type, event_id)` key and to `h1_season` via `season`.

| Field        | Prisma Type | PostgreSQL Type | Constraints / Notes                                                   |
| ------------ | ----------- | --------------- | --------------------------------------------------------------------- |
| `id`         | `String`    | `TEXT`          | `@id @default(uuid(7))`                                               |
| `season`     | `Int`       | `INTEGER`       | Denormalised FK → `h1_season.season` for efficient per-season queries |
| `type`       | `String`    | `TEXT`          | `"attack"` or `"defend"` — part of FK to `h1_event`                   |
| `event_id`   | `Int`       | `INTEGER`       | Part of FK to `h1_event` via `(type, event_id)`                       |
| `time`       | `Int`       | `INTEGER`       | Unix timestamp from API response                                      |
| `points`     | `Int`       | `INTEGER`       | Event progress at this timestamp                                      |
| `points_max` | `Int`       | `INTEGER`       | Maximum points for the event at this timestamp                        |

**Constraints and indexes:**

| Type       | Fields                   | Notes                                   |
| ---------- | ------------------------ | --------------------------------------- |
| `@@unique` | `[type, event_id, time]` | One snapshot per event per timestamp    |
| `@@index`  | `[season, time]`         | Range queries by season and time window |
| `@@index`  | `[event_id, time]`       | Fetch time-series for a specific event  |

**Relations:**

| Relation name                   | Target model | Cardinality |
| ------------------------------- | ------------ | ----------- |
| `OneEventToManySnapshots`       | `h1_event`   | many-to-one |
| `OneSeasonToManyEventSnapshots` | `h1_season`  | many-to-one |

---

### h1_live

Current live state for a faction within a season. Combines campaign status (points, status) with aggregate statistics (kills, missions, etc.) in a single denormalised row. One row per `(season, enemy)` pair.

| Field                      | Prisma Type | PostgreSQL Type | Constraints / Notes                                                                                  |
| -------------------------- | ----------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| `id`                       | `String`    | `TEXT`          | `@id @default(uuid(7))`                                                                              |
| `season`                   | `Int`       | `INTEGER`       | FK → `h1_season.season` (relation is optional in Prisma — `h1_season?` — but `season` is always set) |
| `enemy`                    | `Int`       | `INTEGER`       | Enemy faction identifier: `0` = Bugs, `1` = Cyborgs, `2` = Illuminate                                |
| `points`                   | `Int`       | `INTEGER`       | Current liberation points                                                                            |
| `points_taken`             | `Int`       | `INTEGER`       | Points taken by the enemy                                                                            |
| `points_max`               | `Int`       | `INTEGER`       | Maximum points for this faction                                                                      |
| `status`                   | `String`    | `TEXT`          | Enum-like: `"active"`, `"defeated"`, `"hidden"`                                                      |
| `introduction_order`       | `Int`       | `INTEGER`       | War-entry position (`0`, `1`, `2`, `255`)                                                            |
| `season_duration`          | `Int`       | `INTEGER`       | Total duration of the season in seconds                                                              |
| `players`                  | `Int`       | `INTEGER`       | Active players during measurement window                                                             |
| `total_unique_players`     | `Int`       | `INTEGER`       | Unique players across the season                                                                     |
| `missions`                 | `Int`       | `INTEGER`       | Total missions attempted                                                                             |
| `successful_missions`      | `Int`       | `INTEGER`       |                                                                                                      |
| `total_mission_difficulty` | `Int`       | `INTEGER`       | Sum of difficulty values across all missions                                                         |
| `completed_planets`        | `Int`       | `INTEGER`       |                                                                                                      |
| `defend_events`            | `Int`       | `INTEGER`       | Total defend events in the season                                                                    |
| `successful_defend_events` | `Int`       | `INTEGER`       |                                                                                                      |
| `attack_events`            | `Int`       | `INTEGER`       | Total attack events in the season                                                                    |
| `successful_attack_events` | `Int`       | `INTEGER`       |                                                                                                      |
| `deaths`                   | `BigInt`    | `BIGINT`        | Cumulative player deaths. BigInt used because this exceeds INT range at scale.                       |
| `kills`                    | `BigInt`    | `BIGINT`        | Cumulative enemy kills                                                                               |
| `accidentals`              | `BigInt`    | `BIGINT`        | Cumulative friendly-fire deaths                                                                      |
| `shots`                    | `BigInt`    | `BIGINT`        | Cumulative shots fired                                                                               |
| `hits`                     | `BigInt`    | `BIGINT`        | Cumulative shots that connected                                                                      |
| `map`                      | `Json?`     | `JSONB`         | Optional. Computed map data for this faction's 11 regions plus homeworld.                            |

**Constraints and indexes:**

| Type       | Fields            | Notes                             |
| ---------- | ----------------- | --------------------------------- |
| `@@unique` | `[season, enemy]` | One live row per enemy per season |
| `@@index`  | `[season]`        | All enemies in a season           |

> **BigInt fields:** `deaths`, `kills`, `accidentals`, `shots`, and `hits` use `BigInt` (PostgreSQL `BIGINT`) rather than `Int`. Helldivers cumulative counts for an active season easily exceed the 32-bit integer maximum of ~2.1 billion. When reading these values in JavaScript, Prisma returns them as native `BigInt` primitives — serialisation to JSON requires explicit conversion (e.g., `.toString()` or a custom serialiser).

---

### h1_live_snapshot

Time-series history of per-faction statistics. Each row captures the statistics fields for one enemy faction at a specific timestamp. Used for charting statistical trends over time within a season.

| Field                      | Prisma Type | PostgreSQL Type | Constraints / Notes                                                                                  |
| -------------------------- | ----------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| `id`                       | `String`    | `TEXT`          | `@id @default(uuid(7))`                                                                              |
| `season`                   | `Int`       | `INTEGER`       | FK → `h1_season.season` (relation is optional in Prisma — `h1_season?` — but `season` is always set) |
| `time`                     | `Int`       | `INTEGER`       | Unix timestamp from API response                                                                     |
| `enemy`                    | `Int`       | `INTEGER`       | Enemy faction identifier: `0` = Bugs, `1` = Cyborgs, `2` = Illuminate                                |
| `season_duration`          | `Int`       | `INTEGER`       | Total duration of the season in seconds                                                              |
| `players`                  | `Int`       | `INTEGER`       | Active players during measurement window                                                             |
| `total_unique_players`     | `Int`       | `INTEGER`       | Unique players across the season                                                                     |
| `missions`                 | `Int`       | `INTEGER`       | Total missions attempted                                                                             |
| `successful_missions`      | `Int`       | `INTEGER`       |                                                                                                      |
| `total_mission_difficulty` | `Int`       | `INTEGER`       | Sum of difficulty values across all missions                                                         |
| `completed_planets`        | `Int`       | `INTEGER`       |                                                                                                      |
| `defend_events`            | `Int`       | `INTEGER`       | Total defend events in the season                                                                    |
| `successful_defend_events` | `Int`       | `INTEGER`       |                                                                                                      |
| `attack_events`            | `Int`       | `INTEGER`       | Total attack events in the season                                                                    |
| `successful_attack_events` | `Int`       | `INTEGER`       |                                                                                                      |
| `deaths`                   | `BigInt`    | `BIGINT`        | Cumulative player deaths                                                                             |
| `kills`                    | `BigInt`    | `BIGINT`        | Cumulative enemy kills                                                                               |
| `accidentals`              | `BigInt`    | `BIGINT`        | Cumulative friendly-fire deaths                                                                      |
| `shots`                    | `BigInt`    | `BIGINT`        | Cumulative shots fired                                                                               |
| `hits`                     | `BigInt`    | `BIGINT`        | Cumulative shots that connected                                                                      |

**Constraints and indexes:**

| Type       | Fields                  | Notes                                           |
| ---------- | ----------------------- | ----------------------------------------------- |
| `@@unique` | `[season, enemy, time]` | One snapshot per enemy per timestamp per season |
| `@@index`  | `[season, time]`        | Range queries by season and time window         |

---

## 4. Rebroadcast Models

These two tables are the raw-cache layer. They store the unmodified JSON responses from the official Helldivers API and are written on every update cycle, before normalisation begins.

### rebroadcast_status

Stores the latest raw response for `get_campaign_status` keyed by season. One row per season, upserted on every successful fetch.

| Field          | Prisma Type | PostgreSQL Type | Constraints / Notes                                         |
| -------------- | ----------- | --------------- | ----------------------------------------------------------- |
| `id`           | `String`    | `TEXT`          | `@id @default(uuid(7))`                                     |
| `season`       | `Int`       | `INTEGER`       | `@unique` — one raw status record per season                |
| `last_updated` | `DateTime`  | `TIMESTAMPTZ`   | `@default(now())` — timestamp of the last successful upsert |
| `json`         | `Json`      | `JSONB`         | Complete raw JSON response from the official API            |

**No foreign key to `h1_season`.** This is intentional: the rebroadcast tables can receive data before the normalised `h1_season` row exists, and they must remain writable even if normalisation fails.

---

### rebroadcast_snapshot

Stores the latest raw response for `get_snapshots` keyed by season. Same structure as `rebroadcast_status`.

| Field          | Prisma Type | PostgreSQL Type | Constraints / Notes                              |
| -------------- | ----------- | --------------- | ------------------------------------------------ |
| `id`           | `String`    | `TEXT`          | `@id @default(uuid(7))`                          |
| `season`       | `Int`       | `INTEGER`       | `@unique` — one raw snapshot record per season   |
| `last_updated` | `DateTime`  | `TIMESTAMPTZ`   | `@default(now())`                                |
| `json`         | `Json`      | `JSONB`         | Complete raw JSON response from the official API |

> Note that `rebroadcast_snapshot` stores only the **latest** snapshot response per season, not time-series history. The time-series is built by normalising individual snapshots into `h1_snapshot` rows.

---

## 5. Auth and User Models

These models implement [NextAuth.js v5](https://authjs.dev/) with the Prisma adapter, plus application-specific extensions.

### User

Central user record. Extended beyond the NextAuth.js baseline with `username`, `role`, and application-specific relations.

| Field           | Prisma Type | PostgreSQL Type | Constraints / Notes                                                       |
| --------------- | ----------- | --------------- | ------------------------------------------------------------------------- |
| `id`            | `String`    | `TEXT`          | `@id @default(uuid(7))`                                                   |
| `name`          | `String?`   | `TEXT`          | Display name, optional                                                    |
| `username`      | `String?`   | `TEXT`          | `@unique` — intended to hold the user's Discord username                  |
| `email`         | `String?`   | `TEXT`          | `@unique`                                                                 |
| `emailVerified` | `DateTime?` | `TIMESTAMPTZ`   | Set when email is confirmed via magic link                                |
| `image`         | `String?`   | `TEXT`          | Avatar URL. Dashboard supports loading from Gravatar and persisting here. |
| `role`          | `String`    | `TEXT`          | `@default("user")` — application role string, not an enum                 |
| `createdAt`     | `DateTime`  | `TIMESTAMPTZ`   | `@default(now())`                                                         |
| `updatedAt`     | `DateTime`  | `TIMESTAMPTZ`   | `@updatedAt`                                                              |

**Relations:**

| Field           | Type              | Notes                           |
| --------------- | ----------------- | ------------------------------- |
| `accounts`      | `Account[]`       | OAuth provider accounts         |
| `sessions`      | `Session[]`       | Active sessions                 |
| `Authenticator` | `Authenticator[]` | WebAuthn credentials (optional) |
| `settings`      | `Settings?`       | One-to-one application settings |
| `reviews`       | `Review[]`        | Blog-style review posts         |
| `apiKeys`       | `ApiKey[]`        | API access keys                 |

---

### Account

Standard NextAuth.js OAuth account record. One row per OAuth provider per user.

| Field                      | Prisma Type | PostgreSQL Type | Constraints / Notes                    |
| -------------------------- | ----------- | --------------- | -------------------------------------- |
| `id`                       | `String`    | `TEXT`          | `@id @default(uuid(7))`                |
| `userId`                   | `String`    | `TEXT`          | `@unique` FK → `User.id`               |
| `type`                     | `String`    | `TEXT`          | OAuth type string                      |
| `provider`                 | `String`    | `TEXT`          | e.g., `"discord"`, `"github"`          |
| `providerAccountId`        | `String`    | `TEXT`          | Provider's identifier for this account |
| `refresh_token`            | `String?`   | `TEXT`          | `@db.Text`                             |
| `access_token`             | `String?`   | `TEXT`          | `@db.Text`                             |
| `expires_at`               | `Int?`      | `INTEGER`       | Token expiry as Unix timestamp         |
| `token_type`               | `String?`   | `TEXT`          |                                        |
| `scope`                    | `String?`   | `TEXT`          |                                        |
| `id_token`                 | `String?`   | `TEXT`          | `@db.Text`                             |
| `session_state`            | `String?`   | `TEXT`          |                                        |
| `refresh_token_expires_in` | `Int?`      | `INTEGER`       | GitHub-specific field                  |
| `createdAt`                | `DateTime`  | `TIMESTAMPTZ`   | `@default(now())`                      |
| `updatedAt`                | `DateTime`  | `TIMESTAMPTZ`   | `@updatedAt`                           |

**Constraints:**

| Type       | Fields                          |
| ---------- | ------------------------------- |
| `@unique`  | `userId`                        |
| `@@unique` | `[provider, providerAccountId]` |
| `@@index`  | `[userId]`                      |

> `userId` carries both `@unique` and an FK. The `@unique` on `userId` means each user can have at most one linked account per the current schema. This is a deviation from the standard NextAuth.js template (which allows multiple providers per user) and may be intentional to simplify the current authentication model.

---

### Session

Standard NextAuth.js database session.

| Field          | Prisma Type | PostgreSQL Type | Constraints / Notes     |
| -------------- | ----------- | --------------- | ----------------------- |
| `id`           | `String`    | `TEXT`          | `@id @default(uuid(7))` |
| `sessionToken` | `String`    | `TEXT`          | `@unique`               |
| `userId`       | `String`    | `TEXT`          | FK → `User.id`          |
| `expires`      | `DateTime`  | `TIMESTAMPTZ`   | Session expiry          |
| `createdAt`    | `DateTime`  | `TIMESTAMPTZ`   | `@default(now())`       |
| `updatedAt`    | `DateTime`  | `TIMESTAMPTZ`   | `@updatedAt`            |

**Indexes:** `@@index([userId])`

---

### VerificationToken

Standard NextAuth.js one-time tokens for magic link email authentication.

| Field        | Prisma Type | PostgreSQL Type | Constraints / Notes                |
| ------------ | ----------- | --------------- | ---------------------------------- |
| `identifier` | `String`    | `TEXT`          | Typically the user's email address |
| `token`      | `String`    | `TEXT`          | One-time token value               |
| `expires`    | `DateTime`  | `TIMESTAMPTZ`   | Token expiry                       |

**No surrogate PK.** The composite `@@unique([identifier, token])` serves as the effective primary key.

---

### Authenticator

Optional WebAuthn passkey support, provided by NextAuth.js.

| Field                  | Prisma Type | PostgreSQL Type | Constraints / Notes                 |
| ---------------------- | ----------- | --------------- | ----------------------------------- |
| `credentialID`         | `String`    | `TEXT`          | `@unique`                           |
| `userId`               | `String`    | `TEXT`          | FK → `User.id`, `onDelete: Cascade` |
| `providerAccountId`    | `String`    | `TEXT`          |                                     |
| `credentialPublicKey`  | `String`    | `TEXT`          |                                     |
| `counter`              | `Int`       | `INTEGER`       | Replay-attack counter               |
| `credentialDeviceType` | `String`    | `TEXT`          |                                     |
| `credentialBackedUp`   | `Boolean`   | `BOOLEAN`       |                                     |
| `transports`           | `String?`   | `TEXT`          | Optional transport hints            |

**Composite PK:** `@@id([userId, credentialID])`

---

### Settings

One-to-one with `User`. Stores all user preferences as a single JSON blob. Uses `userId` as both the primary key and the FK, enforcing the one-to-one relationship at the database level.

| Field      | Prisma Type | PostgreSQL Type | Constraints / Notes                                          |
| ---------- | ----------- | --------------- | ------------------------------------------------------------ |
| `userId`   | `String`    | `TEXT`          | `@id @unique` FK → `User.id`. PK and FK are the same column. |
| `settings` | `Json`      | `JSONB`         | Arbitrary user preference data                               |

---

### Review

Blog-style user-submitted content. Currently unpublished by default, suggesting a moderation workflow.

| Field       | Prisma Type | PostgreSQL Type | Constraints / Notes                                  |
| ----------- | ----------- | --------------- | ---------------------------------------------------- |
| `id`        | `String`    | `TEXT`          | `@id @default(uuid(7))`                              |
| `createdAt` | `DateTime`  | `TIMESTAMPTZ`   | `@default(now())`                                    |
| `updatedAt` | `DateTime`  | `TIMESTAMPTZ`   | `@updatedAt`                                         |
| `title`     | `String`    | `TEXT`          | Required                                             |
| `content`   | `String?`   | `TEXT`          | Optional body                                        |
| `published` | `Boolean`   | `BOOLEAN`       | `@default(false)` — requires explicit publish action |
| `authorId`  | `String`    | `TEXT`          | FK → `User.id`                                       |

---

### ApiKey

Application API keys for external consumers. The key itself is the UUIDv7 `id`. The `hash` (MD5 of the key) is what is stored for lookup — the plaintext key is never stored after creation, making the `visible` field the only partially-readable remnant.

| Field         | Prisma Type | PostgreSQL Type | Constraints / Notes                                                               |
| ------------- | ----------- | --------------- | --------------------------------------------------------------------------------- |
| `id`          | `String`    | `TEXT`          | `@id @default(uuid(7))` — this UUID **is** the API key issued to the user         |
| `hash`        | `String`    | `TEXT`          | `@unique` — MD5 hash of `id`. Used for constant-time lookup on incoming requests. |
| `visible`     | `String`    | `TEXT`          | Last 4 characters of the key, for display in the dashboard (e.g., `"...a3f2"`)    |
| `userId`      | `String`    | `TEXT`          | FK → `User.id`                                                                    |
| `description` | `String`    | `TEXT`          | User-provided label for the key                                                   |
| `createdAt`   | `DateTime`  | `TIMESTAMPTZ`   | `@default(now())`                                                                 |
| `enabled`     | `Boolean`   | `BOOLEAN`       | `@default(true)` — keys can be disabled without deletion                          |

> **Security note:** MD5 is used here as a fast lookup hash, not as a cryptographic protection. The key space is UUIDv7 (128 bits of entropy), which provides the actual security. The MD5 hash allows O(1) database lookups without storing the raw key.

---

## 6. App Configuration Model

### App

A single-row configuration table for application-level state. Intended to have exactly one row at runtime.

| Field           | Prisma Type | PostgreSQL Type | Constraints / Notes                                     |
| --------------- | ----------- | --------------- | ------------------------------------------------------- |
| `id`            | `String`    | `TEXT`          | `@id @default(uuid(7))`                                 |
| `version`       | `String`    | `TEXT`          | Application version string                              |
| `active_season` | `Int`       | `INTEGER`       | `@default(0)` — the currently active game season number |

Several fields are commented out in the schema (`is_db_initialized`, `last_updated_status`, `last_updated_season`, `settings`), indicating planned but deferred functionality.

---

## 7. Index and Constraint Summary

This table enumerates every uniqueness constraint and index across the schema.

| Model                   | Constraint Type | Fields                          | Notes                                       |
| ----------------------- | --------------- | ------------------------------- | ------------------------------------------- |
| `h1_season`             | `@unique`       | `season`                        | Game season number is globally unique       |
| `h1_season`             | `@@index`       | `[season]`                      |                                             |
| `h1_season`             | `@@index`       | `[last_updated]`                |                                             |
| `h1_introduction_order` | `@unique`       | `season`                        | Enforces one-to-one with `h1_season`        |
| `h1_introduction_order` | `@@index`       | `[season]`                      |                                             |
| `h1_points_max`         | `@unique`       | `season`                        | Enforces one-to-one with `h1_season`        |
| `h1_points_max`         | `@@index`       | `[season]`                      |                                             |
| `h1_snapshot`           | `@@unique`      | `[season, time]`                | One snapshot per timestamp per season       |
| `h1_snapshot`           | `@@index`       | `[season]`                      |                                             |
| `h1_event`              | `@@unique`      | `[type, event_id]`              | Compound unique on type + event ID          |
| `h1_event`              | `@@index`       | `[season, type]`                |                                             |
| `h1_event`              | `@@index`       | `[season, status]`              |                                             |
| `h1_event`              | `@@index`       | `[season, enemy]`               |                                             |
| `h1_event_snapshot`     | `@@unique`      | `[type, event_id, time]`        | One snapshot per event per timestamp        |
| `h1_event_snapshot`     | `@@index`       | `[season, time]`                | Range queries by season and time window     |
| `h1_event_snapshot`     | `@@index`       | `[event_id, time]`              | Time-series for a specific event            |
| `h1_live`               | `@@unique`      | `[season, enemy]`               | One live row per enemy per season           |
| `h1_live`               | `@@index`       | `[season]`                      |                                             |
| `h1_live_snapshot`      | `@@unique`      | `[season, enemy, time]`         | One snapshot per enemy per timestamp        |
| `h1_live_snapshot`      | `@@index`       | `[season, time]`                | Range queries by season and time window     |
| `rebroadcast_status`    | `@unique`       | `season`                        | One raw status record per season            |
| `rebroadcast_snapshot`  | `@unique`       | `season`                        | One raw snapshot record per season          |
| `User`                  | `@unique`       | `username`                      |                                             |
| `User`                  | `@unique`       | `email`                         |                                             |
| `Account`               | `@unique`       | `userId`                        | One OAuth account per user (current schema) |
| `Account`               | `@@unique`      | `[provider, providerAccountId]` | Standard NextAuth.js constraint             |
| `Account`               | `@@index`       | `[userId]`                      |                                             |
| `Session`               | `@unique`       | `sessionToken`                  |                                             |
| `Session`               | `@@index`       | `[userId]`                      |                                             |
| `VerificationToken`     | `@@unique`      | `[identifier, token]`           | Composite PK for magic link tokens          |
| `Authenticator`         | `@unique`       | `credentialID`                  |                                             |
| `Authenticator`         | `@@id`          | `[userId, credentialID]`        | Composite PK                                |
| `Settings`              | `@id`           | `userId`                        | PK is also the FK                           |
| `Settings`              | `@unique`       | `userId`                        | Redundant given `@id`, but explicit         |
| `ApiKey`                | `@unique`       | `hash`                          | MD5 hash lookup                             |

---

## Cross-References

- See [03-data-flow.md](03-data-flow.md) for the sequence in which these tables are populated during an update cycle, including the two-table strategy (rebroadcast then normalised).
- See [04-api-reference.md](04-api-reference.md) for the API endpoints that read from and write to these tables, including the `GET /api/h1/campaign` query shape and the rebroadcast endpoint.
