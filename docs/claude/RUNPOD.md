# RunPod Serverless — Deploy & Cost Runbook

Server-side stem separation runs on **RunPod serverless endpoints**
(scale-to-zero). It removes the 10–30 minute on-device wait. The on-device
(browser) separator — CPU and WASM/WebGPU — stays free and unlimited; this is
the paid "skip the wait" path.

There are two server tiers, each its own RunPod endpoint:

- **GPU** — fast (~2–3 min/song on a mid-tier GPU). The **default** when a
  user with credits enables server-side rendering. Burns credits faster.
- **CPU** — cheaper, slower. Opt-in via `runpod-cpu`. Lets a user trade speed
  for a lower credit cost.

So the full separation ladder is: on-device CPU → on-device WASM/WebGPU →
RunPod CPU → RunPod GPU.

The worker image lives in [`runpod/`](../../runpod/README.md). The web app
reaches both tiers through the Cloudflare worker, which bridges the app's
existing `/api/uvr/*` contract to RunPod's job API (`src/lib/runpod.ts`).

**Status: built, off by default.** Nothing changes until `RUNPOD_API_KEY` +
at least one tier endpoint are set on the worker *and* a request opts in. With
RunPod unset, `/api/uvr/*` continues to hit the CPU container exactly as
before.

---

## How a request flows

```
browser ─POST /api/uvr/process (X-UVR-Provider: runpod | runpod-cpu)─▶ Cloudflare worker
   worker picks the tier's endpoint (gpu default, cpu on opt-in)
   worker ──POST {endpoint}/run {input}──▶ RunPod  ──▶ {id}
   worker returns session_id = "rp_<tier>_<id>"   e.g. rp_gpu_abc / rp_cpu_abc
browser ─GET /api/uvr/status/rp_<tier>_<id>─▶ worker ─GET {endpoint}/status/<id>─▶ RunPod
browser ─GET /api/uvr/output/rp_<tier>_<id>/vocal─▶ worker ──302──▶ stem URL (R2/S3)
```

The bridge is **stateless**: the tier + RunPod job id are carried inside the
session id (`rp_<tier>_<id>`), so status/output/cancel route back to the right
endpoint with no session store. Stems come back as object-storage URLs (the
worker 302-redirects to them) or, for small local-test jobs, inline base64 the
worker streams.

---

## Serverless cost model (why the worker is built the way it is)

RunPod bills **per second, from when a worker starts until it stops** (rounded
up). There is no charge while zero workers run. Per the RunPod docs, a billed
worker spends time in three phases:

| Phase | What it is | Lever (and where we pull it) |
|-------|-----------|------------------------------|
| **Start time** | Container init + loading the model into GPU memory | **Bake the model into the image** (`runpod/Dockerfile` pre-bake) so it's never re-downloaded; **eager-load at startup** (`UVR_EAGER_LOAD=1`) so **FlashBoot** can snapshot the warmed worker and restore it in ~2s; keep the image lean for faster pulls |
| **Execution time** | Actually separating the song | Lean one-shot handler; warm model reuse across jobs; **set an execution timeout** on the endpoint (~300s) so a stuck job can't bill forever |
| **Idle timeout** | Seconds a worker stays up after a job, waiting for more (default 5s) | Tune in endpoint settings — higher reuses the warm worker for a burst of songs (skips Start time), lower cuts idle billing |

Cold-start download of model weights is the one real cost leak, and baking +
eager-load removes it. The handler also caches the loaded model across warm
invocations, so a second song on a still-warm worker skips Start time entirely.

Every job's output includes a `timings` + `cost` block, so cost-per-song is
measurable for real — locally (`python handler.py`) or from a deployed job.

### Recommended endpoint settings (bursty hobbyist traffic)

- **Min / Active workers: 0** — scale-to-zero, no idle cost. Bump Active to 1
  only once traffic is steady enough that the always-warm worker (40% cheaper
  per-second than flex, but billed 24/7) beats paying cold starts.
- **Max workers: small** (e.g. 3) — raise as demand grows.
- **FlashBoot: on** — cuts cold start from ~20s toward ~2s.
- **Idle timeout: ~30–60s** — long enough that someone queuing several songs
  reuses one warm worker; short enough to avoid paying for long idles.
- **Execution timeout: ~300s** — caps runaway jobs (our jobs run ~2–3 min).
- **GPU: RTX 4090-class (mid-tier)** for the ~2–3 min/song target.
- **Container disk: 20 GB** — the CUDA + torch image is ~10 GB unpacked;
  smaller disks fail at worker start (verified on the first real deploy).

---

## Deploy

1. **Build & push the worker image** (see [`runpod/README.md`](../../runpod/README.md)).
   Use a pinned version tag, never `latest` — the endpoint should reference an
   immutable tag, and bumping it in the endpoint settings is the controlled
   release (RunPod rolls workers onto the new image):
   ```bash
   docker build -t <registry>/mercurypitch-uvr-runpod:v0.2.1 runpod/
   docker push  <registry>/mercurypitch-uvr-runpod:v0.2.1
   ```
2. **Create the serverless endpoint(s)** in the RunPod console with the
   settings above; set the `S3_*` env vars (object storage for stem output —
   Cloudflare R2 works). Create a **GPU** endpoint, and optionally a **CPU**
   endpoint (the same image runs on a CPU instance — the handler falls back to
   `CPUExecutionProvider`). Note each **Endpoint ID** and create an **API key**.
3. **Wire the Cloudflare worker** (per env):
   ```bash
   wrangler secret put RUNPOD_API_KEY         --env prod
   wrangler secret put RUNPOD_ENDPOINT_ID_GPU --env prod
   wrangler secret put RUNPOD_ENDPOINT_ID_CPU --env prod   # optional (cheaper tier)
   # optional override: RUNPOD_BASE_URL (defaults to https://api.runpod.ai/v2)
   ```
   One API key covers both endpoints. `RUNPOD_ENDPOINT_ID` is accepted as a
   legacy alias for the GPU endpoint. For local `wrangler dev`, put the same
   keys in `.dev.vars` (see `.dev.vars.example`).
4. **Measure cost-per-song** on a handful of real tracks (the printed/returned
   `cost.usd`) for each tier before turning the paid path on for users.

---

## Turning it on for the app

Today the front-end never sends the opt-in, so the RunPod path is dormant even
when configured. To make it user-facing later:

1. Add server tiers to the UVR processing-mode selector (`app-store.ts`
   `UvrProcessingMode` — e.g. `runpod-gpu` / `runpod-cpu`, GPU as the default
   server option).
2. Send `X-UVR-Provider: runpod` (GPU, the default) — or `runpod-cpu` for the
   cheaper tier — from `src/lib/uvr-api.ts processAudio` when a server mode is
   selected. (`?provider=…` works too.)
3. **Credit metering** (implemented; see [`docs/plans/premium.md`](../plans/premium.md)
   "Metering paid jobs"): the worker debits the tier's per-song credit cost via
   the db-worker when a job is accepted and refunds it on failure/cancel
   (`src/lib/uvr-metering.ts`; ledger endpoints in
   `workers/db-worker/src/billing.ts`). Activation is layered and each layer is
   inert until set:
   - `DB_API_URL` (wrangler.jsonc var, already set per env) — without it,
     no metering calls at all;
   - per-tier credit cost = the `credits` column of the `tier-runpod-gpu` /
     `tier-runpod-cpu` rows in `pricingPlans` (D1) — while NULL/0 the debit
     endpoint no-ops, so jobs run unmetered;
   - `wrangler secret put BILLING_SERVICE_KEY` on BOTH workers (same value) —
     authorizes the service-to-service refund path; refunds are skipped
     without it, so set it before setting tier costs.
   Insufficient balance → the worker cancels the just-submitted job and
   returns 402 `{ error, required, balance }`.

Everything downstream of `process` already works: the worker returns an
`rp_<tier>_`-prefixed session id, and status/output/cancel route to the right
endpoint from there.

---

## Observability (tracing a user's job in production)

The **session id (`rp_<tier>_<jobId>`) is the correlation key** at every hop:
it appears in the main worker's logs, its tail is the RunPod job id in the
RunPod console, and it is the `jobRef` on every credit-ledger row.

| Hop | Where the logs live | What is logged |
|-----|--------------------|----------------|
| Main worker (`mercurypitch`/`-dev`) | Cloudflare dash → Workers Logs (persisted via `observability.logs` in `wrangler.jsonc`), or `wrangler tail --env prod\|dev` | every request line; `[runpod]` accept (file, size, tier, inline/url), submit failures, terminal job errors, cancels; `[metering]` debit/refund outcomes |
| RunPod worker | endpoint → Logs / a worker's log view; job I/O in the Requests tab | `Job <id> start:` (file, size, source, model) and `Job <id> done:` (stems, storage, timings, cost) lines from `handler.py`, plus full tracebacks on failure (`Job <id> failed`) |
| db-worker (`mercury-pitch-db`/`-dev`) | same Workers Logs / `wrangler tail -c workers/db-worker/wrangler.jsonc --env …` | `[billing]` checkout grants (or metadata-missing errors), debits (grant/refusal with balance), refunds |
| Durable audit | D1 `creditLedger` | every purchase/debit/refund row with timestamps + idempotency keys — the source of truth for any billing dispute |

Debugging a report ("my separation vanished / charged but no stems"):
1. Get the session id from the client (or the user's ledger rows by userId).
2. `wrangler tail`/Workers Logs → grep the session id → shows accept, debit,
   terminal state, refund.
3. RunPod console → Requests tab → the job id (session id minus the
   `rp_<tier>_` prefix) → handler output incl. `timings`/`cost`; Logs tab →
   `Job <id>` lines + traceback.
4. D1 ledger by `jobRef` → exactly what was charged/refunded.

---

## Stem storage lifecycle (R2 is a transit buffer, not a library)

Stems live permanently on the **client**: the app downloads each stem right
after completion and persists it to IndexedDB (`saveStemBlob` in
`src/lib/uvr-processing-pipeline.ts`), where the stem mixer plays it from.
R2 only carries the bytes from the GPU worker to the browser.

Nothing needs the R2 object for long anyway:
- the app's `/output` route resolves the stem URL by re-reading the RunPod
  job status, and RunPod retains job results only ~30 minutes after
  completion — so the app path stops resolving within the hour;
- the presigned URL issued at upload expires after 24 h (`S3_URL_TTL_SECS`).

So the bucket carries **R2 lifecycle rules that expire `runpod/` and
`runpod-dev/` objects after 1 day** (R2 runs them roughly daily, no cron or
worker needed — set via `wrangler r2 bucket lifecycle add <bucket> <name>
<prefix> --expire-days 1`, view with `… lifecycle list`). Give any future
prod bucket the same rule at creation. Storage therefore stays at roughly
one day's traffic (~50 MB per song-pair) instead of growing forever.

---

## Security notes

- `process` and `DELETE /session` stay behind the existing app-JWT edge gate in
  `src/worker.ts` (signature + expiry), same as the container path — anonymous
  users can't spend GPU/CPU time or cancel jobs. (Credit/entitlement gating is
  a separate billing-layer concern — see [`docs/plans/premium.md`](../plans/premium.md).)
- `RUNPOD_API_KEY` is a worker **secret**, never shipped to the browser; the
  client only ever talks to `/api/uvr/*`.
- Inline base64 input is capped (`RUNPOD_MAX_INLINE_BYTES`, 7 MB) to stay under
  RunPod's request limit; larger uploads must use an `audio_url` (object
  storage), which is also the scalable production path.
