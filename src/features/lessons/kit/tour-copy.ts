// ============================================================
// Lesson tour copy — every word the welcome tour says, in one place
// ============================================================
//
// The tour (tour.ts) walks a first visit through the page: Merc and Tavi on
// the stage, the steps, Sing it, the season map and the masthead. One list
// serves every lesson page: a step whose targets are all missing or hidden
// on a page is left out there, and the count ("1 of 5") follows. A step
// names its targets in order; every one that shows is lit, together, so
// the masthead's step lights the lesson menu's button, the section links
// and the tour's question mark on a wide screen, and the menu's button and
// the question mark on a phone, where the menu carries the sections.
//
// Each line was checked against what the eight pages do. Lessons 1, 2, 4,
// 6 and 8 never listen; 3, 5 and 7 can, once the viewer chooses to sing,
// and their pages say the voice is analysed on the device and nothing is
// recorded, kept or sent. So Sing it's line names the microphone only on
// the lessons in `LISTENING_LESSONS`: a new lesson whose Sing it listens
// adds its number there.
//
// The menu's "Tour this page", which names the question mark too, is the
// one tour word not here: both are drawn on first paint (lesson-menu.ts),
// and this file loads with the tour, after first paint.

export interface TourStepCopy {
  /** What the step lights: every one of these that shows on the page. */
  readonly targets: readonly string[]
  readonly title: string
  readonly body: string
  /** Said after `body` on a lesson in `LISTENING_LESSONS`. */
  readonly listening?: string
}

/** The lessons whose Sing it listens through the microphone, once the viewer chooses to sing. */
export const LISTENING_LESSONS: readonly number[] = [3, 5, 7]

export const TOUR_STEPS: readonly TourStepCopy[] = [
  {
    targets: ['#heroStage'],
    title: 'Meet Merc and Tavi',
    body: "They teach every lesson. Listen to them sing, then sing along with them when it's your turn.",
  },
  {
    targets: ['#stepsStage'],
    title: 'One step at a time',
    body: 'Each step has a figure to play with and something to try. The arrows move between the steps, at your own pace.',
  },
  {
    targets: ['#sing'],
    title: 'Your turn to sing',
    body: 'Merc sings first, then you sing, wherever your voice feels easy. Stop if anything feels uncomfortable.',
    listening:
      'If you choose to sing, it listens through your microphone and shows what it heard. Nothing is recorded, kept or sent.',
  },
  {
    targets: ['#graph', '#exList'],
    title: 'The season, mapped',
    body: 'Every lesson in the season, and how each one builds on the ones before. Pick a lesson to see what it covers and what it builds on.',
  },
  {
    targets: ['.lm-btn', '#mastNav', '.lm-tour'],
    title: 'Find your way',
    body: 'From up here you can jump to any part of this lesson, or open the lesson menu for every lesson in the season. Tour this page, in that menu, shows you this tour again. So does the question mark at the top right.',
  },
]

/** The card's own words. */
export const TOUR_WORDS = {
  /** "1 of 5": the step showing, of the steps on this page. */
  count: (n: number, of: number): string => `${n} of ${of}`,
  back: 'Back',
  next: 'Next',
  done: 'Done',
  skip: 'Skip tour',
  close: 'Close tour',
} as const
