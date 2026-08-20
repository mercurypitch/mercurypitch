// ============================================================
// "What counts where" — the words, written once
// ============================================================
//
// Three surfaces say this: the modal behind every pill row, the Learn
// chapter, and — for anyone reading the source — the run-kind taxonomy
// itself. Prose that lives in two places drifts, and drifting prose is how
// the app came to call three different things "sessions" in the first
// place, so the sentences live here and the renderers are dumb.
//
// Deliberately plain text, with no inline markup. The guide renders it as
// JSX and the Learn chapter renders it as markdown, and a bold word is not
// worth having two copies of a paragraph.

import { RUN_KINDS } from './run-kinds'

export const WHAT_COUNTS_TITLE = 'What counts where'

export const WHAT_COUNTS_LEDE =
  'Everything you sing that gets scored is a run. There are four kinds, ' +
  'they are counted together, and the colour tells you which is which ' +
  'wherever you see it.'

export interface WhatCountsSection {
  heading: string
  body: string
}

export const WHAT_COUNTS_SECTIONS: readonly WhatCountsSection[] = [
  {
    heading: 'Why some runs are not ranked',
    body:
      'A leaderboard only means something when everybody sang the same ' +
      'thing. Practice is a melody you chose yourself and an exercise is one ' +
      'you repeated as often as you liked, so neither is comparable between ' +
      'people — they are scored for you, and they still count toward your ' +
      'streak, your badges and your totals.',
  },
  {
    heading: 'Where your runs are counted',
    body:
      'Signed in, your runs are counted across your whole account, on every ' +
      'device you sign in on. Signed out, they are counted on the device you ' +
      'did them on — and that is per site address, so runs done on the dev ' +
      'site are not the same pile as runs done on the main one. Signing in ' +
      'is what joins them up.',
  },
  {
    heading: 'Setlists and melodies are not runs',
    body:
      'A setlist is a practice programme you saved and published, and a ' +
      'melody is a tune you shared. Both are things you made for other ' +
      'people to load — nobody sang them by publishing them, so they are ' +
      'counted separately and never appear in your run totals.',
  },
  {
    heading: 'When the score trend stays empty',
    body:
      'The trend line is drawn only from runs that kept note-by-note pitch ' +
      'detail, so it can need a few more runs than the count does. The count ' +
      'is never held back by that: if a run happened, it is in the number.',
  },
]

/**
 * The same guide as markdown, for the Learn chapter.
 *
 * Built rather than written out, so adding a run kind updates the chapter
 * without anybody remembering to.
 */
export function whatCountsMarkdown(): string {
  const kinds = RUN_KINDS.map(
    (meta) =>
      `- **${meta.label}** (${meta.ranked ? 'ranked' : 'not ranked'}) — ${meta.blurb}`,
  ).join('\n')

  const sections = WHAT_COUNTS_SECTIONS.map(
    (section) => `## ${section.heading}\n\n${section.body}`,
  ).join('\n\n')

  return `\n${WHAT_COUNTS_LEDE}\n\n## The four kinds of run\n\n${kinds}\n\n${sections}\n`
}
