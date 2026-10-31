// ============================================================
// The day's close: today's three are done. What each one moved, the
// day counted (never a streak), the orb the day lit and its name, on a
// phone that can, a reminder each morning from tomorrow (ReminderRow),
// and the Ear Report as the one filled button, Done under it. No medal,
// no seal: the headline says it. In the drill room's light, as the
// bench mock-ups draw it.
// ============================================================

import type { JSX } from 'solid-js'
import { createUniqueId, For, onMount, Show } from 'solid-js'
import { MercPresence } from '@/components/room-kit/MercPresence'
import { IconCheck, IconChevron, IconClose } from '@/features/ear-lab/ear-icons'
import { FACULTY_LABEL, findIdentificationDrill, findThresholdDrill, } from '@/lib/ear/drills'
import type { PathMilestone } from '@/lib/ear/path'
import { pathCount } from '@/lib/ear/path'
import { earToday, sprintHistory, todaysSprint } from '@/stores/ear-lab-store'
import styles from './bench.module.css'
import { benchDays, orbLine, REPORT_LINE, TODAY_DONE } from './merc-lines'
import { PathOrbs } from './PathOrbs'
import { remindersOffered } from './reminder'
import { ReminderRow } from './ReminderRow'
import { todayMoves } from './session'
import { mercStill } from './stills'

function facultyOf(drillId: string): string {
  const faculty =
    findThresholdDrill(drillId)?.faculty ??
    findIdentificationDrill(drillId)?.faculty
  return faculty === undefined ? '' : FACULTY_LABEL[faculty]
}

function nameOf(drillId: string): string {
  return (
    findThresholdDrill(drillId)?.name ??
    findIdentificationDrill(drillId)?.name ??
    drillId
  )
}

export function TodayDone(props: {
  milestones: readonly PathMilestone[]
  /** The milestones lit as the day opened. */
  litAtOpen: readonly string[]
  onReport: () => void
  onClose: () => void
}): JSX.Element {
  let host: HTMLElement | undefined
  const titleId = `merc-day-${createUniqueId()}`
  onMount(() =>
    queueMicrotask(() =>
      host
        ?.querySelector<HTMLElement>('button')
        ?.focus({ preventScroll: true }),
    ),
  )
  const moves = () => todayMoves(earToday())
  const plan = () => todaysSprint()
  const count = () => pathCount(props.milestones)
  const litToday = (): PathMilestone | null =>
    props.milestones.find(
      (milestone) => milestone.lit && !props.litAtOpen.includes(milestone.id),
    ) ?? null
  const pathWords = (): string => {
    const today = litToday()
    if (today !== null) {
      const position = props.milestones.indexOf(today) + 1
      return orbLine(position, today.label)
    }
    const next = props.milestones.find((milestone) => !milestone.lit)
    return next === undefined
      ? 'Every orb on the path is lit.'
      : `Next on the path: ${next.label}.`
  }
  return (
    <section
      class={styles.dayDone}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      ref={host}
      data-testid="merc-today-done"
    >
      <button
        type="button"
        class={styles.sheetClose}
        aria-label="Close, back to the Ear Lab"
        onClick={() => props.onClose()}
      >
        <IconClose size={18} />
      </button>
      <div class={styles.dayHead}>
        <div class={styles.dayMerc}>
          <MercPresence
            state={() => 'celebrate'}
            stillSrc={mercStill('celebrate')}
            size={96}
            testId="merc-day-merc"
          />
        </div>
        <div class={styles.sheetBubble}>
          <p>{TODAY_DONE.merc}</p>
        </div>
      </div>
      <h1 id={titleId} class={styles.dayTitle}>
        {TODAY_DONE.headline}
      </h1>
      <p class={styles.dayCount}>
        {benchDays(Math.max(1, sprintHistory().length))}
      </p>

      <section
        class={`${styles.card} ${styles.moves}`}
        aria-label="What moved today"
      >
        <For each={plan()}>
          {(segment) => {
            const move = () =>
              moves().find((entry) => entry.drillId === segment.drillId)
            return (
              <div class={styles.move}>
                <span class={styles.moveCheck} aria-hidden="true">
                  <IconCheck size={14} />
                </span>
                <span class={styles.moveText}>
                  <b>{nameOf(segment.drillId)}</b>
                  <small>
                    {facultyOf(segment.drillId)}
                    {move() === undefined
                      ? ''
                      : move()?.before === null
                        ? ' · first reading'
                        : ` · ${move()?.caption ?? ''}`}
                  </small>
                </span>
                <Show when={move()?.before}>
                  {(before) => (
                    <span class={styles.moveBefore}>
                      {before()}
                      <span class={styles.srOnly}> to </span>
                    </span>
                  )}
                </Show>
                <span class={styles.moveAfter}>{move()?.after ?? 'done'}</span>
              </div>
            )
          }}
        </For>
      </section>

      <section
        class={styles.card}
        style={{ 'margin-top': '14px' }}
        aria-label="The Ear Path"
      >
        <div class={styles.cardHead}>
          <h2 class={styles.h2}>The Ear Path</h2>
          <span class={styles.count}>
            {count().lit} of {count().of} lit
          </span>
        </div>
        <PathOrbs
          milestones={props.milestones}
          litToday={litToday()?.id ?? null}
        />
        <p class={styles.pathLine}>{pathWords()}</p>
      </section>

      <Show when={remindersOffered()}>
        <ReminderRow />
      </Show>

      <button
        type="button"
        class={styles.primary}
        style={{ 'margin-top': '18px' }}
        data-testid="merc-day-report"
        onClick={() => props.onReport()}
      >
        Ear Report
        <IconChevron size={18} class={styles.onward} />
      </button>
      <p class={styles.reportLine}>{REPORT_LINE}</p>

      <button
        type="button"
        class={styles.quiet}
        data-testid="merc-day-done"
        onClick={() => props.onClose()}
      >
        Done
      </button>
    </section>
  )
}
