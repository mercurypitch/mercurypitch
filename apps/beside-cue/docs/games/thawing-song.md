# The Thawing Song

A separately selectable Cloudway preview that teaches one phrase through five safe note stations, then asks for the whole melody at the portrait. It is an ungraded audition level; completing it does not award campaign stars or unlock another island.

## Playing and testing

In a games-enabled Beside Cue build, open **B-side games → The Thawing Song**. In the development standalone host use `/glass-game/?layout=thawing-song`. The query selector is development-only. The native preview card uses the same compiled level.

1. At the first vase, tap **Sing to the glass**. Choose Brisk, Natural or Spacious. A saved comfortable note is reused; otherwise **Find your key** listens for a gentle, steady hum.
2. Listen, then hold the example note. Movement remains manual. Singing courts are static; the two short frosted stepping stones are travel only.
3. Learn the five notes in order. Notes two and four shatter ice panes and open their paths; the frames and edge planters remain solid.
4. At the portrait, listen to Merc sing **“Tiny sparks can glow”**, then follow the complete ribbon. The curve fills from fresh pitch evidence, not elapsed time or prior vase completions. **Hear example / Try again** resets only the current performance.
5. When the portrait opens, pass through the golden exit. Reloading or falling preserves the selected key, pace, learned notes and reachable checkpoint.
6. **Change key** after learning a note offers **Start fresh**. A new attempt starts at the entrance and cannot inherit learned notes from another key or pace.

Device acceptance should include permission denial/retry, background interruption, headset and speaker use, both gate approaches, sideways edge jumps, reload before and after a gate, and the final phrase on phone and tablet. Automated oscillator tests exercise the actual pitch pipeline but are not evidence of real singing comfort or native-device performance.

## Authored route

Source: `packages/glass-game/src/content/data/cloudway-thawing-song.course.json`.

| Beat | Lesson | Physical setting |
| --- | --- | --- |
| Arrival | Home note | Broad marble court |
| First thaw | Two semitones up | Static court before the first ice gate |
| Lantern turn | Four semitones up | Safe turn after the gate |
| Return thaw | Back down two | Second static gate court |
| Homecoming | Original note | Safe court beyond the second gate |
| Portrait | Complete phrase | Broad final pavilion and separate exit |

The route bends north, east and south instead of repeating a straight corridor. Eight deliberate gaps are 0.55–0.65 m. No compulsory note challenge uses a moving, timed, breaking or slippery platform. Decorations reuse the delivered detailed screen, planter, marble and glass assets; the level requires no extra native asset pack.

## Reusable authoring contract

Schema 2 courses retain their existing hold challenges. Schema 3 introduces a `melodyLesson` profile reference and discriminated encounter challenges:

- `melody-anchor`: lesson ID, unique anchor ID and an exact anchor-tone reference.
- `melody-contour`: lesson ID and a whole-melody reference.
- `comfortable-hold`: the existing non-melodic challenge remains available.

The compiler requires every catalogue anchor once and in order, including separate identities for repeated pitches. Each station requires its predecessors. The finale requires all learned stations, and the exit requires the finale. Unknown profiles, incomplete or reordered lessons, mismatched references, optional required stations and unsafe checkpoint footing are rejected.

The lesson profile owns melody, pace choices, supported range and judge policy. The current phrase has semitone offsets **0, +2, +4, +2, 0**. Its root is the comfortable calibration minus two semitones, centering the shape around the singer. The whole contour must fit the supported MIDI range; notes are never individually clamped. Spacious is the default six-second phrase. Recorded Merc examples are selected only for an exact verified melody version, root and pace; other supported keys use an explicitly identified synthesized guide.

The passive `MelodyRibbon` is shared with the existing practice screen. It displays the core judge result; it cannot award completion. Audio references and capture use one adventure controller lifecycle. Playback samples, stale frames, silence, a held root note and skipped anchors cannot satisfy the complete phrase.

## Save identity

Melody levels write progress version 3, containing one attempt identity: level/content revision, lesson/melody version, challenge signature, key, pace, transpose and attempt ID. The key/pace freezes during a challenge and after the first learned station. Invalid or incompatible identities discard melody evidence and return to a reachable checkpoint. Legacy levels retain their version 2 behavior and version 1 migration.

A fresh visit initially leaves the old durable save intact while assets load. Configuring the new attempt replaces its melody route evidence atomically; old and new attempts are never unioned. Retrying the portrait within the same attempt preserves the five learned stations but starts a fresh live judge.

## Automated acceptance

- Strict compiler/schema and native TypeScript package import tests.
- Full compiled-route traversal at 30 and 60 Hz, all eight jumps, both pane transitions and the exit, with no respawns.
- Checkpoint fall/reload and cross-key, pace, revision and attempt isolation.
- Wrong pitch, silence, stale/duplicate capture, skipped anchors and constant-root rejection.
- Reference playback, microphone failure recovery, cancellation/retry and capture teardown.
- Real Chromium PCM through the normal microphone detector; saved note, exact recorded example request, newly earned finale and exit.
- Games-enabled host entry and phone/tablet/desktop ribbon sizing in the actual host CSS.

Real GPU screenshots and production receipts are stored under the Proton-linked `art/glass-adventure/cloudway-laboratory/v1/source-assets/proofs/runtime/thawing-song-2026-09-27/`. Keep masters and large captures there rather than adding them to the application bundle.
