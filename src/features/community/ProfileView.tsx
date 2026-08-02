// ============================================================
// ProfileView — your voice, so far
// ============================================================
//
// Lifted out of CommunityShare, where it was ~200 lines inside an
// 1100-line component and could not be looked at on its own.
//
// The old layout was four equal stat cards over two identical bar strips
// over four more equal cards. Everything had the same weight, so nothing
// led, and a singer who had not practised yet met a wall of confident
// zeros — "Best Score 0%" reads as a bad result rather than an empty one.
//
// This leads with who they are, states the numbers once as a supporting
// line, and draws the run as a single shape because "am I getting better"
// is the question a best-ever score cannot answer. With no history it
// says so and points at the thing to do.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ProfileSession } from '@/features/community/profile-model'
import { accuracySeries, profileStats, scoreSeries, sparklinePoints, trend, } from '@/features/community/profile-model'
import { legendArt, legendThumbSrc } from '@/features/mirror/LegendCaricature'
import styles from './ProfileView.module.css'

export interface ProfileViewProps {
  displayName: string
  bio: string
  /** Practice sessions, oldest first. */
  sessions: readonly ProfileSession[]
  streak: number
  sharedMelodies: number
  sharedSessions: number
  /** The legend this singer's range overlaps with, once measured. The
   *  portrait is resolved from it here rather than passed in, so art
   *  lookup stays in one place. */
  twinName?: string | undefined
}

const CHART_W = 520
const CHART_H = 64

/** A number with its unit, sized so the number leads. */
const Figure: Component<{ value: string; label: string }> = (props) => (
  <div class={styles.figure}>
    <span class={styles.figureValue}>{props.value}</span>
    <span class={styles.figureLabel}>{props.label}</span>
  </div>
)

export const ProfileView: Component<ProfileViewProps> = (props) => {
  const stats = () => profileStats(props.sessions)
  const scores = () => scoreSeries(props.sessions)
  const accuracy = () => accuracySeries(props.sessions)
  const movement = () => trend(scores())

  /** Thumb plus full portrait for the twin, when it has raster art. */
  const portrait = (): { thumb: string; full: string } | undefined => {
    const twin = props.twinName
    if (twin === undefined || twin === '') return undefined
    const thumb = legendThumbSrc(twin)
    const full = legendArt(twin).imageSrc
    if (thumb === undefined || full === undefined || full === '') {
      return undefined
    }
    return { thumb, full }
  }

  const since = () => {
    const at = stats()?.firstAt
    if (at === undefined) return ''
    return new Date(at).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div class={styles.profile}>
      <div class={styles.identity}>
        <Show
          when={portrait()}
          fallback={
            /* A monogram rather than a generic user glyph: an empty
               rounded box reads as an image that failed to load, and the
               portrait slot is real (the voice twin fills it once one has
               been measured). */
            <div class={styles.avatarFallback} aria-hidden="true">
              {props.displayName.trim().charAt(0).toUpperCase()}
            </div>
          }
        >
          {(art) => (
            /* The 120px thumb covers a 72px box at 1x; a hi-DPI screen or
               a zoomed page gets the full portrait instead, because
               upscaling the thumb is the one thing that would look worse
               than either. See the image-sharpness playbook. */
            <img
              class={styles.avatar}
              src={art().thumb}
              srcset={`${art().thumb} 1x, ${art().full} 2x`}
              width="72"
              height="89"
              alt={`${props.twinName ?? ''} — your voice twin`}
              decoding="async"
            />
          )}
        </Show>
        <div class={styles.identityText}>
          <h2 class={styles.name}>{props.displayName}</h2>
          <Show when={props.twinName}>
            {(twin) => <p class={styles.twin}>Voice twin: {twin()}</p>}
          </Show>
          <p class={styles.bio}>{props.bio}</p>
        </div>
      </div>

      <Show
        when={stats()}
        fallback={
          <p class={styles.nothingYet}>
            Nothing to show yet — finish a practice session and your range, your
            best runs and how they move over time all start filling in here.
          </p>
        }
      >
        {(s) => (
          <>
            {/* Said once, as a line. Four equal cards gave a best-ever the
                same weight as a session count, which is not how anyone
                reads their own progress. */}
            <div class={styles.figures}>
              <Figure value={String(s().sessions)} label="sessions" />
              <Figure value={`${s().best}%`} label="best" />
              <Figure value={`${s().recentAverage}%`} label="recent average" />
              <Show when={props.streak > 0}>
                <Figure
                  value={String(props.streak)}
                  label={props.streak === 1 ? 'day streak' : 'days running'}
                />
              </Show>
            </div>

            <Show when={scores().length >= 2}>
              <section class={styles.trendSection}>
                <div class={styles.trendHead}>
                  <h3 class={styles.sectionTitle}>How it has been going</h3>
                  <Show when={movement() !== null}>
                    {(_) => {
                      const delta = movement()!
                      return (
                        <span
                          class={styles.movement}
                          classList={{
                            [styles.movementUp]: delta > 0,
                            [styles.movementDown]: delta < 0,
                          }}
                        >
                          {delta > 0 ? '+' : ''}
                          {delta} points
                        </span>
                      )
                    }}
                  </Show>
                </div>
                {/* One shape, not two identical bar strips: the line is the
                    answer to "am I improving", and accuracy rides under it
                    for context rather than repeating the same chart. */}
                <svg
                  class={styles.chart}
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`Scores across your last ${scores().length} sessions`}
                >
                  <polyline
                    class={styles.chartAccuracy}
                    points={sparklinePoints(accuracy(), CHART_W, CHART_H)}
                  />
                  <polyline
                    class={styles.chartScore}
                    points={sparklinePoints(scores(), CHART_W, CHART_H)}
                  />
                </svg>
                <p class={styles.chartLegend}>
                  Score, with pitch accuracy behind it. Since {since()}.
                </p>
              </section>
            </Show>
          </>
        )}
      </Show>

      <Show when={props.sharedMelodies + props.sharedSessions > 0}>
        <section class={styles.sharedSection}>
          <h3 class={styles.sectionTitle}>Shared</h3>
          <ul class={styles.sharedList}>
            <For
              each={[
                { n: props.sharedMelodies, one: 'melody', many: 'melodies' },
                { n: props.sharedSessions, one: 'session', many: 'sessions' },
              ].filter((row) => row.n > 0)}
            >
              {(row) => (
                <li class={styles.sharedRow}>
                  <span class={styles.sharedCount}>{row.n}</span>
                  <span>{row.n === 1 ? row.one : row.many}</span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </div>
  )
}
