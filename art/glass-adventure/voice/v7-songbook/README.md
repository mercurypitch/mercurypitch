# Merc songbook v7

Six original lyric ideas for Glassworks and BesideCue. This batch explores a
musical performance in the owner-selected Merc D2 voice, rather than relying on
a text-to-speech singing instruction to produce a known score.

| Phrase                     | Intended use                        | Initial authored offsets |
| -------------------------- | ----------------------------------- | ------------------------ |
| Let it shine               | First light                         | 0, 2, 0                  |
| Tiny sparks can glow       | Sunlit steps                        | 0, 2, 4, 2, 0            |
| Another beautiful mess     | Gallery finale                      | 0, 2, 4, 7, 4, 2, 0      |
| Little light, lead me home | A winding lantern path              | 0, 2, 4, 7, 4, 0         |
| Let the quiet garden sing  | Glass flowers and thawing fountains | 0, 2, 4, 2, 5, 4, 0      |
| Beside you, I find my tune | A friendly gallery duet             | 0, 2, 4, 7, 4, 2, 0      |

## Production and acceptance

`phrase-plan.json` preserves the original lyrics and musical direction. Note
names in a generation prompt are a request, not evidence of the resulting pitch.
Music v2.5 generated the guide performances. Voice Changer converted performances
into the selected character voice. Direct Eleven v3 takes with a singing tag are
retained as a comparison experiment in the private archive.

Initial uncorrected Voice Changer takes altered the notes substantially. All
three existing score-guide conversions failed the production detector/judge at
24, 44.1 and 48 kHz. They were rejected as lesson replacements. No lesson identity,
melody shape, target range or scoring tolerance is changed to accommodate a take.

Creative sketches and scored reference examples have separate acceptance gates:
a creative sketch can audition a new feeling; an instructional reference must
match the actual compiled contour and pass the production detector. Automated
transcription and pitch checks do not establish pleasantness, lyric stress or
character appeal; owner listening is the perceptual acceptance step.

## Delivered audition

The listening room delivers six source singers and six Merc takes (1,846,085
bytes total, loaded one at a time). The Merc takes use the converted spectral
character with WORLD source-pitch restoration. This is a produced/resynthesized
performance, not untouched ElevenLabs singing. The source-direct candidate has
lower median pitch deviation than the alternative residual-contour candidate
for all six phrases. Every delivered lyric matches an unprompted decoded-file
transcription, including “Beside you, I find my tune.”

`delivery-proof.json` binds the selected source, converted performance and shipped
MP3 hashes to the lyric and pitch evidence. Pitch tails include unvoiced/transition
errors, so median errors alone are not a claim of perfect naturalness. The owner
can compare **Merc sings** and **Guide singer** in the app. All three attempted
converted score guides also failed lyric clarity after pitch restoration; the
existing v6 scored catalogue is therefore preserved in full.

## Storage

Runtime MP3 derivatives and their hashes are in
`apps/beside-cue/public/games/adventure-voice-v7`. Raw provider files, full request
receipts, PCM/WAV masters, rejected comparisons and analysis are in the private
creative archive at `glass-adventure/voice/v7-sung-merc`. No resolved API credential
is saved in either location. Every paid request is reserved before submission;
uncertain attempts are inspected rather than automatically resubmitted.

The in-app listening room is reached from **Games → Merc’s little songbook**.
The standalone development route is `/glass-game/?lab=songbook`. Audio loads only
on a gesture, the previous take stops before a new one starts, and backgrounding
or leaving the page cancels pending loads and playback. Scored lesson examples
continue to use their independently verified catalogue unless a replacement
passes that catalogue's full acceptance gate.

## API references

- [Music composition](https://elevenlabs.io/docs/api-reference/music/compose)
- [Composition plans](https://elevenlabs.io/docs/eleven-api/guides/how-to/music/composition-plans)
- [Voice conversion](https://elevenlabs.io/docs/api-reference/speech-to-speech/convert)
- [Speech generation practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
