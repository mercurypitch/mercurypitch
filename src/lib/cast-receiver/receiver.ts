// ============================================================
// Cast receiver — the stage on a Cast device, run by its senders
// ============================================================
//
// REQ-TV-110: on a Google Cast device the stage is a Custom Web Receiver
// that takes the room's messages on its own namespace. This is the
// receiver's logic, over a host that stands for Google's Web Receiver SDK
// (caf-host.ts on the device, a fake in tests):
//
// - A stage message (`song`, `frame`, `idle`) goes to the stage, as on the
//   iPhone's second screen. A frame's moment is carried onto this device's
//   clock first (sender-clock.ts), since the phone's clock is not this one.
// - A control message (control.ts) asks the receiver itself: `probe` is
//   answered with what the device can do and how its frames are going,
//   `diagnostics` draws that over the stage, and `demo` plays the demo
//   song, driven here (demo-song.ts) until a phone sends a song or leaves.
// - REQ-TV-116: when the last sender leaves, the song stops and the idle
//   screen shows. With no sender for CAST_IDLE_CLOSE_MS more, the receiver
//   closes, so a TV is not left on the idle screen; a sender that comes back
//   in time keeps it. A receiver that starts with no sender waits the same.
//   A user who stops casting closes it at once: the SDK does that itself
//   (caf-host.ts), so this is for a sender that dropped off.
// - REQ-TV-111: a reply that would not fit in one Cast message is not sent.
//
// Anything else is dropped, as the stage drops what it does not know.
//
// Tests: src/lib/cast-receiver/receiver.test.ts.

import type { TvStageMessage } from '@/lib/tv-stage/protocol'
import { readTvStageValue, TV_STAGE_IDLE, TV_STAGE_PROTOCOL, } from '@/lib/tv-stage/protocol'
import type { CastCapabilities } from './capabilities'
import { CAST_IDLE_CLOSE_MS, CAST_MESSAGE_LIMIT_BYTES } from './cast-config'
import { readCastControl } from './control'
import { demoFrame, demoSong } from './demo-song'
import type { FrameMeterReading } from './frame-meter'
import type { SenderClock } from './sender-clock'
import { createSenderClock } from './sender-clock'

/** How often the demo sends the stage a frame: twenty a second, as the room. */
export const DEMO_FRAME_MS = 50

/** The receiver's side of a Cast session, as much of the SDK as it uses. */
export interface CastReceiverHost {
  onMessage(listener: (senderId: string, data: unknown) => void): void
  onSenderConnected(listener: (senderId: string) => void): void
  onSenderDisconnected(listener: (senderId: string) => void): void
  /** How many senders are connected now. */
  senderCount(): number
  send(senderId: string, data: unknown): void
  /** Closes the receiver on the device. */
  stop(): void
}

export interface CastReceiverDeps {
  readonly stage: { receive(message: TvStageMessage): void }
  /** The wall clock, in ms. */
  readonly now: () => number
  readonly probe: () => Promise<CastCapabilities>
  readonly meter: { reading(): FrameMeterReading }
  readonly setDiagnostics: (on: boolean) => void
  /** Runs `task` every `ms`; the returned function stops it. */
  readonly every: (task: () => void, ms: number) => () => void
  /** Runs `task` once after `ms`; the returned function cancels it. */
  readonly after: (task: () => void, ms: number) => () => void
  readonly clock?: SenderClock
}

/** What the receiver answers a `probe` with. */
export interface CastCapabilitiesReply {
  readonly v: typeof TV_STAGE_PROTOCOL
  readonly kind: 'capabilities'
  readonly capabilities: CastCapabilities
  readonly meter: FrameMeterReading
}

export interface CastReceiver {
  /** Whether the demo is driving the stage. */
  demoing(): boolean
}

/** The bytes `data` takes as a Cast message, which carries it as JSON. */
export function castMessageBytes(data: unknown): number {
  return new TextEncoder().encode(JSON.stringify(data)).length
}

export function runCastReceiver(
  host: CastReceiverHost,
  deps: CastReceiverDeps,
): CastReceiver {
  const clock = deps.clock ?? createSenderClock()
  let stopDemo: (() => void) | null = null
  let cancelClose: (() => void) | null = null

  const reply = (senderId: string, data: unknown): void => {
    if (castMessageBytes(data) > CAST_MESSAGE_LIMIT_BYTES) return
    host.send(senderId, data)
  }

  const endDemo = (): void => {
    stopDemo?.()
    stopDemo = null
  }

  const startDemo = (): void => {
    endDemo()
    const startedAt = deps.now()
    let previous = 0
    deps.stage.receive(demoSong())
    const step = (): void => {
      const at = deps.now()
      const elapsed = (at - startedAt) / 1000
      deps.stage.receive(demoFrame(elapsed, previous, at))
      previous = elapsed
    }
    step()
    stopDemo = deps.every(step, DEMO_FRAME_MS)
  }

  const keepOpen = (): void => {
    cancelClose?.()
    cancelClose = null
  }

  const closeLater = (): void => {
    keepOpen()
    cancelClose = deps.after(() => host.stop(), CAST_IDLE_CLOSE_MS)
  }

  host.onMessage((senderId, data) => {
    const message = readTvStageValue(data)
    if (message !== null) {
      endDemo()
      deps.stage.receive(
        message.kind === 'frame'
          ? { ...message, at: clock.toLocal(message.at, deps.now()) }
          : message,
      )
      return
    }
    const control = readCastControl(data)
    if (control === null) return
    switch (control.kind) {
      case 'probe':
        void deps
          .probe()
          .then((capabilities) => {
            const answer: CastCapabilitiesReply = {
              v: TV_STAGE_PROTOCOL,
              kind: 'capabilities',
              capabilities,
              meter: deps.meter.reading(),
            }
            reply(senderId, answer)
          })
          .catch(() => undefined)
        return
      case 'diagnostics':
        deps.setDiagnostics(control.on)
        return
      case 'demo':
        startDemo()
        return
    }
  })

  host.onSenderConnected(() => {
    keepOpen()
  })

  host.onSenderDisconnected(() => {
    if (host.senderCount() > 0) return
    endDemo()
    clock.reset()
    deps.stage.receive(TV_STAGE_IDLE)
    closeLater()
  })

  if (host.senderCount() === 0) closeLater()

  return { demoing: () => stopDemo !== null }
}
