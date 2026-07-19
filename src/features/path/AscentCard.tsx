// ============================================================
// AscentCard — the compact "Your Ascent" card on Home
// ============================================================
// A one-glance bridge to the guided path: the current orb (mini), where
// you are, and one tap into the Path tab. Before the path is started it
// invites instead.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { ASCENT_WEEKS, DAYS_PER_WEEK, getWeek, } from '@/features/path/path-content'
import { pathComplete, pathProgress, ringFill, weekState, } from '@/features/path/path-progress'
import { PathOrb } from '@/features/path/PathOrb'
import { TAB_PATH } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores/ui-store'
import styles from './AscentCard.module.css'

export const AscentCard: Component = () => {
  const progress = pathProgress
  const currentWeek = () => progress()?.currentWeek ?? 1
  const week = () => getWeek(currentWeek())

  return (
    <button
      class={`${styles.card} home-ascent-card`}
      onClick={() => setActiveTab(TAB_PATH)}
      aria-label="Open The Ascent guided path"
    >
      <div class={styles.orb}>
        <PathOrb
          fill={ringFill(currentWeek())}
          state={progress() === null ? 'available' : weekState(currentWeek())}
          size={56}
          showFraction={false}
        />
      </div>
      <div class={styles.body}>
        <div class={styles.eyebrow}>The Ascent</div>
        <Show
          when={progress() !== null}
          fallback={
            <>
              <div class={styles.title}>Begin your guided path</div>
              <div class={styles.sub}>
                {ASCENT_WEEKS.length} weeks, one orb at a time — your daily
                practice lights the way.
              </div>
            </>
          }
        >
          <Show
            when={!pathComplete()}
            fallback={
              <>
                <div class={styles.title}>The Ascent, complete</div>
                <div class={styles.sub}>
                  Every orb radiant. Replay any week.
                </div>
              </>
            }
          >
            <div class={styles.title}>
              Week {currentWeek()} · {week()?.title}
            </div>
            <div class={styles.sub}>
              {ringFill(currentWeek())} / {DAYS_PER_WEEK} days this week
            </div>
          </Show>
        </Show>
      </div>
      <svg
        class={styles.chevron}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}
