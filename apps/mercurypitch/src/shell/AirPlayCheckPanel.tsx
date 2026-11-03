// ============================================================
// AirPlay sound check: five ways of making sound, one button each
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
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), so a store build carries none of it.

import type { Component } from 'solid-js'
import { createSignal, For } from 'solid-js'
import type { CheckVariant } from './airplay-check'
import { CHECK_VARIANTS, runCheck } from './airplay-check'

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
  return (
    <div class="mp-dev__audio" data-testid="dev-airplay-check">
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
