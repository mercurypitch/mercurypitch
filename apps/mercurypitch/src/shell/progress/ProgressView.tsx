// ============================================================
// ProgressView — the native Progress page, drawn from the record's snapshot
// ============================================================
//
// Pure, as the web's ProgressPage is: it draws the snapshot it is handed
// and says what was tapped. The large title scrolls away with the page and
// a small one stands in at the top once it has gone, as a phone's own
// lists do (the rail folds on the same scroll, NativeShell.tsx). Under it,
// one card a section, in the order a singer scrolls: the moment, the
// rhythm, the skill threads, the voice, the paths, the milestones, the
// league, the history and where the record is kept. What counts opens in a
// sheet from the header, as Share does from the page (ProgressScreen.tsx).

import type { JSX } from 'solid-js'
import { createSignal, For, Match, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import type { ProgressActionView, ProgressMomentView, ProgressPageSnapshot, ProgressSurfaceStatus, } from '@/features/progress/ProgressPage'
import { WhatCountsGuide } from '@/features/progress/WhatCountsGuide'
import { CloseIcon, QuestionIcon, ShareIcon } from '../icons'
import { useSheetBack } from './progress-parts'
import { CoverageNote, HistorySection } from './ProgressHistory'
import { LeagueCard, MilestonesCard, PathsCard } from './ProgressMarks'
import { MomentCard } from './ProgressMoments'
import { RhythmCard } from './ProgressRhythm'
import { ThreadsCard, VoiceCard } from './ProgressSkills'
import { ProgressEmpty, ProgressFailure, ProgressLoading, ProgressPartialFailure, } from './ProgressStates'
import { watchTitle } from './title-collapse'

export interface ProgressViewProps {
  status: ProgressSurfaceStatus
  snapshot?: ProgressPageSnapshot
  errorMessage?: string
  emptyAction?: ProgressActionView
  /** Another moment in full, for the pager's other pages. */
  momentFor?: (momentId: string) => ProgressMomentView | undefined
  onRetry?: () => void
  onAction?: (action: ProgressActionView) => void
  onShareMoment?: (momentId: string) => void
  onPeriodChange?: (periodId: string) => void
  onMomentSelect?: (momentId: string) => void
  onHistoryFilterChange?: (filterId: string) => void
  /** The league card: the phone's own Leagues screen. */
  onOpenLeague?: (action: ProgressActionView | undefined) => void
  /** Sheets the page's owner lays over it (Share), inside its theme. */
  children?: JSX.Element
}

/** What counts, in a sheet: the web's guide, word for word. */
function WhatCountsSheet(props: {
  open: boolean
  onClose: () => void
}): JSX.Element {
  useSheetBack(
    () => props.open,
    () => props.onClose(),
  )
  return (
    <Sheet
      isOpen={props.open}
      close={() => props.onClose()}
      ariaLabel="What counts where"
      class="mp-prog-sheet"
    >
      <div class="mp-prog-counts" data-testid="progress-what-counts-sheet">
        <div class="mp-prog-sheet__top mp-prog-sheet__top--end">
          <button
            type="button"
            class="mp-prog-round"
            aria-label="Close"
            data-testid="progress-sheet-close"
            onClick={() => props.onClose()}
          >
            <CloseIcon size={22} />
          </button>
        </div>
        <WhatCountsGuide headingId="mp-prog-counts-title" />
      </div>
    </Sheet>
  )
}

/** The page's sections, once there is a record to draw. */
function ProgressSections(props: {
  snapshot: ProgressPageSnapshot
  view: ProgressViewProps
}): JSX.Element {
  const snapshot = () => props.snapshot
  return (
    <>
      <Show when={props.view.status === 'error'}>
        <ProgressPartialFailure
          message={props.view.errorMessage}
          onRetry={props.view.onRetry}
        />
      </Show>
      <Show when={snapshot().periodOptions.length > 1}>
        <div class="mp-prog-switch" role="group" aria-label="Progress period">
          <For each={snapshot().periodOptions}>
            {(period) => (
              <button
                type="button"
                aria-pressed={period.id === snapshot().activePeriodId}
                onClick={() => props.view.onPeriodChange?.(period.id)}
              >
                {period.label}
              </button>
            )}
          </For>
        </div>
      </Show>
      <MomentCard
        moment={snapshot().moment}
        alternates={snapshot().alternateMoments ?? []}
        periodLabel={snapshot().periodLabel}
        momentFor={props.view.momentFor}
        onSelect={props.view.onMomentSelect}
        onShare={props.view.onShareMoment}
        onAction={props.view.onAction}
      />
      <RhythmCard
        rhythm={snapshot().rhythm}
        weeks={snapshot().weeks}
        selectedWeekId={snapshot().selectedWeekId}
        traceLabel={snapshot().atlasTrace?.label}
      />
      <ThreadsCard
        threads={snapshot().skillThreads}
        onAction={props.view.onAction}
      />
      <VoiceCard voice={snapshot().voice} onAction={props.view.onAction} />
      <PathsCard paths={snapshot().paths} onAction={props.view.onAction} />
      <MilestonesCard
        milestones={snapshot().milestones}
        available={snapshot().milestonesAvailable}
        cabinet={snapshot().cabinet}
      />
      <Show when={snapshot().league}>
        {(league) => (
          <LeagueCard
            league={league()}
            onOpen={() => props.view.onOpenLeague?.(league().action)}
          />
        )}
      </Show>
      <HistorySection
        history={snapshot().history}
        onFilter={props.view.onHistoryFilterChange}
        onAction={props.view.onAction}
      />
      <CoverageNote
        coverage={snapshot().coverage}
        periodContext={snapshot().periodContext}
        onAction={props.view.onAction}
      />
    </>
  )
}

export function ProgressView(props: ProgressViewProps): JSX.Element {
  const [countsOpen, setCountsOpen] = createSignal(false)
  const [collapsed, setCollapsed] = createSignal(false)
  let root: HTMLDivElement | undefined
  let title: HTMLHeadingElement | undefined
  let bar: HTMLDivElement | undefined

  onMount(() => {
    const page = root
    if (page === undefined || title === undefined || bar === undefined) return
    onCleanup(
      watchTitle(page, title, bar, (progress) => {
        page.style.setProperty('--prog-collapse', progress.toFixed(3))
        setCollapsed(progress >= 1)
      }),
    )
  })

  const shareable = (): boolean =>
    props.status !== 'loading' &&
    props.status !== 'empty' &&
    props.snapshot?.moment.shareable === true &&
    props.onShareMoment !== undefined
  const share = (): void => {
    const id = props.snapshot?.moment.id
    if (id !== undefined) props.onShareMoment?.(id)
  }

  return (
    <div
      class="mp-prog"
      ref={root}
      data-testid="shell-progress"
      data-state={props.status}
      data-collapsed={collapsed() ? 'on' : undefined}
    >
      <div class="mp-prog__stage" aria-hidden="true" />
      {/* The small title, for the hand once the large one has gone: the
          large one's buttons stay the keyboard's and a screen reader's. */}
      <div class="mp-prog-bar" ref={bar} aria-hidden="true">
        <span class="mp-prog-bar__side" />
        <span class="mp-prog-bar__title">Progress</span>
        <span class="mp-prog-bar__side">
          <Show when={shareable()}>
            <button
              type="button"
              class="mp-prog-round"
              tabindex="-1"
              aria-label="Share your progress"
              onClick={share}
            >
              <ShareIcon size={22} />
            </button>
          </Show>
        </span>
      </div>

      <div class="mp-prog__col">
        <div class="mp-prog-top">
          <h1 class="mp-prog-top__title" ref={title}>
            Progress
          </h1>
          <button
            type="button"
            class="mp-prog-round"
            aria-label="What counts"
            aria-haspopup="dialog"
            data-testid="progress-what-counts"
            onClick={() => setCountsOpen(true)}
          >
            <QuestionIcon size={22} />
          </button>
          <Show when={shareable()}>
            <button
              type="button"
              class="mp-prog-round"
              aria-label="Share your progress"
              aria-haspopup="dialog"
              data-testid="progress-share"
              onClick={share}
            >
              <ShareIcon size={22} />
            </button>
          </Show>
        </div>

        <Switch>
          <Match when={props.status === 'loading'}>
            <ProgressLoading />
          </Match>
          <Match when={props.status === 'empty'}>
            <ProgressEmpty
              action={props.emptyAction}
              onAction={props.onAction}
              onWhatCounts={() => setCountsOpen(true)}
            />
          </Match>
          <Match when={props.snapshot}>
            {(snapshot) => (
              <ProgressSections snapshot={snapshot()} view={props} />
            )}
          </Match>
          <Match when={props.snapshot === undefined}>
            <ProgressFailure
              message={props.errorMessage}
              onRetry={props.onRetry}
            />
          </Match>
        </Switch>
      </div>

      <div class="mp-prog__fade" aria-hidden="true" />
      <WhatCountsSheet
        open={countsOpen()}
        onClose={() => setCountsOpen(false)}
      />
      {props.children}
    </div>
  )
}
