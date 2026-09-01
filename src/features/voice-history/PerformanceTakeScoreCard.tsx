// ============================================================
// Performance Take Score Card — source-aware results beside replay
// ============================================================

import { createMemo, For, Show } from 'solid-js'
import type { VoiceTakeRecord } from '@/db/entities'
import { parsePerformanceTakeScore } from '@/lib/domain/performance-take'
import styles from './PerformanceTakeScoreCard.module.css'

interface PerformanceTakeScoreCardProps {
  take: VoiceTakeRecord
}

export function PerformanceTakeScoreCard(props: PerformanceTakeScoreCardProps) {
  const score = createMemo(() => parsePerformanceTakeScore(props.take))

  return (
    <Show when={score()} keyed>
      {(result) => (
        <section
          class={styles.card}
          aria-label={`${result.eyebrow} for ${props.take.title}`}
        >
          <div class={styles.heading}>
            <div>
              <span>{result.eyebrow}</span>
              <strong>{result.primaryValue}</strong>
              <small>{result.primaryLabel}</small>
            </div>
            <Show when={result.grade}>
              {(grade) => (
                <output class={styles.grade} aria-label={`Grade ${grade()}`}>
                  {grade()}
                </output>
              )}
            </Show>
          </div>
          <Show when={result.stats.length > 0}>
            <dl class={styles.stats}>
              <For each={result.stats}>
                {(stat) => (
                  <div>
                    <dt>{stat.label}</dt>
                    <dd>{stat.value}</dd>
                  </div>
                )}
              </For>
            </dl>
          </Show>
        </section>
      )}
    </Show>
  )
}
