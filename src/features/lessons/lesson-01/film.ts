// ============================================================
// Lesson 1 film — where the episode plays from, its chapters and captions
// ============================================================
//
// The episode plays from R2 (docs/plans/find-your-pitch/MASTER-PLAN.md § 12
// item 7): a 1080p MP4 and a 720p copy for phones, both cut from the
// delivery master. Until they are uploaded FILM_SOURCES stays null and the
// section shows the poster, the chapters and the transcript with "Film coming
// soon". The files must come from a host the site's media-src allows
// (public/_headers: *.r2.dev or *.r2.cloudflarestorage.com); a custom media
// domain needs adding there first, or the browser refuses the video.

import chapters from './assets/chapters.json'
import captionsText from './assets/lesson-01.en.vtt?raw'

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
