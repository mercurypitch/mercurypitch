// ============================================================
// Then-and-now card — the weekly Check-up's share card, with Merc on it
// ============================================================
//
// The Progress share card (share-card.ts), and honest the same way: a plain
// claim, then only measured values and the changes the Check-up names
// (thenAndNowFacts in src/lib/check-up/then-and-now.ts leaves every change
// under its threshold off the card), the two dates, and Merc. No name, handle
// or email: none is passed, so the renderer draws none.
//
// The face prints the Mirror's bare address and the share text carries the
// Mirror's tagged link (card-renderer.ts says why the two strings differ).
// Delivery is the Progress card's own: the Web Share sheet where there is one,
// a saved PNG where there is not.
//
// Merc is a copy of Lesson 1's blue still in src/assets/merc/, the place for
// art more than one feature draws, so this card does not reach into the
// lessons for it.

import mercBlueUrl from '@/assets/merc/merc-blue.png'
import type { ThenAndNow } from '@/lib/check-up/then-and-now'
import { periodLine, thenAndNowFacts } from '@/lib/check-up/then-and-now'
import { MIRROR_SHARE_URL } from '@/lib/mirror/shared-voiceprint'
import type { ProgressShareExportStatus, ProgressShareFormat, ProgressShareMoment, ProgressShareRenderOptions, } from './share-card'
import { exportProgressShareCard, renderProgressShareCard } from './share-card'

export const THEN_AND_NOW_CLAIM = 'My Check-up, then and now'

/** Merc's still, as the bundle serves it. */
export const THEN_AND_NOW_MERC_URL: string = mercBlueUrl

/** "mercurypitch.com/mirror": the tagged share link without its scheme or tag. */
function bareMirrorAddress(): string {
  const url = new URL(MIRROR_SHARE_URL)
  return `${url.host}${url.pathname}`
}

/** What the card says, from the comparison and the practice in between. */
export function thenAndNowMoment(
  comparison: ThenAndNow,
  practice: number,
): ProgressShareMoment {
  return {
    claim: THEN_AND_NOW_CLAIM,
    kicker: 'Weekly Check-up',
    facts: thenAndNowFacts(comparison, practice),
    period: periodLine(comparison),
    site: bareMirrorAddress(),
  }
}

/** The card at export size, Merc on it. */
export function renderThenAndNowCard(
  comparison: ThenAndNow,
  practice: number,
  format: ProgressShareFormat,
  options: ProgressShareRenderOptions = {},
): Promise<HTMLCanvasElement> {
  return renderProgressShareCard(
    thenAndNowMoment(comparison, practice),
    format,
    {
      mascotUrl: THEN_AND_NOW_MERC_URL,
      ...options,
    },
  )
}

function filename(): string {
  const day = new Date()
  const two = (n: number): string => String(n).padStart(2, '0')
  return `check-up-then-and-now-${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}.png`
}

/** Share the drawn card, or save it where there is no share sheet. */
export function shareThenAndNowCard(
  canvas: HTMLCanvasElement,
  shouldDeliver?: () => boolean,
): Promise<ProgressShareExportStatus> {
  return exportProgressShareCard(canvas, {
    filename: filename(),
    title: THEN_AND_NOW_CLAIM,
    text: `${THEN_AND_NOW_CLAIM}: ${MIRROR_SHARE_URL}`,
    shouldDeliver,
  })
}
