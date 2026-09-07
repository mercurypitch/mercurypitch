// ============================================================
// "Confirm your email" inside Account settings: the banner can be dismissed
// and a phone keeps that dismissal for as long as the tab lives, so the way
// to resend the link has to live somewhere a person can always find it.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { resendVerificationEmail } from '@/db/services/auth-service'
import styles from './AccountSection.module.css'

interface EmailVerificationRowProps {
  email: string
}

export const EmailVerificationRow: Component<EmailVerificationRowProps> = (
  props,
) => {
  const [state, setState] = createSignal<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )
  const resend = async (): Promise<void> => {
    if (state() === 'sending') return
    setState('sending')
    try {
      await resendVerificationEmail()
      setState('sent')
    } catch {
      setState('error')
    }
  }
  return (
    <div data-testid="account-email-verification">
      <div class={styles.fieldLabel}>Email confirmation</div>
      <p class={styles.fieldHint}>
        <strong>{props.email}</strong> is not confirmed yet. The link is in the
        email we sent; if it never arrived, send a fresh one.
      </p>
      <div class={styles.buttonRow}>
        <Show
          when={state() !== 'sent'}
          fallback={
            <span class={styles.mutedNote}>Sent. Check your inbox.</span>
          }
        >
          <button
            class={styles.authButton}
            type="button"
            disabled={state() === 'sending'}
            onClick={() => void resend()}
          >
            {state() === 'sending' ? 'Sending…' : 'Resend confirmation email'}
          </button>
        </Show>
        <Show when={state() === 'error'}>
          <span class={styles.errorNote}>
            That did not send. Try again in a moment.
          </span>
        </Show>
      </div>
    </div>
  )
}
