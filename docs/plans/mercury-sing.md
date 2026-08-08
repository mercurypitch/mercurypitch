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

- [ ] Voice command **"mercury sing"**. The grammar strips the wake word, so
      this needs a small, general addition: when the filler-stripped tokens
      match nothing, retry with the RAW tokens — then `mercury sing` is an
      ordinary two-token phrase and the brand phrase works verbatim.
      Aliases: `find my song`, `name this song`, `what am i singing`.
      Deliberately NOT bare `sing` (it is a lyric word).
- [ ] A minimal listening stage (feature module `mercury-sing/`): dimmed
      overlay, live "hearing you" pitch trail, top-3 candidates with the
      existing confidence breakdown, cancel by voice (`stop listening`,
      `cancel`) / Escape / click. Reuses ShazamListen's machinery lifted
      into a headless controller so both surfaces share one engine — the
      component itself stays a thin skin.
- [ ] Mic through MicManager (indicator + release on close), voice listener
      keeps running (it must hear "cancel"); the wake-word-required mode is
      forced ON inside the stage so singing cannot trigger transport
      commands.

### M2 — matching fusion and the auto-open policy

- [ ] Fingerprint the karaoke library on stage open (stem-fingerprinter over
      completed sessions, cached; incremental for new sessions). Sessions
      without a cached vocal transcription still match on melody alone.
- [ ] Fused score per candidate: melody DTW score blended with the lyric
      match when live lyrics are available (weighting configurable;
      lyrics dominate once enough words land — words are near-unique,
      melody disambiguates covers of the same words).
- [ ] Auto-open policy — NOT a raw one-shot threshold: open when the top
      candidate holds `score >= threshold` (default 0.95) with a clear
      margin over #2 for a sustained window (~2 s), after a minimum of
      sung material (~6 s). Hysteresis prevents the "picked 3 times"
      failure class by construction. Manual pick from the top-3 stays
      available the whole time (tap or `sing number one`).
- [ ] Offset estimate: DTW alignment end-point gives where in the song the
      singer currently is; when lyrics matched, the matched transcript
      segment's timestamp refines it. Launch offset = estimated position
      plus the open/handoff latency, minus a one-beat pre-roll so the
      backing meets the singer, not chases them.

### M3 — the handoff

- [ ] Karaoke Night deep link grows `&t=<seconds>` (consumed into the
      mixer's `initialSeekSec`) alongside the existing autoplay intent —
      one launch contract shared by Mercury Sing, Shazam and any future
      launcher.
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

| Risk                                    | Answer                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| False open mid-verse                    | sustained-window + margin policy; manual pick always visible; `not that one` undo                    |
| Big library = slow matching             | fingerprints cached and incremental; matching already runs live in ShazamListen at interactive rates |
| No transcription cached for a session   | melody-only matching still works; lyric weight kicks in per-session opportunistically                |
| Own singing triggers transport commands | wake-word-required forced on inside the stage                                                        |
| Offset lands late                       | pre-roll compensation measured against the real open latency, tuned on device                        |
