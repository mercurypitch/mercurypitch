// ============================================================
// LocalProgressNotice — "your earlier practice is still here"
// ============================================================
//
// Shown once, after signing in to an account that was made on another
// device. See features/account/local-progress-notice.ts for why the
// case exists and why carrying the practice across is not automatic.
//
// It renders next to AuthModal at app level rather than inside it,
// because Google sign-in is a full-page redirect: by the time the
// account is held, the dialog that started it is gone. A top-level
// component catches both paths, and any later one, without either
// remembering to ask.

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { CheckCircle, History } from '@/components/icons'
import { authVersion, getDeviceId, getUserId } from '@/db/services/user-service'
import { describeLocalProgress, localProgressNoticeDue, markNoticeSeen, progressHandoffMailto, summarizeLocalProgress, } from '@/features/account/local-progress-notice'
import { useFocusTrap } from '@/lib/use-focus-trap'
import styles from './LocalProgressNotice.module.css'

export const LocalProgressNotice: Component = () => {
  let dialogRef: HTMLDivElement | undefined
  // Dismissal has to move the UI now; the storage write below is what
  // makes it stick, and reading storage back is not reactive. Keyed by
  // account rather than a boolean, so signing out and into a SECOND
  // account made elsewhere still gets told.
  const [dismissedFor, setDismissedFor] = createSignal('')

  const due = (): boolean => {
    // Subscribe to sign-in/out so the notice appears without a reload.
    authVersion()
    return dismissedFor() !== getUserId() && localProgressNoticeDue()
  }

  const progress = (): ReturnType<typeof summarizeLocalProgress> => {
    authVersion()
    return summarizeLocalProgress()
  }

  function dismiss(): void {
    markNoticeSeen()
    setDismissedFor(getUserId())
  }

  useFocusTrap(() => dialogRef, { isOpen: due, onClose: dismiss })

  return (
    <Show when={due()}>
      <div class={styles.overlay} data-testid="local-progress-notice">
        <div
          ref={dialogRef}
          class={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="local-progress-title"
        >
          <div class={styles.head}>
            <span class={styles.headIcon} aria-hidden="true">
              <History />
            </span>
            <h2 id="local-progress-title" class={styles.title}>
              Your earlier practice stayed here
            </h2>
          </div>

          <p class={styles.body}>
            This account was created on another device, so it starts with its
            own history. The{' '}
            <strong>{describeLocalProgress(progress())}</strong> you did here
            are still on this device, and still on screen.
          </p>

          <p class={styles.body}>
            What starts empty is the account's own record of it — your streak,
            badges, achievements and practice calendar were all kept under the
            signed-out you.
          </p>

          <p class={styles.keep}>
            <span class={styles.keepIcon} aria-hidden="true">
              <CheckCircle />
            </span>
            <span>
              Nothing was deleted. Sign out and it is all back, exactly as it
              was.
            </span>
          </p>

          <p class={styles.body}>
            Moving it onto your account is something we still do by hand. Send
            us a note and we will take care of it.
          </p>

          <div class={styles.actions}>
            <button
              type="button"
              class={styles.primary}
              onClick={dismiss}
              data-testid="local-progress-ok"
            >
              Got it
            </button>
            <a
              class={styles.secondary}
              href={progressHandoffMailto(
                getDeviceId(),
                getUserId(),
                progress(),
              )}
              onClick={dismiss}
              data-testid="local-progress-contact"
            >
              Ask us to move it
            </a>
          </div>
        </div>
      </div>
    </Show>
  )
}
