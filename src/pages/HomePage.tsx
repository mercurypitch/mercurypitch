// ============================================================
// HomePage — the "today" landing surface
// ============================================================
// One obvious next step: your streak (with forgiveness), today's generated
// 5–15 min session, this week's Legend challenge (wired in PR 2), and a thin
// progress strip. Reuses the daily-routine engine + streak service; adds no
// new launch or scoring infra.

import type { Component, JSX } from 'solid-js'
import { createMemo, createResource, createSignal, For, onMount, Show, } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { IconCheck, IconFire, IconTarget, IconTrophy, } from '@/components/exercise-icons'
import { InfoPopover } from '@/components/InfoPopover'
import { DAILY_GOAL_MS, getTodayScoredMinutes, } from '@/db/services/practice-minutes'
import { getStreakState, repairStreak } from '@/db/services/streak-service'
import { WeeklyLegendHero } from '@/features/challenges/WeeklyLegendHero'
import { DestinationGallery } from '@/features/home/DestinationGallery'
import { dismissNudge, satisfyNudge, shouldShowNudge, } from '@/features/onboarding/account-nudge'
import { AscentCard } from '@/features/path/AscentCard'
import { manualCompletePrompt, segmentSelfReports, } from '@/features/routines/manual-complete'
import { exerciseLabel, segmentVariantLabel, } from '@/features/routines/segment-labels'
import type { RoutineSegment, SegmentKind } from '@/features/routines/types'
import type { RoutineLength } from '@/features/routines/use-daily-routine'
import { launchRoutineSegment, routinePrefs, setRoutinePrefs, useDailyRoutine, } from '@/features/routines/use-daily-routine'
import { copyShareUrl, encodeRoutineForShare } from '@/lib/share-codec'
import { exerciseHistory } from '@/stores/exercise-history-store'
import { showNotification } from '@/stores/notifications-store'
import { openAuthModal } from '@/stores/ui-store'
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

  // The account nudge, gated on an earned moment: a streak of two or
  // more, and only while the ask is due. Dismissing it locally as well
  // as persistently means it disappears immediately rather than on the
  // next mount.
  const [streakNudgeOpen, setStreakNudgeOpen] = createSignal(true)
  // The segment awaiting a "yes, I sang it elsewhere" confirmation.
  const [confirmSeg, setConfirmSeg] = createSignal<RoutineSegment | null>(null)
  const showStreakNudge = (): boolean =>
    streakNudgeOpen() &&
    (streak()?.currentStreak ?? 0) >= 2 &&
    shouldShowNudge('streak-day-2')

  // A reload mid-routine keeps the ticks but loses the launch: the singer
  // lands here with no sign the app remembers where they were. Put the cursor
  // on the button that continues it, so Enter picks the session back up.
  //
  // preventScroll, because the page has not settled on mount and yanking it to
  // the card would move things out from under the reader — the session card is
  // in the first screenful anyway.
  let resumeBtn: HTMLButtonElement | undefined
  onMount(() => {
    if (routine.resumable()) resumeBtn?.focus({ preventScroll: true })
  })

  return (
    <div class={styles.page}>
      {/* A <div>, not <header>: the global app-bar CSS targets header and
          adds padding plus a doubled safe-area inset on phones. */}
      <div class={styles.head}>
        <h1 class={styles.greeting}>{greeting()}</h1>
        <p class={styles.date}>
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <div class={styles.grid}>
        {/* ── Streak ─────────────────────────────────────────── */}
        <section class={`${styles.card} home-streak-card`}>
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
              {/* Invariant on purpose — "5 day streak" reads as a compound,
                  so there is nothing to pluralise. */}
              <div class={styles.streakLabel}>day streak</div>
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
            <div class={styles.goalTextRow}>
              <span class={styles.goalText}>
                {goalMet
                  ? `Today counts — ${DAILY_GOAL_MIN} min sung`
                  : `${minutesToday} of ${DAILY_GOAL_MIN} min today keeps the streak`}
              </span>
              <InfoPopover label="How the streak works">
                Sing for {DAILY_GOAL_MIN} minutes and the day counts. Miss a day
                and a banked freeze covers it; miss one with no freeze and the
                streak goes back to zero. Anything you practise counts —
                sessions, exercises and challenges alike.
              </InfoPopover>
            </div>
          </div>

          {/* This week's numbers live here rather than in a card of
              their own below. The streak card was half empty, that one
              held three figures, and both printed the longest streak —
              so merging reclaims a whole card's height AND drops a
              duplicate. */}
          <div class={styles.weekStats}>
            <div class={styles.stat}>
              <span class={styles.statValue}>{weekStats().runs}</span>
              <span class={styles.statLabel}>drills this week</span>
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

          <Show when={(streak()?.freezes ?? 0) > 0}>
            <div class={styles.streakMeta}>
              <span>
                {streak()!.freezes} freeze
                {streak()!.freezes === 1 ? '' : 's'} banked
              </span>
            </div>
          </Show>

          <Show when={streak()?.canRepair}>
            <button class={styles.repairBtn} onClick={() => void onRepair()}>
              Repair streak — restore {streak()!.repairableStreak} days (free)
            </button>
          </Show>

          {/* Earned moment: two days in a row is the point a streak
              starts being worth protecting. Asked once, then quiet for a
              week; never blocks anything. */}
          {/* ── Today's session, folded into the streak card ─────
              It was a separate card below, which pushed the rooms down
              the page. Home now leads with one status card: streak, the
              week's numbers, and what to do about it today. */}
          <div class={`${styles.sessionInline} home-session-card`}>
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
                  {/* Four steps on one line instead of a 10-row paragraph.
                    The sentence said what the steps are; the steps say it
                    themselves, and the "picked for you" part — the only
                    thing the list does not carry — moves to the info. */}
                  <div class={styles.sessionSteps}>
                    <span>Warm up</span>
                    <span>Weak spot</span>
                    <span>New skill</span>
                    <span>A real phrase</span>
                    <InfoPopover label="How today's session is chosen">
                      Four short segments, picked from your practice history —
                      the weak-spot drill targets whatever you have been missing
                      most. Pick a length and it builds one for you.
                    </InfoPopover>
                  </div>
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
              {/* Only when they are actually mid-session and were here
                  recently — on a fresh routine the card's own Start button
                  already says what to do. */}
              <Show when={routine.resumable()}>
                <p class={styles.resumeNote}>
                  Picking up where you left off —{' '}
                  {routine.completedSegments().length} of{' '}
                  {routine.template()!.segments.length} done.
                </p>
              </Show>

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
                            {(exercise) => (
                              <span class={styles.segExercise}>
                                {' · '}
                                {exerciseLabel(exercise())}
                              </span>
                            )}
                          </Show>
                        </span>
                        <span class={styles.segDur}>
                          {/* Which mode: the warm-up alone has six, and
                              "Warm-up" twice over reads as a duplicate
                              rather than as sirens then lip trills. */}
                          <Show when={segmentVariantLabel(item.seg)}>
                            {(variant) => (
                              <span class={styles.segVariant}>{variant()}</span>
                            )}
                          </Show>
                          {Math.max(1, Math.round(item.seg.durationSec / 60))}{' '}
                          min
                        </span>
                      </span>
                      <Show when={item.current && !item.done}>
                        <button
                          ref={resumeBtn}
                          class={styles.segStart}
                          onClick={() => launchRoutineSegment(item.seg)}
                        >
                          {routine.resumable() ? 'Resume' : 'Start'}
                        </button>
                        <button
                          class={styles.segSkip}
                          title={
                            segmentSelfReports(item.seg)
                              ? 'Mark done without singing'
                              : 'Mark done'
                          }
                          onClick={() => {
                            // A scored drill records itself; ticking it by
                            // hand credits the streak and the calendar for
                            // a run that never happened. Ask first — but
                            // only for those, so a guided warm-up (no
                            // score to falsify) keeps its one click.
                            if (segmentSelfReports(item.seg)) {
                              setConfirmSeg(item.seg)
                              return
                            }
                            routine.completeSegment()
                          }}
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
                <div class={styles.doneBlock}>
                  <div class={styles.doneMsg}>
                    Session complete — nice work today.
                  </div>
                  {/* The sidebar panel has offered these all along; Home
                    showed the message and nothing to do next. */}
                  <div class={styles.doneActions}>
                    <button
                      class={styles.doneBtn}
                      onClick={() => {
                        const first = routine.template()?.segments?.[0]
                        if (first === undefined) return
                        launchRoutineSegment(first)
                      }}
                    >
                      Practise again
                    </button>
                    <button
                      class={styles.doneBtn}
                      onClick={() => routine.reset()}
                    >
                      New routine
                    </button>
                    <button
                      class={styles.doneBtn}
                      onClick={() => {
                        const t = routine.template()
                        if (!t) return
                        const encoded = encodeRoutineForShare({
                          id: t.id,
                          name: t.name,
                          description: t.description,
                          segments: t.segments.map((seg) => ({
                            type: seg.type,
                            durationSec: seg.durationSec,
                            config: seg.config as Record<string, unknown>,
                          })),
                        })
                        void copyShareUrl(encoded).then((ok: boolean) => {
                          showNotification(
                            ok
                              ? 'Routine link copied.'
                              : 'Could not copy the link.',
                            ok ? 'info' : 'error',
                          )
                        })
                      }}
                    >
                      Share
                    </button>
                  </div>
                </div>
              </Show>
            </Show>
          </div>

          <Show when={showStreakNudge()}>
            <div class={styles.accountNudge}>
              <span>
                {streak()?.currentStreak} days in a row — and right now that
                lives only in this browser. An account carries it to your phone,
                and keeps it if you clear your history.
              </span>
              <div class={styles.accountNudgeRow}>
                <button
                  class={styles.accountNudgeCta}
                  onClick={() => {
                    /* The sign-in modal, not #/settings/account: that page
                       has nothing to do for someone without an account, and
                       for someone who has one it was a dead end. */
                    satisfyNudge('streak-day-2')
                    setStreakNudgeOpen(false)
                    openAuthModal('register')
                  }}
                >
                  Create a free account
                </button>
                <button
                  class={styles.accountNudgeSkip}
                  onClick={() => {
                    dismissNudge('streak-day-2')
                    setStreakNudgeOpen(false)
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          </Show>
        </section>

        {/* ── This Week's Legend ─────────────────────────────── */}
        <WeeklyLegendHero />

        {/* ── The Ascent (guided path bridge) ────────────────── */}
        <AscentCard />
      </div>

      <ConfirmDialog
        open={confirmSeg() !== null}
        title={manualCompletePrompt(confirmSeg() ?? undefined).title}
        message={manualCompletePrompt(confirmSeg() ?? undefined).message}
        confirmLabel="Mark done"
        onConfirm={() => {
          routine.completeSegment()
          setConfirmSeg(null)
        }}
        onCancel={() => setConfirmSeg(null)}
      />

      <DestinationGallery />
    </div>
  )
}

export default HomePage
