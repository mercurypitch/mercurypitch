# Changelog

What's new in MercuryPitch, in plain terms. For the full, detailed
engineering history see [`dev-changelog.md`](./dev-changelog.md).

## [0.7.4] - 2026-07-14

### Added

- **Sheet music you can read and write.** Compose, Singing and Piano can now show your melody as standard notation — proper barlines, key signature, measure numbers and beams, with a cursor that follows playback (click a note to jump there). In Compose you can click the staff to add a note or right-click to remove one, and the new Split view shows the piano roll and the live sheet together.
- **Privacy-first consent.** Groundwork for welcoming new singers and understanding what helps them: when ad or analytics measurement is switched on, visitors in the EEA, UK and Switzerland get a slim cookie-consent banner and nothing is measured until they accept — everyone else is unaffected. You can review or change the choice any time from Settings → About → Cookie preferences. As always, your voice recordings never leave your device; this only concerns anonymous measurement.

## [0.7.3] - 2026-07-11

### Added

- **Challenges are real now.** The Practice drill's score counts automatically as a challenge attempt — meet the target on a single run to complete the challenge, earn its badge, and appear on the leaderboard. No more manual "Update Progress".
- **A Basics category for your first win.** Three gentle long-note holds (from a 40% target) open the Challenges tab, and completing your first one grants the new First Victory badge. Every category now has real, drill-backed challenges — 24 in total across 12 categories, with 16 badges.
- **Echo mode for the Arpeggio Jumper.** Choose "Echo the phrase" and the whole arpeggio plays first — then you sing it back from memory, one steady note per beat. Trains your inner ear, not just pitch matching.
- **Exercises feel like a game.** A draining bar shows exactly how long you have to sing, every note lands as Perfect / Great / Close / Missed with its own sound, consecutive good notes build a combo, and each run ends with an S–D grade, a "New best!" moment, and your delta vs the last run.
- **Your level, visible.** Every exercise shows its adaptive difficulty level (Lv 1–10) in the header, and you get a toast when the app levels a drill up or down to match your recent scores.
- **Sing-along tips per challenge.** Each challenge card and its detail view explain exactly which drill runs and what score completes it.
- **Karaoke: import several sessions at once.** Drop multiple ZIP exports (or a whole batch) straight onto the upload view and they land as separate sessions.
- **A new MercuryPitch mark.** The app has a fresh icon — a cosmic "meniscus" pitch-wave — in the browser tab, the installed-app icon and link previews.

### Changed

- **The mirror now walks you in.** An animated "How it works" overview plus short intros before each task explain the flow the first time (also smoother and lighter to render).
- **Cleaner phone layout.** Tidier header, tab bar and karaoke chips; the side drawer closes more predictably and toasts/hints stack without overlapping the transport.

### Fixed

- **Empty practice runs no longer drag your profile to 0%.** Sessions where nothing was scored (play then stop, no singing) used to record 0% scores that pulled your Best Score, Accuracy and Recent Average down on the Community profile. They are no longer recorded.
- **Guided tours cover the new UI again.** The Theme step now spotlights the nine-theme picker, and the two Jam steps found their targets after the styling rework.
- **"Getting started" is back in Settings.** The General-tab section with "Show welcome screen" and "Open Voice Mirror" had been silently dropped during the styling rework — it's restored (and now has its own tour step).

## [0.7.2] - 2026-07-10

### Added

- **Nine colour themes and a visual theme picker.** Open Settings and choose from Dark, Light, Midnight, Forest, Ocean, Cyberpunk, Rose, Amber and Slate — each shown with a live preview swatch, and your pick is remembered.
- **A consistent design system.** Buttons, dropdowns and segmented toggles across the app now share one set of styles, so spacing, colours, focus rings and hover states line up everywhere.

### Changed

- **App-wide styling cleanup.** Component styles were reorganised into per-component modules for a more consistent, maintainable look — no change to day-to-day use.

### Fixed

- **Status and hover colours now resolve in every theme.** Hover backgrounds and success/warning/error accents that previously showed as blank now render correctly across all nine themes.

## [0.7.1] - 2026-07-10

### Added

- **Meet your voice twin.** The Voice Mirror's results card now hides a famous singer whose range overlaps yours — tap the card to reveal them. Two reveal styles to play with: a 3D **flip**, or a **lenticular** blend where the legend shines through your data and the card tilts with your cursor.
- **Fourteen legends, one cosmic style.** Johnny Cash, Barry White, Elvis, Sinatra, Kurt Cobain, David Bowie, Freddie Mercury, Bruce Dickinson, Amy Winehouse, Cher, Adele, Whitney Houston, Mariah Carey and Celine Dion — each drawn as a "liquid mercury" caricature on the mirror's starfield.
- **Your twin on the share card.** Once revealed, the voiceprint you share includes the legend in a gold-ringed portrait medallion next to your voice type.

### Changed

- **Roomier mirror results.** The voiceprint card is bigger (with Accuracy and Steadiness in a compact side rail on wide screens), and the action buttons are tighter with new star-themed icons — one-tap **Copy** and **Open MercuryPitch**.

## [0.7.0] - 2026-07-08

### Added

- **A-B loop controls for Piano and Compose**: you can now set A and B loop markers in the Piano and Compose tabs, not just Singing. The markers appear directly on all note canvases.
- **Draggable piano/compose markers**: easily drag the loop points to refine the repeating section.

### Fixed

- **Piano / Compose playback and looping bugs**: fixed an issue where the piano replayed the entire [A, B] interval at once each lap, and ensured singing pitch trails reset properly.
- **Credit deduction for server separations**: fixed a silent failure where credits were not being deducted for server-side UVR separations due to a stale API domain configuration.

## [0.6.8] - 2026-07-08

### Changed

- **Google sign-in is branded.** Signing in with Google now shows a `mercurypitch.com` address on the consent screen instead of the old `…workers.dev` one.

### Fixed

- **Emails render dark.** The welcome and receipt emails could show up with a white background in light-mode mail apps; they now render in the dark MercuryPitch theme everywhere.

## [0.6.7] - 2026-07-07

### Added

- **Tune by ear.** Tap a string in the guitar tuner to hear its reference note, so you can tune to the sound as well as to the needle.

### Changed

- **The A-B loop is hands-on now (Singing).** Setting **B** starts the loop right away — no separate loop button — and the A and B points appear as draggable markers on the timeline (blue for A, red for B). Drag either one to fine-tune the start or end of the passage without re-tapping.
- **A cleaner welcome screen, with a "What's New" button.** The first-run welcome is more compact and leads with the Voice Mirror, and its version badge opens this changelog any time. The sidebar's Playback Setup controls (key, scale, octave) now start collapsed to keep the panel tidy — click the section header to open them.

### Fixed

- **Switching tracks keeps your place.** Changing which track you practise in an imported MIDI song no longer snaps the timeline back to the start — the 3D guitar and piano keep playing from where you were (the score resets for the new track), and Play / Space resume from the current spot.
- **On-device separations retry cleanly.** Retrying a browser (WebGPU) vocal separation while Cloud mode was selected could fail with a technical error instead of running. It now re-initialises and processes, and any unexpected error shows a readable message.
- **Switching songs on the Singing tab refreshes properly.** Loading a different melody or an imported MIDI now updates the notes and the timeline right away (and starts the new song from the beginning), instead of leaving the previous song on screen when you switched during playback or a loop.
- **Focus mode fits long songs.** The full-screen focus view now scrolls a readable window of notes for long imported songs, instead of squeezing the whole song on screen at once.

## [0.6.6] - 2026-07-07

### Added

- **Loop a tricky section while you practice.** The Singing tab now has A-B loop controls — tap **A**, then **B**, to mark a passage and hit the loop button, and the playhead repeats just that stretch so you can drill it. A shaded band on the timeline shows the loop, and you can still scrub anywhere without it snapping you back to the start.
- **Guitar tuner and riff tracker.** A built-in tuner (needle plus cents readout that auto-detects which string you're playing, with Standard, Drop D, Half Step Down, Open G, and DADGAD presets and a manual per-string mode) and a riff tracker that records what you play, lays it out on a timeline, and scores it against a target melody.
- **Welcome and receipt emails.** You now get a welcome email when you create an account, and a thank-you email after a purchase.

### Fixed

- **Cloud separations survive a reload or app-switch — with no double charge.** A song separating on the cloud GPU could get stuck on "waiting for a GPU worker" if you switched apps or reloaded, and re-running it charged a second credit. The app now reconnects to the in-progress job automatically (no extra credit), keeps the job running across a reload instead of cancelling it, and can re-fetch your finished stems from storage for up to 24 hours if the browser missed them. The waiting message is friendlier, with a "Fetch my stems" button as a backup.

## [0.6.5] - 2026-07-07

### Added

- **Your voice, matched to a legend.** The Voice Mirror results and share card now pair your vocal range with a famous singer whose range overlaps yours — two legends per voice type (tenors get Freddie Mercury or Bruce Dickinson, sopranos get Mariah Carey or Celine Dion, and so on), so it's a fun, varied match rather than a fixed label.

### Changed

- **Voiceprint downloads are dated** — the saved image filename now includes the date (e.g. `voiceprint-2026-07-07.png`), so a folder of them sorts by day and it's easy to track your progress over time.

## [0.6.4] - 2026-07-07

### Fixed

- **Separated stems no longer go missing.** A song separated on the cloud GPU could later show as "processed" but refuse to open in the Stem Mixer after a reload — offering only a retry or a manual re-import. Stems are now saved to your device _before_ a song is marked done, always reopened from that local copy, and never depend on the server's temporary links. The Karaoke list shows honest "Saving…" and "Interrupted" statuses, the app warns before an accidental reload while a separation is still saving, and any sessions whose stems were already lost are tidied up automatically.

### Added

- **Copy image on Voice Mirror cards** — every result card now has a "Copy image" button next to Share. The "Sing the Universe" cosmic mode is also directly linkable.

### Changed

- **Gentler Voice Mirror "Match" step** — a warmer, piano-like reference tone plus a short "your turn" count-in before you sing, so the notes no longer come at you with no time to prepare.

## [0.6.3] - 2026-07-06

### Fixed

- **Link previews** now show the MercuryPitch card when you share the site — the social/Open Graph preview image the page pointed to was missing, so shared links had no picture.

## [0.6.2] - 2026-07-06

### Added

- **Terms, Privacy, and a Website link in Settings** — quick links to our Terms of Use, Privacy Notice, and the mercurypitch.com website now live in Settings → About (plus a Website link in the header). The vocal-separation upload box shows a short "only upload audio you have the rights to" note, and first-run setup notes that continuing means you accept the Terms and Privacy Notice.

### Changed

- **New logo** — a gradient "Pitch-orb" mark replaces the old icon across the app: the browser tab, the installed-app / home-screen icon, and the About page.

## [0.6.1] - 2026-07-06

### Changed

- **Server separation got a serious quality upgrade**: cloud GPU processing now runs BS-RoFormer, a studio-grade separation model — vocals come out dramatically cleaner, especially on songs that used to bleed instruments into the vocal track. Still 1 credit per song, and it finishes in about half a minute.
- **Pick your processing on the Credits page**: the On-device and Server (GPU) cards under **Settings → Credits** are now clickable — choose where your songs get separated and the Karaoke page follows along (and vice versa). The Server (GPU) option proudly wears an **HQ** mark.
- The processing progress bar now tracks the real separation speed instead of finishing early and waiting.

### Fixed

- Very short clips (under ~12 seconds) get a clear "audio is too short" message instead of a cryptic server error.
- Server processing errors now show a readable message instead of raw technical output.

## [0.6.0] - 2026-07-05

### Added

- **Karaoke server-side processing is here**: flip the Karaoke processing toggle to **Server** and your song is separated on a cloud GPU in roughly half a minute — no more waiting on your device. Stems come back named after your song, save to this device automatically, and play in the stem mixer like always. Songs up to 50 MB and about 12 minutes are supported; a failed or cancelled job automatically refunds its credit.
- **Credits**: server processing costs 1 credit per song. Buy credit packs (€5 / €10 / €20 / €40) through Stripe's secure checkout under **Settings → Credits** — your balance shows right there, credits never expire, and after checkout you land back on the Credits page with a confirmation. Everything that runs on your device stays free forever.
- **Deep links to Settings tabs**: `#/settings/account`, `#/settings/credits`, `#/settings/practice` and `#/settings/display` open the exact tab — and messages like "Not enough credits" now carry a button that takes you straight there.
- **Unified song bar on Singing, Piano & Guitar**: one sleek top bar with the song name, a seek timeline, a compact track list, and Import MIDI. Drop a MIDI (or Guitar Pro) file anywhere on the canvas to load it, and pick which track to play or sing against.
- **Fuller playback for real songs**: notes sustain their full length, and large multi-track imports stay smooth.

### Fixed

- Leaving a practice tab now stops its playback and mic instead of running on invisibly.
- The header version pill opens the changelog, and the karaoke drop zone highlights correctly while you drag a file over it.

## [0.5.3] - 2026-07-02

### Added

- **Voice Mirror** (`/mirror`): a free 60-second voice snapshot — sing three short tasks and get your range, pitch accuracy and steadiness as a shareable card.
- **Just sing**: a no-targets mode that maps your range, home note, phrasing and vibrato.
- **Sing the Universe**: short melodies built from real cosmic data, fitted to your range.
- **Vibrato-aware scoring**: vibrato is named, not counted as unsteadiness.
- Welcome-screen "Mirror your voice" shortcut.

### Changed

- Renumbered the previous release from 0.6.0 to 0.5.2.

## [0.5.2] - 2026-07-01

### Added

- **Cleaner recorded melodies**: Compose recording auto-removes octave jumps and stray notes.
- **Live pitch while recording**: your voice draws onto the piano roll in real time.
- **Unlimited recording length**, plus an "As sung ↔ Clean" slider to tidy a take before keeping it.
- **One-step undo** for recording over an existing melody.
- **Karaoke vocal cleanup + editing**: clean, retune and edit the detected vocal line; edits save separately and survive reload.
- **Automatic key detection**, per-song and per-section.
- **Hear the detected melody** as a soft synth during playback.

### Fixed

- Shared melodies no longer break the guitar sound.
- Vocal-pitch note labels line up with their rows.

## [0.5.1] - 2026-07-01

### Added

- **Live pitch marker**: tracks your voice the moment the mic hears you, not just during playback.
- **Cleaner phone layout**: the accuracy/session/pitch cards hide by default on small screens, with a toggle to restore them.
- **Keyboard tour controls** (arrows/Enter/Esc), continue-to-next-section, and deeper Effects/Settings tours with new "Learn" articles.

### Changed

- Tours adapt to screen size and let you jump between steps.

### Fixed

- Leaving Singing/Compose now stops the mic.
- The mic icon no longer collapses on a tight control bar.

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
