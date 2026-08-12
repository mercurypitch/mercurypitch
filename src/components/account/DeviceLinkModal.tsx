// ── DeviceLinkModal ──────────────────────────────────────────────────
// The phone's half of signing a TV in: "this device is asking. Yes?"
//
// Raised by the #/link:CODE route, which is what the TV's QR points at.
// Following that link only ASKS — this dialog still has to be confirmed,
// and that is the whole point of it existing. A link that signs a device
// in merely by being opened is a link somebody can be sent, and the TV it
// signs in need not be in the same room, or the same building.
//
// So the dialog states what is being authorised, in the device's own
// words, and does nothing until somebody taps Approve.

import type { Component } from 'solid-js'
import { createEffect, createSignal, createUniqueId, Match, Show, Switch, } from 'solid-js'
import { Portal } from 'solid-js/web'
import { CheckCircle, X } from '@/components/icons'
import type { DeviceLinkPending } from '@/db/services/auth-service'
import { approveDeviceLink, authStamp, fetchDeviceLinkPending, } from '@/db/services/auth-service'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { closeDeviceLink, deviceLinkCode, openAuthModal, } from '@/stores/ui-store'
import styles from './DeviceLinkModal.module.css'

type State =
  | { kind: 'checking' }
  | { kind: 'confirm'; deviceLabel?: string }
  | { kind: 'approved' }
  | { kind: 'expired' }
  | { kind: 'used' }
  | { kind: 'signed-out' }
  | { kind: 'offline' }
  | { kind: 'failed' }

export const DeviceLinkModal: Component = () => {
  let dialogRef: HTMLDivElement | undefined
  const titleId = createUniqueId()
  const [state, setState] = createSignal<State>({ kind: 'checking' })
  const [busy, setBusy] = createSignal(false)

  // Re-checked on every auth transition as well as on open: the common
  // path for a signed-out phone is "sign in, come back here", and that
  // must not need the person to re-scan the code off the television.
  createEffect(() => {
    const code = deviceLinkCode()
    authStamp()
    if (code == null) return
    setState({ kind: 'checking' })
    setBusy(false)
    void (async () => {
      const pending: DeviceLinkPending = await fetchDeviceLinkPending(code)
      // The code may have been cleared while the request was in flight.
      if (deviceLinkCode() !== code) return
      if (pending.status === 'pending') {
        setState({
          kind: 'confirm',
          ...(pending.deviceLabel != null
            ? { deviceLabel: pending.deviceLabel }
            : {}),
        })
      } else {
        setState({ kind: pending.status })
      }
    })()
  })

  function close(): void {
    if (busy()) return
    closeDeviceLink()
  }

  useFocusTrap(() => dialogRef, {
    isOpen: () => deviceLinkCode() != null,
    onClose: close,
  })

  function approve(): void {
    const code = deviceLinkCode()
    if (code == null || busy()) return
    setBusy(true)
    void (async () => {
      const result = await approveDeviceLink(code)
      setBusy(false)
      if (deviceLinkCode() !== code) return
      if (result.ok) {
        setState({ kind: 'approved' })
        return
      }
      setState({
        kind:
          result.reason === 'expired'
            ? 'expired'
            : result.reason === 'used'
              ? 'used'
              : result.reason === 'signed-out'
                ? 'signed-out'
                : 'failed',
      })
    })()
  }

  /** What the TV called itself, or a neutral stand-in if it said nothing. */
  const deviceName = (): string => {
    const current = state()
    return current.kind === 'confirm' && current.deviceLabel != null
      ? current.deviceLabel
      : 'A device'
  }

  return (
    <Show when={deviceLinkCode() != null}>
      <Portal>
        <div class={styles.overlay} onClick={close}>
          <div
            ref={dialogRef}
            class={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-busy={busy() ? true : undefined}
            onClick={(e) => e.stopPropagation()}
            data-testid="device-link-modal"
          >
            <div class={styles.head}>
              <h2 id={titleId} class={styles.title}>
                Sign in on another device?
              </h2>
              <button
                type="button"
                class={styles.close}
                onClick={close}
                aria-label="Close"
              >
                <X />
              </button>
            </div>

            <Switch>
              <Match when={state().kind === 'checking'}>
                <p class={styles.body}>Checking that request…</p>
              </Match>

              <Match when={state().kind === 'confirm'}>
                <p class={styles.body} data-testid="device-link-ask">
                  <strong>{deviceName()}</strong> is asking to sign in to your
                  account. It will have access to your library, your progress
                  and your credits.
                </p>
                <p class={styles.warn}>
                  Only approve this if it is your device and you started this
                  yourself, on a screen you can see right now.
                </p>
                <div class={styles.actions}>
                  <button
                    type="button"
                    class={styles.secondary}
                    onClick={close}
                    disabled={busy()}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class={styles.primary}
                    onClick={approve}
                    disabled={busy()}
                    data-testid="device-link-approve"
                  >
                    {busy() ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              </Match>

              <Match when={state().kind === 'approved'}>
                <div class={styles.done} data-testid="device-link-approved">
                  <span class={styles.doneIcon} aria-hidden="true">
                    <CheckCircle />
                  </span>
                  <p class={styles.body}>
                    Approved. The other device is signing in now — you can put
                    this away.
                  </p>
                </div>
                <div class={styles.actions}>
                  <button type="button" class={styles.primary} onClick={close}>
                    Done
                  </button>
                </div>
              </Match>

              <Match when={state().kind === 'signed-out'}>
                <p class={styles.body}>
                  Sign in on this device first, then approve the request.
                </p>
                <div class={styles.actions}>
                  <button
                    type="button"
                    class={styles.secondary}
                    onClick={close}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class={styles.primary}
                    onClick={() => openAuthModal('login')}
                    data-testid="device-link-sign-in"
                  >
                    Sign in
                  </button>
                </div>
              </Match>

              <Match
                when={state().kind === 'expired' || state().kind === 'used'}
              >
                <p class={styles.body} data-testid="device-link-stale">
                  {state().kind === 'used'
                    ? 'That code has already been used. Ask the other device for a new one.'
                    : 'That code has expired. Ask the other device for a new one.'}
                </p>
                <div class={styles.actions}>
                  <button type="button" class={styles.primary} onClick={close}>
                    Close
                  </button>
                </div>
              </Match>

              <Match
                when={state().kind === 'offline' || state().kind === 'failed'}
              >
                <p class={styles.body} role="alert">
                  Could not reach MercuryPitch. Check your connection and try
                  again.
                </p>
                <div class={styles.actions}>
                  <button type="button" class={styles.primary} onClick={close}>
                    Close
                  </button>
                </div>
              </Match>
            </Switch>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
