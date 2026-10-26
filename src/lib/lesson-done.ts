// ============================================================
// Lesson done — the lesson pages' list of the lessons marked done
// ============================================================
//
// One list in localStorage: a lesson page's quiz and explorer card write it
// (kit/progress.ts), and the app reads it to open the visitor's current
// lesson (current-lesson.ts). Its key and its parse are here, so the two
// never read it differently. The parse forgives: a list that is not an
// array counts as nothing done, and an entry that is not a number is
// skipped.
//
// A module of its own, apart from current-lesson.ts: every lesson page
// loads it, and it carries nothing but this, so the pages do not download
// the app's list of released lessons with it.

/** The lesson pages' list of the lessons marked done. */
export const LESSON_DONE_KEY = 'fyp-done'

/** The lessons a stored list marks done: its numbers, and nothing for anything else. */
export function doneLessonsFrom(stored: unknown): number[] {
  return Array.isArray(stored)
    ? stored.filter((n): n is number => typeof n === 'number')
    : []
}
