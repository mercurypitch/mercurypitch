// ============================================================
// GravityDrill — Home on the chromatic twelve.
//
// The same controller, cadence and mic path as Home, over the
// GRAVITY_SET: twelve degrees, twelve pads, rated under 'gravity'
// (tap) and 'gravity-sing' (mic) with a 1/12 guess floor. Function
// hearing past the diatonic seven — where does ♭6 sit, where ♯4.
//
// A lesson's link can narrow it to some of the twelve (Lesson 25's Te
// and Ti, lib/ear/subsets.ts): the set's pads only, rated on the set's
// own tracks.
// ============================================================

import type { JSX } from 'solid-js'
import { degreeLabel, GRAVITY_SET } from '@/lib/ear/item-bank'
import type { EarSubset } from '@/lib/ear/subsets'
import { countWord, listWords, narrowDegreeSet } from '@/lib/ear/subsets'
import type { HomeDrillCopy } from './HomeDrill'
import { HomeDrill } from './HomeDrill'

export const GRAVITY_COPY: HomeDrillCopy = {
  drillId: 'gravity',
  name: 'Gravity',
  measures: 'Function · chromatic',
  micConsumer: 'ear-gravity-drill',
  padLabel: 'Which of the twelve was that?',
  columns: 6,
  prompt: 'A cadence, then one note (any of the twelve). Which?',
  description:
    'A cadence plants the key and one note sounds (any of the twelve, not just the scale). Name it: the diatonic seven by number, the others by their leaning (♭2, ♭3, ♯4, ♭6, ♭7). Tap answers rate under Gravity with a one-in-twelve guess floor; sung or played answers rate on their own track and never touch the yardsticks.',
  ratingUnit: 'Gravity rating',
  keycaps: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
}

export function GravityDrill(props: {
  onBack: () => void
  /** A lesson's set of some of the twelve; the whole drill without. */
  subset?: EarSubset | null
}): JSX.Element {
  // A stage is mounted per drill and per set, never re-pointed.
  // eslint-disable-next-line solid/reactivity
  const subset = props.subset
  if (!subset) {
    return (
      <HomeDrill onBack={props.onBack} set={GRAVITY_SET} copy={GRAVITY_COPY} />
    )
  }
  const set = narrowDegreeSet(GRAVITY_SET, subset)
  // A set's note is one of its own, not any of the twelve.
  const labels = set.degrees.map(degreeLabel)
  return (
    <HomeDrill
      onBack={props.onBack}
      set={set}
      copy={{
        ...GRAVITY_COPY,
        prompt: `A cadence, then one note (${listWords(labels, 'or')}). Which?`,
        padLabel: `Which of the ${countWord(labels.length)} was that?`,
      }}
    />
  )
}
