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

- [ ] Local utterance engine behind `VoiceListener`: MicManager capture, RMS/VAD gate, 1-2 s utterance buffer into the existing whisper-tiny worker; target under 300 ms from end-of-phrase to action, works offline
- [ ] Evaluate Moonshine tiny as the alternative local model (streaming-oriented, lower latency floor)
- [ ] Eager interim matching: execute when an interim transcript exactly equals a command and is stable ~150 ms, with a cooldown so the final result cannot double-fire
- [ ] Engine picker in Settings (Web Speech vs local) with a latency readout in the HUD
- [ ] Optional wake-word-required mode while music is playing (echo hardening without headphones)
- [ ] Confidence threshold when the engine reports one

---

## Phase 3 — command integration (approve items, shipped in slices)

### Seeking additions

- [ ] **(requested)** Absolute seek / skip the intro: `go to N seconds`, `go to N minutes`, `start at N seconds`, `skip the first N seconds`
- [ ] Minutes unit for relative seek: `back two minutes`, `forward one minute`
- [ ] `go to the middle`, `go to the end`

### Tempo and speed additions

- [ ] **(requested)** `set tempo to N` / `tempo N` — bpm store (clamped 40-280), for melodies and exercises
- [ ] **(requested)** Multiplier phrasing for songs: `speed one point two x`, `1.5 x`
- [ ] **(requested)** `reduce tempo` / `increase tempo` (and `tempo down N`) — bpm steps, distinct from playback-speed steps
- [ ] `count in on` / `count in off` / `count in N bars` (transport store already has it)

### Karaoke / StemMixer adapter **(requested)**

The StemMixer registers its own command set on mount (the registry seam is
ready); global transport commands stop being "unavailable" there and become
the mixer's own.

- [ ] Transport inside karaoke: `play`, `pause`, `stop`, `from the top`, seek
- [ ] **(requested)** `mute <stem>` / `unmute <stem>` — drums, bass, vocals, guitar, piano, other (stem names resolved from the loaded session)
- [ ] **(requested)** `solo <stem>` / `unsolo <stem>` / `everything on`
- [ ] `<stem> up` / `<stem> down` / `<stem> volume N percent`
- [ ] **(requested)** Role presets: `i play guitar` — guitar stem muted, everything else on; `i sing` — vocals muted, instrumental on; `i play piano`, `i play bass`, `full mix`. Reports when the session has no such stem
- [ ] **(requested)** `play random song from my list` — random pick from the karaoke playlist / session library
- [ ] `next song` / `previous song` (karaoke playlist transport)
- [ ] `sing that again` — restart current playlist entry

### Navigation **(requested)**

- [ ] **(requested)** `go to <tab>`: karaoke, singing, piano, guitar, exercises, home, settings, jam, analysis (visible tabs only; `setActiveTab` is the primitive)
- [ ] **(requested)** `open karaoke night` (standalone stage entry)
- [ ] `start my routine` / `today's session` (daily routine launcher)
- [ ] `open library` / `close library`, `close this` for modals

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

- [ ] `what can i say` / `voice help` — overlay listing the live commands for the current view (generated from the registry, so it can never go stale)

---

## Grammar and infrastructure needed along the way

- [x] Reactive per-surface command registration (registry seam)
- [x] Typed failure results with user-facing messages
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
