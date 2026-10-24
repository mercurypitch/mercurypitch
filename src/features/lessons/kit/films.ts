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
// item 7), on media.mercurypitch.com, the bucket's custom domain. Their host
// must be one the site's media-src allows (public/_headers), or the browser
// refuses the video.
//
// Each upload is a version, learn/NN/vK/, and its files never change: a
// fixed cut goes up as the next version beside the old one, and its line
// here moves to the new folder in the same commit as its new captions and
// chapters (lesson-0N/film-sync.test.ts holds those copies equal).
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
  // "What is a note?", 5:35, master rc-09
  1: {
    hd: 'https://media.mercurypitch.com/learn/01/v1/lesson-01-1080p.mp4',
    sd: 'https://media.mercurypitch.com/learn/01/v1/lesson-01-720p.mp4',
  },
  // "Twelve notes", 7:19, master rc-06
  2: {
    hd: 'https://media.mercurypitch.com/learn/02/v1/lesson-02-1080p.mp4',
    sd: 'https://media.mercurypitch.com/learn/02/v1/lesson-02-720p.mp4',
  },
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
