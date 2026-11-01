// ============================================================
// Lesson 2 watch page — "Twelve notes" as a film, on its own page
// ============================================================
//
// The page's markup already plays the film: the video carries its sources,
// poster, captions and controls, so a crawler and a page with no script both
// have it (kit/watch-pages.ts). This adds what the lesson's Watch section
// has: the chapters, the transcript and the jumps between them
// (kit/episode.ts). It imports no CSS: the page links its own sheet,
// kit/lesson-watch.css, which says why.

import { createEpisode } from '@/features/lessons/kit/episode'
import vttUrl from './assets/lesson-02.en.vtt?url'
import { FILM_CAPTIONS_TEXT, FILM_CHAPTERS, FILM_SOURCES } from './film'

createEpisode({
  film: FILM_SOURCES,
  captions: vttUrl,
  vtt: FILM_CAPTIONS_TEXT,
  chapters: FILM_CHAPTERS,
  inMarkup: true,
})
