// ============================================================
// DatabaseLifecycleNotice — the app-level answer to "why is nothing loading?"
// ============================================================
//
// When another tab upgrades the schema, or another tab is holding the old one
// open, EVERY surface breaks at once: the library, drive sync, the recorder,
// the drum projects. Explaining that inside each loading spinner means writing
// the same paragraph in a dozen places and still missing the surface nobody
// audited — and a superseded tab has no working surface left to read it on.
//
// So it is said once, here, at the top of the shell. The rooms keep their own
// in-place copy for the spinner you happen to be looking at; this covers
// everywhere else, including the pages that only ever showed a spinner.
//
// See src/db/database-lifecycle.ts for what the two states mean and why the
// connection is closed for good rather than left to reopen.

import type { Component } from 'solid-js'
import { Match, Switch } from 'solid-js'
import { useDatabaseLifecycle } from '@/lib/use-database-lifecycle'
import styles from '@/styles/DatabaseLifecycleNotice.module.css'
import { AlertTriangle, RotateCcw } from './icons'

export const DatabaseLifecycleNotice: Component = () => {
  const lifecycle = useDatabaseLifecycle()

  return (
    <Switch>
      <Match when={lifecycle() === 'superseded'}>
        {/* Nothing on this page will work again, so it is an alert, it does
            not auto-dismiss, and it carries the only action that helps. */}
        <section class={styles.notice} role="alert" data-state="superseded">
          <span class={styles.icon} aria-hidden="true">
            <AlertTriangle />
          </span>
          <p class={styles.text}>
            <strong>This tab is out of date.</strong> Another tab updated
            MercuryPitch while you were here. Reload to carry on — nothing has
            been lost.
          </p>
          <button
            type="button"
            class={styles.action}
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={16} />
            Reload
          </button>
        </section>
      </Match>

      <Match when={lifecycle() === 'blocked'}>
        {/* Recoverable, and it clears itself the moment the other tabs go, so
            it is a status rather than an alert and offers no button — closing
            the other tabs is not something this page can do. */}
        <section class={styles.notice} role="status" data-state="blocked">
          <span class={styles.icon} aria-hidden="true">
            <AlertTriangle />
          </span>
          <p class={styles.text}>
            <strong>Waiting on another tab.</strong> MercuryPitch is open
            somewhere else on an older version, and it is holding your library
            while this one updates. Close the other tabs and this will carry on
            — nothing has been lost.
          </p>
        </section>
      </Match>
    </Switch>
  )
}
