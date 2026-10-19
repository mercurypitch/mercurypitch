// ============================================================
// Lesson marker — which Find Your Pitch lesson sent this visit
// ============================================================
//
// Every practise link a lesson page prints carries `?lesson=NN` ahead of any
// hash route: `/ear-lab?lesson=02`, `/?lesson=09#/path` (the links are in
// src/features/lessons/kit/season.ts). The main app reads it once, at boot,
// so First Light steps aside for somebody a lesson sent to one room
// (stepAsideForLesson in src/stores/onboarding-store.ts).
//
// Strict on purpose: `lesson=` and two digits, 01 to 14, Season 1's lessons.
// Anything else (`?lesson=2`, `?lesson=15`, `?lesson=02x`, no value) is not a
// lesson's link, and the visit is an ordinary one.
//
// Only the query string, never a hash route's own `?`: the lessons write the
// marker before the hash, and the hash belongs to the router.

/** Season 1's lessons as their links write them: 01 to 14. */
const SEASON_1_LESSON = /^(?:0[1-9]|1[0-4])$/

/** The lesson (1 to 14) a URL's query string names, or null for none. */
export function lessonFromSearch(search: string): number | null {
  const value = new URLSearchParams(search).get('lesson')
  return value !== null && SEASON_1_LESSON.test(value) ? Number(value) : null
}
