# Merc sing-back phrases — creative follow-up

The owner tested the configurable melody tracker on Android and reported that
it works. Production v6 now selects three optional Merc phrases: “Let it shine”
for First arc, “Tiny sparks can glow” for Sunlit steps and “Another beautiful
mess” for Gallery arch. The carrier-free source, delivered bank and automated
receipts live in
[`voice/v6-melody-phrases`](../voice/v6-melody-phrases/README.md).

The bank is implemented and mechanically verified. Owner listening and real
sing-back acceptance remain pending, so these phrases stay optional and do not
gate gallery completion.

## Selected production set

| Phrase                 | Melody       | Notes | Production status                          |
| ---------------------- | ------------ | ----: | ------------------------------------------ |
| Let it shine           | First arc    |     3 | 39 exact key/pace variants shipped         |
| Tiny sparks can glow   | Sunlit steps |     5 | 39 exact key/pace variants shipped         |
| Another beautiful mess | Gallery arch |     7 | 10 exact key/pace variants; guide fallback |

## First audition set — historical shortlist

Scale degrees below use a major scale relative to the player's comfortable tonic.
Rhythm and glide duration remain data, not hard-coded judge behavior. Each phrase
should have a plainly sung reference and a playful Merc performance for comparison.

| Phrase                 | Degrees             | Initial rhythm                                     | Purpose                                        |
| ---------------------- | ------------------- | -------------------------------------------------- | ---------------------------------------------- |
| Let it shine           | 1, 2, 3             | Two short notes, one longer finish                 | First three-note sing-back; small rising steps |
| A little sparkle       | 1, 2, 3, 2, 1       | Five syllables, gentle final hold                  | A short arch with a clear return home          |
| Another beautiful mess | 1, 2, 3, 5, 3, 2, 1 | Seven syllables; room to breathe before the phrase | Branded finale after easier melody practice    |

“A little sparkle” was not selected. “Tiny sparks can glow” replaced it for the
five-note phrase because its word stress better supports the authored Sunlit
steps peak while keeping the same concise arch. The shortlist remains here as
decision history.

Start with straight note centres. Audition short glides between adjacent notes
only after the words and phrase are easy to repeat. Do not add vibrato simply to
make a reference sound sophisticated: an expressive reference must still match
the visible contour and the assessed target. No loudness requirement or marathon
hold belongs in this first musical pass.

## Production and acceptance

1. The note/rhythm guide, visualizer, Merc reference and judge now share the same
   authored melody definition.
2. Paid source takes, provider receipts, source selection, carrier-free WORLD
   mapping and delivered hashes are preserved under the v6 production folder.
3. Example playback stops before assessed capture. The mic still starts only on
   the player's explicit **Sing the melody** action.
4. All 88 shipped variants complete through the production detector and shared
   judge at 24, 44.1 and 48 kHz. Wrong-key, constant-note, silence and missing
   anchor controls remain incomplete.
5. The owner must still audition lyric clarity, natural stress, whimsical tone
   and resynthesis artifacts, then try real sing-back before any phrase can be
   considered for required progression.

The pitch contour, key offset, anchor durations, transition windows, tempo, words
and example clip should remain replaceable per encounter. Easy/medium/hard can
share a phrase while changing assessed precision gradually, without changing the
song unexpectedly between the demonstration and the player's attempt.
