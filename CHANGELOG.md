# Changelog

What's new in MercuryPitch, in plain terms. For the full, detailed
engineering history see [`dev-changelog.md`](./dev-changelog.md).

## [0.5.3] - 2026-07-02

### Added

- **Voice Mirror — see your voice in 60 seconds** (`/mirror`): a free, standalone voice snapshot. Sing three short tasks (glide, hold, match) and get your vocal range as the headline, plus pitch accuracy and steadiness — rendered as a shareable "voiceprint" star-map card. Your latest result is saved on this device, so your next visit shows the delta ("+2 semitones since last time").
- **Just sing (40 seconds)**: a free-sing mode with no targets — it maps what your voice actually does: the range you used, the note you live around, phrase length between breaths, whether you're a "mover" or a "sustainer", and any vibrato on your longest note.
- **Sing the Universe**: sing short melodies made from real cosmic data — Orion's stars by their sky positions, five famous pulsars by their spin rates, and the Perseus black hole's B♭ — fitted to your range and scored like the match task.
- **Vibrato is a feature, not wobble**: if you sing with vibrato, the mirror names it ("5.6 Hz, ±26 cents") and no longer scores it against your steadiness. It also measures how quickly you settle onto notes ("you scoop ~180 ms").
- **Mic check that actually helps**: before the test starts, the mirror verifies it can hear you, shows a live input level while you sing, and recovers automatically from a silent-microphone quirk on iPhones.
- **Welcome screen**: a new "Mirror your voice" shortcut takes you straight to the mirror.

### Changed

- The previous release was renumbered from 0.6.0 to 0.5.2 — it was a patch-scale update, not a minor one.

## [0.5.2] - 2026-07-01

### Added

- **Cleaner recorded melodies**: recording a melody in Compose now removes octave jumps and stray, flickering notes automatically, so what you sing turns into logical, well-formed notes instead of a jittery mess.
- **See your pitch as you record**: while recording in Compose, your voice is drawn live on the piano roll — provisional notes and a moving pitch marker — so you can watch the melody take shape in real time.
- **Record for as long as you like**: recording no longer stops after a fixed number of bars. It keeps going until you stop it, and the grid grows to follow along.
- **Tidy up a take before you keep it**: after recording, a simple "As sung ↔ Clean" slider lets you dial in how much cleanup to apply, previewing the result, before you Keep or Discard the take.
- **Recording over a melody is one undo**: laying down a new take over an existing melody can now be undone in a single step, so you never lose the previous version.
- **Clean up the karaoke vocal line**: the Vocal Pitch panel in Karaoke gets the same cleanup slider, turning a noisy detected vocal into clear notes — with the key, scale and tempo adjustable.
- **Edit the detected vocal notes**: a new edit mode lets you select, move, resize, retune, delete, split and merge the vocal notes from a floating toolbar. Your edits are saved separately from the automatic detection, so you can switch between the original, your edited version, or both — and your edits survive a reload.
- **Automatic key detection**: the vocal line's musical key is detected for you — for the whole song and per section, so songs that change key are handled correctly.
- **Hear the detected melody**: a "Melody" toggle in the Vocal Pitch panel plays the detected notes as a soft synth that follows along during playback, so you can hear how the cleaned-up line sounds.

### Fixed

- **Shared links no longer crash on guitar**: opening a shared melody and playing it on the guitar sound no longer breaks the audio engine.
- **Vocal pitch labels line up**: the note names down the side of the Vocal Pitch view now match the rows they label.

## [0.5.1] - 2026-07-01

### Added

- **Live pitch marker while you sing**: a green marker tracks your voice on the left edge of the practice canvas the moment the mic hears you — not just during playback — with a faint guide line across so you can read your pitch against the melody.
- **Cleaner practice screen on phones**: the accuracy, sessions and pitch cards are now hidden by default on small screens so the melody has room. A small toggle brings them back whenever you want them.
- **Keyboard controls for the guided tours**: on desktop, use the arrow keys (or Enter) to step through a tour and Esc to close it.
- **Continue to the next section**: on the last step of a tour section, a button now offers to carry straight on into the next one.
- **Deeper, better-organised tours**: the Effects and Settings walkthroughs cover far more, Settings is now three focused per-tab tours (General, Practice, Display & Controls), and new "Learn" articles explain note effects and the Display and General settings in depth.

### Changed

- **Tours adapt to your screen**: they respond to resizing and rotation, expand a collapsed control bar before pointing at a hidden control, let you click the progress dots to jump between steps, and have a cleaner, more compact tooltip.

### Fixed

- **Mic no longer sticks on**: leaving the Singing or Compose tab now stops the mic, so the mic button doesn't look active — or react to playback — when you come back.
- **Mic button icon always shows**: the mic icon no longer collapses to nothing on a tight control bar.

## [0.5.0] - 2026-06-30

### Added

- **Reworked Singing practice screen**: the pitch view, score, and live mic monitor now float as glass cards over a full-bleed canvas, like the 3D guitar view. A floating control bar replaces the old toolbar — drag it to the top or bottom, or hide it for more room. A top-left chip shows the current scale/melody, tempo and position, and session scores sit in a top-right scoreboard. The pitch view auto-fits to your melody with clear note-name labels, and the overlays fade back during playback so the notes stay front and centre.
- **Consistent controls across tabs**: Piano, Guitar and Compose now use the same sleek glass control bar as Singing, so transport, tempo, volume and the rest behave the same everywhere.
- **Practice context in the header**: Singing, Piano and Guitar show a small pill with what you're practising, plus the loaded melody and character.
- **Tidier Compose editor**: the Piano Roll / Session Editor switch is now a clean tab strip, with the playback controls tucked into the same row.
- **Karaoke playlists tidy-up**: friendlier empty states, and deleting a playlist now asks for confirmation first so you can't remove one by accident.
- **Tabbed Settings**: settings are grouped into General, Practice, and Display & Controls tabs, alongside a polished account card.
- **Clear just your karaoke data**: a new Settings → Danger Zone button removes only your separated songs, stems, lyrics and karaoke playlists, leaving your melodies, practice history and settings untouched.
- **Pricing & support**: a redesigned pricing page with animated tier cards and checkout, plus a one-tap support button and an app-version pill in the header.
- **Let it ring on guitar**: Guitar Pro tabs with let-ring now sustain notes the way the tab intends during playback.
- **Direct links to exercises**: `/exercises/<name>` links open straight to that exercise's setup screen.
- **Faster stem separation**: optional GPU and CPU cloud tiers for splitting songs into stems.

### Changed

- **Sidebar**: reorganised into collapsible sections so it's easier to scan.

### Fixed

- **Works without the backend**: if the cloud isn't reachable, the app now loads and runs on your local data instead of erroring out — it warns quietly and carries on.
- **Deep links load correctly**: shared links to specific pages resolve their assets properly instead of falling back to the home screen.
- **Guided tours fixed up**: several tour steps that pointed at the wrong place after recent layout changes — the Settings sub-tabs, the singing transport, and a few mobile steps — now highlight the right control, and per-page "take a tour" offers no longer stack up.
- **"Reset to Factory Defaults" fully resets**: it now clears all local app data instead of leaving some behind, and clearing karaoke storage no longer leaves orphaned files.

## [0.4.9] - 2026-06-28

### Added

- **Show or hide the 3D overlays**: the 3D guitar control bar now has "Signal" and "Axes" toggles, so you can turn the input-signal monitor and the orientation gizmo on or off yourself. Your choice is remembered per device.

### Fixed

- **3D view fits the screen on phones**: the control bar now defaults to the top on touch devices and lays its controls out in a single scrollable row, so it no longer wraps and covers the fretboard. It also always stays above the other overlays.
- **Touch the 3D fretboard**: orbit, pan and zoom the 3D view directly with touch gestures.
- **Consistent navigation**: the nav tabs now follow the same order everywhere, and the app no longer scrolls sideways on mobile. The Community and Leaderboard pages also lay out properly on small screens.

## [0.4.8] - 2026-06-27

### Added

- **Play-along scoring in the 3D guitar view**: with a mic or MIDI instrument connected, the 3D view now scores you live — a Score and Combo readout while you play, plus your end-of-run result in the corner.
- **Hit feedback on the neck**: each note you nail flashes on its cell, colour-coded by accuracy (perfect / great / good).
- **Your note, live on the neck**: the pitch you're playing is marked on the fretboard in real time, turning green when it matches the note you're meant to hit.
- **Mic and MIDI toggles in the 3D controls**: turn your input on or off right from the 3D control bar, so you don't need the main transport bar open.
- **Choose your audio input/output**: a Devices panel on the Guitar page lets you pick which input to listen to — for example your audio interface's instrument input with a guitar plugged in — plus an output device (where the browser supports it), with a live signal meter so you can confirm your guitar is coming through.

## [0.4.7] - 2026-06-27

### Fixed

- **3D guitar view starts framed right**: the default (and "reset") camera now shows the whole neck — every fret plus the fret numbers — above the control bar, instead of cutting off the bottom of the fretboard.
- **Transpose works for the built-in songs too**: shifting a piece up or down by semitones or octaves previously only affected imported Guitar Pro / MIDI files. It now transposes the app's own scales and melodies as well — and it's non-destructive, so setting transpose back to 0 restores the song exactly.

## [0.4.6] - 2026-06-27

### Added

- **3D guitar tab playback**: a new "3D" view for guitar tabs where notes fly down onto a 3D fretboard and land on the exact string and fret to play. Upcoming notes are emphasised, chords are grouped together, and each note flashes as it lands, so it's clear what to play next.
- **Guitar Pro import**: open `.gp`, `.gp3`, `.gp4`, `.gp5` and `.gpx` files and play them in the 3D view, with the original fingering and tuning preserved.
- **Move the camera**: orbit, pan and zoom the 3D view — drag to rotate, shift- or right-drag to pan, scroll to zoom — plus a small corner gizmo to rotate and reset the view.
- **On-screen controls**: a glass control bar floats over the 3D view with play/pause, speed (quick 0.5/0.75/1x plus the resulting tempo), note-name and fretboard toggles, and a practice loop with A/B markers and a speed ramp. Drag the bar to the top or bottom, and hide the main transport bar for more room.
- **Transpose the song**: shift the whole piece up or down by semitones or octaves — the tab re-fingers itself on the neck and the sound follows.
- **Score in the corner**: finishing a run in the 3D view now shows your score, and your last few scores, quietly in the corner instead of a pop-up.

## [0.4.5] - 2026-06-26

### Added

- **Beginner help on every exercise**: a "?" button in the top-left explains, in plain words, what each exercise is (what a long note, slide, or vibrato actually is), how to do it, and what's being scored.
- **Timed auto-score mode** for the held-note exercises (Long Note, Vibrato, Pitch Hold): pick a 5s, 15s or 30s timer and the exercise scores itself when the time is up — no need to reach for Stop.
- **A guide dot for slides**: the Slide exercise now shows a dot that glides up and down so you can follow the pitch path with your voice.
- **Vibrato practice modes**: the Vibrato exercise now shows the target note as a line, an optional "wave to follow" you can trace, and Slow & Wide / Natural / Fine & Fast styles so you can train from a deliberate wide swing up to a quick, fine shimmer.
- **Mic toggle in exercises**: a microphone button in the exercise header (with a live level meter) lets you turn the mic on to check your input and off when you're done.
- **Clearer exercise pitch tracker**: the note you're singing is now labelled at the dot, and when zoomed in the side guide shows individual notes (not just octave Cs) so you can see exactly where you are.
- **Target note on every exercise**: the pitch tracker now draws the note you're aiming for as a line on all exercises, so you can see your pitch against the goal in real time.

### Changed

- **Smoother exercise flow**: the Start button and options sit centred beneath the exercise description, and you can start/stop with the spacebar. Finishing no longer pops up a score modal — your last few scores now live quietly in the corner of the panel and the screen returns straight to Start so you can go again.
- **Easier-to-read text**: lightened the faint gray text on the Challenges tab and the exercise score panel so labels, badges and results are legible.
- **Smarter pitch tracker zoom**: when you sing within about one octave, the tracker now zooms in to that octave instead of showing three or four, so your pitch line is easier to follow.
- **Exercises moved to the Practice group**: the Exercises tab now sits with Singing, Piano, Guitar and Karaoke (it was under Social), so all your practice modes are together.
- **Easier top-bar navigation (desktop)**: scroll the tab bar left/right with your mouse wheel, or just click and drag it to pan — no more hunting for the right tab. Each tab group (Practice / Social / Advanced) can also be collapsed to a single tab by clicking its label; hover it to expand again. Your collapsed groups are remembered.

### Fixed

- **Vibrato is now detected properly**: the Vibrato exercise (and the Vocal Analysis vibrato readout) often failed to recognize a real vibrato; it now reads your pitch correctly and scores it.
- **More accurate exercise scoring**: several exercises (Siren, Drone, Staccato, Interval Trainer, Sight-Singing, Routine Runner, Pitch Hold) measured the recent part of your take using a wrong assumption about timing, which could skew scores — they now use the real timeline.
- **Siren / Range Explorer**: glides are now generated within your comfortable range (no more sub-audible targets like "G0"), and the start/end notes plus a guide dot are shown so you know exactly where to glide.
- The grade badge on exercise cards ("Good", "Great"…) now has its icon properly centered with the text.
- **Sight-Singing reworked**: notes are kept within your vocal range (no more unreachable highs), the cursor now advances when you actually sing each note (instead of marching on a fixed timer), the staff renders properly (real clef, ledger lines, accidentals), and a "hold to continue" bar plus a DEV-only pitch readout make practice and testing clearer.
- **Exercise difficulty + filter**: every exercise card now shows a fixed Easy/Medium/Hard difficulty, and a pill filter at the top lets you show just the exercises at a level. (This replaces the old badge, which was your personal adapting level and only appeared once you'd practised an exercise.)
- **Interval Trainer, Dynamic Swell and Call & Response now score correctly**: a timing bug made them measure an empty slice of your take, so they almost always scored 0 no matter how well you sang. They now score the notes you actually sang.
- **Routine Runner score capped at 100**: a fatigue bonus could push the total above 100; the score is now bounded correctly.

## [0.4.4] - 2026-06-26

### Fixed

- Changing your display name on a cloud account now works — it was failing with an error because the app tried to update a leaderboard table that's no longer there. The leaderboard already picks up your new name automatically.

## [0.4.3] - 2026-06-26

### Fixed

- Cloud accounts now work on mercurypitch.com — the production build was shipping without its API configuration, so accounts fell back to on-device storage.

## [0.4.2] - 2026-06-25

### Fixed

- Shazam Sing: the button icons (Speech/Debug toggles, Stop & Match, Cancel, and "Upload audio instead") are sized correctly again instead of looking oversized.

## [0.4.1] - 2026-06-25

### Added

- **Guided tours for every tab**: interactive spotlight tours (Guitar, Piano, Karaoke, Analysis, Exercises, Jam, Community, Leaderboard, Challenges), each offered once and re-startable from the sidebar, all listed in the Guide menu.
- **Learn tutorials for every feature**: read-along guides for each tab, with a one-click "Take the interactive tour" jump from a tutorial to its spotlight tour.
- **Clearer mic feedback**: a single, steady hint when we can't hear you or you're too quiet to read — now on Singing, Karaoke, Piano, Guitar and Jam.
- **Karaoke pitch overlay**: optionally draw a red line of your own pitch over the vocal track, and label the notes you sang.
- **Find My Voice**: starts listening as soon as it opens and waits for a steady "Ah" (no Start button to miss); the button in Settings is easier to spot.

### Changed

- **Exercises**: compact, centered card gallery with skill pills; practice suggestions and recent sessions grouped at the top, with a "Get started" nudge for newcomers.

### Fixed

- Score-card button icons are aligned, the Karaoke header shows the song length instead of the session id, and the share link is hidden until cloud song sync ships.

## [0.4.0] - 2026-06-24

### Added

- **Practice Intelligence**: difficulty that adapts to your level on every exercise, targeted drills for your weakest notes, and a trends dashboard with a practice-streak calendar.
- **Pitch accuracy heatmap**: see how cleanly you sang each note, and click a note to jump there.
- **Smoother, faster UI**: loading placeholders for lazy panels and gentle transition animations.
- **Onboarding survey**: a quick, optional survey to help shape the app.
- **Accessibility**: keyboard focus handling, screen-reader labels, larger touch targets, and reduced-motion support.

### Changed

- **Server-authoritative leaderboard**: rankings are now derived from your real practice sessions (tamper-proof), with global, friends, all-time and weekly views.

### Fixed

- Sign-in and password-manager autofill polish, plus a batch of karaoke, lyrics and UI fixes.

## [0.3.0] - 2026-05-11

### Added

- **Karaoke / Stem Mixer**: upload a song, split it into vocal and instrumental stems, and sing along to synced LRC lyrics with A/B looping — plus playlist "set list" mode with per-singer scoring.
- **16 singing exercises** with daily warm-up routines and shareable links.
- **Vocal Analysis & Shazam Sing**: analyze your recorded vocals, and identify songs by singing them.
- **Jam Sessions**: real-time peer-to-peer practice rooms with video, chat and a shared exercise canvas.
- **Cloud accounts & sync**: anonymous-first accounts, upgradeable to email/password or Google, with progress synced across devices.

### Changed

- Moved storage to IndexedDB for reliability and capacity.

## [0.2.0] - 2026-05-09

### Added

- **Piano practice mode** with visual note feedback.
- **Vocal separation (UVR)** to isolate vocals and instrumentals.
- Improved pitch detection and a "What's New" changelog.

## [0.1.0] - 2026-05-03

### Added

- Initial MercuryPitch release: a piano-roll melody editor, real-time pitch detection with accuracy scoring, vocal-technique effects, instrument sounds, shareable preset URLs, dark/light themes, and playback-speed control.
