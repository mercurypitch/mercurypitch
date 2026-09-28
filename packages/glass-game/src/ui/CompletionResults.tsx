// Completion results — compact difficulty, collection and onward actions after a gallery visit.

import { createSignal, For, Show } from 'solid-js'
import { galleryArtworkForAsset } from '../content/gallery-artworks'
import type { LevelDefinition, LevelRewardSummary, SingingQualityGrade, } from '../contracts'
import { qualityResultMatchesPolicy } from '../core/rewards'
import { ArtworkInspection } from './ArtworkInspection'
import styles from './CompletionResults.module.css'
import { focusDialog, trapDialogKeys } from './dialog-focus'

export interface CompletionResultsAction {
  label: string
  onSelect(): void
}

export interface CompletionDifficultyAction extends CompletionResultsAction {
  tier: 2 | 3
}

export interface CompletionResultsProps {
  level: LevelDefinition
  summary?: LevelRewardSummary
  replayGoal?: { title: string; tier: 1 | 2 | 3 }
  nextLevel?: CompletionResultsAction
  nextDifficulty?: CompletionDifficultyAction
  assetUrl(id: string): string
  covered: boolean
  encoreAvailable: boolean
  onEncore(opener: HTMLButtonElement): void
  onReplay(): void
  onBack(): void
}

type ResultDetail = 'accuracy' | 'discoveries'

function numericGrade(grade: SingingQualityGrade | undefined): number {
  return typeof grade === 'number' ? grade : 0
}

export function CompletionResults(props: CompletionResultsProps) {
  const [detail, setDetail] = createSignal<ResultDetail>()
  const [inspectingPortrait, setInspectingPortrait] = createSignal(false)
  let overflow!: HTMLDetailsElement
  let overflowButton!: HTMLElement
  let portraitButton: HTMLButtonElement | undefined

  const result = () => props.summary?.qualityResults[0]
  const policy = () => props.level.rewards?.grading[0]
  const grade = () => numericGrade(result()?.grade)
  const accuracyLabel = () =>
    grade() > 0 ? `Accuracy ${['C', 'B', 'A'][grade() - 1]}` : 'Not graded'
  const resultIsCurrent = () => {
    const saved = result()
    const grading = policy()
    return (
      saved !== undefined &&
      grading !== undefined &&
      qualityResultMatchesPolicy(saved, grading)
    )
  }
  const accuracyDetail = () => {
    const saved = result()
    const grading = policy()
    if (saved === undefined)
      return 'No singing accuracy was saved for this visit. Challenge stars are separate.'
    if (!resultIsCurrent())
      return 'This result belongs to an earlier challenge or grading policy. Replay the final portrait to record a current result.'
    if (saved.grade === 'not-graded')
      return grading === undefined
        ? 'This gallery has no current accuracy policy.'
        : `${saved.reliableSeconds.toFixed(1)} of ${grading.minimumReliableSeconds.toFixed(1)} reliable seconds were captured. Challenge stars are separate.`
    return `${saved.meanAbsoluteCents?.toFixed(1) ?? '—'} cents mean pitch error on the final portrait. Volume and response time do not change this result.`
  }
  const discoveryDetail = () => {
    const summary = props.summary
    if (summary === undefined) return 'This gallery has no collection summary.'
    return `${summary.coinsFound} of ${summary.coinsTotal} one-time discovery tokens are yours across every visit.`
  }
  const portrait = () => props.summary?.portrait
  const portraitArtwork = () => {
    const reward = portrait()
    return reward?.collected === true
      ? galleryArtworkForAsset(reward.imageAssetId)
      : undefined
  }
  const closePortrait = (): void => {
    setInspectingPortrait(false)
    queueMicrotask(() => portraitButton?.focus({ preventScroll: true }))
  }
  const toggleDetail = (next: ResultDetail): void => {
    setDetail((current) => (current === next ? undefined : next))
  }
  const handleKeys = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (overflow.open) {
        event.preventDefault()
        overflow.open = false
        overflowButton.focus({ preventScroll: true })
      } else {
        event.preventDefault()
        props.onBack()
      }
      return
    }
    trapDialogKeys(event)
  }

  return (
    <>
      <div class={styles.scrim}>
        <section
          class={styles.panel}
          ref={focusDialog}
          onKeyDown={handleKeys}
          role="dialog"
          aria-modal="true"
          aria-labelledby="glass-complete-title"
          inert={props.covered || inspectingPortrait()}
          data-testid="completion-results"
        >
          <header class={styles.header}>
            <button
              class={styles.iconButton}
              type="button"
              aria-label="Back to museum"
              onClick={() => props.onBack()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m14.5 5-7 7 7 7" />
              </svg>
            </button>
            <h2 id="glass-complete-title">
              {props.level.guidance?.completionTitle ??
                'You made the museum sing.'}
            </h2>
            <details class={styles.overflow} ref={overflow}>
              <summary
                class={styles.iconButton}
                aria-label="More result actions"
                ref={overflowButton}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="5" cy="12" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                </svg>
              </summary>
              <div class={styles.overflowMenu}>
                <button
                  type="button"
                  onClick={() => {
                    overflow.open = false
                    props.onReplay()
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 8V4m0 0h4M5 4l3.2 3.2a7 7 0 1 1-1.1 8.9" />
                  </svg>
                  Replay same difficulty
                </button>
              </div>
            </details>
          </header>

          <section class={styles.scoreCard} aria-label="Gallery result">
            <div class={styles.scoreTopline}>
              <div class={styles.scoreIdentity}>
                <div>
                  <span class={styles.eyebrow}>Gallery complete</span>
                  <Show
                    when={props.replayGoal}
                    fallback={<strong>Your visit is complete</strong>}
                  >
                    {(goal) => <strong>{goal().title}</strong>}
                  </Show>
                </div>
              </div>
              <Show when={props.encoreAvailable}>
                <button
                  class={styles.encore}
                  type="button"
                  onClick={(event) => props.onEncore(event.currentTarget)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 18V5l9-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="15" cy="16" r="3" />
                  </svg>
                  Encore
                </button>
              </Show>
            </div>

            <Show when={props.replayGoal}>
              {(goal) => (
                <div
                  class={styles.difficultyStars}
                  data-testid="level-star-summary"
                  aria-label={`${goal().tier} of 3 difficulty stars earned`}
                >
                  <For each={[1, 2, 3]}>
                    {(star) => (
                      <svg
                        viewBox="0 0 24 24"
                        classList={{ [styles.earned]: star <= goal().tier }}
                        aria-hidden="true"
                      >
                        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
                      </svg>
                    )}
                  </For>
                  <span>
                    {goal().tier} {goal().tier === 1 ? 'star' : 'stars'} earned
                  </span>
                </div>
              )}
            </Show>

            <div class={styles.scoreBody}>
              <div class={styles.badges}>
                <Show when={(props.level.rewards?.grading.length ?? 0) > 0}>
                  <button
                    class={styles.badge}
                    classList={{ [styles.badgeOpen]: detail() === 'accuracy' }}
                    type="button"
                    aria-expanded={detail() === 'accuracy'}
                    aria-controls="completion-accuracy-detail"
                    data-testid="singing-quality-summary"
                    onClick={() => toggleDetail('accuracy')}
                  >
                    <img
                      class={styles.badgeMedal}
                      src={props.assetUrl('results-singing-medal-v1')}
                      alt=""
                    />
                    <span>{accuracyLabel()}</span>
                    <span class={styles.info} aria-hidden="true">
                      i
                    </span>
                  </button>
                </Show>
                <Show when={props.summary}>
                  {(summary) => (
                    <button
                      class={styles.badge}
                      classList={{
                        [styles.badgeOpen]: detail() === 'discoveries',
                      }}
                      type="button"
                      aria-expanded={detail() === 'discoveries'}
                      aria-controls="completion-discovery-detail"
                      data-testid="discovery-summary"
                      aria-label={`Discoveries: ${summary().discoveriesFound} of ${summary().discoveriesTotal}`}
                      onClick={() => toggleDetail('discoveries')}
                    >
                      <img
                        class={styles.badgeMedal}
                        src={props.assetUrl('results-discovery-medal-v1')}
                        alt=""
                      />
                      <span>
                        {summary().discoveriesFound}/
                        {summary().discoveriesTotal}
                      </span>
                      <span class={styles.info} aria-hidden="true">
                        i
                      </span>
                    </button>
                  )}
                </Show>
              </div>

              <Show when={portrait()}>
                {(reward) => (
                  <Show
                    when={reward().collected}
                    fallback={
                      <div class={styles.portraitWaiting}>
                        Portrait still waiting
                      </div>
                    }
                  >
                    <button
                      class={styles.portrait}
                      type="button"
                      ref={portraitButton}
                      disabled={portraitArtwork() === undefined}
                      aria-label={`View ${reward().title} portrait`}
                      data-testid="portrait-summary"
                      onClick={() => setInspectingPortrait(true)}
                    >
                      <img src={props.assetUrl(reward().imageAssetId)} alt="" />
                      <span>{reward().title}</span>
                    </button>
                  </Show>
                )}
              </Show>
            </div>

            <Show when={detail() === 'accuracy'}>
              <p
                class={styles.explanation}
                id="completion-accuracy-detail"
                role="region"
                aria-label="Accuracy explanation"
              >
                {accuracyDetail()}
              </p>
            </Show>
            <Show when={detail() === 'discoveries'}>
              <p
                class={styles.explanation}
                id="completion-discovery-detail"
                role="region"
                aria-label="Discovery explanation"
              >
                {discoveryDetail()}
              </p>
            </Show>
          </section>

          <footer class={styles.actions}>
            <Show when={props.nextDifficulty}>
              {(action) => (
                <button
                  class={styles.secondary}
                  type="button"
                  aria-label={`Earn ${action().tier} stars: ${action().label}`}
                  onClick={() => action().onSelect()}
                >
                  <span>Earn {action().tier} stars</span>
                  <small>{action().label}</small>
                </button>
              )}
            </Show>
            <Show when={props.nextLevel}>
              {(action) => (
                <button
                  class={styles.primary}
                  type="button"
                  aria-label={`Next level: ${action().label}`}
                  onClick={() => action().onSelect()}
                >
                  <span>Next level</span>
                  <span class={styles.levelPill}>{action().label}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h13m-5-5 5 5-5 5" />
                  </svg>
                </button>
              )}
            </Show>
          </footer>
        </section>
      </div>

      <Show when={inspectingPortrait() && portraitArtwork()}>
        {(artwork) => (
          <div
            class={styles.inspection}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              closePortrait()
            }}
          >
            <ArtworkInspection
              artwork={artwork()}
              imageUrl={props.assetUrl(artwork().imageAsset)}
              onClose={closePortrait}
            />
          </div>
        )}
      </Show>
    </>
  )
}
