// ============================================================
// WeeklyLegendHero — the "This Week's Legend" card (Home)
// ============================================================
// Shows the active weekly challenge: feat framing, countdown, a "Hear it"
// link (official upload), a "Sing it" attempt that performs the line on the
// challenge stage (zen canvas), and a compact board (top singers + the
// founder + your standing). The stage reports through the exercise-history
// funnel, so the weekly-attempt return path is unchanged.

import type { Component } from 'solid-js'
import { createEffect, createResource, For, Show } from 'solid-js'
import { EXERCISE_SIGHT_SINGING } from '@/features/exercises/types'
import { TAB_CHALLENGES } from '@/features/tabs/constants'
import { openChallengeStage, setActiveTab } from '@/stores/ui-store'
import { beginWeeklyAttempt, weeklyAttemptVersion } from './weekly-attempt'
import { getActiveWeekly, getWeeklyBoard, hoursUntil } from './weekly-service'
import styles from './WeeklyLegendHero.module.css'

function countdownLabel(endsAt: string): string {
  const h = hoursUntil(endsAt)
  if (h <= 0) return 'closing'
  if (h < 24) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

export const WeeklyLegendHero: Component = () => {
  const [challenge] = createResource(getActiveWeekly)
  const [board, { refetch: refetchBoard }] = createResource(
    () => challenge()?.id,
    (id) => getWeeklyBoard(id),
  )

  // Re-pull the board after each recorded attempt.
  createEffect(() => {
    weeklyAttemptVersion()
    const id = challenge()?.id
    if (id !== undefined && id !== '') void refetchBoard()
  })

  function attempt(): void {
    const c = challenge()
    if (!c) return
    beginWeeklyAttempt({
      challengeId: c.id,
      title: c.title,
      exercise: EXERCISE_SIGHT_SINGING,
      targetScore: c.targetScore,
      rewardBadgeId: c.rewardBadgeId,
      founderScore: c.founderScore,
    })
    openChallengeStage({
      challengeId: c.id,
      title: c.title,
      targetScore: c.targetScore,
      targetItems: c.targetItems,
    })
  }

  return (
    <section class={`${styles.card} home-legend-card`}>
      <div class={styles.eyebrowRow}>
        <span class={styles.eyebrow}>This Week's Legend</span>
        <Show when={challenge()}>
          <span class={styles.countdown}>
            {countdownLabel(challenge()!.endsAt)}
          </span>
        </Show>
      </div>

      <Show
        when={challenge()}
        fallback={
          <p class={styles.soon}>
            A fresh community vocal challenge drops here every week. Keep your
            streak alive — the first Legend is on its way.
          </p>
        }
      >
        <h3 class={styles.title}>{challenge()!.title}</h3>
        <div class={styles.tags}>
          <span class={styles.tag}>{challenge()!.featType}</span>
          <span class={styles.tag}>{challenge()!.difficulty}</span>
        </div>
        <p class={styles.desc}>{challenge()!.description}</p>

        <div class={styles.actions}>
          <button class={styles.singBtn} onClick={attempt}>
            Sing it
          </button>
          <Show when={challenge()!.hearItUrl}>
            <a
              class={styles.hearBtn}
              href={challenge()!.hearItUrl!}
              target="_blank"
              rel="noopener noreferrer"
            >
              Hear it
            </a>
          </Show>
        </div>
        <p class={styles.attemptHint}>
          One take counts — "Sing it" records your very next run. Anything after
          is practice until you tap it again.
        </p>

        {/* ── Board ──────────────────────────────────────── */}
        <Show when={board()}>
          <div class={styles.board}>
            <div class={styles.boardStat}>
              {board()!.attemptedCount} sang this
              <Show when={board()!.completedCount > 0}>
                {' · '}
                {board()!.completedCount} completed
              </Show>
            </div>
            <ol class={styles.rankList}>
              <For each={board()!.top.slice(0, 3)}>
                {(e) => (
                  <li
                    class={`${styles.rankRow} ${e.isFounder ? styles.founder : ''}`}
                  >
                    <span class={styles.rankNum}>{e.rank}</span>
                    <span class={styles.rankName}>{e.displayName}</span>
                    <span class={styles.rankScore}>{e.best}%</span>
                  </li>
                )}
              </For>
            </ol>
            <Show when={board()!.you}>
              <div class={styles.youRow}>
                <Show
                  when={board()!.you!.beatFounder}
                  fallback={
                    <span>
                      Your best {board()!.you!.best}% · top{' '}
                      {board()!.you!.percentile}% of {board()!.attemptedCount}
                    </span>
                  }
                >
                  <span class={styles.beatFounder}>
                    You beat the Founder — {board()!.you!.best}%
                  </span>
                </Show>
              </div>
            </Show>
          </div>
        </Show>

        <button
          class={styles.allLink}
          onClick={() => setActiveTab(TAB_CHALLENGES)}
        >
          All challenges
        </button>
      </Show>
    </section>
  )
}
