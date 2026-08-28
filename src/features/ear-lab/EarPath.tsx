// ============================================================
// EarPath — the going train on the bench.
//
// Eleven orbs on one brass rail, lit from the store: the first
// reading, the first seal, each faculty sealed, the first rhythm
// take, the first page of the Field Book, the first desk reading, a
// month of regulation. The next dark orb is ringed and the plate's
// Next line opens its instrument; none of them locks anything. The
// milestones live in lib/ear/path.ts — this plate reads the store
// and draws them.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { DESK_TRACKS } from '@/lib/ear/desk'
import { IDENTIFICATION_DRILLS, THRESHOLD_DRILLS } from '@/lib/ear/drills'
import type { PathMilestone, PathView } from '@/lib/ear/path'
import { earPath, nextOnPath, pathCount } from '@/lib/ear/path'
import { WILD_TRACKS } from '@/lib/ear/wild'
import { calibrationHistory, earPlayerRating, latestThresholdReading, sprintHistory, sprintProgress, todaysSprint, } from '@/stores/ear-lab-store'
import { VIEW_FOR_DRILL } from './drill-views'
import type { EarLabView } from './EarLabDashboard'
import styles from './EarPath.module.css'

interface EarPathProps {
  onNavigate: (view: EarLabView) => void
}

/** Every id the store may hold a reading or a rating under. */
const TRACKED_IDS: readonly string[] = [
  ...THRESHOLD_DRILLS.map((drill) => drill.id),
  ...IDENTIFICATION_DRILLS.map((drill) => drill.id),
  ...WILD_TRACKS,
  ...DESK_TRACKS,
  'echo-sing',
  'span-sing',
]

/** The words on the Next button, per destination. */
const GO_WORD: Record<PathView, string> = {
  hairline: 'Open Hairline',
  calibration: 'Run Calibration',
  home: 'Open Home',
  contour: 'Open Contour',
  stack: 'Open Stack',
  grid: 'Open the Grid',
  pulse: 'Open Pulse',
  'field-book': 'Open the Field Book',
  desk: 'Open the desk',
  regulation: "Today's regulation",
}

function attemptedIds(): Set<string> {
  const ids = new Set<string>()
  for (const id of TRACKED_IDS) {
    if (
      latestThresholdReading(id) !== null ||
      earPlayerRating(id).attempts > 0
    ) {
      ids.add(id)
    }
  }
  return ids
}

export function EarPath(props: EarPathProps): JSX.Element {
  const milestones = createMemo(() =>
    earPath({
      attempted: attemptedIds(),
      seals: calibrationHistory().map((run) => Object.keys(run.parts)),
      regulationDays: sprintHistory().length,
    }),
  )
  const next = createMemo(() => nextOnPath(milestones()))
  const count = createMemo(() => pathCount(milestones()))

  // The month's orb points at whatever is still open in today's
  // regulation; with the day done it points at the first instrument.
  const regulationView = (): EarLabView => {
    const done = new Set(sprintProgress().done)
    const open = todaysSprint().find((segment) => !done.has(segment.drillId))
    if (open === undefined) return 'hairline'
    return VIEW_FOR_DRILL[open.drillId] ?? 'hairline'
  }
  const go = (milestone: PathMilestone): void => {
    props.onNavigate(
      milestone.view === 'regulation' ? regulationView() : milestone.view,
    )
  }

  return (
    <section class={styles.card} data-tour="ear.path" aria-label="The Ear Path">
      <header class={styles.head}>
        <span class={styles.title}>The Ear Path</span>
        <span class={styles.count} data-testid="ear-path-count">
          {count().lit} of {count().of} lit
        </span>
      </header>

      <ol class={styles.train} aria-label="Milestones">
        <For each={milestones()}>
          {(milestone) => {
            const isNext = () => next()?.id === milestone.id
            return (
              <li
                class={styles.stop}
                classList={{
                  [styles.stopLit]: milestone.lit,
                  [styles.stopNext]: isNext(),
                }}
                data-milestone={milestone.id}
                data-lit={milestone.lit ? '' : undefined}
              >
                <button
                  type="button"
                  class={styles.orb}
                  title={milestone.label}
                  aria-label={`${milestone.label} — ${milestone.lit ? 'lit' : 'dark'}`}
                  aria-current={isNext() ? 'step' : undefined}
                  onClick={() => go(milestone)}
                >
                  <span class={styles.jewel} aria-hidden="true" />
                </button>
              </li>
            )
          }}
        </For>
      </ol>

      <div class={styles.next}>
        <Show
          when={next()}
          fallback={
            <span class={styles.nextName}>
              The train is complete — every orb is lit.
            </span>
          }
        >
          {(milestone) => (
            <>
              <span class={styles.nextMain}>
                <span class={styles.nextKicker}>Next</span>
                <span class={styles.nextName}>
                  {milestone().label}
                  <Show when={milestone().progress}>
                    {(progress) =>
                      ` — ${progress().done} of ${progress().of} days`
                    }
                  </Show>
                </span>
                <span class={styles.nextNote}>{milestone().note}</span>
              </span>
              <button
                type="button"
                class={styles.go}
                data-testid="ear-path-go"
                onClick={() => go(milestone())}
              >
                {GO_WORD[milestone().view]}
              </button>
            </>
          )}
        </Show>
      </div>
    </section>
  )
}
