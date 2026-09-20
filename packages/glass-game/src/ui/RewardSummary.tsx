// Journey reward summary — keep singing quality, discoveries and portrait ownership distinct.

import { For, Show } from 'solid-js'
import type { LevelDefinition, LevelRewardSummary, SingingQualityGrade, } from '../contracts'
import { qualityResultMatchesPolicy } from '../core/rewards'
import styles from './RewardSummary.module.css'

export interface RewardSummaryProps {
  level: LevelDefinition
  summary: LevelRewardSummary
  assetUrl(id: string): string
}

function numericGrade(grade: SingingQualityGrade | undefined): number {
  return typeof grade === 'number' ? grade : 0
}

export function RewardSummary(props: RewardSummaryProps) {
  const policy = () => props.level.rewards?.grading[0]
  const result = () => props.summary.qualityResults[0]
  const resultIsCurrent = () => {
    const saved = result()
    const grading = policy()
    return (
      saved !== undefined &&
      grading !== undefined &&
      qualityResultMatchesPolicy(saved, grading)
    )
  }
  const grade = () => numericGrade(result()?.grade)
  const qualityLabel = () =>
    grade() > 0 ? `${grade()} of 3 stars` : 'Not graded'
  const evidenceDetail = () => {
    const attempt = result()
    const minimum = policy()?.minimumReliableSeconds
    if (attempt === undefined)
      return 'No singing-quality result was saved for this completion.'
    if (!resultIsCurrent()) {
      if (attempt.grade === 'not-graded')
        return `${attempt.reliableSeconds.toFixed(1)} reliable seconds were saved under an earlier grading policy.`
      return `${attempt.meanAbsoluteCents?.toFixed(1) ?? '—'} cents mean pitch error, saved under an earlier grading policy.`
    }
    if (attempt.grade !== 'not-graded')
      return `${attempt.meanAbsoluteCents?.toFixed(1) ?? '—'} cents mean pitch error.`
    if (minimum === undefined) return 'This challenge has no grading policy.'
    return `${attempt.reliableSeconds.toFixed(1)} of ${minimum.toFixed(1)} reliable seconds captured.`
  }
  const thresholdDetail = () => {
    const grading = policy()
    if (grading === undefined) return ''
    if (result() !== undefined && !resultIsCurrent())
      return 'This saved result used an earlier challenge or grading policy. Replay the final portrait to record a result under the current policy. Volume, response time and callback count do not affect either result.'
    return `Fresh, confident voiced pitch only. 3 stars at ${grading.threeStarMaxMeanCents} cents mean error or less; 2 stars at ${grading.twoStarMaxMeanCents} or less; ${grading.minimumReliableSeconds.toFixed(1)} reliable seconds required. Volume, response time and callback count do not affect the result.`
  }

  return (
    <section class={styles.summary} aria-label="Journey rewards">
      <div class={styles.row} data-testid="singing-quality-summary">
        <div class={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M9 18V5l9-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="15" cy="16" r="3" />
          </svg>
        </div>
        <div class={styles.copy}>
          <span class={styles.eyebrow}>Final portrait singing</span>
          <div class={styles.stars} aria-label={qualityLabel()}>
            <For each={[1, 2, 3]}>
              {(star) => (
                <svg
                  viewBox="0 0 24 24"
                  classList={{ [styles.earned]: star <= grade() }}
                  aria-hidden="true"
                >
                  <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
                </svg>
              )}
            </For>
            <strong>{qualityLabel()}</strong>
          </div>
          <p>{evidenceDetail()}</p>
          <p>Only the final portrait exhibit contributes to this score.</p>
          <Show when={thresholdDetail()}>
            <details class={styles.details}>
              <summary>How stars are measured</summary>
              <p>{thresholdDetail()}</p>
              <p>Gallery completion does not depend on stars.</p>
            </details>
          </Show>
        </div>
      </div>

      <div class={styles.row} data-testid="discovery-summary">
        <div class={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </div>
        <div class={styles.copy}>
          <span class={styles.eyebrow}>Discoveries</span>
          <strong>
            {props.summary.discoveriesFound} of {props.summary.discoveriesTotal}{' '}
            optional exhibits
          </strong>
          <p>
            {props.summary.coinsFound} of {props.summary.coinsTotal} one-time
            museum discovery tokens found. They stay collected across visits.
          </p>
        </div>
      </div>

      <Show when={props.summary.portrait}>
        {(portrait) => (
          <div class={styles.row} data-testid="portrait-summary">
            <div class={styles.portrait}>
              <Show
                when={portrait().collected}
                fallback={<span aria-hidden="true" />}
              >
                <img
                  src={props.assetUrl(portrait().imageAssetId)}
                  alt={portrait().title}
                />
              </Show>
            </div>
            <div class={styles.copy}>
              <span class={styles.eyebrow}>Portrait</span>
              <strong>
                {portrait().collected
                  ? portrait().title
                  : 'Portrait not collected'}
              </strong>
              <p>
                {portrait().collected
                  ? `Collection portrait ${portrait().collectionIndex} is yours.`
                  : 'Complete the final required exhibit to collect this portrait.'}
              </p>
            </div>
          </div>
        )}
      </Show>
    </section>
  )
}
