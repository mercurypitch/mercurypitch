# Mercury Sing — sing first, the song joins you

Status: planned; approved as the next voice-control flagship. Companion to
[voice-control.md](voice-control.md) and the catalog in
[../VOICE-COMMANDS.md](../VOICE-COMMANDS.md).

## The experience

Say **"Mercury Sing"**. The stage dims into a listening state. You just
sing — no browsing, no picking. The app matches your live melody AND your
lyrics against your karaoke library, and the moment one song's confidence
is high and stable, Karaoke Night opens on that song, **seeked to the spot
you are singing right now**, backing track already rolling. The song joins
you, not the other way around.

## Why this is closer than it looks

Almost every hard part already ships:

| Piece                                                                | Where it lives today                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Live pitch contour from the mic                                      | `src/lib/shazam/live-pitch-buffer.ts` + the shared pitch pipeline              |
| Melody matching (multi-feature DTW: pitch, interval, chroma, rhythm) | `src/lib/shazam/melody-matcher.ts`                                             |
| Fingerprints for karaoke stem sessions                               | `src/lib/shazam/stem-fingerprinter.ts`                                         |
| Lyric capture while singing (Web Speech / whisper)                   | `ShazamListen.tsx` speech assist + `useWhisperTranscription`                   |
| Lyric matching                                                       | `src/lib/shazam/lyrics-matcher.ts`                                             |
| Per-session cached transcriptions with word timestamps               | whisper-transcription IndexedDB service                                        |
| Best-fit seek position per stem session                              | ShazamListen's per-candidate seek search (`lr.songId === candidate.sessionId`) |
| Open a session at an offset, auto-playing                            | `StemMixer` `initialSeekSec` + `autoPlay` + the voice launch intent            |
| Karaoke Night session deep link                                      | `?session=` restore in `KaraokeNightApp`                                       |
| The voice trigger machinery                                          | the whole voice-control stack                                                  |

The genuinely new work is orchestration: a trigger, a listening stage, an
auto-open decision policy, and the offset-carrying Karaoke Night launch.

## Design

### M1 — trigger and stage

- [x] Voice command **"mercury sing"**. The grammar strips the wake word, so
      this needs a small, general addition: when the filler-stripped tokens
      match nothing, retry with the RAW tokens — then `mercury sing` is an
      ordinary two-token phrase and the brand phrase works verbatim.
      Aliases: `shazam sing`, `find my song`, `name this song`,
      `what am i singing`. Deliberately NOT bare `sing` (it is a lyric
      word). Shipped as the grammar's brand-phrase retry.
- [x] A minimal listening stage (feature module `mercury-sing/`): dimmed
      overlay, live "hearing you" pitch trail, top-3 candidates with the
      existing confidence breakdown, cancel by voice (`stop listening`,
      `cancel`) / Escape / click. Headless engine
      (`mercury-sing-engine.ts`) over ShazamListen's machinery — the
      component itself stays a thin skin.
- [x] Mic through the AudioEngine/MicManager path (indicator + release on
      close), voice listener keeps running (it must hear "cancel"); the
      wake-word-required mode is forced ON inside the stage
      (`acquireWakeWordHold`) so singing cannot trigger transport
      commands, while the stage's own words are `ignoresWakeWord`.

### M2 — matching fusion and the auto-open policy

- [x] Fingerprint the karaoke library on stage open (stem-fingerprinter over
      completed sessions, cached; incremental for new sessions). Sessions
      without a cached vocal transcription still match on melody alone.
      Shipped as the engine's background fingerprinting queue — the first
      session teaches the library while the user sings.
- [ ] Fused score per candidate: melody DTW score blended with the lyric
      match when live lyrics are available (weighting configurable;
      lyrics dominate once enough words land — words are near-unique,
      melody disambiguates covers of the same words). Melody-only today.
- [x] Auto-open policy — NOT a raw one-shot threshold: open when the top
      candidate holds `score >= threshold` (default 0.95) with a clear
      margin over #2 for a sustained window (~2 s), after a minimum of
      sung material (~6 s). Hysteresis prevents the "picked 3 times"
      failure class by construction — plus a short dip-grace window and a
      one-open latch (`auto-open-policy.ts`, pure and heavily tested).
      Manual pick from the top-3 stays available the whole time (tap or
      `sing number one`).
- [x] Offset estimate: DTW alignment gives where the singer's captured
      chunk starts in the song; launch offset = that start plus the sung
      duration, minus a pre-roll (`PRE_ROLL_SEC`) so the backing meets
      the singer, not chases them. Lyric-timestamp refinement lands with
      the fusion pass above.

### M3 — the handoff

- [x] Karaoke Night deep link grows `&t=<seconds>` (consumed into the
      mixer's `initialSeekSec`) alongside `&autoplay=` — one launch
      contract shared by Mercury Sing, Shazam and any future launcher,
      built and parsed in `karaoke-night-link.ts`, consumed once at boot
      and stripped from the URL.
- [ ] In-app variant: same contract through the `uvr-session-mixer` route
      for users already inside the app (setting: open in Karaoke Night vs
      Karaoke tab; default Night, per the owner).
- [ ] The stage announces the match in the pill ("Dance of Death — joining
      you at 1:42") and hands the mic straight to the karaoke scoring
      pipeline, so the take keeps scoring from the moment the band comes in.

### M4 — polish

- [ ] Confidence sparkline per candidate while listening (the breakdown
      data already exists).
- [ ] "Not that one" voice rejection — drops the current top candidate and
      keeps listening.
- [ ] Practice-history bias: songs sung recently rank slightly higher on
      ties.

## Risks

| Risk                                    | Answer                                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| False open mid-verse                    | sustained-window + margin policy; manual pick always visible; `not that one` undo                                                                                                                                  |
| Big library = slow matching             | fingerprints cached and incremental; matching already runs live in ShazamListen at interactive rates                                                                                                               |
| No transcription cached for a session   | melody-only matching still works; lyric weight kicks in per-session opportunistically                                                                                                                              |
| Own singing triggers transport commands | wake-word-required forced on inside the stage                                                                                                                                                                      |
| Offset lands late                       | pre-roll compensation measured against the real open latency, tuned on device                                                                                                                                      |
| Browser blocks the cross-page autoplay  | a voice launch carries no user activation, so the fresh page's autoplay may be refused: the song still lands staged and seeked, one tap from rolling — measure in the field before adding a "tap to join" fallback |
