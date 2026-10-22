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
// a lesson page reaches may import this one, and team-notes.test.ts holds it
// to the season and its copy, entry for entry.
//
// Hook notes and tease notes are keyed apart, as the lesson state stores a
// hook and a tease apart: a hook's id and a tease's may be the same.
//
// The words are lesson copy, held to its rules: British English, every claim
// in that lesson's FACTS.md, and no mood labels. A note may name a mood
// label to say why its variant is not the default, as Lesson 10's does.
//
// Pure data, with no imports, no DOM and no `import.meta`, as lesson-copy.ts
// is, so the admin console and the e2e specs, which run in plain Node, read
// it as it is.

/** Each lesson's signature image by lesson number, the trailer's at 0: one for every season entry. */
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
}

/** A lesson's notes by variant id: why each variant exists. */
export type VariantNotes = Readonly<Partial<Record<string, string>>>

/** Why each alternative hook exists (lesson-copy.ts `hookAlts`), by lesson number, then variant id. */
export const HOOK_NOTES: Readonly<Partial<Record<number, VariantNotes>>> = {
  3: {
    figures:
      "The original hook, with both figures (FACTS 1 to 5). At 163 characters it was the season's longest, so the page sets its title smaller; the shorter default keeps the Asked and Tested of Lesson 2's film.",
    tested:
      'The default from 20 October. Its "Tested, most could" all but answers the cold open\'s predict, which sits under the title.',
  },
  7: {
    'two-questions':
      'The original hook: two questions in one, and its first half invites counting notes, which the lesson steers away from.',
  },
  9: {
    harder:
      "Needs FACTS support for 'so much harder'; Lesson 9's FACTS show copied leaps landing short, more so the larger the leap.",
  },
  10: {
    'bright-dark':
      'The original hook. Bright and dark are mood labels, and the lesson refutes "minor means sad"; the YouTube title drops them too.',
  },
  11: {
    'same-note':
      "Needs FACTS support for 'roughly the same note every time'; Lesson 11's FACTS show a flip can come at different notes on different slides, or not at all.",
  },
  12: {
    hundreds:
      'The original hook. "Hundreds" needs a counted source in FACTS.md first; the YouTube titles avoid it too.',
  },
  14: {
    compelling:
      'The original hook. No source in FACTS.md says what makes a performance "compelling"; the new default asks what the lesson answers in full, what is left to shape.',
  },
}

/** Why each alternative tease exists (lesson-copy.ts `teaseAlts`), keyed as HOOK_NOTES is. */
export const TEASE_NOTES: Readonly<Partial<Record<number, VariantNotes>>> = {
  14: {
    band: "The original tease. It is true of the lesson, but it sits before the cold open's reveal and points at its answer, a line that stays in its band.",
  },
}
