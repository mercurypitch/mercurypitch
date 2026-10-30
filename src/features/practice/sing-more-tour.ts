// ============================================================
// SING_MORE_TOUR — "Show me more": Merc sings through the Sing tab
// ============================================================
//
// The Sing tour's last stop offers "Show me more" beside Done (sing-tour.ts,
// `more`); a tap starts this tour in its place. It loads only then, with the
// demo it runs (sing-demo.ts), as one chunk. At each stop Merc sings a short
// melody through the tab itself, the way the rooms' demos do, while the ring
// stands on the control the stop is about:
//
// - Repeat. Twice round, one note flat the first time and on it the second.
//   The ring is on Repeat: the wide bar's Repeat button, or the phone stage's
//   play-mode button, which reads Repeat while he sings.
// - Spaced rest. Once through with a half rest after each note, the rests
//   silent. Wide screens only: the phone stage has no Spaced rest to ring,
//   or to set.
//
// Both keep a wide screen's bubble in the top right corner, as the Sing
// tour's line stops do (sing-tour.ts), so it stands off his line; on a phone
// the bubble docks as every stop's does. Zen is not here: its stage runs its
// own session, which opens the mic and keeps every pass as a take, so it has
// no way yet to take a scripted voice.
//
// The lines are drafts for maff's copy pass.

import type { CoachTour } from '@/lib/coach-types'
import { startSingDemo } from './sing-demo'

export const SING_MORE_TOUR: CoachTour = {
  key: 'sing-more',
  steps: [
    {
      id: 'repeat',
      kind: 'show',
      target: '[data-tour="sing.mode"], [data-tour="sing.repeat"]',
      // Merc's run is drawn on the line, in Melody, and Repeat is on the bar.
      screen: ['sing.melody', 'sing.bar'],
      keepCorner: true,
      corner: 'top-right',
      merc: 'point',
      title: 'Repeat goes round again',
      body: 'Repeat plays your melody round and round. Watch Merc fix his flat note the second time.',
      run: () => startSingDemo('repeat'),
    },
    {
      id: 'rests',
      kind: 'show',
      viewport: 'desktop',
      target: '[data-tour="sing.rest"]',
      screen: ['sing.melody', 'sing.bar'],
      keepCorner: true,
      corner: 'top-right',
      merc: 'point',
      title: 'Spaced rest leaves a gap',
      body: 'A rest after each note gives you time to breathe and hear the next one coming.',
      run: () => startSingDemo('rests'),
    },
  ],
}
