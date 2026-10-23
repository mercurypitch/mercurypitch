// ============================================================
// Lesson copy — each lesson's switchable hook and tease, and how one is picked
// ============================================================
//
// Each lesson opens on its hook question and is teased, on the lesson before
// it, by one line on that lesson's next-lesson card, set up and never
// answered (docs/plans/find-your-pitch/CURIOSITY-MOMENTS.md § 3.1). The
// default hook is the season's (season.ts `hook`, variant id 'default'): the
// page's title and head carry it, and so do LESSON.md, FACTS.md, CURRICULUM.md
// and YOUTUBE.md. What can stand in its place is here: a lesson's alternative
// hooks, its tease and the tease's alternatives, each under an id the admin
// console stores. A tease is set on the lesson it teases.
//
// The console's pick reaches a page as the lesson's override in the lesson
// state (src/lib/lesson-state.ts): its `hook` and `tease` name a variant id
// in that file's VARIANT_ID form, and an id the lesson lacks, or none, keeps
// the default, as hookFor and teaseFor pick.
//
// Pure data and resolvers, with no DOM and no `import.meta`, so the site
// worker (which rewrites a page's `<h1 class="hook" id="hook">`), the admin
// console and the e2e specs, which run in plain Node, read it as it is.
// season.ts gives each entry its lesson's copy from here; the default hook
// stays on the entry, which every lesson page and document quotes, and the
// page state picks among them (publish.ts `seasonFor`).
//
// Why a variant exists is the team's, for the admin console, and never drawn
// on a lesson page, so it is not here: every lesson page downloads this file.
// Each variant's note is in team-notes.ts under its lesson's number and its
// id, which the console joins back to it (admin/lessons/copy-choices.ts), and
// this file imports nothing, that one included. A variant written here needs
// its note there; team-notes.test.ts fails until it has one. A variant's text
// is lesson copy: British English, every claim in that lesson's FACTS.md, no
// mood labels, a hook that ends in "?", a tease of one line that is at most
// TEASE_MAX characters.

/** A hook that can stand in place of a lesson's default. */
export interface HookVariant {
  /** What the admin console stores: a variant id (lesson-state.ts VARIANT_ID), never 'default'. Its note is filed under it in team-notes.ts. */
  readonly id: string
  /** Plain text ending in "?", as the explorer, the lesson menu and the next card print it. */
  readonly text: string
  /**
   * The page's h1 markup, for a hook that styles part of its text, as Lesson
   * 1's coloured "440 Hz" does: text, entities and `<span class="...">`
   * only. Without it the h1 takes `text`.
   */
  readonly html?: string
}

/** A tease that can stand in place of a lesson's default tease. */
export interface TeaseVariant {
  /** As a hook variant's: its note is filed under it in team-notes.ts. */
  readonly id: string
  readonly text: string
}

/** A lesson's curiosity copy beyond its default hook, as its season entry carries it. */
export interface CuriosityCopy {
  /** Hooks that can stand in place of the season's `hook`. */
  readonly hookAlts?: readonly HookVariant[]
  /** The line above this lesson's hook on the previous lesson's next-lesson card. */
  readonly tease?: string
  /** Teases that can stand in place of `tease`; only beside one. */
  readonly teaseAlts?: readonly TeaseVariant[]
}

/** A lesson's curiosity copy whole: its default hook (season.ts) and the rest. */
export interface LessonCopy extends CuriosityCopy {
  readonly hook: string
}

/** The variant id of a lesson's own hook or tease. */
export const DEFAULT_ID = 'default'

/** A tease is one line on a card: at most this many characters. */
export const TEASE_MAX = 70

/** Each lesson's copy by lesson number; a lesson with none of its own is absent. */
export const LESSON_COPY: Readonly<Partial<Record<number, CuriosityCopy>>> = {
  2: { tease: 'Seven letters, but twelve notes.' },
  3: {
    hookAlts: [
      {
        id: 'figures',
        text: "In a survey, most of 1,105 students said they couldn't copy a tune. In tests, only about one in ten to one in six missed by a semitone or more. So what's going on?",
      },
      {
        id: 'tested',
        text: "Asked, most students said they couldn't copy a tune. Tested, most could. So what's going on?",
      },
    ],
  },
  4: { tease: 'Merc climbs seven stairs and stops, one short of home.' },
  5: {
    hookAlts: [
      {
        id: 'steady',
        text: 'Singers are told to “support” a long note. What keeps it steady?',
      },
    ],
    tease: 'One long note, sung easily, then with a harder push.',
  },
  6: { tease: 'Merc moves every single note of ‘Twinkle, Twinkle’ up.' },
  7: {
    hookAlts: [
      {
        id: 'two-questions',
        text: 'How many notes can your voice reach, and why is the comfortable middle worth more than the extremes?',
      },
    ],
    tease: 'Books often give a voice type two octaves.',
  },
  8: { tease: 'Same song, same speed. Only the claps move.' },
  9: { tease: 'One note, two ways up: step by step, or one leap.' },
  10: { tease: 'Three notes, one chord. Move one by a semitone.' },
  11: { tease: 'Slide up slowly, and your voice may flip.' },
  12: { tease: 'Four chords, round and round.' },
  13: { tease: 'Same note, two vowels: ‘ee’, then ‘ah’.' },
  14: {
    tease: '‘Twinkle, twinkle, little star’, twice. The second ‘star’ swells.',
    teaseAlts: [
      {
        id: 'band',
        text: 'Every note in the band, start to finish.',
      },
    ],
  },
}

/**
 * The card that closes the season, on its last lesson's page where the next
 * lesson's card would be: the trailer's question, answered (CURIOSITY-MOMENTS
 * § 5 item 4), and two ways on, a whole song and the season's map.
 */
export const SEASON_END = {
  eyebrow: 'End of Season 1',
  line: "You've seen every note you sing. Now sing a whole song.",
  /** Same-origin, marked with the page's lesson as every practise link is. */
  song: { label: 'Karaoke Night', path: '/karaoke-night' },
  map: { label: 'See the season map', href: '#explorer' },
} as const

/** A hook as a page draws it. */
export interface Hook {
  /** DEFAULT_ID, or the variant's. */
  readonly id: string
  readonly text: string
  /** The h1's markup for a variant; null for the default, whose markup is the page's own. */
  readonly html: string | null
}

/** Text as HTML: the h1 of a variant that has no markup of its own. */
const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The hook a lesson shows for variant `id`: its default unless `id` names one of its alternatives. */
export function hookFor(lesson: LessonCopy, id?: string | null): Hook {
  const alt = lesson.hookAlts?.find((v) => v.id === id)
  if (alt === undefined)
    return { id: DEFAULT_ID, text: lesson.hook, html: null }
  return { id: alt.id, text: alt.text, html: alt.html ?? escapeHtml(alt.text) }
}

/**
 * The h1 markup for lesson `n`'s hook variant `id`, as the site worker
 * writes it into the page; null when `id` names none of its alternatives,
 * so the page's own h1, the default, stands.
 */
export function hookMarkup(
  n: number,
  id: string | null | undefined,
  copy: Readonly<Partial<Record<number, CuriosityCopy>>> = LESSON_COPY,
): string | null {
  const alt = copy[n]?.hookAlts?.find((v) => v.id === id)
  return alt === undefined ? null : (alt.html ?? escapeHtml(alt.text))
}

/** The tease a lesson shows for variant `id`, as `hookFor` picks; null for a lesson with no tease. */
export function teaseFor(
  lesson: LessonCopy,
  id?: string | null,
): { readonly id: string; readonly text: string } | null {
  if (lesson.tease === undefined) return null
  const alt = lesson.teaseAlts?.find((v) => v.id === id)
  return alt === undefined
    ? { id: DEFAULT_ID, text: lesson.tease }
    : { id: alt.id, text: alt.text }
}

/** Hook markup a page may take: text, entities and `<span class="...">`, every span closed. */
export function isHookMarkup(html: string): boolean {
  const token =
    /<span class="[a-z0-9 -]+">|<\/span>|&(?:#\d+|#x[0-9a-f]+|[a-z]+);|[^<>&]+/giy
  let open = 0
  let at = 0
  while (at < html.length) {
    token.lastIndex = at
    const m = token.exec(html)
    if (m === null) return false
    if (m[0].startsWith('<span')) open += 1
    else if (m[0] === '</span>') open -= 1
    if (open < 0) return false
    at = token.lastIndex
  }
  return open === 0
}
