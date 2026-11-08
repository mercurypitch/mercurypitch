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
//
// MIDI ports follow the audio inputs as a group of their own, once MIDI is
// allowed from a press (Show MIDI keyboards and pads); a lane on one plays
// its instrument's sound (studio-midi-sound.ts) and has no channels.
import { createEffect, createMemo, For, on, Show } from 'solid-js'
import type { ChannelPick } from '@/lib/audio-input/input-channels'
import { samePick } from '@/lib/audio-input/input-channels'
import { channelChoices, inputChoices, inputsNamed, } from '@/lib/audio-input/input-choices'
import type { ResolvedInstrument } from '@/lib/studio/instruments/resolve'
import { FOLLOW_STUDIO_INPUT, isMidiLaneInput, laneChannelPick, } from '@/lib/studio/record/lane-inputs'
import styles from '../StudioPage.module.css'
import { chosenMidiChoice, studioMidiChoices } from './midi/studio-midi-choices'
import { studioMidiSoundWords } from './midi/studio-midi-sound'
import { StudioMidiAccessLine } from './midi/StudioMidiAccessLine'
import type { StudioRecorderHandle } from './useStudioRecorder'

/** A channel row's value, by its jacks: '' for the default, "2" for input 2, "1+2" for a pair. */
const pickValue = (pick: ChannelPick | null) =>
  pick === null
    ? ''
    : pick.pair
      ? `${pick.channel + 1}+${pick.channel + 2}`
      : `${pick.channel + 1}`

/** What the field reads from the recorder: the lanes' inputs, the browser's, MIDI's, and whether a take holds them. */
export type StudioLaneInputRecorder = Pick<
  StudioRecorderHandle,
  'laneInputs' | 'inputs' | 'busy' | 'midi'
>

export interface StudioLaneInputFieldProps {
  trackId: string
  trackName: string
  recorder: StudioLaneInputRecorder
  /** Take the focus to the input: the lane header's chip opened the details here. */
  focus?: boolean
  onFocused?(): void
  /** Open the Inputs view, where every input shows with its channels and levels. */
  onAllInputs?(): void
  /** In the Inputs view: each input's own card offers to check it, so no hint to arm the lane. */
  inInputsView?: boolean
  /** The lane's instrument, for what a MIDI lane plays as; the piano's words without it. */
  instrument?: Pick<ResolvedInstrument, 'family' | 'glyph'>
}

export function StudioLaneInputField(props: StudioLaneInputFieldProps) {
  let deviceSelect: HTMLSelectElement | undefined
  const lane = () => props.recorder.laneInputs.of(props.trackId)
  const kept = () => {
    const input = lane()
    return isMidiLaneInput(input) ? input : null
  }
  // The lane's audio input and channels; a MIDI lane's port is its own row.
  const audio = () => {
    const input = lane()
    return isMidiLaneInput(input) ? FOLLOW_STUDIO_INPUT : input
  }
  const devices = () =>
    inputChoices(
      props.recorder.inputs(),
      { id: audio().deviceId, label: audio().label },
      `Studio's input (${props.recorder.laneInputs.studioInputName()})`,
    )
  const midi = () => props.recorder.midi
  const midiRows = createMemo(() =>
    studioMidiChoices(midi().ports(), kept(), midi().state() === 'granted'),
  )
  const chosenMidi = () => chosenMidiChoice(midiRows(), kept())?.value ?? null
  // The lane's port, once MIDI is allowed, is not among those listed.
  const midiMissing = () => {
    const port = kept()
    return (
      port !== null &&
      midi().state() === 'granted' &&
      !midi()
        .ports()
        .some((each) => each.id === port.portId || each.name === port.label)
    )
  }
  const count = () => props.recorder.laneInputs.channels(props.trackId)
  const pick = () => laneChannelPick(lane())
  const channels = () => channelChoices(count(), pick())
  // A MIDI lane plays an instrument, which has no channels to choose.
  const choosesChannels = () =>
    kept() === null && ((count() ?? 0) > 1 || pick() !== null)
  const busy = () => props.recorder.busy()
  const held = () => (busy() ? 'Stop the take to change the input' : undefined)

  /** The row chosen, by its option's value: a MIDI port, or an audio input on its default. */
  function choose(value: string): void {
    const port = midiRows().find((row) => row.value === value)
    if (port !== undefined) {
      props.recorder.laneInputs.choose(props.trackId, {
        kind: 'midi',
        portId: port.portId,
        label: port.name,
      })
      return
    }
    const choice = devices().find((each) => (each.id ?? '') === value)
    if (choice === undefined) return
    // A channel is a jack of its input: another input starts on its default.
    props.recorder.laneInputs.choose(props.trackId, {
      deviceId: choice.id,
      label: choice.id === null ? null : choice.label,
      channel: null,
      pair: false,
    })
  }

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
          onChange={(event) => choose(event.currentTarget.value)}
        >
          <For each={devices()}>
            {(choice) => (
              <option
                value={choice.id ?? ''}
                selected={kept() === null && choice.id === audio().deviceId}
              >
                {choice.label}
              </option>
            )}
          </For>
          <Show when={midiRows().length > 0}>
            <optgroup label="MIDI">
              <For each={midiRows()}>
                {(row) => (
                  <option
                    value={row.value}
                    selected={row.value === chosenMidi()}
                  >
                    {row.label}
                  </option>
                )}
              </For>
            </optgroup>
          </Show>
          <Show when={midi().state() === 'unsupported'}>
            <optgroup label="MIDI">
              <option value="midi:none" disabled>
                Not available in this browser
              </option>
            </optgroup>
          </Show>
        </select>
      </label>
      <Show when={kept() !== null}>
        <p class={styles.help} data-studio-lane-sound="">
          {studioMidiSoundWords(
            props.instrument ?? { family: 'keys', glyph: 'grand-piano' },
          )}
        </p>
      </Show>
      <Show when={midiMissing()}>
        <p class={styles.help} role="status">
          {kept()?.label ?? 'The MIDI input you chose'} is not connected.
          Connect it, then arm {props.trackName}.
        </p>
      </Show>
      <StudioMidiAccessLine
        access={midi()}
        ask="Show MIDI keyboards and pads"
        disabled={busy()}
      />
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
                ...audio(),
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
          devices().find((choice) => choice.id === audio().deviceId)
            ?.connected === false
        }
      >
        <p class={styles.help} role="status">
          {audio().label ?? 'The input you chose'} is not connected. Takes on{' '}
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
        <Show
          when={
            kept() === null &&
            count() === null &&
            !choosesChannels() &&
            props.inInputsView !== true
          }
        >
          <p class={styles.help}>
            Arm this lane once, or check its input in Inputs, to see this
            input's channels.
          </p>
        </Show>
      </Show>
      <Show when={props.onAllInputs !== undefined}>
        <button
          type="button"
          class={styles.textButton}
          data-studio-open-inputs=""
          onClick={() => props.onAllInputs?.()}
        >
          See every input, its channels and levels
        </button>
      </Show>
    </div>
  )
}
