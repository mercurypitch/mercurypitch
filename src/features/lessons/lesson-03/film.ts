// ============================================================
// Lesson 3 film — where the episode plays from, its chapters and captions
// ============================================================
//
// The episode, 9:32 (572.10 s), plays from R2 (MASTER-PLAN § 12 item 7): a
// 1080p MP4 and a 720p copy for phones, both cut from the delivery master.
// Their addresses are Lesson 3's entry in kit/films.ts, the one list every
// film is read from, and the page shows no Watch section until it is set;
// films.ts says which hosts media-src allows.
//
// Captions and chapters travel with the film. A re-cut that re-times it
// regenerates the film's captions and chapters, and both copies change in
// the same commit as the MP4 URLs: assets/ here and the lesson's captions/
// folder in docs/plans. film-sync.test.ts holds the two copies equal.

import type { FilmSources } from '@/features/lessons/kit/films'
import { filmSources } from '@/features/lessons/kit/films'
import chapters from './assets/chapters.json'
import captionsText from './assets/lesson-03.en.vtt?raw'

/** The 1080p and 720p MP4s, or null until they are uploaded (kit/films.ts). */
export const FILM_SOURCES: FilmSources | null = filmSources(3)

/** The film's chapters, each starting at a scene cut in the final film. */
export const FILM_CHAPTERS: readonly { title: string; start: number }[] =
  chapters.map((c) => ({ title: c.title, start: c.start }))

/** The captions' own text, for the transcript (the player loads the same file as a track). */
export const FILM_CAPTIONS_TEXT: string = captionsText
