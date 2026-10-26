// ============================================================
// startKaraokeTour — Karaoke Night's one door to Merc's tour
// ============================================================
//
// KaraokeNightApp loads this with import() when the tour is asked for (an
// ad's `?tour=first`, or a tap on the first-visit chip), so the coach, the
// tour and its credits line cost the page's first paint nothing.
//
// - The consent bar first, for the tour nobody tapped for. An ad's landing
//   starts the tour once the bar is answered: the visitor answers it before
//   going on (spec 7), and the showcase waits for it the same way. A tap on
//   the chip is the visitor asking, so that tour starts at once, under the
//   bar, which stays on top (the coach's layer is z-index 900).
// - A tour that has started spends the first-visit offer, so the chip never
//   offers a tour that was just shown. One whose coach did not load spends
//   nothing, and the failure goes back to the caller (KaraokeNightApp), which
//   leaves the page as it was.
// - The phone's steps and layout wherever the page draws the phone stage
//   (narrow, or a phone on its side): that is where the tour's mic and score
//   are drawn.

import { createEffect, createRoot } from 'solid-js'
import { startCoachTour } from '@/components/coach/start'
import { isConsentBannerOpen } from '@/lib/consent'
import { isPhoneStage } from '@/lib/use-viewport'
import { KARAOKE_TOUR, loadKaraokeCredits } from './karaoke-tour'
import { spendTourOffer } from './karaoke-tour-offer'

/** Settles once the consent bar is not open: at once, when it never was. */
export function consentAnswered(): Promise<void> {
  return new Promise((resolve) => {
    createRoot((dispose) => {
      createEffect(() => {
        if (isConsentBannerOpen()) return
        dispose()
        resolve()
      })
    })
  })
}

export interface KaraokeTourAsk {
  /** An ad's landing: wait until the consent bar is answered. */
  afterConsent: boolean
}

/** Runs Merc's tour of Karaoke Night; rejects when the coach did not load. */
export async function startKaraokeTour(ask: KaraokeTourAsk): Promise<void> {
  if (ask.afterConsent) await consentAnswered()
  loadKaraokeCredits()
  await startCoachTour(KARAOKE_TOUR, { phone: isPhoneStage() })
  spendTourOffer()
}
