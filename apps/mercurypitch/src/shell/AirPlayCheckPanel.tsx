// ============================================================
// AirPlay sound check: seven ways of making sound, one button each
// ============================================================
//
// The Developer screen's section for the decisive AirPlay test (owner, 3 Nov
// 2026): with the TV chosen under AirPlay in Control Center, tap each button
// and say which ones the TV played. Each beeps its own number of times, so
// the count says which it was (airplay-check.ts, which also says what each
// stands for and writes the line each tap leaves in the console).
//
// One at a time: the buttons wait while a check plays and is torn down.
//
// Above them, a readout that follows the app as it runs: the AirPlay guess
// now, the last output check (its rate, when it ran, why, and whether inside
// a gesture) and what may play beside the room's sound (airplay-readout.ts).
// Test 13 reads it after a cold start and as AirPlay comes and goes.
//
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), so a store build carries none of it.

import type { Component } from 'solid-js'
import { createSignal, For, Index } from 'solid-js'
import { airPlayFacts } from '@/stores/airplay-suspicion'
import { lastOutputCheck, webAudioAlone } from '@/stores/output-check'
import type { CheckVariant } from './airplay-check'
import { CHECK_VARIANTS, runCheck } from './airplay-check'
import { airPlayReadout } from './airplay-readout'

export interface AirPlayCheckPanelProps {
  /** Test seam: the check a tap runs. */
  readonly run?: (n: CheckVariant) => Promise<void>
}

/** The button's words: the beeps first, since they are what is heard. */
export function beepsLabel(n: CheckVariant): string {
  return `${String(n)} ${n === 1 ? 'beep' : 'beeps'}`
}

export const AirPlayCheckPanel: Component<AirPlayCheckPanelProps> = (props) => {
  const [playing, setPlaying] = createSignal<CheckVariant | null>(null)
  // The buttons are disabled the moment one starts, so a second tap never
  // lands while a check plays.
  const play = (n: CheckVariant): void => {
    setPlaying(n)
    // The check starts its sound inside this tap, before its first await.
    const run = props.run ?? runCheck
    void run(n)
      .catch(() => undefined)
      .finally(() => setPlaying(null))
  }
  const rows = () =>
    airPlayReadout({
      facts: airPlayFacts(),
      check: lastOutputCheck(),
      alone: webAudioAlone(),
    })
  return (
    <div class="mp-dev__audio" data-testid="dev-airplay-check">
      <dl class="mp-dev__readout" data-testid="dev-airplay-readout">
        <Index each={rows()}>
          {(row) => (
            <div class="mp-dev__readout-row">
              <dt>{row().label}</dt>
              <dd>{row().value}</dd>
            </div>
          )}
        </Index>
      </dl>
      <p class="mp-dev__row-sub">
        Choose the TV under AirPlay in Control Center, then tap each one and
        note which ones the TV plays. Each beeps its own number of times.
      </p>
      <For each={CHECK_VARIANTS}>
        {(variant) => (
          <button
            type="button"
            class="mp-dev__row"
            data-testid={`dev-airplay-check-${String(variant.n)}`}
            disabled={playing() !== null}
            onClick={() => play(variant.n)}
          >
            <span class="mp-dev__row-title">
              {beepsLabel(variant.n)}: {variant.title}
            </span>
            <span class="mp-dev__row-sub">
              {playing() === variant.n ? 'Playing…' : variant.sub}
            </span>
          </button>
        )}
      </For>
    </div>
  )
}
