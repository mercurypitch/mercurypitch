// ============================================================
// TwoFactorSettings — turning a second factor on, and off again
// ============================================================
//
// Four states in one card, because the alternative is four places a person
// has to find: off, enrolling, holding fresh recovery codes, and on. The
// card never navigates; it swaps its own body, so the back button and the
// settings scroll position both keep meaning something.
//
// The recovery-code sheet is the one screen here that cannot be revisited.
// The server keeps only hashes, so codes exist in readable form for exactly
// as long as this component holds them — which is why leaving that state is
// a deliberate button and not a side effect of anything else.
//
// Renders nothing at all when the environment has no TOTP_KEK. A control
// that answers 503 is worse than no control: it reads as a broken account
// rather than a feature this deployment does not carry.

import type { Component, JSX } from 'solid-js'
import { createSignal, For, Match, onMount, Show, Switch } from 'solid-js'
import { AlertTriangle, CheckCircle, Copy, Download, Lock, } from '@/components/icons'
import { QrCode } from '@/components/QrCode'
import type { TwofaSetup } from '@/db/services/auth-mfa-service'
import { disableTwofa, enableTwofa, fetchTwofaStatus, startTwofaSetup, } from '@/db/services/auth-mfa-service'
import { showNotification } from '@/stores/notifications-store'
import styles from './TwoFactorSettings.module.css'

type Stage = 'loading' | 'absent' | 'off' | 'enrolling' | 'codes' | 'on'

/** Break the base32 into groups, the way authenticator apps print it. */
function grouped(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(' ')
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Insecure origins and locked-down browsers both land here. The secret
    // is on screen either way, so this is a downgrade, not a failure.
    return false
  }
}

export const TwoFactorSettings: Component = () => {
  const [stage, setStage] = createSignal<Stage>('loading')
  const [codesLeft, setCodesLeft] = createSignal(0)
  const [setup, setSetup] = createSignal<TwofaSetup | null>(null)
  const [recoveryCodes, setRecoveryCodes] = createSignal<string[]>([])
  const [code, setCode] = createSignal('')
  const [disarming, setDisarming] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')
  const [copied, setCopied] = createSignal('')

  async function load(): Promise<void> {
    try {
      const status = await fetchTwofaStatus()
      if (!status.available) {
        setStage('absent')
        return
      }
      setCodesLeft(status.recoveryCodesLeft)
      setStage(status.enabled ? 'on' : 'off')
    } catch {
      // A status read that fails must not claim 2FA is off — someone who
      // believes that goes looking for a setting they already turned on.
      setStage('absent')
    }
  }

  onMount(() => {
    void load()
  })

  function flashCopied(what: string): void {
    setCopied(what)
    setTimeout(() => setCopied(''), 2000)
  }

  async function beginSetup(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      setSetup(await startTwofaSetup())
      setCode('')
      setStage('enrolling')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start setup')
    } finally {
      setBusy(false)
    }
  }

  async function turnOn(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      setRecoveryCodes(await enableTwofa(code().trim()))
      setCode('')
      setStage('codes')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not match')
    } finally {
      setBusy(false)
    }
  }

  async function turnOff(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await disableTwofa(code().trim())
      setCode('')
      setDisarming(false)
      showNotification('Two-step verification is off.', 'success')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not match')
    } finally {
      setBusy(false)
    }
  }

  function downloadCodes(): void {
    const body = [
      'Mercury Pitch recovery codes',
      '',
      'Each code works once, in place of your authenticator app.',
      'Keep them somewhere you can reach without your phone.',
      '',
      ...recoveryCodes(),
      '',
    ].join('\n')
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'mercury-pitch-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function finishCodes(): Promise<void> {
    setRecoveryCodes([])
    await load()
  }

  const codeField = (testid: string, submit: () => void): JSX.Element => (
    <input
      class={styles.codeInput}
      data-testid={testid}
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      placeholder="123456"
      value={code()}
      disabled={busy()}
      onInput={(e) => setCode(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          submit()
        }
      }}
    />
  )

  return (
    <Show when={stage() !== 'loading' && stage() !== 'absent'}>
      <div class={styles.block} data-testid="twofa-settings">
        <div class={styles.headerRow}>
          <span class={styles.label}>Two-step verification</span>
          <Show when={stage() === 'on'}>
            <span class={styles.onPill} data-testid="twofa-on-pill">
              <CheckCircle />
              On
            </span>
          </Show>
        </div>

        <Show when={error() !== ''}>
          <p class={styles.error} data-testid="twofa-error">
            {error()}
          </p>
        </Show>

        <Switch>
          {/* ── Off ─────────────────────────────────────────── */}
          <Match when={stage() === 'off'}>
            <p class={styles.hint}>
              Ask for a six-digit code from an authenticator app whenever you
              sign in. A stolen password stops being enough on its own.
            </p>
            <button
              type="button"
              class={styles.primary}
              data-testid="twofa-setup-start"
              disabled={busy()}
              onClick={() => void beginSetup()}
            >
              <Lock />
              {busy() ? 'Starting…' : 'Set up'}
            </button>
          </Match>

          {/* ── Enrolling ───────────────────────────────────── */}
          <Match when={stage() === 'enrolling' && setup() != null}>
            <p class={styles.hint}>
              Scan this with your authenticator app, then type the code it
              shows. Nothing changes until that code matches.
            </p>
            <div class={styles.qrWrap}>
              <QrCode
                value={setup()?.otpauthUri ?? ''}
                size={168}
                label="Authenticator setup code"
              />
            </div>
            <div class={styles.secretRow}>
              <code class={styles.secret} data-testid="twofa-secret">
                {grouped(setup()?.secret ?? '')}
              </code>
              <button
                type="button"
                class={styles.ghost}
                data-testid="twofa-copy-secret"
                onClick={() => {
                  void copyToClipboard(setup()?.secret ?? '').then((ok) => {
                    if (ok) flashCopied('secret')
                  })
                }}
              >
                <Copy />
                {copied() === 'secret' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p class={styles.subHint}>
              No camera? Type that key into the app by hand instead.
            </p>
            <div class={styles.actionRow}>
              {codeField('twofa-code', () => void turnOn())}
              <button
                type="button"
                class={styles.primary}
                data-testid="twofa-enable"
                disabled={busy() || code().trim().length < 6}
                onClick={() => void turnOn()}
              >
                {busy() ? 'Checking…' : 'Turn on'}
              </button>
              <button
                type="button"
                class={styles.ghost}
                data-testid="twofa-cancel-setup"
                disabled={busy()}
                onClick={() => {
                  setSetup(null)
                  setCode('')
                  setError('')
                  setStage('off')
                }}
              >
                Cancel
              </button>
            </div>
          </Match>

          {/* ── The recovery codes, shown once ──────────────── */}
          <Match when={stage() === 'codes'}>
            <p class={styles.warnLine}>
              <AlertTriangle />
              Save these now — this is the only time they are shown.
            </p>
            <ul class={styles.codeSheet} data-testid="twofa-recovery-codes">
              <For each={recoveryCodes()}>
                {(one) => <li class={styles.recoveryCode}>{one}</li>}
              </For>
            </ul>
            <div class={styles.actionRow}>
              <button
                type="button"
                class={styles.ghost}
                data-testid="twofa-copy-codes"
                onClick={() => {
                  void copyToClipboard(recoveryCodes().join('\n')).then(
                    (ok) => {
                      if (ok) flashCopied('codes')
                    },
                  )
                }}
              >
                <Copy />
                {copied() === 'codes' ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                class={styles.ghost}
                data-testid="twofa-download-codes"
                onClick={downloadCodes}
              >
                <Download />
                Download
              </button>
              <button
                type="button"
                class={styles.primary}
                data-testid="twofa-codes-done"
                onClick={() => void finishCodes()}
              >
                I've saved them
              </button>
            </div>
            <p class={styles.subHint}>
              Each one works once, in place of the app. Your other devices have
              been signed out — they got in on a password alone.
            </p>
          </Match>

          {/* ── On ──────────────────────────────────────────── */}
          <Match when={stage() === 'on'}>
            <p class={styles.hint}>
              Sign-in asks for a code from your authenticator app.{' '}
              <span
                class={codesLeft() <= 2 ? styles.codesLow : undefined}
                data-testid="twofa-codes-left"
              >
                {codesLeft()} recovery {codesLeft() === 1 ? 'code' : 'codes'}{' '}
                left.
              </span>
            </p>
            <Show
              when={disarming()}
              fallback={
                <button
                  type="button"
                  class={styles.danger}
                  data-testid="twofa-disable-start"
                  onClick={() => {
                    setError('')
                    setCode('')
                    setDisarming(true)
                  }}
                >
                  Turn off
                </button>
              }
            >
              <p class={styles.subHint}>
                Enter a code from the app, or one recovery code.
              </p>
              <div class={styles.actionRow}>
                {codeField('twofa-disable-code', () => void turnOff())}
                <button
                  type="button"
                  class={styles.danger}
                  data-testid="twofa-disable-confirm"
                  disabled={busy() || code().trim() === ''}
                  onClick={() => void turnOff()}
                >
                  {busy() ? 'Checking…' : 'Turn off'}
                </button>
                <button
                  type="button"
                  class={styles.ghost}
                  data-testid="twofa-disable-cancel"
                  disabled={busy()}
                  onClick={() => {
                    setDisarming(false)
                    setCode('')
                    setError('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </Show>
          </Match>
        </Switch>
      </div>
    </Show>
  )
}
