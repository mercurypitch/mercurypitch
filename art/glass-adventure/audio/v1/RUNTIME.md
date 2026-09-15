# Approved museum soundtrack delivery

Prepared 2026-09-15. Owner listening acceptance of the integrated soundtrack was received on the same day. M01 is the museum exploration track and M03 is the optional
garden track. A01, A02 and the quieter A03 v1 supply museum, garden and gallery
ambience. M02 is excluded from the active soundtrack; its master remains archived.
M04–M06 and A03 v2 remain available for later content. The original ten masters and
the original review MP3s are unchanged.

| Scene     | Music              | Ambience                    | Runtime loop length |
| --------- | ------------------ | --------------------------- | ------------------- |
| `museum`  | M01 Crystal Light  | A01 Air Between the Columns | 148.96s / 10.82s    |
| `garden`  | M03 Curious Garden | A02 Garden Water and Stone  | 116.80s / 12.02s    |
| `gallery` | M01 Crystal Light  | A03 Quiet Glass Gallery, v1 | 148.96s / 13.02s    |

`runtime-manifest.json` records the source hash, gain, overlap, lossless derivative,
delivery hash, measured loudness/peak and seam audition for each selected take.
All five MP3s together are 6,221,621 bytes (5.93 MiB). M01/A01 alone are loaded on
the initial museum request; garden and gallery assets are lazy.

## Derivation and loop seam

`prepare_runtime.py` checks each source SHA-256 before and after processing.
It applies the same constant gain as the approved preview, then overlaps the
actual tail with the head using a constant-sum raised cosine: 3 seconds for music,
1.5 seconds for ambience. The middle remains intact after gain. This retains the
full take through the overlap, rather than selecting a short repeating excerpt.
The playback origin shifts past the original head by that overlap duration.

The resulting 48 kHz stereo FLAC24 files live in `runtime-derivatives/`. Public
delivery uses 44.1 kHz stereo MP3 VBR q3 at
`apps/beside-cue/public/games/adventure-audio-v1/`. The browser resamples according
to its shared AudioContext, then repairs another 80 ms across the actual decoded
samples. This deliberately does not rely on an MP3 decoder honoring encoder-delay
metadata. No waveform is derived from image generation and no runtime WAV is used.

The six-second `runtime-derivatives/*-seam-audition.wav` files contain the repaired
end→start transition decoded from the actual MP3 delivery. They support listening
review; a clean sample boundary alone does not prove that a musical transition is
the best possible edit. Target-device owner audition remains a tuning gate.

Music delivery measures approximately -20 LUFS; ambience -27.47 to -27.96 LUFS
after overlap. Delivery peaks range from -7.23 to -16.96 dBTP. These are measured
preference defaults, not a hearing-safety or device-volume claim.

## Shared host contract

Factory: `packages/glass-game/src/browser/museum-audio.ts` exports
`createBrowserMuseumAudio({ assetUrl, readPreference, writePreference })`.
The public interface comes from `packages/glass-game/src/host.ts`.

- `assetUrl(id: string): string` resolves `audio-m01-loop`, `audio-m03-loop`,
  `audio-a01-loop`, `audio-a02-loop`, `audio-a03-loop` to the files above.
- `readPreference(key: string): string | null` and
  `writePreference(key: string, value: string): void` use key `museum-audio:v1`.
  Host storage may prefix this key. Storage failures leave a usable in-memory mix.
- `start(scene?)` returns `Promise<boolean>`. Call within the initiating gesture;
  output unlock happens before its first await. Repeated current/pending scenes
  deduplicate. Missing assets, denied unlock and the 15-second load deadline return
  false; the optional soundtrack does not block game use.
- `silenceForVoice()` invalidates pending playback synchronously and resolves only
  after every active/releasing graph has physically disconnected. A superseding
  start/pause/dispose invalidates the promise; the caller also checks its encounter
  token. Begin microphone acquisition/unlock within the gesture, but do not create
  the capture stream or process calibration until this barrier resolves.
- `pause()` clears exploration intent and begins release. `dispose()` additionally
  clears the buffer cache. Neither automatically restarts on foreground/resume.
- `preferences()` returns an isolated snapshot. `setPreferences(partial)` clamps
  finite volumes into 0–1 and persists `{ muted, musicVolume, ambienceVolume }`.
  Defaults: false / 0.65 / 0.55. Live volume edits ramp. Explicit unmute may restore
  an existing exploration intent, but cannot restore music during a voice handoff.

The host stops microphone capture before explicitly restoring music. Foreground,
pause, completion, route exit and encounter cancellation belong to the host. The
music service also independently retires pending/active sound through the shared
audio lease's suspension hook and actual suspended/interrupted state events.
Five per-track playheads survive voice, mute and background pauses in memory.
Explicit restoration resumes the release position instead of replaying the music
introduction; scene replacement samples a shared track's current position only
when its replacement is ready. Reloading the game starts the soundtrack anew.

## Ownership, envelope and memory

Each scene owns independent buffer sources and GainNodes. A ready replacement
starts a 600 ms exponential attack before the previous scene begins its 180 ms
release. Disposal grants 60 ms cleanup slack, matching the shared 240 ms audible
release contract. Mid-attack release anchors the scheduled gain, including on
browsers without `cancelAndHoldAtTime`. An old fade cannot stop a newer scene.
Frozen audio clocks retire immediately rather than replaying a stored tail later.

The cache holds at most one music and one ambience buffer. At a 48 kHz stereo
AudioContext, a museum/gallery cache is approximately 59 MiB of decoded float PCM;
the garden is approximately 47 MiB. Crossfading/loading temporarily also retains
the outgoing graph and decoder input/output. MP3 transfer size is not decoded
memory size. Physical mobile memory/performance remains a device test gate.

## Verification

21 focused unit tests cover real service/shared lease behavior with controlled
transport/audio boundaries: gesture unlock, scene deduplication and replacement,
late decode/fetch cancellation, no replay, bounded timeout, native release,
interrupted cleanup, stale release ownership, live volume anchoring, preferences,
decoded sample continuity, remembered playheads and a queued old suspension.

`runtime-browser-proof.json` records Chromium's actual MP3 decoding for all five
files and a real OfflineAudioContext rendering of the imported output module.
Only transport/state is substituted for offline scheduling. The measured release
RMS falls from 0.114258 to 0.001054 (0.9223%) at 160–180 ms, then becomes exactly
zero after the source stop. All repaired boundaries fall within normal neighboring
sample variation. No physical-device or musical owner-audition claim is implied.
The same browser proof also uses an actual live AudioContext to reproduce the
Cancel ordering: the last encounter lease queues `suspend()`, then fresh music
requests `resume()`. This failed before the startup guard and passes afterward.
Only a `suspended` event while fresh unlock is pending and no sources exist is
tolerated; native/page preparation and true interruption still cancel immediately.

With the existing source preview already running, reproduce without starting a
server:

```sh
rtk proxy env PATH=/home/maff/.nvm/versions/node/v22.22.2/bin:/usr/local/bin:/usr/bin:/bin MUSEUM_AUDIO_PROOF_URL=http://localhost:5188 timeout 120 node /home/maff/.codex/worktrees/00ad/mercurypitch-agent/art/glass-adventure/audio/v1/verify_runtime.mjs
```

The proof closes its own browser and preserves the preview server. Delivery
regeneration is explicit: run `prepare_runtime.py` from any directory; it resolves
all paths relative to its own archive location and writes only derivatives,
delivery files, auditions and `runtime-manifest.json`.
