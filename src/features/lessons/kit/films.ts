// ============================================================
// Lesson films — where each lesson's episode plays from, once it can
// ============================================================
//
// One list, and everything that shows a film reads it: the lesson's page
// (lesson-0N/film.ts hands its entry to episode.ts), the season map
// (season.ts takes each lesson's film state from here) and so every card.
// A lesson listed here has its film made; its entry stays null until the
// MP4s are uploaded. While it is null the lesson shows no film anywhere:
// no Watch section, no Watch link in the masthead, no Watch button on its
// card. A lesson missing from the list has no film at all.
//
// To put a film on, set its sources here. That one line is the whole
// change: the Watch section and its masthead link appear on the lesson's
// page, its card offers "Watch the episode", and the lesson reads as ready
// to watch and read. The page's markup ships Watch hidden, as a film with
// no sources needs, and kit/episode.ts shows it once the module runs;
// taking `hidden` off the section and its link in learn/NN.html (and
// numbering Explorer III) then paints it from the first frame instead.
//
// The MP4s live on R2 (docs/plans/find-your-pitch/MASTER-PLAN.md § 12
// item 7), and their host must be one the site's media-src allows
// (public/_headers: *.r2.dev or *.r2.cloudflarestorage.com today), or the
// browser refuses the video. The plan is a custom domain,
// media.mercurypitch.com, which goes into media-src first.
//
// Pure data, read in plain Node too (src/e2e reads it): nothing here may
// touch the DOM or `import.meta`.

/** A film's two MP4s, both cut from its delivery master. */
export interface FilmSources {
  /** 1080p30 MP4, moov at the front so it starts before it has downloaded. */
  readonly hd: string
  /** 720p30 MP4 for narrow screens. */
  readonly sd: string
}

/** Lesson number to its film's sources: null while the film is made but not uploaded. */
export type FilmRegistry = Readonly<Partial<Record<number, FilmSources | null>>>

export const FILMS: FilmRegistry = {
  // "What is a note?", 5:14: made, not uploaded yet
  1: null,
  // "Twelve notes", 7:11: made, not uploaded yet
  2: null,
}

/**
 * How a lesson's film stands: 'published' once it has sources, so it plays
 * on the lesson's page; 'production' while it is made but not uploaded.
 */
export type FilmState = 'published' | 'production'

/** Lesson `n`'s film state, as season.ts records it; undefined for a lesson with no film. */
export function filmState(
  n: number,
  films: FilmRegistry = FILMS,
): FilmState | undefined {
  if (!(n in films)) return undefined
  return films[n] == null ? 'production' : 'published'
}

/** Lesson `n`'s sources, or null while it has no film that can play. */
export function filmSources(
  n: number,
  films: FilmRegistry = FILMS,
): FilmSources | null {
  return films[n] ?? null
}
