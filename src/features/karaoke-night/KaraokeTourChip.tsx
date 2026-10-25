// ============================================================
// KaraokeTourChip — Karaoke Night's first-visit offer of Merc's tour
// ============================================================
//
// The coach's chip (TourChip), in the page's own flow under the top bar,
// where the app puts it by the page title. KaraokeNightApp mounts it only on
// a first visit to an empty stage, and loads it then, so the page's first
// paint carries none of it. The offer is spent as the chip shows
// (karaoke-tour-offer.ts), and storage that will not record it shows no chip.

import type { JSX } from 'solid-js'
import { onMount, Show } from 'solid-js'
import { TourChip } from '@/components/coach/TourChip'
import { trackTour } from '@/lib/guide-funnel'
import { spendTourOffer } from './karaoke-tour-offer'

export interface KaraokeTourChipProps {
  onStart: () => void
  onDismiss: () => void
}

export function KaraokeTourChip(props: KaraokeTourChipProps): JSX.Element {
  const shown = spendTourOffer()
  onMount(() => {
    if (shown) trackTour('tour_offer', 'karaoke-night')
  })
  return (
    <Show when={shown}>
      <div class="kn-tour-slot">
        <TourChip onStart={props.onStart} onDismiss={props.onDismiss} />
      </div>
    </Show>
  )
}
