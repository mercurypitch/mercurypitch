// ============================================================
// Current lesson — the Find Your Pitch lesson a visitor is up to
// ============================================================
//
// Home's Lessons link and the Map's Lessons door open the first lesson
// released as built that the visitor has not marked done, and the hub,
// /learn/, once every one of them is done.
//
// Released as built: a lesson with a page (kit/season.ts) that is not a
// draft (kit/drafts.ts). The app shell does not know the admin console's
// publish state, so it offers only what every environment serves: never a
// draft, not even one this site has published.
//
// src/lib may not import a feature, so RELEASED_LESSONS repeats what those
// two lists say, and current-lesson.test.ts fails the day they disagree:
// releasing a lesson (deleting its line from drafts.ts) adds it here, and a
// lesson's new title is copied here too.
//
// Done: the lesson pages' own list in localStorage, read with the key and
// the parse the pages use (lesson-done.ts). The read forgives as the
// pages' does, and a storage that throws (a private window, blocked site
// data) reads as nothing done.

import { doneLessonsFrom, LESSON_DONE_KEY } from './lesson-done'

/** A lesson released as built: its number, its title as its page gives it, its page. */
export interface ReleasedLesson {
  readonly n: number
  readonly title: string
  readonly page: string
}

/** Every lesson with a page that is not a draft, in lesson order. */
export const RELEASED_LESSONS: readonly ReleasedLesson[] = [
  { n: 1, title: 'What is a note?', page: '/learn/01' },
  { n: 2, title: 'Twelve notes', page: '/learn/02' },
]

/** The lessons' hub, the door once every released lesson is done. */
export const LESSONS_HUB = '/learn/'

/** The lessons this browser has marked done, or none where storage cannot be read. */
export function readDoneLessons(): number[] {
  try {
    const raw = window.localStorage.getItem(LESSON_DONE_KEY)
    return raw === null ? [] : doneLessonsFrom(JSON.parse(raw))
  } catch {
    return []
  }
}

/** The first released lesson not marked done, or null once every one is. */
export function currentLesson(
  done: readonly number[] = readDoneLessons(),
): ReleasedLesson | null {
  return RELEASED_LESSONS.find((lesson) => !done.includes(lesson.n)) ?? null
}

/** Where the visitor's lessons continue: the current lesson's page, or the hub. */
export function currentLessonHref(
  done: readonly number[] = readDoneLessons(),
): string {
  return currentLesson(done)?.page ?? LESSONS_HUB
}
