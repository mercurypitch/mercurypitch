// ============================================================
// GravityDrill — Home on the chromatic twelve.
//
// The same controller, cadence and mic path as Home, over the
// GRAVITY_SET: twelve degrees, twelve pads, rated under 'gravity'
// (tap) and 'gravity-sing' (mic) with a 1/12 guess floor. Function
// hearing past the diatonic seven — where does ♭6 sit, where ♯4.
// ============================================================

import type { JSX } from 'solid-js'
import { GRAVITY_SET } from '@/lib/ear/item-bank'
import type { HomeDrillCopy } from './HomeDrill'
import { HomeDrill } from './HomeDrill'

export const GRAVITY_COPY: HomeDrillCopy = {
  drillId: 'gravity',
  name: 'Gravity',
  measures: 'Function · chromatic',
  micConsumer: 'ear-gravity-drill',
  padLabel: 'Which of the twelve was that?',
  columns: 6,
  prompt: 'A cadence, then one note — any of the twelve. Which?',
  description:
    'A cadence plants the key and one note sounds — any of the twelve, not just the scale. Name it: the diatonic seven by number, the others by their leaning (♭2, ♭3, ♯4, ♭6, ♭7). Tap answers rate under Gravity with a one-in-twelve guess floor; sung or played answers rate on their own track and never touch the yardsticks.',
  ratingUnit: 'Gravity rating',
  keycaps: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
}

export function GravityDrill(props: { onBack: () => void }): JSX.Element {
  return (
    <HomeDrill onBack={props.onBack} set={GRAVITY_SET} copy={GRAVITY_COPY} />
  )
}
