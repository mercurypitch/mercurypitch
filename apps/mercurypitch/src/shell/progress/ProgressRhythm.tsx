// ============================================================
// Rhythm: the record's weeks as bars, and a week's own sheet
// ============================================================
//
// Thirteen weeks, one bar each, as tall as that week's scored attempts
// against the busiest week's (the snapshot's activityLevel); a week with
// none is a dot on the line. Each bar is a button that opens the week's
// sheet with what the snapshot says of it: its dates, its summary, its
// active days and attempts, the kinds of run sung and a milestone earned
// in it. The arrow keys walk the weeks, as on the web's Atlas.
//
// Thirteen bars share the card's width, about 25 px a column at 390 wide:
// each button is its whole column, the chart's full height, so a tap
// anywhere above a week lands on it.
//
// A week that earned a milestone wears a pin over its bar, and a key under
// the axis says what the pin means, since a touch has no tooltip to ask.
// Both are for the eye only: a week's name already says its milestone.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, Show } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import type { ProgressRhythmView, ProgressWeekView, } from '@/features/progress/ProgressPage'
import { TrophyIcon } from '../icons'
import { sourceWord, weekLabel, weekOrdinal } from './progress-lines'
import { LabelTile, SheetTop, SourceIcon, Tiles, useSheetBack, } from './progress-parts'

export interface RhythmCardProps {
  rhythm: ProgressRhythmView
  weeks: readonly ProgressWeekView[]
  selectedWeekId?: string
  /** What the bars draw, as the snapshot names it. */
  traceLabel?: string
}

interface OpenWeek {
  week: ProgressWeekView
  index: number
}

/** One week, in its own sheet. */
function WeekSheet(props: {
  open: OpenWeek | null
  count: number
  onClose: () => void
}): JSX.Element {
  useSheetBack(
    () => props.open !== null,
    () => props.onClose(),
  )
  return (
    <Sheet
      isOpen={props.open !== null}
      close={() => props.onClose()}
      ariaLabel={
        props.open === null ? 'A week' : `Week of ${props.open.week.rangeLabel}`
      }
      class="mp-prog-sheet"
    >
      <Show when={props.open}>
        {(open) => (
          <div
            class="mp-prog-week-sheet"
            data-testid="progress-week-sheet"
            data-week={open().week.id}
          >
            <SheetTop
              eyebrow={weekOrdinal(open().index, props.count)}
              title={open().week.rangeLabel}
              titleId="mp-prog-week-title"
              onClose={() => props.onClose()}
            />
            <p class="mp-prog-sheet__lead">{open().week.summary}</p>
            <div class="mp-prog-tiles">
              <LabelTile id="days" label={open().week.activeDaysLabel} />
              <LabelTile id="attempts" label={open().week.attemptsLabel} />
            </div>
            <Show when={open().week.sources.length > 0}>
              <ul class="mp-prog-kinds" aria-label="Kinds of run this week">
                <For each={open().week.sources}>
                  {(source) => (
                    <li class="mp-prog-kind" data-source={source}>
                      <span class="mp-prog-kind__icon" aria-hidden="true">
                        <SourceIcon source={source} size={20} />
                      </span>
                      <span class="mp-prog-kind__name">
                        {sourceWord(source)}
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
            <Show when={open().week.milestoneLabel}>
              {(label) => (
                <p class="mp-prog-week-sheet__mark">
                  <TrophyIcon size={20} />
                  <span>Milestone: {label()}</span>
                </p>
              )}
            </Show>
            <Show when={open().week.coverage === 'partial'}>
              <p class="mp-prog-meta">
                This week is read from the loaded history only.
              </p>
            </Show>
          </div>
        )}
      </Show>
    </Sheet>
  )
}

export function RhythmCard(props: RhythmCardProps): JSX.Element {
  const [selected, setSelected] = createSignal<string>()
  const [openId, setOpenId] = createSignal<string | null>(null)
  const buttons: HTMLButtonElement[] = []

  // The record's week (the latest), until a tap or a key picks another.
  createEffect(() => {
    setSelected(props.selectedWeekId ?? props.weeks.at(-1)?.id)
  })

  const open = (): OpenWeek | null => {
    const id = openId()
    const index = props.weeks.findIndex((week) => week.id === id)
    return index === -1 ? null : { week: props.weeks[index], index }
  }

  const focusWeek = (index: number): void => {
    const week = props.weeks[index]
    if (week === undefined) return
    setSelected(week.id)
    buttons[index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    const current = props.weeks.findIndex((week) => week.id === selected())
    const last = props.weeks.length - 1
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(last, current + 1),
      Home: 0,
      End: last,
    }
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    focusWeek(next)
  }

  const first = (): ProgressWeekView | undefined => props.weeks[0]
  const last = (): ProgressWeekView | undefined => props.weeks.at(-1)
  /** Whether any week wears a pin, so the pins need their key. */
  const pinned = (): boolean =>
    props.weeks.some((week) => Boolean(week.milestoneLabel))

  return (
    <section
      class="mp-prog-card"
      aria-labelledby="mp-prog-rhythm"
      data-testid="progress-rhythm"
    >
      <div class="mp-prog-card__head">
        <h2 class="mp-prog-eyebrow" id="mp-prog-rhythm">
          Rhythm
        </h2>
        <Show when={props.weeks.length > 0}>
          <span class="mp-prog-meta">Tap a week</span>
        </Show>
      </div>
      <p class="mp-prog-card__lead">{props.rhythm.title}</p>
      <Show when={props.weeks.length > 0}>
        <div
          class="mp-prog-weeks"
          role="group"
          aria-label={`${props.traceLabel ?? 'Practice by week'}. ${props.rhythm.summary}`}
          onKeyDown={onKeyDown}
        >
          <For each={props.weeks}>
            {(week, index) => (
              <button
                type="button"
                ref={(element) => {
                  buttons[index()] = element
                }}
                class="mp-prog-week"
                data-week={week.id}
                data-empty={week.activityLevel <= 0 ? 'on' : undefined}
                data-partial={week.coverage === 'partial' ? 'on' : undefined}
                data-selected={week.id === selected() ? 'on' : undefined}
                style={{
                  '--level': String(
                    Math.min(1, Math.max(0, week.activityLevel)),
                  ),
                }}
                tabindex={week.id === selected() ? 0 : -1}
                aria-haspopup="dialog"
                aria-label={weekLabel(week, index(), props.weeks.length)}
                onClick={() => {
                  setSelected(week.id)
                  setOpenId(week.id)
                }}
              >
                <span class="mp-prog-week__bar" aria-hidden="true" />
                <Show when={week.milestoneLabel}>
                  <span
                    class="mp-prog-pin mp-prog-week__pin"
                    aria-hidden="true"
                  />
                </Show>
              </button>
            )}
          </For>
        </div>
        <div class="mp-prog-weeks__axis" aria-hidden="true">
          <span>{first()?.shortLabel}</span>
          <Show when={props.weeks.length > 1}>
            <span>{last()?.shortLabel}</span>
          </Show>
        </div>
        <Show when={pinned()}>
          <p class="mp-prog-weeks__key" aria-hidden="true">
            <span class="mp-prog-pin" />
            Milestone earned that week
          </p>
        </Show>
      </Show>
      <p class="mp-prog-card__text">{props.rhythm.summary}</p>
      <Tiles facts={props.rhythm.facts} />
      <WeekSheet
        open={open()}
        count={props.weeks.length}
        onClose={() => setOpenId(null)}
      />
    </section>
  )
}
