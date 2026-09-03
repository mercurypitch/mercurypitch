// ============================================================
// WeeklyLegendHero — the "Legend Attempt" card (Home)
//
// The file keeps its name: renaming it, its stylesheet, the service, the DB
// table and the two attempt kinds would be a wide rename for no user-visible
// gain. What people read is period-neutral now, which is the point — the run
// length is a pair of dates in the admin form and nothing else, so it can be
// a week, four weeks, or anything else without the copy going stale.
// ============================================================
// Shows the active weekly challenge: feat framing, countdown, a "Hear it"
// link (official upload), a "Sing it" attempt that performs the line on the
// challenge stage (zen canvas), and a compact board (top singers + the
// founder + your standing). The stage reports through the exercise-history
// funnel, so the weekly-attempt return path is unchanged.

import type { Component } from 'solid-js'
import { createEffect, createResource, createSignal, For, Show } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Trophy } from '@/components/icons'
import { EXERCISE_SIGHT_SINGING } from '@/features/exercises/types'
import { TAB_CHALLENGES } from '@/features/tabs/constants'
import { showNotification } from '@/stores/notifications-store'
import { openChallengeStage, setActiveTab } from '@/stores/ui-store'
import { grantBoardConsent, hasBoardConsent } from './board-consent'
import { requestPastChallengesScroll } from './PastWeeklyChallenges'
import { beginWeeklyAttempt, clearWeeklyAttempt, weeklyAttemptVersion, } from './weekly-attempt'
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

  // ── Consent before the first ranked take ──────────────────────
  //
  // A ranked attempt publishes a name beside a score on a board that freezes
  // and is kept, so the singer is asked before the take rather than after it.
  // Declining is not a dead end: the same melody is one tap away as practice.
  const [consentOpen, setConsentOpen] = createSignal(false)
  const [consenting, setConsenting] = createSignal(false)
  // The consent read is async, so "Sing it" is no longer instantaneous and a
  // second tap inside that window used to start a second attempt.
  let checkingConsent = false

  function attempt(): void {
    if (checkingConsent || consentOpen()) return
    checkingConsent = true
    void (async () => {
      try {
        if (challenge() === undefined) return
        if (await hasBoardConsent()) {
          startRankedAttempt()
          return
        }
        setConsentOpen(true)
      } finally {
        checkingConsent = false
      }
    })()
  }

  /** Store the consent, then take the attempt it was asked for. */
  async function acceptConsent(): Promise<void> {
    setConsenting(true)
    const stored = await grantBoardConsent()
    setConsenting(false)
    if (!stored) {
      // Never start a ranked take on a consent that was not saved — the
      // score would publish a name the record cannot show was agreed to.
      showNotification('Could not save that — try again', 'error')
      return
    }
    setConsentOpen(false)
    startRankedAttempt()
  }

  /** Decline: the melody is still worth singing, just not for the board. */
  function declineConsent(): void {
    const c = challenge()
    setConsentOpen(false)
    if (!c) return
    clearWeeklyAttempt()
    openChallengeStage({
      challengeId: c.id,
      title: c.title,
      targetScore: c.targetScore,
      targetItems: c.targetItems,
      mode: 'practice',
    })
  }

  function startRankedAttempt(): void {
    const c = challenge()
    if (!c) return
    beginWeeklyAttempt({
      challengeId: c.id,
      title: c.title,
      exercise: EXERCISE_SIGHT_SINGING,
      targetScore: c.targetScore,
      rewardBadgeId: c.rewardBadgeId,
      founderScore: c.founderScore,
      targetItems: c.targetItems,
    })
    openChallengeStage({
      challengeId: c.id,
      title: c.title,
      targetScore: c.targetScore,
      targetItems: c.targetItems,
      mode: 'ranked',
    })
  }

  function showPastChallenges(): void {
    requestPastChallengesScroll()
    setActiveTab(TAB_CHALLENGES)
  }

  return (
    <section class={`${styles.card} home-legend-card`}>
      <div class={styles.eyebrowRow}>
        <span class={styles.eyebrow}>Legend Attempt</span>
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
          One scored take counts. A temporary local voice replay follows the
          result; it is kept only if you choose. Anything after is practice
          until you tap "Sing it" again.
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
                {/* An unranked singer gets their score and the truth about
                    it. Showing a placing to someone who is not on the list
                    would be the one number on this card that is not real. */}
                <Show
                  when={board()!.you!.ranked}
                  fallback={
                    <span class={styles.unranked} data-testid="you-unranked">
                      Your best {board()!.you!.best}% · not on the board — turn
                      on public boards in Settings to be ranked
                    </span>
                  }
                >
                  <Show
                    when={board()!.you!.beatFounder}
                    fallback={
                      <span>
                        Your best {board()!.you!.best}% · top{' '}
                        {board()!.you!.percentile}% of {board()!.rankedCount}
                      </span>
                    }
                  >
                    <span class={styles.beatFounder}>
                      You beat the Founder — {board()!.you!.best}%
                    </span>
                  </Show>
                </Show>
              </div>
            </Show>
          </div>
        </Show>

        <button class={styles.allLink} onClick={showPastChallenges}>
          See past challenges
        </button>
      </Show>

      <ConfirmDialog
        open={consentOpen()}
        busy={consenting()}
        title="Sing it for the board?"
        confirmLabel="Put me on the board"
        confirmIcon={<Trophy />}
        message={
          <>
            A ranked take puts your display name and score on this challenge's
            public board, and keeps them on its podium after it closes. You can
            turn public boards off again in Settings at any time — past podiums
            redact your name when you do.
            <br />
            <br />
            Prefer not to? You can still sing this melody as practice. Nothing
            is recorded to the board.
          </>
        }
        onConfirm={() => void acceptConsent()}
        onCancel={declineConsent}
      />
    </section>
  )
}
