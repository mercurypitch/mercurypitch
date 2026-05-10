# Database Implementation — Research & Plan

Issue: [#243](https://github.com/Komediruzecki/pitch-perfect/issues/243)

## Overview

PitchPerfect is currently a client-only SPA with no backend database. As we add user profiles, shared melodies, community features, and session persistence, we need a database. This plan evaluates options and recommends an architecture optimized for the existing Cloudflare deployment.

## Research Questions (from issue)

### 1. Database Type: SQL vs NoSQL

| Criterion | SQL (SQLite / PostgreSQL) | NoSQL (MongoDB / Firestore) |
|-----------|--------------------------|----------------------------|
| Schema safety | ✅ Strong typing, migrations, validation | ❌ Schema-on-read, drift risk |
| Query flexibility | ✅ Joins, aggregations, transactions | ⚠️ Limited joins, denormalize everything |
| Musical data (MIDI, arrays) | ✅ JSON columns in SQLite/PG handle flexible data | ✅ Native document model |
| Migration safety | ✅ Typed migrations, reversible | ❌ No migrations — app-level transforms |
| Performance at <10K users | ✅ Either is fine at this scale | ✅ Slightly faster for simple reads |
| Ecosystem alignment | ✅ Valibot (already used) ↔ Drizzle/Zod schemas | ❌ Different mental model |

**Recommendation: SQL** — at <10K users, SQL offers better schema safety, migration tooling, and type-safety alignment with the existing Valibot-based frontend. JSON columns cover flexible musical data.

### 2. Specific Database Options

#### Option A: Cloudflare D1 (SQLite at the Edge) ⭐ RECOMMENDED

| Factor | Assessment |
|--------|-----------|
| **Type** | SQLite-compatible, distributed read replicas |
| **Cost** | Free: 5GB storage, 5M reads/day, 100K writes/day. Paid: $0.75/GB storage, $0.001/1K reads, $1.00/1M writes |
| **Latency** | <10ms reads from edge (replicated to closest PoP), writes route to primary |
| **Migration** | Built-in `wrangler d1 migrations` with SQL files |
| **Backups** | Automatic point-in-time restore via Cloudflare |
| **Integration** | Query from Workers, Pages Functions — same CF account, zero cold starts |
| **Limits** | 10GB max per database, 100 databases per account |
| **Scale** | Comfortable for 10K+ users at current usage patterns |

At current free tier and projected usage:
- Reads: 5M/day free → enough for ~50K page views/day at 100 queries each
- Writes: 100K/day free → enough for ~10K active users saving data
- **Estimated cost at 10K users: $0-5/month** (stays within free tier for reads, small write overage)

#### Option B: Supabase (PostgreSQL)

| Factor | Assessment |
|--------|-----------|
| **Cost** | Free: 500MB DB, 2 projects. Pro: $25/month |
| **Latency** | ~30-80ms (nearest region, not edge) |
| **Features** | Real-time subscriptions, auth, storage, row-level security |
| **Migration** | Full PostgreSQL migrations, pgAdmin |
| **Integration** | External service, cross-origin calls from CF Pages |
| **Upside** | Rich ecosystem, PostGIS, mature tooling |
| **Downside** | Not on Cloudflare edge, added latency, separate billing, separate SLA |

#### Option C: Cloudflare Durable Objects (for real-time state)

Not a replacement for D1, but complementary:
- For jam room state, presence, temporary session state
- DOs provide WebSocket-native, strongly-consistent state
- Use alongside D1 (D1 for persistent data, DO for ephemeral/real-time)

**Recommendation: Cloudflare D1 for persistent data + Durable Objects for real-time ephemeral state.** Both are on the same Cloudflare account the user already has.

### 3. GDPR & User Data Collection

#### Can We Avoid Cookie Banners?

**Yes**, with constraints:
- **Strictly necessary** cookies (session/auth tokens) do NOT require consent under GDPR Art. 6(1)(f) and ePrivacy Directive
- **No tracking/analytics cookies** → no banner needed
- **No third-party cookies** → no banner needed
- **No marketing cookies** → no banner needed

#### Data Minimization Strategy

```
User profile data we COLLECT (opt-in, account creation):
  ├── Display name (can be pseudonymous — "character name")
  ├── Email (for account recovery only, never shared)
  └── Hashed password (never store plaintext)

User activity data we STORE (associated with profile):
  ├── Session scores (practice results)
  ├── Challenge scores
  ├── Streaks (days active)
  ├── Badges earned
  └── Shared melodies (MIDI data, metadata)

Data we DO NOT collect:
  ├── Real name
  ├── Location / IP logs beyond CF default (24h retention)
  ├── Age / DOB
  ├── Gender
  ├── Analytics profiles
  └── Any third-party sharing
```

#### GDPR Checklist

| Requirement | Implementation |
|-------------|---------------|
| Lawful basis | Legitimate interest for auth + explicit consent for profile |
| Data minimization | Only collect fields listed above |
| Right to access | `GET /api/user/data` endpoint returning all user data as JSON |
| Right to deletion | `DELETE /api/user/data` — cascade delete all user records |
| Data portability | Export all user data as JSON download |
| Breach notification | Cloudflare handles infra; app-level: email users within 72h |
| DPA | Cloudflare DPA covers D1 and Workers (signed by default on Enterprise; available on free) |
| Privacy policy | Required — link in app footer and during account creation |

**Cookie banner**: NOT required if we only use authentication cookies (strictly necessary). Adding Google Analytics or any tracking → banner becomes required.

### 4. Database Schema Design

#### Tables

```sql
-- Profiles & Auth
CREATE TABLE users (
  id          TEXT PRIMARY KEY,  -- UUID
  username    TEXT UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Practice & Scores
CREATE TABLE practice_sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode        TEXT NOT NULL,        -- 'freeform', 'challenge', 'session'
  score       REAL,                  -- 0-100 accuracy
  duration_ms INTEGER,
  note_count  INTEGER,
  metadata    TEXT,                  -- JSON: melody ref, settings, etc.
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE challenge_scores (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL,
  score       REAL NOT NULL,
  rank        INTEGER,
  metadata    TEXT,                  -- JSON: details, attempts, etc.
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- User Progress
CREATE TABLE user_streaks (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT,             -- ISO date
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE badges (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type  TEXT NOT NULL,         -- 'streak_7', 'score_100', 'challenge_win', etc.
  earned_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Musical Data
CREATE TABLE melodies (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  midi_data   TEXT NOT NULL,          -- JSON-encoded MIDI (notes array)
  bpm         INTEGER,
  key         TEXT,                   -- e.g., 'C', 'Am'
  is_public   INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE melody_likes (
  melody_id   TEXT NOT NULL REFERENCES melodies(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (melody_id, user_id)
);

-- Indexes
CREATE INDEX idx_practice_user ON practice_sessions(user_id, created_at);
CREATE INDEX idx_challenge_user ON challenge_scores(user_id, challenge_id);
CREATE INDEX idx_melodies_user ON melodies(user_id, is_public, created_at);
CREATE INDEX idx_melodies_public ON melodies(is_public, created_at) WHERE is_public = 1;
```

#### Performance at Scale (<10K users)

| Query | Expected rows | Indexed? | Est. time (D1) |
|-------|--------------|----------|----------------|
| User login (email lookup) | 1 | PK | <5ms |
| User practice history | ~1000/user | ✅ | <10ms |
| Challenge leaderboard | ~1000/challenge | ✅ | <20ms |
| Public melody feed | ~5000 | ✅ | <15ms |
| User badge list | ~50/user | PK | <5ms |

All queries stay well within D1's performance envelope at <10K users.

### 5. Migration Strategy

#### Tool: Drizzle ORM + `wrangler d1 migrations`

```
wrangler d1 migrations create pitchperfect-db add_users_table
  → generates migrations/0001_add_users_table.sql

wrangler d1 migrations apply pitchperfect-db
  → applies to production (with confirmation prompt)
```

#### Safety Principles

| Principle | Implementation |
|-----------|---------------|
| **Reversible** | Every `up` migration has a corresponding `down` SQL file |
| **Typed** | Drizzle schema defines types → TypeScript types auto-generated (like Valibot but for DB) |
| **CI check** | `wrangler d1 migrations list` in CI to detect unapplied migrations before deploy |
| **No breaking** | Additive changes only in migrations (add column, not rename/drop). Drop in separate follow-up migration after deploy verified |
| **Local test** | `wrangler d1 execute pitchperfect-db --local --file=migrations/...` before applying to prod |

#### Example Migration

```sql
-- up.sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- down.sql
DROP TABLE IF EXISTS users;
```

### 6. Security Beyond Passwords

| Layer | Implementation |
|-------|---------------|
| **Password hashing** | bcrypt2 or argon2 via Web Crypto — hash before sending to server (server hashes again) |
| **Auth tokens** | JWT with short expiry (15 min) + refresh token (7 days), stored in httpOnly cookie |
| **Row-level access** | All queries filtered by `WHERE user_id = ?` from authenticated context — enforced in Worker code, not at DB level (D1 limitation vs Postgres RLS) |
| **Rate limiting** | Cloudflare rate limiting on auth endpoints (5 attempts/IP/min) |
| **SQL injection** | D1 uses parameterized queries; Drizzle ORM enforces this |
| **Input validation** | Valibot schemas (already in use) validate all input before DB writes |
| **CORS** | Strict origin allowlist — only mercurypitch.com and dev subdomains |
| **Secrets** | Database credentials in Cloudflare Secrets (`wrangler secret put`), never in code |

### 7. Server & Cost Analysis

#### Cloudflare (Recommended)

Since the user already has Cloudflare account with Workers and deployment:

| Resource | Free Tier | Paid (est. at 1K users) | Paid (est. at 10K users) |
|----------|-----------|------------------------|--------------------------|
| **D1** | 5GB, 5M reads/day | $0-5/mo | $5-15/mo |
| **Workers** | 100K req/day | $0-5/mo | $5-20/mo |
| **Pages** | Unlimited (already used) | $0 | $0 |
| **Durable Objects** | 1M req/month | $0-3/mo | $3-15/mo |
| **KV (caching)** | 1GB, 1M reads/day | $0-2/mo | $2-5/mo |
| **Total** | $0/mo | **$0-15/mo** | **$15-55/mo** |

#### Compare: Deno Deploy

| Factor | Assessment |
|--------|-----------|
| Free tier | 1M req/month, 100GB egress |
| Paid | $10/month + usage |
| Database | Deno KV (NoSQL, key-value) — different model than D1 |
| Advantage | First-class TypeScript, no build step |
| Disadvantage | Not on Cloudflare (separate infra, separate billing), KV is not relational |

#### Compare: Fly.io + SQLite

| Factor | Assessment |
|--------|-----------|
| Free tier | 3 shared VMs, 256MB each |
| Paid | ~$2-8/month per VM |
| Database | LiteFS (distributed SQLite) |
| Advantage | Full Linux VM, no edge limits |
| Disadvantage | Operations overhead, cold start on free tier, not edge-distributed |

**Recommendation: Stay on Cloudflare.** Everything under one account, one bill, one edge network. D1 + Workers handles 10K users comfortably within free/cheap tiers.

### 8. Server-Side Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Cloudflare Edge                      │
│                                                        │
│  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │  Pages (static)  │  │  Workers (API)               │ │
│  │  pitchperfect  │  │  /api/auth/*                  │ │
│  │  SPA served    │  │  /api/users/*                 │ │
│  │  from CF CDN    │  │  /api/melodies/*              │ │
│  └─────────────────┘  │  /api/challenges/*            │ │
│                        │  /api/sessions/*             │ │
│                        └──────────┬──────────────────┘ │
│                                   │                    │
│                        ┌──────────┴──────────────────┐ │
│                        │  D1 (SQLite at Edge)         │ │
│                        │  • Users, scores, melodies   │ │
│                        │  • Read replicas at each PoP │ │
│                        └─────────────────────────────┘ │
│                                                        │
│                        ┌──────────────────────────────┐ │
│                        │  Durable Objects (optional)   │ │
│                        │  • Jam room state             │ │
│                        │  • Real-time presence         │ │
│                        └──────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Auth + User Profiles (Week 1-2)

- Cloudflare Worker for auth endpoints (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`)
- D1 database creation + users table migration
- JWT token management (httpOnly cookies)
- Profile page in PitchPerfect (display name, stats)
- Valibot schemas for auth requests

### Phase 2: Scores & Progress (Week 3-4)

- Practice session persistence — save results after each session
- Challenge scores — leaderboard query from D1
- Streaks tracking — update on daily activity
- Badges system — award and display badges
- Migration for scores/badges tables

### Phase 3: Melody Sharing (Week 5-6)

- Save melodies to D1 (shared via community)
- Public melody feed with pagination
- Like/unlike melodies
- Share URL integration with database-backed melodies
- Migration for melodies table

### Phase 4: Community Features (Week 7-8)

- Community leaderboard from D1 (replace localStorage-based)
- User search
- GDPR compliance endpoints (data export, account deletion)
- Privacy policy page

## Dependencies

### New npm packages

```json
{
  "drizzle-orm": "^0.38.0",       // Type-safe SQLite ORM
  "drizzle-kit": "^0.28.0",       // Migration generation (dev)
  "@oslojs/crypto": "^1.0.0",     // Password hashing (argon2)
  "@oslojs/jwt": "^1.0.0",        // JWT creation/verification
  "valibot": "already installed"  // Input validation
}
```

### Cloudflare

- D1 database (created via `wrangler d1 create pitchperfect-db`)
- Workers for API routes
- Secrets for JWT signing key and any API keys

## Open Questions

1. **Auth provider vs custom auth**: Should we use Cloudflare Access, Auth0, or roll our own JWT auth? Custom auth with bcrypt/argon2 is simpler and free but more code. Auth0 free tier covers 7,500 active users.
2. **Anonymous-first or account-first?** Can users practice without accounts (localStorage as today), and only create accounts to save/share? This reduces friction and GDPR scope.
3. **Melody storage format**: Store MIDI as JSON in a TEXT column (current plan) or as binary blobs? JSON is simpler for querying; binary is more compact but opaque.
4. **Offline support**: Should scores queue locally and sync when online? D1 writes require network — local fallback needed?
5. **Real-time leaderboard**: Do we need live leaderboard updates? If so, Durable Objects + WebSocket for leaderboard push; otherwise, poll-based is simpler.

## Success Criteria

✅ Users can create accounts and log in
✅ Practice sessions persist across devices (login-based)
✅ Challenge scores are stored and retrievable
✅ Community melodies are database-backed (not just localStorage)
✅ Leaderboard queries are <50ms at 1000 concurrent users
✅ All user data is exportable and deletable (GDPR compliance)
✅ No cookie banner required (no tracking/analytics cookies)
✅ Database+API cost stays under $20/month at 10K users
