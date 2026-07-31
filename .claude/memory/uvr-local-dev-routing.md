# UVR local dev routing — the rules that keep /api/uvr working

Two interchangeable local backends serve `/api/uvr/*`; the vite proxy mode
MUST match the one that is running, or every request 500s/hangs:

| Mode | Launch | Proxy behaviour |
|---|---|---|
| Worker (auth + credits + RunPod) | `npx wrangler dev --port 8790 --var DB_API_URL:http://localhost:8788` + `VITE_UVR_WORKER=1 VITE_UVR_PROXY_PORT=8790 pnpm dev` | keeps the `/api/uvr` prefix |
| Container (free, on-GPU, no auth) | `docker compose -f docker-compose.yml -f docker-compose.rocm.yml up -d` (in `uvr-api/`) + `VITE_UVR_PROXY_PORT=8000 pnpm dev` | strips the prefix |

Hard-won rules — each of these cost a debugging session:

1. **Proxy target must be `127.0.0.1`, never `localhost`** (vite.config.ts).
   Node resolves `localhost` to `::1` first; the docker container only
   publishes on IPv4, so the proxy hangs with the page timing out while
   `curl 127.0.0.1:8000` works fine.

2. **`JWT_SECRET` must be identical in root `.dev.vars` AND
   `workers/db-worker/.dev.vars`.** The db-worker mints tokens, the UVR
   worker verifies them. Symptom of a mismatch: signed in, balance pill
   works, but processing says "Sign in to use cloud GPU processing" (401).
   `BILLING_SERVICE_KEY` must also match or metering 503s.

3. **The db-worker must run the same branch as the client.** An old
   db-worker serves a pricing payload without newer `uvrModelCredits`
   entries — cost pills silently vanish and split metering is wrong.

4. **Remote R2 binding needs a healthy Cloudflare API.** Worker boot errors
   "Could not create remote preview session" / "malformed response from the
   API" usually mean api.cloudflare.com itself is degraded — check
   `curl -w '%{http_code}' https://api.cloudflare.com/client/v4/user`
   (521 = Cloudflare outage; also cloudflarestatus.com) BEFORE debugging
   auth/config locally. Fall back to container mode until it recovers.

5. **Stem splits always exceed the 7 MB inline cap** — they re-upload the
   instrumental as uncompressed WAV (~10.6 MB/min). Worker mode therefore
   requires the remote R2 binding (top-level `r2_buckets` in wrangler.jsonc,
   `remote: true`, dev bucket only); the worker-side cap is 95 MB. Container
   mode has no transport cap.

6. **Split requests must name a server tier** — `buildStemSplitRequest`
   defaults `provider: 'runpod'`; without it the worker answers 400
   "Choose Server mode". The container ignores the header, so the default
   is safe in both modes.
