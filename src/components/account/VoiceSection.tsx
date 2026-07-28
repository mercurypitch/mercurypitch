// ============================================================
// VoiceSection — your voiceprints, and how they've moved
// ============================================================
//
// The other half of the promise beat 7 makes. Onboarding says "keep
// your twin and watch your range grow"; this is where that turns out
// to be true.
//
// The growth line is `computeDelta`, which already existed — it was
// just anchored to one local baseline. Given a history it becomes a
// real timeline, which is the difference between a novelty and a
// reason to come back in March.
//
// Signed out this still works, on whatever the device holds. The
// difference an account makes is stated rather than hidden behind a
// locked panel.

import type { Component } from 'solid-js'
import { createResource, For, Show } from 'solid-js'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { listVoiceprints, LOCAL_CAP } from '@/db/services/voiceprint-service'
import { LegendCaricature } from '@/features/mirror/LegendCaricature'
import { computeDelta } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import styles from './VoiceSection.module.css'

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** "+3 semitones", "−2 steadiness" — sign always shown, zero omitted. */
function formatDelta(value: number | null, unit: string): string | null {
  if (value === null || Math.round(value) === 0) return null
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)} ${unit}`
}

export interface VoiceSectionProps {
  /** True when signed in — changes what we say about durability. */
  signedIn: boolean
}

export const VoiceSection: Component<VoiceSectionProps> = (props) => {
  const [prints] = createResource(listVoiceprints)

  const latest = (): VoiceprintRecord | null => prints()?.[0] ?? null
  const first = (): VoiceprintRecord | null => {
    const all = prints()
    return all !== undefined && all.length > 1 ? all[all.length - 1] : null
  }

  // Growth is measured against the FIRST take, not the previous one:
  // "since you started" is the story, and take-to-take noise would
  // otherwise swamp it.
  const growth = () => {
    const from = first()
    const to = latest()
    if (from === null || to === null) return null
    return computeDelta(from.summary, to.summary)
  }

  return (
    <div class={styles.section}>
      <h3 class={styles.heading}>Your voice</h3>

      <Show
        when={latest() !== null}
        fallback={
          <p class={styles.empty}>
            No voiceprint yet. Take the guided voice map from the home screen
            and your range, steadiness and twin will show up here.
          </p>
        }
      >
        <div class={styles.latest}>
          <Show when={latest()?.twin != null && latest()?.twin !== ''}>
            <span class={styles.twin} aria-hidden="true">
              <LegendCaricature legend={latest()?.twin ?? ''} />
            </span>
          </Show>
          <div class={styles.latestBody}>
            <Show when={latest()?.twin != null && latest()?.twin !== ''}>
              <p class={styles.twinName}>{latest()?.twin}</p>
            </Show>
            <div class={styles.stats}>
              <Show when={latest()?.summary.lowMidi != null}>
                <span>
                  <b>
                    {midiToNoteNameOctave(latest()?.summary.lowMidi ?? 0)}–
                    {midiToNoteNameOctave(latest()?.summary.highMidi ?? 0)}
                  </b>{' '}
                  range
                </span>
              </Show>
              <Show when={latest()?.summary.steadiness != null}>
                <span>
                  <b>{latest()?.summary.steadiness}</b> steadiness
                </span>
              </Show>
              <Show when={latest()?.summary.accuracy != null}>
                <span>
                  <b>{Math.round(latest()?.summary.accuracy ?? 0)}</b> accuracy
                </span>
              </Show>
            </div>

            <Show when={growth() !== null && first() !== null}>
              <p class={styles.growth}>
                Since {formatDate(first()?.takenAt ?? '')}:{' '}
                <For
                  each={[
                    formatDelta(growth()?.semitones ?? null, 'semitones'),
                    formatDelta(growth()?.steadiness ?? null, 'steadiness'),
                    formatDelta(growth()?.accuracy ?? null, 'accuracy'),
                  ].filter((line): line is string => line !== null)}
                  fallback={
                    <span class={styles.growthFlat}>holding steady</span>
                  }
                >
                  {(line, i) => (
                    <>
                      {i() > 0 ? ', ' : ''}
                      <b>{line}</b>
                    </>
                  )}
                </For>
              </p>
            </Show>
          </div>
        </div>

        <Show when={(prints()?.length ?? 0) > 1}>
          <ol class={styles.history}>
            <For each={prints()?.slice(0, 8)}>
              {(print) => (
                <li class={styles.historyRow}>
                  <span class={styles.historyDate}>
                    {formatDate(print.takenAt)}
                  </span>
                  <span class={styles.historyMeta}>
                    <Show when={print.summary.semitones != null}>
                      {print.summary.semitones} semitones
                    </Show>
                  </span>
                </li>
              )}
            </For>
          </ol>
        </Show>

        <p class={styles.note}>
          <Show
            when={props.signedIn}
            fallback={
              <>
                These live on this device only, and the last {LOCAL_CAP} are
                kept. Create an account above and they follow you everywhere,
                with no limit.
              </>
            }
          >
            Saved to your account — on every device, with no limit.
          </Show>
        </p>
      </Show>
    </div>
  )
}

export default VoiceSection
