// ============================================================
// Studio lane input field — a lane's own input and its channels in its Track details, kept on this device
// ============================================================
//
// The first row follows the Studio's input from the Sound panel, named, as
// every lane did before; any other is the lane's own. An interface's
// channels show once the lane's input has opened (an arm says how many it
// has: lane-inputs.ts), as a DAW's record input lists them: the default,
// named for what it takes, then each input, then each aligned pair mixed to
// mono, so a guitar on input 2 records alone. A choice changes nothing in
// the song, and the lane armed now opens it at once.
import { createEffect, For, on, Show } from 'solid-js'
import type { ChannelPick } from '@/lib/audio-input/input-channels'
import { samePick } from '@/lib/audio-input/input-channels'
import { channelChoices, inputChoices, inputsNamed, } from '@/lib/audio-input/input-choices'
import { laneChannelPick } from '@/lib/studio/record/lane-inputs'
import styles from '../StudioPage.module.css'
import type { StudioRecorderHandle } from './useStudioRecorder'

/** A channel row's value, by its jacks: '' for the default, "2" for input 2, "1+2" for a pair. */
const pickValue = (pick: ChannelPick | null) =>
  pick === null
    ? ''
    : pick.pair
      ? `${pick.channel + 1}+${pick.channel + 2}`
      : `${pick.channel + 1}`

/** What the field reads from the recorder: the lanes' inputs, the browser's, and whether a take holds them. */
export type StudioLaneInputRecorder = Pick<
  StudioRecorderHandle,
  'laneInputs' | 'inputs' | 'busy'
>

export interface StudioLaneInputFieldProps {
  trackId: string
  trackName: string
  recorder: StudioLaneInputRecorder
  /** Take the focus to the input: the lane header's chip opened the details here. */
  focus?: boolean
  onFocused?(): void
}

export function StudioLaneInputField(props: StudioLaneInputFieldProps) {
  let deviceSelect: HTMLSelectElement | undefined
  const lane = () => props.recorder.laneInputs.of(props.trackId)
  const devices = () =>
    inputChoices(
      props.recorder.inputs(),
      { id: lane().deviceId, label: lane().label },
      `Studio's input (${props.recorder.laneInputs.studioInputName()})`,
    )
  const count = () => props.recorder.laneInputs.channels(props.trackId)
  const pick = () => laneChannelPick(lane())
  const channels = () => channelChoices(count(), pick())
  const choosesChannels = () => (count() ?? 0) > 1 || pick() !== null
  const busy = () => props.recorder.busy()
  const held = () => (busy() ? 'Stop the take to change the input' : undefined)

  createEffect(
    on(
      () => props.focus === true,
      (focus) => {
        if (!focus) return
        const focused = props.onFocused
        // After the panel takes the focus as it opens.
        queueMicrotask(() => {
          deviceSelect?.scrollIntoView?.({ block: 'nearest' })
          deviceSelect?.focus({ preventScroll: true })
          focused?.()
        })
      },
    ),
  )

  return (
    <div class={styles.laneInput} data-studio-lane-input={props.trackId}>
      <label class={styles.stackedField}>
        <span>Input</span>
        <select
          ref={deviceSelect}
          data-studio-lane-device=""
          disabled={busy()}
          title={held()}
          onChange={(event) => {
            const choice = devices()[event.currentTarget.selectedIndex]
            if (choice === undefined) return
            // A channel is a jack of its input: another input starts on its default.
            props.recorder.laneInputs.choose(props.trackId, {
              deviceId: choice.id,
              label: choice.id === null ? null : choice.label,
              channel: null,
              pair: false,
            })
          }}
        >
          <For each={devices()}>
            {(choice) => (
              <option
                value={choice.id ?? ''}
                selected={choice.id === lane().deviceId}
              >
                {choice.label}
              </option>
            )}
          </For>
        </select>
      </label>
      <Show when={choosesChannels()}>
        <label class={styles.stackedField}>
          <span>Channel</span>
          <select
            data-studio-lane-channel=""
            disabled={busy()}
            title={held()}
            onChange={(event) => {
              const choice = channels()[event.currentTarget.selectedIndex]
              if (choice === undefined) return
              props.recorder.laneInputs.choose(props.trackId, {
                ...lane(),
                channel: choice.pick?.channel ?? null,
                pair: choice.pick?.pair ?? false,
              })
            }}
          >
            <For each={channels()}>
              {(choice) => (
                <option
                  value={pickValue(choice.pick)}
                  selected={samePick(choice.pick, pick())}
                >
                  {choice.label}
                </option>
              )}
            </For>
          </select>
        </label>
      </Show>
      <Show
        when={
          devices().find((choice) => choice.id === lane().deviceId)
            ?.connected === false
        }
      >
        <p class={styles.help} role="status">
          {lane().label ?? 'The input you chose'} is not connected. Takes on{' '}
          {props.trackName} record from the Studio's input until it is back.
        </p>
      </Show>
      <Show
        when={inputsNamed(props.recorder.inputs())}
        fallback={
          <p class={styles.help}>
            Your inputs are listed by name once Studio may use the microphone.
            Arm a lane once to see them.
          </p>
        }
      >
        <Show when={count() === null && !choosesChannels()}>
          <p class={styles.help}>
            Arm this lane once to see this input's channels.
          </p>
        </Show>
      </Show>
    </div>
  )
}
