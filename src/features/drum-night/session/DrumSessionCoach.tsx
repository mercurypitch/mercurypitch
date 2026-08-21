// ============================================================
// Drum Session Coach — measured timing/dynamics with recovery
// ============================================================
//
// The coach renders the pure evidence result and can request a bounded loop
// from its owner. It owns no recorder, timer, transport, or playback state.

import type { Accessor, JSX } from 'solid-js'
import { createMemo, createUniqueId, Show } from 'solid-js'
import { barIndexAtBeat } from '@/lib/midi-bars'
import type { DrumCapturedHit, DrumCoachingOptions, DrumRecoveryLoop, } from './drum-coaching'
import { coachDrumSession } from './drum-coaching'
import type { DrumScoreIndex } from './drum-score'
import { createDrumScoreIndex } from './drum-score'
import type { DrumSessionImportState } from './drum-session'
import { readyDrumSessionDocument } from './drum-session'
import styles from './DrumNightSessionViews.module.css'
import { DrumSessionStateView } from './DrumSessionStateView'

export interface DrumSessionCoachProps {
  session: Accessor<DrumSessionImportState>
  playheadBeat: Accessor<number>
  capturedHits: Accessor<readonly DrumCapturedHit[]>
  /** Reuse one whole-song index across score, seat and coaching surfaces. */
  scoreIndex?: Accessor<DrumScoreIndex | null>
  options?: Accessor<DrumCoachingOptions>
  onRequestRecoveryLoop?: (loop: DrumRecoveryLoop) => void
}

function signedMeasurement(value: number | null, unit: string): string {
  if (value === null) return 'Not available'
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded} ${unit}`
}

export function DrumSessionCoach(props: DrumSessionCoachProps): JSX.Element {
  const titleId = `drum-coach-title-${createUniqueId()}`
  const document = createMemo(() => readyDrumSessionDocument(props.session()))
  const index = createMemo(() => {
    const provided = props.scoreIndex?.()
    if (provided !== undefined && provided !== null) return provided
    const current = document()
    return current === null ? null : createDrumScoreIndex(current)
  })
  const score = createMemo(() => index()?.score ?? null)
  const result = createMemo(() => {
    const current = document()
    const currentIndex = index()
    return current === null || currentIndex === null
      ? null
      : coachDrumSession(
          current,
          props.capturedHits(),
          props.options?.() ?? {},
          currentIndex,
        )
  })
  const currentBarNumber = createMemo(() => {
    const current = score()
    if (current === null) return null
    return barIndexAtBeat(current.bars, props.playheadBeat()) + 1
  })

  return (
    <Show
      when={result()}
      keyed
      fallback={<DrumSessionStateView state={props.session} context="coach" />}
    >
      {(coaching) => (
        <aside
          class={styles.coach}
          aria-labelledby={titleId}
          data-evidence-scope={coaching.evidenceScope}
        >
          <header class={styles.coachHeader}>
            <div>
              <span class={styles.viewKicker}>Captured evidence</span>
              <h2 id={titleId}>Phrase coach</h2>
            </div>
            <span class={styles.coachBar}>Bar {currentBarNumber() ?? '—'}</span>
          </header>

          <div class={styles.evidenceLabels}>
            <span>{coaching.dataSourceLabel}</span>
            <span>{coaching.confidenceLabel}</span>
          </div>

          <p class={styles.coachObservation}>{coaching.observation}</p>

          <dl class={styles.coachMetrics}>
            <div>
              <dt>Matched attacks</dt>
              <dd>
                {coaching.matchedHitCount} / {coaching.targetHitCount}
              </dd>
            </div>
            <div>
              <dt>Timing offset</dt>
              <dd>{signedMeasurement(coaching.meanTimingOffsetMs, 'ms')}</dd>
            </div>
            <div>
              <dt>Centred attacks</dt>
              <dd>
                {coaching.centredCount}
                {coaching.uncertainTimingCount > 0
                  ? ` · ${coaching.uncertainTimingCount} direction withheld`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Velocity offset</dt>
              <dd>
                {coaching.evidenceScope === 'timing-only'
                  ? 'Not measured by this input'
                  : signedMeasurement(coaching.meanVelocityOffset, 'velocity')}
              </dd>
            </div>
          </dl>

          <Show when={coaching.recovery} keyed>
            {(recovery) => (
              <section class={styles.recovery} aria-label="Recovery loop">
                <span>
                  {recovery.focus === 'timing' ? 'Timing' : 'Dynamics'}
                </span>
                <h3>{recovery.label}</h3>
                <p>{recovery.instruction}</p>
                <Show when={props.onRequestRecoveryLoop !== undefined}>
                  <button
                    type="button"
                    onClick={() => props.onRequestRecoveryLoop?.(recovery)}
                  >
                    Set recovery loop to bar {recovery.barNumber}
                  </button>
                </Show>
              </section>
            )}
          </Show>

          <Show when={coaching.unindexedTargetHitCount > 0}>
            <p class={styles.mappingNotice} role="status">
              {coaching.unindexedTargetHitCount} later authored{' '}
              {coaching.unindexedTargetHitCount === 1 ? 'hit is' : 'hits are'}{' '}
              beyond this bounded coaching analysis and were not assessed.
            </p>
          </Show>
          <Show when={coaching.unprocessedCaptureHitCount > 0}>
            <p class={styles.mappingNotice} role="status">
              {coaching.unprocessedCaptureHitCount} later captured{' '}
              {coaching.unprocessedCaptureHitCount === 1
                ? 'event is'
                : 'events are'}{' '}
              outside this bounded take analysis and were not assessed.
            </p>
          </Show>

          <footer class={styles.coachFooter}>
            Timing and dynamics only. No limb, sticking, grip, or acoustic-kit
            identity is inferred.
          </footer>
        </aside>
      )}
    </Show>
  )
}
