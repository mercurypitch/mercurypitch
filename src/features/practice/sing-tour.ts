// ============================================================
// SING_TOUR — Merc's first-job tour of the Sing tab
// ============================================================
//
// Four stops, on a phone and on a wide screen alike: the mic, a sung note,
// what the line means, and where a kept take is played back. The coach loads
// it when the tour starts (coach-tours.ts), so it costs the tab nothing until
// then, and it imports only the coach's types and the page's mic light.
//
// - The first stop is the mic, not Play: the mic is what makes Merc listen,
//   and Play does not turn it on (R18). The phone's mic keeps its legacy hook
//   (`singing-transport`, which the old Sing tour also names) and the wide
//   screen's bar names its own (`sing.mic`, on the shared MicButton).
// - It waits for the mic to start (`mic-on`, from the practice controller
//   once the engine has it), not for the tap: a tap on a refused mic starts
//   nothing. A mic already on when the stop shows counts as done (the page's
//   mic light, mic-store), and one that will not start (`mic-failed`) adds
//   how to let Merc hear. Skip stays.
// - A target may list one hook per screen: each screen draws only its own, and
//   the first one laid out is the one ringed (find-target.ts). The line lives
//   in the phone stage's canvas wrapper and in the desktop's #canvas-container.
// - On a wide screen the canvas is too tall to ring, so the line's two stops
//   stand in the top right corner, chosen by measurement at 1440x900: the
//   live marker draws "now" down the canvas's left edge, at the height of the
//   sung note, so the left corners would hide it for a high or a low voice;
//   the bottom right would hide the lowest note labels, down the right edge,
//   and the Monitor's status line. The top right clears all three.
// - The web's Sing tab keeps no takes of its own: a run's score shows when it
//   ends, and the takes kept to play back are Hear Yourself's. So the last
//   stop points there: on a phone at More, which always holds it, and on a
//   wide screen at the You group, which holds it beside Home and Progress
//   (at 1440 px the bar folds Hear Yourself's own tab into the group's menu,
//   so the tab itself is not always there to ring). No line says "here",
//   which would point at nothing if the bubble stood centred.
// - The last stop offers "Show me more" beside Done: a second tour, where
//   Merc sings through the tab (sing-more-tour.ts), loaded only on the tap.
//   Done on the last stop of either gives the same hand-over.
//
// The lines are drafts for maff's copy pass.

import type { CoachTour } from '@/lib/coach-types'
import { micActive } from '@/stores/mic-store'

const LINE = '[data-stage-canvas], #canvas-container'

const LESSON_1 = {
  href: '/learn/01',
  title: 'Why the line moves: Lesson 1, What is a note?',
}

export const SING_TOUR: CoachTour = {
  key: 'sing',
  more: {
    key: 'sing-more',
    label: 'Show me more',
    load: async () => import('./sing-more-tour').then((m) => m.SING_MORE_TOUR),
  },
  steps: [
    {
      id: 'mic',
      kind: 'do',
      waitFor: 'mic-on',
      doneAlready: micActive,
      failure: {
        event: 'mic-failed',
        aside: {
          title: "Merc can't hear you yet.",
          sub: 'Allow the microphone, then tap the mic again.',
        },
      },
      target: '[data-tour="singing-transport"], [data-tour="sing.mic"]',
      // A wide screen's mic is on the bar: shown if the singer dismissed it.
      screen: ['sing.bar'],
      merc: 'point',
      title: 'Start the mic',
      body: 'Tap the mic and Merc starts listening. Only you can hear you.',
    },
    {
      id: 'sing',
      kind: 'do',
      waitFor: 'pitch-detected',
      sound: 'hold-tone',
      target: LINE,
      // The line is drawn in Melody; Notation shows sheet music in its place.
      screen: ['sing.melody'],
      corner: 'top-right',
      merc: 'listen',
      title: 'Sing any note',
      body: "Hold one note, any note. Here's one you can copy.",
    },
    {
      id: 'line',
      kind: 'show',
      target: LINE,
      screen: ['sing.melody'],
      corner: 'top-right',
      merc: 'point',
      title: 'That line is your voice',
      body: 'Higher notes climb, lower notes sink. On the note, the line sits on the bar.',
    },
    {
      id: 'takes',
      kind: 'watch',
      viewport: 'phone',
      target: '[data-tour="mobile-tabbar-more"]',
      merc: 'idle',
      title: 'Keep a take',
      body: 'Hear Yourself, under More, records you and keeps each take to play back.',
      lesson: LESSON_1,
    },
    {
      id: 'takes',
      kind: 'watch',
      viewport: 'desktop',
      target: '[data-tab-group="you"]',
      merc: 'idle',
      title: 'Keep a take',
      body: 'Hear Yourself sits with Home and Progress. It records you and keeps each take to play back.',
      lesson: LESSON_1,
    },
  ],
}
