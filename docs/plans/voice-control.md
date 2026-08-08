# Voice control — hands-free practice transport

Status: phase 1 shipped (this branch), phases 2-4 pending.

## Why

While playing guitar or piano (or singing), operating the transport means
walking to the keyboard: stop, back to the top, skip past the intro, set an
A-B loop on the hard bars, next song, mute a stem. Every one of those breaks
the practice flow. The instrument is in your hands; the microphone is already
listening. Saying "from the top" or "loop this" should just do it.

Design goal: **say it, hear it happen, keep playing.** No keyboard, no mouse,
no looking at the screen.

## Architecture — three seams

```
mic ──> [ Ear: VoiceListener ] ──utterance──> [ Brain: command grammar ]
                                                      │ VoiceMatch
                                                      v
        [ HUD: VoiceControlHud ] <──feedback── [ Hands: dispatcher ]
                                                      │
                                        registered VoiceCommand sets
                                        (transport today; stem-mixer,
                                         guitar, jam adapters later)
```

1. **Ear — `VoiceListener`** (`src/features/voice-control/types.ts`).
   An engine-agnostic interface that emits _discrete final utterances_ plus
   interim text and state changes. Engines are swappable:
   - Phase 1: **Web Speech API** (`webspeech-listener.ts`). Zero download,
     ~300-800 ms from end-of-phrase to final text, continuous mode with
     auto-restart. Chrome/Edge/Safari; Firefox unsupported (the HUD says so).
   - Phase 2: **local model** — reuse the existing `WhisperService`
     (`Xenova/whisper-tiny`, WebGPU) with the 16 kHz ScriptProcessor capture
     pattern ShazamListen already uses, segmented by an RMS/VAD gate so only
     ~1-2 s utterances hit the model. Candidate alternative: Moonshine
     tiny (designed for streaming; smaller latency floor than whisper-tiny).
     A local engine must acquire the mic through `mic-manager.ts` and
     register a mic indicator — the Web Speech engine does its own capture
     inside the browser and never touches MicManager.

2. **Brain — command grammar** (`command-grammar.ts`). Pure, unit-tested,
   no model in the loop: normalize (lowercase, strip punctuation, number
   words to digits) then match the utterance against the phrases of the
   currently registered commands. Two properties matter:
   - **Full-utterance match only.** "play" matches; "play that funky music"
     (a lyric bleeding in from the backing track) does not. This is the main
     false-trigger defence while music is playing.
   - **`<n>` slots** for "forward twenty seconds" / "back 2 beats" /
     "speed 75 percent" — digits and English number words both parse.
     Leading "hey mercury" / "mercury" / "okay" and trailing "please" are
     stripped, so a wake-word habit works without being required.

3. **Hands — dispatcher + command sets** (`useVoiceControlController.ts`,
   `transport-commands.ts`). The controller owns the listener lifecycle, the
   persisted enable flag, and match feedback. Command sets are plain
   `VoiceCommand[]` values built from the _same handler surface the keyboard
   shortcuts use_ — `createTransportVoiceCommands` literally takes the
   `KeyboardShortcutHandlers` object App already builds, plus the A-B loop
   and seek deps. Voice can only do what a key press can already do; there
   is no second transport path to drift out of sync. New surfaces plug in by
   contributing their own command set (the adapter seam).

4. **Face — `VoiceControlHud`**. A fixed bottom-left pill (stacks above the
   practice-timer pill when both are visible): mic toggle button, listening
   state, live interim text, and "heard → did" feedback for ~2.5 s. Errors
   (mic denied, unsupported browser) surface here and as a toast. `V`
   toggles listening from the keyboard; the shortcut overlay documents it.

## Phase 1 — shipped on this branch

Command set (Singing tab fully; Piano game, Guitar and Compose get the same
routing the keyboard has; Karaoke is excluded exactly like the keyboard
shortcuts, until phase 3 gives it its own set):

| Say                                                                                         | Does                                                |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| play / start / go                                                                           | play, or resume when paused                         |
| pause / hold / hold on                                                                      | pause                                               |
| stop / finish                                                                               | stop                                                |
| again / restart / from the top / start over                                                 | seek to start and play                              |
| go to the start / beginning / rewind                                                        | seek to start                                       |
| forward N seconds, skip N seconds, back N seconds                                           | relative seek (bpm-converted)                       |
| forward N beats / back N beats                                                              | relative seek in beats                              |
| faster / slower                                                                             | next/previous speed step (same steps as arrow keys) |
| half speed / normal speed / full speed / double speed / quarter speed / three quarter speed | set speed                                           |
| speed N percent                                                                             | set speed to N% (clamped 25-200)                    |
| set a / loop start / mark a                                                                 | set loop point A at the playhead                    |
| set b / loop end / mark b                                                                   | set loop point B (arms the loop)                    |
| loop / toggle loop                                                                          | toggle loop                                         |
| loop on, loop off / stop looping                                                            | enable / disable loop                               |
| clear loop / remove loop                                                                    | clear A-B                                           |
| repeat mode / practice mode / normal mode                                                   | switch play mode                                    |

Scope decisions for phase 1:

- English only (`en-US`), matching the grammar.
- Final results only — no eager execution on interim text. Simple and never
  double-fires; the latency cost is ~300-800 ms and phase 2 attacks it.
- Feedback is the HUD, not toasts; toasts only for real errors.
- Off by default; the enable flag persists (`pitchperfect_voice_control_enabled`).

## Phase 2 — latency + robustness (the "really fast" pass)

- Local utterance engine behind `VoiceListener`: mic (via MicManager) →
  RMS gate → 1-2 s utterance buffer → whisper-tiny (already shipped) or
  Moonshine tiny. Target <300 ms end-of-phrase to action, offline-capable.
- Eager interim matching with a stability window (execute when an interim
  transcript exactly equals a command and doesn't change for ~150 ms),
  with a cooldown to prevent double-fire when the final confirms.
- Echo hardening: while `isPlaying()`, optionally require the wake word, or
  correlate against the playing stems; headphones make this moot.
- A confidence threshold if the engine reports one.

## Phase 3 — more adapters (the point of the seam)

- **Karaoke / StemMixer**: "mute drums", "solo vocals", "vocals up",
  "next song", "previous song" (karaoke-playlist-store transport), section
  jumps ("go to the chorus" via the synced lyrics segments).
- **Guitar**: "count me in", "drums on/off", tempo by name ("ninety bpm"),
  "switch to tab view".
- **Piano / falling notes**: "wait mode on", hand selection, "practice the
  bridge" via section markers.
- Registration API is already in place: a surface calls
  `registerCommands(set)` on mount and disposes on cleanup.

## Phase 4 — polish

- Per-command enable/synonym editing in Settings; localized grammars.
- Spoken confirmations (earcon or short TTS) as an option for eyes-free use.
- Jam rooms: voice transport gated by the room's transport rules.

## Risks and mitigations

| Risk                                                | Mitigation                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| Backing track lyrics trigger commands               | full-utterance match; wake-word option (P2); headphones              |
| Web Speech unavailable (Firefox, offline)           | HUD states it plainly; P2 local engine removes the dependency        |
| Chrome ends continuous sessions after ~60 s silence | listener auto-restarts on `end` while enabled                        |
| Whisper-tiny hallucinates on silence                | existing hallucination guard patterns; RMS gate feeds it only speech |
| Mic permission denied                               | error state in HUD + toast, flag stays off                           |

## Testing

- `command-grammar.test.ts` (colocated): normalization, number words,
  slot parsing, full-match strictness (lyric strings must not match),
  wake-word stripping, every phase-1 phrase.
- Transport wiring is exercised through the same handlers the keyboard
  tests cover; the dispatcher is pure enough to unit-test with fake
  command sets.
- Manual: Chrome, Singing tab, backing track playing through speakers —
  the acceptance bar is "play / stop / from the top / set a / set b /
  loop off / faster" all land while strumming, hands never leaving the
  guitar.
