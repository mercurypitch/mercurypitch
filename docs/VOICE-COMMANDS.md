# Voice commands — catalog and roadmap

The single source of truth for what you can say to MercuryPitch, and what is
planned. Architecture lives in [docs/plans/voice-control.md](plans/voice-control.md).

**How this doc works:** `[x]` is shipped and documented; `[ ]` is proposed and
waits for the owner's approval. To green-light work, name the items (or tick
them in a comment/PR note); each implementation slice checks its boxes in the
same commit that ships it. Items marked **(requested)** came from the owner;
the rest are suggestions.

**Phase order (owner-confirmed):** finish phase 1 polish, then run the
phase 2 "really fast" latency pass, then phase 3 command integration in
approved slices.

## Using it today

Chrome, Edge or Safari. Click the mic pill (bottom-left) or press `V`, allow
the microphone, speak. Commands are strict: the whole utterance must be the
command ("play" fires; "can you play" does not), which is what keeps
backing-track lyrics from driving the transport. "Hey mercury ..." and
"... please" are allowed but never required. Feedback: the pill shows what
was heard and what happened; a toast appears when a command fails, is not
available on the current view, or a short command-like utterance was not
recognized (throttled so singing cannot flood the screen).

---

## Phase 1 — shipped

### Transport (Singing, Piano game, Compose editor, Guitar toggle)

- [x] `play` / `start` / `go` / `begin` / `resume` / `continue` — play, or resume when paused
- [x] `pause` / `hold` / `hold on` / `wait`
- [x] `stop` / `finish` / `stop playback`
- [x] `again` / `restart` / `from the top` / `from the beginning` / `start over` / `one more time` — seek to start and play
- [x] `go to the start` / `beginning` / `rewind` — seek to start, keep state

### Seeking (Singing, Compose, Piano)

- [x] `forward N seconds` / `skip N seconds` / `ahead N seconds` — bpm-converted relative seek
- [x] `back N seconds` / `go back N seconds` / `rewind N seconds`
- [x] `forward N beats` / `back N beats`
- [x] Numbers as digits or words: `ten`, `twenty five`, `one hundred fifty`

### Speed

- [x] `faster` / `slower` — same ladder as the arrow keys (0.25 to 2.0)
- [x] `half speed` / `quarter speed` / `three quarter speed` / `normal speed` / `full speed` / `double speed`
- [x] `speed N percent` / `N percent speed` — clamped 25-200

### A-B loop (Singing, Compose, Piano)

- [x] `set a` / `loop start` / `mark a` — loop point A at the playhead
- [x] `set b` / `loop end` / `mark b` — loop point B, arms the loop (`set be`/`set bee` mistranscriptions handled)
- [x] `loop` / `toggle loop`
- [x] `loop on` (refuses without A and B), `loop off` / `stop looping`
- [x] `clear loop` / `remove loop` / `reset loop`

### Play modes

- [x] `repeat mode`, `practice mode` / `session mode`, `normal mode` / `play once`

### Feedback and failure modes

- [x] HUD pill: listening state, live interim text, "heard, did" confirmation
- [x] Failed commands toast why nothing happened (`Nothing playing`, `Set A and B first`, ...)
- [x] Phrase known but gated on this view toasts `... is not available on this view`
- [x] Short unrecognized utterances toast `no command matches "..."`, throttled; long ambient speech stays HUD-only
- [x] Mic permission denied: toast + pill error state, flag turns off

---

## Phase 2 — the "really fast" pass (next up)

Latency and robustness before more commands; the grammar and adapters do not
change, only the ear.

- [x] Local utterance engine behind `VoiceListener`: MicManager capture (with mic-sentinel registration), adaptive RMS gate with pre-roll, 0.2-3.6 s utterances into a dedicated no-timestamps whisper-tiny worker (same cached weights as karaoke transcription, warm-up at load), WebGPU with WASM fallback
- [ ] Moonshine verdict: selectable in Settings as "On-device (Moonshine, experimental)" — measure latency and accuracy against Whisper on real hardware, then pick the on-device default
- [x] Eager interim matching (browser engine): an interim that resolves to a command and stays stable ~150 ms executes immediately; the confirming final is suppressed so it cannot double-fire, and a phrase that is a prefix of a longer one ("go" on its way to "go to karaoke", "loop" to "loop off") always waits for the final
- [x] Engine picker in Settings (Browser vs On-device) with a speech-to-text latency readout in the pill
- [x] Optional wake-word-required mode while music is playing ("Mercury, from the top"); wakeless speech is then ignored silently — no toasts, no HUD noise
- [x] Confidence threshold on browser-engine finals (real low estimates are dropped; Chrome's "no estimate" zero is not treated as low)

---

## Phase 3 — command integration (approve items, shipped in slices)

### Seeking additions

- [x] **(requested)** Absolute seek / skip the intro: `go to N seconds`, `go to N minutes`, `go to minute N`, `start at N seconds`, `jump to N seconds`, `skip the first N seconds/minutes`, bare `go to N` (seconds)
- [x] Minutes unit for relative seek: `back two minutes`, `forward one minute`, `rewind N minutes`; `forwards`/`backwards` adverb forms accepted
- [x] `go to the middle` / `halfway`, `go to the end` (lands 2 s short so track-end handling wins); both report `Nothing loaded` when no song is up
- [x] **(requested)** `loop from N to M seconds` / `play a loop from N to M` — places A and B by time, arms the loop, seeks to A and starts playing (on Piano it sets the loop and seeks, leaving the game start to you)

### Tempo and speed additions

- [x] **(requested)** `set tempo to N` / `tempo N` / `N bpm` — bpm store (clamped 40-280), for melodies and exercises
- [x] **(requested)** Multiplier phrasing for songs: `speed one point two x`, `1.5 x` — the explicit x/times form is always a multiplier, never reinterpreted as percent
- [x] **(requested)** `reduce tempo` / `increase tempo` / `tempo down N` — 10 bpm nudges by default, distinct from playback-speed steps
- [x] `count in` / `count in off` / `count in N bars` — N limited to the store's 1, 2 or 4; anything else reports the legal values

### Karaoke / StemMixer adapter **(requested)**

The StemMixer registers its own command set for its mount lifetime, gated to
the Karaoke tab; the phrases follow the stems actually loaded in the mix.
The mixer transport runs on seconds (audio time), not beats.

- [x] Transport inside karaoke: `play`, `pause`, `stop`, `from the top`, relative and absolute seek, `middle`, `the end`
- [x] **(requested)** `mute <stem>` / `unmute <stem>` / `<stem> off` / `<stem> on` — vocals, instrumental/backing, drums, bass, guitar, piano/keys, other; a stem the mix lacks answers `No <stem> stem in this mix`
- [x] **(requested)** `solo <stem>` / `only <stem>` / `unsolo <stem>` / `solo off`
- [x] `<stem> up` / `<stem> down` (10% nudges) / `<stem> volume N percent`
- [x] **(requested)** Role presets: `i sing` (vocals muted, rest on), `i play guitar` / `bass` / `piano` / `drums`, `full mix` / `everything on`; solos cleared, the MIDI guide untouched, missing stems reported
- [x] **(requested)** `play random song from my list` / `random song` / `surprise me` — random jump within the running playlist queue (new `jumpTo` in the playlist store)
- [x] `next song` / `previous song` — playlist transport, `No playlist running` otherwise
- [x] `sing that again` / `sing it again` — restart the current song
- [x] Mixer A-B loop and speed by voice: `set a` / `set b` at the playhead, `loop on/off`, `clear loop`, `loop from N to M seconds`, `faster` / `slower` / presets / `N percent` / `N x` — all in the mixer's own seconds-domain loop and rate (clamped 0.25-2x)
- [x] `microphone on/off` / `toggle mic` — the M key's action, in the global set

### Navigation **(requested)**

- [x] **(requested)** `go to <tab>` / `open <tab>` / `switch to <tab>`: home, singing, karaoke, piano, guitar, exercises/drills, compose, path, jam, analysis, challenges, community, leaderboard, settings — visible tabs only (scope and simple-mode rules respected; hidden tabs answer "not available")
- [x] `open library` / `close library`
- [x] **(requested)** `open karaoke night` / `karaoke night` — leaves for the standalone stage in the same tab (owner's call); `go to karaoke` keeps meaning the in-app tab
- [x] **(requested)** Global `play random song from my list` / `play a song` / `surprise me` — from anywhere: opens a random SONG from the library (completed separations — no playlist required) straight in its mixer, announcing its name; falls back to a random playlist song for playlist-organized libraries, and stands down while a playlist is running (the in-mixer version owns that case)
- [ ] `start my routine` / `today's session` (daily routine launcher — needs a clean launch seam out of HomePage)
- [ ] `close this` for whichever modal is topmost (reuse the Escape dismiss chain)

### Piano adapter

- [ ] Piano-specific options by voice (an audit of falling-notes settings decides the list: cycles, wait-for-note if present, hand focus)
- [ ] `slower here` — auto speed-down inside the active loop region

### Guitar adapter

- [ ] `drums on` / `drums off` (interactive fretboard drum loop)
- [ ] Restart/seek once the guitar transport exposes them (voice currently reports `Not on this tab yet`)
- [ ] `switch to tab view` / `switch to 3d view` / `interactive view`

### Exercises and sessions

- [ ] `start exercise` / `stop` / `try again` in the exercise shell (shell registers its set, like Space handling)
- [ ] `next exercise` / `skip this one` in a practice session (session sequencer)

### Mic and recording

- [ ] `microphone on` / `microphone off` (the M shortcut; does not affect voice control's own listener)
- [ ] `record` / `stop recording` (recording controller)

### Voice help

- [x] `what can i say` / `voice help` / `voice commands` — overlay listing the live commands for the current view, generated from the registry so it can never go stale; Escape or a click closes it

---

## Grammar and infrastructure needed along the way

- [x] Reactive per-surface command registration (registry seam)
- [x] Typed failure results with user-facing messages
- [x] Salvage matching: a changed mind mid-utterance ("backwards... forwards 60 seconds", "guitar, i play guitar") drops up to two leading tokens; what remains must be at least two tokens, so single-word commands stay exact and lyrics stay inert
- [x] Two numeric slots per phrase (`loop from N to M seconds`)
- [x] Tense and homophone tolerance where it bites: `i played drums`, `bass` heard as `base`/`base guitar`/`based guitar`
- [ ] `<name>` free-text slot with fuzzy matching against dynamic lists (song titles, stem names) — unlocks `play <song>`, `mute <stem>` with odd stem labels
- [ ] Careful number homophones inside `<n>` slots only (`for` as 4, `to` as 2) — opt-in per phrase, never global
- [ ] Localized grammars (the listener already takes a lang; phrases need translation tables)

## Later / ambitious

- [ ] Section navigation from synced lyrics: `go to the chorus`, `second verse`
- [ ] `practice my weak spots` — jump to the practice-intelligence weakness report's suggestion
- [ ] `load <song name>` / `sing <song name>` from the library by fuzzy name
- [ ] Spoken/earcon confirmations as an option for fully eyes-free use
- [ ] Per-command custom synonyms in Settings
- [ ] Jam rooms: voice transport gated by the room's transport rules
