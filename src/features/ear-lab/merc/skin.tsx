// ============================================================
// The drills' console parts, as the room draws them (stage-room.ts's
// skin). A drill still composes PlayPad, Pads, StagePad and the rest;
// under the room each of those is one of these.
//
//   - Lead pads (Practice run, Begin, Calibration) are the room's one
//     filled button and its outlined secondary; a console of several
//     (the desk's three drills) is a list of glass tiles instead. Once a
//     run is on they draw nothing: the pinned row is the lamp and Next.
//   - Pads are the room's grid: two up, three up, two by two, four by
//     three, or the degree ladder, at 92, 64 or 54 px.
//   - A pad waiting for an answer is lit with a violet edge that
//     breathes; a pad not chosen steps back; the pick says "Your pick"
//     and the truth "The answer", in words as well as colour. A keycap
//     means nothing on a phone: no pad shows one.
//   - The tap pad ticks under the thumb.
//   - A sung answer's pad is the room kit's mic, in place of the keys:
//     still while the question plays, lit with a ring the voice moves,
//     an outline once the window closes.
//   - The answer-mode toggle leaves the console: the station's sheet asks
//     Tap or Sing or play before the run (answer-choice.ts).
//   - Hairline's loupe stands upright (RoomLoupe.tsx).
// ============================================================

import type { JSX } from 'solid-js'
import { children, createComponent, onMount, Show } from 'solid-js'
import { MicButton } from '@/components/room-kit/RoomControls'
import { IconCheck, IconChevron, IconClose } from '@/features/ear-lab/ear-icons'
import type { EndPlateProps, MicPadProps, PadsProps, PlayPadProps, StagePadProps, TapPadProps, } from '@/features/ear-lab/EarStage'
import type { StageSkin } from '@/features/ear-lab/EarStage'
import { EndPlate, TapPad } from '@/features/ear-lab/EarStage'
import { StageSkinContext } from '@/features/ear-lab/EarStage'
import { useWakeAudio } from './audio-wake'
import styles from './room.module.css'
import { spokenLabel, useRoom } from './room-context'
import { RoomLoupe } from './RoomLoupe'

/** Wake the audio inside the tap, as the web's lead pad does: iOS only
 *  un-suspends a context from a gesture. */
function RoomPlayPad(props: PlayPadProps): JSX.Element {
  const room = useRoom()
  const wake = useWakeAudio()
  // The ritual's own Begin is the room's one filled button; anywhere
  // else an amber pad is the sealed run, offered second and asked for
  // through "before you start".
  const secondary = (): boolean => props.amber === true && !room.ritual()
  const press = (): void => {
    wake()
    if (props.amber === true) {
      // eslint-disable-next-line solid/reactivity -- called from the sheet's Begin, a press
      room.askCalibration(() => props.onClick?.())
      return
    }
    props.onClick?.()
  }
  // The sealed protocol's own room opens on "before you start".
  onMount(() => {
    if (props.amber === true && room.ritual() && !room.running()) {
      // eslint-disable-next-line solid/reactivity -- called from the sheet's Begin, a press
      room.askCalibration(() => props.onClick?.())
    }
  })
  return (
    <Show when={!room.running() && props.state === undefined}>
      <button
        type="button"
        class={secondary() ? styles.secondary : styles.primary}
        disabled={props.disabled === true}
        data-merc="lead"
        onClick={press}
      >
        <Show when={props.icon}>
          <span class={styles.leadIcon} aria-hidden="true">
            {props.icon}
          </span>
        </Show>
        <span class={styles.leadText}>
          <span class={styles.leadLabel}>{props.label}</span>
          <Show when={props.sub}>
            {(sub) => <small class={styles.leadSub}>{sub()}</small>}
          </Show>
        </span>
        {/* Shown only where the pads are a choice of drills, as tiles. */}
        <span class={styles.leadChevron} aria-hidden="true">
          <IconChevron size={20} />
        </span>
      </button>
    </Show>
  )
}

/** How a pad looks: waiting for the answer, resting under the sound,
 *  or how it came out. */
type Look =
  | 'resting'
  | 'waiting'
  | 'unchosen'
  | 'picked-right'
  | 'picked-wrong'
  | 'truth'

function RoomStagePad(props: StagePadProps): JSX.Element {
  const room = useRoom()
  const look = (): Look => {
    if (props.state === 'wrong') return 'picked-wrong'
    if (props.state === 'right') {
      return room.verdict() === 'right' ? 'picked-right' : 'truth'
    }
    if (room.beat() === 'reveal') return 'unchosen'
    if (room.beat() === 'answer' && props.disabled !== true) return 'waiting'
    return 'resting'
  }
  const caption = (): string | null => {
    switch (look()) {
      case 'picked-right':
      case 'picked-wrong':
        return 'Your pick'
      case 'truth':
        return 'The answer'
      default:
        return null
    }
  }
  const spoken = (): string => {
    const name = spokenLabel(props.label, props.sub)
    switch (look()) {
      case 'picked-right':
        return `${name}. Your pick, and the answer`
      case 'picked-wrong':
        return `${name}. Your pick, not the answer`
      case 'truth':
        return `${name}. The answer`
      default:
        return name
    }
  }
  return (
    <button
      type="button"
      class={styles.pad}
      data-look={look()}
      data-state={props.state ?? undefined}
      data-merc="pad"
      disabled={props.disabled === true}
      aria-label={spoken()}
      onClick={() => props.onClick()}
    >
      <Show when={props.lamp !== undefined}>
        <span
          class={styles.padLamp}
          classList={{ [styles.padLampOn]: props.lamp === true }}
          aria-hidden="true"
        />
      </Show>
      <span class={styles.padCaption} aria-hidden="true">
        {caption() ?? ''}
      </span>
      <Show when={props.icon}>
        <span class={styles.padIcon} aria-hidden="true">
          {props.icon}
        </span>
      </Show>
      <span class={styles.padLabel} aria-hidden="true">
        {props.label}
      </span>
      <Show when={props.sub}>
        <span class={styles.padSub} aria-hidden="true">
          {props.sub}
        </span>
      </Show>
      <Show when={look() === 'picked-right' || look() === 'truth'}>
        <span class={styles.padMark} aria-hidden="true">
          <IconCheck size={20} />
        </span>
      </Show>
      <Show when={look() === 'picked-wrong'}>
        <span class={styles.padMark} aria-hidden="true">
          <IconClose size={18} />
        </span>
      </Show>
    </button>
  )
}

/** The grid a drill's pads take in the room. */
export function padShape(
  columns: number,
  compact: boolean,
): { shape: 'two' | 'three' | 'row4' | 'grid34' | 'ladder'; cols: number } {
  if (compact || columns >= 7) {
    return { shape: 'ladder', cols: Math.min(columns, 8) }
  }
  if (columns >= 5) return { shape: 'grid34', cols: 4 }
  if (columns === 4) return { shape: 'row4', cols: 4 }
  if (columns === 3) return { shape: 'three', cols: 3 }
  return { shape: 'two', cols: 2 }
}

/** Gravity's twelve degree keys stand as an octave, the seven naturals
 *  along the bottom and the five between them above; any other set of
 *  keys keeps its ladder. */
export function keyLayout(shape: string, count: number): string {
  return shape === 'ladder' && count === 12 ? 'octave' : shape
}

/** Whether a drill's pads stand with their words centred: all but the
 *  big pair ("The first", "The second") and the small keys, which lay
 *  out their own. */
export function padsCentred(shape: string, count: number): boolean {
  if (shape === 'two') return count > 2
  return shape === 'three' || shape === 'row4'
}

function RoomPads(props: PadsProps): JSX.Element {
  const grid = () => padShape(props.columns, props.compact === true)
  const pads = children(() => props.children)
  const layout = () => keyLayout(grid().shape, pads.toArray().length)
  return (
    <div
      class={styles.pads}
      data-shape={layout()}
      data-centred={
        padsCentred(grid().shape, pads.toArray().length) ? '' : undefined
      }
      style={{ '--cols': String(layout() === 'octave' ? 14 : grid().cols) }}
      role="group"
      aria-label={props.label}
      data-testid="ear-stage-pads"
    >
      {pads()}
    </div>
  )
}

/** The web's tap pad (it already takes a tap the moment the finger
 *  lands), ticking under the thumb. */
function RoomTapPad(props: TapPadProps): JSX.Element {
  const room = useRoom()
  return (
    <div
      class={styles.tapHost}
      data-merc="tap"
      data-verdict={
        room.beat() === 'reveal' ? (room.verdict() ?? undefined) : undefined
      }
    >
      <StageSkinContext.Provider value={null}>
        {createComponent(TapPad, {
          get label() {
            return props.label
          },
          get sub() {
            return props.sub
          },
          get keycap() {
            return props.keycap
          },
          get armed() {
            return props.armed
          },
          get disabled() {
            return props.disabled
          },
          onTap: (atMs: number) => {
            room.tapped()
            props.onTap(atMs)
          },
        })}
      </StageSkinContext.Provider>
    </div>
  )
}

/** The word under the mic: where the answer by voice is. */
function micWord(mic: MicPadProps['mic']): string {
  switch (mic) {
    case 'sing':
      return 'Your turn'
    case 'done':
      return 'Closed'
    case 'wait':
      return 'Listen first'
    case 'ready':
      return 'Ready'
  }
}

/** A sung answer: the room kit's mic in place of the keys (the mock-ups'
 *  "Answering by voice"). A press closes the answer where the drill can
 *  close it now (Echo's Done); otherwise the mic only shows the voice. */
function RoomMicPad(props: MicPadProps): JSX.Element {
  return (
    <div class={styles.micHost} data-merc="mic" data-mic={props.mic}>
      <MicButton
        state={props.mic}
        level={() => props.level()}
        pulse={false}
        disabled={
          props.disabled === true ||
          props.onClick === undefined ||
          props.mic !== 'sing'
        }
        label={
          props.sub === undefined || props.sub === ''
            ? props.label
            : `${props.label}, ${props.sub}`
        }
        onClick={() => props.onClick?.()}
        testId="merc-mic"
      />
      <span class={styles.micWord} aria-hidden="true">
        {micWord(props.mic)}
      </span>
    </div>
  )
}

/** A plate a drill draws for itself, when it gave the room no numbers
 *  to lay out: the web's, as it is. */
function RoomEndPlate(props: EndPlateProps): JSX.Element {
  return (
    <StageSkinContext.Provider value={null}>
      {createComponent(EndPlate, props)}
    </StageSkinContext.Provider>
  )
}

/** Tap or sing: asked on the station's sheet before the run, so the
 *  console shows none. */
function RoomModeToggle(): JSX.Element {
  return null
}

export const ROOM_SKIN: StageSkin = {
  PlayPad: RoomPlayPad,
  StagePad: RoomStagePad,
  Pads: RoomPads,
  TapPad: RoomTapPad,
  EndPlate: RoomEndPlate,
  ModeToggle: RoomModeToggle,
  VernierLoupe: RoomLoupe,
  MicPad: RoomMicPad,
}
