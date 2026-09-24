// Island trial cards — show earned access and the remaining island requirements.
import { For, Show } from 'solid-js'
import type { TrialUnlock } from '../core/trial-unlock'
import styles from './IslandTrials.module.css'

export interface IslandTrialView {
  id: string
  islandTitle: string
  title: string
  description: string
  imageUrl: string
  replay: boolean
  unlock: TrialUnlock
}

export function IslandTrials(props: {
  trials: readonly IslandTrialView[]
  enteringId?: string
  disabled: boolean
  onEnter(id: string): void
}) {
  return (
    <Show when={props.trials.length > 0}>
      <section class={styles.trials} aria-labelledby="cloudway-trials-title">
        <header class={styles.heading}>
          <span>Beyond the galleries</span>
          <h2 id="cloudway-trials-title">Cloudway Trials</h2>
          <p>Little adventures for an island's brightest voices.</p>
        </header>
        <For each={props.trials}>
          {(trial) => (
            <article
              class={styles.card}
              data-trial-id={trial.id}
              data-unlocked={String(trial.unlock.unlocked)}
            >
              <img
                class={styles.art}
                src={trial.imageUrl}
                alt=""
                loading="lazy"
              />
              <div class={styles.copy}>
                <span class={styles.island}>{trial.islandTitle}</span>
                <h3>{trial.title}</h3>
                <p>{trial.description}</p>
                <ul class={styles.requirements} aria-label="Trial requirements">
                  <For each={trial.unlock.chapters}>
                    {(chapter) => (
                      <li data-ready={String(chapter.ready)}>
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <Show
                            when={chapter.ready}
                            fallback={<circle cx="10" cy="10" r="6" />}
                          >
                            <path d="m4 10 4 4 8-8" />
                          </Show>
                        </svg>
                        <span>{chapter.title}</span>
                        <strong>
                          {chapter.previouslyUnlocked === true
                            ? 'Earlier access kept'
                            : chapter.graded
                              ? `${chapter.earnedStars}/3 stars${chapter.completed ? '' : ' · finish gallery'}`
                              : chapter.completed
                                ? 'Complete'
                                : 'Finish tutorial'}
                        </strong>
                      </li>
                    )}
                  </For>
                </ul>
                <button
                  type="button"
                  class={styles.enter}
                  disabled={props.disabled || !trial.unlock.unlocked}
                  onClick={() => {
                    if (trial.unlock.unlocked) props.onEnter(trial.id)
                  }}
                  aria-label={
                    trial.unlock.unlocked
                      ? `Play trial: ${trial.title}`
                      : `Trial locked: ${trial.title}`
                  }
                >
                  {props.enteringId === trial.id
                    ? 'Opening trial…'
                    : trial.unlock.unlocked
                      ? trial.replay
                        ? 'Play again'
                        : 'Play trial'
                      : 'Earn the island stars to unlock'}
                </button>
                <small>
                  Singing stays on safe ground. Falling costs no stars.
                </small>
              </div>
            </article>
          )}
        </For>
      </section>
    </Show>
  )
}
