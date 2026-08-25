// ============================================================
// Drum family balance — compact authored-kit shaping beside the source bus
// ============================================================
//
// This controlled surface never touches audio. It deliberately describes the
// authored kit so live performance remains visibly and behaviorally separate.

import type { JSX } from 'solid-js'
import { createMemo, createUniqueId, For, Show } from 'solid-js'
import type { DrumKitAuthoredFamily } from '../runtime/drum-pad-layout'
import styles from './DrumFamilyBalance.module.css'

export interface DrumFamilyBalanceRow {
  readonly id: DrumKitAuthoredFamily
  readonly label: string
  readonly level: number
  readonly muted: boolean
}

export interface DrumFamilyBalanceProps {
  families: readonly DrumFamilyBalanceRow[]
  selectedFamily: DrumKitAuthoredFamily
  onFamilySelect: (family: DrumKitAuthoredFamily) => void
  onFamilyLevelChange: (family: DrumKitAuthoredFamily, level: number) => void
  onFamilyMuteChange: (family: DrumKitAuthoredFamily, muted: boolean) => void
}

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 0
  return Math.min(1, Math.max(0, level))
}

function levelPercent(level: number): number {
  return Math.round(clampLevel(level) * 100)
}

export function DrumFamilyBalance(props: DrumFamilyBalanceProps): JSX.Element {
  const titleId = `drum-family-balance-${createUniqueId()}`
  const rangeId = `${titleId}-level`
  const selected = createMemo(() =>
    props.families.find((family) => family.id === props.selectedFamily),
  )

  return (
    <section class={styles.balance} aria-labelledby={titleId}>
      <div class={styles.heading}>
        <div>
          <span>AUTHORED KIT</span>
          <h3 id={titleId}>Kit pieces</h3>
        </div>
        <p>Authored kit only · your live hits stay independent.</p>
      </div>

      <div class={styles.familyRail} role="group" aria-label="Kit pieces">
        <For each={props.families}>
          {(family) => (
            <button
              type="button"
              class={styles.familyChip}
              data-family={family.id}
              data-muted={family.muted}
              aria-pressed={props.selectedFamily === family.id}
              onClick={() => props.onFamilySelect(family.id)}
            >
              <i aria-hidden="true" />
              <span>{family.label}</span>
              <small>
                {family.muted ? 'Muted' : `${levelPercent(family.level)}%`}
              </small>
            </button>
          )}
        </For>
      </div>

      <Show when={selected()}>
        {(family) => (
          <div class={styles.selectedControl} data-muted={family().muted}>
            <div class={styles.selectedIdentity}>
              <span>Selected piece</span>
              <strong>{family().label}</strong>
            </div>

            <label class={styles.levelControl} for={rangeId}>
              <span class={styles.screenReaderOnly}>
                {family().label} authored level
              </span>
              <input
                id={rangeId}
                type="range"
                min="0"
                max="100"
                step="1"
                value={levelPercent(family().level)}
                aria-label={`${family().label} authored level`}
                onInput={(event) =>
                  props.onFamilyLevelChange(
                    family().id,
                    Number(event.currentTarget.value) / 100,
                  )
                }
              />
            </label>

            <output
              for={rangeId}
              aria-label={`${family().label} authored level value`}
            >
              {levelPercent(family().level)}%
            </output>

            <button
              type="button"
              class={styles.muteButton}
              aria-label={`${family().muted ? 'Unmute' : 'Mute'} authored ${family().label}`}
              aria-pressed={family().muted}
              onClick={() =>
                props.onFamilyMuteChange(family().id, !family().muted)
              }
            >
              <i aria-hidden="true" />
              {family().muted ? 'Muted' : 'On'}
            </button>
          </div>
        )}
      </Show>
    </section>
  )
}
