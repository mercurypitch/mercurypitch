// ============================================================
// TourScreenHost — what a tour asks before it changes the screen
// ============================================================
//
// Draws the question a door asks before a tour closes what the singer has
// open over the page it shows (src/lib/tour-screen.ts): "Leave Long Note for
// the Exercises tour?". Take the tour closes it and starts the tour; Not now
// leaves everything as it was.
//
// It also ends a tour that a full-screen stage covers. Zen, a challenge stage
// and focus mode take the app's header, tabs and page away, and a tour left
// running pointed at nothing over the stage: either kind ends as the stage
// opens, an exit where it stands.
//
// App draws it beside the legacy spotlight, outside the shell a stage
// replaces, so it is there while a stage is up.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, on } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { IconArrowRight } from '@/components/hidden-features-icons'
import { coachActive } from '@/lib/coach-state'
import { answerTourAsk, tourAsk } from '@/lib/tour-screen'
import { challengeStageLaunch, endWalkthrough, focusMode, singingZenLaunch, walkthroughActive, } from '@/stores'

/** "Zen", "Zen and Long Note", "Zen, Long Note and Hairline". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The question's title and words for what closes, and the tour it opens. */
export function tourAskWords(
  names: readonly string[],
  tour: string,
): { title: string; message: string } {
  const list = listNames(names)
  const one = names.length <= 1
  // "the challenge" starts the title's sentence in the middle, the words' at the front.
  const lead = list.charAt(0).toUpperCase() + list.slice(1)
  return {
    title: `Leave ${list} for ${tour}?`,
    message: `${lead} ${one ? 'closes' : 'close'} so the tour can show the page under ${one ? 'it' : 'them'}. Anything still running there stops.`,
  }
}

export function TourScreenHost(): JSX.Element {
  const stageUp = createMemo(
    () =>
      focusMode() ||
      singingZenLaunch() !== null ||
      challengeStageLaunch() !== null,
  )
  createEffect(
    on(
      stageUp,
      (up) => {
        if (!up) return
        if (walkthroughActive()) endWalkthrough()
        if (coachActive() !== null) {
          void import('@/components/coach/start').then((coach) =>
            coach.endCoachTour(),
          )
        }
      },
      { defer: true },
    ),
  )

  const words = createMemo(() => {
    const asked = tourAsk()
    return asked === null
      ? { title: '', message: '' }
      : tourAskWords(
          asked.detours.map((detour) => detour.name),
          asked.tour,
        )
  })

  return (
    <ConfirmDialog
      open={tourAsk() !== null}
      title={words().title}
      message={words().message}
      confirmLabel="Take the tour"
      confirmIcon={<IconArrowRight />}
      tone="primary"
      cancelLabel="Not now"
      onConfirm={() => answerTourAsk(true)}
      onCancel={() => answerTourAsk(false)}
    />
  )
}
