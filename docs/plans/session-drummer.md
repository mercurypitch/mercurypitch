# Guitar Night session drummer — Walnut Studio

Status: implementation for owner testing, September 2026. One feature PR;
merging is a separate owner decision.

## Approved scope and retained research

The owner selected Walnut Studio and asked to integrate the existing drum set
before expanding the content. This first slice reuses the 16 original Drum Night
grooves in Rock, Funk, Jazz, Latin and Electronic, plus all seven existing Guitar
Night kit choices. It introduces no downloaded MIDI corpus or new drum samples.

The full research, original phased plan, prompts and all alternative skin masters
remain at `<user-dotfiles>/personal/mercurypitch/guitar-jammer/session-drummer-2026-09-14/`.
`STATUS.md` there records the working branch and verification handoff. Those
private paths and research archives are not application dependencies.

## Shipped behavior

- A compact Drummer control joins the existing header utilities in both Guitar
  room layouts. An adjacent Stop stays one click away while armed or starting.
  The recorder, Listening and transport keep their established positions.
- The approved frame surrounds real, accessible Genre → Beat → Bars → Fills
  wheels. Mouse wheel, pointer/touch drag, click, arrows, Home and End work.
  Desktop uses four columns; phones use two-by-two with vertical scrolling.
- Phrases repeat over 2, 4, 8 or 16 bars. Optional fills occur every 2/4/8/16
  bars, limited to the selected length. A snare pickup or snare-to-tom descent
  replaces the final beat's hand hits; the authored kick remains. A following
  crash is deduplicated at phrase boundaries. These are intentionally simple
  starting variations, not a new curated performance library.
- Start and Surprise me are explicit playback gestures. Browsing or returning
  does not start sound, Listening, monitoring or recording. Surprise avoids
  immediately repeating the selected groove and retains kit/level choices.
- While playing, choices automatically replace the pending change at the next
  bar (or next short A/B boundary). A brief status names the upcoming groove;
  there is no Apply button. Level changes use an immediate short gain ramp.
  Choices made during audio warm-up are retained, and Stop cancels pending sound.
- Preferences use a versioned localStorage key, bounded values and retired-ID
  fallbacks. Playback state is never persisted.

## Clock, audio and ownership

| Host                                    | Current timing contract                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| Free form / Live / recording            | Manual BPM, independent of recording; finishing an idea does not stop the drummer       |
| Audio Play Along / recorded-take Replay | Manual BPM; explicitly independent of the audio, without claiming an inferred beat grid |
| Recorded-melody Practice                | Borrows the existing practice band clock; melody remains the score target               |
| Rehearse the tab                        | Borrows exact score tempo-map, speed, count-in, seek and A/B scheduled windows          |
| Guided First Win                        | Unchanged; retains its constrained rhythm choices                                       |

`src/lib/session-beat-clock.ts` is an inert subscription boundary. The Guitar
band emits bounded upcoming beat windows and stop events. The session-drummer
engine schedules through the existing lazy Guitar/Drum player and the room's
drums bus. Score following adds no second timer or transport. Manual jamming
uses a 25ms lookahead scheduler with 120ms horizon, skipping stale events after
background stalls. Its independent tempo is honestly supported from 40–300 BPM;
the score path uses the host's actual musical projection, without another clamp.

The engine owns only its player, gain, scheduler and UI callbacks, never the
AudioContext. Cancellation generations retire late activation, host/clock
changes park accompaniment, queued hits are panicked on pause/stop, and unmount
allows the release tail before disconnecting. Existing sampled-kit loading and
synth fallback behavior are reused, with readiness text and CC BY links.

Joint Start with score yields the drummer dialog before invoking the host's
normal Play lifecycle. Existing Listening/microphone consent and paused-take
admission stay authoritative. A second running check prevents late warm-up from
toggling an already-started host back to Pause.

All current grooves are 4/4. A score containing another meter is unavailable
with an explanation; it never silently receives 4/4 accompaniment. A/B windows
clip the arrangement to their actual musical positions instead of adding a
whole fill outside the loop.

No changes are inserted into the low-latency monitor, detector or dry recording
path. Existing backing parts are not silently muted or written over. They remain
controllable through the existing mixer; the drummer has its own source level.

## Artwork and licences

The approved generated `assets/a-walnut-studio.png` master is retained in the
dotfiles pack at 1536×1024. The application copy is
`public/guitar-night/walnut-drummer.webp`, mechanically resized to 1152×768 and
encoded at WebP quality 85 (59,958 bytes). CSS nine-slice framing keeps decoration
outside the controls on phone and desktop. The image is decorative, not a
rasterized interactive UI; the dark backing and semantic controls remain usable
without it. Other skins are preserved for later selection, not shipped or gated
behind unimplemented supporter entitlements.

The existing original groove provenance and kit licences are unchanged. Every kit
whose licence asks for a notice links its bundled one from the picker; the kit
options declare that, and `src/tests/guitar-night-kit-credits.test.ts` checks the
declaration against the kit manifest. No new rights claims are made about
third-party research downloads.

## Verification

- Arrangement tests: all 16 originals, lengths/fill replacement, crash
  deduplication, corrupt preferences, surprise selection, unsupported meters.
- Engine tests: actual context timestamps, fractional seeks and phrase seams,
  loop-safe changes, no resurrection after Stop, manual timer cancellation,
  borrowed graph ownership and non-truncated disposal ramp.
- Controller tests: inert browsing, automatic next-bar queuing, edits during
  warm-up, persisted choices, live level state,
  Listening-modal handoff, asynchronous host-start race, cancellation,
  clock unsubscription and unavailable-score guard.
- Real-browser `@smoke`: audible PCM without input, fade to silence, score pause
  and resume, Practice consent handoff, mouse wheel, pointer drag, keyboard,
  reload persistence and phone layout. Native touch swipes, taps and cancellation
  run at phone and tablet sizes; computed button chrome and neighboring host
  controls are checked outside the modal. Existing recorder/Listening/practice
  regression tests and the repository mobile audit complement these checks.
- Guitar Night currently has no guided route tour; the legacy Guitar workspace
  tour is not changed. The new chip has a stable future tour target.

## Follow-up decisions after the first audition

- Add the owner's original MIDI patterns, richer fills, Metal/Shuffle/Pop
  groups and compatible A/B variations when their content is approved.
- Add a manual downbeat anchor/tap tempo and alignment-aware Replay/Play Along
  synchronization; current manual mode does not claim song sync.
- Add an optional temporary original-drums mask. Until then the ordinary mixer
  controls authored/separated drums; mixed audio cannot isolate them locally.
- Consider phrase-length-specific boundary previews, favorites/reproducible
  surprise history, additional meters and explicit drummer voice commands.
- Evaluate other room adapters and optional cosmetic skins after Guitar testing.

These items are deferred deliberately; no placeholder controls imply they exist.
