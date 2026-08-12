// ── PhoneSignIn ──────────────────────────────────────────────────────
// The television's half of signing in: show a code, wait to be let in.
//
// Exists because a TV remote turns an email address into a chore and a
// password into an ordeal — d-pad, on-screen keyboard, one character per
// four button presses, and a password field that shows dots. Every
// streaming app solves it the same way, and so does this: the TV asks for
// a code, shows it as text and as a QR, and waits; the phone already in
// the person's hand does the typing, because it already did it once.
//
// The code on screen is public — anyone in the room can read it, and so
// can a camera pointed at the window. What buys the session is the poll
// token, which this component holds and never renders. See the device
// linking section of auth-service.

import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { QrCode } from '@/components/QrCode'
import type { DeviceLinkRequest } from '@/db/services/auth-service'
import { pollDeviceLink, startDeviceLink } from '@/db/services/auth-service'
import { syncDeviceLabel } from '@/lib/sync/device-label'
import styles from './PhoneSignIn.module.css'

export interface PhoneSignInProps {
  /** Called once the session has been adopted. */
  onLinked: () => void
}

/**
 * How often to ask.
 *
 * Two and a half seconds is the whole budget for "I tapped Approve and
 * nothing happened" — long enough that a five-minute code costs the
 * worker about 120 cheap indexed reads, short enough that the TV never
 * looks stuck while somebody is watching it.
 */
const POLL_INTERVAL_MS = 2500

type Phase = 'starting' | 'waiting' | 'expired' | 'unreachable'

function linkUrlFor(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/link:${code}`
}

/** Four-and-four, because eight unbroken characters is hard to read aloud. */
function spaced(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4)}`
}

export const PhoneSignIn: Component<PhoneSignInProps> = (props) => {
  const [phase, setPhase] = createSignal<Phase>('starting')
  const [request, setRequest] = createSignal<DeviceLinkRequest | null>(null)
  const [secondsLeft, setSecondsLeft] = createSignal(0)

  let pollTimer: ReturnType<typeof setInterval> | undefined
  let tickTimer: ReturnType<typeof setInterval> | undefined
  // Survives the component: an in-flight poll that resolves after unmount
  // must not adopt a session into a screen nobody is looking at.
  let live = true

  function stopTimers(): void {
    if (pollTimer !== undefined) clearInterval(pollTimer)
    if (tickTimer !== undefined) clearInterval(tickTimer)
    pollTimer = undefined
    tickTimer = undefined
  }

  async function begin(): Promise<void> {
    stopTimers()
    setPhase('starting')
    setRequest(null)
    const started = await startDeviceLink(syncDeviceLabel())
    if (!live) return
    if (started == null) {
      setPhase('unreachable')
      return
    }
    setRequest(started)
    setSecondsLeft(started.expiresInSeconds)
    setPhase('waiting')

    tickTimer = setInterval(() => {
      const left = secondsLeft() - 1
      setSecondsLeft(left)
      // Stop asking the moment the code is dead rather than letting the
      // worker say so — the countdown is the same clock it uses.
      if (left <= 0) {
        stopTimers()
        setPhase('expired')
      }
    }, 1000)

    pollTimer = setInterval(() => {
      void (async () => {
        const current = request()
        if (current == null) return
        const result = await pollDeviceLink(current)
        if (!live) return
        if (result.status === 'linked') {
          stopTimers()
          props.onLinked()
        } else if (result.status === 'expired') {
          stopTimers()
          setPhase('expired')
        }
        // 'pending' and 'offline' both mean keep waiting. A dropped Wi-Fi
        // on a TV is common and recovers on its own; showing an error for
        // it sends somebody to the router for no reason.
      })()
    }, POLL_INTERVAL_MS)
  }

  onMount(() => {
    void begin()
  })

  onCleanup(() => {
    live = false
    stopTimers()
  })

  return (
    <div class={styles.pane} data-testid="phone-sign-in">
      <Show when={phase() === 'starting'}>
        <p class={styles.sub}>Getting a code…</p>
      </Show>

      <Show when={phase() === 'unreachable'}>
        <p class={styles.sub} role="alert">
          Could not reach MercuryPitch. Check this device's connection and try
          again.
        </p>
        <button
          type="button"
          class={styles.action}
          onClick={() => void begin()}
        >
          Try again
        </button>
      </Show>

      <Show when={phase() === 'expired'}>
        <p class={styles.sub} role="alert" data-testid="phone-sign-in-expired">
          That code has expired.
        </p>
        <button
          type="button"
          class={styles.action}
          onClick={() => void begin()}
          data-testid="phone-sign-in-retry"
        >
          Show a new code
        </button>
      </Show>

      <Show when={phase() === 'waiting' && request() != null}>
        <p class={styles.sub}>
          Scan this with your phone, or open{' '}
          <strong>{window.location.host}</strong> on it and enter the code.
        </p>
        <div class={styles.pairing}>
          <div class={styles.qr}>
            <QrCode
              value={linkUrlFor(request()!.code)}
              size={200}
              label="Scan to sign this device in"
            />
          </div>
          <div class={styles.codeBlock}>
            <span class={styles.codeLabel}>Code</span>
            <span class={styles.code} data-testid="phone-sign-in-code">
              {spaced(request()!.code)}
            </span>
            <span class={styles.expiry}>
              Expires in {Math.floor(secondsLeft() / 60)}:
              {String(secondsLeft() % 60).padStart(2, '0')}
            </span>
          </div>
        </div>
        <p class={styles.waiting} data-testid="phone-sign-in-waiting">
          Waiting for you to confirm on your phone…
        </p>
        <p class={styles.note}>
          You will be asked to confirm there. Nobody can sign in here just by
          reading this code.
        </p>
      </Show>
    </div>
  )
}
