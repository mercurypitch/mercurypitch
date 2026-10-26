// ============================================================
// KaraokeTourChip — Karaoke Night's first-visit offer of Merc's tour
// ============================================================
//
// The coach's chip (TourChip), in the page's own flow under the top bar,
// where the app puts it by the page title. KaraokeNightApp mounts it only on
// a first visit to an empty stage, and loads it then, so the page's first
// paint carries none of it. The offer is spent as the chip shows
// (karaoke-tour-offer.ts), and storage that will not record it shows no chip.
// A chip shown again for an offer handed back (a tour that did not load) is
// that same offer: it is not spent or reported again as it shows.
// Its line says what the tour does here, sing the demo, in place of the
// coach's own, which promises 30 s: the demo song alone runs over four
// minutes.

import type { JSX } from 'solid-js'
import { onMount, Show, untrack } from 'solid-js'
import { TourChip } from '@/components/coach/TourChip'
import { trackTour } from '@/lib/guide-funnel'
import { spendTourOffer } from './karaoke-tour-offer'

/** What the chip offers on Karaoke Night. */
export const KARAOKE_CHIP_LINE = 'Sing the demo with Merc'

export interface KaraokeTourChipProps {
  onStart: () => void
  onDismiss: () => void
  /** The offer a tour that did not load handed back, shown again. */
  handedBack?: boolean
}

export function KaraokeTourChip(props: KaraokeTourChipProps): JSX.Element {
  // Read once: each offer is a chip of its own.
  const again = untrack(() => props.handedBack === true)
  const shown = again || spendTourOffer()
  onMount(() => {
    if (shown && !again) trackTour('tour_offer', 'karaoke-night')
  })
  return (
    <Show when={shown}>
      <div class="kn-tour-slot">
        <TourChip
          line={KARAOKE_CHIP_LINE}
          onStart={props.onStart}
          onDismiss={props.onDismiss}
        />
      </div>
    </Show>
  )
}
