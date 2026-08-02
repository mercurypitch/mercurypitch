// ============================================================
// PastWeeklyChallenges — replay closed weekly Legends without ranking
// ============================================================
// The weekly archive remains useful as a practice library after its board
// freezes. Every replay opens the same zen challenge stage in explicit
// practice mode and disarms any abandoned live-week take first, so an archive
// run can never be published to the weekly board.

import type { Component } from 'solid-js'
import { createEffect, createResource, For, Show } from 'solid-js'
import { History, Play } from '@/components/icons'
import { openChallengeStage } from '@/stores/ui-store'
import styles from './PastWeeklyChallenges.module.css'
import { clearWeeklyAttempt } from './weekly-attempt'
import type { WeeklyChallenge } from './weekly-service'
import { getWeeklyArchive } from './weekly-service'

export const PAST_WEEKLY_CHALLENGES_ID = 'past-weekly-challenges'
const PAST_SCROLL_REQUEST_KEY = 'mercurypitch_scroll_past_challenges'

/** Request archive alignment before or after the lazy Challenges tab mounts. */
export function requestPastChallengesScroll(): void {
  const archive = document.getElementById(PAST_WEEKLY_CHALLENGES_ID)
  if (archive !== null) {
    archive.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  try {
    sessionStorage.setItem(PAST_SCROLL_REQUEST_KEY, '1')
  } catch {
    // The tab still opens when browser storage is unavailable.
  }
}

function endedLabel(endsAt: string): string {
  const ended = new Date(endsAt)
  if (!Number.isFinite(ended.getTime())) return 'Past challenge'
  return `Ended ${ended.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`
}

function featLabel(featType: string): string {
  return featType.replaceAll('-', ' ')
}

/** Launch a frozen weekly melody as practice, never as a board attempt. */
export function practisePastChallenge(challenge: WeeklyChallenge): void {
  clearWeeklyAttempt()
  openChallengeStage({
    challengeId: challenge.id,
    title: challenge.title,
    targetScore: challenge.targetScore,
    targetItems: challenge.targetItems,
    mode: 'practice',
  })
}

export const PastWeeklyChallenges: Component = () => {
  const [archive] = createResource(getWeeklyArchive)

  // Wait for the archive response before aligning the section. Scrolling as
  // soon as the shell mounts can stop short because the empty loading state
  // has not made enough scrollable room for the finished challenge cards.
  createEffect(() => {
    if (archive.loading) return
    try {
      if (sessionStorage.getItem(PAST_SCROLL_REQUEST_KEY) !== '1') return
      sessionStorage.removeItem(PAST_SCROLL_REQUEST_KEY)
    } catch {
      return
    }
    // The ordinary challenge catalogue loads alongside the archive and adds
    // most of the panel's scroll height. Wait for its first card (bounded for
    // an intentionally empty catalogue), otherwise scrollIntoView can stop
    // halfway because the panel is still too short.
    let framesRemaining = 60
    const alignWhenPageReady = (): void => {
      const catalogueReady =
        document.querySelector('.challenges-grid .challenge-card') !== null
      framesRemaining -= 1
      if (catalogueReady || framesRemaining <= 0) {
        document.getElementById(PAST_WEEKLY_CHALLENGES_ID)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
        return
      }
      requestAnimationFrame(alignWhenPageReady)
    }
    requestAnimationFrame(alignWhenPageReady)
  })

  return (
    <section
      id={PAST_WEEKLY_CHALLENGES_ID}
      class={styles.section}
      aria-labelledby="past-weekly-challenges-title"
      aria-busy={archive.loading}
    >
      <div class={styles.headingRow}>
        <div class={styles.headingIcon} aria-hidden="true">
          <History />
        </div>
        <div>
          <h3 id="past-weekly-challenges-title">Past challenges</h3>
          <p>
            Missed a week? Revisit its melody here. Practice runs never change
            the weekly board.
          </p>
        </div>
      </div>

      <Show
        when={!archive.loading}
        fallback={<p class={styles.state}>Loading past challenges…</p>}
      >
        <Show
          when={(archive() ?? []).length > 0}
          fallback={
            <p class={styles.state}>
              No past Legends yet. Finished weeks will collect here.
            </p>
          }
        >
          <div class={styles.list}>
            <For each={archive() ?? []}>
              {(challenge) => (
                <article class={styles.item}>
                  <div class={styles.itemBody}>
                    <div class={styles.itemMeta}>
                      <span>{endedLabel(challenge.endsAt)}</span>
                      <span class={styles.tag}>
                        {featLabel(challenge.featType)}
                      </span>
                      <span class={styles.tag}>{challenge.difficulty}</span>
                    </div>
                    <h4>{challenge.title}</h4>
                    <p>{challenge.description}</p>
                    <span class={styles.unranked}>
                      Unranked practice · benchmark {challenge.targetScore}%
                    </span>
                  </div>
                  <button
                    type="button"
                    class={styles.practiceButton}
                    onClick={() => practisePastChallenge(challenge)}
                    aria-label={`Practise ${challenge.title}`}
                  >
                    <Play />
                    Practise
                  </button>
                </article>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </section>
  )
}
