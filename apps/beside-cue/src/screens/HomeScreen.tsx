// ============================================================
// Home — the same room: the deck, the plan's record on it, Corky beside
// ============================================================
//
// One stage under the header (HomeScene), then the plan as stationary,
// selectable HTML: YOUR SIDE B, the Side B itself, INSTEAD OF the Pull and
// YOUR CUE when the plan has one. Cue me now in flow, two open rows (the
// daily reminder, Change this plan), the B-side games entry, Pause this plan
// and the nav. Nothing on this screen counts anything; Reflection owns that.
//
// The record turns only for an intentional action. Cue me now starts the
// spin and hands off after one short authored beat, so the deck is seen to
// answer before the cue moment takes the screen; the beat is presentation,
// the cue itself is created by the shell exactly as before. Reduced motion,
// or an environment that cannot report a motion preference, hands off at
// once. Coming back after a recorded Side B, the record wears its Side B face
// and completes one slowing revolution; after Not now nothing moves.

import { createSignal, onCleanup, Show } from 'solid-js'
import { AppHeader } from '@/components/AppHeader'
import type { MainView } from '@/components/BottomNav'
import { BottomNav } from '@/components/BottomNav'
import type { RecordSide } from '@/components/HomeRecord'
import { HomeScene } from '@/components/HomeScene'
import { useCopy } from '@/i18n/ui-copy'
import { Selectable } from '@/interaction/selection'
import styles from './HomeScreen.module.css'

export interface HomePlan {
  pullText: string
  bSideText: string
  cueContextText?: string
  /** The plan's Pull; absent for a self-named Pull. */
  pullId?: string
  paused: boolean
  /** The daily reminder's local time, when one is set. */
  scheduleTime?: string
}

interface HomeScreenProps {
  /** Absent when no plan is on the deck yet. */
  plan?: HomePlan
  cueStatePending: boolean
  recordSide: RecordSide
  /** Owe the one slowing revolution (back from a recorded Side B). */
  recordSettle: boolean
  onRecordSettled: () => void
  activeView: MainView
  onChangeView: (view: MainView) => void
  onCueNow: () => void
  onPauseToggle: () => void
  onOpenSettings: () => void
  /** Settings, opened at the Daily reminder group. */
  onOpenReminder: () => void
  /** The prefilled replace flow. */
  onReplace: () => void
  onStartPlan: () => void
  onOpenGames: () => void
  muted: boolean
  onMuteToggle: () => void
}

/** The app's one authored plan transition, during which the record turns. */
export const CUE_HANDOFF_MS = 680

function motionWanted(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const CHEVRON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m9 5 7 7-7 7" />
  </svg>
)

export function HomeScreen(props: HomeScreenProps) {
  const copy = useCopy()
  const [cueing, setCueing] = createSignal(false)
  let handoff: ReturnType<typeof setTimeout> | undefined

  function handleCueNow(): void {
    if (cueing() || props.plan === undefined || props.plan.paused) return
    if (!motionWanted()) {
      props.onCueNow()
      return
    }
    setCueing(true)
    handoff = setTimeout(() => {
      handoff = undefined
      setCueing(false)
      props.onCueNow()
    }, CUE_HANDOFF_MS)
  }

  onCleanup(() => {
    if (handoff !== undefined) clearTimeout(handoff)
  })

  const motion = () =>
    cueing() ? 'spin' : props.recordSettle ? 'settle' : 'still'

  const reminder = () => {
    const plan = props.plan
    if (plan === undefined) return undefined
    if (plan.paused)
      return {
        line: copy.t('This reminder stays off while your plan is paused.'),
        value: copy.t('Off'),
        off: true,
      }
    if (plan.scheduleTime === undefined)
      return {
        line: copy.t('Only when I ask'),
        value: copy.t('Set'),
        off: true,
      }
    return {
      line: copy.t('Around {time}', { time: plan.scheduleTime }),
      value: copy.t('Change'),
      off: false,
    }
  }

  return (
    <main class="home-screen app-screen app-screen--with-nav">
      <div class={styles.header}>
        <AppHeader
          actionLabel={copy.t('Settings')}
          onAction={props.onOpenSettings}
          actionAccessory={
            <button
              class={`icon-button ${styles.soundToggle}`}
              type="button"
              aria-label={copy.t(props.muted ? 'Unmute audio' : 'Mute audio')}
              aria-pressed={props.muted}
              onClick={() => props.onMuteToggle()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                {props.muted ? (
                  <path d="m16 9 5 6m0-6-5 6" />
                ) : (
                  <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
                )}
              </svg>
            </button>
          }
        />
      </div>
      <section class={styles.layout} aria-labelledby="home-title">
        <h1 id="home-title" class={`visually-hidden ${styles.title}`}>
          {copy.t('Your current plan')}
        </h1>
        <HomeScene
          class={styles.scene}
          {...(props.plan === undefined
            ? {}
            : {
                record: {
                  side: props.recordSide,
                  motion: motion(),
                  ...(props.plan.pullId === undefined
                    ? {}
                    : { pullId: props.plan.pullId }),
                },
              })}
          paused={props.plan?.paused === true}
          onSettled={props.onRecordSettled}
        />
        <div class={styles.body}>
          <Show
            when={props.plan}
            fallback={
              <>
                <div class={styles.plan}>
                  <p class={styles.kicker}>{copy.t('Your first plan')}</p>
                  <p class={styles.sideB}>
                    {copy.t('No plan on the deck yet.')}
                  </p>
                  <p class={styles.line}>
                    {copy.t(
                      'Pick one Pull, name the moment, choose a small Side B.',
                    )}
                  </p>
                </div>
                <button
                  class={`cue-now-button ${styles.start}`}
                  type="button"
                  onClick={() => props.onStartPlan()}
                >
                  <span class="cue-now-button__disc" aria-hidden="true">
                    <span />
                  </span>
                  <span>
                    <strong>{copy.t('Start a plan')}</strong>
                    <small>{copy.t('Corky keeps the deck warm')}</small>
                  </span>
                </button>
              </>
            }
          >
            {(plan) => (
              <>
                <div class={styles.plan}>
                  <p class={styles.kicker}>
                    {copy.t(
                      props.recordSide === 'B'
                        ? 'Your Side B · turned today'
                        : 'Your Side B',
                    )}
                  </p>
                  <p class={styles.sideB} {...Selectable}>
                    {plan().bSideText}
                  </p>
                  <dl class={styles.details}>
                    <div class={styles.line}>
                      <dt class={styles.label}>{copy.t('Instead of')}</dt>
                      <dd {...Selectable}>{plan().pullText}</dd>
                    </div>
                    <Show when={plan().cueContextText}>
                      {(context) => (
                        <div class={`${styles.line} ${styles.cue}`}>
                          <dt class={styles.label}>{copy.t('Your cue')}</dt>
                          <dd {...Selectable}>{context()}</dd>
                        </div>
                      )}
                    </Show>
                  </dl>
                </div>

                <Show
                  when={!plan().paused}
                  fallback={
                    <button
                      class={`cue-now-button ${styles.resume}`}
                      type="button"
                      onClick={() => props.onPauseToggle()}
                      disabled={props.cueStatePending}
                      aria-describedby="paused-note"
                    >
                      <span class="cue-now-button__disc" aria-hidden="true">
                        <span />
                      </span>
                      <span>
                        <strong>
                          {copy.t(
                            props.cueStatePending
                              ? 'Updating plan…'
                              : 'Resume this plan',
                          )}
                        </strong>
                        <small>
                          {copy.t(
                            'Make reminders and Cue me now available again.',
                          )}
                        </small>
                      </span>
                    </button>
                  }
                >
                  <button
                    class="cue-now-button"
                    type="button"
                    onClick={handleCueNow}
                    aria-busy={cueing()}
                  >
                    <span class="cue-now-button__disc" aria-hidden="true">
                      <span />
                    </span>
                    <span>
                      <strong>{copy.t('Cue me now')}</strong>
                      <small>{copy.t('Show the action I chose')}</small>
                    </span>
                  </button>
                </Show>

                <div class={styles.rows}>
                  <button
                    class={`settings-row ${styles.row}`}
                    type="button"
                    onClick={() => props.onOpenReminder()}
                  >
                    <span>
                      <strong>{copy.t('Daily reminder')}</strong>
                      <small>{reminder()?.line}</small>
                    </span>
                    <span
                      class={styles.value}
                      classList={{
                        [styles.valueOff]: reminder()?.off === true,
                      }}
                    >
                      {reminder()?.value}
                    </span>
                    {CHEVRON}
                  </button>
                  <button
                    class={`settings-row ${styles.row}`}
                    type="button"
                    onClick={() => props.onReplace()}
                    disabled={props.cueStatePending}
                  >
                    <span>
                      <strong>{copy.t('Change this plan')}</strong>
                      <small>
                        {copy.t(
                          'Same Pull, cue and Side B, prefilled. History and reminder stay.',
                        )}
                      </small>
                    </span>
                    <span class={styles.value} aria-hidden="true" />
                    {CHEVRON}
                  </button>
                </div>

                <button
                  class="games-entry"
                  type="button"
                  onClick={() => props.onOpenGames()}
                >
                  <img src="games/merc.webp" alt="" width="34" height="34" />
                  <span>
                    <strong>{copy.t('B-side games')}</strong>
                    <small>
                      {copy.t('Sing a few quiet minutes with Merc')}
                    </small>
                  </span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 5 7 7-7 7" />
                  </svg>
                </button>

                <div class={`home-screen__quiet-controls ${styles.quiet}`}>
                  <Show
                    when={!plan().paused}
                    fallback={
                      <p id="paused-note">
                        {copy.t(
                          'Your plan and history are still here. The daily reminder and Cue me now stay off until you resume it.',
                        )}
                      </p>
                    }
                  >
                    <button
                      class="quiet-button"
                      type="button"
                      disabled={props.cueStatePending}
                      onClick={() => props.onPauseToggle()}
                    >
                      {copy.t(
                        props.cueStatePending
                          ? 'Updating plan…'
                          : 'Pause this plan',
                      )}
                    </button>
                  </Show>
                </div>
              </>
            )}
          </Show>
        </div>
      </section>
      <BottomNav active={props.activeView} onChange={props.onChangeView} />
    </main>
  )
}
