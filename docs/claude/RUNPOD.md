# RunPod Serverless — Deploy & Cost Runbook

Server-side stem separation runs on a **RunPod serverless GPU endpoint**
(scale-to-zero). It is the GPU "fast / quality" path: a mid-tier GPU
separates a ~5-minute song in ~2–3 minutes vs the 10–30 minute on-device
wait. The on-device (browser) separator stays free and unlimited; this only
removes the wait.

The worker image lives in [`runpod/`](../../runpod/README.md). The web app
reaches it through the Cloudflare worker, which bridges the app's existing
`/api/uvr/*` contract to RunPod's job API (`src/lib/runpod.ts`).

**Status: built, off by default.** Nothing changes until `RUNPOD_API_KEY` +
`RUNPOD_ENDPOINT_ID` are set on the worker *and* a request opts in. With
RunPod unset, `/api/uvr/*` continues to hit the CPU container exactly as
before.

---

## How a request flows

```
browser ──POST /api/uvr/process (X-UVR-Provider: runpod)──▶ Cloudflare worker
   worker ──POST {endpoint}/run {input}──▶ RunPod  ──▶ {id}
   worker returns session_id = "rp_<id>"
browser ──GET /api/uvr/status/rp_<id>──▶ worker ──GET {endpoint}/status/<id>──▶ RunPod
browser ──GET /api/uvr/output/rp_<id>/vocal──▶ worker ──302──▶ stem URL (R2/S3)
```

The bridge is **stateless**: the RunPod job id is carried inside the session
id (`rp_<id>`), so status/output/cancel route straight back to RunPod with no
session store. Stems come back as object-storage URLs (the worker 302-redirects
to them) or, for small local-test jobs, inline base64 the worker streams.

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
- **Container disk: ~5–10 GB** — fits the CUDA image + baked model.

---

## Deploy

1. **Build & push the worker image** (see [`runpod/README.md`](../../runpod/README.md)):
   ```bash
   docker build -t <registry>/mercurypitch-uvr-runpod:latest runpod/
   docker push  <registry>/mercurypitch-uvr-runpod:latest
   ```
2. **Create the serverless endpoint** in the RunPod console with the settings
   above; set the `S3_*` env vars (object storage for stem output — Cloudflare
   R2 works). Note the **Endpoint ID** and create an **API key**.
3. **Wire the Cloudflare worker** (per env):
   ```bash
   wrangler secret put RUNPOD_API_KEY      --env prod
   wrangler secret put RUNPOD_ENDPOINT_ID  --env prod
   # optional override: RUNPOD_BASE_URL (defaults to https://api.runpod.ai/v2)
   ```
   For local `wrangler dev`, put the same keys in `.dev.vars` (see
   `.dev.vars.example`).
4. **Measure cost-per-song** on a handful of real tracks (the printed/returned
   `cost.usd`) before turning the paid path on for users.

---

## Turning it on for the app

Today the front-end never sends the opt-in, so the RunPod path is dormant even
when configured. To make it user-facing later:

1. Add a `runpod` option to the UVR processing-mode selector (`app-store.ts`
   `UvrProcessingMode`).
2. Send `X-UVR-Provider: runpod` (or `?provider=runpod`) from
   `src/lib/uvr-api.ts processAudio` when that mode is selected.
3. Gate behind credits/entitlements once billing ships (see
   [`docs/plans/premium.md`](../plans/premium.md)).

Everything downstream of `process` already works: the worker returns an
`rp_`-prefixed session id, and status/output/cancel route to RunPod from there.

---

## Security notes

- `process` and `DELETE /session` stay behind the existing app-JWT edge gate in
  `src/worker.ts` (signature + expiry), same as the container path — anonymous
  users can't spend GPU time or cancel jobs.
- `RUNPOD_API_KEY` is a worker **secret**, never shipped to the browser; the
  client only ever talks to `/api/uvr/*`.
- Inline base64 input is capped (`RUNPOD_MAX_INLINE_BYTES`, 7 MB) to stay under
  RunPod's request limit; larger uploads must use an `audio_url` (object
  storage), which is also the scalable production path.
