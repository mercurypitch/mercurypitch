// ============================================================
// A round's figure: the key's own chord, then the two of an ending
// ============================================================
//
// Three tiles. The first is the key's chord and says so; the other two are
// the ending, question marks until the round is answered. The tile whose
// chord is sounding lifts and lights. A run draws its round with this, and
// the setup screen draws the example's, so the singer has seen a round
// before the first one is asked.

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { romanOf } from '@/lib/ear/progressions'
import type { CadenceRound } from './cadence-rounds'
import { stepsOf } from './cadence-rounds'
import styles from './NameTheCadence.module.css'

export interface CadenceChordsProps {
  round: CadenceRound
  /** Which chord is sounding: 0, 1 or 2, or -1 for none. */
  sounding: number
  /** Whether the ending's two chords show their numerals. */
  revealed: boolean
  /** A right answer turns the ending green, a missed one yellow. */
  tone?: 'ask' | 'right' | 'wrong'
  testId: string
}

export function CadenceChords(props: CadenceChordsProps): JSX.Element {
  return (
    <div
      class={styles.chords}
      classList={{
        [styles.toneRight]: props.tone === 'right',
        [styles.toneWrong]: props.tone === 'wrong',
      }}
      data-testid={props.testId}
      aria-hidden="true"
    >
      <For each={stepsOf(props.round)}>
        {(step, i) => (
          <>
            <Show when={step.role === 'last'}>
              <span class={styles.arrow}>→</span>
            </Show>
            <div
              class={styles.chord}
              classList={{
                [styles.home]: step.role === 'home',
                [styles.sounding]: props.sounding === i(),
              }}
              data-role={step.role}
              data-sounding={props.sounding === i() ? 'true' : undefined}
            >
              <span class={styles.numeral}>
                {step.role === 'home' || props.revealed
                  ? romanOf(step.degree)
                  : '?'}
              </span>
              <span class={styles.role}>
                {step.role === 'home' ? 'home' : 'the ending'}
              </span>
            </div>
          </>
        )}
      </For>
    </div>
  )
}
