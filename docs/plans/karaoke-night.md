# Karaoke Night — standalone karaoke page (`/karaoke-night`)

A second standalone entry (like the Voice Mirror) that presents the karaoke
system as a focused, visually striking experience: theatre backdrop, a left
rail with upload + playlist, and the main stage running the same StemMixer
engine as the studio app — pre-loaded with a CC-licensed demo song.

Decisions (2026-07-16):

- Canonical path `/karaoke-night`, alias `/karaoke`; both emitted as real HTML
  files (SPA fallback beats the worker rewrite for navigations — see the
  mirror alias lesson, PR #250).
- Guests can upload: local (on-device) separation for free; server-quality
  separation stays the signed-in + credits path.
- Demo song: Josh Woodward — "Goodbye to Spring" (CC BY 4.0; attribution on
  the page). Loaded from a `demo-song.json` manifest so the song is swappable
  without code changes; assets live on R2, not in the repo.
- Shared views by refactor: the studio app and this page must render the same
  components — no forked karaoke UI.

## Architecture: the Mirror pattern

| Piece | Mirror (precedent) | Karaoke Night |
|---|---|---|
| HTML entry | `mirror.html` | `karaoke.html` (own SEO/OG + JSON-LD) |
| Bootstrap | `src/features/mirror/main.tsx` | `src/features/karaoke-night/main.tsx` |
| Vite input | `rollupOptions.input.mirror` | `input.karaoke` |
| CF Worker | `MIRROR_PATHS` rewrite (`src/worker.ts`) | `KARAOKE_PATHS` = {/karaoke-night, /karaoke} |
| Alias emission | `mirrorAliasFilesPlugin` (writeBundle copy) | emit `karaoke-night.html` + `karaoke.html` |
| Dev middleware | `mirrorRewritePlugin` | extend for karaoke paths |

Bundle stance: heavier than the Mirror is acceptable (product page), but
staged — hero/backdrop/demo shell first; the stage engine, audio pipeline and
upload/separation code lazy-load. ONNX loads only on an actual local-mode
upload. Whisper/transformers (auto-LRC for user uploads) stays lazy.

Same origin ⇒ the JWT in localStorage and the credit balance carry over —
no separate auth. Buy/credits deep-links into the app (`#/settings/credits`);
`billing-service.fetchPricing()` is public for price display.

## Coupling audit (PR 0 result)

`StemMixer` is already props-based — `StemMixerProps` takes stem URLs,
`sessionId`, `songTitle`, `practiceMode`, `requestedStems`, `initialSeekSec`,
`autoPlay`, `karaokeReferenceVocal`, `onBack`. Sole consumer: `UvrPanel`.
The controllers (`src/features/stem-mixer/`, ~6.1k LOC) import only
`settings-store`. Store edges from `StemMixer.tsx` itself:

| Import | Weight | Verdict |
|---|---|---|
| `app-store` → `startTour`, `STEM_MIXER_TOUR_STEPS` (+ `offerTourOnce`) | HEAVY — pulls the 2.7k-line app-store into the graph | **Sever**: move the tour offer behind an injected `onOfferTour?` prop (or relocate the steps); the standalone never imports app-store |
| `karaoke-playlist-store` → imports `app-store` (`getAllUvrSessions`, `getGroupsReactive`, `getUvrSession`) | HEAVY (transitive) | **Extract** those UVR-session accessors from app-store into a dedicated `uvr-store`; app-store re-exports for back-compat |
| `notifications-store` | trivial (solid-js only) | import as-is |
| `usage-store` | trivial (lib/storage only) | import as-is |
| `ui-store` (`karaokeFocus`) | light (tabs constants + lib) | import as-is |
| `settings-store` (mic controller) | light | import as-is |
| `useWhisperTranscription` | HEAVY (transformers.js) | lazy-load; not needed for the demo song (precomputed LRC) |

So the refactor is narrow: two heavy edges to cut, then the standalone entry
can render StemMixer directly.

## KaraokeStage (performance preset)

Introduce a `preset: 'studio' | 'performance'` surface (wrapper component or
prop) over StemMixer:

- `studio` (default, in-app): everything as today — edit toolbar, pitch
  analysis panel, LRC tooling, tour offer.
- `performance` (standalone): clean stage — transport, stem controls, synced
  lyrics, pitch lane, mic + score; no edit/analysis/tour chrome.

The demo song loads through the same props as any UVR session: stems from the
manifest URLs, LRC + precomputed pitch data from static assets, so the studio
engine and the demo are literally the same code path.

## Demo song manifest (`demo-song.json`)

```json
{
  "title": "Goodbye to Spring",
  "artist": "Josh Woodward",
  "attribution": {
    "text": "Music: \"Goodbye to Spring\" by Josh Woodward (CC BY 4.0)",
    "url": "https://www.joshwoodward.com/song/GoodbyeToSpring",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  "stems": { "vocal": "<r2-url>", "instrumental": "<r2-url>" },
  "lyrics": "<r2-url> (.lrc synced, or .txt until one exists)",
  "pitchData": "<r2-url>",
  "durationSec": 0,
  "key": "", "bpm": 0
}
```

Asset pipeline (once the audio is provided): HQ-separated stems → whisper +
`pitch-word-alignment` draft LRC → manual word-by-word QA in the existing LRC
edit tooling → offline pitch analysis, hand-cleaned in pitch-edit mode →
shipped as static JSON (zero client compute for the demo).

## Phases

- **PR 0 — this document** (audit + contract; no behavior change).
- **PR 1 — refactor**: extract `uvr-store`; inject the tour offer;
  add the `performance` preset; zero visual regression in the studio app
  (stem-mixer tour selectors must still resolve — lightweight tour check).
- **PR 2 — entry + routing**: `karaoke.html`, bootstrap, vite input + alias
  emission, worker `KARAOKE_PATHS`, dev middleware; placeholder page. Verify
  with a real browser navigation, not curl.
- **PR 3 — the page**: theatre backdrop + layout, left rail (upload/local
  separation for guests + slim playlist), stage in performance preset, demo
  song via manifest, footer links (open app / account / credits) +
  attribution block.
- **PR 4 — funnel + SEO**: page events, OG cards, JSON-LD, sitemap.
- Follow-ups: playlist UX polish for the full karaoke-night flow; server-mode
  upload surface on the page; additional demo songs (manifest already
  supports swapping).
