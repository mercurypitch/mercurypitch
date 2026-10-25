// ============================================================
// Karaoke Night's tour offer — what the first paint knows of Merc's tour
// ============================================================
//
// Only what decides whether the page asks for the tour, so the first paint
// carries a few lines and no coach. The tour, its chip and the coach load
// with import() when one is asked for (start-karaoke-tour.ts,
// KaraokeTourChip.tsx).
//
// - One offer per visitor, ever, as in the app (TourChipHost): the key is
//   written as the chip shows or as the tour starts, and storage that will
//   not take it means no chip, since the offer would come back on every visit.
// - Karaoke Night's own documents only. The vocal remover's landing shares
//   this entry (vocal-remover.html) for a different job, and its visitors
//   came to split a song, not to sing the demo (R23).

/** The app's key for a page's first-visit tour offer, for this page. */
export const KARAOKE_TOUR_OFFER_KEY =
  'pitchperfect_page_tour_offered_karaoke-night'

/** Whether Merc's tour belongs on the document at `pathname`. */
export function tourBelongsAt(pathname: string): boolean {
  return !pathname.startsWith('/vocal-remover')
}

/** True while the first-visit offer has not been made. */
export function tourOfferDue(): boolean {
  try {
    return localStorage.getItem(KARAOKE_TOUR_OFFER_KEY) !== 'true'
  } catch {
    return false
  }
}

/** Records the offer as made; false when storage will not take it. */
export function spendTourOffer(): boolean {
  try {
    localStorage.setItem(KARAOKE_TOUR_OFFER_KEY, 'true')
    return true
  } catch {
    return false
  }
}
