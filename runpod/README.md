# RunPod Serverless — Vocal Separation Worker

Server-side stem separation on RunPod serverless (scale-to-zero). This is the
paid "skip the wait" path: a mid-tier GPU separates a ~5-minute song in ~2–3
minutes, billed per second, with **zero idle cost** when no jobs are queued.
The on-device (browser) separator stays free and unlimited.

**One image, two tiers.** The same container runs on both serverless
endpoints the app dispatches to: a **GPU** endpoint (fast, the default) and an
optional **CPU** endpoint (cheaper, slower — runs the same handler on a CPU
instance, falling back to `CPUExecutionProvider`). The tier is chosen by the
caller; this image doesn't need to know which one it's running on.

This directory is deployed independently of the web app — it is a container
image, not part of the Vite/Cloudflare build.

## Contents

| File | Purpose |
|------|---------|
| `handler.py` | RunPod serverless handler — downloads input, separates, returns stems |
| `Dockerfile` | CUDA image; pre-bakes the default model to cut cold-starts |
| `requirements.txt` | Python deps (torch/onnxruntime come from CUDA wheels in the Dockerfile) |
| `test_input.json` | Sample job for the local test loop |

## Job contract

The handler receives RunPod's `input` object:

```jsonc
{
  "input": {
    "audio_url":     "https://.../song.mp3", // preferred — handler fetches it
    "audio_base64":  "<base64>",             // fallback for small/local files
    "filename":      "song.mp3",
    "model":         "UVR-MDX-NET-Inst_HQ_3", // optional
    "output_format": "FLAC",                  // WAV | MP3 | FLAC (FLAC keeps payloads small)
    "stems":         ["vocal", "instrumental"]
  }
}
```

Output:

```jsonc
{
  "stems": [
    { "stem": "vocal", "filename": "...", "url": "https://...",   // when S3/R2 is configured
      "size": 1234, "duration": 201.3 },
    { "stem": "instrumental", "filename": "...", "data_base64": "..." } // otherwise
  ],
  "model": "UVR-MDX-NET-Inst_HQ_3",
  "output_format": "FLAC",
  "device": "cuda",
  "storage": "s3",
  "timings": { "download": 1.2, "load_model": 0.0, "separate": 132.7, "upload": 2.1, "total": 136.0 },
  "cost":    { "gpu_usd_per_hr": 0.69, "billed_secs": 136.0, "usd": 0.0261 }
}
```

The `timings` + `cost` block is intentional: it makes **cost-per-song
measurable for real** from the first job — locally or on a deployed
endpoint — without any external accounting.

## Output storage

Set S3-compatible storage (Cloudflare R2 works) so stems come back as URLs
instead of inline base64. Base64 is only practical for small local-test
files; production must use storage to stay under RunPod payload limits.

| Env var | Meaning |
|---------|---------|
| `S3_BUCKET` | Bucket name |
| `S3_ENDPOINT_URL` | e.g. `https://<account>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Credentials (also accepts `AWS_*`) |
| `S3_REGION` | `auto` for R2 |
| `S3_PUBLIC_BASE_URL` | Public/CDN base for returned URLs; if empty, presigned GETs are used |
| `S3_URL_TTL_SECS` | Presigned URL lifetime (default 24h) |
| `S3_KEY_PREFIX` | Key prefix inside the bucket (default `runpod`). Set per endpoint to separate environments sharing one bucket — e.g. `runpod-dev` on the dev/test endpoint — and to scope prefix-based lifecycle rules |

Other tunables: `UVR_DEFAULT_MODEL`, `UVR_MODEL_DIR` (default `/models`),
`UVR_MAX_INPUT_BYTES` (default 100 MB), `RUNPOD_GPU_USD_PER_HR` (default
`0.69`, used only for the reported cost figure).

## Cost & cold-start tuning

RunPod bills **per second from when a worker starts until it stops** — there is
no charge while zero workers run. A billed worker spends time in three phases
(per the RunPod docs); each has a lever:

| Phase | What it is | Lever |
|-------|-----------|-------|
| **Start time** | Container init + loading the model into GPU memory | Model is **baked into the image** (no re-download) and **eager-loaded at startup** (`UVR_EAGER_LOAD=1`) so **FlashBoot** can snapshot the warmed worker and restore it in ~2s |
| **Execution time** | Separating the song | Lean one-shot handler + warm model reuse across jobs; set an **execution timeout** on the endpoint (~300s) to cap runaway jobs |
| **Idle timeout** | Seconds the worker stays up after a job (default 5s) | Tune in endpoint settings — higher reuses the warm worker for a burst of songs, lower cuts idle billing |

The handler caches the loaded model across warm invocations, so a second song
on a still-warm worker skips Start time entirely. The full endpoint-settings
recommendations (min/active/max workers, FlashBoot, timeouts, GPU tier) live in
[`docs/claude/RUNPOD.md`](../docs/claude/RUNPOD.md).

## Build & deploy

```bash
# 1. Build and push the image (pinned version tag — never point the
#    endpoint at `latest`; bumping the tag is the controlled release)
docker build -t <registry>/mercurypitch-uvr-runpod:v0.1.0 runpod/
docker push  <registry>/mercurypitch-uvr-runpod:v0.1.0

# 2. RunPod console → Serverless → New Endpoint (type: Queue)
#    - Container image: the pushed tag
#    - GPU: RTX 4090-class (mid-tier) for the ~2-3 min/song target
#    - Active workers: 0  (scale-to-zero — no idle cost)
#    - Max workers: small to start (e.g. 3)
#    - Container disk: 20 GB (the CUDA + torch image is ~10 GB unpacked)
#    - Env: the S3_* vars above

# 3. Note the Endpoint ID; create an API key (RunPod → Settings → API Keys).
#    Wire both into the Cloudflare worker (see docs/claude/RUNPOD.md):
#      wrangler secret put RUNPOD_API_KEY   --env prod
#      wrangler secret put RUNPOD_ENDPOINT_ID --env prod
```

## Measure cost-per-song locally

```bash
cd runpod
pip install -r requirements.txt   # plus torch/onnxruntime for your platform
# point test_input.json at a real audio URL, then:
python handler.py                  # runs once against test_input.json, prints timings + cost
```

Read `cost.usd` from the printed output — that is your measured cost for
that track. Run a handful of representative songs to get a real average
before turning the paid path on.

## How the app talks to this

The Cloudflare worker (`src/worker.ts`) bridges the app's existing
`/api/uvr/*` contract to RunPod's job API via `src/lib/runpod.ts`, so the
front-end needs no new contract. It is **gated behind `RUNPOD_API_KEY` + at
least one tier endpoint (`RUNPOD_ENDPOINT_ID_GPU` / `RUNPOD_ENDPOINT_ID_CPU`)
and an explicit opt-in** (`X-UVR-Provider: runpod` for GPU, `runpod-cpu` for
CPU), and is off by default — the existing container path is unchanged until
you switch it on. See `docs/claude/RUNPOD.md`.
