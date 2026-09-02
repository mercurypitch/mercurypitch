// The input the game is listening to, and what it is hearing.
// ============================================================
//
// Shown once a microphone has started, because that is when it can say
// anything useful: device labels need a granted stream, and a level
// needs frames.
//
// It answers the two questions a silent game leaves a player holding.
// The meter answers "is anything getting in?" -- a moving bar while
// they hum is the whole difference between a game that is not
// responding and a note that is not right. The picker answers "is it
// listening to the right thing?", which the app previously had no way
// to ask and no way to change: it took the browser's default input and
// hoped, and on an audio interface the default is whichever channel the
// OS picked, which is silence with every light green.
//
// The picker only appears when it is needed -- after the grace period
// with nothing heard, or once the player opens it -- so the common case
// (one microphone, working) stays a thin bar and nothing else.

import { micLevelFraction, readMicLevel } from '@irchiinnuss/pitch-engine'
import { createEffect, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import type { InputChoice } from '../input-device'
import { chooseInput, listInputs, readPreferredInput, } from '../input-device'
import { createSilenceWatch } from '../silence-watch'

/** How often to read the level. Fast enough to look live, far below a frame. */
const POLL_MS = 50

export interface MicInputProps {
  /**
   * Is a stream actually open?
   *
   * False after a failed start, and then the meter and the silence
   * warning are both wrong: there is nothing to hear, and the reason is
   * already on screen above this. Only the picker is useful there --
   * choosing a different device is a sensible thing to do before trying
   * again.
   */
  readonly listening: boolean
  /** Re-open the microphone on the chosen device. */
  readonly onChoose: (deviceId: string) => void | Promise<void>
}

export function MicInput(props: MicInputProps) {
  const [level, setLevel] = createSignal(0)
  const [silent, setSilent] = createSignal(false)
  const [devices, setDevices] = createSignal<readonly InputChoice[]>([])
  const [current, setCurrent] = createSignal(readPreferredInput() ?? '')
  const [open, setOpen] = createSignal(false)
  const watch = createSilenceWatch()

  const refresh = (): void => void listInputs().then(setDevices)

  // Chrome populates device ids and labels only once a stream has been
  // granted, so a list built at mount time is a list of nothing --
  // enumerateDevices returns placeholders with empty ids, every one of
  // them is dropped as unopenable, and the picker is left offering
  // "System default" and nothing else, permanently. It has to be built
  // again after the grant, which is what these two do: the effect
  // catches our own microphone starting, the event catches a device
  // being plugged in or pulled out while the game is open.
  createEffect(() => {
    if (props.listening) refresh()
  })

  onMount(() => {
    refresh()
    const onDeviceChange = (): void => refresh()
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)
    onCleanup(() =>
      navigator.mediaDevices?.removeEventListener?.(
        'devicechange',
        onDeviceChange,
      ),
    )
    const timer = setInterval(() => {
      if (!props.listening) return
      const rms = readMicLevel()
      setLevel(rms)
      setSilent(watch.sample(rms, performance.now()))
    }, POLL_MS)
    onCleanup(() => clearInterval(timer))
  })

  const pick = (deviceId: string): void => {
    setCurrent(deviceId)
    watch.reset()
    setSilent(false)
    const chosen = props.onChoose
    void chooseInput(deviceId).then(() => chosen(deviceId))
  }

  return (
    <div class="micinput">
      <Show when={props.listening}>
        <div class="micinput__meter" classList={{ 'is-silent': silent() }}>
          <i
            style={{ width: `${Math.round(micLevelFraction(level()) * 100)}%` }}
          />
        </div>
      </Show>

      <Show when={silent()}>
        <p class="micinput__hint">
          Nothing is coming in. If you have more than one input, try another.
        </p>
      </Show>

      <Show when={(silent() || open()) && devices().length <= 1}>
        <p class="micinput__hint">
          Only the system default is available. Allow the microphone once, then
          this list fills in with your inputs by name.
        </p>
      </Show>

      <Show
        when={silent() || open() || !props.listening}
        fallback={
          <button
            class="micinput__link"
            type="button"
            onClick={() => {
              refresh()
              setOpen(true)
            }}
          >
            Change input
          </button>
        }
      >
        <select
          class="micinput__select"
          value={current()}
          onChange={(e) => pick(e.currentTarget.value)}
        >
          <For each={devices()}>
            {(device) => (
              <option value={device.deviceId}>{device.label}</option>
            )}
          </For>
        </select>
      </Show>
    </div>
  )
}
