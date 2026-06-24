# Guitar Practice — Feature Roadmap

Research-based analysis of guitar learning pain points and planned MercuryPitch features. Compiled 2026-05-31.

---

## The 5 Hardest Things About Learning Guitar

### 1. Fretboard Memorization
The guitar has no visual symmetry (unlike piano). The same note appears in 3-5 different positions. Most players memorize movable "box" shapes without learning which notes they're actually playing. The B-string tuning break destroys pattern logic.

### 2. Ear-to-Fretboard Gap
The #1 cited struggle across all skill levels. Players can hear a melody in their head, even sing it — but freeze when locating it on the neck. Existing apps treat ear training and fretboard practice as entirely separate skills.

### 3. Position Lock-in (CAGED Islands)
Intermediate players memorize 5 CAGED positions but treat them as isolated islands. They can't fluidly move between positions during a solo. The shapes become prisons.

### 4. Transcription is Painfully Slow
Full-speed transcription is the single most recommended skill builder — and the most abandoned. Even with AI stem separation, players hit a wall where they can hear the note but can't find it on the neck quickly enough.

### 5. Scale Knowledge Doesn't Become Music
Knowing 5 scale patterns doesn't mean you can improvise. Players collect scales but can't phrase melodically, target chord tones, or leave intentional space. Existing apps show static scale diagrams — none help make actual music.

---

## Feature Tiers

### Tier 1 — Right Now (low effort, high impact)

| # | Feature | Solves | How It Works |
|---|---------|--------|--------------|
| 1 | **Chord Tone Highlighter** | #5 Scales → Music | Root/3rd/5th/7th of the current chord get distinct colors on the fretboard vs. passing scale tones. Shows "safe landing notes." |
| 2 | **Note Locator Quiz** | #1 Fretboard | "Find every C# on the neck" — timed drill, click frets, score on speed + completeness. |
| 3 | **Hear It, Find It** | #2 Ear-to-Fretboard | App plays a note, you find it on the fretboard. Starts with 3 frets, scales to full neck. No note name shown. |
| 4 | **Jam Mode** | #5 Improvisation | Drum machine + looping chord progression. Fretboard shows scale + chord tones. Free improvisation. |

### Tier 2 — Next (medium effort, higher impact)

| # | Feature | Solves | How It Works |
|---|---------|--------|--------------|
| 5 | **Melody Transcription Mode** | #4 Transcription | App plays a short mystery phrase (2-5 notes), player reproduces on fretboard. No note names. Accuracy scoring. |
| 6 | **Phrase Call & Response** | #5 Improv + #2 Ear | App plays a phrase, player echoes it. App plays variation, player responds. Musical conversation. |
| 7 | **CAGED Position Trainer** | #3 Position Lock | Highlight one CAGED position, constrain view. Play through chord changes within that box. Shift positions smoothly. |
| 8 | **Chord Progression Mode** | #5 Chord Connection | Pick I-IV-V or ii-V-I in a key. Drum machine plays it. Fretboard updates chord tones in real time per chord. |

### Tier 3 — Advanced (builds on everything above)

| # | Feature | Solves | How It Works |
|---|---------|--------|--------------|
| 9 | **Sing-to-Fretboard** | #2 Ear Gap | Use existing pitch detection — sing a note, find it on the fretboard. Closes voice→ear→hand loop. |
| 10 | **Transcription Trainer** | #4 Transcription | Load a real song snippet. App slows it down, helps hunt note-by-note on the fretboard. Progress tracking. |
| 11 | **Adaptive Jam** | #5 Improv | Backing track that changes chords based on what you play. Simulates real jam session unpredictability. |

---

## Sources

- Guitar forums and Reddit r/guitarlessons, r/musictheory (2024-2025)
- Fretboard memorization techniques: CAGED system, octave method, single-string chromatic walks
- Ear training research: Functional Ear Trainer app, sing-then-play methodology
- Transcription tools: Moises AI, Transcribe!, Amazing Slow Downer
- Existing apps: Yousician, Fender Play, Fretastic, Tenuto, iReal Pro
