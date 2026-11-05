// ============================================================
// Progress route — the web page over the shared record (useProgressRecord).
// The visual page stays pure while the record owns app services, telemetry,
// identity-safe loading and the share studio's state.
// ============================================================

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { ProgressPage } from './ProgressPage'
import { ProgressShareStudio } from './ProgressShareStudio'
import { useProgressRecord } from './useProgressRecord'

export function ProgressRoute(): JSX.Element {
  const record = useProgressRecord()

  return (
    <>
      <ProgressPage
        status={record.status()}
        snapshot={record.snapshot()}
        errorMessage={record.errorMessage()}
        emptyAction={record.emptyAction}
        onRetry={record.retry}
        onAction={record.recordAction}
        onShareMoment={record.openShare}
        onPeriodChange={record.changePeriod}
        onMomentSelect={record.selectMoment}
        onHistoryFilterChange={record.filterHistory}
      />

      <Show when={record.shareMoment()}>
        {(moment) => (
          <ProgressShareStudio
            open={record.shareOpen()}
            moment={moment()}
            onClose={record.closeShare}
            onOutcome={record.recordShareOutcome}
          />
        )}
      </Show>
    </>
  )
}
