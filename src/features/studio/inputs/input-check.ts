// ============================================================
// Studio input check — open one input to see its channels and levels while no lane holds the microphone, and let it go the moment one does
// ============================================================
//
// The Inputs view meters an input two ways, and never opens a capture
// beside a take:
//  - while a lane holds the microphone, on the arm's own split
//    (recorder.inputTap): the device the take records from is metered by
//    the take's own graph;
//  - otherwise on a check: one input opened through MicManager.acquireFrom
//    under an id of its own (no getUserMedia here), metered while the view
//    is open.
// MicManager holds one input of its own at a time, and a later acquireFrom
// ends the earlier hold. So a check is offered only while nothing is armed,
// since it would end the arm's hold; and an arm ends a check: its own
// acquireFrom takes the hold over, and the check lets its input go and
// stops metering as the recorder leaves idle. The view closing lets it go
// too. WebKit keeps one capture at a time, muting the earlier as another
// opens; with one hold at a time the view never asks it for two.
//
// A check learns how many channels the input has and keeps the count
// (rememberInputChannels), so the input's rows and the lanes' channel
// pickers show without an arm. The microphone icon shows while it is open.
import type { Accessor } from 'solid-js'
import { createEffect, createSignal, on, onCleanup } from 'solid-js'
import type { ChannelTap } from '@/lib/audio-input/channel-meters'
import { tapCapture } from '@/lib/audio-input/channel-meters'
import type { MicError } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import { reportedChannels } from '@/lib/studio/record/lane-channel'

/** The microphone hold and the mic icon of the Inputs view share this id. */
export const STUDIO_INPUTS_MIC_ID = 'studio-inputs'

/** An input of its own, as MicManager.acquireFrom holds it. */
export interface StudioInputHold {
  readonly stream: MediaStream
  /** The input asked for was gone: the stream is the default's. */
  readonly missing: boolean
  release(): void
}

export interface StudioInputCheckDeps {
  /** A lane holds the microphone: arming, armed, counting in, recording or keeping a take. */
  readonly armed: Accessor<boolean>
  /** Open `deviceId` (null: the system default) as an input of its own. */
  acquire(deviceId: string | null): Promise<StudioInputHold>
  /** The Studio's clock, running, to meter on; null when it will not run. */
  clock(): Promise<AudioContext | null>
  /** Keep the channel count of the input `stream` opened (rememberInputChannels). */
  remember(stream: MediaStream, channels: number): void
  /** Call `ended` when the hold is taken over or the input goes; the unwatch. */
  watch(ended: () => void): () => void
  /** List the inputs again, once the page may use the microphone. */
  refresh(): Promise<void>
}

/** An input open on a check. */
export interface StudioCheckedInput {
  /** The input checked: its id in the roster. */
  readonly deviceId: string
  /** Its channels as its track reports them; null where the browser does not say. */
  readonly channels: number | null
  readonly tap: ChannelTap
}

const MIC_WORDS: Record<MicError['kind'], string> = {
  'permission-denied':
    "Studio can't hear your microphone. Allow it in the browser's site settings, then try again.",
  'device-busy': 'Another app is using that input. Close it, then try again.',
  'no-device': "Studio can't find that input. Connect it, then try again.",
  'held-elsewhere':
    'Another MercuryPitch tab is using your microphone. Close it there, then try again.',
  unknown: "Studio can't open that input. Try again.",
}

function micWords(error: unknown): string {
  const kind = (error as Partial<MicError> | null)?.kind
  return typeof kind === 'string' && kind in MIC_WORDS
    ? MIC_WORDS[kind as MicError['kind']]
    : MIC_WORDS.unknown
}

export function createStudioInputCheck(deps: StudioInputCheckDeps) {
  const [open, setOpen] = createSignal<StudioCheckedInput | null>(null)
  const [opening, setOpening] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  let close: (() => void) | null = null
  // A newer check, a release or an arm makes an open under way stale.
  let attempt = 0

  /** Let the input go and stop metering it. */
  function release(): void {
    attempt += 1
    const closing = close
    close = null
    closing?.()
    setOpen(null)
    setOpening(null)
  }

  /** Open input `deviceId` (by `openId`: null for the system default) and meter it; nothing while a lane is armed. */
  async function check(deviceId: string, openId: string | null): Promise<void> {
    if (deps.armed()) return
    release()
    const mine = attempt
    setError(null)
    setOpening(deviceId)
    // Both start before anything is awaited, as an arm's do: a browser
    // starts the clock only inside the press.
    const clocking = deps.clock()
    let hold: StudioInputHold
    try {
      hold = await deps.acquire(openId)
    } catch (err) {
      if (mine === attempt) {
        setOpening(null)
        setError(micWords(err))
      }
      return
    }
    const stale = () => mine !== attempt || deps.armed()
    if (stale() || hold.missing) {
      hold.release()
      if (!stale()) {
        setOpening(null)
        setError('That input is not connected.')
      }
      return
    }
    const context = await clocking
    if (stale() || context === null) {
      hold.release()
      if (!stale()) {
        setOpening(null)
        setError("Studio's audio didn't start. Press Check again.")
      }
      return
    }
    const channels = reportedChannels(hold.stream)
    if (channels !== null) deps.remember(hold.stream, channels)
    const source = context.createMediaStreamSource(hold.stream)
    const tapped = tapCapture(context, source, channels ?? 1)
    const unwatch = deps.watch(() => {
      if (mine === attempt) release()
    })
    close = () => {
      unwatch()
      tapped.close()
      source.disconnect()
      hold.release()
    }
    setOpening(null)
    setOpen({ deviceId, channels, tap: tapped.tap })
  }

  /** Ask for the microphone so the browser names its inputs: open the default and let it go at once. */
  async function allow(): Promise<void> {
    if (deps.armed()) return
    release()
    setError(null)
    try {
      const hold = await deps.acquire(null)
      hold.release()
    } catch (err) {
      setError(micWords(err))
      return
    }
    await deps.refresh()
  }

  // An arm takes the hold over: let go as the recorder leaves idle.
  createEffect(
    on(deps.armed, (armed) => {
      if (armed) release()
    }),
  )
  onCleanup(release)
  onCleanup(
    registerMicIndicator(
      STUDIO_INPUTS_MIC_ID,
      // Polled by the sentinel on its own interval, outside any tracked scope.
      // eslint-disable-next-line solid/reactivity
      () => open() !== null,
      release,
    ),
  )

  return {
    /** The input open on a check, and its tap; null while none is. */
    open,
    /** The input a check is opening now, by its roster id. */
    opening,
    /** Why the last check or ask did not open; null when it did. */
    error,
    /** A check is offered: no lane holds the microphone. */
    canCheck: () => !deps.armed(),
    check,
    allow,
    release,
  }
}

export type StudioInputCheck = ReturnType<typeof createStudioInputCheck>
