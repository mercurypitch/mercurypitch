// ============================================================
// Team notes — each lesson's signature image and why each copy variant exists
// ============================================================
//
// The team's words about the season, which no lesson page draws: a lesson's
// signature image, the team's shorthand for its look, and why each
// alternative hook and tease in lesson-copy.ts exists. Only the admin console
// reads them (src/features/admin/lessons/), joining a signature to its
// lesson by number and a note to its variant by lesson number and id.
//
// They are kept apart from season.ts and lesson-copy.ts because every lesson
// page imports those two, and a page downloads whatever they hold. No module
// a lesson page reaches may import this one: the build fails on any
// document whose first paint carries it
// (scripts/assert-first-paint-budgets.mjs, FIRST_PAINT_FORBIDDEN_SOURCES),
// and team-notes.test.ts holds it to the season and its copy, entry for
// entry.
//
// Hook notes and tease notes are keyed apart, as the lesson state stores a
// hook and a tease apart: a hook's id and a tease's may be the same.
//
// The words are lesson copy, held to its rules: British English, every claim
// in that lesson's FACTS.md, and no mood labels. A note may name a mood
// label to say why its variant is not the default.
//
// Pure data, with no imports, no DOM and no `import.meta`, as lesson-copy.ts
// is, so the admin console and the e2e specs, which run in plain Node, read
// it as it is.

/** Each lesson's signature image by lesson number, the trailer's at 0: one for every entry of every season. */
export const SIGNATURES: Readonly<Partial<Record<number, string>>> = {
  0: 'The promise, and a map of all fourteen hooks.',
  1: 'The pitch line winds into a spiral; the spiral unrolls into the keyboard.',
  2: 'The five "?" beads from Lesson 1\'s spiral light up; twelve equal steps multiply to exactly 2.',
  3: "The singer's line chasing Merc's target band, the gap shrinking in cents.",
  4: 'A staircase with two short steps that slides to start on any note.',
  5: 'The pitch line of a held note settling from a wobble into a narrow band.',
  6: "A tune's contour lifted off the chart and slid up and down, keeping its shape.",
  7: "A siren's line sweeping the chart, the comfortable band lit and the edges dimmed.",
  8: 'A metronome whose arm becomes the beat grid of a step sequencer.',
  9: "The leap drawn as an arc whose landing zone is the target band (amber, the app's pitch-canvas colour); slow leaps first.",
  10: "One bead, the third, sliding down one semitone and the chord's colour changing.",
  11: "The siren's line crossing a shaded seam, the seam narrowing over repetitions.",
  12: 'Four chords as four rooms on the spiral; a melody walking through them.',
  13: 'One pitch line over a harmonic spectrum whose peaks move as the vowel changes.',
  14: "A whole song's pitch line with breath marks and a swell drawn in light.",
  15: "The pitch line's black-key lanes fold away and its white-key lanes close into five lines; Lesson 1's keyboard slides under the grand staff, and the two staves meet at middle C.",
  16: "Lesson 4's staircase turns into the staff with the house on do; each note lights a beat before it sounds, and the names fade until only the house is left.",
  17: "Lesson 8's beat pads grow noteheads and stems, halve into eighths, join into half notes, and lift onto one line, then the staff.",
  18: "Lesson 16's staff over Lesson 17's beat grid; a cursor moves at tempo, patterns bracket themselves as it reaches them, and the song sheet's marks appear over the sounds they ask for.",
  19: "Lesson 8's six pads, regrouped: 3 + 3 makes two beats, 2 + 2 + 2 makes three; then a beat splits in three and a note leaves beat 3 for the and.",
  20: "Lesson 4's staircase loses fa and ti, and both semitone risers go with them; what is left climbs 2, 2, 3, 2 and 3; then the run is beads on a string, drawn closer as the tempo rises, each bead still in its band.",
  21: "Lesson 2's ring of twelve beads, threaded by fifths; the house walks round it and each step adds a sharp to the signature beside it, the flats the other way; then twelve pure fifths miss by 23.46 cents, and equal temperament closes the ring.",
  22: "Lesson 5's band, zoomed until a held note's wave shows: a counter and a ruler measure it, a middle line draws itself, and the app's ribbon stands beside it, labelled a mark.",
  23: "An interval and its upside down fill the octave on the pitch line; curled into Lesson 2's ring, the tritone is its diameter.",
  24: "Lesson 5's band with a drone under it: a top note sinks into it and its throb stills, the beads stand over it tuned two ways, and a wave smears the fifth's slow beat.",
  25: "Lesson 10's minor staircase: te slides up to ti, le to ti opens into a wider stair, then le rises too, going up only.",
  26: "Lesson 6's ‘Twinkle’ copied a third higher, the copy bending to the key's rows: some thirds four semitones and some three.",
  27: "Lesson 12's rooms on the ring; the V room gains a fourth corner; ti and fa lie straight across and fold inwards to do and mi; a chord turns over and keeps its name.",
  28: "A song in two parts on two staffs, Merc's lower part blue and Tavi's upper part orange; a tag names each phrase's cadence, and form letters gather above the sections.",
}

/** A lesson's notes by variant id: why each variant exists. */
export type VariantNotes = Readonly<Partial<Record<string, string>>>

/** Why each alternative hook exists (lesson-copy.ts `hookAlts`), by lesson number, then variant id. */
export const HOOK_NOTES: Readonly<Partial<Record<number, VariantNotes>>> = {
  3: {
    figures:
      "The original hook, with both figures (FACTS 1 to 5). At 163 characters it was the season's longest, so the page sets its title smaller; the shorter default keeps the Asked and Tested of Lesson 2's film. Like `tested`, it tells the cold open's predict how the tests came out, here in numbers.",
    tested:
      'The default from 20 October. Its "Tested, most could" all but answers the cold open\'s predict, which sits under the title.',
  },
  5: {
    steady:
      'The default without "If that doesn\'t mean pushing", which leans towards the predict\'s answer, that pushing moves the note. Added on 22 October 2026; the owner picks which goes live.',
  },
  7: {
    'two-questions':
      'The original hook: two questions in one, and its first half invites counting notes, which the lesson steers away from.',
  },
}

/** Why each alternative tease exists (lesson-copy.ts `teaseAlts`), keyed as HOOK_NOTES is. */
export const TEASE_NOTES: Readonly<Partial<Record<number, VariantNotes>>> = {
  14: {
    band: "The original tease. It is true of the lesson, but it sits before the cold open's reveal and points at its answer, a line that stays in its band.",
  },
  16: {
    'any-note':
      "The plan's line, the close of Lesson 15's card. It claims only what Lesson 15 has taught, where a note sits on either staff, so it sums up that lesson instead of setting up this one.",
  },
  17: {
    shapes:
      "The season plan's line, cut to fit and made true: it sets up the page changing while the tempo stays, which Step 2's Play both pays off, not the cold open, whose answer is that the page stays the same; so it is the alternative, and the default says what the cold open does (FACTS 5b).",
  },
  19: {
    written:
      "Lesson 18's plan's line, \"Every bar so far has walked in twos and fours.\", made true: Lesson 8's bars of three came before it, so it claims only what Season 2 has written, Lessons 17 and 18's bars of 4/4. It leaks nothing, but the default is the cold open in miniature (FACTS 5b).",
  },
  20: {
    plan: "The season plan's line. It fits and leaks nothing, but it sets up subdivision, not Lesson 20's opening, which the default says in miniature: Merc's run of nine notes at 0.2 s a note (FACTS 5).",
  },
  21: {
    'lesson-4':
      "Lesson 20's plan's line, cut to fit. It leaks nothing, since it says what the title says, but it recalls Lesson 4 rather than setting up this page's opening, D major's seven notes and two black keys, which the default says in miniature (FACTS 5b).",
  },
  22: {
    nudged:
      "Lesson 21's plan's line, a bridge from its fifths, each nudged two cents, to a held note's wave. It leaks nothing, but the default is the cold open in miniature: Merc's A3, its line past both edges of the band before anything marks the band's centre (FACTS 5b).",
  },
  23: {
    hold: 'Lesson 22\'s planned line as it stands. It leaks nothing, but the learner holds no two notes on Lesson 23\'s page, the page holds them, so the default says "Now two notes together" (Lesson 23 FACTS 5b).',
  },
  24: {
    fifths:
      'This lesson\'s planned line, mended: "Fifths sit still" read as "a fifth does not beat", which Lesson 24 shows the piano\'s fifth does, and a voice does not hear; so it says "count as", as the convention is framed. It leaks nothing, but the default is Lesson 24\'s opening in miniature (Lesson 23 FACTS 5).',
  },
  25: {
    plan: "Lesson 24's planned line. It is true of Lesson 24's page, whose Step 2 plays do, mi and so together over the drone, Lesson 10's major chord, but it sets \"a major chord\" one line above \"another change\" in a minor key, a soft lean on Lesson 25's predict, which asks whether a raised note turns a minor chord major; so the default is the lead's line, Lesson 25's opening in miniature (Lesson 24 FACTS 5b).",
  },
  26: {
    plan: "Lesson 25's planned line, \"So far the other part was a drone. What if it's a tune?\", mended: Lesson 12 had the learner sing the chords' roots while the chords moved under them, and Lesson 25's cold open puts moving chords under its tune, so only Lesson 24's other part was a drone. It is true of Lesson 24 and leaks nothing of Lesson 26's predict, but the default is Lesson 26's opening in miniature (Lesson 25 FACTS 5).",
  },
  27: {
    'three-notes':
      "The alternative to the lead's line, restating the cold open's play: three notes, then one more on V, and where it goes. Like the default, Lesson 27's opening in miniature, it names no note and no third, so it says nothing of which note stacks or which pulls (Lesson 27 FACTS 5b).",
  },
}
