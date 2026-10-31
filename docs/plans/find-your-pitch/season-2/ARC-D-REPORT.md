# Arc D ("Harmonise it"), Lessons 22 to 28: research and article plans, report

Each lesson has a RESEARCH.md (claims, sources, what they say, how far each was read, strength;
contradictions first; five interesting findings) and an ARTICLE-PLAN.md (Season 1's section order,
predicts, Tavi's lines and quick checks written out, practise links verified at `b803c7d43`, Go
deeper, tease, open questions, decision dependencies). App citations were read at `b803c7d43`.
Downloads were read and deleted.

## Across the arc

- **Engineering decides what each voice checkpoint can do today.** The kit's readers take one held
  note (`kit/hold-take.ts`) or one sung reply (`kit/take.ts`) per take; the kit plays one line per
  call, records nothing and has no headphones prompt. Lesson 22's hold works today for a straight
  note or a small vibrato; Lessons 24, 26 and 28 ship unscored sing-alongs until a drone under a
  take, a line reader in time, two-voice playback, headphones and a page recorder exist. Two items
  are new to SEASON-2 § 5: a centre-line hold reader (Lesson 22) and a page recorder (Lessons 26
  and 28; the app's `src/lib/voice-capture.ts` may serve).
- **Turns do not rescue a drone.** The turn-taking fallback works for a melody, not a drone that
  must sound during the hold; Lesson 24 scores only with headphones.
- **Open Music Theory 2e on LibreTexts** carried most theory claims (§§ 1.13, 1.15, 1.17, 1.18, 2.01,
  4.01, 4.02, 4.04, 7.4-7.6), read in full; its examples and tables are images.
- Recalls for Lessons 25 and 28 quote Arc C's planned quick checks (Lessons 21 and 18), to re-take
  word for word from their LESSON.md.

## Lesson 22, Vibrato

- Settled: rate about 5 to 8 waves a second, extent usually under ±1 semitone, extent measured from
  the centre (Sundberg 1994, read in full); the heard pitch sits near the geometric mean of the two
  extremes (Shonle & Horan 1980, publisher's abstract plus a quoted conclusion); below about 4 to 5
  Hz the pitch is heard moving; rate rises about 20 % over a held note's last ten waves (Bretos &
  Sundberg, report version read in full); styles use both straight tone and vibrato, and singers
  adjust (Acosta Martínez & Daffern 2025, a systematic review read in full).
- Contradicts the card: Timmers & Desain's "0.6 to 2 semitones" does not say how extent is measured,
  so Sundberg's ± figures replace it; the card's sample "±50 cents" crosses Lesson 5's ±35-cent band,
  which the kit's hold reader counts frame by frame, so "a vibrato counts in full" needs new code;
  the "Long Note" help line is Long Note Lantern's (`exercise-help.ts:43`).
- Unverified, not used: Mitchell & Kenny 2010 (abstract only), Nix 2014 (summary only), Sundberg's
  book chapter (its report version was read instead).
- Decisions: 10 (synthesised examples with set rate and extent), 1, 5.
- Best finding: slow a vibrato to twice a second and the single note comes apart into a moving
  pitch; at six it is one note, heard at its centre.

## Lesson 23, Perfect, major, minor and the tritone

- Settled: interval number by letters, qualities, augmented and diminished, inversion (numbers add
  to 9, semitones to 12), consonance classes, 3:2 and 4:3 (OMT; Wolfe, UNSW).
- Contradicts the card: "fa and ti, the two notes that lean hardest" is not supported; OMT 1e names
  ti and le as the most prominent tendency tones, and fa's pull is as the seventh of V7, so the plan
  never says "hardest". OMT also counts the perfect fourth as a dissonance against the bass.
- The tritone's history: Fux's 1725 Gradus ad Parnassum, read in its Latin scan (p. 52), calls "mi
  contra fa est diabolus in Musica" a well-worn proverb and bars the tritone leap in counterpoint as
  hard to sing and bad-sounding. No church ban is documented (Wikipedia; Skeptical Inquirer quoting
  T. F. Kelly). Werckmeister, Mattheson, Smith and Randel were not reached; the plan's translation of
  Fux needs a Latinist's check.
- Decisions: 2 (every staff example in two clefs), 1.
- Best finding: the "devil in music" was a counterpoint teacher's proverb about a hard leap, in a
  1725 textbook, not a church ruling.

## Lesson 24, Harmony against a drone

- Settled: beat rate = frequency difference (Wolfe); harmonics beat in mistuned intervals; formula
  |n × upper − m × drone| for ratio m:n. Recomputed on A3: fifth 0.745, major third 8.731, fourth
  0.994, minor third 11.872 beats a second (card confirmed). Dai & Dixon 2019 read in full (16 women,
  isolated rooms, headphones; together their harmony was closer, their own notes less so).
  D'Amario et al. read in full: major thirds averaged 392.17 cents, minor 299.13.
- Contradicts the card: turn-taking cannot stand in for headphones with a drone; Kodály's part
  singing "from the start" not found (only "60 progressive two-part songs", via a search summary).
  A vibrato hides beats (Sundberg 1994, p. 64), and the kit's Merc voice has one, so every beat
  demonstration must be a straight synthesised tone.
- Unverified: whether the detector locks onto a speaker drone (risk 3); which drone timbre makes a
  0.5 to 1 Hz beat audible.
- Decisions: 10, 1.
- Best finding: singers who hear each other let their own notes drift to keep the harmony between
  them in tune.

## Lesson 25, Minor, properly

- Settled: the three forms, do-based syllables, raised ti gives closure and a major V, the augmented
  second and melodic minor's reason, relative and parallel keys (OMT § 1.13, § 4.02; Sharkey,
  Sierra College OER).
- Contradicts the card: "Sad and introspective" (`scale-data.ts:88`) is not displayed anywhere at
  `b803c7d43` (no code reads the field), so risk 16 is latent; fix it with its neighbours before any
  screen shows them. The AP chief reader reports no longer resolve (redirects), so they are not
  used. The app walkthrough's C-minor relative-major error is gone.
- Decisions: 2, 5 (and Arc C's Lesson 21 for the recall).
- Best finding: OMT calls the three minor forms "flavors of ice cream" and says they are categories
  "primarily for instrumental performers".

## Lesson 26, A second voice

- Settled: diatonic thirds (major on do, fa, so; minor elsewhere), thirds as imperfect consonances,
  passing tones (OMT); the app's own `jam-modes.ts:100-107` states the lesson's point. "Twinkle" a
  third higher in C has five major and three minor thirds; a fixed +4 adds C♯, G♯ and F♯.
- Contradicts the card: the scored five-note checkpoint and its role swap cannot run on today's kit.
  "Passing note" (British) has no British source read in this pass; OMT says "passing tone".
- Decisions: 10 (the hosts' tenth labelled once), 1.
- Best finding: the app's harmony code already explains, in a comment, why a fixed shift "would
  harmonise the second degree as D-F#-A and leave the key".

## Lesson 27, Seventh chords and inversions

- Settled: seventh-chord construction and qualities, V7's added fa strengthening the pull, ti up and
  fa down, inversions and the root-is-not-the-bass rule, slash names (OMT §§ 1.17, 1.18, 4.02; OMT 1e
  § 2.12). Chord Stacker and Stack verified.
- Contradicts the card: the benchmark's Hooktheory and Bennett sources were not re-read; OMT's short
  inversion figures are images (figures kept to Go deeper); the tease's "the strongest way home" is
  dropped (Lesson 14 kept "strongest" off its page).
- Decisions: 2, 1.
- Best finding: resolving V7 by its tendencies leaves the I chord with "three roots and one third—no
  fifth".

## Lesson 28, Cadences, form and a song in two parts

- Settled: British and American names (Wikipedia's Cadence at Lesson 14's revision, citing Grove;
  OMT § 4.01); plagal as the Amen cadence; interrupted as V to vi; AABA as 32-bar song form, verse
  and chorus (OMT §§ 7.4-7.6). A draft eight-bar song in G, two parts, every vertical a tenth,
  twelfth or octave, imperfect cadence at bar 4, perfect at 8, with an interrupted variant.
- Contradicts the card: "songs usually end on a perfect cadence" has no source read; OMT says many
  recordings fade out, so the plan says "sounds final" only. Plagal and deceptive are classed as
  motion around a cadence in one source; the plan keeps the four British names but frames perfect
  and imperfect as the phrase endings. British "imperfect" is not American "imperfect authentic".
- Rights: the song is written for the lesson; a traditional tune would need Lesson 6's UK and US
  check on tune, words and arrangement. ABRSM's Grade 5 cadence list not verified.
- Decisions: 8 (no tease), 10, 2, 3, 4.
- Best finding: AABA's other name, 32-bar song form, comes from its four eight-bar sections, so the
  lesson's own song can be built that way.
