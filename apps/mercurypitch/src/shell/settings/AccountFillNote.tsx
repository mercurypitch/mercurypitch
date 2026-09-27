// ============================================================
// AccountFillNote — what arrived with the account, said once
// ============================================================
//
// The top of the Account screen on the first visit after signing in to an
// account that already existed (4b): the account's runs and voiceprints,
// counted the way Progress counts them, and the one thing that did not come:
// takes stay on the phone that kept them (REQ-NAM-044). Shown once, then
// gone. A history that cannot be read is said to be unreadable, with the
// phone's own records still here and a retry (REQ-NAM-045); it stays due,
// so the next visit tries again.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { HistoryIcon, WarnIcon } from '../icons'
import { FILL_NOTE, fillLine } from './account-copy'
import type { AccountFill } from './account-fill'
import { accountFillDue, loadAccountFill, settleAccountFill, } from './account-fill'

export function AccountFillNote(): JSX.Element {
  const [fill, setFill] = createSignal<AccountFill | null>(null)
  const [loading, setLoading] = createSignal(false)
  let live = true
  onCleanup(() => {
    live = false
  })

  async function load(): Promise<void> {
    setLoading(true)
    const next = await loadAccountFill()
    if (!live) return
    setLoading(false)
    setFill(next)
    if (next.status === 'ok') settleAccountFill()
  }

  onMount(() => {
    if (accountFillDue()) void load()
  })

  return (
    <Show when={fill()} keyed>
      {(state) =>
        state.status === 'ok' ? (
          <div class="mp-set-note" role="status" data-testid="account-fill">
            <HistoryIcon size={20} />
            <p>
              <strong>{FILL_NOTE.lead}</strong>{' '}
              {fillLine(state.runs, state.voiceprints)}
              <br />
              {FILL_NOTE.takes}
            </p>
          </div>
        ) : (
          <div
            class="mp-set-note mp-set-note--warn"
            role="status"
            data-testid="account-fill"
          >
            <WarnIcon size={20} />
            <div class="mp-set-note__body">
              <p>
                <strong>{FILL_NOTE.failedTitle}</strong> {FILL_NOTE.failedBody}
              </p>
              <button
                type="button"
                class="mp-set-button mp-set-button--secondary mp-set-button--small"
                disabled={loading()}
                onClick={() => void load()}
                data-testid="account-fill-retry"
              >
                Try again
              </button>
            </div>
          </div>
        )
      }
    </Show>
  )
}
