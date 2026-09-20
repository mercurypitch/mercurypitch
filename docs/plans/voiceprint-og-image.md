# A shared voiceprint link that unfurls

Branch: `feat/voiceprint-og-image`, stacked on `feat/voiceprint-share-link` (PR #837).

## The problem

PR #837 made a shared link _open_ on the sender's voiceprint. It does not make the link
_look_ like one. Pasted into WhatsApp, Discord, Slack or X, it still unfurls with the
generic `mirror-og.png` — because crawlers do not run JavaScript, so the payload sitting in
the query string is invisible to them.

Most shares are seen by more people than click them. The unfurl is the advert.

## What we have to work with

Better than expected, and it decides the whole design:

| Asset                                   | Where                                                                     | Why it matters                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Worker in front of every request        | `src/worker.ts`, `main` + `assets` binding                                | `/mirror` is served via `env.ASSETS.fetch`, so `HTMLRewriter` can rewrite meta tags per request |
| `SHARE_STORE` KV                        | bound in prod, dev **and** preview                                        | storage, if we want it                                                                          |
| Build-time OG rendering, already proven | `scripts/generate-karaoke-og.mjs`                                         | renders HTML to PNG with **Playwright Chromium**, self-contained, deterministic                 |
| OG cache-busting                        | `scripts/gen-og-versions.mjs`, `src/tests/og-image-cache-busting.test.ts` | a convention to slot into, not invent                                                           |
| 33 legend portraits                     | `public/legends/*.webp`                                                   | a bounded set — this is the key number                                                          |

The last row is what makes this cheap. A voiceprint's _image_ is essentially its twin; only
the numbers are per-person. Thirty-three is a small enough set to render ahead of time.

## Options

### A — the client uploads the card it already drew

At results time, POST the rendered PNG to KV; the OG tag points at it.

- **Image**: pixel-exact, literally the card the sender saw.
- **Cost**: ~150–300 KB per completed voiceprint. At ~310/month on a 30-day TTL, **~46–90 MB** steady state. Inside KV's free tier.
- **Needs**: an upload endpoint, rate limiting, TTL management, a client upload path.
- **Race**: a crawler that arrives before the upload lands gets the generic image. Uploading at `results_view` rather than at share time mostly closes this, at the cost of uploading for people who never share.
- **iOS**: uploading _during_ the share tap risks breaking `navigator.share` — `card-renderer` already notes Safari only honours share actions that begin inside the tap. Pre-warming avoids it.

### B — per-legend images at build time, per-person numbers in the text

Render 33 OG images once, at build time, with the technique `generate-karaoke-og.mjs`
already uses. The Worker rewrites `og:image` to the sender's legend, and puts their actual
numbers in `og:title` / `og:description` — which every unfurl renders as text beside the
image.

- **Image**: the twin card, not that person's exact card.
- **Cost**: zero storage, zero runtime rendering, cache-forever at the edge.
- **Needs**: a build script and an `HTMLRewriter` pass. No upload path, no TTL, no KV.
- **Size**: 33 × 1200x630. As JPEG q85 that is roughly 5 MB, as PNG roughly 13 MB. Emit into `dist/` at build rather than committing to `public/`, so it is a deploy cost and not a repository one.
- **Failure mode**: none worth the name. A payload with no twin falls back to today's generic card.

### C — render per-request in the Worker

Satori + resvg-wasm, composing the card on the fly.

- **Image**: per-person and stateless.
- **Cost**: ~1.5 MB of wasm in the Worker, on every route, plus CPU per crawler hit.
- **Real objection**: it is a _second renderer_. The card would be drawn by Chromium in the app and by resvg in the Worker, and the two will drift. We would be maintaining two visual definitions of the same artifact.

### On "upload ahead of time, then overlay the metadata"

Worth writing down because it is the intuitive design and it dissolves on contact:

- If we upload the card **the client already drew**, the numbers are _already on it_
  (`renderTwinFaceCard({ showData: true })`). There is nothing to overlay. That is option A,
  and it is simpler than the overlay version.
- If we upload only the 33 **base** cards and overlay numbers at request time, we need a
  text renderer in the Worker — which is option C's wasm, with option B's image quality.
  Strictly worse than either.

So the overlay step is never the cheap part. Either the numbers are baked in by the client
(A), or they live in the unfurl's text (B).

## Decision

**A**, chosen by the owner on 2026-09-20: _"sharing not theirs image in OG image is not
interesting."_ Correct — an unfurl showing a legend card that is not the sender's own take
is decoration, and decoration does not get forwarded.

B is left written down above because it remains the cheap fallback if storage ever becomes
a problem.

### How A avoids its two traps

**The share sheet never waits on the network.** The client picks the card id itself, so the
link is complete the instant the tap happens and `navigator.share` opens inside the
gesture, which is all Safari will accept. The upload runs beside it, unawaited.

**Nothing leaves the device unless someone shares.** The upload is on the share path, not
on `results_view`. "It all happens on your device" stays true for everyone who never taps
share — which, at a 1.3% share-to-return rate today, is nearly everyone.

### What review changed before it shipped

- **`/mirror` is listed in `assets.run_worker_first`.** It has a file, so the asset layer
  answered it and the rewrite below never ran. The single most important line in this
  feature is in `wrangler.jsonc`.
- **The upload is `shareCard`'s `onSheetOpening`**, not a call made before `shareCard`. A
  browser with no share sheet saves the picture and drops the link, so the earlier order
  uploaded a card on a plain save.
- **The stored card is always 1080 square.** A data card shared as a 1080x1920 story draws
  a second, square card for the unfurl; the store checks the PNG's IHDR and refuses any
  other size. One constant, `OG_CARD_SIZE`.
- **The rewrite asks the store before promising the picture.** A card that expired, or has
  not landed yet, keeps the stock image instead of an `og:image` that answers 404.
- **Accuracy and steadiness are 0-100 scores, not cents**, and are written `87/100`.
- **Staging links stay on staging** (`voiceprintShareBase`), so this can be tried on dev or
  a PR preview rather than only on production.

## What was rejected along the way

**B now. A later** — the original recommendation.

B is a few hours, has no ongoing cost and no failure modes, and its Worker plumbing —
detecting a voiceprint link, decoding the payload, rewriting the meta tags — is _exactly_
what A needs too. Nothing done for B is thrown away by doing A afterwards.

The thing B gives up is that the image shows the twin rather than that person's own card.
Against that: the unfurl still carries their real range and metrics as text, where
recipients actually read them.

## Design (option B)

### 1. Build step — `scripts/generate-voiceprint-og.mjs`

Modelled directly on `generate-karaoke-og.mjs`: inline the portrait as a data URI, lay out
1200x630 in HTML, screenshot with Playwright, write to `dist/og/legend/<slug>.jpg`.

One image per legend in `LEGENDS`, plus `dist/og/legend/_none.jpg` for a voiceprint with no
twin. Deterministic, so a rebuild does not churn the deploy.

### 2. Worker — rewrite the tags

In `src/worker.ts`, where `/mirror` is already served:

```
GET /mirror?v=<payload>
  → decode with the existing share-codec
  → on a valid voiceprint payload, HTMLRewriter the response:
      og:image        → /og/legend/<slug>.jpg
      og:title        → "<Twin> is my voice twin" | "A voiceprint"
      og:description  → "C3 – D5 · 2 octaves + 2 semitones · accuracy 87/100"
      og:url          → the full shared link
      twitter:image   → matching, per the existing cache-busting test's rule
  → an absent, malformed or non-voiceprint payload changes nothing
```

The decode is the same `decodeSharePayload` the client uses, so the Worker and the app can
never disagree about what a link means.

### 3. Privacy boundary, restated

The unfurl exposes exactly what the recipient was already sent: range, span, twin, the two
metrics. No name unless the singer typed one. Nothing new leaves the device — the payload
was already in the link before any of this.

One genuinely new consequence, and it should be a conscious choice: **an unfurl is rendered
by the chat platform's servers, so pasting a link tells WhatsApp or Discord that this URL
was shared.** That is true of every link anyone pastes, and the payload carries no identity,
but it is worth stating rather than discovering.

## Phases

| Phase  | Work                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------- |
| **P1** | `generate-voiceprint-og.mjs` + the 34 images, wired into the build                                 |
| **P2** | Worker `HTMLRewriter` pass + decoding, behind the existing share-codec                             |
| **P3** | Tests: the rewrite fires for a valid payload and is inert otherwise; cache-busting invariant holds |
| **P4** | Verify a real unfurl against a preview deploy                                                      |

## Out of scope

Option A's upload path, option C entirely, and any change to what the card draws.
