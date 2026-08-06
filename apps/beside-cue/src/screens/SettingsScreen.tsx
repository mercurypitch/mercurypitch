import { createSignal, For } from 'solid-js'
import type { DailyCuePreset } from '@/app-config'
import { AppHeader } from '@/components/AppHeader'

interface SettingsScreenProps {
  paused: boolean
  resetArmed: boolean
  dailyCuePresets: readonly DailyCuePreset[]
  scheduleTime?: string
  schedulePending: boolean
  scheduleMessage?: string
  scheduleError?: string
  onBack: () => void
  onPauseToggle: () => void
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
        <p class="screen-kicker">Your cue, your control</p>
        <h1>Keep only what helps.</h1>
        <p>
          This prototype stores your cue and reflection on this device. Nothing
          is sent to an account or analytics service.
        </p>
      </section>
      <section class="settings-group" aria-labelledby="daily-cue-title">
        <div class="settings-group__heading">
          <div>
            <p class="screen-kicker">Optional</p>
            <h2 id="daily-cue-title">One gentle cue a day</h2>
          </div>
          {props.scheduleTime === undefined ? (
            <span>Manual</span>
          ) : (
            <strong>{props.scheduleTime}</strong>
          )}
        </div>
        <p class="settings-group__intro">
          Android can place one discreet cue around this time. Your pull and
          B-side stay off the lock screen.
        </p>
        <div class="schedule-options" aria-label="Daily cue time">
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
              <small>No automatic cue</small>
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
            <span>Another time</span>
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
            {props.schedulePending ? 'Keeping…' : 'Keep this time'}
          </button>
        </form>
        {props.paused ? (
          <p class="schedule-status">
            This time is resting with your cue. Resume the cue to change it or
            receive reminders.
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
        <h2 id="cue-settings-title">Active cue</h2>
        <button
          class="settings-row"
          type="button"
          disabled={props.schedulePending}
          onClick={() => props.onPauseToggle()}
        >
          <span>
            <strong>{props.paused ? 'Resume cue' : 'Pause cue'}</strong>
            <small>
              {props.paused
                ? 'Make manual cues available again.'
                : 'Keep the cue and history, but stop cue moments.'}
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
            <strong>Replace this cue</strong>
            <small>
              Choose a new pull and B-side. Previous turns stay in reflection.
            </small>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </section>
      <section class="settings-group" aria-labelledby="privacy-settings-title">
        <h2 id="privacy-settings-title">Local data</h2>
        <div class="privacy-note">
          <strong>On this device only</strong>
          <p>
            Pull text, B-side text, settings, and outcomes stay local in this
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
            This removes your cue and every local reflection. Press confirm
            reset once more to continue.
          </p>
        ) : null}
      </section>
      <p class="settings-screen__version">Beside Cue · Pocket pressing 01</p>
    </main>
  )
}
