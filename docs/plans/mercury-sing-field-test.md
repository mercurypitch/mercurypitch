# Mercury Sing — field test protocol

Status: ready to run. Companion to [mercury-sing.md](mercury-sing.md).

The matcher's ceiling and floor are now measured against synthetic audio
(`src/tests/shazam-subsequence-scoring.test.ts`): a flawless excerpt scores
**100%**, a wrong song **~25%**. What nobody has measured is where a REAL
take lands — a real voice, a real room, a real stem. Until that number
exists, the auto-open threshold is a guess (currently 0.80, deliberately
under-committed).

This protocol produces that number. It needs a singer, about twenty
minutes, and no code changes.

## Before you start

1. Open the app (or Karaoke Night) and the browser console.
2. Turn on the matcher's own tracing, once, in the console:
   ```js
   localStorage.setItem('pitchperfect_shazam_debug', 'true')
   ```
   That adds a per-fingerprint score dump. Mercury Sing's own one-line
   summary (`[mercury-sing] t=… | song 87% · other 41% | margin=46 |
arming 60%`) is always on, and is the line that matters most.
3. Have at least **five separated songs** in the library — the matcher only
   ever compares against your own UVR sessions, never the melody library.
   Five is enough for margins to mean something; three is too few to tell a
   confident match from a lonely one.
4. Note the room: headphones or speakers, and whether the backing track is
   audible. A stem playing out loud while you sing is a different test —
   run it separately (case 8).

## What to sing

Each case is one Mercury Sing session: say "what song is this", sing, then
copy every `[mercury-sing]` line out of the console before closing the
stage. Sing for at least 10 seconds — the policy will not open before 6 s
of material, and the matcher wants ~6 notes minimum.

| #   | Case                         | What to sing                                             | What we learn                                                                   |
| --- | ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | **Chorus, in key**           | The chorus of a song in your library, at its own pitch   | The happy path. Sets the ceiling for real singing.                              |
| 2   | **Verse, in key**            | A verse from the same song                               | Verses are lower and flatter — usually the harder half.                         |
| 3   | **Transposed**               | Same chorus, comfortably higher or lower                 | Whether interval and chroma carry it when absolute pitch is off.                |
| 4   | **Humming**                  | Same chorus, hummed, no words                            | The humming path (there is a chroma/pitch reweighting for it).                  |
| 5   | **Wrong song**               | A song you own but sing badly / half-remembered          | How gracefully confidence decays when the singer is the problem.                |
| 6   | **Not in library**           | Something you have NOT separated                         | The false-positive test. Nothing should climb. This is the most important case. |
| 7   | **Two similar songs**        | A phrase two of your songs share (same artist, same key) | Whether the margin rule holds when two candidates are genuinely close.          |
| 8   | **With the backing audible** | Case 1, but with music playing in the room               | Whether bleed inflates or wrecks the match.                                     |

## What to bring back

For each case, the console lines plus one line of context:

```
case 1 (chorus, in key) — "Dance of Death", headphones, sang ~14s
[mercury-sing] t=2.1s notes=7 | Dance of Death 71% · Fear of the Dark 38% | margin=33 | listening | top breakdown p=62 i=70 c=81 r=66 @101.5s
[mercury-sing] t=3.6s notes=12 | Dance of Death 83% · Fear of the Dark 35% | margin=48 | arming 0% | …
...
```

Two things matter more than the rest:

- **The number the right song reaches, and how fast.** That sets the
  threshold. If a correct take tops out at 0.72, then 0.80 is wrong and the
  band never joins in.
- **The number the WRONG songs reach** (cases 6 and 7). That sets the
  margin. If a song you do not own reaches 0.65, the threshold has to sit
  clear of it — or the margin rule has to carry more weight.

Also worth noting, informally: whether the offset (`@101.5s`) was where you
actually were, and whether the wheel showed the right song before the
policy opened it.

## Side quest: the singing-transcript diagnostic

The stage shows a `heard` line — the SPEECH engine's transcript, which is
how commands are heard. Speech models are trained on speech, so a garbled
transcript while singing is expected model behavior, not a bug; the match
runs on melody and never reads the words (until M2b). Two phrases separate
"the model cannot do singing" from "this engine is weak for this voice":

- **Articulated:** "We will, we will rock you" — hard consonants, stomp
  rhythm; as close to speech as singing gets. Engines should catch most.
- **Melisma:** "And I will always love you", the held way — one vowel
  across many notes. Expect garbage from every engine.

Sing each on each engine and note the `heard` text: six samples. A wrong
transcript with the right song climbing is both systems working. The
right words in `heard` with a command NOT firing is a real grammar bug —
bring back the exact text.

## What I will do with it

- Replace `AUTO_OPEN_DEFAULTS.openThreshold` and `minMargin` with numbers
  derived from cases 1–4 versus 6–7, rather than the present placeholder.
- Decide whether `minMaterialMs` (6 s) and `sustainMs` (2 s) are too eager
  or too patient, from how quickly the right song separates.
- If pitch scores are systematically low while chroma is high, look at the
  humming reweighting thresholds — and at the circular-chroma defect noted
  below, which nothing has forced yet.

## Chroma wrap — fixed since this protocol was written

Chroma is a note with its octave thrown away: C is 0, C# is 1 … B is 11.
It is the octave-blind view of a melody, and it is what lets someone
humming an octave below the record still match it.

The scale wraps, but the comparison did not: B and C sit one semitone
apart, and plain subtraction called them eleven apart — the furthest two
notes can be. A singer a semitone off at B/C was charged eleven times what
the identical mistake costs anywhere else in the scale. DTW now takes a
cost function, and chroma passes it the distance the short way round
(`circularDistance12`).

Verified in `src/tests/shazam-chroma-circular.test.ts`, including the
thing that could have gone wrong: a distance capped at six instead of
eleven makes every comparison cheaper, wrong songs included, so the tests
assert SEPARATION between a right and a wrong phrase rather than absolute
scores. Two notes of process, since both nearly produced a false result —
an exact match costs zero either way, so the wrap only shows when singer
and recording differ; and subsequence DTW hides the effect entirely,
because its open end simply realigns the offending note to a cheaper
column. The comparison has to be equal-length with fixed endpoints.

Cases 3 and 4 still tell us whether it helped in practice.
