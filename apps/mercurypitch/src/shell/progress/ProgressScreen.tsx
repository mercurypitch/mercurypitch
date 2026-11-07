// ============================================================
// ProgressScreen — the Progress tab, as the native app draws it
// ============================================================
//
// The web's record, the phone's page. The record is the web route's own
// (useProgressRecord): the identity-safe read, the snapshot built from it,
// the moment and history filter chosen, the telemetry, and the share
// studio's evidence, dropped the moment the identity on the phone changes.
// The page (ProgressView) draws that snapshot in the native rooms' cards,
// with the shell's icons and sheets; nothing here makes a claim the web
// page does not.
//
// Share opens the web's studio in a sheet (ProgressShareStudio, inline):
// the sheet is the dialog, its trap and its scroll. The league card opens
// the phone's own Leagues screen, and Explore constellation the phone's own
// Voice Constellation (ConstellationScreen.tsx), pushed over the page rather
// than the web route's dialog over the whole shell. A moment the pager
// swipes to is drawn in full from the same view model
// (progressMomentToView).
//
// Behind NATIVE_PROGRESS, as a lazy chunk the shell lends the app through
// the bridge (NativeShell.tsx, App.tsx): a build without the switch has
// none of it, and its tab draws the web page.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import './progress.css'
import './progress-cards.css'
import './progress-sheets.css'
import { Sheet } from '@/components/mobile/Sheet'
import { findProgressMoment, progressMomentToView, } from '@/features/progress/progress-view-model'
import type { ProgressMomentView } from '@/features/progress/ProgressPage'
import { ProgressShareStudio } from '@/features/progress/ProgressShareStudio'
import { useProgressRecord } from '@/features/progress/useProgressRecord'
import { pushScreen } from '../run-shell-store'
import { pushedScreenFor } from './progress-lines'
import { useSheetBack } from './progress-parts'
import { ProgressView } from './ProgressView'

export function ProgressScreen(): JSX.Element {
  const record = useProgressRecord()

  const momentFor = (id: string): ProgressMomentView | undefined => {
    const model = record.model()
    if (model === undefined) return undefined
    const moment = findProgressMoment(model, id)
    return moment === undefined
      ? undefined
      : progressMomentToView(model, moment)
  }

  useSheetBack(record.shareOpen, record.closeShare)

  return (
    <ProgressView
      status={record.status()}
      snapshot={record.snapshot()}
      errorMessage={record.errorMessage()}
      emptyAction={record.emptyAction}
      momentFor={momentFor}
      onRetry={record.retry}
      onAction={(action) => {
        record.recordAction(action)
        const screen = pushedScreenFor(action)
        if (screen !== undefined) pushScreen(screen)
      }}
      onShareMoment={record.openShare}
      onPeriodChange={record.changePeriod}
      onMomentSelect={record.selectMoment}
      onHistoryFilterChange={record.filterHistory}
      onOpenLeague={(action) => {
        if (action !== undefined) record.recordAction(action)
        pushScreen('leagues')
      }}
    >
      <Show when={record.shareMoment()}>
        {(moment) => (
          <Sheet
            isOpen={record.shareOpen()}
            close={record.closeShare}
            ariaLabel="Share this moment"
            snap="tall"
            class="mp-prog-share-sheet"
          >
            <ProgressShareStudio
              open={record.shareOpen()}
              moment={moment()}
              presentation="inline"
              onClose={record.closeShare}
              onOutcome={record.recordShareOutcome}
            />
          </Sheet>
        )}
      </Show>
    </ProgressView>
  )
}
