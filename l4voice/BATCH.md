# Lesson 4 final voices: the batch, ready for the owner's yes

Nothing here has been generated. The owner was asked at 01:01Z on 29 October ("Can I generate
them once the script passes its review?"); no answer yet. Never repeat a generation to retry.

| Host | Voice | ID | Workspace | Lines | Characters |
| --- | --- | --- | --- | --- | --- |
| Tavi (orange) | Orange Merc | `p2JfZCXWY245UrEylK7q` | `73756a1b8757410ebfcf9f46365fe3a5` | 14 | 941 |
| Merc (blue) | Merc V1 Gentle Whimsical D2 | `B4fBPRmasEsTgd6YlSok` | `59db91953c0c4f45b2e93edd92d86ad9` | 55 | 3626 |

Eleven v3 costs about one credit a character: 4567 characters, so about 4600 credits at one
take a line (as Lessons 1 and 2), or about 9100 at the connector's default of two takes.
Lessons 1 and 2 spent 6,743 (README § Spend so far).

## Procedure

1. The owner switches the connector to Tavi's workspace; generate her lines; then to Merc's.
2. Each call: `creative_generate_speech`, the voice's ID, model `eleven_v3`, the prompt exactly the
   line's `text` (ledger_sync.py asserts it), context naming `Lesson 4 line <id>`, the settings the
   voice-lines document gives. Poll the flow run; never re-send a call.
3. `python3 ledger_sync.py <transcript>`, then `fetch.py` within two hours (download links expire),
   `asr.py takes` under the ASR environment, listen to anything it flags.
4. `import.py ../lesson-04 takes` under the TTS environment, then in lesson-04: `cues.py --no-tts`,
   `mix.py`, `gen-root.py`, `merc-shots.py` and the passes, `merc-tags.py`, `captions.py`,
   `chapters.py`, `script-md.py`, `board-clock.py`, and `clock-lint.py` on every built scene.

## Tavi

| Line | Characters | Text |
| --- | --- | --- |
| o1 | 62 | It just hangs there, waiting. Is that because we started on C? |
| o2 | 127 | So home moved with the start. Then why does doh ray mee sound finished when it lands on doh, and restless when it stops on tee? |
| o3 | 76 | Twelve semitones in seven steps? Then some steps must be bigger than others? |
| o4 | 63 | And with no black key in between, like E to F, it's a semitone? |
| o5 | 59 | The short steps look scattered. Is there a pattern to them? |
| o6 | 60 | That's twelve. Is that why it ends on C again, an octave up? |
| o7 | 66 | Same white keys, just starting on D. Surely that's the same scale? |
| o8 | 62 | So a major scale isn't a set of keys at all. It's the pattern? |
| o9 | 58 | In the opening, doh moved up to D. But isn't doh always C? |
| o10 | 33 | But why is doh home, and not tee? |
| o11 | 107 | So it sounds finished on doh because we've learned that doh is home, and tee stops one short step under it? |
| o12 | 60 | So on tee, I just wait, and listen for where it wants to go? |
| o13 | 57 | And in a major scale that starts on G, which note is doh? |
| o14 | 51 | If that doesn't mean pushing, what keeps it steady? |

## Merc

| Line | Characters | Text |
| --- | --- | --- |
| b1 | 43 | Start on D, and listen. Will it still hang? |
| b2 | 33 | Still waiting. Now the last step. |
| b3 | 124 | By the end, you'll build a major scale from its steps, start it on any note, name its notes, and hear tee lean towards home. |
| b4 | 60 | First, one from Lesson 2. How many semitones make an octave? |
| b5 | 51 | Twelve. Seven letters, and five notes between them. |
| b6 | 57 | But a major scale climbs that octave in just seven steps. |
| b7 | 19 | Let's measure them. |
| b8 | 66 | Here's that doh ray mee, from C, on the white keys: a major scale. |
| b9 | 80 | Now measure each step, as in Lesson 2. With a black key in between, it's a tone. |
| b10 | 35 | Yes. Watch each step as you listen. |
| b11 | 49 | Tone, tone, semitone. Tone, tone, tone, semitone. |
| b12 | 66 | The steps aren't equal. The two short ones are E to F, and B to C. |
| b13 | 48 | Split the scale in two, and listen to each half. |
| b14 | 79 | Both halves climb the same way: tone, tone, semitone. One more tone joins them. |
| b15 | 61 | Now count it in semitones. Two, two, one. Two. Two, two, one. |
| b16 | 65 | Exactly. Seven steps that add up to twelve semitones: one octave. |
| b17 | 74 | Predict: the white keys from D, up to the next D. Is it still doh ray mee? |
| b18 | 29 | First, the white keys from D. |
| b19 | 30 | Now the major pattern, from D. |
| b20 | 82 | It changes. The white keys climb tone, semitone, tone, tone, tone, semitone, tone. |
| b21 | 98 | The short steps fall in different places, and the third and seventh notes come out a semitone low. |
| b22 | 106 | Keeping the pattern takes two black keys: F sharp and C sharp. That's D major, named after its first note. |
| b23 | 77 | Yes. Start the pattern on any of the twelve notes, and you get a major scale. |
| b24 | 55 | The shape never changes. Only the keys under it change. |
| b25 | 100 | Every start except C needs at least one black key. C is just the one that fits the white keys alone. |
| b26 | 71 | Now, names for the stairs. A scale's first note is its tonic: its home. |
| b27 | 110 | Musicians number the notes up from home, one to seven: the scale degrees. And they sing them with these names. |
| b28 | 49 | Doh, ray, mee, fah, soh, lah, tee, and doh again. |
| b29 | 108 | In one system, called fixed doh, it is. We'll use movable doh: the names belong to the stairs, not the keys. |
| b30 | 51 | Slide to D, and doh is D, ray is E, mee is F sharp. |
| b31 | 39 | Home moves, and the names move with it. |
| b32 | 123 | Back to the opening question. Tee is the seventh note, and it sits just a semitone below doh: the last step is a short one. |
| b33 | 35 | Listen: up to tee from C, and stop. |
| b34 | 65 | Most listeners hear it waiting for one more note. Take that step. |
| b35 | 113 | In one experiment, listeners heard a C major scale, then one more note, and rated how well it finished the scale. |
| b36 | 184 | The top rating went to doh. Later studies found the same kind of order in listeners without training too, only weaker. So that sense of home seems to be learned, just by hearing music. |
| b37 | 101 | That's how it seems. Tee is called the leading note, because it's thought of as leading to the tonic. |
| b38 | 72 | It leads wherever home is. From D, tee is C sharp, and it leans up to D. |
| b39 | 57 | Let's sing it. Listen first: up to tee, a wait, and home. |
| b40 | 26 | Yes. Try it, an octave up. |
| b41 | 57 | Now you. Sore, hoarse or unwell today? Just listen along. |
| b42 | 105 | Otherwise, sing on doh, ray, mee, or on ooh, at about speaking volume. Start on my note, or an octave up. |
| b43 | 45 | Wait on tee, and notice where it wants to go. |
| b44 | 49 | Stop immediately if anything feels uncomfortable. |
| b45 | 12 | Quick check. |
| b46 | 42 | What pattern of steps makes a major scale? |
| b47 | 79 | Tone, tone, semitone, tone, tone, tone, semitone. Two groups, joined by a tone. |
| b48 | 60 | Start a major scale on D. Which two black keys does it need? |
| b49 | 20 | F sharp and C sharp. |
| b50 | 42 | From tee up to doh: a tone, or a semitone? |
| b51 | 73 | A semitone. Tee sits just under home, and most listeners hear it lean up. |
| b52 | 50 | G. Doh is wherever a major scale starts: its home. |
| b53 | 149 | In MercuryPitch's Scale Runner, sing a major scale back, one note at a time. Set your voice range in Settings first, and sing in the octave it plays. |
| b54 | 10 | Next time. |
| b55 | 42 | Singers are told to "support" a long note. |

