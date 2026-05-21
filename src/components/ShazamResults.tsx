// ============================================================
// ShazamResults — Ranked match results from melody matching
// Phase 4 of Shazam Sing
//
// Displays the top N matches with confidence bars and actions
// to open the matched melody or try again.
// ============================================================

import { createSignal, For, lazy, Show, Suspense } from 'solid-js'
import { getFingerprintIndex } from '@/lib/shazam/melody-fingerprints'
import type { LivePitchContour, MatchCandidate } from '@/lib/shazam/types'
import styles from './ShazamResults.module.css'

const ShazamDebugPanel = lazy(async () =>
  import('@/components/ShazamDebugPanel').then((m) => ({
    default: m.ShazamDebugPanel,
  })),
)

interface ShazamResultsProps {
  candidates: MatchCandidate[]
  liveContour?: LivePitchContour | null
  hummingNormalized?: boolean
  onOpenMelody?: (melodyId: string) => void
  onOpenStemMixer?: (sessionId: string, matchOffsetSec?: number) => void
  onTryAgain: () => void
}

function confidenceTier(pct: number): string {
  if (pct >= 95) return styles.confidenceAuto
  if (pct >= 85) return styles.confidenceHigh
  if (pct >= 60) return styles.confidenceMedium
  if (pct >= 40) return styles.confidenceLow
  return styles.confidenceNone
}

function confidenceLabel(pct: number): string {
  if (pct >= 95) return 'Auto-accept'
  if (pct >= 85) return 'High'
  if (pct >= 60) return 'Medium'
  if (pct >= 40) return 'Low'
  return 'Weak'
}

export function ShazamResults(props: ShazamResultsProps) {
  const debugEnabled = (): boolean => true

  const [showDebug, setShowDebug] = createSignal(
    localStorage.getItem('pitchperfect_shazam_debug') === 'true',
  )

  function toggleDebug() {
    setShowDebug((v) => {
      const next = !v
      localStorage.setItem('pitchperfect_shazam_debug', String(next))
      return next
    })
  }

  return (
    <div class={styles.container} data-testid="shazam-results">
      <div class={styles.headerRow}>
        <h3 class={styles.heading}>Matches for your singing</h3>
        <Show when={debugEnabled()}>
          <button
            class={styles.debugToggle}
            classList={{ [styles.debugToggleOn!]: showDebug() }}
            onClick={toggleDebug}
            data-testid="shazam-debug-toggle"
          >
            Debug
          </button>
        </Show>
      </div>

      <Show
        when={props.candidates.length > 0}
        fallback={<p class={styles.noMatches}>No matches found. Try again!</p>}
      >
        <div class={styles.list}>
          <For each={props.candidates}>
            {(candidate) => {
              const isStem = candidate.source === 'stem'
              return (
                <div
                  class={styles.matchCard}
                  data-testid={`shazam-match-${candidate.melodyId}`}
                >
                  <div class={styles.matchHeader}>
                    <span
                      class={`${styles.confidence} ${confidenceTier(candidate.confidence)}`}
                    >
                      {candidate.confidence}%
                    </span>
                    <span
                      class={`${styles.tierBadge} ${confidenceTier(candidate.confidence)}`}
                    >
                      {confidenceLabel(candidate.confidence)}
                    </span>
                    <span class={styles.name} title={candidate.name}>
                      {candidate.name}
                    </span>
                    <span
                      class={`${styles.sourceBadge} ${isStem ? styles.sourceStem : styles.sourceMelody}`}
                      data-testid={
                        isStem ? 'shazam-stem-badge' : 'shazam-library-badge'
                      }
                    >
                      {isStem ? 'From Upload' : 'Library'}
                    </span>
                  </div>
                  <div class={styles.confidenceBar}>
                    <div
                      class={`${styles.fill} ${confidenceTier(candidate.confidence)}`}
                      style={{ width: `${candidate.confidence}%` }}
                    />
                  </div>
                  <div class={styles.actions}>
                    <Show
                      when={isStem}
                      fallback={
                        <button
                          class={styles.openBtn}
                          onClick={() =>
                            props.onOpenMelody?.(candidate.melodyId)
                          }
                        >
                          Load & Practice
                        </button>
                      }
                    >
                      <button
                        class={styles.openBtn}
                        onClick={() =>
                          props.onOpenStemMixer?.(
                            candidate.sessionId!,
                            candidate.matchOffsetSec,
                          )
                        }
                      >
                        Open in Mixer
                      </button>
                    </Show>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      </Show>

      <button
        class={styles.tryAgain}
        onClick={() => props.onTryAgain()}
        data-testid="shazam-try-again"
      >
        Try Again
      </button>

      <Show
        when={
          debugEnabled() &&
          showDebug() &&
          props.candidates.length > 0 &&
          props.liveContour
        }
      >
        <Suspense>
          <ShazamDebugPanel
            candidate={props.candidates[0]}
            referenceFingerprint={
              getFingerprintIndex().get(props.candidates[0].melodyId) ?? null
            }
            liveContour={props.liveContour!}
            hummingNormalized={props.hummingNormalized ?? false}
          />
        </Suspense>
      </Show>
    </div>
  )
}
