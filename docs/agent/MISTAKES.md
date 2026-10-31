# Agent mistakes — living log

Things that went wrong, and the rule that came out of each. This is the
highest-value document in `docs/agent/` because none of it is recoverable by
reading the code: it is the record of what the code _looks_ like it does versus
what it actually does.

**Read this before a first change in an unfamiliar area.** Skim the headings;
read the entry only if it touches your area.

---

## How to add an entry

Append when you (agent or human) hit something that cost real time and would
cost the next person the same. One entry, newest at the bottom of its section.

```markdown
### <Short imperative rule — the fix, not the symptom>

**Symptom:** what it looked like when it went wrong.
**Cause:** the actual mechanism.
**Rule:** what to do instead.
**See:** `path/to/file.ts:123`
```

### What qualifies

- A bug that shipped, or nearly shipped, because the code read as correct.
- Time lost to a tool, environment, or framework behaving unlike its docs.
- A repeated correction — if you have been told the same thing twice, it goes here.

### What does not

- Anything the type system or a lint rule already catches. Add the rule instead.
- One-off typos, or a mistake specific to a single ticket.
- Style preferences. Those belong in [CONVENTIONS.md](CONVENTIONS.md).
- Architecture description. That belongs in [INDEX.md](INDEX.md).

### Hygiene

Keep entries under ~8 lines. When an entry is made impossible by a lint rule, a
type, or a test, delete it and note the guard in the commit message — a mistake
that can no longer happen is noise. If this file passes ~400 lines, the oldest
entries have probably become guards; prune rather than append.

---

## Audio and microphone

### Compare microphone freshness against the current capture clock

**Symptom:** Archive Hush paused a valid chime as if the display had stalled.
**Cause:** the animation frame timestamp preceded a newly delivered microphone sample by 18 ms, so the freshness check classified that sample as future data.
**Rule:** sample the current monotonic clock for capture freshness; keep the frame timestamp for animation. Preserve stale-capture and long-frame guards, and test the host's default-clock tick path.
**See:** `packages/glass-game/src/ui/archive-hush-session.ts` and `packages/glass-game/src/ui/useAdventure.ts`.

### Observe the new reset, not a cumulative retry label

**Symptom:** a melody browser check read nonzero progress immediately after a wrong note, although the judge reset correctly later.
**Cause:** “Try again” remains available after an earlier retry; its presence cannot identify a new reset event.
**Rule:** start from positive progress, observe the injected wrong pitch, then wait for zero progress within the existing deadline. Keep a genuine earlier retry in the browser regression so stale labels cannot satisfy the probe.
**See:** `apps/beside-cue/e2e/glass-adventure-thawing-song.e2e.ts`.

### Measure sustained reference gain, not just source duration

**Symptom:** tapping Hear produced a short pip even though the source and reference wait lasted much longer.
**Cause:** the scalar envelope began decaying 35 ms after onset; its nominal 650 ms duration controlled decay rather than holding the note.
**Rule:** schedule an explicit hold between exponential attack and soft release, snapshot tuning before asynchronous unlock, and retain the audio-clock quiet barrier before scoring. Verify real output RMS during the hold, plus saved development tuning through an actual pointer and reload.
**See:** `packages/glass-game/src/browser/glass-sound.ts` and `apps/beside-cue/e2e/glass-adventure-reference.e2e.ts`.

### Inspect translucent frame patches in their actual host

**Symptom:** generated glass frames shrank to icon size or showed faint horizontal seams, especially at fractional phone heights.
**Cause:** a gallery-wide SVG rule overrode nested viewport dimensions; independently antialiased fractional patch cuts then exposed the backdrop. Rounding only inset lengths left the final cut fractional.
**Rule:** scope frame sizing above generic icon rules, set nested viewport dimensions explicitly, and round each destination cut while adjusting its source cut to preserve corner proportions and contiguous artwork. Inspect actual GPU captures at DPR 1 and 2; DOM bounds alone cannot prove clean translucent joins.
**See:** `packages/glass-game/src/ui/GameMaterialFrame.tsx` and the retained frame checks in `apps/beside-cue/e2e/helpers/glass-ui-settings.ts`.

### Test painted control bounds in WebKit as well as Chromium

**Symptom:** museum buttons measured 44 by 44 pixels in both engines, but their glass backgrounds became 20 by 41 pixel slivers on iOS.
**Cause:** WebKit shrink-wrapped an absolute grid child despite `inset: 0`; nested SVG icon selectors also reached the decorative artwork.
**Rule:** explicitly size the painted child to its touch owner, scope icons using `data-game-icon`, and verify both theme states in the Safari engine. For faceted cards, test content against the clipped artwork outline, not only rectangular DOM bounds.
**See:** `MuseumJourney.module.css` and `apps/beside-cue/e2e/glass-adventure-material-hosts.e2e.ts`.

### Watch microphone ownership as well as track events

**Symptom:** a voice session kept reporting listening after the shared microphone manager closed its capture.
**Cause:** `MediaStreamTrack.stop()` does not dispatch `ended`; manager-driven device changes and handoffs therefore bypassed the voice session's track listeners.
**Rule:** subscribe to the manager for the exact acquired stream and consumer, release that subscription on stop, and notify interruption once when ownership disappears. Test the real manager's teardown with a track fake whose `stop()` emits no event; count resumed live capture separately from old-session disposal.
**See:** `packages/glass-game/src/browser/voice-session.ts` and `voice-session-ownership.test.ts`.

### Keep retired shatter voices registered through their fade

**Symptom:** navigating directly into another scored singing screen could leak a previous glass sound into its microphone window.
**Cause:** disposal removed the voice from the shared capture barrier before its scheduled fade had finished.
**Rule:** retain a retiring voice until its fade ends, so a new capture owner can still stop it immediately; test unawaited disposal followed by capture acquisition.
**See:** `packages/glass-game/src/browser/shatter-player.ts` and `shatter-player.test.ts`.

### Consume pitch evidence independently of rendered frames

**Symptom:** a steady injected tone never completed calibration while a rich 3D scene rendered slowly.
**Cause:** sampling only `latestCaptured()` inside rAF discarded the capture cadence, making valid observations appear separated by long gaps.
**Rule:** subscribe to raw captured frames for scoring and retain their capture timestamps; share a monotonic decay clock with presentation ticks so intervals are not counted twice. Keep rAF polling for display feedback only.
**See:** `packages/pitch-engine/src/pitch-f0-stream.ts`, `packages/glass-game/src/core/hold.ts`.

### A late acknowledgement must not clear a newer phase deadline

**Symptom:** quickly stopping a recorder that never finished could leave it waiting forever.
**Cause:** a queued start acknowledgement cleared the timeout already guarding Stop.
**Rule:** retire a deadline only while its own phase is current; a start acknowledgement
may still provide timing evidence after Stop but must leave the stop watchdog armed.
**See:** `src/lib/guitar/recording-capture.ts` and its late-start regression test.

### Never flip the page mic indicator from a non-page consumer

**Symptom:** after using the Karaoke stem mixer, the Singing tab's mic toggle
was stuck in the wrong state.
**Cause:** `mic-store`'s `micActive` is a _page-facing indicator_, not device
truth. Consumers like the stem mixer and jam hold the device under their own
ids via MicManager; bridging them into `micActive` corrupted the shared flag.
**Rule:** device ownership goes through `@/lib/mic-manager.ts` with your own id.
Only the page's own practice/analysis controller writes `micActive`.
**See:** `src/stores/mic-store.ts`

### Release the mic unconditionally on unmount

**Symptom:** mic stayed hot after navigating away; the OS indicator stayed lit.
**Cause:** release was inside a conditional that did not run on every teardown path.
**Rule:** every surface that acquires the mic calls `registerMicIndicator` and
releases in `onCleanup` with no guard. Ask bug reporters for
`window.__micSentinel.dump()`.
**See:** `src/lib/mic-sentinel.ts`

### Unlock the AudioContext before any playback path

**Symptom:** playback silently did nothing, no error in the console.
**Cause:** browsers keep the AudioContext suspended until a user gesture.
**Rule:** route every start through `activateAudioPlayback`.
**See:** `src/features/playback/usePlaybackController.ts`

### A WhisperSegment is a word, never a lyric line

**Symptom:** the stem mixer's "Transcribe" gave a spot-on word alignment while
"Generate lyrics from vocal" — same hook, same run — filled the editor with
hundreds of one-word lines.
**Cause:** the worker asks for `return_timestamps: 'word'`, so every segment is
a single word. The alignment path knew that; the lyrics path emitted one LRC
line per segment.
**Rule:** group with `groupWhisperWordsIntoLines` before showing segments as
lyrics. Per-transcription hallucination guards do not catch junk confined to
one stretch of a song — judge a _line_, not the whole result.
**See:** `src/lib/whisper-lyrics.ts`

### Compare mic warnings with the detector's real amplitude gate

**Symptom:** a nearly full input meter and working pitch trace appeared behind
an “input too weak” warning.
**Cause:** every audible-but-unpitched frame was labelled weak, the meter used
a visual 4× gain, and the warning lingered after detection recovered.
**Rule:** compare raw RMS with the consumer's active detector gate when it can
expose one, only warn while playback expects singing, and clear immediately
when the evidence recovers. Never guess a gate for another detector.
**See:** `src/features/mic-feedback/useMicInsights.ts`

### A looping stage's lap index cannot come from elapsed time

**Symptom:** the Zen exercise sounded its guide notes on the first pass and
went silent on every pass after it, for the whole session.
**Cause:** the per-lap dedupe key was built from
`floor(elapsedSec / loopDurationSec)`. A looping session resets `elapsedSec` at
each seam, so elapsed never reaches a full lap and that expression is
permanently `0` — lap two reused lap one's keys and found every target already
played. The code reads as if it counts laps; it counts nothing.
**Rule:** take the lap index from the session's own counter
(`loopsCompleted()`), never from a time that is reset per lap. If a signal is
zeroed at the boundary you are trying to detect, it cannot detect it.
**See:** `src/features/zen/note-playback.ts`,
`docs/specs/zen-exercise-playback.ears.md`

### Never mix stems with a second media element — TVs run one media pipeline

**Symptom:** on a TV, unmuting the jam guide vocal "soloed" it: the vocal
came in and the backing track went silent. Desktop mixed both fine.
**Cause:** the stage played instrumental and guide as two `<audio>`
elements. TV browsers grant the hardware media pipeline to one element at
a time, so the guide's `play()` paused the backing track. No error fires
anywhere — the first element is just paused.
**Rule:** one media element per surface. Any additional stem plays through
Web Audio (decoded buffer + GainNode), the way the karaoke stage and
`jam-guide-player.ts` do. Volume mixing between elements is a desktop-only
illusion.
**See:** `src/lib/jam/jam-guide-player.ts`, `src/components/jam/JamSongStage.tsx`

### Sample note playback by start crossing, not by "is it active now"

**Symptom:** dense or fast phrases played partially and stopped, as if timing
out.
**Cause:** the scheduler fired a note only when a sample landed inside its
window. The Zen samples come from mic frames throttled to ~33 ms and stall
under load, so whole notes fell between two samples and never sounded — the
same defect `lib/playback-runtime.ts` had fixed for the piano roll.
**Rule:** fire anything whose start lies in `(previousSample, thisSample]`, and
never back-fill across a discontinuity — a lap seam, pause, resume or re-arm
resets the floor. The mirror-image bug is replaying a whole lap at once.
**See:** `src/features/zen/note-playback.ts`, `src/lib/playback-runtime.ts:76`

### Pin the current sampled window while warming the next one

**Symptom:** the sampled piano silently fell back mid-phrase after look-ahead
preparation completed.
**Cause:** current coverage anchors were old, unpinned LRU entries, so warming
the next phrase could evict them; a historical prepared flag did not prove
that a sample was still cached.
**Rule:** prepare current and next roots together in current-first order, pin
the bounded plan for the whole pass, and deduplicate by current window rather
than remembered cache history.
**See:** `src/features/piano-night/usePianoNightController.ts`,
`src/features/piano/instrument/piano-sampled-instrument.ts`

### Release audio with setTargetAtTime and stop after the tail — never a linear ramp to zero

**Symptom:** pops and crackles on note changes and tone stops, re-fixed and
re-regressed repeatedly.
**Cause:** loudness is logarithmic — a linear ramp to zero packs its perceived
change into the last milliseconds ("squeezed pop", user-confirmed on a PA).
The old tests PINNED that wrong shape, so each correct fix turned them red and
got reverted; and the rule doc was referenced from no agent entry point.
**Rule:** follow [.claude/memory/audio-pop-free-playback.md](../../.claude/memory/audio-pop-free-playback.md)
to the letter: exponential attack from the 1e-4 floor; release = anchor, then
`setTargetAtTime(0, now, len/5)`, source stopped only at `len + slack`. The
tail net in `audio-engine.test.ts` ("every scheduled stop lands below
audibility") replays the automation and fails any truncation — never weaken it.
**See:** `src/lib/audio-engine.ts` (`_releaseParam`), `src/lib/preview-player.ts`

### Treat media play as permission, not buffered readiness

**Symptom:** streamed stems waited on Android but started and stuttered immediately on iOS, especially after a forward seek.
**Cause:** WebKit resolved `play()` before a useful range or async seek had landed; before metadata it could also reject `currentTime`, so waiting for the target range before retrying the seek waited on bytes it was never asked to fetch.
**Rule:** call `play()` inside the gesture, then align to the target, require one contiguous near-term buffered window per stem, re-align, and await seek settlement before opening the bus. Own every listener and timeout with pause/dispose cancellation.
**See:** `src/features/guitar/backing/guitar-backing-stream.ts`

### AVAudioSession route handlers reconcile state; they never blindly reassert it

**Symptom:** starting a WKWebView video made video, audio, and the entire iOS UI
advance only once every few seconds; output volume also appeared to oscillate.
**Cause candidate confirmed in code:** a main-queue route-change observer
unconditionally called `setCategory` and
`overrideOutputAudioPort(.speaker)`. Those mutations emit their own
`.categoryChange` and `.override` notifications, and the speaker override ran
even when the route was already the built-in speaker. Device confirmation is
still required.
**Rule:** set the app-owned category at launch/reactivation, not from the route
observer where it can fight WebKit. In that observer, guard reentrancy and
override only an actual `.builtInReceiver` route; every notification after the
route becomes the speaker must be a no-op. Native audio policy requires
physical-device verification before release.
**See:** `apps/beside-cue/ios/App/App/AudioSession.swift`

### Give overlapping input starts their own microphone leases and pending nodes

**Symptom:** Stop followed by a quick Listening restart lost the new input when
the old worklet finished loading.
**Cause:** stale completion ran shared cleanup; the manager's idempotent consumer
ID also let an obsolete request release the newer request's hold.
**Rule:** use attempt-local leases and pending-node disposers, check generation
after every await, and let stale continuations release only their own resources.
**See:** `src/features/guitar-night/useGuitarListeningController.ts`

### Validate live capture timing before diagnosing an amp click

**Symptom:** rapid tone changes appeared to introduce large PCM jumps.
**Cause:** Chromium's worklet `currentFrame` repeated/skipped during graph edits;
indexing recorded samples by it overwrote blocks and left zero-filled holes.
**Rule:** record delivered blocks sequentially, retain clock anomalies as
diagnostics, and require an independent raw signal to stay continuous before
using processed PCM to judge transitions. Offline endpoint checks are separate.
**See:** `scripts/guitar-amp-browser-probes.mjs`

### Select the guitar channel before monitoring a multichannel interface

**Symptom:** Direct-input guitar played only on the left while backing was stereo.
**Cause:** the browser exposed input 1/2 as stereo; amp nodes preserved [guitar, silence].
**Rule:** isolate a selected browser channel before the amp and center its mono output;
never downmix every interface input or change the original analysis/recording route.
**See:** `src/features/guitar-night/guitar-input-monitor.ts`

### Audit sample-bank instrument identities before adopting their MIDI map

**Symptom:** a kit appeared mostly fallback, and its custom map looked like a quick fix.
**Cause:** Crocell note 59 is a crash (GM ride 2), 54 a china (GM tambourine),
and 39 snare-rest noise (GM clap); native power ranks also mispredicted pedal mix levels.
**Rule:** preserve imported GM identity, map by actual instrument, and measure the
final mic mix. Missing baseline voices do not make a sampled engine a synth kit.
**See:** `scripts/expand-drum-kit-recorded-banks.mjs`, `public/drum-night/kits/README.md`

### Measure the ensemble before turning up quiet drums

**Symptom:** imported drums disappeared under pitched backing unless Backing was lowered to about 30%.
**Cause:** Drum Night discarded pitched velocities and summed peak-normalized synth voices at unity; mixed-file renders put backing 22–24 dB above the acoustic kit and overloaded the output.
**Rule:** preserve authored note dynamics and calibrate the synth bus against a mixed arrangement. Master makeup cannot fix relative balance, and per-hit sample normalization destroys the kit's soft/hard dynamics. Verify isolated buses and final output with native Web Audio, not only sample readiness or mocked node counts.
**See:** `src/features/drum-night/play-along/drum-arrangement-player.ts`, `src/lib/score-synth-velocity.ts`

### Finish the release before parking its audio clock

**Symptom:** switching apps cut audio sharply despite an existing release envelope.
**Cause:** a separate visibility handler suspended the context before its gain automation could finish; an unfinished tail could remain connected until a later resume.
**Rule:** cancel playback logically at once, grant a bounded audio-clock release through the shared lease, and disconnect cancelled tails if the OS interrupts that release. A foreground route interruption must still preserve active playback. Native events also need the App plugin registered in each consuming app.
**See:** `packages/audio-io/src/shared-audio-context.ts`, `apps/beside-cue/src/audio/web-audio-output.ts`

### Distinguish a queued old suspension from a fresh audio interruption

**Symptom:** cancelling a voice challenge sometimes left exploration music silent.
**Cause:** the last encounter lease queued `suspend()` just before new music requested `resume()`; its delayed suspended event retired the fresh output.
**Rule:** tolerate that suspended event only while the new unlock is pending and no sources have started. Native suspension preparation and genuine interruption must still cancel. Reproduce the ordering with an actual AudioContext, not only synchronous mocks.
**See:** `packages/glass-game/src/browser/museum-output.ts`, `art/glass-adventure/audio/v1/verify_runtime.mjs`

### Read packaged media through `fetchAssetBytes`, never `if (!response.ok) throw`

**Symptom:** packaged audio silent on iOS, fine on Android and on the web. The alley's ambients played nothing in TestFlight 0.5.0 (336), and nothing on the phone said why.
**Cause:** Capacitor's iOS `WebViewAssetHandler` answers a non-Range GET for a media extension (m4a, mp3, wav, …) with a bare `URLResponse`, so WebKit reports `ok: false, status: 0` with the whole body; Android answers 200. The loader threw on `!response.ok` and its empty catch swallowed it. Beside Cue hit the same thing three weeks earlier, and the rule lived only in its code.
**Rule:** read packaged assets through `fetchAssetBytes` (or `fetchAssetRead`) from `@irchiinnuss/mobile-runtime/asset-fetch`: a 2xx, or status 0 with a non-empty body. Never `if (!response.ok) throw` on a bundled file, and warn on failure: a loader's catch is never empty. The bundle probe answers packaged media with status 0, and the Developer screen's Audio section shows each fetch, decode and failure on a device.
**See:** `packages/mobile-runtime/src/asset-fetch.ts`, `apps/mercurypitch/scripts/probe-bundle.mjs`, `apps/mercurypitch/src/shell/AudioDiagnosticsPanel.tsx`

### Verify sung references at the live capture sample rates

**Symptom:** a generated reference passed offline melody checks, but those checks did not match the microphone pipeline.
**Cause:** testing a 24 kHz file with a fixed 2048/1024 YIN window/hop doubles the time window relative to the same live worklet at 48 kHz. Consonant gaps and pitch confidence can differ.
**Rule:** decode/resample delivery audio to common AudioContext rates (44.1/48 kHz), run the production detector and judge with every unvoiced frame, and test wrong-note controls. Keep source-rate analysis separately labelled; never add hidden tones to force a reference through the judge.
**See:** `packages/pitch-engine/src/pitch-f0-stream.ts`, `packages/glass-game/src/browser/voice-session.ts`.

### Keep the game asset inventory loadable by plain Node

**Symptom:** Browser play works, but native packaging and root Vite startup fail
with `ERR_MODULE_NOT_FOUND` after the inventory imports another TypeScript file.
**Cause:** Those scripts load the package export using Node type stripping,
which does not resolve extensionless relative imports like Vite does.
**Do instead:** Use an explicit, script-safe package export for shared catalogue
data and keep its runtime dependencies Node-loadable. The asset contract test
must import the inventory in a child Node process as well as through Vitest.

### Verify resumed capture rather than counting microphone requests

**Symptom:** a quick return to a singing circle reached singing mode, but its test expected a second `getUserMedia` call and failed.
**Cause:** MicManager retains its live stream for a two-second release window; a new consumer legitimately reuses it.
**Rule:** assert resumed capture and live track ownership. Count acquisitions only when explicitly testing teardown after the linger deadline.
**See:** `packages/pitch-engine/src/mic-manager.ts`, `apps/beside-cue/e2e/glass-adventure-auto-singing.e2e.ts`.

### Schedule brief microphone probes on the audio clock

**Symptom:** a browser regression reset a melody during a supposedly allowed 650 ms pause.
**Cause:** separate automation calls and assertions stretched the pause to 789 ms before capture could reacquire the tone.
**Rule:** schedule short PCM transitions in one AudioContext timeline, observe inside the browser, and require actual samples within the interruption. Resume the compiled contour after a pause: a tone matching its frozen point can become wrong as the melody advances. Observe brief DOM states at their mutation, not only the next rendered frame. Keep responsive screenshots separate from capture timing.
**See:** `apps/beside-cue/e2e/helpers/thawing-song-input.ts`, `apps/beside-cue/e2e/glass-adventure-thawing-song.e2e.ts`.

### Await the audio request independently of the playback button

**Symptom:** an encore browser test saw Stop listening but still counted zero requests for the selected voice variant.
**Cause:** the browser starts fetch and publishes playback ownership synchronously; Playwright delivers the network event to its Node-side observer later.
**Rule:** await the exact asset request/count as its own asynchronous observation. Keep no-prefetch and final exact-count assertions; a visible playback button is not a network-event barrier.
**See:** `packages/glass-game/src/ui/EncoreDialog.tsx`, `apps/beside-cue/e2e/glass-adventure-encore-examples.e2e.ts`.

### Separate capture continuity from receipt freshness

**Symptom:** a correct starting note repeatedly lost its hold progress on delayed microphone delivery.
**Cause:** readiness accepted frames up to 180 ms late but cleared the hold when the latest capture was 120 ms old, including continuously delivered valid frames.
**Rule:** accumulate only consecutive capture timestamps; evaluate arriving-input health separately from capture gaps. Interleave delayed captures with animation ticks in regressions instead of testing each stream alone.
**See:** `packages/glass-game/src/browser/runner-session.test.ts` and `runner-session-course.test.ts`.

### Put an iOS song on the lock screen through WebKit, never the app's audio session

**Symptom:** the media session plugin wrote MPNowPlayingInfoCenter on every play and pause, and iOS showed no lock-screen player. Making the app's AVAudioSession non-mixable while a song played (#922) still showed nothing, and broke playback on device: a song started over another app stayed silent behind a pause button, and one interrupted by YouTube never recovered.
**Cause:** the Karaoke song is Web Audio, rendered in WebKit's GPU process under WebKit's own AVAudioSession. iOS shows Now Playing for the session that plays, and WebKit publishes it only for a media element it finds eligible. The app process's session plays nothing; changing it at runtime interrupted WebKit's audio instead.
**Rule:** never change the app's AVAudioSession at runtime under WebKit's audio (#923 reverted it). Lock-screen metadata, position and buttons go through `navigator.mediaSession` beside a silent `<audio>` carrier that WebKit counts as the playing element. WebKit resets the session's position to the carrier's own on every seek of it, its loop included, and the lock screen can keep that over the song's position set again on `seeked`: the carrier is an hour long, so it does not go round mid-song, and the skip buttons have handlers, so WebKit never skips it. Going round also put the carrier back in front of the song's clock, so it is now played again while it plays (see "Keep the Now Playing carrier the sound that started last"). Keep every other media element out of its way: WebKit shows on the lock screen the element a tap played last and sends a headset's toggle to the one that started last, so the unlock clip in `src/lib/audio-unlock.ts` stands aside, muted and unplayed, while the carrier holds the session.
**See:** `packages/mobile-runtime/src/webkit-now-playing.ts`, `standUnlockClipAside` in `src/lib/audio-unlock.ts`.

### Never resume an AudioContext that iOS interrupted

**Symptom:** on iOS, after YouTube's picture-in-picture played, play in the Karaoke room sometimes did nothing or showed playing in silence; play pressed in YouTube's window stopped again about half a second later.
**Cause:** a `statechange` listener, the tap unlock and the page-return resume all resumed an `'interrupted'` context. In WebKit, playback starting ends every interruption and takes the sound back, so YouTube stopped; and a resume before iOS's "ended" left WebKit's audio session marked interrupted, so the next take-over was dropped ("already interrupted!") and the clock said `'running'` with no output.
**Rule:** leave an interruption to the system and to the next press of play. On play, take the session first (unlock clip or Now Playing carrier), then resume the clock; check the clock moves, restart it once, then stop and say so. The trip to the background is the one exception (next entry).
**See:** `packages/audio-io/src/shared-audio-context.ts`, `src/lib/audio-unlock.ts`, `docs/plans/mobile-native/ios-audio-handoff.md`.

### The trip to the background interrupts Web Audio too (iOS)

**Symptom:** with background play on, swiping home opened the lyrics window and paused the song half a second later. With it off, leaving the app made a loud buzz, and coming back sometimes played the end of the note.
**Cause:** WebKit interrupts Web Audio whenever the app enters the background (`BackgroundProcessPlaybackRestricted`, an `EnteringBackground` interruption), and the room paused with every interruption. Separately, the shell parked the shared clock on `willResignActive` with no time for a fade, so the clock stopped mid-waveform and the fade ran when it next started.
**Rule:** a room that keeps playing behind other apps resumes the interruption that comes with the page hiding (up to 1.5 s after it, or 0.7 s before it); every other interruption pauses. Anything playing on the shared clock answers `prepareToSuspend` with its fade and the time left on it.
**See:** `src/features/stem-mixer/useStemMixerAudioController.ts`, `packages/audio-io/src/shared-audio-context.ts`, `docs/plans/mobile-native/ios-audio-handoff.md`.

### Treat a lock-screen press that waited while the app slept as stale (iOS)

**Symptom:** after the phone sat locked with the song paused, play on the lock screen did nothing; opened later, the app played the song from somewhere.
**Cause:** a paused song lets iOS suspend the app. WebKit keeps the press and delivers it when the page runs again, which can be minutes later, as the app comes to the front.
**Rule:** never act on a press that may have waited. The page beats while hidden with a song on the lock screen and holds a press that follows a gap; the app coming to the front drops it. Native buttons stamp their presses (`at`), and the page drops old ones.
**See:** `packages/mobile-runtime/src/waited-presses.ts`, `listenToTheWindow` in `packages/mobile-runtime/src/picture-in-picture.ts`.

### Show a play from behind another app only once the page says it plays (iOS)

**Symptom:** with YouTube playing, play in our lyrics window ran the lyrics on in silence, and YouTube kept playing (builds 527 and 549).
**Cause:** in 527 the window turned its clock on the press, and after another app took the sound, WebKit activates the page's session as ambient, which mixes. In 549 the page read the carrier's play as iOS's yes, but WebKit asks iOS for the sound only once something of the page already plays (`PlatformMediaSessionManager::maybeActivateAudioSession`). With the song paused, the carrier started without asking; the song's clock asked next and was refused, because iOS does not let an app in the background take the sound from one that plays.
**Rule:** native controls wait for the page's report. Behind another app whose sound plays now (the window's `otherAudio`), say no at once. A play from behind the app after the other app went quiet sets `navigator.audioSession.type = 'playback'` for the moment the carrier starts and puts the old type back. A carrier still paused means refused; one that plays is not proof of a yes.
**See:** `takeTheSound` in `packages/mobile-runtime/src/webkit-now-playing.ts`, `apps/mercurypitch/ios/App/App/LyricsWindow/LyricsWindow.swift`.

### Read "another app's sound" as possibly the song itself (iOS)

**Symptom:** the `[audio session]` log showed "another app's sound started; other audio playing" with no other app open (build 556).
**Cause:** WebKit plays in its own process. The app's own `AVAudioSession` hears it as another app: `isOtherAudioPlaying` and the silence hint turn on with each play of ours and off with each pause.
**Rule:** a line that follows a play or a pause of ours is the song. Never read `isOtherAudioPlaying` as proof of another app; it is true while our own song plays. And do not plan on closing the lyrics window from the background: iOS ignored `stopPictureInPicture()` there (the log shows the stop asked for and no `closing` from AVKit).
**See:** `AudioSessionWatch` in `apps/mercurypitch/ios/App/App/LyricsWindow/LyricsWindowPlugin.swift`, `docs/plans/mobile-native/ios-audio-handoff.md` (Build 556).

### Tell the lock screen a new place, not the same one twice (iOS)

**Symptom:** -10 s near the start of a song put the lock screen's counter at 0:00 the first time. Pressed again, the song played from 0:00 while the counter ran on from the first press: 0:02, 0:05 (build 549).
**Cause:** each press reported position 0 at the same speed. Our side and WebKit pass every report on, so iOS keeps its own clock when told the same place again (inferred: MediaRemote is private). A jump to a new place always worked.
**Rule:** a report that lands where the bar was last put, while playing, at the same speed and 500 ms or more later, goes 0.25 s on at 1.0001 times the speed. The next report puts both back.
**See:** `packages/mobile-runtime/src/same-place-twice.ts`, `docs/plans/mobile-native/ios-audio-handoff.md` (Build 549).

### Keep the Now Playing carrier the sound that started last (iOS)

**Symptom:** in build 543 the lock screen's and Control Center's bar could be dragged but went straight back, and the 10 s buttons did nothing. In 539, with a four-second carrier, the same bar worked. In 546, with the carrier played once a second to fix that, starting YouTube sometimes played it for a moment and stopped it again.
**Cause:** WebKit lets the system seek only when its current media session, the one that started last, supports seeking (`computeSupportsSeeking`), and a Web Audio clock never does. Every clock start (play, the resume as the app goes behind another one, the microphone) put a clock in front. The four-second carrier started again at every loop and got back in front; the hour-long carrier never did. The cost of making the loop rare was hidden in the loop. A play also asks for the session to be activated: one that lands after another app took the sound, before the page has heard, takes it back (`RemoteAudioSessionProxyManager::tryToSetActiveForProcess`).
**Rule:** while the song plays, play the carrier again (it starts nothing; WebKit counts it as a start) at moments of ours only: each report, the page turning, and the song's clock starting (the room reports again), at once and once more 250 ms later. Never on a timer: a play that lands just after another app takes the sound takes it back. Never play a paused carrier to get it in front: that takes the sound from another app. A paused song's carrier pauses behind a clock that still runs, so its bar can still be refused.
**See:** `packages/mobile-runtime/src/carrier-in-front.ts`, `docs/plans/mobile-native/ios-audio-handoff.md` (Build 543, Build 546).

### Measure dropout gaps from voiced evidence during a wrong-note correction

**Symptom:** returning from a tolerated wrong note reset a melody when the detector briefly reported no pitch.
**Cause:** the dropout clock used the last correct note, so the preceding voiced correction counted as silence.
**Rule:** track the last voiced capture during correction and enforce both the original mismatch deadline and the independent dropout limit; alternating wrong and unvoiced frames must not renew grace.
**See:** `packages/glass-game/src/core/melody-judge.ts` and `melody-judge.test.ts`.

### Hold a shared-clock lease until its fade has played: `release()` never asks `prepareToSuspend`

**Symptom:** on a phone, a premium room's first note opened with the end of the last room's note. In `premium-rooms-audio.test.tsx` it read -34 to -36.5 dB (a count-in or a call), and -11.8 dB for Long note, whose Hear tone nobody stopped.
**Cause:** a room let go of its lease as its screen went, with its sound still fading over the house release (240 ms). The last lease out parks the clock after a fixed 120 ms (`RELEASE_GRACE_MS`) and never calls `prepareToSuspend`, which is asked only when the page hides or the app leaves the foreground (or a resume lands while either holds). The clock kept the rest of the fade for the next room's first tap. Passing `prepareToSuspend` alone changed nothing.
**Rule:** keep the lease until what you stopped has played, as the glass owners do (they release in `finish()`, after the fade), and answer `prepareToSuspend` with the time left on it for parks that come meanwhile. In the room tests, stop a note after its attack: the fake gain reads a ramp cancelled in the middle as never begun, so a release taken from there starts at silence.
**See:** `src/components/room-kit/useExerciseCapture.ts` (`ROOM_TAIL_MS`), `release` in `packages/audio-io/src/shared-audio-context.ts`, "the way out" in `apps/mercurypitch/src/shell/premium-rooms-audio.test.tsx`.

### Read the phone's volume again while it matters: a pushed change can never come

**Symptom:** on build 880 (iPhone) a premium room said "The volume is at zero. Turn it up." and kept saying it after the volume went up. The owner then watched the Developer screen's Volume row follow the keys after a fresh launch, stop the moment a room opened, and read 0 until the app was killed.
**Cause:** the plugin heard only the app's own `AVAudioSession`, by KVO on `outputVolume`. A room's sound plays from WebKit's own session, in its GPU process. Opening the mic switches that session to play-and-record, which a WebKit engineer describes as switching "to the VC level" ([WebKit bug 236219](https://bugs.webkit.org/show_bug.cgi?id=236219)), and WebKit's main branch keeps play-and-record while its audio plays after the mic closes (`MediaSessionManagerCocoa::updateSessionState`). From then on the keys can move a volume the app's session does not report. iOS can also end the app's session on a suspension, saying so only by an interruption that never ends, and on iOS 18 and later `outputVolume` can keep an old value. Which of these the owner's phone did is not yet in a device log; a test build's census now records it. Android has a smaller gap (AOSP `AudioService`): muting or unmuting a stream at the same level writes no setting, so the settings observer stays silent, and a muted stream reads as 0.
**Rule:** do not take a pushed reading as the last word on the volume. While a wrong reading would mislead, read again on a timer and when the app comes back, and drop an answer asked before a newer change. On iOS read the system volume as well, off a hidden `MPVolumeView`'s slider counted once it has moved, and never by changing a session. Say a number ("zero") only from a reading that follows the keys, or from the session and a volume view settled in its window agreeing; from the session alone, ask for the volume to go up and claim no number. Read again as the room opens and as the mic opens and closes, since WebKit moves its session then.
**See:** `apps/mercurypitch/src/shell/RoomVolumeHint.tsx`, `apps/mercurypitch/ios/App/App/AudioOutputPlugin.swift`, `packages/mobile-runtime/src/audio-output.ts`, `apps/mercurypitch/src/shell/audio-census.ts`.

### Isolate model setup when a browser test targets decode failure

**Symptom:** Guitar Night's stopped-preparation regression stayed at “Preparing on this device” instead of reporting invalid audio within 15 seconds.
**Cause:** local separation initializes the remote ONNX model before native audio decoding; the test accidentally depended on model download and GPU/WASM setup.
**Rule:** for decode-recovery tests, fixture only the separator worker's initialization handshake, retain the real invalid-audio decoder and recovery assertions, assert interception, and reject unexpected inference. Test model readiness separately.
**See:** `src/e2e/guitar-night-stopped-preparation.spec.ts` and `src/lib/uvr-processing-pipeline.ts`.

### Space latency clicks unevenly where the round trip can pass their spacing

**Symptom:** over AirPlay to an LG C2 (mp-v0.8.41) the latency wizard found no number; on synthetic recordings the same maths read a 1.6 s round trip as 100 ms, from six clicks that agreed within 1 ms.
**Cause:** evenly spaced clicks (0.75 s) matched to the nearest reply after each: a reply later than the spacing lines up with an earlier click, and the half-interval window hides that only while round trips stay short, as on a phone's speaker. One threshold for the run, a quarter of the loudest click, also lost every click after a TV's loud first one.
**Rule:** where the sound can be late by more than the spacing (a TV, Bluetooth), space the clicks unevenly, take the lag most clicks agree on, refuse when another lag is nearly as well supported, and time each reply against its own peak. Guitar Night's calibration (`useGuitarListeningController.ts`) still uses the even schedule.
**See:** `src/lib/mic-latency-route.ts`, `MAX_ONSET_DISTANCE_SEC` in `src/lib/mic-latency.ts`.

### Divide out DynamicsCompressorNode's makeup gain, and let a new one settle

**Symptom:** a compressor made material below its threshold 10.8 dB louder (-24 dB, 4:1); an offline bounce through it opened 17 dB down.
**Cause:** every engine adds an automatic makeup gain, (1 / curve(0 dBFS))^0.6 per the spec, and a freshly created node starts with its detector at zero and fades in over ~300 ms (Chrome 153).
**Rule:** cancel the makeup with `compressorAutoMakeupGain` (matched Chrome to 0.001 dB), build chains before audio starts, and pre-roll offline renders.
**See:** `src/lib/studio-fx/compressor-curve.ts`, `src/lib/studio-fx/render.ts`.

### Give a path summed beside a compressor or oversampled shaper the same node

**Symptom:** a 50 % parallel compressor notched by 24 dB; a split-band de-esser would notch its own crossover.
**Cause:** DynamicsCompressorNode has 6 ms of lookahead and a 4x WaveShaperNode 4 ms of resampling delay (Chrome 153, 48 kHz); neither is reported, so an undelayed parallel path comb-filters.
**Rule:** run the parallel path through `createCompressorTwin` (a DelayNode of the measured lookahead, 288 frames at 48 kHz and 264 at 44.1 kHz in Chrome 148; a null compressor until measured) or an identity-curve shaper with the same oversample. A null compressor is not a free twin: it costs a full detector per sample, starts about 17 dB down, and even settled passes 0.99998 (-0.00013 dB). The DelayNode is bit-exact. Feedback cycles add a further quantum (128 frames) per pass in Chrome.
**See:** `src/lib/studio-fx/compressor-twin.ts`, and `createIdentityShaperPath` in `src/lib/studio-fx/effect-shell.ts`.

### Do not build a decibel-domain envelope from a plain rectifier

**Symptom:** a level-independent transient shaper wobbled the gain of a held 41 Hz bass note by 2 dB; the same detector in linear amplitude was level-dependent and barely moved a ring.
**Cause:** |x| ripples at twice the pitch, which a few-millisecond follower cannot smooth on low notes; in decibels the ripple is the same at every level, so no threshold hides it. A WaveShaperNode log curve of normal length is also wrong below about -40 dBFS, because the curve is sampled uniformly.
**Rule:** rectify a 90-degree allpass pair at four phases (3 % ripple at eight times the pitch) before the followers, and give log curves 65537 points.
**See:** `QUADRATURE_ALLPASS` and `createLogEnvelopeCurve` in `src/lib/studio-fx/dsp.ts`, `src/lib/studio-fx/effects/transient.ts`.

### Derive adjacent AudioParam curve durations from shared timestamps

**Symptom:** A legal Studio trim/fade played at some clock offsets but threw a native curve-overlap error at others.
**Cause:** Independent frame-to-second calculations rounded the previous curve's endpoint beyond the next event timestamp.
**Rule:** Compute absolute boundaries once and use `nextTime - startTime` for curve duration. Verify fractional epochs in a native AudioParam; a fake that only records calls misses this failure.
**See:** `src/lib/studio/playback/edge-envelope.ts` and `src/e2e/studio-audio-envelope.spec.ts`.

### A value curve scheduled in the past overlaps the event after it

**Symptom:** Under heavy load a Studio Play failed with "setValueAtTime(0.878482, 3.178666666666667) overlaps setValueCurveAtTime(..., 3.178666666666667, 0.003000000000000114)" and nothing sounded.
**Cause:** Chromium moves an automation event whose time has passed up to its clock, and a moved value curve keeps its duration, so it covers the next event, which lands inside it. A clip's edge envelope written 1 to 19 ms late threw every time in headless Chromium 148; written two render quanta past the clock, never.
**Rule:** Never write automation for a time the clock may have passed: start a late source and its envelope together a little past the clock. Test with a param that moves past times up to the clock and refuses overlaps as Chromium does, not one that only records calls.
**See:** `src/lib/studio/playback/graph-lanes.ts` (`sourceStart`) and `src/lib/studio/playback/graph.late.test.ts`.

### Take a silent chain out of the graph; a zero gain in front of it saves almost nothing

**Symptom:** Muting 23 of 24 Studio lanes left the audio thread at 99 % and underrunning; a gain of 0 in front of each chain only cut 15 % offline.
**Cause:** Chromium processes every node a destination pulls, silent input or not (compressors, shapers and convolvers run on zeros). Only a node nothing pulls is free. And an AudioBufferSourceNode that nothing pulls stops advancing: measured 0.8 s behind after 0.8 s unpulled.
**Rule:** To idle a subgraph, close its input, let it run until its tails have rung out on silence, then disconnect it from what pulls it, and keep its sources pulled through a muted gain into the destination. Reconnect before opening the input again.
**See:** `src/lib/studio/playback/lane-idle.ts`.

### Cross chunked buffers over; never butt two AudioBufferSourceNodes edge to edge

**Symptom:** A frozen Studio lane played from 4 s chunks clicked at each join: a -40 dBFS one-frame error at exactly 8.000 s when the run's epoch sat 37 frames off the render's, nothing when they lined up.
**Cause:** A chunk started between two frames plays interpolated, and its last frame blends its last sample with silence, so two butted chunks leave a one-frame error at their join (Chromium 148, a 0.5-amplitude 440 Hz sine: -56 to -62 dBFS from epochs 0.001, 0.3 and 0.5 frames past one, bit-exact from 400 whole epochs). Float noise alone does not do it, but a 44.1 kHz context resamples every chunk, so there a start is always between frames.
**Rule:** Give each chunk a few frames of its neighbours and cross adjacent chunks over with complementary linear fades timed from the same frames: the two gains sum to one on every frame however a start rounds. Measured after: the same frozen lane at the two epochs differs by -217 dB.
**See:** `src/lib/studio/playback/lane-freeze.ts` (`frozenSegments`).

### Start every buffer source on a whole frame of the audio clock

**Symptom:** The same Studio song lost a different amount of treble on each Play. Two Plays asked for half a frame apart differed by -6.1 dBFS worst sample, 5.1 dB down at 15 kHz and 2.0 dB at 10 kHz; a four-lane mix differed by -12.2 dBFS, 4.0 dB down at 15 kHz.
**Cause:** A source started between two frames plays every sample interpolated between two of its buffer's, a linear filter that dulls the treble by how far between it lands (Chromium 148 and WebKitGTK 2.54; Firefox 150 rounds every start to the nearest frame). A run's epoch was the clock plus the device callback plus 5 ms: 220.5 frames at 44.1 kHz, and a callback need not be whole frames of the context's clock. Float noise is not the problem: a start up to 3e-4 frames past a frame plays from that frame as an exact copy, though one 1e-10 frames before it plays interpolated.
**Rule:** Put each fresh place on the clock on the next whole frame of `ctx.sampleRate`, rounding up so it is never sooner than asked, derive every later start in whole timeline frames from it, and never let a frame's time fall short of its frame. Measured after: the dry pair is bit-identical, and the four-lane pair sits at its own floor (the same Play rendered twice differs by -73 dBFS: a lane with a reverb never renders the same twice in Chromium).
**See:** `src/lib/studio/playback/whole-frame.ts` and `scripts/check-studio-epoch-browser.mjs`.

## Framework

### Format CSS before verifying a standalone production build

**Symptom:** a new portal had classes but looked unstyled; DOM-only checks passed.
**Cause:** the legacy CSS fallback transform treated one-line custom-property
rules as nested selectors, so later rules no longer matched the portal.
**Rule:** format authored CSS before building; inspect screenshots and assert
computed position/background, not just dialog presence or lack of overflow.
**See:** `tools/css-legacy-fallbacks.ts`, `src/e2e/night-music-import.spec.ts`.

### Test the host layout when adding a shared room action

**Symptom:** the import dialog worked, but Piano's view choices escaped its HUD,
Drum's song selector shrank to 10px, and Guitar controls went offscreen at 200% text.
**Cause:** an extra grid child and a non-compact shared trigger broke the hosts'
existing column and width budgets; dialog-only screenshots missed the regression.
**Rule:** reuse a HUD slot or explicitly recompose its grid, keep mobile triggers
at least 44px, and run the host's responsive specs as well as the new overlay's.
**See:** `src/e2e/night-music-import.spec.ts` and the Night-room responsive specs.

### Key score-room lifetimes by song, not by track or reference object

**Symptom:** dropping a second tab updated its mixer tracks but the title and
resumed audio still belonged to the previous song after Play had run.
**Cause:** the retained room intentionally pinned its take's score for review;
updating the live reference did not end that previous playback lifetime.
**Rule:** key the rehearsal subtree by song ID so a validated replacement
disposes playback, loops and pending callbacks together. Keep same-song track
changes reactive without remounting, preserving their parked musical position.
**See:** `GuitarNightScoreReplacement.test.tsx` and the native replacement cases
in `src/e2e/night-music-import.spec.ts`.

### Do not destructure props

**Symptom:** a prop updated in the parent, the child never re-rendered.
**Cause:** destructuring reads the value once; Solid's reactivity is in the getter.
**Rule:** take `props` and read `props.x` at the use site.

### Read signals synchronously, before going async

**Symptom:** "computations created outside a `createRoot`" warning; stale values.
**Cause:** calling an accessor inside an async callback runs it detached from the owner.
**Rule:** capture the value first, then start the async work.

### Use native key handlers inside propagation-stopping dialogs

**Symptom:** a wheel accepted clicks but ignored real arrow-key presses in a modal.
**Cause:** the dialog stopped native propagation before Solid's delegated
`onKeyDown` listener at the document could receive the event.
**Rule:** use `on:keydown` for the inner keyboard control, preserving the dialog's
transport-shortcut isolation; verify with a real keyboard browser test.
**See:** `src/features/session-drummer/DrummerWheel.tsx`.

### A CI-only test timeout is a measurement, not a flake

**Symptom:** a test times out on CI and passes locally, so it looks like runner noise.
**Cause:** local `/tmp` is a tmpfs, so fixtures that write real files cost almost
nothing here and fsync on CI. One migration fixture ran 12ms locally and over 5s there.
**Rule:** reproduce with `TMPDIR=<real-disk-path>` before judging it. Remove accidental
cost where it exists; only give inherent cost an explicit timeout. Never raise the
global default. See TESTING.md §3.7.

### `PlaybackRuntime.on('state')` passes an event object, not a state string

**Symptom:** pause detection never fired; the comparison always failed.
**Cause:** the handler argument is the whole event, so `arg === 'paused'` is never true.
**Rule:** use the `isPlaying` / `isPaused` signals from `playback-state-store`.

### Never pin an inline canvas `width`

**Symptom:** canvas rendered at the wrong scale after a resize or DPI change.
**Cause:** a hardcoded attribute fought the size-sync logic.
**Rule:** use `@/lib/canvas-size-sync.ts`.

### Never use `<header>` or `<footer>` for page content

**Symptom:** page content picked up unexpected global styling.
**Cause:** global CSS rules target those tags for app chrome.
**Rule:** use a `div` with a class. Pages inside `.main-content` also need
`flex-shrink: 0`.

### An aborted run is not a result

**Symptom:** a transcription torn down after 2 of 18 chunks reported
"hallucination detected", deleted the session's cached transcription and blamed
the model. The same audio transcribed perfectly a minute later.
**Cause:** the chunk loop set a local `aborted` flag that only one of the exits
read. The truncated prefix fell through to the quality guard, which judged it
as the model's output.
**Rule:** a cancelled or torn-down async run returns before it reports, caches
or judges anything — and carries the abort in its _return type_, not a local
flag every exit has to remember. Teardown must also settle what it cancels:
`worker.terminate()` leaves pending promises hanging forever.
**See:** `runWhisperChunkPlan` in `src/lib/useWhisperTranscription.ts`

### Do not gate account UI on a fetch — the token answers synchronously

**Symptom:** for the first second after load the app behaves as though nobody
is signed in; a signed-in singer gets offered "Create a free account", and the
button leads somewhere with nothing to do.
**Cause:** the component waited on a profile/DB round trip to decide whether an
account exists. It does not need to: the JWT is already in `localStorage` and
decoding it is local work. `hasUpgradedAccount()` in `auth-service.ts` answers
on the very first render, with no network.
**Rule:** use `accountHeld()` (`auth-service.ts`) inside components. It reads
`authVersion()` first, so it is both synchronous _and_ reactive — right on the
first paint, and self-correcting the moment someone signs in or out. Reserve
async profile loads for profile CONTENT (display name, avatar, stats), never
for the yes/no of "are they signed in".
**Related:** put the check at the shared seam, not at each call site.
`shouldShowNudge()` now refuses every account nudge when an account exists —
the one call site that forgets is exactly the one that ships.
**See:** `accountHeld` in `src/db/services/auth-service.ts`,
`shouldShowNudge` in `src/features/onboarding/account-nudge.ts`

### An 'i' or '?' popover needs a portal and three closers

**Symptom:** the info panel stays open after clicking elsewhere and after
navigating to another tab, where it hangs over the new screen; the first card
in a row opens its panel past the container edge and the text is cut in half;
the sidebar draws straight over it.
**Cause:** all three come from the same instinct — build the panel _inside_ the
card it belongs to, with a `<details>` or a boolean signal and absolute
positioning. Inside the card it cannot escape the card's `overflow` (clipping)
or its stacking context (the sidebar wins at `z-index: 200`), and a `<details>`
has no concept of "someone clicked somewhere else".
**Rule:** use `InfoPopover` (`src/components/InfoPopover.tsx`). Do not hand-roll
another one. What it does, and what any replacement must also do:

- **Portal the panel to `<body>`** and position it `fixed` from the trigger's
  `getBoundingClientRect()`. No ancestor can then clip it or bury it.
- **Clamp to the viewport** on both axes, and flip above the trigger when there
  is no room below. Centring on the trigger is not enough — the leftmost card
  in a grid still overflows.
- **Close on all four:** outside `pointerdown` (capture), `Escape`, scroll
  (capture — a panel positioned from a stale rect ends up stranded), and
  unmount. The unmount one is what stops it surviving a tab change.
- **Remove every listener in `onCleanup`.** A document-level listener that
  outlives the component is a leak that fires against a dead signal.
- **Sit below modals.** `z-index: 9000` clears the sidebar and app chrome;
  dialogs and notifications at 10000+ should still win.

**See:** `src/components/InfoPopover.tsx`, and the badge hints in
`VocalChallenges.tsx` for a call site.

**Bitten again, 0.9.11:** `JamRoomCode`'s "Link copied" note hung under the
pill from inside the room header (`position: absolute; z-index: 5`) and was
painted under the playback row, because the header is a stacking context and
the row below it is a later one. The rule is not only for panels you open: a
note that must be over everything is portalled too. The browser check for it
has to make the note take presses for a moment -- a hit test skips whatever is
`pointer-events: none`, so `elementFromPoint` never returns the note itself.

### One tab can be two screens, and a tour is per screen

**Symptom:** inside a jam room the sidebar's Tour played the lobby's steps:
four tooltips pointing at a name field and a Create button that were not
there.
**Cause:** tours were keyed by tab (`PAGE_TOURS[tab]`), and the Jam tab is the
lobby until a room opens and the room after that.
**Rule:** when a tab has more than one screen, pick the tour from the state
that decides the screen (`pageTourSteps` in `app-store.ts`), and ask the STORE
that owns that state, not the panel: a panel unmounts on a tab switch and the
room does not. Do not import a feature's store into `app-store.ts` to ask --
it is in every page's first paint. A file that imports nothing holds a reader
and the feature's store provides it (`src/lib/jam/jam-room-presence.ts`).

**And a target needs a box.** The room tour's first step pointed at the block
holding the room's name and its strip, which is `display: contents` under
900px: no box, so no spotlight, on a phone and on a tablet held upright only.
A desk walk never sees it. Point a step at something that is drawn at every
width, and walk a new tour at three widths (`jam-room-tour.spec.ts` does).

### Supply semantic colours at a standalone portal's call site

**Symptom:** Guitar Night's removal confirmation had transparent panels and an invisible action.
**Cause:** its shared dialog expected app theme tokens; a nested body portal had only room colours.
**Rule:** a portal skin bridge copies existing tokens, not missing aliases. Supply the shared
component's semantic colours at its immediate caller and test both nested and ordinary entry paths.
**See:** `src/features/guitar-night/GuitarRecordingRemoval.tsx`,
`src/components/portal-skin.ts`, `src/e2e/guitar-recorder-overlays.spec.ts`.

### `scrollWidth` cannot tell you there is room to spare

**Symptom:** a responsive bar that adapts its content to the available width
only ever shrinks. It degrades correctly on a narrow window and then stays
degraded when the window is widened.

**Cause:** `scrollWidth` is defined as _at least_ `clientWidth`. On an element
with slack it reports the box, not the content, so `scrollWidth > clientWidth`
is a one-way overflow test — never a "there are 400px going unused" test.

**Rule:** to measure what the content actually wants, sum the children's
`getBoundingClientRect().width` plus the flex `columnGap`. That reads correctly
in both directions, which is what lets a fit pass grow back.

Two traps travel with it:

- **The element must claim its space.** A `flex-grow: 0` item is exactly as
  wide as its content, so `clientWidth` moves with the content and there is no
  fixed budget to compare against. `flex-grow: 1` + `min-width: 0` makes
  `clientWidth` mean "what the container will give me".
- **Never measure from `onMount` or inside a `createEffect` body.** Solid
  batches signal writes made during an update cycle, so the DOM still holds
  the previous state when you measure it. Every candidate reads as overflowing
  and the pass collapses to its smallest state. Measured on the tab bar: it
  settled on one tab per group where two fit with 11px spare.

**See:** `fitToWidth` in `src/components/AppNavTabs.tsx`

### `requestAnimationFrame` never fires when the page is not compositing

**Symptom:** layout-measuring code works when you watch it and silently never
runs in a headless run, an offscreen preview, or a background tab. In the tab
bar's case the bar stayed at its widest state, overflowing, with no error
anywhere.

**Cause:** browsers suspend rAF for pages that are not painting. A one-shot
`requestAnimationFrame(measure)` is therefore not a guarantee that `measure`
will ever run.

**Rule:** when the work must happen even unobserved, race a `setTimeout`
against the frame and let whichever arrives first cancel the other. Keep rAF as
the preferred path — it is the correct moment for reading layout.

**See:** `scheduleFit` in `src/components/AppNavTabs.tsx`

### A CSS-module `:global()` rule beats app.css at equal specificity

**Symptom:** a plain-class rule in `src/styles/app.css` has no effect on an
element whose other classes clearly apply. Measured, not guessed: the tab
overflow button rendered 46px wide against a rule asking for 30px.

**Cause:** Vite injects CSS-module stylesheets _after_ the global ones, so at
equal specificity the module wins on load order. `.app-tab` is declared
`:global(.app-tab)` in `AppNavTabs.module.css`, so it overrides any bare
`.some-class` in app.css for every property the two share.

**Rule:** when overriding a `:global()`-exported class from app.css, add the
ancestor id (`#app-tabs .some-class`). And confirm the override took effect by
reading the computed value — a silently dead rule looks exactly like a rule
that is working.

**See:** `.tab-overflow-trigger` in `src/styles/app.css`

### Declare a helper ABOVE every memo that calls it

**Symptom:** the sync modal threw `TypeError: Cannot read properties of
undefined (reading 'reduce')` on a device that had a song to send, and
mounted perfectly on a device that had none. The reported line was a memo
that had nothing wrong with it.

**Cause:** two things compounding. `createMemo` runs its body immediately,
not on first read, so a memo that calls a `const` arrow declared further
down the component hits its temporal dead zone. And the resulting error is
SWALLOWED: the memo keeps `undefined`, and what surfaces is the
`Cannot read properties of undefined` thrown by whichever memo reads it
next — one or two declarations later, pointing at innocent code. Here
`tooBigForPeer` sat 50 lines below `sendable` and `pickable`; an empty
library never called it, because `[].filter(fits)` does not call `fits`.

**Rule:** in a Solid component, every helper a memo touches goes above the
first memo that touches it. And when a memo blows up on `undefined`, look
at the memos declared BEFORE it before believing the line number. Test the
shape that triggers it: mount the list WITH data, since mounting it empty
is what made this invisible.

**See:** `src/components/sync/SyncDevicesModal.tsx`,
`src/components/__tests__/SyncDevicesModal.test.tsx`

### Cap viewport-sized overlays to their positioned container

**Symptom:** a drawer looked open, but its tabs could not be clicked because a
fixed header intercepted every pointer attempt at a common desktop viewport.
**Cause:** the drawer used `vh` height while positioned inside a shorter stage;
its top extended beneath the higher-z-index header outside that container.
**Rule:** cap viewport-derived overlay height to `100%` of its containing block,
then regression-test settled geometry and `elementFromPoint` hit ownership.
**See:** `src/features/drum-night/DrumNightApp.module.css`

### Keep grid placement on the host, not reusable content

**Symptom:** recorded-stem buttons became 263px columns beside the Amp.
**Cause:** reused channel content retained `grid-area: channels` inside a
different grid, creating implicit placement and stretching unrelated controls.
**Rule:** host wrappers own placement; shared controls own only their internal
layout. Test row geometry with both two and six tracks, not just overflow.
**See:** `src/features/guitar-night/GuitarNightSongMixer.tsx`

### Keep a CSS grid's named areas in one module

**Symptom:** adding a Listening column made the song controls overlap in implicit columns.
**Cause:** CSS Modules scoped new template-area names differently from the old child-area names.
**Rule:** define the template and every named child placement in the same CSS module;
verify bounding boxes and screenshots rather than only element visibility.
**See:** `src/features/guitar-night/GuitarNightRoom.module.css`

### Keep download links inside the modal that owns the action

**Symptom:** exporting from Jam Doctor made bytes but no browser download.
**Cause:** its capture-phase background-click guard blocked an anchor appended to `body`.
**Rule:** append programmatic download anchors inside the owning dialog and remove
them after the click; keep the background guard and verify a real download event.
**See:** `src/lib/guitar/recording-export.ts`

### Hoist conditional JSX props before asynchronous consumers read them

**Symptom:** recorder RAF and Practice clicks repeatedly warned about ownerless computations.
**Cause:** Solid compiled ternary `source`/`backing` JSX props into getters that created
fresh conditional memos whenever an async callback read them outside the render owner.
**Rule:** derive these values in component-owned `createMemo`s and pass their plain reads;
do not hide the warning with a new root per frame. Capture a browser warning stack first.
**See:** `src/features/guitar-night/GuitarNightSourceOwnership.test.tsx` exercises
the actual compiled prop getters.

### Restate `background-origin: border-box` after every `background` shorthand

**Symptom:** a control with a translucent border and a gradient fill drew a flat 1px
band at its edges, on a corner radius a pixel larger than the fill's. It reads as a
second rectangle laid over the rounded corners.
**Cause:** three defaults compounding. `background-origin` is `padding-box`, so the
gradient tile is _sized_ to the padding box; `background-clip` is `border-box`, so it
is _painted_ out to the border box; and `background-repeat` is `repeat`, so the strip
between the two boxes is not empty — it is filled by the neighbouring tile. The result
is a wrap seam, not a stretched end stop: the top and left strips show the tile's
opposite edge, the **last** stop, and the bottom and right strips show the **first**.
Measured on `linear-gradient(180deg, #ff0000, #0000ff)` with a 6px transparent border:
the top strip is `rgb(2,0,254)` while the fill's first row beneath it is `rgb(251,0,4)`.
Set `background-repeat: no-repeat` and the strip is not painted at all, which is the
proof it is tiling and not extension. Only a translucent or transparent border lets it
show, which is why it survives review. The `background` shorthand also resets
`background-origin`, so a declaration in the base rule is a silent no-op the moment a
`:hover` or `[aria-pressed]` rule sets `background:` again.
**Rule:** put `background-origin: border-box` immediately after **every** `background`
shorthand in the chain, not once in the base rule. It is not a blanket fix. The seam is
worst where the two ends of the gradient differ most and the radius is tight — so a
small control shows it and a wide panel behind a 20px radius and a low-contrast wash
does not. A gradient whose last layer is an opaque colour cannot show it at all, since
that layer fills the painting area on its own. A gradient ring built out of
`linear-gradient(...) padding-box, linear-gradient(...) border-box` depends on the
split and must be left alone. Render the candidate before and after rather than
trusting the CSS.
**See:** `pnpm audit:background-origin` lists candidates and separates the deliberate
ones; `src/features/path/PlainPathView.module.css` restates it across five orb states;
`.displayNamePill` in `src/components/account/AccountSection.module.css` (the two-layer
`background` at line 52) is the ring that needs the split.

### Publish one-shot intent before mounting its lazy consumer

**Symptom:** automatic import either missed the new file or ran after reopening.
**Cause:** the modal mounted before its pending intent was assigned; a lazy mount
could also leave that intent unclaimed when the user closed it.
**Rule:** assign intent first, batch the selected file and open state, and clear
unclaimed intent on close. Account recovery and reopening are not new consent.
**See:** `NightMusicImport.test.tsx` and `NightAudioChoices.test.tsx` cover both races.

### Keep extracted controls styled in their actual host

**Symptom:** Drummer looked like a browser-default button and obscured the mixer.
**Cause:** a wrapper bypassed `.roomTools > button`, including its phone sizing;
the extra width also made the song eyebrow wrap and shrink the stage.
**Rule:** own the full control chrome and responsive size; check the closed host
with long names and active-state additions, not only the open dialog.
**See:** `session-drummer-touch.spec.ts` and the Guitar Night responsive specs.

### Ignore a child's lost capture when a drag parent takes over

**Symptom:** wheel dragging worked with a mouse but never committed on tablets.
**Cause:** the touched option implicitly captured the pointer; transferring it
to the wheel bubbled the child's `lostpointercapture`, cancelling the gesture.
**Rule:** handle loss only for the capture-owning target and active pointer ID.
**See:** `DrummerWheel.tsx`; native touch swipe/tap/cancel regressions in
`session-drummer-touch.spec.ts` reproduce the otherwise-missed path.

### Check that a controller's handlers are actually wired before fixing one

**Symptom:** the Compose Import MIDI tempo fix was applied twice, a month apart,
and the button still ignored the file's tempo both times.
**Cause:** `useEditorController` returns import/export/share handlers, but
`App.tsx` called it for its side effects and discarded the result. The live
Compose import is the piano roll's OWN toolbar button, which reaches the host
through the editor's callbacks, not through the controller.
**Rule:** before fixing a handler, grep for a caller of it. A hook whose return
value is dropped is a plausible-looking dead path.
**See:** `src/features/editor/useEditorController.ts`, `src/lib/piano-roll.ts`
import handler, issue #813.

### Finish a committed camera turn independently of movement speed

**Symptom:** a short left/right step turns Merc 90 degrees but leaves the camera halfway around; immediately after zoom, it does not turn at all.
**Cause:** follow ran only above a velocity threshold, and wheel zoom reset the same quiet timer as manual orbit. Sustained-motion tests missed both interactions.
**Rule:** separate zoom from orbit ownership, finish a heading committed by real movement after stopping, and cancel it on manual look/lifecycle changes. Test brief input plus release at several zoom distances; preserve a stable movement basis so follow cannot create circles.
**See:** `packages/glass-game/src/render/camera.test.ts`, `apps/beside-cue/e2e/glass-adventure-controls.e2e.ts`.

### Re-anchor changed keyboard intent without feeding camera motion into held input

**Symptom:** adding Forward while Left stays held sends Merc relative to an old view, even though individual presses behave correctly.
**Cause:** the movement basis was locked until every direction key released, treating a changed chord as unchanged intent.
**Rule:** sample the current view when the normalized keyboard direction changes; ignore repeats and equivalent aliases. Keep unchanged input stable. Do not apply wholesale rebases to small analog angle changes: a large camera/basis difference would become an unintended turn.
**See:** `packages/glass-game/src/ui/input.test.ts`, `apps/beside-cue/e2e/glass-adventure-controls.e2e.ts`.

### Inspect extracted game UI beneath the real host resets

**Symptom:** the encore chart shrank to a 24px strip, and compact result controls inherited large text.
**Cause:** `.adventure svg` and `.adventure button` outranked single-class CSS-module rules.
**Rule:** give extracted components explicit scoped sizing and typography; verify computed styles and 320px screenshots inside the actual game, not an isolated component page.
**See:** `packages/glass-game/src/ui/MelodyRibbon.module.css`, `CompletionResults.module.css` and their host E2E coverage.

### Validate the rendered camera centre after smoothing

**Symptom:** corridor yaw checks passed while the real image showed only a wall or a huge close-up of Merc.
**Cause:** the body could enter the camera-radius clearance shell; the boom collapsed to its target. A valid alternate endpoint also had an unsafe short prefix when distance easing resumed from zero.
**Rule:** traverse the real route with held input and inspect pixels. Assert actual camera centre, subject projection and clearance on acquisition and release frames, not only requested yaw or final ray reach. Revalidate after smoothing and synchronize its state when safety overrides placement.
**See:** `packages/glass-game/src/render/camera.ts`, `camera-input-follow.test.ts`, `camera-obstruction.test.ts`.

### Keep captured controls inside a stable DOM boundary

**Symptom:** a held joystick stops when a nearby action disappears, without unmount, blur or pointer release.
**Cause:** Solid reconciles flattened reactive siblings by temporarily removing and reinserting the same controls node; native pointer capture is lost even though its identity and final `isConnected` stay unchanged.
**Rule:** isolate pointer-owning controls and dynamic neighbors inside a stable DOM boundary. Reproduce with a real held pointer and observe removed nodes, capture and movement across sibling transitions; component cleanup alone cannot detect this.
**See:** `packages/glass-game/src/ui/AdventureVisit.tsx`, `apps/beside-cue/e2e/glass-adventure-camera.e2e.ts`.

### Separate blocked camera follow from browser observation gaps

**Symptom:** a Journey camera check stayed exactly 45 degrees off Merc, while retries failed an initial 200 ms turn or a later quiet-window assertion.
**Cause:** a brief collision slide ended before the heading dwell, leaving the blocked keyboard view stale. Separately, two remote DOM reads missed real angle crossings under 6x CPU slowdown, and a remote 800 ms wait sampled after legitimate follow resumed. The original 200 ms retries lacked frame evidence; their exact cause remains unproved.
**Rule:** reproduce contact behavior with the real level first. Observe both headings on one browser frame; anchor quiet-window evidence to trusted keyup and the preceding held-frame interval, preserving the angle and grace limits. Report missing in-window frames as scheduling starvation.
**See:** `packages/glass-game/src/render/camera-input-follow.test.ts`, `apps/beside-cue/e2e/helpers/glass-adventure-camera-observation.ts`.

### Write `-webkit-user-select` yourself in every stylesheet the native app loads

**Symptom:** on an iPhone (TestFlight, 17 Oct 2026) a tap on the Ng bridge's picture and on the Lantern's note label selected them, though `Lantern.module.css` said `user-select: none`.
**Cause:** Safari and every iOS WebView honour only `-webkit-user-select` (caniuse: prefix required through iOS 26.5; Playwright's WebKit 26.4 reports `CSS.supports('user-select', 'none')` false and leaves `webkitUserSelect` at `text`). The web build's Lightning CSS targets add the prefix; the native build (`apps/mercurypitch/vite.config.ts`) set no CSS target then, so its CSS shipped unprefixed. It has one now (`NATIVE_CSS_TARGET`, `safari16, ios16`, owner 17 Oct): the minifier adds `-webkit-user-select` and `-webkit-backdrop-filter`, which also turned the glass blur on for iOS 16 and 17. `apps/mercurypitch/src/native-css-target.test.ts` pins it.
**Rule:** in any stylesheet the native app loads, write the `-webkit-` spelling of `user-select` (and `-webkit-touch-callout`, `-webkit-user-drag`) beside the unprefixed one, even though the CSS target adds `-webkit-user-select` too: the source is what the test can read, and the target adds nothing for the other two. The app turns selection off for the document (`shell.css`), so a place that wants it back must say `-webkit-user-select: text` or `all`; `apps/mercurypitch/src/no-select-css.test.ts` fails if it does not. Rooms take the shared `RoomSurface.module.css` class on their root.
**See:** `apps/mercurypitch/src/shell/shell.css`, `src/components/room-kit/RoomSurface.module.css`, `apps/mercurypitch/src/no-select-css.test.ts`.

### Give a pinned footer its own row, not `position: sticky` over the scroller

**Symptom:** Drum Night's Take ready card, `sticky; bottom: 0` in the phrase-coach column, cut the coach's last row and left the top 12 px of a button showing under it (DOM at 1440x900: card 534.38-738 in a column 66-750).
**Cause:** Chromium insets a sticky box by its scroller's padding, so `bottom: 0` in a column with `padding: 12px` stops 12 px short of the edge and scrolled content paints in that strip. And a sticky footer is an overlay by design: at most scroll positions some row is partly under it.
**Rule:** for a footer that must stay on a column's edge, make the column a flex column, scroll the content in its own region above the footer, and keep the footer out of the scroller. Test it by walking the scroll range and checking each text node's clipped box against the footer.
**See:** `.phraseCoachScroll` in `src/features/drum-night/DrumNightApp.module.css`, `src/e2e/drum-take-card.spec.ts`.

### Budget a sticky panel against a short landscape browser window, not a portrait phone

**Symptom:** on an iPad in Safari, landscape, eight of the lessons' seventeen steps had a slider or a row of buttons below the fold, unreachable while their step showed (scrolling on picked the next step), though every check passed.
**Cause:** the step stage is sticky beside the text above 960 px and had no height limit. The specs budgeted it at 390 x 844 only, where it scrolls with the page, and the nominal 1024 x 768 fitted with 4 px to spare. A browser's bars take 70 to 140 px of that: 1024 x 672 in Safari, 1024 x 640 with its tab bar, 1366 x 657 in a laptop's window.
**Rule:** a sticky panel must fit the smallest viewport it sticks in (`100svh`). Let its flexible part give way first, keep a scroll inside the panel as the last resort, and test at the browser's sizes, not the device's screen. Look at every figure the fit shrinks, not only at the boxes: a canvas laid out in fixed pixels (a readout in its corner, a label per semitone) collides with itself below a height the e2e cannot see, so each such figure carries its own floor (`--viz-min`).
**See:** `src/features/lessons/kit/stage-fit.ts`, `src/e2e/learn-stage-fit.spec.ts`, `--viz-min` in the lesson stylesheets

### Give a scene delegate to the application role only, never to every role (iOS)

**Symptom:** with the iPhone app open, AirPlay screen mirroring put a second copy of the app on the TV, stuck on the Rooms start screen while the song's sound played on the TV, instead of mirroring the phone (an LG C2, 2026-10-22, builds before mp-v0.8.40). The upstream report sees a second `Loading app at capacitor://localhost` in the console each time mirroring starts, and the same from a cable.
**Cause:** iOS asks for a scene with the external-display role even when the app supports one scene. Capacitor 8.5's UIScene template returns `SceneDelegate` for every role from `configurationForConnecting`, and `SceneDelegate` builds a new bridge for every window scene: a second web app, sharing the first's storage and initialising every plugin twice. Apple's answer is to create no window for that scene unless the app means to stop mirroring (ionic-team/capacitor#8648, still open upstream on 2026-10-21).
**Rule:** give `SceneDelegate` to `.windowApplication` alone, guard `scene(_:willConnectTo:)` on the role too, and recheck both after every Capacitor upgrade or template migration. A deliberate second screen gets its own delegate and a plain web view, never a second bridge.
**See:** `apps/mercurypitch/ios/App/App/AppDelegate.swift`, `apps/mercurypitch/ios/App/App/SceneDelegate.swift`, `apps/mercurypitch/src/ios-external-display.test.ts`

### Take the lessons' base stylesheet into another page by `@import`, never by a link

**Symptom:** once the series' hub was added, Lesson 6 scrolled sideways at 360 and 375 px, and on every lesson page the choice buttons lost their padding and stopped wrapping. The hub's own tests passed; only Lesson 6's width checks failed.
**Cause:** the hub's document linked `kit/lesson-base.css`, which every lesson's script imports. Shared with the hub, it left the chunk the eight lessons share, whose stylesheet it had opened, for a chunk of CSS alone, and Vite links such a chunk after the page's own stylesheet. Its rules then came after the kit's and the lesson's, and won every tie of specificity with the rules written to refine them.
**Rule:** a page outside the lessons takes the base through a stylesheet of its own that `@import`s it (`kit/lesson-hub.css`): the build inlines the import, so no chunk of the lessons changes. After a change to which documents or scripts take in a shared stylesheet, compare each `dist/learn/NN.html`'s stylesheet links with main's build: the same files, in the same order.
**See:** `src/features/lessons/kit/lesson-hub.css`, `tools/learn-hub.test.ts`

### A class that composes from another file must not set what the composed class sets

**Symptom:** in a scratch Vite build of the plan screens' sheets (the repo's own CSS config), a wide-screen headline's `font-size: 46px`, set on a class that composes the shared headline, lost to the shared 31px. In the other screen the same kind of rule would have won. The build was silent and Vitest does not process CSS, so nothing else shows it. Caught in Plan 1A (Task 6) before it shipped.
**Cause:** under Vite's CSS Modules (Lightning CSS, Vite 6.4.4), a class composed from another file lands after the first importer's own rules and before the next importer's, so a local declaration of the same property is not guaranteed to win. The order follows import order, and a lazy chunk repeats it.
**Rule:** a class that composes from another file never sets a property the composed class sets, a longhand counting against its shorthand. Vary a shared value through a custom property the composed class reads with a fallback (`--pc-headline-max`): no order can undo that. `plan-chrome.test.ts` holds the plan's two sheets to this.
**See:** `src/features/plan/plan-chrome.module.css`, `src/features/plan/plan-chrome.test.ts`

### Give a dialog that isolates the keyboard a root that takes focus from a press

**Symptom:** behind a modal that stops every key (`isolateKeyboard`), a Space, an M or an Escape still reached the app's window shortcuts once a person had pressed on the modal's words: the tab behind played, the microphone toggled. A test that sends keys at the modal's controls cannot see it, because those keys start inside the root.
**Cause:** the stop holds only for a key sent from inside the root, and a press on content that takes no focus drops the focus to the page, so the keys after it start outside. Measured in headless Chromium on a stand-in dialog: with no `tabindex`, `document.activeElement` was `BODY` after a press on the words; with `tabindex="-1"` on the root it stayed on the root. jsdom moves no focus on a press (a mousedown on the words left it on the button), so a test must supply the browser's move itself (`press()`) and proves the wiring, not the browser. The stop is also bubble-phase: a capture-phase listener on the window runs before it and hears every key (jsdom: window and document capture heard a Space, the document and window bubble listeners did not).
**Rule:** the root of a dialog that passes `isolateKeyboard` gets `tabindex="-1"` and no focus ring (the trap does not count the root as a Tab stop or open on it), and a capture-phase window or document shortcut yields to `[role="dialog"]`, as `isInsideOverlay` does. Bind the dialog's own key handlers natively, as "Use native key handlers inside propagation-stopping dialogs" says; `trap-key-handlers.test.ts` scans the imports of every host that passes `isolateKeyboard` for the delegated ones, and fails when a new host is missing from its list.
**See:** `isolateKeys` in `src/lib/keyboard-isolation.ts`, `isInsideOverlay` in `src/lib/space-playback.ts`, `src/tests/utils/trap-keys.ts`, `src/tests/trap-key-handlers.test.ts`

### Never write the address from state between a popstate and its hashchange

**Symptom:** `onboarding.spec.ts`'s Map test failed about one run in 60 at six workers: after `goto('/#/map')` First Light stayed on its first beat, with `#/home` in the address.
**Cause:** a browser fires popstate first for every change of the hash, a link's and a typed address's as well as Back's, with the address already moved, and the hashchange in a task of its own after it (measured in headless Chromium). The plan store's lazy import landed in that gap and reran the router's state-to-hash sync, which wrote `#/home` back with replaceState, so the hashchange read `#/home`. A jsdom test that pushes and then dispatches only a hashchange never opens the gap.
**Rule:** an effect that writes the address from state holds off while the browser has moved somewhere the router has not read (`unreadMove`: set by the popstate, cleared by the hashchange), and its test dispatches the popstate, then changes state, then the hashchange. Do not read a popstate as "a traversal": a link fires one too.
**See:** `holdForMove` in `src/features/routing/useHashRouter.ts`; "a move the router has not read yet" in `src/features/routing/useHashRouter.test.tsx`

### Read a signal before a plain value in a memo's `&&`

**Symptom:** Span's sung answer window never opened once `open` became `sungRun() && (phase() === 'answer' || ...)`.
**Cause:** `sungRun()` reads `run.trackId()`, an accessor over a plain variable, not a signal. False at mount, it short-circuited the `&&`, so the memo read no signal at all and never ran again. A memo tracks only what its last run read.
**Rule:** in a reactive condition, read the signal first and the plain value last (`(phase() === 'answer' || ...) && sungRun()`). An accessor's name does not say whether it is a signal: look.
**See:** `hearingAgain` and the sung window in `src/features/ear-lab/SpanDrill.tsx`

### Theme a portalled sheet with tokens at its anchor, never a theme selector on the portal

**Symptom:** caught in review of the native More sheet: with the phone following the system theme, flipping it while the sheet was open would turn its cards white and leave its text white (about 1:1).
**Cause:** the kit's `Sheet` portals to <body> and copies every custom property that resolves on its in-place anchor onto the portal as it opens (`createPortalSkinBridge`), inks included, and does not copy again until it reopens. A `:root[data-theme='light'] [role='dialog'].x` rule on the portalled panel follows the live attribute while the inks stay the snapshot.
**Rule:** declare a sheet's theme-dependent values as custom properties on an ancestor of its anchor (the shell, the stage), dark and light, and have the panel read them; they then change with the inks, at the next open. `apps/mercurypitch/src/more-sheet-css.test.ts` holds the More sheet to it.
**See:** `src/components/portal-skin.ts`, the More sheet's tokens in `apps/mercurypitch/src/shell/shell.css`

## Performance

### Preserve physical material units when baking decoded geometry

**Symptom:** imported glass had enormous packed thickness values and inconsistent refraction after its node scale was baked into vertices.
**Cause:** quantization correctly placed inverse units in `KHR_materials_volume.thicknessFactor`, but flattening the decoded node discarded the compensating scale.
**Rule:** for explicitly authored physical-unit assets, bake uniform world scale into the owned material variant with geometry; verify world thickness after real Meshopt decoding and leave legacy recipes unchanged.
**See:** `packages/glass-game/src/render/asset-geometry.ts`, `material-library.ts` and `singing-current-wall-asset.test.ts`.

### Finish document checks before starting a software-rendered scene

**Symptom:** the Glassworks delivery smoke spent over 100 seconds clicking an enabled entrance and then exhausted its total budget on a document request.
**Cause:** SwiftShader rendering starved Playwright's physical-click actionability loop; the same test also retried on unchanged main. Asset responses were successful.
**Rule:** finish document-only HTTP assertions before starting WebGL. For a delivery smoke, assert the entrance is visible, enabled and focused, then use real keyboard activation. Keep separate pointer tests for pointer behavior; do not widen game or test timing to hide renderer starvation.
**See:** `src/e2e/glass-game.spec.ts`.

### Do not iterate an audio buffer per-pixel in `requestAnimationFrame`

**Symptom:** severe frame drops on long files.
**Cause:** `samples.length / width` iterations per pixel, per frame — hundreds
of millions of operations.
**Rule:** precompute a min/max peak mipmap in `Float32Array` blocks at load
time and draw from that. Also avoids the moiré banding that sample-skipping
produces at some zoom levels.

### A `manualChunks` group erases the `await import()` it contains

**Symptom:** 2.16 MB of alphaTab + the WASM AAC encoder shipped on the first
paint of every entry — including the standalone ones built to stay small —
although both were reached only through `await import(...)`, and one said so in
a comment.
**Cause:** naming a chunk merges modules. If _any_ module in the group has a
static importer, Rollup makes the whole chunk a static dependency of the entry
and emits a `<link rel="modulepreload">` for it. The dynamic boundary in the
source stops existing. Same bug hit `vendor-gpu`: `wgpu-matrix`, imported by
the 2D _fallback_ renderer, dragged the whole TypeGPU stack in with it.
**Rule:** a dependency you deliberately load dynamically gets its OWN chunk
name, never a shared one. Verify with `ANALYZE=1 pnpm build` and then
`grep <chunk> dist/*.html` — absent from every entry HTML is the only proof.
**See:** `vite.config.ts` `manualChunks`; `src/lib/jam/stem-encoder.ts:36`.

### A `manualChunks` rule that names a feature owns every helper the feature reaches

**Symptom:** the Voice Mirror, Karaoke Night, Glass and the crawlable vocal
pages each downloaded about 3.1 MB of JavaScript before first paint to run
about 90 modules. Importing a 30-line helper from the jam room broke Piano
Night's audit.
**Cause:** a module named into a manual chunk takes every static dependency
that has no name of its own with it, transitively
(`addStaticDependenciesToManualChunk`). Three rules named whole features by
component name (`community`, `advanced`, `library`), so the first of them to
reach a shared helper owned it, and a page that needed the helper loaded the
chunk -- and the other two, because they import each other. Every per-module
pin in the config was this bug, patched once.
**Rule:** never name a component or a feature into a chunk. Name leaves and
vendor packages; let Rollup place shared app code by which entries reach it.
`build:e2e` weighs every emitted document
(`assert-first-paint-budgets.mjs`), and a breach names the heaviest chunks. Do
not reach for `output.experimentalMinChunkSize` to cut the request count: at
10 KB it put `pitch-core` into Piano Night (298 KB to 542 KB, failing its
audit) and gave the script-free 404 page 256 KB of JavaScript.
**See:** `vite.config.ts` `manualChunks`,
`scripts/assert-first-paint-budgets.mjs`, `src/e2e/every-document-boots.spec.ts`.

### Keep every runtime dependency of `pitch-core` on its side of the chunk boundary

**Symptom:** the production build completed, but the app stayed blank with
`Cannot access '<minified name>' before initialization`; unit tests stayed green.
**Cause:** a new `pitch-core` module imported unclassified pitch leaves that
Rollup placed in `advanced`, closing `advanced -> library -> pitch-core -> advanced`.
**Rule:** when `pitch-core` gains an import, pin its dependency-free runtime
leaves there too. Treat a circular-chunk warning as a failed build and run a
production browser boot test before pushing.
**See:** `vite.config.ts` `manualChunks`.

### Keep Drum Night runtime helpers out of parser-owned modules

**Symptom:** Drum Night's production bundle suddenly loaded `midi-song` and
`piano-project` on first paint after adding one six-key cymbal predicate.
**Cause:** the audio engine made a value import from `midi-song.ts`; that module
also owns parser/projector entry points, so Rollup retained their static graph.
**Rule:** put dependency-free percussion identity helpers in `percussion.ts`.
Runtime audio may import parser DTOs only with `import type`.
**See:** `src/lib/percussion.ts`, `scripts/assert-drum-night-bundle.mjs`

### Move timed note fields as one compositor track

**Symptom:** a small falling-note scene dropped near 20 fps on a tablet while
audio remained correctly timed.
**Cause:** every sampled frame rewrote each note's layout-driving `bottom`, so
style recalculation, paint, and raster dominated despite little JavaScript.
**Rule:** keep note geometry static inside a bounded beat window and translate
one stage-sized track; update the window and anchor only at coarse beat seams.
Guard zero per-note style mutations in a browser test, not with an FPS gate.
**See:** `src/features/piano-night/PianoNightStageViews.tsx`,
`src/e2e/piano-night.spec.ts`

### Measure detector throughput before enlarging a recording queue

**Symptom:** recorder browser tests stopped after two seconds with processing behind.
**Cause:** YIN wrote a Float32 sum inside its innermost loop; 2.048 seconds of
audio needed about 1.6 seconds of analysis locally, leaving little CI headroom.
**Rule:** benchmark the real analysis first. A local sum with one store per lag
took about 0.38 seconds with pitch fixtures passing; keep bounded fail-safe queues.
**See:** `src/lib/pitch-detector.ts`, `docs/guitar-recording-testing.md`

### Prove an imported display surface is visible before swapping its texture

**Symptom:** an earned museum portrait loaded successfully, but its frame stayed black.
**Cause:** the generated ornate primitive contained a solid slab in front of its separately named inset. Material replacement and ready-state tests could not reveal the occlusion.
**Rule:** raycast the delivered donor from the actual viewing side and inspect a rendered earned state. Preserve the inset silhouette/UVs and derive front clearance from geometry; do not substitute a rectangle or trust texture-install diagnostics as visual proof.
**See:** `packages/glass-game/src/journey/architecture.ts`, `art/glass-adventure/journey-map/v4/proofs/runtime/`.

### Initialize manual shadows before offscreen startup renders

**Symptom:** phone assets loaded successfully, then first-frame validation reported a graphics failure; desktop High quality worked.
**Cause:** Balanced disabled automatic shadows, but the reflection probe rendered before the main cadence requested its first shadow update. Three sampled a placeholder texture with the wrong sampler type.
**Rule:** prime manual shadows before any scene render, including startup probes. Test cold startup in each automatic profile with real pixels; a High-to-Balanced switch or no-raster input test misses this boundary.
**See:** `packages/glass-game/src/render/glass-renderer.ts`, `apps/beside-cue/e2e/glass-adventure-controls.e2e.ts`.

### Keep decorative platform triangles out of camera collision queries

**Symptom:** entering a singing challenge freezes the whole game, resembling a microphone startup delay.
**Cause:** the cinematic candidate search included dense instanced platform donors in hundreds of ray queries. In a matched loaded-scene/no-raster profile, 235 donor rays consumed 4,785.5 ms; excluding only those donors left 237 proxy/scene rays at 42.4 ms. Bounds traversal took 10.1 ms and synthetic microphone acquisition took 1.2 ms, so neither explained the reproduced main-thread stall.
**Rule:** mark decorative platform meshes `excludeFromCameraCollision` and use cheap physical proxies updated from current simulation state. Measure microphone acquisition, bounds traversal and real rasterization separately; do not add audio delays or reduce accepted artwork. Desktop CPU isolation does not establish physical-device frame time.
**See:** `packages/glass-game/src/render/cloudway-platforms.ts`, `packages/glass-game/src/render/camera-platform-occlusion.ts`, `art/glass-adventure/cloudway-laboratory/v1/source-assets/proofs/runtime/cloudway-sing-stall-2026-09-27/`.

### Separate WebGL rendering from browser canvas presentation

**Symptom:** the entire 3D canvas becomes a diagonal mosaic while DOM controls remain clear, sometimes recovering without a reload.
**Cause:** a standalone textured WebGL triangle reproduced the corruption with combined ANGLE/Vulkan compositor flags, despite correct framebuffer readback, nonzero buffers and no GL error; switching either path to OpenGL was clean. The exact upstream component remains unidentified.
**Rule:** compare isolated hardware backends and immediate framebuffer readback against screenshots before changing game assets or shaders. A clean `gl.getError()` does not prove correct presentation; do not label a driver crash without evidence.
**See:** [ANGLE backend selection](https://chromium.googlesource.com/angle/angle/+/main/doc/DebuggingTips.md), `packages/glass-game/src/render/viewport.ts`.

### Verify data-texture conversions through the renderer's upload path

**Symptom:** lossless normal-map WebPs matched Canvas2D but changed actual uploaded normal channels by one byte unit.
**Cause:** Chrome's 16-bit PNG data-texture upload quantized differently from Canvas2D and ordinary Pillow conversion; canvas equality did not certify RGBA8 NoColorSpace input.
**Rule:** preserve source masters, freeze and hash the actual uploaded RGBA reference, then compare replacement GPU readback with color conversion disabled and the renderer's flipY setting. Treat canvas comparison as diagnostic and require zero changed GPU channels; desktop proof does not establish native-device acceptance.
**See:** `apps/beside-cue/public/games/adventure-v2/manifest.json`, `packages/glass-game/src/browser/assets.ts`, `apps/beside-cue/scripts/game-assets.ts`.

### Budget enough fixed physics steps for ordinary mobile frames

**Symptom:** Merc looked uneven and travelled less distance on mobile, while his animation kept advancing.
**Cause:** Five 1/120 s steps capped simulation at 41.7 ms per rendered frame; the loop discarded the remaining accumulator. At 20 fps a two-second walk covered 1.84 m instead of 2.22 m.
**Rule:** Keep fixed collision steps but budget 100 ms of ordinary catch-up. Test equal elapsed movement at 120/30/20 fps and mixed hitches; retain a bounded suspension limit. A quality governor addresses GPU cost separately.
**See:** `packages/glass-game/src/core/movement.ts`, `packages/glass-game/src/core/game.test.ts`.

### Never paint an element a performance tier chose by class-name substring

**Symptom:** on a tablet, after a song played in the Karaoke mixer, the tour showed only its tooltip, Home's Learn dialog opened over an empty screen and the Zen song list drew grey bars. A reload cleared it; no DOM check found anything hidden.
**Cause:** the frame sampler (`device-tier.ts`) had dropped the device to the low tier for the session, and `performance-mode.css` gave every element whose class merely contained "overlay", "sheet" or "modal" an opaque `--bg-card` there. Full-screen scrims and transparent rows turned solid.
**Rule:** a tier stylesheet may use `[class*=…]` only to switch an effect off (filter, animation). A surface that needs another ground on a tier gets it from a token it already uses (`--glass-bg`). Check any tier with Settings > Quality or `?perf=low`: the sampler can apply `low` to any device mid-song.
**See:** `src/styles/performance-mode.css`, `src/styles/performance-mode.contract.test.ts`, `src/e2e/low-tier-overlays.spec.ts`.

### Apply mobile texture limits to standalone material maps too

**Symptom:** Little Discoveries lost an active iOS context during loading or before its first frame; separate catalog roughness maps still decoded at full size.
**Cause:** GLB textures used the mobile profile, while catalog material maps bypassed it. This is a verified budget omission, not proof of the physical reset cause.
**Rule:** profile each material slot before upload, register the replacement image for cleanup, and preserve sky orientation. Verify bitmap and canvas resizes by actual GPU readback, and hold a real asset request through context loss and Retry without replacing draw calls. Keep native acceptance separate.
**See:** `packages/glass-game/src/render/asset-kit.ts`, `apps/beside-cue/e2e/glass-adventure-loading-recovery.e2e.ts`, `apps/beside-cue/e2e/glass-adventure-texture-orientation.e2e.ts`.

### Give each renderer its own lighting lookup texture lifetime

**Symptom:** returning to the menu after completed levels retained old canvases, scenes and asset buffers in the production build.
**Cause:** Three 0.185.1's global DFG lookup texture kept each disposed renderer's texture-disposal callback, retaining its context and scene state. Deliberately losing a context did not remove that JavaScript root.
**Rule:** keep lookup pixels shared but the texture renderer-owned; release it before resetting renderer properties, while a lost context is still lost, and defensively before restoration setup. Deleting old GPU handles after restoration causes GL errors. Patch the actual ESM/CJS entrypoints as well as source; test real draws, concurrent renderers and navigation. Desktop retention proof does not establish an iOS termination reason.
**See:** `patches/three@0.185.1.patch`, `apps/beside-cue/e2e/glass-adventure-renderer-ownership.e2e.ts`.

### Cancel an asset consumer without aborting shared parser requests

**Symptom:** retiring a pending level could also reject its immediate replacement, and repeated retries could start new decodes while cancelled parses were still finishing.
**Cause:** Three FileLoader shares pending URLs across LoadingManagers, so manager-wide abort crosses consumer ownership; per-attempt concurrency limits do not include retiring attempts.
**Rule:** own the container fetch, let shared parser dependencies settle, and retire only the cancelled consumer's late scene. Hold global decode admission through parse, profiling and late cleanup; preserve Capacitor status-zero reads and relative dependency paths. These races are separate from completed-navigation retention.
**See:** `packages/glass-game/src/render/asset-scene-loader.ts`, `packages/glass-game/src/render/asset-load-admission.ts`.

## Data and billing

### Share pending startup hydration, not just a ready flag

**Symptom:** the first newly seeded song disappeared while a second remained.
**Cause:** concurrent session initializers both passed a ready-after-await guard;
the later whole-cache snapshot erased a song created after the first resolved.
**Rule:** return one shared initialization promise, and await it before creating
sessions. Check the durable completion result in fixtures instead of returning
an ID for a session that was never saved.
**See:** `src/stores/uvr-store-startup.test.ts`, `src/lib/e2e-song-seed.ts`

### Hydrate a durable job before trying to resume it

**Symptom:** a standalone route found an already-paid in-flight separation but
retry remained stuck forever.
**Cause:** IndexedDB had the provider job id while the tab's app-lifetime cache
was stale; the resume scanner only inspected that cache.
**Rule:** when durable dedupe finds an uncached job, hydrate that exact session
before invoking shared auto-resume.
**See:** `src/features/guitar-night/uvr-preparation-port.ts`

### Do not report terminal success before the record is durable

**Symptom:** separation appeared successful, then immediate catalog refresh
could not open the result.
**Cause:** stem writes completed but the terminal session-record write failed.
**Rule:** retain the completed cache for a cheap persistence retry, but return a
recoverable error and do not run completion handoffs until the record persists.
**See:** `src/lib/uvr-song-preparation.ts`

### Treat hibernated socket attachments as persisted authorization state

**Symptom:** a superseded Jam host could regain background controls only after
an overlapping reconnect and Durable Object hibernation.
**Cause:** host authority was updated in memory but remained true on two
serialized WebSocket attachments, so hydration chose by iteration order.
**Rule:** update memory, storage, attachments, and client signals as one state
transition; test live, overlapping, hibernated, departed, and expired paths,
and fail closed whenever reconstructed authority conflicts.
**See:** `workers/jam-worker/src/jam-room.ts`

### One completion event, one credit

**Symptom:** practice minutes counted twice for a single run.
**Cause:** two call sites both funnelled into the recording path.
**Rule:** `recordExerciseResult` and `endPracticeSession` are commit points —
call each exactly once per run. They fan out to minutes, challenges, routines,
badges and analytics.
**See:** `src/stores/exercise-history-store.ts`

### Every Worker route must be listed in `assets.run_worker_first`

**Symptom:** a production API route returned an empty 405 on POST and the SPA
shell on GET.
**Cause:** the Cloudflare asset layer answers everything not explicitly routed
to the Worker, before the Worker sees it.
**Rule:** adding an endpoint means editing `wrangler.jsonc` too.

**Bitten again, 0.9.11 -- a path that HAS a file.** `/mirror` was left off the
list on purpose: `html_handling` serves `mirror.html`, so nothing needed the
Worker. Then the Worker was given something to _add_ to that document (the
social tags of a shared voiceprint link, rewritten per request) and the list
was not revisited. The page loaded, every test passed, and the rewrite never
ran once. **A route needs listing when the Worker has anything to say about
it, not only when nothing else can serve it.** Pinned, with the reason, in
`worker-entry-routing.test.ts`.

### A number that travels under a short key loses its unit

**Symptom:** a shared voiceprint scoring 87 for accuracy unfurled as "accuracy
±87¢" -- nearly a semitone out, the opposite of what the card said.
**Cause:** the share payload carries `ac` and `sd`. They are the card's two
0-100 scores, but the codec's comment called them "median cents" and "cents on
holds", and the two readers written next (the recipient's view, the worker's
description) believed the comment. Every test used `ac: 12`, which is a
plausible number of cents and a plausible terrible score, so nothing looked
wrong.
**Rule:** when a value crosses a boundary under a short name, find what
WRITES it (`summarize()` here) before writing what reads it, and pick test
values that are only plausible in the right unit.

### Never edit an applied migration

**Symptom:** a schema change that worked locally did nothing on dev.
**Cause:** editing a migration that had already run — wrangler records applied
files per database, so the edit never executed anywhere.
**Rule:** add the next-numbered `workers/db-worker/migrations/NNNN_<what>.sql`.
Test against a replayed pre-change database, not just a fresh one: a column add
only surfaces on an existing table. The `scripts/migrate-*.sql` files predate
the tracked chain and are legacy-only
([README](../../scripts/README-legacy-migrations.md)) — never add another.

### Replay a migration chain, never reason about it

**Symptom:** a chain analysed statement-by-statement and declared safe failed
on the first file when actually run.
**Cause:** the analysis checked which columns each migration _adds_ and never
which columns each migration _reads_. `CREATE INDEX IF NOT EXISTS ... ON
t(missing_column)` still throws — `IF NOT EXISTS` guards the index, not the
column — and a `CREATE TABLE IF NOT EXISTS` above it is a silent no-op on a
database where the table already exists with an older shape.
**Rule:** rebuild the target database from the schema that environment
actually has (`git show <tag>:workers/db-worker/schema.sql` for anything
predating the tracked chain), then execute every migration against it in
order. A few seconds of SQLite beats any amount of reading. Remember that
columns added by the legacy `scripts/migrate-*.sql` scripts are NOT in
`schema.sql`, so a database's real shape is the schema plus whatever legacy
scripts were hand-run on it.

### Name a SQL column exactly before any rule checks it by name

**Symptom:** a write body with `"UserId"` moved a session record into another
singer's account, `"Score": 5000` got past the score validator, `"FriendCode"`
picked a vanity friend code, and an unauthenticated `where[Code]=...` confirmed
promo-code guesses on a route BUGS.md listed as fixed.
**Cause:** SQLite resolves identifiers without regard to case, so `"UserId"` in
an INSERT writes `userId`. Every per-column rule in the generic CRUD handlers
matched the exact JavaScript key instead: `delete body.userId`, the
`serverCols` strip, `validateWrite`, the streak clamp, `hiddenReadColumn`. A
key spelled in another case passed all of them and still reached the column.
**Rule:** check that a caller-named column is EXACTLY one of the table's
columns before any rule looks for it by name (`unknownColumn` reads them from
the schema). A denylist keyed on a column name is only as strict as its
spelling.
**See:** `unknownColumn` in `workers/db-worker/src/index.ts`,
`workers/db-worker/node-tests/column-names-integration.test.ts`

### A watermark that names the running week must include it next time

**Symptom:** the weekly league moved players exactly once, at the first cut,
and never again. Nothing was logged.
**Cause:** each cut stored the current, still-running week as its watermark,
and the next cut asked for weeks strictly after it. The stored week finished
later and was never cut; neither was any week after.
**Rule:** when a job stores where it got to, store what it finished, or make
the next run's bound inclusive of what it stored. Test a scheduled job across
at least two runs: one run cannot show this.
**See:** `runWeeklyLeagueCut` in `workers/db-worker/src/league.ts`,
`workers/db-worker/node-tests/league-integration.test.ts`

### A list without a limit is one page, and a natural key belongs in the schema

**Symptom:** with more than 100 songs the library publish stopped for good,
and a second device listed only 100 songs. Settings and challenge progress
grew duplicate rows, after which devices disagreed about which value held.
**Cause:** the worker answers a list read one page at a time (100 rows, in no
defined order), and the client took the first page as every row. The sync
code then re-created a row it already had, and the UNIQUE index refused it.
Where no index existed, the same read-then-create race simply made a second
row.
**Rule:** read "all my rows" through the user-scoped repository, which pages
until a short page. Give a table whose rows are keyed by something other than
`id` a UNIQUE index and a `naturalKey` in `TABLES`, so the create upserts.
Never rely on read-then-create to keep one row per key. A create means the
read found nothing (a lapsed anonymous token reads `[]`), so where the row
accumulates, give `upsertMerge` an idempotent rule (MAX, earliest date) for
every column that must not go back; a whole-body upsert reset a completed
challenge to a first attempt.
**See:** `SignedOutAwareRepository.findAll` in
`src/db/adapters/hybrid-adapter.ts`, `naturalKey` and `upsertMerge` in
`workers/db-worker/src/tables.ts`,
`workers/db-worker/migrations/0070_natural_keys.sql`

### Never transpose a weekly challenge to the singer's range

**Symptom:** looks like a bug — a Bass is handed a B4 they cannot reach, and
`voiceTypeSplit` sits there unused as if someone forgot to wire it.
**Cause:** assuming every pitched surface should adapt to the singer, because
almost every other one does.
**Rule:** `WeeklyChallenge.targetItems` is absolute MIDI and is sung at written
pitch. A weekly Legend is a shared feat — everyone attempts the identical
notes, which is the only thing that makes the board comparable and lets "I hit
the B4" mean something. A week being out of reach for some voices is the
accepted cost, and sometimes the point. Author inside G3-C5 for a week most
people can finish; go outside it deliberately.
**See:** `src/features/challenges/weekly-service.ts` (the `targetItems` doc
comment), `scripts/seed-weekly-rotation.mjs` (the TESSITURA note).

### Seeding a row into the session list changes every surface that lists sessions

**Symptom:** three Jam smoke specs failed with "resolved to 2 elements" for a
song nobody had touched, after a change to the Karaoke Night examples.
**Cause:** the Jam picker builds one shelf from the demo manifest and another
from `getAllUvrSessions()`. Those were disjoint only by accident — nothing
said the demo could not also be a session row. Seeding one put the same song
on both shelves. Eight surfaces read that store; the seeder knew about none
of them, and the unit suite tests each in isolation so it saw nothing.
**Rule:** before seeding anything into `uvr-store`, grep
`getAllUvrSessions|getAllUvrSessionsReactive` and check each consumer for a
second, independent route to the same content. A surface that lists sessions
_and_ a catalogue needs an explicit dedupe (`ownSongRows`), not an assumption
that the two sets are disjoint.
**See:** `src/lib/jam/jam-session-songs.ts` (`ownSongRows`),
`src/features/karaoke-night/seed-examples.ts`

### Bind a session that comes back in the address bar to the browser that asked for it

**Symptom:** a link such as `mercurypitch.com/#gauth=<token>&gauth_new=1`,
holding any session the sender could mint for their own account, signed
whoever opened it in to that account and adopted their unclaimed takes into
it. `#gauth_error=account_suspended` signed people out, and any other
`#gauth_error=` put the link's own words in the failure toast.
**Cause:** the Google redirect returns the session in the URL fragment, and
every page that took the return stored whatever fragment it found. The OAuth
state is signed but stateless, so nothing tied a return to the browser that
began the sign-in, and a fragment never reaches a server that could check.
**Rule:** start Google sign-in only through `googleSignInUrl` (it keeps a
nonce) and take a return only through `consumeGoogleRedirect` (it checks the
echoed nonce and spends it). Any new redirect that carries a credential needs
the same four steps: a nonce kept before leaving, signed into the state,
echoed back, checked once.
**See:** `src/lib/google-return-nonce.ts`, `OAuthState.nonce` in
`workers/db-worker/src/auth.ts`, `docs/specs/google-return-binding.ears.md`

### A page that offers Google sign-in must take the redirect and run the after-sign-up step

**Symptom:** a Google sign-up from Guitar Night or Drum Night left the
device's voiceprint takes behind, though the spec says creating an account
adopts them (REQ-VPR-014). From Drum Night the sign-in was lost outright:
the room came back signed out.
**Cause:** Google sign-in is a full-page redirect, and the worker sends it
back to the page that started it, with the session in the fragment. Each
standalone room is its own Vite entry, so the main app's
`consumeGoogleRedirect()` (`src/index.tsx`) and its after-sign-up effect
(`adoptAfterGoogleSignup` in `App.tsx`) never run there. Guitar Night took
the session but skipped the step; Drum Night's entry did neither. Mounting
the shared `AuthModal` brought the button along, and nothing else.
**Rule:** an entry whose page can start a Google sign-in takes the redirect
before it renders, then runs what the main app runs after one. For a
standalone room, `src/lib/room-google-return.ts` is that step,
loaded lazily so first paint stays light. Mark the room's `AuthModal`
`adoptsGoogleSignup` only once it adopts, because that prop is what lets the
redirect carry the welcome's voiceprint hint (REQ-VPR-022).
**See:** `src/features/drum-night/main.tsx`,
`src/features/guitar-night/main.tsx`, `docs/specs/voiceprints.ears.md`

### A standalone room that raises a toast must mount the toast region

**Symptom:** a failed Google sign-in in Drum Night said nothing, nor did the
sign-in dialog's "Signed in" or voice control's "Microphone access for voice
control was denied".
**Cause:** `showNotification` only writes to a store; `<Notifications />` is
what draws it. The main app, Guitar Night and Karaoke Night mount it. Drum
Night did not, so every toast raised inside it, by its own account chip or by
shared code such as AuthModal and voice control, went nowhere.
**Rule:** a standalone entry that can raise a toast (its own code, or a shared
component it mounts) mounts `<Notifications />`, lazily if first paint
matters. In its tests, reset the store between cases (`resetNotifications`),
or one test's toast turns up as a second alert in the next.
**See:** `src/features/drum-night/DrumNightApp.tsx`,
`src/features/drum-night/DrumNightApp.test.tsx`

### Persist renewal before issuing a token that depends on it

**Symptom:** a successful session refresh returned a token with weeks left, but
the expiry sweep deleted its session after a failed activity-timestamp write.
**Cause:** cleanup used `lastSeenAt`, while authentication deliberately swallowed
failures updating it. The new token could outlive the row keeping it valid.
**Rule:** keep ordinary activity tracking best effort, but require a durable,
ownership- and age-guarded update before minting a renewed token. Test failed
writes, retry, and sweeping beyond the old cutoff with both SQL and JWT clocks
advanced together; a request between renewal and sweeping can hide the bug.
**See:** `workers/db-worker/src/auth-sessions.ts` (`renewSession`) and
`workers/db-worker/node-tests/auth-sessions-integration.test.ts`.

### Test progress writes after an account switch, not only its pulls

**Symptom:** account-switch pull tests passed, but later offline practice overwrote the new account's cloud-only progress.
**Cause:** a retained owner stamp kept the merge off after the new account's row appeared, whether this device or another one wrote it; the pending queue then uploaded an older snapshot over it. Live signals could also retain the previous account while another tab changed credentials.
**Rule:** keep progress copies and pending writes with their owner, reconcile live state before evaluating a write, and test real practice calls after switches, failures and delayed responses. Read-only A → B → A tests do not establish write isolation.
**See:** `src/db/services/settings-service.test.ts`, `src/db/services/settings-shared-device.test.ts`, `src/lib/storage.test.ts`.

### Assign the Examples default only when creating a song

**Symptom:** moving an example song to another group, or leaving it ungrouped, was undone on reload.
**Cause:** both seed paths reapplied the Examples group to existing rows after boot repaired the group indexes.
**Rule:** track the rows each seed call actually creates and apply the default only to those. Preserve preexisting `groupId` and ungrouped states; `group.sessionIds` is a repairable index, not proof of the user's intent.
**See:** `src/features/karaoke-night/examples-library.ts`, `src/features/karaoke-night/seed-examples.ts`, and `src/stores/uvr-store-reload.test.ts`.

### Treat shared sessions as result summaries

**Symptom:** Community promised playable setlists, but session links led nowhere.
**Cause:** its picker shares completed runs, and `sharedSessions` stores scores rather than playable items.
**Rule:** display bounded result summaries without importing practice history. Retain the source run ID in `sessionId` for identity, and require `isPublic: true` when resolving a public link even for its signed-in owner.
**See:** `src/db/services/share-service.ts` and `src/features/community/SharedRunResult.tsx`.

### Read a JSON column as an object and as text

**Symptom:** `hasSubmittedSurvey` passed every test against the local-only store, and would have counted every plan row as the survey for a real singer.
**Cause:** the worker parses the columns in a table's `jsonCols` (`fromSql`), so the account returns `answersJson` as an object, while the local-only store returns the text it was given. Production reads the cloud table (`userSurveyResponses` is routed there in `src/db/adapters/hybrid-adapter.ts`), so the object is the form real singers meet. `UserSurveyResponse.answersJson` is still typed `string`, so the compiler says nothing.
**Rule:** a reader of a `jsonCols` column accepts both forms, and its test puts one row in as text and one as an object.
**See:** `src/db/services/survey-service.ts:70`, `workers/db-worker/src/tables.ts:117`.

### Hide when a row came from its rowid too, not only from its date column

**Symptom:** lesson answers were stored with only their UTC day, yet a real-SQLite test found each one between the app events sent just before and just after it, whose times are kept to the millisecond.
**Cause:** `mirrorEvents` is a rowid table. SQLite numbers each new row one past the largest rowid, so a row's place orders it among every other row, whatever its own columns hold.
**Rule:** a row that must not say when it came takes a random rowid outside the range the table's other rows count in (a lesson answer's is negative), or lives in a table of its own. Test it through the route against real SQLite, with timed rows on either side, and read `rowid`.
**See:** `workers/db-worker/src/index.ts` (`mirrorEventInsert`), `workers/db-worker/node-tests/funnel-retention-integration.test.ts`

### A session's stem URLs are not whether it has stems

**Symptom:** songs separated in the native Karaoke room played until the app restarted or was updated. Then the room listed only the examples, and importing one of the songs again said it was already in the singer's songs, with no way to open it (maff, 25 Oct 2026).
**Cause:** `UvrSession.outputs` holds object URLs minted by the page that saved the stems, and `sessionToDbRecord` keeps none, so every launch reads its sessions back without them while the stems stay on disk. The room listed a song of the singer's own only while `outputs` named both stems. Every test and probe ran inside the page that minted them. `takes.ts` had made the same mistake before.
**Rule:** decide that a session has audio from what lasts (its status, `stemMeta`, the stems on disk), and mint the URLs when the song is opened (`ensureSessionHydrated`). Test a list across two launches that share one database, and take a probe through `page.reload()`.
**See:** `src/features/karaoke-room/karaoke-room-library.ts`, `src/features/karaoke-room/karaoke-room-library.restart.test.ts`, `apps/mercurypitch/scripts/probe-karaoke-import.mjs`

## Tooling and environment

### Ignore new generated entry documents

**Symptom:** formatting a new HTML entry repeatedly passed locally but failed after a build.
**Cause:** Vite rewrites every document in `ENTRY_PAGES` using the SEO renderer; the new document was accidentally tracked instead of ignored like its peers.
**Rule:** review the entry model and add its generated root HTML path to `.gitignore`; do not commit or hand-format the generated document.
**See:** `tools/generate-entry-pages.ts`, `src/seo/entry-pages.ts`.

### `rg -r` means `--replace`, not recursive

**Symptom:** search output came back garbled and partially rewritten.
**Rule:** never pass `-r` to ripgrep. It is recursive by default.

### The full tour walk is a release gate, not a per-change gate

**Symptom:** 20+ minutes burned running `pnpm test:tours` on an unrelated PR.
**Rule:** per change, verify the affected `targetSelector`s resolve. The full
two-viewport walk runs only in `/prod-upd`.

### Headless preview lies in specific ways

- The welcome overlay covers the page — set `pitchperfect_welcome_version` (and
  the survey key) in `localStorage`, then reload.
- A synthetic Playwright clock plus SwiftShader can stall screenshots even
  early in a test. Finish the settled real frame, suspend further raster work
  during bounded compositor capture, then pause the clock and restore drawing.
  Keep normal startup rendering: HDR/PMREM and reflection probes bake before
  readiness, so suppressing those draws produces black reflections. Inspect
  the captured images as well as retaining pixel assertions. See
  `apps/beside-cue/e2e/glass-adventure-authoring.e2e.ts`.
- The dev server is HTTPS-only; `VITE_NO_SSL=1` plus the `app-http` launch
  config gets plain HTTP. Revert before committing.
- `backdrop-filter: none` in headless output is an artifact, not a regression.
- The piano falling-notes game is audio-gated and will not start headless.

### Grep before reading a large file

**Symptom:** a single file read consumed most of the context window.
**Cause:** 25 files exceed 1.2k LOC; `StemMixer.tsx` alone is ~46k tokens.
**Rule:** check the hazard list in [INDEX.md](INDEX.md), grep for the symbol,
read the surrounding range.

### Build-time env vars go on the wrangler step, not on "Build app"

**Symptom:** `VITE_JAM_MOCK_SIGNALING=1` was set on CI's "Build app" step and
the deployed preview behaved as if it had never been set.
**Cause:** CI builds **twice**, on purpose. `wrangler.jsonc` declares
`build.command`, so `wrangler deploy` / `versions upload` runs its own build and
ships THAT bundle; the earlier "Build app" step is a gate that fails the run
before anything reaches Cloudflare, and its output is discarded. Keeping both is
a decision: without the gate, a broken build would surface only as a failed
deploy. Revisit if deploy-time feedback ever gets good enough to stand alone.
**Rule:** anything that must reach the shipped bundle is exported immediately
before the wrangler command. Do not "de-duplicate" the two builds without
moving those vars first.
**See:** `wrangler.jsonc:21` (top level), `:124` dev, `:134` preview;
`.github/workflows/build.yml:90` gate, `:148` preview upload.

### Force Vitest's environment before resolving Solid

**Symptom:** dozens of Solid interaction tests failed locally with detached-root
warnings while the same commit passed on CI.
**Cause:** the host exported `NODE_ENV=production`; Vitest only defaults it to
`test` when unset, so Vite omitted Solid's browser test condition.
**Rule:** set `NODE_ENV=test` in `vitest.config.ts` before defining the config;
do not trust the caller's shell environment.
**See:** `vitest.config.ts`

### Await a lazy control after every remount

**Symptom:** upgrading Solid made room tests miss lazy controls or count a loading status alongside the final status.
**Cause:** Solid 1.9.17 clears its lazy component resource on owner cleanup. A later mount can suspend again even when an earlier test or interaction loaded the module.
**Rule:** await the actual lazy control before interacting with it or asserting settled content. Do not depend on another test having warmed the module, add arbitrary delays, or remove the original behavior assertions.
**See:** `src/features/drum-night/DrumNightApp.test.tsx`, `src/features/guitar-night/GuitarNightStage.test.tsx`, and `src/features/sing-room/SingRoomStage.exercises.test.tsx`.

### Give preview credentials their own Worker identity

**Symptom:** Turnstile showed a green check on dev, but every login failed CAPTCHA after a PR preview and the next dev deploy.
**Cause:** `versions upload --secrets-file` put the public test secret on the dev Worker. Wrangler preserves omitted secrets from that Worker's newest version, so the next normal dev deploy inherited and activated it even though the preview version was never deployed.
**Rule:** an immutable version is not a secret-isolation boundary. Preview credentials use a dedicated Worker name and complete preview-only bindings; validate the name before upload and canary dev after deployment.
**See:** `scripts/assert-pr-preview-isolation.mjs`, `.github/workflows/build.yml`, `.github/workflows/deploy-db.yml`

### A helper extracted "for testability" has to actually be called

**Symptom:** `buildFinalPartialTimes` sat in `lrc-gen-engine.ts` with five
tests covering the whole finish pipeline. Every one passed. Nothing in `src/`
called it — `handleLrcGenFinish` had inlined the same four steps by hand, and
the tests were vouching for a pipeline that never ran in the product.
**Cause:** the extraction landed as a copy rather than a move. Nothing catches
this: the export is used (by tests), so no lint fires, and coverage counts the
tested copy.
**Rule:** after extracting a pure function, grep for its name outside
`src/tests/`. If the only callers are tests, the extraction is not finished.
Prefer moving the body and calling it from the original site in the same
commit, so there is never a moment when two copies exist.
**See:** `src/features/stem-mixer/lrc-gen-engine.ts` (`composeGenResult` now
calls it)

### `on(() => thing()?.field)` fires for every new object, not every new value

**Symptom:** the song name in the jam header snapped shut under the finger
that had just opened it; and, in the same change, the timeline forgot the
audio file's real length for good.
**Cause:** `on(source, fn)` re-runs whenever `source`'s dependencies change,
and compares nothing. `jamSong()` is replaced every time the pitch guide lands
or the words are edited, with the same `id` and the same stem under it, so
"when the song changes" fired for each of those too. The second case is the
worse one: an `<audio>` whose `src` has not changed never fires
`durationchange` again, so a reset keyed this way is never undone.
**Rule:** key "when X changes" on a `createMemo` of the value you mean. A memo
only notifies when its result differs; a bare accessor notifies when anything
it read did.
**See:** `JamNowSinging.tsx` (`songId`), `JamSongStage.tsx`
(`instrumentalSrc`), `src/tests/jam-now-singing.test.tsx`,
`src/e2e/jam-room-rows.spec.ts` ("draws the timeline to the length of the
FILE, and keeps it").

### A wrapping flex row breaks on what an item asks for, before it shrinks anything

**Symptom:** adding one chip to the jam header made it a row taller at 1180px
and 1280px (38px to 60px), although the chip had `flex: 0 1 auto` and
`min-width: 0` and was "allowed to shrink".
**Cause:** with `flex-wrap: wrap`, lines are broken using each item's
hypothetical size -- its max-content, capped by `max-width` -- and shrinking
only happens within a line afterwards. An item that asks for its whole content
is never shrunk to stay on the line; it is moved to the next one. The second
half of the trap: once the strip could shrink, the squeeze was shared with its
SIBLING, and the room's name broke over two lines.
**Rule:** for "as much as fits" inside a wrapping row, ask for little and grow:
`flex: 1 1 <a few words>; max-width: max-content; min-width: min(<the same>,
100%)`. Give the sibling that must not give `flex-shrink: 0`. And when a wrap
point must not move while the content changes (a row that would jump
mid-song), make the basis a LENGTH, never `auto`.
**See:** `JamNowSinging.module.css`, `Jam.module.css` (`.roomInfo > .title`),
`JamPanel.module.css` (`.songTimeline`), `src/e2e/jam-room-rows.spec.ts`.

### Audio served by `route.fulfill` cannot be seeked

**Symptom:** a browser spec clicked a lyric line, saw "Line 13 / 24", pressed
Play, and the song played from the top. `audio.seekable` was empty.
**Cause:** a plain `route.fulfill({ body })` answers 200 with the whole file
and no `Accept-Ranges`, and Chromium treats that element as not seekable --
every `currentTime = x` lands on zero. The store had the new position, which
is why the label was right until the first tick of the clock overwrote it.
Specs that never play from the middle do not notice.
**Rule:** a spec that seeks must answer the `Range` header with a 206 and a
`Content-Range`, and wait for `seekable` to reach the end before it seeks.
**See:** `serveSeekableTone` in `src/e2e/jam-lyrics-follow.spec.ts`.

### `:hover` stays on the last thing a finger tapped

A tablet has no pointer to move away, so a button keeps its `:hover` look
after a tap until something else is tapped. If the hover look resembles the
ON look (an accent border, say), a toggle that was just switched OFF goes on
looking switched on -- a visual review of the jam room's More button read the
folded state as open for exactly this reason. Put hover rules behind
`@media (hover: hover)`, and never let hover and ON share a look.

### `isMobile()` means "touch", and a tablet is touch

`isMobile()` is `(max-width: 768px), (pointer: coarse)`: true of a phone, and
of a 1180px tablet. Twice in 0.9.11 a caller meant "phone" by it. The jam
sidebar's song list was left unmounted for good on a tablet, and the camera
tray started hidden there while the switch that shows it is drawn only under
640px -- hidden by a script rule, with the way back hidden by a stylesheet
rule. When a script decides something a stylesheet also decides, read the
stylesheet's OWN width (`isNarrow()`, or the literal media query, with a test
that holds the two to the same number). Keep `isMobile()` for what it says:
interaction defaults on a touch screen.

### A wrapping row cannot be asked to shrink first

**Symptom:** a chip in the jam room's header sent the strip to a second line
although it was willing to drop its words. **Cause:** a `flex-wrap: wrap`
container breaks its lines on what each item ASKS for (its flex-basis), and
only then shrinks the items of each line -- so an item that would give way is
never asked. No mix of `flex-shrink`, `min-width: 0` and `overflow` changes
that. **Fix:** lay the long form out and look (`src/lib/jam/row-fit.ts`): take
the compact flag off, read the row, put it back in the same task if the row
is no longer one line. Nothing paints in between, and it cannot flap, because
the answer depends on the layout and not on the state before it. Watch an
ancestor too: a content-sized row does not resize when the window grows.

### A drag binding must not trust its own "a pointer is down"

**Symptom:** a surface that can be tapped but never dragged again, until it is
rebuilt. **Cause:** the binding refuses a press while it holds an active
pointer id, and clears that id only on `pointerup`, `pointercancel` or
`lostpointercapture`. Browsers do not always send the cancel they owe (a
system gesture taking the touch, a dialog opening under the finger), and the
id stayed set for good. **Fix:** "a drag is live" means the element still
holds that pointer's capture. A press that finds it gone ends the old drag on
its behalf and carries on (`src/components/shared/drag-gesture.ts`).

### An explicit `min-height` removes a flex item's min-content floor

**Symptom:** in the mapper's marker mode with the font zoomed up, a lyric line
long enough to wrap onto two rows was drawn over the lines above and below it,
so the timestamps of the neighbouring rows showed through the text.
**Cause:** `.sm-lyrics-gen-lines` is a column flex container, so its rows
default to `flex-shrink: 1`. Normally `min-height: auto` stops a flex item
shrinking past its content — but `.sm-lyrics-gen-line-marker-mode` sets
`min-height: 4rem`, and a specified `min-height` **replaces** that automatic
minimum. The row was then free to be squashed to 4rem while its content needed
more, and the overflow painted over its neighbours.
**Rule:** rows in a scrolling flex column get `flex-shrink: 0`. And treat any
`min-height` on a flex item as also opting out of the min-content floor —
if you set one, set `flex-shrink: 0` too, or the value becomes a maximum in
disguise.
**See:** `src/components/StemMixer.tsx` (`.sm-lyrics-gen-line`)

### A canvas ref is never handed back — Solid does not call it with `null`

**Symptom:** the full-screen mapper registers its own waveform strip with the
canvas controller. Opening and closing the stage repeatedly left the
controller drawing into detached canvases, with the wheel and touch listeners
still attached to each one.
**Cause:** Solid does not invoke a `ref` callback with `null` on teardown, so
a controller whose `setCanvasRef(id)` has a null branch never sees it fire.
**Rule:** when a ref registers something with a longer-lived owner, release it
from an `onCleanup` inside the ref callback. The same fact is why the stage
registers under its own `mapperOverview` id instead of reusing `overview` —
the workspace canvas underneath the overlay is still mounted and still owns
that entry.
**See:** `src/components/lrc-mapper/LrcMapperStage.tsx` (`registerWaveform`)

### Imperative canvas drawing goes stale the moment playback stops

**Symptom:** toggling word ticks, or nudging every timing with the ±100 ms
buttons, changed nothing on the waveform until the user pressed play.
**Cause:** `redrawAll` reads the display accessors but is called from a frame
loop, so while audio runs every change lands on the next frame for free.
Paused, nothing calls it, and no handler queued a redraw itself.
**Rule:** a canvas controller needs one `createEffect` that touches the
display state and queues a redraw — not a `queueCanvasRedraw()` sprinkled
through each handler, which is the same bug waiting for the next toggle. Keep
per-frame data (elapsed, pitch history) out of it: that would queue a redraw
from inside a redraw.
**See:** `src/features/stem-mixer/useStemMixerCanvasController.ts`,
`src/tests/stem-mixer-canvas-redraw.test.ts`

### "First and last" is not the same test as "the edges"

**Symptom:** in the letter editor, right-click and long-press could not clear
a boundary. Both gestures fired; the split stayed.
**Cause:** `removeSplitPoint` protected the word's onset and end by refusing
`at === 0 || at === points.length - 1`. That holds only for a curve that
already carries both edges. A curve authored purely by clicking inside the
word carries neither — so the only split in it was simultaneously index 0 and
index length-1, and the guard refused every clear.
**Rule:** when a position in an array carries meaning (an edge, a sentinel,
an anchor), test the meaning, not the index. Here that is `progress <= 0 ||
progress >= 1`. And when writing the tests, build at least one fixture the
lazy way the product does — every existing case handed in a tidy three-point
curve, which is exactly why this shipped.
**See:** `src/lib/lyric-sweep.ts`, `src/tests/word-letters.test.ts`

### A control that refuses silently looks broken, not inapplicable

**Symptom:** three reports of the same shape in one session — the syllable
suggestion "doesn't seem to do anything on most words", and "Redo line, not
sure what that does, it doesn't seem to do anything".
**Cause:** both returned early on a condition the user could not see. The
suggestion demanded an explicit word end, which the word pass never writes,
so it refused on nearly every word. Redo acts on the line BEHIND the cursor
whenever the cursor sits at word 0, so it edited a row above where the user
was looking.
**Rule:** an early return in a handler needs a matching signal in the UI.
Disable the control and say why in its title when the refusal is a state
(`disabled` + "One syllable — nothing to split"), or name the target when the
action is not where the user is looking ("Clear and replay line 2: ..."). If
neither fits, the early return is probably too strict — check what the
surrounding data actually contains before requiring a field.
**See:** `src/components/lrc-mapper/LrcWordLetters.tsx`,
`src/components/lrc-mapper/LrcMapperToolbar.tsx`,
`src/tests/lrc-gen-redo-line.test.ts`

### A bubbling click on the container makes the whole thing a dismiss target

**Symptom:** the letter editor closed whenever anything inside it was clicked
except the hairline boundaries themselves.
**Cause:** click-to-collapse lived on the word `<span>`, and every glyph
inside the expanded word bubbles to it. The affordance was fine when the word
was one span; opening it into twenty children turned the row into a dismiss
zone with a few safe pixels in it.
**Rule:** when a container gains interactive children, its own click handler
becomes a hazard. Move dismissal to an explicit control, or scope the handler
to `e.target === e.currentTarget`.
**See:** `src/components/lrc-mapper/LrcMapperLineList.tsx`

### `beforeinstallprompt` needs headed, real Chrome, in a persistent profile

**Symptom:** the PWA install button never appeared in any Playwright run, in
either headless Chromium or headed real Chrome, so the install path looked
broken.
**Cause:** three separate gates. Headless Chrome does not run the installability
pipeline at all, and `browser.newContext()` is an incognito-style profile where
Chrome never offers install — only `chromium.launchPersistentContext(dir, {
headless: false, channel: 'chrome' })` fires the event.
**Rule:** do not conclude "the install prompt does not fire" from a normal
Playwright run. The e2e suite can assert the manifest and
`serviceWorker.controller`; the prompt itself has to be checked out-of-band with
a persistent, headed, real-Chrome profile.
**See:** `src/e2e/pwa.spec.ts`, `src/lib/pwa-install.ts`

### Regenerate the agent index last, after formatting and after a rebase

**Symptom:** `pnpm pr:prepare` reports a clean run, and PR Gate then fails on
"docs/agent/INDEX.md is stale" before it has installed a single dependency.

**Cause:** two ways in, both of which make the file stale _after_ it was
checked. `pr:prepare` regenerates the index and only _then_ runs Prettier, so
reformatting any file it just indexed changes that file's line count — and the
index records line counts. Separately, the index covers the whole tree, so a
rebase that pulls in someone else's new module invalidates it even though your
own diff never touched it.

**Rule:** run `node scripts/gen-agent-index.mjs` as the last step before
committing — after `pr:prepare`, and again after any rebase. It is a fast
local command and cheaper than a CI round trip. This bites hardest on a PR that
adds modules, which is exactly when the index matters.

**See:** `scripts/pr-prepare.mjs`, `scripts/gen-agent-index.mjs`

### A legend portrait in a small box turns to mush at zoom

**Symptom:** faces look fine at 100% and go smeared at 125%/200%, or on one
phone and not another. Nothing in the code looks wrong, because nothing is —
the browser silently abandoned its high-quality downscale path.

**Cause:** the scale ratio, not the image. Masters are 928x1152. Past roughly
4x in either direction the browser stops resampling well, so a 30x37 chip
pointed at the master (31x) smears, and so does a 120px thumb stretched into a
180px box. `image-rendering` does not fix this; only shipping the right pixels
does.

**Rule:** never point a box at `legendArt(name).imageSrc` without checking the
ratio. Use `legendTierSrc(name, tier)` — `thumb` 120px for ~30-120px boxes,
`mid` 360px for ~130-360px, `full` 928px for the reveal card. When the box is
fluid (`vw`/`vh` units, so its size depends on the viewport, DPR and zoom),
do not pick a tier by hand at all: give the `<img>` a `srcset` with `w`
descriptors and a `sizes` that mirrors the CSS width, and let the browser
choose from real device pixels. That is the only form that stays correct
across zoom, DPR and orientation together.

**The trap inside the fix:** `sizes` is a copy of a width that lives in CSS,
and nothing links them. Change the CSS and `sizes` still describes the old
box, so the browser picks against a width that no longer exists and you are
back to mush — with a `srcset` in place that makes it look handled. Guard the
pair with a test. `src/tests/legend-thumbs.test.ts` does this for
`.mirror-peek-card`, and asserts tier DIMENSIONS rather than mere presence,
because a present-but-wrong-size file is the exact shape of the original bug.

**See:** `src/features/mirror/LegendCaricature.tsx` (`legendTierSrc`),
`src/tests/legend-thumbs.test.ts`, `scripts/gen-legend-tiers.mjs`

### `max-height` on an `aspect-ratio` box crops the subject instead of shrinking it

**Symptom:** a portrait that looks right on a tall phone is cropped through
the face in landscape, or on a short laptop window.

**Cause:** `max-height` wins against `aspect-ratio`. The box keeps its width,
loses its height, and `object-fit: cover` eats the difference out of the
image — worst exactly where the viewport is shortest.

**Rule:** to bound such a box by height, spend the height budget as a **width**
cap (`width: min(400px, 82vw, 35vh)` for a 4:5 box wanting ≤ 44vh) and let
`aspect-ratio` derive the height. The card then shrinks whole and the crop
stays at zero.

**See:** `.mirror-peek-card` in `src/features/mirror/mirror.css`

### Open mobile More before selecting an overflow tab

**Symptom:** `pnpm audit:mobile` could not find Exercises even though the tab
was visible in the app's mobile navigation.
**Cause:** overflow destinations are not mounted until More is opened and do
not necessarily keep their desktop tab id.
**Rule:** mobile automation opens More when the stable tab id is absent, then
selects the destination by its exact accessible name.
**See:** `scripts/audit-exercises-mobile.mjs`

### Set dial touch ownership before contact, not after detecting a drag

**Symptom:** the reminder record turns sideways but its circular arcs scroll the iPhone page.
**Cause:** `pan-y` allows native vertical panning; pointer capture and a later `preventDefault` cannot reclaim it.
**Rule:** publish visibility/scroll readiness before contact, use `pinch-zoom` on the ready disc, and require both published and fresh readiness when admitting a turn. Never promote a page-owned contact mid-stream.
**See:** `apps/beside-cue/src/components/punched-time-dial-readiness.ts`, `apps/beside-cue/e2e/punched-time-dial.e2e.ts` (trusted touch at both side tangents, partial visibility, gutter scrolling and quiet-window contact).

### Isolate dependency scanning in offline Vite audio harnesses

**Symptom:** a tiny audio harness scanned every app HTML entry and flooded errors; its intercepted baseline module could not import.
**Cause:** Vite scans HTML entries by default and resolves literal imports before browser route interception.
**Rule:** use `optimizeDeps.entries: []` with explicit dependencies; load route-only modules through a variable with `@vite-ignore`.
**See:** `scripts/build-guitar-audition-pack.mjs`, `scripts/guitar-audition-browser.mjs`

### Seeded synthesis is not a cross-run bit-exact listening fixture

**Symptom:** an unchanged seeded score produced a different PCM hash, with maximum sample error only 2.98e-8, breaking a historical amp comparison before the amp ran.
**Cause:** seeding note excitation did not establish cross-run floating-point PCM identity; the precise engine-level source of the tiny difference was not established.
**Rule:** freeze and hash-verify the original pre-amp PCM for head-only comparisons. Re-parse score metadata and bound regenerated-source error separately so frozen audio cannot hide a changed or silent synth. Keep exact output-hash assertions for unchanged heads.
**See:** `scripts/guitar-audition-browser.mjs`, `scripts/build-guitar-audition-pack.mjs`

### Keep full-page screenshots out of bounded real-time capture assertions

**Symptom:** the CI live-history timer froze at three seconds, although the test passed locally.
**Cause:** the trace showed safe backpressure finalization during expensive page screenshots; a 1.92-second screenshot exceeded the 65,536-sample PCM budget at normal audio rates.
**Rule:** inspect the capture stop reason, not only its timer. Observe first-note geometry at the actual canvas draw rather than a later automation read; encode images only after Stop. Test desktop/phone capture at separate fixed viewports, retaining active-duration assertions and production buffer limits.
**See:** `src/e2e/guitar-recording-history.spec.ts`, PR Gate run `34252164591`.

### Rebuild the tested bundle after changing source or rebasing

**Symptom:** a recorder capture test passed, but a newer voice command was missing.
**Cause:** the correct worktree's `dist` still predated its newer commits; Playwright only serves it.
**Rule:** run `pnpm build:e2e` before production-browser checks after source changes or rebase. A matching worktree port proves location, not bundle freshness; do not count stale-build results as current-head verification.
**See:** `playwright.config.ts`, `docs/agent/TESTING.md`

### Count browser requests outside the resource-timing history

**Symptom:** Merc's warm-up test reported zero downloads even after the model loaded.
**Cause:** Vite's earlier requests filled Chromium's 250-entry resource-timing buffer.
**Rule:** observe Playwright requests and successful completions before navigation;
keep the test's timing buffer small so a history-based counter cannot return unnoticed.
**See:** `apps/beside-cue/e2e/glass3d-warm.e2e.ts`.

### Ignore host libvips when hydrating the pinned Sharp binary

**Symptom:** frozen pnpm install fails in Sharp's postinstall asking for `node-gyp`.
**Cause:** a globally installed libvips makes Sharp attempt a source build instead of its prebuilt binary.
**Rule:** retry with `SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm install --frozen-lockfile`; do not change the lockfile or add build dependencies for the host's optional library.
**See:** `pnpm-lock.yaml` (Sharp install dependencies).

### Judge glass in its production render path

**Symptom:** transparent GLBs appeared white on a review canvas; later, clear isolated crystal branches nearly vanished inside the actual scroll.
**Cause:** CSS backgrounds are absent from Three's transmission pass. Separately, a dark full-resolution preview concealed the game's subpixel branches and pale-on-cloud contrast at half-resolution transmission.
**Rule:** provide a real scene backdrop and match production exposure, transmission resolution, camera scale and surrounding art. Confirm actual-game contribution with effect-on/off captures before accepting appearance; do not raise global rendering cost to rescue tiny detail.
**See:** `art/glass-adventure/v3/model-viewer.js`, `packages/glass-game/src/render/crystal-interior-geometry.ts`, `art/glass-adventure/crystal-interiors/v1/`.

### Validate fractured meshes again after GLB export

**Symptom:** a closed Blender shard gained a boundary after GLB export, despite passing edge and intersection checks.
**Cause:** simplification left isolated pairs of opposite triangles on the same three vertices. Blender's exporter removed one degenerate face, opening the zero-volume component.
**Rule:** reject invalid mesh data and remove only verified collapsed components before fracture; then independently reimport the delivered GLB and check every named piece, materials and reconstructed volume.
**See:** `art/glass-adventure/v3/solid_fracture.py`, `art/glass-adventure/v3/validate_final_shell.py`.

### Check inset depth against all donor faces before blaming mirror normals

**Symptom:** a diagonal survived flat mirror normals and also crossed the replacement painting.
**Cause:** an overlapping generated-model cap remained in the ornament material, ahead of the flattened inset; inspecting only shared seam edges missed it.
**Rule:** verify projected face overlap and front-to-back depth in the exported GLB, then confirm the actual in-game painting and mirror. Isolate the inset and give it measured clearance without deforming the rim.
**See:** `art/glass-adventure/v5/finalize_frame.py` and `v5/exports/runtime-reimport.json`.

### Distinguish fixture calls from test registrations in metric reports

**Symptom:** new voice regressions were reported as having no assertions despite checking real completion and capture lifecycle.
**Cause:** the test-shape regex also splits on fixture calls such as `test.emit(...)` and `test.wait(...)`, fragmenting a real assertion-bearing test.
**Rule:** inspect the flagged blocks before adding assertions or changing a baseline. Name local harnesses `fixture` to distinguish them from the test API; preserve the behavioral assertions. Do not add token checks to satisfy a textual collector.
If local and CI counts differ, compare the exact tested merge revision with the feature head: newly landed main tests are included by CI even before a local rebase. An absence query can assert its null result explicitly instead of being mislabeled by the collector as a presence-only document-membership assertion.
**See:** `scripts/code-metrics.mjs:testShapeMetrics`, `packages/glass-game/src/ui/voice-challenge.test.ts`.

### Isolate every renderable mesh in Blender comparison proofs

**Symptom:** both the original crystal and its replacement showed polygonal holes, while intact glass looked rough and opaque.
**Cause:** hiding fracture parent empties left their assembled mesh children visible through source and intact comparison renders.
**Rule:** apply an explicit renderable-mesh allowlist for each view and save that inventory with the proof. Do not infer child visibility from a hidden parent or change materials until the isolated source comparison is clean.
**See:** `art/glass-adventure/cloudway-laboratory/v1/production/rose_crackle_runtime_visuals.py`.

### Isolate the stable playtest server's dependency cache

**Symptom:** a previously working no-HMR preview becomes blank after browser tests; Solid warns about duplicate runtimes and a mount effect observes an undefined DOM ref.
**Cause:** the HTTPS preview and HTTP Playwright games server shared Vite's optimizer directory despite different configuration hashes. One server replaced dependencies still referenced by the other.
**Rule:** give the stable preview a dedicated cache per port. Verify it remains usable while the browser test servers start and stop; do not hide the symptom with a missing-element guard.
**See:** `apps/beside-cue/scripts/glass-playtest.ts`.

### A folded branch still runs the modules its imports name

**Symptom:** the native store build carried the floating developer console's storage key, though everything that shows the console sits behind a build constant that build folds to false. Karaoke Stage 2's import queue had reached the store build the same way.
**Cause:** folding a branch drops the code inside it, not the modules the file imports for it. Rollup keeps such a module, and runs it, unless it can prove the module free of side effects, and a module-level persisted signal reads storage as it is made.
**Rule:** import a build-only module dynamically inside its constant's branch, or declare it free of side effects in the native Vite config (`KARAOKE_STAGE_2`, `FLOATING_CONSOLE`). Then hold the built output to it with an assert, not the source.
**See:** `apps/mercurypitch/vite.config.ts`, `apps/mercurypitch/scripts/assert-bundle.mjs`, `scripts/assert-no-portable-console.mjs --store-binary`.

### Wait for delivered touch input before measuring movement

**Symptom:** a real-touch joystick test intermittently travelled too little during its fixed 140 ms simulation window.
**Cause:** CDP acknowledged touch movement before the coalesced pointer event updated the control, so the measurement sometimes started before movement input arrived.
**Rule:** await the published knob position before advancing the unchanged clock window. Do not loosen the displacement assertion or add a blind delay to hide delivery latency.
**See:** `apps/beside-cue/e2e/helpers/glass-adventure-controls.ts`.

### Isolate concurrent browser proofs from source reloads and output cleanup

**Symptom:** a singing proof timed out during unrelated edits, and its trace disappeared while another browser suite ran.
**Cause:** shared Vite HMR replaced modules mid-attempt; parallel Playwright invocations cleaned the same output directory.
**Rule:** freeze runtime edits during evidence capture or use a private server with HMR and watching disabled. Give each concurrent invocation a distinct output directory, and preserve final rendered proof separately from fast geometry runs.
**See:** `apps/beside-cue/playwright.config.ts`, `apps/beside-cue/e2e/glass-adventure-voice.e2e.ts`.

### Count module loads with a per-test `vi.doMock`, never a hoisted `vi.mock`

**Symptom:** a test asserting that an ordinary visit "loads no auth" still
passed after the code was changed to import the auth layer on every visit.
**Cause:** `vi.resetModules()` clears the module registry, not the mock
registry. A hoisted `vi.mock` factory runs once per file and its result is
reused after every reset, so a load counter inside it counts the first test's
import and nothing after.
**Rule:** to prove a module did or did not load, register the counting
factory with `vi.doMock` in `beforeEach`, after `vi.resetModules()`, and
re-import the code under test dynamically. Then break the code on purpose
and watch the test fail before trusting it.
**See:** `src/lib/room-google-return.test.ts`,
`src/features/drum-night/main.test.tsx`

### Format a stylesheet with Prettier before Vite sees it

**Symptom:** a stylesheet brought in from outside the repo (dense, several
declarations to a line, `@keyframes x { to { … } }` on one line) answered 500
in dev with `[lightningcss] Unknown at rule: @keyframes`, pointing at a line
with no `@keyframes` on it.
**Cause:** `tools/css-legacy-fallbacks.ts` runs first (`enforce: 'pre'`) and
works line by line: before a line with a `color-mix()` declaration it inserts
a fallback line made of that line's text up to the declaration. In the repo's
Prettier layout that text is indentation; on a dense line it is the selector
and its opening brace, so every fallback opens a rule that never closes, and
Lightning CSS reports the damage at a position in the rewritten text.
**Rule:** run `pnpm exec prettier --write` on any stylesheet that did not start
life in this repo before loading it, and read a Lightning CSS position after
that plugin as approximate.
**See:** `tools/css-legacy-fallbacks.ts`, `src/features/lessons/kit/lesson-sections.css`

### Decode what HTMLRewriter reads, and escape what it writes

**Symptom:** the site worker's hook rewrite looked finished and nearly
shipped two ways wrong. Lesson 5's `og:description` holds `&#8220;support&#8221;`,
so the comparison with the hook's text never matched and the description
would never have been retold. A picked hook with a literal `&amp;` in it would
have gone in raw, and a crawler would have read it as `&`.
**Cause:** in workerd, `getAttribute` returns the attribute exactly as the
markup spells it, entities and all, and `setAttribute` escapes only `"`: `&`,
`<` and `>` go in raw. A `<script>`'s text reaches `text()` in several chunks,
the last one empty, so a handler that edits one chunk sees part of the JSON.
**Rule:** decode an attribute before comparing it, escape `&`, `"`, `<` and
`>` yourself before `setAttribute`, and buffer a script's chunks until
`lastInTextNode`. A jsdom test double hides all three, so make the double
behave the same way and check its claims under `wrangler dev`.
**See:** `src/lesson-gate.ts` (`decodeHtml`, `escapeAttribute`,
`retellScripts`), `src/html-rewriter.test-fixtures.ts`

### A Request you build in a Worker follows redirects

**Symptom:** on the site worker's PR preview, `/learn/01.html` and
`/learn/01/` answered with the page and a 200, where the dev site answers a
307 to `/learn/01`. The unit test that expected the 307 passed, and a local
`wrangler dev` showed the same 200, which read as a local quirk.
**Cause:** the worker asked the asset layer with
`new Request(url, { method, headers })`. A built Request's `redirect`
defaults to `'follow'`, so the runtime followed the asset layer's 307 and
handed back the page. The incoming request takes its redirects by hand
(`'manual'`), so passing it on as it came would have kept the 307. The test's
stand-in answered the 307 whatever the request's mode.
**Rule:** give a Request you build for `ASSETS.fetch` or a service binding
`redirect: 'manual'` whenever its answer goes back to the browser, and make a
test's stand-in follow redirects for any other mode, as the runtime does.
**See:** `src/lesson-gate.ts` (`unconditional`), `src/lesson-gate.test.ts`
(`assetLayer`)

### Inspect failed jobs even while a workflow reports queued

**Symptom:** main appeared only queued, but a browser job had already failed.
**Cause:** workflow-level status remained queued while other jobs ran; filtering only completed workflows hid a completed job's package-feed error.
**Rule:** inspect job and step conclusions for the exact commit before classifying a main failure. Distinguish browser setup from tests, and obtain completed-job logs directly through the job API when workflow logs are not yet available.
**See:** `.github/workflows/pr-gate.yml` and `scripts/install-ci-browser.mjs`.

### Remove a failing mirror route, not its test coverage

**Symptom:** browser setup exhausted a CI job despite successfully fetching an HTTPS Ubuntu release index.
**Cause:** the runner's per-file mirror fallback retried Azure HTTP for later package indexes; excluding unrelated feeds did not remove that route.
**Rule:** filter only the failing route from a temporary, sandbox-readable mirror list, retain the official HTTPS fallbacks and package authentication, and bound the root dependency process group. A partial index update must fail; do not enlarge test budgets or retry the whole installer. Keep sandbox-read mirror files under the system `/tmp`, not a private `RUNNER_TEMP` or `TMPDIR`; child permissions alone cannot grant access through a private ancestor. Verify reads as `_apt`, without changing ancestor permissions or disabling the sandbox.
**See:** `scripts/install-ci-browser.mjs` and `scripts/install-ci-browser.test.mjs`.

### Cross resize rendering before polling painted frame geometry

**Symptom:** the icon-alignment geometry poll expired while its browser evaluation was still pending; the late result contained no geometry problems.
**Cause:** `setViewportSize` can return before ResizeObserver delivery. A focused browser probe measured before resize work began; the runner also renders synchronously inside its resize observer.
**Rule:** cross the observer/render lifecycle with two animation frames before starting the geometry poll. Preserve its assertions and deadlines; this synchronization does not diagnose or benchmark the underlying rendering cost.
**See:** `apps/beside-cue/e2e/glass-adventure-icon-alignment.e2e.ts`.

### Name a test helper that imports production code `*.fixture.ts`

**Symptom:** `sync-for-account.test.ts` ("is the only place in the app that asks for plan-sync") failed with a second asker, `src/features/plan/plan-sync.harness.ts`, a helper the sync's two test files shared. No production code had changed.
**Cause:** source-scan guards walk `src` and skip only `.test`, `.spec` and `.fixture` files, so a helper under any other name is production code to them. This one loaded `./plan-sync` with `import()`, the pattern that guard looks for.
**Rule:** a test helper that imports a production module, or loads one with `import()`, is named `*.fixture.ts` (`plan-sync.harness.fixture.ts`), never `.harness.ts` or `.helpers.ts`, so a guard that scans sources can rely on the skip.
**See:** `src/features/plan/sync-for-account.test.ts:138`, `src/features/plan/plan-sync.harness.fixture.ts`

### Keep borrowed dependency directories read-only

**Symptom:** preparation in a lightweight worktree invoked an automatic install and attempted to replace a shared `node_modules` link.
**Cause:** pnpm 11 checks dependency state before commands; the borrowed installation had different `patchedDependencies` metadata.
**Rule:** never approve a purge or set `CI=true` against borrowed dependencies. Prefer direct installed tools for documentation-only work. When using the shared cache for local preparation, `pnpm_config_verify_deps_before_run=warn` prevents automatic installation for that invocation; record the mismatch and leave clean-install validation to CI. Remove only the link you created, not its target.
**App/test work:** a borrowed install can also fail Vite resolution with an external `/@fs/...` dependency path. Replace only the owned symlink with a separate frozen install from the package cache; do not change the shared target or weaken the test config.
**See:** `package.json` (`packageManager`), `pnpm-workspace.yaml` (`patchedDependencies`).

### Assert literal registry identities as well as imported constants

**Symptom:** Studio tour tests passed while the browser rejected a missing named tab export and never mounted the app.
**Cause:** Vitest transformed the missing import to `undefined`; both the dynamic registry key and test argument used that value, so symmetric assertions still passed. The browser enforces named exports.
**Rule:** validate the public literal key alongside registry behavior, keep typechecking, and verify the real browser entry. A passing transformed test does not prove an imported symbol exists.
**See:** `src/tests/studio-tour.test.ts`, `src/lib/tour-ids.test.ts`, `src/stores/app-store.ts`.

### Scroll pointer targets into the tested viewport before reading their bounds

**Symptom:** Studio's Tone drag passed at 1440×1000 but never changed the saved revision in CI at 1280×720.
**Cause:** `boundingBox()` returned the offscreen slider at y896.67; raw `page.mouse` input does not scroll a locator into view.
**Rule:** scroll the actual control into view, read fresh bounds, verify the intended hit target, and retain the real gesture and result assertions at the CI viewport. A non-null bounding box does not prove pointer reachability.
**See:** `src/e2e/studio-finishing.spec.ts`, PR Gate run `40402793827`.

### Emulate a slower device for audio on the audio thread; CDP throttling never reaches it

**Symptom:** A 12-lane Studio song played clean under `Emulation.setCPUThrottlingRate` at 2x and 4x (62, 74 and 67 % of the audio thread), so throttled runs said nothing about slower devices.
**Cause:** Chromium renders realtime audio on a thread of its own (a SCHED_RR thread in the renderer, "Realtime AudioW..."), and the DevTools throttle slows only the main thread.
**Rule:** Burn 1 - 1/k of every render quantum on the audio thread with an AudioWorklet to emulate a k-times slower device, throttle the main thread k times with CDP as well, and give Auto a benchmark k times the desktop's. Calibrated: k = 2 measured 49.8 % burned, k = 4 76.0 %.
**See:** `src/lib/studio/playback/playback-benchmark.ts` (what Auto reads), `src/lib/studio/playback/song-load.ts`.

## Process

### Validate native notation, not just the exporter importing its own bytes

**Symptom:** GP7 round trips passed, but GP8 showed red bars and huge tuplet ratios.
**Cause:** free-time fractions became isolated rational tuplets; shared parser/exporter behavior hid incompatible notation and wrong instrument metadata.
**Rule:** keep exact timing in MIDI; disclose GP-only notation rounding and independently check GPIF bar sums, rhythms and instrument fields. Owner native-app verification is still required.
**See:** `src/lib/guitar/recording-gp7.ts`, `recording-export.test.ts`

### Do not pack capture and every responsive screenshot into one browser deadline

**Symptom:** the recorder smoke timed out at different late actions in all CI
attempts despite passing locally.
**Cause:** six seconds of real capture, twenty viewport changes, screenshots,
exports and cross-page persistence shared one 30-second budget. The CI trace
showed forward progress throughout, not one hanging control.
**Rule:** keep the real capture/persistence journey intact; test responsive
layouts separately with a persisted fixture. Do not raise the global timeout
or remove assertions to mask unrelated accumulated work.
**See:** `src/e2e/guitar-recorder-layout.spec.ts`, `src/e2e/guitar-night-recording.spec.ts`

### Animate recording previews from the audio clock, not saved chunk duration

**Symptom:** live recording looked like a stuttering six-frame-per-second highway.
**Cause:** the adapter used 8192-frame worker/IndexedDB checkpoints as its display
clock: ~169 ms jumps despite sub-millisecond canvas drawing.
**Rule:** sample the already-owned capture clock for visible frames; keep durable
evidence on its frame timeline. Cancel visual work when preview is off/stopped.
**See:** `src/features/guitar-night/useGuitarRecordingStage.ts` and its cadence regression.

### Do not commit, push, or open a PR unless asked

**Rule:** write the code, report what changed, stop. The user tests first and
says when to commit. This overrides any "commit after every task" instruction
elsewhere in the repo docs.

### Exclude the selected mirror backing from its reflection capture

**Symptom:** a fixed jagged black diagonal crossed the live mirror while the
surrounding frame and main scene rendered correctly.
**Cause:** the Meshy frame's backing sits behind its reflective inset and
intersects the reflected camera's oblique near plane. Retriangulating the inset
and hiding floor art did not remove the stripe in matching-camera comparisons.
**Rule:** hide the selected frame instance only during its reflection capture,
then restore visibility in `finally`. Keep other frames available in reflection.
Prove the fix at the same pose before changing geometry or renderer quality.
**See:** `packages/glass-game/src/render/planar-reflections.ts`,
`art/glass-adventure/v5/proofs/mirror-backing-sept20/`.

### Use fixed viewports for hidden-browser art comparisons

**Symptom:** a desktop screenshot cropped Merc and the singing instructions after
the same hidden browser page had previously rendered at phone width, even though
the canvas dimensions, camera projection and DOM bounds were correct.
**Cause:** the hidden Chrome session retained a stale compositor crop across the
viewport switch. A fresh context at the final desktop size rendered correctly.
Separately, a screenshot taken during the entrance camera blend looked occluded;
the settled camera had both subjects in view.
**Rule:** use a fresh, fixed-size context for each final art comparison and wait
for the production camera's settled state before diagnosing composition. Keep
resize behavior tests separate. Do not change camera geometry to compensate for
a stale capture or assume wall-clock delay equals simulated camera time in an
occluded window. If both baseline and candidate stall while preparing in a
hidden headful window, compare with an isolated hardware-headless browser and
record its actual GL renderer before changing game readiness or clock limits.
The runner comparison completed normally with hardware headless while both
hidden headful variants stalled; this was not evidence to weaken recovery.
**See:** `packages/glass-game/src/render/challenge-camera.ts`,
`apps/beside-cue/e2e/glass-adventure-thawing-living-art.e2e.ts`.

### Separate rendering cost from input and microphone interaction tests

**Symptom:** a restored player appeared blocked after moving only 0.6–0.8 metres in eight test seconds.
**Cause:** shrinking the main canvas left the planar reflection target expensive under SwiftShader; slow RAF plus the bounded physics timestep meant slow simulated travel, not a collider.
**Rule:** inspect position/frame progress before changing world geometry or touch coordinates. In behavior-only cases, suppress pixel draws, clears, multisample resolves and mipmap generation while retaining real loaders and input; transmission targets can still stall SwiftShader when only draw calls are omitted. For input-only tests, advance controlled simulation time and assert acquisition, travel, braking and stale-contact rejection; wall-clock seconds are not simulated travel time under software rendering. Keep real audio timing and production interruption limits in microphone tests, with separate actual-render proofs; never claim these tests measure GPU performance.
**See:** `apps/beside-cue/e2e/glass-adventure-voice.e2e.ts`, `art/glass-adventure/v6-level2/proofs/twin-galleries/`.

### Never add Claude attribution

**Rule:** no `Co-Authored-By`, no "Generated with", in commits, PR bodies, or
any artifact. The user is the sole author. Cloud sessions have historically
authored as `Claude <noreply@anthropic.com>` — verify `%an|%ae` before merging.

### Never test against production

**Rule:** local or dev only (`api-dev`, localhost workers). Prod deploys go
through `/prod-upd`.

### Review asset reduction at the closest gameplay view

**Symptom:** validated GLBs rendered melted plants and plain slabs instead of the approved art.
**Cause:** 91–98% mesh reduction destroyed silhouettes; opaque landing covers hid donor PBR detail.
**Rule:** compare donor and runtime at identical close-up camera/light before accepting a budget.
Collision proxies do not need opaque decorative covers. Passing GLB validation is not art approval.
Include the preserved pre-remesh source: a textured provider donor can already have lost 99% of
its triangles before local reduction. Compare file hashes and triangle positions before blaming
a later normals pass. When splitting a mesh for colour variants, preserve its split normals;
recomputing each side independently can introduce a seam without changing the silhouette.
**See:** `art/glass-adventure/plans/CLOUDWAY-VISUAL-QUALITY-REVIEW.md`,
`art/glass-adventure/plans/MUSEUM-SHAPE-AUDIT-2026-09-23.md`.

### Review silhouettes before reducing generated museum assets

**Symptom:** museum domes, statues and cypresses looked jagged despite valid glTF and texture maps.
**Cause:** provider remeshing followed by local decimation discarded useful shapes; normal maps could not restore outlines. Dense normal bakes also introduced projection halos on some surfaces.
**Rule:** preserve dense donors, accept remeshes in clay, compare baked/provider normals under identical lighting, then inspect exact runtime exports. Keep instancing and measure total scene cost; successful validators alone do not establish visual quality. Review material recolouring on the actual surface UV footprint: a whole-atlas colour average missed a mask that treated warm neutral dome stone as gold and left 80.5% of the dome untinted.
**See:** `art/glass-adventure/plans/MUSEUM-COMPONENT-REPAIR-2026-09-22.md`.

### Validate transferred normals before judging the texture bake

**Symptom:** a remeshed platform had isolated black landing triangles even in a neutral clay view.
**Cause:** nearest-polygon normal transfer selected nearby leaf or carving faces; some provider split normals already opposed their geometric faces. Comparing two supplied normals could preserve two agreeing but jointly invalid directions. The defect remained with the normal texture disconnected, and invalid ray directions also contaminated the bake.
**Rule:** compare raw, transferred-without-map and baked-normal views. Check every proposed corner normal against its geometric face, including fallbacks; preserve intended hard edges. Flattened contact polygons need a consistent upward basis. Rebuild tangents and dependent bakes after changing corner normals. Inspect projection hits separately before changing cage distances. Never hide this with stronger lighting or assume a valid GLB is visually correct.
**See:** `art/glass-adventure/platform-trials/v4/production/build_marble_runtime_v4.py`.

### Verify decimation weight direction before calling a group protective

**Symptom:** a detail-protection group favoured collapse on ornament while excluding broad planar regions.
**Cause:** the group assigned high weights to protected detail, but Blender Collapse excludes zero-weight edges and makes high-weight edges cheaper to collapse. The group's name did not establish its effect.
**Rule:** verify modifier semantics, record whether the group is inverted, and compare retained detail under identical cameras. For a high-means-protection group, invert its use by Collapse. A triangle budget alone cannot prove that the intended regions survived. In the V4 replay, even correctly inverted whole-shell collapse creates damaged broad surfaces; a geometry-identical normal reset cannot repair them. Check matched clay immediately after each operation. Keep collider flattening off visible relief and foliage.
**See:** [Blender 5.2.2 collapse edge-cost implementation](https://github.com/blender/blender/blob/v5.2.2/source/blender/bmesh/tools/bmesh_decimate_collapse.cc#L216), `art/glass-adventure/platform-trials/v4/production/build_marble_dense_direct_v4.py`.

### Keep quantization transforms below authored placement roots

**Symptom:** a valid quantized planter imported at the wrong size in the game.
**Cause:** its selected node's scale decoded integer vertex positions, but the authored-unit loader reset that scale to place the object.
**Rule:** place decode transforms below a stable, unscaled semantic root. Reopen the final export and measure bounds through the actual game adapter; a source-editor view cannot prove the placement contract.
**See:** `art/glass-adventure/journey-map/v10/production/package_botanical.mjs`, `packages/glass-game/src/journey/models.ts`.

### Recheck formatting after import-sort fixes

**Symptom:** `pr:prepare` passed locally, but changed-file CI rejected one import line.
**Cause:** preparation formats before ESLint fixes; the import sorter then moved a
named import inside the one-line-import plugin's output without restoring its spaces.
**Rule:** after lint changes an import list, run Prettier on that file and verify
that scoped formatting and lint both pass. Do not rerun every local gate.
**See:** `scripts/pr-prepare.mjs`, `.prettierrc.json`,
`packages/glass-game/src/content/cloudway-layouts.ts`.

### Measure evaluated glass clearance beneath source detail

**Symptom:** a beautiful provider crystal became a dark slab or developed triangular dark patches after adding an optical interior; material changes did not restore its source appearance.
**Cause:** the new glass shell or shard cap occupied the same depth as the retained provider surface. A nominal inset was insufficient when bevel evaluation raised the cap back into the source relief.
**Rule:** compare source-only, interior-only and combined views with explicit mesh allowlists. Measure clearance after modifiers against the full range of retained surface relief; keep the closed interior inside that envelope. Preserve the original exterior vertices, UVs and split normals when they already provide the approved appearance. Repeat the comparison through the actual GLTFLoader and production adapter before accepting a material change.
**See:** `art/glass-adventure/cloudway-laboratory/v1/production/prepare_amethyst_crackle_runtime_candidate.py`, `packages/glass-game/src/render/cloudway-crackle-adapter.ts`.

### Dispose specialized scene owners before generic traversal

**Symptom:** an adapter's isolated resource tests passed, but full renderer teardown disposed its material and shared textures twice.
**Cause:** a material clone owned by the adapter still referenced textures owned by the material library. Generic scene disposal ran first and treated that unlisted clone as owning its textures; the adapter and library then performed their own cleanup.
**Rule:** specialized owners must detach and dispose their scene objects before generic traversal, while shared material ownership remains available. Dispose the library last. Test the complete teardown path with a real shared texture and repeated disposal, rather than only testing an adapter with texture-free fixture materials.
**See:** `packages/glass-game/src/render/glass-renderer.ts`, `packages/glass-game/src/render/cloudway-crackle-adapter.ts`, `packages/glass-game/src/render/dispose.ts`.

### Meshopt's decoder needs lazy loading and a WebAssembly CSP permission

**Symptom:** unrelated legacy Glass3D browser cases reported CSP page errors after a compressed museum asset was added.
**Cause:** a static Meshopt decoder import immediately initializes WebAssembly, even when the current level never uses compressed geometry. Beside Cue's `script-src 'self'` forbade that initialization.
**Rule:** initialize the decoder on the first compressed-buffer request and permit the narrow `wasm-unsafe-eval` source in the application's CSP. Do not add JavaScript `unsafe-eval`. Verify a real compressed GLB under the actual app policy as well as the unaffected legacy route. Preserve concurrent asset downloads and retry a failed dynamic-import request without masking decoder failures.
**See:** `apps/beside-cue/index.html`, `packages/glass-game/src/render/asset-kit.ts`, `apps/beside-cue/e2e/glass-adventure-authoring.e2e.ts`.

### Inspect runtime asset bytes before changing a 3D model

**Symptom:** a locally served museum failed with `Unexpected token v, version ht... is not valid JSON`.
**Cause:** required GLB paths contained Git LFS pointer text after a worktree checkout, not model bytes.
**Rule:** inspect the failing response and hydrate the exact runtime inventory before regenerating art; private source symlinks do not supply public runtime deliveries. The gallery guard names unresolved pointers, while native builds verify their inventory.
**See:** `packages/glass-game/src/journey/resources.ts`, `apps/beside-cue/scripts/native-games.ts`.

### Verify native route dependencies beyond a self-consistent inventory

**Symptom:** the runner appeared in TestFlight's Games list but failed loading, although every packaged asset matched its checksum.
**Cause:** native staging still pruned two runner scenery models as standalone-only; its checksum inventory faithfully described the incomplete package.
**Rule:** when exposing a native route, verify its mandatory assets survive public-copy pruning and platform staging, then exercise the packaged route. A matching inventory proves integrity, not dependency completeness.
**See:** `apps/beside-cue/scripts/game-assets.ts`, `apps/beside-cue/scripts/native-games.test.ts`.

### Close owned decoded images when retiring a GLTF document

**Symptom:** returning to the floating museum after several galleries lost the active iOS graphics context.
**Cause:** the audit found map documents disposing GPU textures while retaining decoded ImageBitmaps, and failed scenes remaining allocated until retry. Those are avoidable memory costs; the device reset's exact trigger is not established.
**Rule:** close each uniquely owned decoded image after its last consumer retires, including late-abort loads. Retire failed scenes immediately and distinguish intentional context disposal from an active failure in device logs.
**See:** `packages/glass-game/src/journey/resources.ts`, `packages/glass-game/src/journey/scene.ts`, `apps/beside-cue/src/dev/game-diagnostics.ts`.

### Assert the loaded asset tier in visual comparisons

**Symptom:** changing textures, shadows and glass geometry appeared to leave a platform defect unchanged.
**Cause:** the comparison intercepted the desktop GLB while the real renderer requested its mobile variant; none of the proposed changes reached the scene.
**Rule:** record the actual request URL, served hash and override hit count, and fail the comparison if its candidate was not loaded. Compare the same camera and tier before attributing a defect to the donor mesh. Keep invalid captures labelled as non-evidence.
**See:** `packages/glass-game/src/render/asset-profile-bundles.ts`, `packages/glass-game/src/render/asset-kit.ts`.

### Inspect the opened passage at the actual floor datum

**Symptom:** a shattered doorway would let Merc walk through a visible 30-centimetre stone sill.
**Cause:** the donor's fused bottom crossbar remained in the persistent frame, while its collision profile described only the side posts and top. Overall bounds and closed-pane previews could not reveal the mismatch.
**Rule:** review the fully open frame from both sides, measure the threshold against gameplay step height, and test the actual exported opening. Keep the frame feet and clear passage on the court datum; do not bury decoration or remove collision to conceal a raised sill.
**See:** `packages/glass-game/src/render/frost-wall-asset.test.ts`, `packages/glass-game/src/content/frost-wall-profile.ts`.

### Promote quantized vertex attributes before baking transforms

**Symptom:** a certified 2.69 m glass pane became about 0.69 m tall in the game although Blender, GLB accessor bounds and collision all agreed.
**Cause:** `flattenGeometry` applied world transforms into normalized Int16 position buffers, then converted them to Float32 afterward. Coordinates outside the normalized range had already overflowed; reading the source bounds alone could not catch it.
**Rule:** promote transform-bearing attributes before applying any matrix. Test the final prepared geometry from an actual compressed GLB, and inspect intact and fractured states in the real renderer. A passing interaction test does not establish visual correctness.
**See:** `packages/glass-game/src/render/asset-geometry.ts`, `packages/glass-game/src/render/frost-wall-asset.test.ts`.

### Own shader-readiness polling before renderer teardown

**Symptom:** leaving or losing the WebGL context during shader precompile could leave readiness pending and throw from a timer.
**Cause:** Three's `compileAsync` timer rereads material properties that `WebGLRenderer.dispose()` deletes; the timer is not cancellable.
**Rule:** snapshot the guarded program handles after `compile`, own the readiness timer, and abort it before disposing materials or renderer state. Bound driver waits and test disposal and context loss while precompile is pending.
**See:** `packages/glass-game/src/render/program-precompile.ts`, `packages/glass-game/src/render/glass-renderer.test.ts`.

### Measure a platform's visible top independently of its collision metadata

**Symptom:** a jump appeared to reach a stone deck but Merc fell past its visible rim.
**Cause:** the exported contact rectangle was inset from a continuous near-horizontal ledge; bounds/metadata checks alone certified the mismatch.
**Rule:** ray-test the decoded top and corners at the gameplay datum, then inspect both supported landings and side deflection in the actual renderer. Separate a structural ledge from lower ornament before fitting art or changing authored gaps. Compare custom support metadata with decoded anchors in the declared coordinate system: Blender export transforms nodes, but JSON extras need an explicit Blender XY to glTF XZ conversion.
**See:** `packages/glass-game/src/render/cloudway-laboratory-assets.test.ts`, `apps/beside-cue/e2e/glass-adventure-solids.e2e.ts`.

### Keep authoritative exhibit state current while presentation is hidden

**Symptom:** skipping updates for an invisible exhibit left its late-load guard unaware that the exhibit had already broken.
**Cause:** an outer visibility check skipped both cheap state ingestion and expensive visual work. The asynchronous asset installer still consulted the stale state.
**Rule:** always ingest authoritative state and time; defer only presentation writes while hidden. Test late downloads, completion, retry and reveal. Reflection captures need their own temporary visibility with guaranteed restoration, and culling must never remove an otherwise visible walkable surface just to meet a count limit.
**See:** `packages/glass-game/src/render/vessel-visibility.test.ts`, `packages/glass-game/src/render/glass-renderer.ts`.

### Draw hidden effect variants during loading, not their first interaction

**Symptom:** a continuous singing course enters frame-gap recovery at the first visible cracks, although shader precompile completed during loading.
**Cause:** Three compiles hidden materials but defers geometry uploads and program first-use reflection until a visible draw; without parallel shader compilation, readiness does not force every first-use cost.
**Rule:** warm resident effect renderables through the real framebuffer path behind the loader, restore visibility/culling in `finally`, then paint and verify the genuine initial scene before enabling play. Do not advance gameplay, weaken timing limits or instantiate an entire streamed course for warmup.
**See:** `packages/glass-game/src/render/render-warmup.ts`, `packages/glass-game/src/render/runner-renderer.ts`.

### Separate real-time audio contracts from software-GPU throughput

**Symptom:** a complete audio/control course passes on hardware but enters frame-gap recovery in shared CI even after draw calls are omitted.
**Cause:** SwiftShader still pays geometry uploads, program reflection, state changes and resource churn; suppressing pixels does not create a deterministic presentation boundary.
**Rule:** use a typed, test-scoped presentation substitute for the long PCM/input/judging test, keeping its real clock and recovery threshold. Retain separate real-renderer loading/streaming/disposal tests and full hardware-rendered course proof. Fix measured production construction costs rather than widening timing tolerances or claiming software tests establish phone performance.
**See:** `apps/beside-cue/e2e/helpers/runner-controls-renderer.ts`, `apps/beside-cue/e2e/helpers/runner-renderer-smoke.ts`.

### Publish the terminal scene before cancelling its last animation frame

**Symptom:** course results and rewards were correct, but the scene sometimes remained one fixed step before completion.
**Cause:** microphone or input callbacks can finish the authoritative simulation before RAF; resource cleanup then cancels RAF while the terminal state is published without presentation permission.
**Rule:** keep ordinary evidence updates independent of GPU rendering, but publish one authoritative finish/recovery frame after stopping the loop. Test capture, input and RAF as terminal triggers, including late callbacks and exactly-once cleanup.
**See:** `packages/glass-game/src/browser/runner-session.ts`, `packages/glass-game/src/browser/runner-session.test.ts`.

### Wait for the rendered camera before clicking a projected surface

**Symptom:** a canvas artwork click missed even though the requested camera yaw was correct; mouse and touch dialog assertions failed.
**Cause:** pointer input updates the yaw target synchronously, while enclosure framing and the camera used for raycasting continue moving during subsequent rendered frames.
**Rule:** wait for the actual rendered pose to converge before using a fixed projected click point. Sample after real presentation frames, allow the diagnostic publication cadence, and require consecutive stable positions within a bounded wait. Align measured position and camera yaw to the same frame: `step → refresh → render` can publish a current position with the preceding rendered yaw. Do not retry clicks or widen distance/time limits to hide mismatched observations.
**See:** `apps/beside-cue/e2e/glass-adventure-artwork.e2e.ts`, `apps/beside-cue/e2e/helpers/glass-adventure-camera-route.ts`.

### Verify movement cues from visible instructions and the actual camera

**Symptom:** a runner bot completed jumps while players saw a confusing floor stripe or missed the useful cue.
**Cause:** acting at a simulation-certified midpoint or on hidden cue-stage attributes bypassed the player-facing instruction; a low camera and thick landing slab hid the real gap.
**Rule:** keep deterministic flight tests, add visible-copy action timing with a reaction delay, and inspect actual rendered takeoff/landing views. A controls-only renderer cannot certify scene readability. Use the full donor bounds, including hardware, when proving a visual opening is clear.
**See:** `apps/beside-cue/e2e/glass-adventure-runner-responsive.e2e.ts`, `packages/glass-game/src/render/runner-world.test.ts`.

### Initialize the shadow comparison texture before the first reflection capture

**Symptom:** a fresh runner renderer reported `GL_INVALID_OPERATION: sampler type does not match texture format` during its preparation-time cube capture.
**Cause:** shadow updates were manual; the cube pass was the first draw of a shadow receiver, before the comparison texture had been initialized.
**Rule:** mark the shadow map for update before the first capture, restore temporary capture-only objects in `finally`, and check the actual WebGL error stream from a fresh context.
**See:** `packages/glass-game/src/render/runner-look.ts`, `runner-look.test.ts`.

### Apply the asset profile in every scene loader, independently of resolution

**Symptom:** iOS lost the museum context on entry or island switching despite a mobile drawing buffer; the galleries could still play.
**Cause:** the museum selected mobile pixels and shadows but never passed its texture profile to the model loaders. First-visible islands uploaded more full-size images. The browser probe measured this avoidable residency, not the iOS driver's exact reset cause.
**Rule:** carry the profile through GLBs, separate PBR maps and earned portraits before upload; bound concurrent decode/resize work. Measure allocations while visiting every view, not only the first ready frame, and keep physical-device acceptance separate from a desktop GPU test.
**See:** `packages/glass-game/src/journey/resources.ts`, `apps/beside-cue/e2e/glass-adventure-map-memory.e2e.ts`.

### Assert render passes against the sampled frame's shadow cadence

**Symptom:** a museum browser test failed with zero secondary passes after live diagnostics replaced a cached first-frame snapshot.
**Cause:** the test required one shadow pass on every frame, although mobile and adaptive profiles intentionally reuse shadows between updates.
**Rule:** require exactly one pass for an every-frame cadence; permit only zero or one for the configured skipped-frame cadences. Keep water draw/triangle budgets and ordinary scene assertions intact. Do not force redundant shadow rendering or lengthen test timeouts to satisfy a stale snapshot assumption.
**See:** `packages/glass-game/src/journey/scene.ts`, `apps/beside-cue/e2e/glass-adventure-journey.e2e.ts`.

### Publish Merc's bone palette independently of shadow refreshes

**Symptom:** Merc's movement stuttered on Auto/Balanced but became smooth on High on a capable tablet.
**Cause:** Three r185 projects skinned meshes before incrementing its render-frame ID, then caches shadow casters under the incremented ID. The next frame can reuse that prior bone palette when shadows are skipped. The shipped Merc reproduced stale animation and world translation on 12 of 24 Balanced frames in real WebGL; High's every-frame shadows concealed the defect.
**Rule:** after Merc's mixer and root transform settle, update his world matrices and publish each shared skeleton once. Retain mobile texture/pixel limits and cached shadows. Test actual actor palettes against current bones through the real Three object cache at 1/2/4-frame shadow cadences; faster GPU timing alone cannot catch a stale-pose defect.
**See:** `packages/glass-game/src/render/skinned-pose.ts`, `packages/glass-game/src/render/merc-shadow-cadence.test.ts`.

### Use an explicit host capability for compiled development controls

**Symptom:** Tune appeared on the local development server but disappeared from the deployed development website or native CI build.
**Cause:** optimized builds have `import.meta.env.DEV === false`, even when the build mode or delivery channel is development.
**Rule:** let each host explicitly enable development controls from its build mode/channel; release hosts explicitly disable them. Keep progression testing independent. Verify the actual host entry in an optimized development build, not only a shared UI fixture or Vite dev server.
**See:** `src/features/glass-adventure/host.ts`, `apps/beside-cue/src/games/adventure/AdventureScreen.tsx`, `packages/glass-game/src/ui/development-tuning.ts`.

### Redraw the current paused snapshot after changing graphics quality

**Symptom:** changing runner graphics in Sound / tune cleared the scene until the player resumed.
**Cause:** renderer resize clears the drawing buffer while the Tune modal pauses the frame loop.
**Rule:** after changing quality, render the current session snapshot with zero elapsed time under the existing loading/disposal guards and graphics failure handler. Do not reuse an old running snapshot or advance simulation time. Test this while the settings modal remains open.
**See:** `packages/glass-game/src/ui/SongRunnerScreen.tsx`, `apps/beside-cue/e2e/glass-adventure-runner-sound.e2e.ts`.

### Roll back canvas listeners when Three construction throws

**Symptom:** after an active gallery lost its graphics context, an unknown 300-by-150 canvas restored and threw while reading `autoReset`.
**Cause:** Three r185 registers canvas listeners before initializing its `info` object. Constructing on a lost context throws before assignment; its surviving restore listener then reads undefined state. The recovery panel also created a fresh optional Merc preview. This reproduces the secondary exception, not the driver's original reset.
**Rule:** own constructor-time listener registrations, remove only those listeners on failure, and register diagnostic ownership before initialization. Keep recovery panels on artwork until an explicit retry; dispose a pending preview when error state arrives. Test an actual lost context, failed Three constructor and restore event, plus playing and paused recovery.
**See:** `packages/glass-game/src/render/graphics-renderer.ts`, `packages/glass-game/src/ui/LoadingMerc.tsx`, `apps/beside-cue/e2e/glass-adventure-context-recovery.e2e.ts`.

### Advance target outcomes with the clock in rendering probes

**Symptom:** a controlled runner approach became a full-screen yellow blur near a glass obstacle.
**Cause:** the probe advanced distance while retaining the initial unresolved target list. An expired singing pane crossed the camera; the real session would already have settled and retired it.
**Rule:** preserve target lifecycle and resident scenery when comparing matched camera positions. Confirm optical candidates during real gameplay with the actual clock and inputs; keep synthetic fixture artifacts separate from product defects.
**See:** `packages/glass-game/src/render/runner-renderer.ts`, `apps/beside-cue/e2e/helpers/runner-voice-fixture.ts`.

### Check playback after retaining an example across reloads

**Symptom:** shipped examples stayed listed after the boot prune fix but would not play after a reload.
**Cause:** session persistence omits runtime `outputs`; retaining a row makes the seeder skip its creation, and a local-blob hydrator cannot restore its remote URLs. Presence-only reload tests passed.
**Rule:** restore external audio from its manifest, preserve local replacements and edited metadata, and test playable stems across fresh module loads sharing one database. A failed storage read or a delete/edit during hydration must not overwrite user work or resurrect a removed row.
**See:** `src/features/karaoke-night/seed-examples.ts`, `src/stores/uvr-store-reload.test.ts`.

### Budget the complete browser journey across bounded scene loads

**Symptom:** a Settings locator appeared to time out even though its button was present.
**Cause:** two successful 41-second software-rendered course loads exhausted the test's 90-second total; the final click received only 35 milliseconds before teardown.
**Rule:** inspect the trace's global deadline before diagnosing a missing control. When real scene loading is part of the journey, budget the test for its aggregate bounded loads and interactions; keep each load limit and every assertion intact.
**See:** `apps/beside-cue/e2e/glass-adventure-native-current.e2e.ts`.

### Check bottom-pinned phone UI with the consent banner open

**Symptom:** on a phone, a Google sign-up from the onboarding Map showed no word of the launch gift. Both toasts it raised ("Signed in with Google", "5 credits added") were on screen, under the cookie banner.
**Cause:** the banner opens only in a build with a Google tag and on a Europe clock. `pnpm dev`, `build:e2e` (tag ids emptied) and CI (UTC) never show it, so nothing anchored to the foot of a phone screen was ever seen beside it.
**Rule:** the foot of the screen is a stack (tab bar, banner, confirm-email pill, toasts); each layer publishes its room on `<html>` with `publishFootSpace` and stands on the ones below. Anything else pinned to the bottom stands on `--consent-banner-space`, and on `--verify-banner-space` where the pill can be. To see the real banner, build with a tag id set and run the browser with `timezoneId: 'Europe/Zagreb'`. On a phone, use dev.mercurypitch.com or a PR preview: `build:dev` sets `VITE_CONSENT_PREVIEW=true`, so the bar shows with no Google tag (on a Europe clock, or from Settings › About › Cookie settings) and nothing is sent to Google. Clear `mp.consent.v1` in site storage to be asked again.
**See:** `src/lib/foot-space.ts`, `src/e2e/toast-above-confirm-bar.spec.ts`, `src/tests/foot-stack-css.test.ts`, `src/components/ConsentBanner.preview.test.tsx`

### Measure the compressor lookahead before judging a chain offline

**Symptom:** the voice chain's dynamic EQs looked 3.6 dB down 60 ms after the build, and immune to the release settle.
**Cause:** an offline probe that builds a chain without first running `measureCompressorLatency` gets fresh null compressors as latency twins (compressor-twin.ts), and they dip like any new compressor. With the lookahead measured, as every live build has it, the bands were 0.36 dB down without the settle and 0.01 dB with it.
**Rule:** call `measureCompressorLatency` (or render through `measureChainLatencyFrames`) before comparing a fresh chain with a settled one.
**See:** `src/lib/studio-fx/compressor-twin.ts`

### Prove a Studio change exact on one chain, not on the whole graph

**Symptom:** a change that leaves silent stereo paths out of the graph rendered the 24-lane fixture up to 1.25e-4 (-78 dBFS) away from the build before it.
**Cause:** two offline renders of the same full Studio graph are not bit-identical: the same build rendered twice was 7.6e-5 apart (RMS -97 dB). One chain through `renderThroughChain` comes much closer: the stereo change came out 0 apart on every role's setting, and the keys, bass and other chains render bit-identical run to run. The voice and backing-vocal chains do not: the same build twice was 3.7e-6 and 6.0e-7 apart (headless Chromium 148, 30 Oct 2026).
**Rule:** prove a change exact by rendering a chain or an effect through `renderThroughChain`, which already removes the chain's own latency (do not shift the two outputs again), and render the old build twice as a control. Read any difference against that control's floor, not against zero.
**See:** `src/lib/studio-fx/render.ts`
