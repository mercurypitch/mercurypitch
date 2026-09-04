import type { JSX } from 'solid-js'
import { createEffect, createSignal, Show, untrack } from 'solid-js'
import { buildLabel } from '@/build-info'
import { AppHeader } from '@/components/AppHeader'
import { PunchedTimeDial } from '@/components/PunchedTimeDial'
import type { DeviceSupport } from '@/platform/device-support'
import { probeDeviceSupport } from '@/platform/device-support'

interface SettingsScreenProps {
  /** Purchase surface, supplied by the shell so this screen stays store-free. */
  proSection?: JSX.Element
  paused: boolean
  voiceEnabled: boolean
  resetArmed: boolean
  scheduleTime?: string
  schedulePending: boolean
  scheduleMessage?: string
  scheduleError?: string
  onBack: () => void
  onPauseToggle: () => void
  onVoiceToggle: () => void
  onReplayIntroduction: () => void
  onReplace: () => void
  onSetSchedule: (localTime: string) => void
  onDisableSchedule: () => void
  onTimeHaptic?: (strength: 'light' | 'medium') => void
  onReset: () => void
}

export function SettingsScreen(props: SettingsScreenProps) {
  const [customTime, setCustomTime] = createSignal(
    untrack(() => props.scheduleTime ?? ''),
  )
  // What the device reports about itself — filled in on demand, because
  // requesting a GPU adapter at screen load costs something and nobody
  // needs this until they are diagnosing.
  const [support, setSupport] = createSignal<DeviceSupport | undefined>()

  createEffect(() => {
    const scheduledTime = props.scheduleTime
    if (scheduledTime !== undefined) setCustomTime(scheduledTime)
  })

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
        <form
          class="custom-time custom-time--punched"
          onSubmit={(event) => {
            event.preventDefault()
            props.onSetSchedule(customTime())
          }}
        >
          <PunchedTimeDial
            value={customTime()}
            defaultValue={props.scheduleTime ?? '10:00'}
            disabled={props.paused || props.schedulePending}
            onValueChange={setCustomTime}
            onHaptic={props.onTimeHaptic}
          />
          <button
            class="secondary-button"
            type="submit"
            disabled={
              props.paused || props.schedulePending || customTime() === ''
            }
          >
            {props.schedulePending ? 'Setting…' : 'Set reminder'}
          </button>
        </form>
        <div
          class="schedule-options schedule-options--single"
          aria-label="Daily reminder state"
        >
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
        </div>
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
      <section class="settings-group" aria-labelledby="voice-settings-title">
        <h2 id="voice-settings-title">Character voice</h2>
        <button
          class="settings-row"
          type="button"
          role="switch"
          aria-checked={props.voiceEnabled}
          onClick={() => props.onVoiceToggle()}
        >
          <span>
            <strong>
              {props.voiceEnabled ? 'Voice is on' : 'Voice is muted'}
            </strong>
            <small>
              Character captions always remain visible. This setting only
              changes whether their recorded lines play.
            </small>
          </span>
          <span aria-hidden="true">{props.voiceEnabled ? 'On' : 'Off'}</span>
        </button>
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
              Choose a new Pull, cue, and Side B. Your current plan stays active
              until the new one is saved.
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
            Pull, cue, and Side B text, settings, and choices stay local in this
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
      {/* The version line has always doubled as the way in to what the
          device reports about itself, and nothing said so -- maff went
          looking for the renderer and concluded the app did not have one
          (2026-09-03). It is still filled in on demand, because asking
          for a GPU adapter costs something; it just says so now. */}
      <button
        class="settings-screen__version"
        type="button"
        aria-expanded={support() !== undefined}
        onClick={() => {
          if (support() !== undefined) {
            setSupport(undefined)
            return
          }
          void probeDeviceSupport().then(setSupport)
        }}
      >
        Beside Cue · {buildLabel()}
        <span class="settings-screen__version-hint">
          {support() === undefined ? 'Show device info' : 'Hide device info'}
        </span>
      </button>
      <Show when={support()}>
        {(facts) => (
          <dl class="device-support">
            <dt>Engine</dt>
            <dd>{facts().engine}</dd>
            <dt>Graphics</dt>
            <dd>{facts().graphics}</dd>
            <dt>Microphone</dt>
            <dd>{facts().microphone}</dd>
          </dl>
        )}
      </Show>
    </main>
  )
}
