// ============================================================
// Lesson 2 film — where the episode plays from, its chapters and captions
// ============================================================
//
// The episode, 7:11 (431.08 s, FACTS 54), plays from R2 (MASTER-PLAN § 12
// item 7): a 1080p MP4 and a 720p copy for phones, both cut from the
// delivery master `rc-04-60fps` by the film's tools/web-video.sh. Until they
// are uploaded FILM_SOURCES stays null and the section shows the poster, the
// chapters and the transcript with "Film coming soon". The files must come
// from a host the site's media-src allows (public/_headers: *.r2.dev or
// *.r2.cloudflarestorage.com); a custom media domain (the plan is
// media.mercurypitch.com) needs adding there first, or the browser refuses
// the video.
//
// Captions and chapters travel with the film. A re-cut that re-times it
// regenerates the film's captions and chapters, and both copies change in
// the same commit as the MP4 URLs: assets/ here and the lesson's captions/
// folder in docs/plans. film-sync.test.ts holds the two copies equal.

import chapters from './assets/chapters.json'
import captionsText from './assets/lesson-02.en.vtt?raw'

export interface FilmSources {
  /** 1080p30 MP4, moov at the front so it starts before it has downloaded. */
  hd: string
  /** 720p30 MP4 for narrow screens. */
  sd: string
}

export const FILM_SOURCES: FilmSources | null = null

/** Generated from the film's scene table (the film's tools/chapters.py). */
export const FILM_CHAPTERS: readonly { title: string; start: number }[] =
  chapters.map((c) => ({ title: c.title, start: c.start }))

/** The captions' own text, for the transcript (the player loads the same file as a track). */
export const FILM_CAPTIONS_TEXT: string = captionsText
