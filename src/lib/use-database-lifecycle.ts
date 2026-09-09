// ============================================================
// use-database-lifecycle — the cross-tab database state, as a signal
// ============================================================
// The rule and the reasoning live in src/db/database-lifecycle.ts, which is
// framework-free so it can be tested against a fake connection. This is only
// the Solid adapter: a signal that starts at whatever the state already is,
// because the event that changed it usually fired before this component
// mounted.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { DatabaseLifecycleState } from '@/db/database-lifecycle'
import { databaseLifecycleState, onDatabaseLifecycle, } from '@/db/database-lifecycle'

export function useDatabaseLifecycle(): Accessor<DatabaseLifecycleState> {
  const [state, setState] = createSignal<DatabaseLifecycleState>(
    // Seeded, not defaulted to 'ok': a room that mounts after the event would
    // otherwise show its ordinary loading spinner forever while the database
    // is unreachable.
    databaseLifecycleState(),
  )
  const off = onDatabaseLifecycle((event) => setState(event.state))
  onCleanup(off)
  return state
}
