// Studio record settings — count-in, click, monitoring and the line-up offset, in the Sound panel; kept on this device.
import { For, Show } from 'solid-js'
import type { StudioCountInBars } from '@/lib/studio/record/record-settings'
import { MAX_RECORD_OFFSET_MS } from '@/lib/studio/record/take-timing'
import sound from '../sound/StudioSound.module.css'
import common from '../StudioPage.module.css'
import styles from './StudioRecord.module.css'
import type { StudioRecorderHandle } from './useStudioRecorder'

const COUNT_INS: readonly { bars: StudioCountInBars; label: string }[] = [
  { bars: 0, label: 'No count-in' },
  { bars: 1, label: 'One bar' },
  { bars: 2, label: 'Two bars' },
]

export function StudioRecordSettings(props: {
  recorder: StudioRecorderHandle
}) {
  const settings = () => props.recorder.settings()
  const update = (change: Partial<ReturnType<typeof settings>>) =>
    props.recorder.setSettings({ ...settings(), ...change })
  const lineUp = () => {
    const trip = props.recorder.roundTrip()
    if (trip === null)
      return 'Studio starts each new take earlier by the delay between the song and your voice. Raise this if takes still land late, lower it if they land early.'
    const ms = Math.round(trip.baseSeconds * 1000)
    const source =
      trip.source === 'measured'
        ? 'measured by the latency check'
        : 'estimated for this device'
    return `Studio starts each new take ${ms} ms earlier, the delay between the song and your voice (${source}). Raise this if takes still land late, lower it if they land early.`
  }
  return (
    <fieldset class={sound.section} data-studio-record-settings="">
      <legend>Recording</legend>
      <div class={sound.presets} role="radiogroup" aria-label="Count-in">
        <For each={COUNT_INS}>
          {(choice) => (
            <label class={sound.preset}>
              <input
                type="radio"
                name="studio-count-in"
                value={choice.bars}
                checked={settings().countInBars === choice.bars}
                onChange={() => update({ countInBars: choice.bars })}
              />
              <span>{choice.label}</span>
            </label>
          )}
        </For>
      </div>
      <label class={styles.toggle}>
        <input
          type="checkbox"
          checked={settings().click}
          onChange={(event) => update({ click: event.currentTarget.checked })}
        />
        <span>Click while recording</span>
      </label>
      <Show when={settings().click}>
        <p class={common.help}>
          Through speakers the click can leak into the take. Headphones keep it
          out.
        </p>
      </Show>
      <label class={styles.toggle}>
        <input
          type="checkbox"
          checked={settings().monitor}
          onChange={(event) => update({ monitor: event.currentTarget.checked })}
        />
        <span>Monitor through headphones</span>
      </label>
      <Show when={settings().monitor}>
        <p class={common.help}>
          You hear yourself a little late. Use headphones, or the speakers feed
          back into the microphone.
        </p>
      </Show>
      <label class={styles.offset}>
        <span>Line-up</span>
        <input
          type="number"
          inputMode="numeric"
          min={-MAX_RECORD_OFFSET_MS}
          max={MAX_RECORD_OFFSET_MS}
          step={1}
          value={settings().offsetMs}
          aria-label="Line-up offset in milliseconds"
          onChange={(event) =>
            update({ offsetMs: Number(event.currentTarget.value) })
          }
        />
        <span>ms</span>
      </label>
      <p class={common.help}>{lineUp()}</p>
    </fieldset>
  )
}
