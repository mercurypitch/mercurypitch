// ============================================================
// database-lifecycle — what happens when two tabs disagree about the schema
// ============================================================
// One origin, one database, and as many connections as the visitor has tabs.
// When a deploy raises the schema, the first tab to reload wants a version the
// others are still holding open, and IndexedDB will not upgrade until every
// older connection is gone.
//
// Dexie already ships handlers for both sides of that. They are not enough:
//
//   on('versionchange') → close({ disableAutoOpen: false })
//
// which closes the connection and then leaves `autoOpen` true, so the very
// next query in that tab reopens the database at the OLD version. A tab with
// anything live — a reactive query, a poll, a background refresh — reopens
// within milliseconds and blocks the upgrade again. With several such tabs the
// upgrading tab is starved indefinitely: not slow, never finishing.
//
// Measured on a Galaxy Tab S9 on 2026-09-09: six mercurypitch.com tabs open,
// the database pinned at IndexedDB version 80 (Dexie 8) while the deployed app
// wanted 120 (Dexie 12). A versionless open did not return in 15 seconds.
// Closing the other tabs let the upgrade finish so fast that the database then
// opened in 2 ms — the re-index everyone assumed was the cost was never the
// problem; the deadlock was the whole of it.
//
// So this module takes over both events:
//
//   versionchange → close for good (`disableAutoOpen: true`) and mark the tab
//                   superseded, which the UI turns into "reload to continue".
//                   A closed-for-good connection cannot re-block anything.
//   blocked       → mark the state blocked, so a room that is waiting can say
//                   the true thing — other tabs are open — instead of guessing.
//
// Framework-free on purpose: the rule is testable against a fake connection,
// and `use-database-lifecycle.ts` adapts it for Solid.

/**
 * Why this tab cannot reach the database, if it cannot.
 *
 * - `ok` — nothing is wrong; the database is usable.
 * - `blocked` — this tab needs a newer schema and another connection is still
 *   holding the old one. Closing the other tabs clears it. Recoverable
 *   without losing anything.
 * - `superseded` — another tab upgraded past us and this connection has been
 *   closed for good. Only a reload continues; nothing has been lost.
 */
export type DatabaseLifecycleState = 'ok' | 'blocked' | 'superseded'

export interface DatabaseLifecycleEvent {
  state: DatabaseLifecycleState
  /** The version the other connection is moving to, when the browser says. */
  newVersion?: number | null
}

/** The bit of Dexie this module needs, narrowed so a fake can stand in. */
export interface LifecycleDatabase {
  on: (
    event: 'versionchange' | 'blocked',
    handler: (ev: { newVersion?: number | null; oldVersion?: number }) => void,
  ) => unknown
  close: (options?: { disableAutoOpen: boolean }) => void
}

type Listener = (event: DatabaseLifecycleEvent) => void

const listeners = new Set<Listener>()
let current: DatabaseLifecycleState = 'ok'
let pendingVersion: number | null = null

/** The state as it stands, for a first render before any event arrives. */
export function databaseLifecycleState(): DatabaseLifecycleState {
  return current
}

export function databaseLifecycleVersion(): number | null {
  return pendingVersion
}

/**
 * Subscribe to lifecycle changes. Returns its own unsubscribe.
 *
 * A subscriber added after the event still sees the state, because callers
 * read `databaseLifecycleState()` for the initial value.
 */
export function onDatabaseLifecycle(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function publish(state: DatabaseLifecycleState, newVersion?: number | null) {
  // `superseded` is terminal. Once this connection is closed for good, a later
  // `blocked` from an in-flight open must not downgrade the message to
  // something the visitor can fix by closing tabs — only a reload continues.
  if (current === 'superseded') return
  if (current === state) return
  current = state
  pendingVersion = newVersion ?? null
  const event: DatabaseLifecycleEvent = { state, newVersion: pendingVersion }
  for (const listener of [...listeners]) {
    // One bad subscriber must not stop the rest from hearing that the
    // database is gone.
    try {
      listener(event)
    } catch {
      // ignored on purpose
    }
  }
}

/**
 * Register the two handlers on a database connection.
 *
 * Called once, from the adapter's constructor. Registering our own subscriber
 * does not remove Dexie's default — both run — so the close below must be the
 * decisive one: `disableAutoOpen: true` wins over the default's `false`
 * because it sets `autoOpen = false` regardless of the order they fire in.
 */
export function installDatabaseLifecycle(db: LifecycleDatabase): void {
  db.on('versionchange', (ev) => {
    // Another tab is upgrading. Get out of its way and stay out: closing with
    // auto-open still enabled is what let the old tab reopen and deadlock the
    // upgrade in the first place.
    try {
      db.close({ disableAutoOpen: true })
    } catch {
      // A close that throws still leaves the tab unusable; report it anyway so
      // the visitor is told to reload rather than left on a dead page.
    }
    publish('superseded', ev.newVersion ?? null)
  })

  db.on('blocked', (ev) => {
    // Our own upgrade cannot start. Some other connection — another tab, or
    // this site installed as an app — is holding the old version open.
    publish('blocked', ev.newVersion ?? null)
  })
}

/** Test seam: forget every subscriber and return to `ok`. */
export function resetDatabaseLifecycleForTests(): void {
  listeners.clear()
  current = 'ok'
  pendingVersion = null
}
