// ============================================================
// PastWeeklyChallenges — every closed Legend, with how it finished
// ============================================================
// Two jobs. The archive is the public record: each closed challenge with its
// frozen podium, the medal each place earned, and how many sang. And it is a
// practice library: every replay opens the same zen challenge stage in
// explicit practice mode and disarms any abandoned live take first, so an
// archive run can never be published to a board.
//
// Lives on the Leaderboard's Legends view, directly under the live challenge.
// It used to be a rail on the Challenges tab, which put the one competitive
// thing in the app on the page for personal practice drills and left the
// Leaderboard — the page for competition — without it.

import type { Component } from 'solid-js'
import { createResource, For, Show } from 'solid-js'
import { History, Play } from '@/components/icons'
import { openChallengeStage } from '@/stores/ui-store'
import { badgeArtSrc } from './badge-art'
import styles from './PastWeeklyChallenges.module.css'
import { clearWeeklyAttempt } from './weekly-attempt'
import type { WeeklyChallenge } from './weekly-service'
import { getWeeklyArchive, podiumOf } from './weekly-service'

const PAST_WEEKLY_CHALLENGES_ID = 'past-weekly-challenges'

/**
 * The badge each podium place earns, by rank. The medal drawn beside a name
 * here is the same file as the badge in that singer's cabinet — the trophy,
 * shown where it was won.
 */
const PLACE_ICONS = ['firstvoice', 'secondvoice', 'thirdvoice'] as const

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
          <h3 id="past-weekly-challenges-title">Past Legends</h3>
          <p>
            How each one finished, and who finished first. Missed one? Its
            melody is still here to practise; practice runs never touch a board.
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
              No past Legends yet. Finished ones will collect here.
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

                    {/* ── How it finished ─────────────────────────── */}
                    {/* The board froze when the window shut; this is what
                        it said. A Legend with no podium — closed by hand
                        before results were snapshotted, or one nobody
                        consented to be named on — simply shows none. */}
                    <Show when={podiumOf(challenge.results).length > 0}>
                      <ol
                        class={styles.podium}
                        data-testid={`podium-${challenge.id}`}
                      >
                        <For each={podiumOf(challenge.results)}>
                          {(place) => (
                            <li class={styles.place}>
                              {/* The medal for the place, when it has one;
                                  the numbered ring otherwise. Fourth place
                                  and beyond never reach this list, but the
                                  fallback keeps a missing file from leaving
                                  a hole. */}
                              <Show
                                when={badgeArtSrc(PLACE_ICONS[place.rank - 1])}
                                fallback={
                                  <span class={styles.placeRank}>
                                    {place.rank}
                                  </span>
                                }
                              >
                                {(src) => (
                                  <img
                                    class={styles.placeMedal}
                                    src={src()}
                                    width="28"
                                    height="28"
                                    alt={`Place ${place.rank}`}
                                    loading="lazy"
                                    decoding="async"
                                  />
                                )}
                              </Show>
                              <span
                                class={styles.placeName}
                                classList={{
                                  [styles.placeRedacted]:
                                    place.displayName === null,
                                }}
                              >
                                {place.displayName ?? '<redacted>'}
                              </span>
                              <span class={styles.placeScore}>
                                {place.best}%
                              </span>
                            </li>
                          )}
                        </For>
                      </ol>
                      <Show when={challenge.results!.attemptedCount > 0}>
                        <span class={styles.attempted}>
                          {challenge.results!.attemptedCount} sang this
                          <Show when={challenge.results!.completedCount > 0}>
                            {' · '}
                            {challenge.results!.completedCount} completed
                          </Show>
                        </span>
                      </Show>
                    </Show>

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
