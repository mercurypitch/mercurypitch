# Users & Auth Plan

Goal: **full user accounts** for the cloud database — Google login + email/password — while karaoke/UVR data stays local and needs no auth at all. Anonymous-first: nobody has to sign up to use MercuryPitch, but signing up upgrades the anonymous identity in place (no data loss).

## Requirements (confirmed)

- Google login (Google Identity Services ID token, verified server-side)
- Email + password login (PBKDF2-SHA256, 100k iterations, WebCrypto — no deps)
- Anonymous works without signup; upgrading keeps the same `userId` so all rows stay attached

## Status

| Piece | State |
|---|---|
| Persistent anonymous id (`src/db/services/user-service.ts`, localStorage `mp:userId`) | ✅ done |
| `seed.ts` `getUserId()` fixed (was a new UUID per page load) | ✅ done |
| db-worker CRUD with per-table access rules (`workers/db-worker/src/index.ts`, `tables.ts`) | ✅ done, smoke-tested |
| Auth endpoints: anonymous / register / login / google / me (`workers/db-worker/src/auth.ts`) | ✅ done (google untested — needs a real client id) |
| JWT (HS256, 30-day expiry) + userId enforcement from token | ✅ done, smoke-tested |
| Google Cloud OAuth client id created + set as `GOOGLE_CLIENT_ID` | ✅ done (var in wrangler.jsonc + defaults.ts) |
| Prod secrets: `wrangler secret put JWT_SECRET / ADMIN_KEY` | ⬜ user action (after first deploy) |
| HybridAdapter (route cloud entities → ServerAdapter with `getAuthHeaders()`) | ✅ done, unit-tested |
| Auth client (`src/db/services/auth-service.ts`: ensureAuth/register/login/google/me) | ✅ done |
| Auth UI (`src/components/account/AccountSection.tsx` in settings: register/login forms, Google button via GIS, sign-out; component-tested) | ✅ done |
| Cloud seeding of challenge/badge/achievement definitions (admin key) | ⬜ next |

## How auth works

### Endpoints (db-worker)

| Endpoint | Body | Behavior |
|---|---|---|
| `POST /api/auth/anonymous` | `{ deviceId? }` | Creates (or re-issues for) an anonymous user. `deviceId` = client's persisted UUID. Refused (403) once the account is upgraded — then you must log in. |
| `POST /api/auth/register` | `{ email, password, displayName?, deviceId? }` | With `deviceId`: upgrades the anonymous user **in place** (same id, all data kept). Otherwise creates a fresh account. |
| `POST /api/auth/login` | `{ email, password }` | Standard login. |
| `POST /api/auth/google` | `{ idToken, deviceId? }` | Verifies the GIS ID token (`aud` must match `GOOGLE_CLIENT_ID`). Order: returning Google user → auto-link to password account with same verified email → upgrade anonymous `deviceId` → create new. |
| `GET /api/auth/me` | Bearer token | Returns user (never `passwordHash`) + profile. |

All issue `{ token, userId, isNew, user }`. Client stores the token (`mp:authToken`) and sends `Authorization: Bearer <jwt>`; the worker derives `userId` from the token — request-body `userId` is ignored/overridden.

### Per-table access (workers/db-worker/src/tables.ts)

- **admin** (challenge/badge/achievement definitions, featureFlags): public read, writes need `X-Admin-Key`.
- **user** (sessionRecords, challengeProgress, userBadges, userAchievements, userSettings): auth required, hard-scoped to token userId.
- **public-user** (leaderboardEntries): public read, own-row writes.
- **shared** (sharedMelodies, sharedSessions): public sees `isPublic=1`, owners also see their private rows; own-row writes.
- **owner** (userProfiles): row id == userId; public read, own-row write. Created automatically at signup.
- **users** table: not exposed via CRUD at all — only through `/api/auth/*`.

### Known tradeoff

An anonymous `deviceId` UUID is a bearer credential: whoever knows it can get a token for it (until upgraded). Acceptable for leaderboard-tier data; upgrading to a real account closes it.

## Client integration (next steps)

1. **HybridAdapter** in `src/db/index.ts`: cloud entities → `ServerAdapter` (with `getAuthHeaders()` from user-service), everything else → Dexie. Only active when `VITE_API_BASE_URL` is set. On app start with API configured: `POST /api/auth/anonymous { deviceId: getUserId() }` if no stored token, store token, retry-on-401 once.
2. **Auth UI**: settings → Account section: signed-in state (`/me`), register/login forms, "Continue with Google" via [GIS](https://developers.google.com/identity/gsi/web) (`google.accounts.id` → credential = idToken → `POST /api/auth/google`), logout = `setAuthToken(null)`.
3. **Google setup (user action)**: Google Cloud Console → Credentials → OAuth client ID (Web application); authorized JS origins: `https://mercurypitch.com`, `https://dev.mercurypitch.com`, `http://localhost:3000`. Put the client id in `.dev.vars` and `wrangler secret put GOOGLE_CLIENT_ID`.

## Local dev

No mocking needed — `wrangler dev` serves the **local** D1 copy (`workers/db-worker/.wrangler/state`, already initialized by `pnpm db:init`):

```bash
cp workers/db-worker/.dev.vars.example workers/db-worker/.dev.vars   # once
pnpm dev:db                                  # worker on :8788, local D1
VITE_API_BASE_URL=http://localhost:8788 pnpm dev   # once HybridAdapter exists
```

Remote D1 is production-only.
