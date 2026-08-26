import type { JSX } from 'solid-js'
import { createSignal, For } from 'solid-js'
import type { DailyCuePreset } from '@/app-config'
import { AppHeader } from '@/components/AppHeader'

interface SettingsScreenProps {
  /** Purchase surface, supplied by the shell so this screen stays store-free. */
  proSection?: JSX.Element
  paused: boolean
  resetArmed: boolean
  dailyCuePresets: readonly DailyCuePreset[]
  scheduleTime?: string
  schedulePending: boolean
  scheduleMessage?: string
  scheduleError?: string
  onBack: () => void
  onPauseToggle: () => void
  onReplayIntroduction: () => void
  onReplace: () => void
  onSetSchedule: (localTime: string) => void
  onDisableSchedule: () => void
  onReset: () => void
}

export function SettingsScreen(props: SettingsScreenProps) {
  const [customTime, setCustomTime] = createSignal('10:00')

  return (
    <main class="settings-screen app-screen">
      <AppHeader label="Settings" onBack={props.onBack} />
      <section class="settings-screen__intro">
        <p class="screen-kicker">Your plan, your control</p>
        <h1>Keep only what helps.</h1>
        <p>
          Your plan and choice history stay on this device. Notification
          permission is requested only if you set a reminder.
        </p>
      </section>
      <section class="settings-group" aria-labelledby="daily-cue-title">
        <div class="settings-group__heading">
          <div>
            <p class="screen-kicker">Optional</p>
            <h2 id="daily-cue-title">Daily reminder</h2>
          </div>
          {props.scheduleTime === undefined ? (
            <span>No daily reminder</span>
          ) : (
            <strong>{props.scheduleTime}</strong>
          )}
        </div>
        <p class="settings-group__intro">
          Beside Cue can send one discreet reminder at this time. Your Pull and
          Side B stay off the lock screen.
        </p>
        <div class="schedule-options" aria-label="Daily reminder time">
          <button
            class="schedule-option"
            classList={{
              'schedule-option--active': props.scheduleTime === undefined,
            }}
            type="button"
            aria-pressed={props.scheduleTime === undefined}
            disabled={props.schedulePending}
            onClick={() => props.onDisableSchedule()}
          >
            <span>
              <strong>Only when I ask</strong>
              <small>No automatic reminder</small>
            </span>
            <span class="schedule-option__mark" aria-hidden="true" />
          </button>
          <For each={props.dailyCuePresets}>
            {(preset) => (
              <button
                class="schedule-option"
                classList={{
                  'schedule-option--active':
                    props.scheduleTime === preset.localTime,
                }}
                type="button"
                aria-pressed={props.scheduleTime === preset.localTime}
                disabled={props.paused || props.schedulePending}
                onClick={() => props.onSetSchedule(preset.localTime)}
              >
                <span>
                  <strong>{preset.label}</strong>
                  <small>{preset.note}</small>
                </span>
                <time dateTime={preset.localTime}>{preset.localTime}</time>
                <span class="schedule-option__mark" aria-hidden="true" />
              </button>
            )}
          </For>
        </div>
        <form
          class="custom-time"
          onSubmit={(event) => {
            event.preventDefault()
            props.onSetSchedule(customTime())
          }}
        >
          <label for="custom-cue-time">
            <span>Custom time</span>
            <input
              id="custom-cue-time"
              type="time"
              value={customTime()}
              disabled={props.paused || props.schedulePending}
              onInput={(event) => setCustomTime(event.currentTarget.value)}
              required
            />
          </label>
          <button
            class="secondary-button"
            type="submit"
            disabled={props.paused || props.schedulePending}
          >
            {props.schedulePending ? 'Setting…' : 'Set reminder'}
          </button>
        </form>
        {props.paused ? (
          <p class="schedule-status">
            This reminder stays off while your plan is paused. Resume the plan
            to change it or receive reminders.
          </p>
        ) : null}
        {props.scheduleMessage !== undefined ? (
          <p class="schedule-status" role="status">
            {props.scheduleMessage}
          </p>
        ) : null}
        {props.scheduleError !== undefined ? (
          <p class="schedule-status schedule-status--error" role="alert">
            {props.scheduleError}
          </p>
        ) : null}
      </section>
      <section class="settings-group" aria-labelledby="cue-settings-title">
        <h2 id="cue-settings-title">Current plan</h2>
        <button
          class="settings-row"
          type="button"
          disabled={props.schedulePending}
          onClick={() => props.onPauseToggle()}
        >
          <span>
            <strong>
              {props.paused ? 'Resume this plan' : 'Pause this plan'}
            </strong>
            <small>
              {props.paused
                ? 'Make reminders and Cue me now available again.'
                : 'Keep the plan and history, but stop reminders and Cue me now.'}
            </small>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
        <button
          class="settings-row"
          type="button"
          disabled={props.schedulePending}
          onClick={() => props.onReplace()}
        >
          <span>
            <strong>Change this plan</strong>
            <small>
              Choose a new Pull and Side B. Your current plan stays active until
              the new one is saved.
            </small>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
        <button
          class="settings-row"
          type="button"
          disabled={props.schedulePending}
          onClick={() => props.onReplayIntroduction()}
        >
          <span>
            <strong>Watch Corky’s introduction again</strong>
            <small>
              Replay the film without changing your plan, history, or reminder.
            </small>
          </span>
        </button>
      </section>
      {props.proSection}
      <section class="settings-group" aria-labelledby="privacy-settings-title">
        <h2 id="privacy-settings-title">Local data</h2>
        <div class="privacy-note">
          <strong>On this device only</strong>
          <p>
            Pull text, Side B text, settings, and choices stay local in this
            build.
          </p>
        </div>
        <button
          class="danger-button"
          type="button"
          disabled={props.schedulePending}
          onClick={() => props.onReset()}
        >
          {props.resetArmed ? 'Confirm reset' : 'Reset all local data'}
        </button>
        {props.resetArmed ? (
          <p class="reset-warning" role="alert">
            This deletes your saved plan, choice history, reminder settings, and
            onboarding progress from this device. Press Confirm reset to
            continue.
          </p>
        ) : null}
      </section>
      <p class="settings-screen__version">Beside Cue · version 0.1</p>
    </main>
  )
}
