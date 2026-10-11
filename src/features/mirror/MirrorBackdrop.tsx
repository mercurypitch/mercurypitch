// ============================================================
// Voice Mirror backdrop — which onboarding plate sits behind which screen.
// ============================================================
//
// The Mirror reuses First Light's pictures rather than art of its own (owner
// decision 2, 11 Oct 2026): Merc's sky behind the start screen, the plain sky
// stepped back behind everything that brings its own pictures (the demos, the
// twin's portrait), and nothing behind the results, where the voiceprint card
// is the picture. A shared card gets Merc's sky, stepped back, where he
// stands beside the words (a wide window), and no picture where he would
// stand behind the card (a phone held upright, where he is painted at the
// top).
//
// The plates are CSS backgrounds (mirror.css), picked by aspect ratio like
// the onboarding's: a phone held upright only ever asks for the tall cut.
// Merc's plate covers the whole viewport, which keeps it out of Largest
// Contentful Paint (Chrome skips full-viewport images): the landing's LCP is
// its promise paragraph, so nothing here is preloaded. A phone downloads the
// plate only once the start screen is up (mirror.css, `.entry-prelude`).

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'

/** What the shell is showing, as far as the backdrop is concerned. */
export type MirrorScreen = 'landing' | 'shared' | 'flow' | 'results'

/** `sky-aside`: Merc's sky, stepped back, on a wide window; none on a tall
 *  one. */
export type MirrorPlate = 'sky' | 'sky-aside' | 'plain' | 'none'

const PLATE_FOR_SCREEN: Record<MirrorScreen, MirrorPlate> = {
  landing: 'sky',
  // The sender's card opens the screen. On a phone Merc would stand behind
  // it and the heading above it, so there is no picture there.
  shared: 'sky-aside',
  flow: 'plain',
  results: 'none',
}

export function plateFor(screen: MirrorScreen): MirrorPlate {
  return PLATE_FOR_SCREEN[screen]
}

export interface MirrorBackdropProps {
  plate: MirrorPlate
}

/** A fixed layer under the page. Each new plate mounts fresh, so it fades in
 *  over the ground instead of swapping in a frame. */
export function MirrorBackdrop(props: MirrorBackdropProps): JSX.Element {
  return (
    <div class="mirror-backdrop" aria-hidden="true">
      <Show when={props.plate === 'none' ? null : props.plate} keyed>
        {(plate) => <div class="mirror-plate" data-plate={plate} />}
      </Show>
    </div>
  )
}
