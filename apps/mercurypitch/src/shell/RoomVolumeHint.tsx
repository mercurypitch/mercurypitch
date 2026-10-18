// ============================================================
// RoomVolumeHint: "turn it up", over a premium room, while the phone is low
// ============================================================
//
// A room's notes, demos and Merc's call play through the phone's volume, and
// at the bottom of it they are gone: the room looks broken. The phone says
// how loud it is (AudioOutput through NativeDeviceApi.audioOutput) when the
// room opens and on a press of a volume key, and volume-hint.ts decides
// from that whether this shows. It goes the moment the volume rises. A
// press can come with no word from the phone, so while this is up, and
// whenever the app comes back, it reads the volume again.
//
// It also reads again whenever WebKit may have moved the sound to another
// of iOS's stored volumes: as the room opens and as the mic opens or
// closes, at once and once more SETTLE_MS later. Opening the mic moves
// WebKit's session to play-and-record, which keeps a volume of its own
// (WebKit bug 236219; room-visit.ts asks for that session for the whole
// visit, so it moves once, at the door).
//
// It says "zero" only from a reading taken at its word (volume-hint.ts):
// an iPhone's own session can read 0 while the room plays out loud.
//
// ShellScreens mounts it over each premium room, so no room draws it and
// none of them changes for it. It sits in the bar over the room's title,
// the one place no room uses (RoomVolumeHint.module.css says what is where),
// and takes no taps. The web never shows it: there the app has no reading of
// the volume and nothing is registered to ask.
//
// Each decision that changes what it shows is handed to `onRoomVolumeNotice`
// listeners with the reading behind it: a test build's audio census writes
// it into the audio record. A store build registers none.

import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { micManager } from '@/lib/mic-manager'
import type { NativeAudioOutput, NativeAudioOutputReading, } from '@/stores/native-shell-store'
import { nativeDeviceApi, pushedBarEnd } from '@/stores/native-shell-store'
import { VolumeLowIcon, VolumeOffIcon } from './icons'
import styles from './RoomVolumeHint.module.css'
import type { VolumeHint } from './volume-hint'
import { nextVolumeHint, VOLUME_HINT_START } from './volume-hint'

// Two lines at most in the bar beside a level pill and "?" (177 px on a
// 390 px phone).
export const HINT_SILENT = 'The volume is at zero. Turn it up.'
export const HINT_LOW = 'Turn the volume up to hear the notes.'

/** The gap kept between the hint and the room's controls in the bar. */
const GAP_PX = 8

/** How often the volume is read again while the hint is up. */
export const READ_AGAIN_MS = 500

/**
 * After the room opens or the mic opens or closes, the volume is read once
 * more this long after: WebKit changes its session a moment later.
 */
export const SETTLE_MS = 1000

/** Hears the page's microphone open (true) and close (false). */
export type MicWatch = (onChange: (open: boolean) => void) => () => void

/**
 * The app's microphone as the mic manager holds it: open from the device's
 * first open to its close, the linger after the last release included,
 * since that close is the one WebKit's session follows.
 */
export const watchAppMic: MicWatch = (onChange) => {
  let open = micManager.getStream() !== null
  return micManager.subscribe(() => {
    const now = micManager.getStream() !== null
    if (now === open) return
    open = now
    onChange(now)
  })
}

/** What the hint shows after a reading, and the reading that decided it. */
export interface RoomVolumeNotice {
  /** The words on screen, or null while nothing shows. */
  readonly text: string | null
  readonly reading: NativeAudioOutputReading
  /** What brought the reading: 'room open', 'mic open', 'change: volume'... */
  readonly cause: string
}

const noticeListeners = new Set<(notice: RoomVolumeNotice) => void>()

/** Every change to what the hint shows. Returns the unsubscribe. */
export function onRoomVolumeNotice(
  listener: (notice: RoomVolumeNotice) => void,
): () => void {
  noticeListeners.add(listener)
  return () => noticeListeners.delete(listener)
}

const wordsOf = (hint: VolumeHint): string | null => {
  if (!hint.shown) return null
  return hint.silent ? HINT_SILENT : HINT_LOW
}

export interface RoomVolumeHintProps {
  /** The phone's output; the registered native device's when not given. */
  output?: NativeAudioOutput
  /** The page's microphone; the app's mic manager when not given. */
  mic?: MicWatch
}

/**
 * Where the hint ends, in px from the right edge: at the room's controls in
 * the bar. Null leaves it to the stylesheet (no bar: a fixture, a test).
 */
function rightEdge(): number | null {
  const end = pushedBarEnd()
  if (end === null) return null
  const box = end.getBoundingClientRect()
  if (box.width === 0) return 12
  return Math.max(12, window.innerWidth - box.left + GAP_PX)
}

export const RoomVolumeHint: Component<RoomVolumeHintProps> = (props) => {
  const [hint, setHint] = createSignal<VolumeHint>(VOLUME_HINT_START)
  const [right, setRight] = createSignal<number | null>(null)
  const take = (reading: NativeAudioOutputReading, cause: string): void => {
    setRight(rightEdge())
    let last = VOLUME_HINT_START
    const next = setHint((previous) => {
      last = previous
      return nextVolumeHint(previous, reading)
    })
    const words = wordsOf(next)
    if (last.volume !== null && words === wordsOf(last)) return
    for (const listener of [...noticeListeners]) {
      try {
        listener({ text: words, reading, cause })
      } catch {
        // A record that broke must not take the hint with it.
      }
    }
  }
  // The room's controls come and go (none while a take runs), and the hint
  // ends where they begin.
  const remeasure = (): void => void setRight(rightEdge())
  window.addEventListener('resize', remeasure)
  const end = pushedBarEnd()
  const controls =
    end === null || typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(remeasure)
  if (end !== null)
    controls?.observe(end, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  onCleanup(() => {
    window.removeEventListener('resize', remeasure)
    controls?.disconnect()
  })

  // Read once, as the room opens: a room is not handed a new phone.
  // eslint-disable-next-line solid/reactivity -- read once, on mount
  const output = props.output ?? nativeDeviceApi()?.audioOutput
  if (output !== undefined) {
    let heard = 0
    let asking = false
    let open = true
    const stop = output.watch((reading) => {
      heard += 1
      take(reading, `change: ${reading.reason ?? 'unnamed'}`)
    })
    const ask = (cause: string): void => {
      if (!open || asking) return
      asking = true
      const before = heard
      output.read().then(
        (reading) => {
          asking = false
          // A change heard meanwhile is newer than this answer, which is
          // then dropped.
          if (open && heard === before && reading !== null) take(reading, cause)
        },
        () => {
          asking = false
        },
      )
    }
    const inFront = (): boolean => document.visibilityState !== 'hidden'
    // At once, and once more after WebKit has had time to switch.
    const settling = new Set<number>()
    const askAround = (cause: string): void => {
      ask(cause)
      const timer = window.setTimeout(() => {
        settling.delete(timer)
        if (inFront()) ask(`${cause}, settled`)
      }, SETTLE_MS)
      settling.add(timer)
    }
    askAround('room open')
    // eslint-disable-next-line solid/reactivity -- read once, on mount
    const stopMic = (props.mic ?? watchAppMic)((micOpen) => {
      askAround(micOpen ? 'mic open' : 'mic closed')
    })

    // A change can come with no word from the phone. iOS tells the app of
    // the volume through the app's own audio session, which stopped
    // following the keys the moment a room opened on the owner's iPhone
    // (docs/agent/MISTAKES.md); the plugin now reads the system's volume as
    // well, and the reading goes by it once it has moved. Android says
    // nothing when a stream is muted or unmuted without its level moving.
    // So while the hint is up, and whenever the app comes back, the volume
    // is read again.
    createEffect(() => {
      if (!hint().shown) return
      const timer = window.setInterval(() => {
        if (inFront()) ask('read again')
      }, READ_AGAIN_MS)
      onCleanup(() => window.clearInterval(timer))
    })
    const back = (): void => {
      if (inFront()) ask('app back')
    }
    document.addEventListener('visibilitychange', back)
    onCleanup(() => {
      open = false
      for (const timer of settling) window.clearTimeout(timer)
      settling.clear()
      document.removeEventListener('visibilitychange', back)
      stopMic()
      stop()
    })
  }

  return (
    <div
      class={styles.slot}
      style={right() === null ? undefined : { right: `${String(right())}px` }}
      role="status"
      data-testid="room-volume-slot"
    >
      <Show when={hint().shown}>
        <div
          class={styles.hint}
          data-testid="room-volume-hint"
          data-silent={hint().silent ? 'true' : 'false'}
        >
          <Show when={hint().silent} fallback={<VolumeLowIcon size={18} />}>
            <VolumeOffIcon size={18} />
          </Show>
          <span class={styles.words}>{wordsOf(hint())}</span>
        </div>
      </Show>
    </div>
  )
}
