// ============================================================
// KARAOKE_TOUR — Merc's first-job tour of Karaoke Night
// ============================================================
//
// Three stops, from the demo song to your own: put the demo on stage, sing
// along with the mic on, and where your own song goes in, with what that
// costs. The first two wait for the singer, and Skip moves on from either.
// Between the second and the last the tour waits for the song with nothing
// on screen (a quiet step: no bubble, ring or dim, and not counted, so the
// singer reads 1 of 3, 2 of 3, 3 of 3), and the last stop shows once the
// score card has closed, however it closed. A song that stops with no card
// to close (the mic was off), or the singer taking Back off the stage, ends
// the wait the same way. Another song staged during it ends the tour, so a
// later song's card never brings the last stop. The stage host tells the
// coach (src/lib/coach-events.ts) when a song is on stage, when a sung note
// arrives, when the score card closes, when a song stops with none and when
// Back is tapped. start-karaoke-tour.ts loads this with the coach, so the
// page's first paint carries none of it.
//
// - The demo: the hero's Sing this song, the one call to action an empty
//   stage has (karaoke.demo). Its tap stages the demo to play at once
//   (singDemo's autoPlay), so the line says the music starts.
// - The mic: the desktop mixer's keeps the hook the legacy mixer tour names
//   (mixer.mic, never renamed) and the phone stage's has its own
//   (karaoke.mic), as one selector list: each screen draws one (R20).
// - Your own song: the rail's Add a song, its card while the rail is open and
//   its icon while the rail is folded (karaoke.own-song). On a phone the
//   stage still covers the page, Add a song with it, when the score card
//   closes, so the stop rings the stage's Back (karaoke.stage-back), the way
//   there, and names it. It stands centred, off the stage's transport, and
//   without Back on screen (a stage with no way back) it names nothing.
// - Under it, the credits line the plan's Karaoke Night card says
//   (planCreditsLine), from what this page knows: who is signed in and their
//   balance (the standalone account, which fetches the balance on every
//   sign-in), the server's featured promo, and for a balance of none the
//   cheapest pack (credit-facts.ts, which the plan reads too). A build that
//   cannot take payment says nothing about credits.
//
// The lines are drafts for maff's copy pass.

import { createEffect, createRoot, createSignal } from 'solid-js'
import { planCreditsLine } from '@/components/billing/plan-credits'
import type { CoachAside, CoachTour } from '@/lib/coach-types'
import type { PackPrice } from '@/lib/credit-facts'
import { cheapestPack } from '@/lib/credit-facts'
import { CAN_TAKE_PAYMENT } from '@/lib/native-build'
import { credits, signedIn } from '@/lib/standalone-account'
import { loadFeaturedPromo, offeredPromo } from '@/stores/promo-store'

const [pack, setPack] = createSignal<PackPrice | null>(null)

/** The plan card's credits line, as the last stop's aside; null says nothing. */
export function karaokeCreditsAside(): CoachAside | null {
  const line = planCreditsLine({
    canTakePayment: CAN_TAKE_PAYMENT,
    signedIn: signedIn(),
    gift: offeredPromo(),
    balance: credits(),
    cheapestPack: pack(),
  })
  return line === null ? null : { title: line.title, sub: line.sub }
}

let loading = false

/**
 * Starts fetching what the credits line needs, once per page: the featured
 * promo (a new visitor's gift), and the cheapest pack as soon as a signed-in
 * balance reads none. Nothing on a build that cannot take payment.
 */
export function loadKaraokeCredits(): void {
  if (!CAN_TAKE_PAYMENT || loading) return
  loading = true
  void loadFeaturedPromo()
  let asked = false
  // Page-long, as the account it watches is: a balance can reach none after
  // the tour starts (a sign-in, a song split), and the line is read later.
  createRoot(() => {
    createEffect(() => {
      if (asked || !signedIn() || credits() !== 0) return
      asked = true
      void cheapestPack().then(setPack)
    })
  })
}

const OWN_SONG = {
  id: 'own-song',
  kind: 'show',
  merc: 'point',
  title: 'Bring your own song',
  body: 'Add any song. The Cloud GPU takes the voice out, so you sing over the band.',
  aside: karaokeCreditsAside,
} as const

export const KARAOKE_TOUR: CoachTour = {
  key: 'karaoke-night',
  steps: [
    {
      id: 'demo',
      kind: 'do',
      waitFor: 'song-staged',
      target: '[data-tour="karaoke.demo"]',
      merc: 'point',
      title: 'Start with the demo',
      body: 'Tap Sing this song and the music starts.',
    },
    {
      id: 'mic',
      kind: 'do',
      waitFor: 'pitch-detected',
      target: '[data-tour="karaoke.mic"], [data-tour="mixer.mic"]',
      merc: 'listen',
      title: 'Sing along',
      body: 'Tap the mic and sing along. Your score shows when the song ends.',
    },
    {
      id: 'score',
      kind: 'do',
      quiet: true,
      waitFor: 'score-closed',
      alsoFor: ['song-unscored', 'stage-left'],
      endsOn: ['song-staged'],
      merc: 'listen',
      title: 'Sing to the end',
      body: 'Nothing on screen: the song has the stage until its score card closes.',
    },
    {
      ...OWN_SONG,
      viewport: 'desktop',
      target: '[data-tour="karaoke.own-song"]',
    },
    {
      ...OWN_SONG,
      viewport: 'phone',
      target: '[data-tour="karaoke.stage-back"]',
      body: 'Tap Back to add any song. The Cloud GPU takes the voice out, so you sing over the band.',
      unseen: OWN_SONG.body,
      phoneCentred: true,
    },
  ],
}
