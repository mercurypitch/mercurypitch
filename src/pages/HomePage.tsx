// ============================================================
// HomePage — the "today" landing surface
// ============================================================
// One obvious next step: your streak (with forgiveness), today's generated
// 5–15 min session, this week's Legend challenge (wired in PR 2), and a thin
// progress strip. Reuses the daily-routine engine + streak service; adds no
// new launch or scoring infra.

import type { Component, JSX } from 'solid-js'
import { createMemo, createResource, For, Show } from 'solid-js'
import { IconCheck, IconFire, IconTarget, IconTrophy, } from '@/components/exercise-icons'
import { DAILY_GOAL_MS, getTodayScoredMinutes, } from '@/db/services/practice-minutes'
import { getStreakState, repairStreak } from '@/db/services/streak-service'
import { EXERCISE_WARMUP } from '@/features/exercises/types'
import type { RoutineSegment, SegmentKind } from '@/features/routines/types'
import type { RoutineLength } from '@/features/routines/use-daily-routine'
import { routinePrefs, setRoutinePrefs, useDailyRoutine, } from '@/features/routines/use-daily-routine'
import { TAB_CHALLENGES } from '@/features/tabs/constants'
import { exerciseHistory } from '@/stores/exercise-history-store'
import { setActiveTab, startExercise } from '@/stores/ui-store'
import styles from './HomePage.module.css'

const DAILY_GOAL_MIN = Math.round(DAILY_GOAL_MS / 60_000)

function IconSnowflake(props: { size?: number }): JSX.Element {
  const s = () => props.size ?? 14
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M12 2v20M4.2 7l15.6 10M19.8 7L4.2 17" />
      <path d="M12 5l2.5-2.5M12 5L9.5 2.5M12 19l2.5 2.5M12 19l-2.5 2.5" />
    </svg>
  )
}

const segmentLabels: Record<SegmentKind, string> = {
  warmup: 'Warm-up',
  exercise: 'Exercise',
  'challenge-prep': 'Challenge',
  cooldown: 'Cool-down',
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Reuses the exact launch mechanism the sidebar panel uses. */
function launchSegment(seg: RoutineSegment): void {
  if (seg.type === 'challenge-prep') {
    setActiveTab(TAB_CHALLENGES)
    return
  }
  if (seg.type === 'warmup' || seg.type === 'cooldown') {
    startExercise(EXERCISE_WARMUP, {
      pattern: seg.config.pattern ?? seg.config.mode,
    })
    return
  }
  if (seg.config.exercise) {
    startExercise(seg.config.exercise, { notes: seg.config.notes ?? [] })
  }
}

const HomePage: Component = () => {
  const routine = useDailyRoutine()
  const [streak, { refetch: refetchStreak }] = createResource(getStreakState)

  // Read once per mount; the page remounts on every tab switch, so returning
  // to Home after practising picks up fresh minutes/streak.
  const minutesToday = getTodayScoredMinutes()
  const goalMet = minutesToday >= DAILY_GOAL_MIN
  const goalPct = Math.min(
    100,
    Math.round((minutesToday / DAILY_GOAL_MIN) * 100),
  )

  // Thin progress strip from local exercise history (last 7 days).
  const weekStats = createMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000
    const recent = exerciseHistory().filter((e) => e.completedAt >= weekAgo)
    const avg =
      recent.length > 0
        ? Math.round(
            recent.reduce((sum, e) => sum + e.score, 0) / recent.length,
          )
        : null
    return { runs: recent.length, avgScore: avg }
  })

  async function onRepair(): Promise<void> {
    await repairStreak()
    void refetchStreak()
  }

  return (
    <div class={styles.page}>
      <header class={styles.head}>
        <h1 class={styles.greeting}>{greeting()}</h1>
        <p class={styles.date}>
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      <div class={styles.grid}>
        {/* ── Streak ─────────────────────────────────────────── */}
        <section class={`${styles.card} ${styles.streakCard} home-streak-card`}>
          <div class={styles.streakTop}>
            <span
              class={`${styles.flame} ${goalMet ? styles.flameLit : ''}`}
              aria-hidden="true"
            >
              <IconFire size={28} />
            </span>
            <div>
              <div class={styles.streakNumber}>
                {streak()?.currentStreak ?? 0}
              </div>
              <div class={styles.streakLabel}>
                {(streak()?.currentStreak ?? 0) === 1
                  ? 'day streak'
                  : 'day streak'}
              </div>
            </div>
            <div
              class={styles.freezes}
              title="Streak freezes protect a missed day"
            >
              <For each={Array.from({ length: streak()?.maxFreezes ?? 2 })}>
                {(_, i) => (
                  <span
                    class={`${styles.freezeChip} ${
                      i() < (streak()?.freezes ?? 0) ? styles.freezeOn : ''
                    }`}
                  >
                    <IconSnowflake size={13} />
                  </span>
                )}
              </For>
            </div>
          </div>

          <div class={styles.goalRow}>
            <div class={styles.goalBar}>
              <div class={styles.goalFill} style={{ width: `${goalPct}%` }} />
            </div>
            <span class={styles.goalText}>
              {goalMet
                ? `Daily goal met (${DAILY_GOAL_MIN} min)`
                : `${minutesToday}/${DAILY_GOAL_MIN} min today`}
            </span>
          </div>

          <div class={styles.streakMeta}>
            <span>Best: {streak()?.longestStreak ?? 0} days</span>
            <Show when={(streak()?.freezes ?? 0) > 0}>
              <span>
                {streak()!.freezes} freeze
                {streak()!.freezes === 1 ? '' : 's'} banked
              </span>
            </Show>
          </div>

          <Show when={streak()?.canRepair}>
            <button class={styles.repairBtn} onClick={() => void onRepair()}>
              Repair streak — restore {streak()!.repairableStreak} days (free)
            </button>
          </Show>
        </section>

        {/* ── This Week's Legend (wired in PR 2) ─────────────── */}
        <section class={`${styles.card} ${styles.legendCard} home-legend-card`}>
          <span class={styles.legendEyebrow}>This Week's Legend</span>
          <p class={styles.legendSoon}>
            Weekly community vocal challenges are coming soon. Keep your streak
            alive and you'll be ready to take on the first one.
          </p>
        </section>

        {/* ── Today's session ────────────────────────────────── */}
        <section
          class={`${styles.card} ${styles.sessionCard} home-session-card`}
        >
          <div class={styles.sessionHead}>
            <h2 class={styles.cardTitle}>Today's session</h2>
            <Show when={routine.template()}>
              <span class={styles.sessionTime}>
                ~{Math.round(routine.totalDurationSec() / 60)} min
              </span>
            </Show>
          </div>

          <Show
            when={routine.template()}
            fallback={
              <div class={styles.sessionEmpty}>
                <p class={styles.sessionEmptyText}>
                  A quick, guided workout picked for you: warm up, sharpen a
                  weak spot, grow a skill, then sing a real phrase.
                </p>
                <div class={styles.lengthRow}>
                  <label>
                    Length
                    <select
                      value={routinePrefs().length}
                      onChange={(e) =>
                        setRoutinePrefs((p) => ({
                          ...p,
                          length: e.currentTarget.value as RoutineLength,
                        }))
                      }
                    >
                      <option value="short">Short (~5 min)</option>
                      <option value="standard">Standard (~8 min)</option>
                      <option value="long">Long (~12 min)</option>
                    </select>
                  </label>
                </div>
                <button
                  class={styles.primaryBtn}
                  onClick={() => routine.generate()}
                >
                  Start today's session
                </button>
              </div>
            }
          >
            <div class={styles.progressBar}>
              <div
                class={styles.progressFill}
                style={{ width: `${routine.progress()}%` }}
              />
            </div>

            <ol class={styles.segments}>
              <For each={routine.segmentStatuses()}>
                {(item, i) => (
                  <li
                    class={`${styles.segment} ${item.done ? styles.segDone : ''} ${
                      item.current ? styles.segCurrent : ''
                    }`}
                  >
                    <span class={styles.segIcon}>
                      {item.done ? (
                        <IconCheck size={15} />
                      ) : item.seg.type === 'warmup' ||
                        item.seg.type === 'cooldown' ? (
                        <IconFire size={15} />
                      ) : item.seg.type === 'challenge-prep' ? (
                        <IconTrophy size={15} />
                      ) : (
                        <IconTarget size={15} />
                      )}
                    </span>
                    <span class={styles.segBody}>
                      <span class={styles.segName}>
                        {segmentLabels[item.seg.type]}
                        <Show when={item.seg.config.exercise}>
                          <span class={styles.segExercise}>
                            {' · '}
                            {item.seg.config.exercise}
                          </span>
                        </Show>
                      </span>
                      <span class={styles.segDur}>
                        {Math.max(1, Math.round(item.seg.durationSec / 60))} min
                      </span>
                    </span>
                    <Show when={item.current && !item.done}>
                      <button
                        class={styles.segStart}
                        onClick={() => launchSegment(item.seg)}
                      >
                        Start
                      </button>
                      <button
                        class={styles.segSkip}
                        title="Mark done"
                        onClick={() => routine.completeSegment()}
                      >
                        <IconCheck size={13} />
                      </button>
                    </Show>
                    <Show when={!item.current && !item.done}>
                      <span class={styles.segStep}>{i() + 1}</span>
                    </Show>
                  </li>
                )}
              </For>
            </ol>

            <Show
              when={routine.isComplete()}
              fallback={
                <div class={styles.sessionActions}>
                  <button
                    class={styles.linkBtn}
                    onClick={() => routine.reset()}
                  >
                    Choose a different workout
                  </button>
                </div>
              }
            >
              <div class={styles.doneMsg}>
                Session complete — nice work today.
              </div>
            </Show>
          </Show>
        </section>

        {/* ── Progress strip ─────────────────────────────────── */}
        <section class={`${styles.card} ${styles.progressCard} home-progress`}>
          <h2 class={styles.cardTitle}>This week</h2>
          <div class={styles.stats}>
            <div class={styles.stat}>
              <span class={styles.statValue}>{weekStats().runs}</span>
              <span class={styles.statLabel}>drills</span>
            </div>
            <div class={styles.stat}>
              <span class={styles.statValue}>
                {weekStats().avgScore ?? '—'}
                {weekStats().avgScore !== null ? '%' : ''}
              </span>
              <span class={styles.statLabel}>avg score</span>
            </div>
            <div class={styles.stat}>
              <span class={styles.statValue}>
                {streak()?.longestStreak ?? 0}
              </span>
              <span class={styles.statLabel}>best streak</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default HomePage
