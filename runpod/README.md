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
    "audio_url":     "https://.../song.mp3", // handler fetches it
    "audio_base64":  "<base64>",             // small files inlined in the job (≤7 MB)
    "audio_s3_key":  "input/<uuid>.mp3",     // big files: handler downloads from S3_BUCKET
    "filename":      "song.mp3",
    "model":         "roformer",              // optional registry name (see below)
    "output_format": "FLAC",                  // WAV | MP3 | FLAC (FLAC keeps payloads small)
    "stems":         ["vocal", "instrumental"]
  }
}
```

### Models

`model` is a registry name resolved (and allowlisted) by the handler —
never a raw weights filename. All weights are baked into the image.

| Name | Weights | What it is |
|---|---|---|
| `roformer` (default) | BS-RoFormer viperx 1297 | Highest single-model quality (vocals SDR ~12.9 vs ~10 for MDX); ~2-4x slower than MDX |
| `mdx` | UVR-MDX-NET Inst HQ_3 | The previous default; fastest tier |
| `karaoke` | Mel-Band RoFormer karaoke | Removes only the LEAD vocal — backing vocals stay in the instrumental (its stem is labeled `(Karaoke)` and mapped to `instrumental`) |
| `ensemble` | BS-RoFormer + Mel-Band RoFormer Kim, `avg_wave` | Max quality; ~2x the time of `roformer`, and ensemble members reload per job |

The legacy value `UVR-MDX-NET-Inst_HQ_3` is still accepted (maps to
`mdx`). Unknown names fail fast with the valid list — a job can't make
the worker download arbitrary weights on billable time. When adding a
model: extend `MODEL_REGISTRY` in `handler.py`, add the file to the
Dockerfile bake list, rebuild with a new tag, and mirror the entry in
`uvr-api/api.py` + `RUNPOD_ALLOWED_MODELS` in `src/lib/runpod.ts` +
the credit multiplier in `workers/db-worker/src/billing-core.ts`.

Credits: the app debits `tier base × model multiplier` per job
(billing-core `UVR_MODEL_CREDIT_MULTIPLIERS`). Since the 2026-07-06
measurements showed RoFormer is cheaper AND faster than MDX on the GPU,
pricing collapsed to the base for every user-facing model (`mdx`,
`roformer`, `karaoke` all 1x = **1 credit per song**); only the
unexposed two-model `ensemble` carries a 2x multiplier.

Precedence: `audio_s3_key` > `audio_url` > `audio_base64`. The web app's
Cloudflare worker inlines base64 up to 7 MB (the RunPod `/run` payload
limit) and, for larger uploads, streams the file to R2 under `input/` and
passes `audio_s3_key` — the handler then downloads it with its own S3
credentials (the source audio never gets a public URL). A 1-day R2
lifecycle rule on the `input/` prefix expires those staged inputs.

Output:

```jsonc
{
  "stems": [
    { "stem": "vocal", "filename": "...", "url": "https://...",   // when S3/R2 is configured
      "size": 1234, "duration": 201.3 },
    { "stem": "instrumental", "filename": "...", "data_base64": "..." } // otherwise
  ],
  "model": "roformer",
  "model_files": ["model_bs_roformer_ep_317_sdr_12.9755.ckpt"],
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
`UVR_MAX_INPUT_BYTES` (default 100 MB), `UVR_MIN_INPUT_SECONDS` (default
12 — RoFormer models need ~11 s of audio; shorter inputs would die with an
opaque tensor error mid-separation), `RUNPOD_GPU_USD_PER_HR` (default
`0.69`, used only for the reported cost figure).

## Separation quality

| Env (endpoint default) | Job override (`input`) | Default | Meaning |
|---|---|---|---|
| `UVR_INVERT_USING_SPEC` | `invert_using_spec` | **on** | Derive the vocal stem by spectrogram-domain inversion instead of time-domain subtraction. Time-domain leaves phase-misalignment bleed (instrumental audibly leaking into the vocal, varying by song); spec inversion matches the in-browser separator |
| `UVR_MDX_OVERLAP` | `mdx_overlap` | 0.25 | MDX chunk overlap (0.1–0.95); higher = smoother seams, slower |
| `UVR_MDX_DENOISE` | `mdx_denoise` | off | MDX two-pass denoise; cleaner output at ~2x inference time |
| `UVR_MDX_SEGMENT_SIZE` | `mdx_segment_size` | 256 | MDX segment size (64–4096) |
| `UVR_MDXC_OVERLAP` | `mdxc_overlap` | 8 | RoFormer/MDXC chunk overlap (integer 2–50 — different semantics from the MDX fraction); higher = smoother seams, slower. RoFormer checkpoints keep their own trained segment size |

The warm separator is cached per (model, quality) tuple: jobs using the
endpoint defaults never rebuild; an override rebuilds once (a few seconds).
Each job's resolved settings are logged in the `Job <id> start:` line and
echoed back as `quality` in the output.

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
docker build -t <registry>/mercurypitch-uvr-runpod:v0.2.1 runpod/
docker push  <registry>/mercurypitch-uvr-runpod:v0.2.1

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
