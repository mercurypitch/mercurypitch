# Pop-free audio start/stop/seek (MANDATORY for anything audible)

Users run this app into PAs and big speakers. A bare `HTMLAudioElement`
`play()` / `pause()` / `currentTime = x`, or an un-enveloped
`AudioBufferSourceNode.start()/stop()`, creates a full-scale waveform
discontinuity — an extremely loud pop. This has been fixed repeatedly;
never reintroduce it.

## The rule

Every audible start, stop, pause, and seek goes through a Web Audio
`GainNode` envelope. Never rely on `HTMLMediaElement.volume` (not
sample-accurate) and never start/stop the transport at non-zero gain.

**SHAPE matters as much as length.** Loudness is logarithmic: a linear
ramp packs most of its perceived change into its last milliseconds, so at
a silence↔music boundary even a 50 ms linear fade reads as a "squeezed"
pop (user-confirmed on a PA, 2026-07-30). Short LINEAR dips are fine only
inside continuous material (seeks), where the program masks them.

House envelope constants (`ENVELOPE_DEFAULTS` in
`src/lib/preview-player.ts` — configurable per player):

| Transition | Shape | Length |
|---|---|---|
| start / resume | `exponentialRampToValueAtTime(1)` from the 0.0001 floor (`openEnvelope`) | 90 ms |
| pause / stop | `setTargetAtTime(0, now, len/5)` (`closeEnvelope`), **then** stop the transport after len + slack | 180 ms (+60 ms slack) |
| seek while playing | linear dip to 0 (15 ms) → move position → linear back (15 ms) | 2×15 ms |

Order matters: open the envelope only after playback is running; close it
fully before pausing/stopping. A `play()` racing a fade-out must cancel
the queued pause. `openEnvelope`/`closeEnvelope`/`dipEnvelope` are
exported for surfaces that own their audio graph (OfflinePitchCanvas
uses them).

## Use the existing implementations

- **One-shot element playback** (stem previews, auditioning a file):
  `createPreviewPlayer()` in `src/lib/preview-player.ts` — envelope,
  seek-dip, race handling and a no-Web-Audio fallback (jsdom) built in.
  Its contract is locked by `src/tests/preview-player.test.ts`.
- **Multi-track buffer playback**: the stem-mixer transport
  (`useStemMixerAudioController` — `createSources` ramps in,
  `disconnectSources` ramps out with `FADE_OUT_MS`). New tracks MUST get
  their nodes stored back on the track (label-keyed), or they become
  unstoppable and layer on every play.
- **Synth voices**: ADSR scheduling in `audio-engine.ts`
  (`_scheduleSustainEnvelope`) and `tone-player.ts`.

## Review checklist for new audio code

1. `grep new Audio(` / `createBufferSource` — does every audible path have
   a gain envelope between source and destination?
2. Does anything call `pause()`/`stop()` without a preceding ramp-to-zero?
3. Does seek jump `currentTime` while signal is flowing?
4. Rapid toggle (play→pause→play) — does the pending pause get cancelled?
