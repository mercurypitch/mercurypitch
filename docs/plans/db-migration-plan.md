# Cloudflare D1 Database Migration Plan

This plan outlines the steps required to transition MercuryPitch's database from a local, ephemeral IndexedDB (Dexie) to a persistent, server-side Cloudflare D1 (SQLite) database.

## 1. Current Database Design Validation

The current database architecture uses a strict Adapter Pattern. All 20 tables are defined in `src/db/entities.ts` and accessed through `Repository<T>`.

**Validation Results for Cloudflare D1 (SQLite):**
- **Architecture**: Excellent. The `ServerAdapter` is already fully implemented to expect standard REST endpoints (`GET /api/:entity`, `POST`, etc.). Once the backend is up, swapping to it is a single environment variable change (`VITE_API_BASE_URL`).
- **Data Types**: SQLite supports `NULL`, `INTEGER`, `REAL`, `TEXT`, and `BLOB`. All TypeScript interfaces in `entities.ts` map perfectly to these.
- **Complex Objects**: The schema correctly anticipates relational limits by using serialized JSON strings (e.g., `itemsJson`, `resultsJson`, `segmentsJson`) rather than nested tables for complex internal structures. This is highly performant in SQLite.
- **Primary Keys**: UUIDs (`id` string) are used uniformly across all entities, which works perfectly as `TEXT PRIMARY KEY` in SQLite and enables easy offline-sync generation in the future.

> [!WARNING]
> **Blob Storage (UVR Stems)**: Cloudflare D1 has a hard limit of 1MB per row. The `uvrStemBlobs` table contains binary audio `ArrayBuffer` data which will exceed this. These blobs **must** be stored in Cloudflare R2, not D1. The plan below addresses this.

## 2. Step-by-Step Integration Guide

### Step 1: Create the D1 Database
You will need to create the D1 database in your Cloudflare account using Wrangler:
```bash
npx wrangler d1 create mercurypitch-db
```
*(This will output a `database_name` and `database_id` which we will put into `wrangler.jsonc`)*

### Step 2: Apply the SQLite Schema
I will provide a `schema.sql` file (or a generator script) that maps exactly to `entities.ts`. We will execute it against your new D1 database:
```bash
npx wrangler d1 execute mercurypitch-db --local --file=./workers/db-worker/schema.sql
npx wrangler d1 execute mercurypitch-db --remote --file=./workers/db-worker/schema.sql
```

### Step 3: Implement the DB Worker (Backend)
We will create a new Cloudflare Worker (e.g., in `workers/db-worker/`) using Hono.js. This worker will:
1. Bind to the D1 database.
2. Implement the generic CRUD endpoints expected by `ServerAdapter`:
   - `GET /api/:entity`
   - `GET /api/:entity/:id`
   - `POST /api/:entity`
   - `PATCH /api/:entity/:id`
   - `DELETE /api/:entity/:id`
3. Bind to an R2 bucket for handling the `uvrStemBlobs` binary audio data.

### Step 4: Authentication (Crucial for Cloud)
Currently, `sessionRecords`, `userProfiles`, and `leaderboardEntries` use a generic `userId`. When moving to the cloud, we must ensure users can only modify their own records.
- We will integrate Cloudflare Access, or a simple JWT-based auth flow.
- The DB Worker will enforce `WHERE userId = ?` on protected endpoints.

### Step 5: Data Migration / Seeding
- We will write a sync script to read the existing `src/db/seed.ts` (which populates base challenges, badges, and achievements) and POST them to the new DB Worker.
- *Future consideration*: A button in the app settings to "Sync Local Data to Cloud" that loops through the Dexie tables and pushes the user's history to the server.

## 3. Proposed Schema Script (`schema.sql`)

Below is a preview of how the `entities.ts` maps to D1 SQLite. I will generate the complete `schema.sql` file as part of the implementation.

```sql
-- Core user tables
CREATE TABLE userProfiles (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  displayName TEXT NOT NULL,
  avatarUrl TEXT,
  bio TEXT,
  joinDate TEXT NOT NULL,
  lastPracticeDate TEXT,
  currentStreak INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sessionRecords (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  melodyId TEXT,
  melodyName TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  endedAt TEXT NOT NULL,
  score REAL NOT NULL,
  accuracy REAL NOT NULL,
  notesHit INTEGER NOT NULL,
  notesTotal INTEGER NOT NULL,
  streak INTEGER NOT NULL,
  avgCents REAL,
  rating TEXT,
  results TEXT NOT NULL -- JSON
);

-- Indexes for performance (mapped from dexie-adapter.ts STORE_SCHEMAS)
CREATE INDEX idx_sessionRecords_userId ON sessionRecords(userId);
CREATE INDEX idx_sessionRecords_endedAt ON sessionRecords(endedAt);
```

## User Review Required

Does this overarching backend architecture look good? 
Specifically:
1. **Worker placement:** Should the DB REST API be its own worker (`workers/db-worker/`), or merged into an existing one?
2. **Auth strategy:** Do you want to implement real user accounts (e.g., Auth0 / Supabase / simple JWT), or stick to anonymous UUID-based tracking for now?

Once approved, I will write the complete `schema.sql` generator and outline the exact setup commands.
