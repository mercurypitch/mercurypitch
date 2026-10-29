// ============================================================
// "Remind me tomorrow at 8:30", on the day's close: a switch, off until
// asked. Turned on, it puts the phone's own question and lays out the
// mornings from tomorrow; refused, it goes back off and says where
// notifications are turned back on (reminder.ts).
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { nativeShellApi } from '@/stores/native-shell-store'
import styles from './bench.module.css'
import { REMINDER } from './merc-lines'
import { reminderNote, remindersOn, turnRemindersOff, turnRemindersOn, } from './reminder'

export function ReminderRow(): JSX.Element {
  // On from the tap, while the phone's question is up: the switch moves
  // under the finger, and moves back if the answer is no.
  const [asking, setAsking] = createSignal(false)
  const checked = () => asking() || remindersOn()

  const toggle = async (): Promise<void> => {
    if (asking()) return
    if (remindersOn()) {
      await turnRemindersOff()
      return
    }
    setAsking(true)
    try {
      await turnRemindersOn()
    } finally {
      setAsking(false)
    }
  }

  const said = (): string | null => {
    const note = reminderNote()
    if (note === null || asking()) return null
    return note === 'refused' ? REMINDER.refused : REMINDER.unavailable
  }
  const settings = (): (() => Promise<boolean>) | null =>
    reminderNote() === 'refused' && !asking()
      ? (nativeShellApi()?.openAppSettings ?? null)
      : null

  return (
    <section class={`${styles.card} ${styles.reminder}`}>
      <button
        type="button"
        role="switch"
        class={styles.reminderSwitch}
        aria-checked={checked()}
        aria-label={REMINDER.label}
        data-testid="merc-reminder"
        onClick={() => void toggle()}
      >
        <span class={styles.reminderLabel}>{REMINDER.label}</span>
        <span class={styles.switchTrack} aria-hidden="true">
          <span class={styles.switchKnob} />
        </span>
      </button>
      <div role="status" data-testid="merc-reminder-note">
        <Show when={said()}>
          {(line) => <p class={styles.reminderNote}>{line()}</p>}
        </Show>
      </div>
      <Show when={settings()}>
        {(open) => (
          <button
            type="button"
            class={styles.reminderSettings}
            data-testid="merc-reminder-settings"
            onClick={() => void open()()}
          >
            {REMINDER.settings}
          </button>
        )}
      </Show>
    </section>
  )
}
