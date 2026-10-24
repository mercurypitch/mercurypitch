// ============================================================
// Lesson 2 film — where the episode plays from, its chapters and captions
// ============================================================
//
// The episode, 7:19 (439.10 s, FACTS 54), plays from R2 (MASTER-PLAN § 12
// item 7): a 1080p MP4 and a 720p copy for phones, both cut from the
// delivery master `rc-06-60fps` by the film's tools/web-video.sh. Their
// addresses are Lesson 2's entry in kit/films.ts, the one list every film is
// read from, and the page shows no Watch section until it is set; films.ts
// says which hosts media-src allows.
//
// Captions and chapters travel with the film. A re-cut that re-times it
// regenerates the film's captions and chapters, and both copies change in
// the same commit as the MP4 URLs: assets/ here and the lesson's captions/
// folder in docs/plans. film-sync.test.ts holds the two copies equal.

import type { FilmSources } from '@/features/lessons/kit/films'
import { filmSources } from '@/features/lessons/kit/films'
import chapters from './assets/chapters.json'
import captionsText from './assets/lesson-02.en.vtt?raw'

/** The 1080p and 720p MP4s, or null until they are uploaded (kit/films.ts). */
export const FILM_SOURCES: FilmSources | null = filmSources(2)

/** Generated from the film's scene table (the film's tools/chapters.py). */
export const FILM_CHAPTERS: readonly { title: string; start: number }[] =
  chapters.map((c) => ({ title: c.title, start: c.start }))

/** The captions' own text, for the transcript (the player loads the same file as a track). */
export const FILM_CAPTIONS_TEXT: string = captionsText
