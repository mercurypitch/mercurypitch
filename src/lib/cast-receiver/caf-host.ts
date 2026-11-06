// ============================================================
// CAF host — Google's Web Receiver SDK, as the receiver's host
// ============================================================
//
// On a Cast device the page loads Google's Web Receiver SDK (the Cast
// Application Framework, `cast.framework`) from gstatic, and this starts
// it for the stage (receiver.ts):
//
// - The stage's namespace carries JSON (cast-config.ts), and its listener
//   goes on before `start`, as the SDK requires.
// - `skipPlayersLoad`: the stage plays no media through the SDK, so its
//   media players are never fetched, which spares a small device's memory.
// - `disableIdleTimeout`: the SDK would close a receiver that plays no
//   media after a while, in the middle of a song. The receiver closes
//   itself once no sender is left (REQ-TV-116, receiver.ts).
// - When the last sender leaves because its user stopped casting, the SDK
//   closes the receiver itself, as the Cast design checklist asks; no
//   handler of ours replaces that. A sender that drops off instead, a phone
//   leaving the Wi-Fi, leaves the receiver running: receiver.ts shows the
//   idle screen and closes it after five minutes alone.
//
// Only the parts of the SDK used here are typed, so no SDK types are
// installed. The names the SDK gives its events and message types are read
// from it rather than written out.
//
// Tests: src/lib/cast-receiver/caf-host.test.ts.

import { CAST_STAGE_NAMESPACE } from './cast-config'
import type { CastReceiverHost } from './receiver'

export interface CafCustomMessageEvent {
  readonly senderId: string
  readonly data: unknown
}

export interface CafSenderEvent {
  readonly senderId: string
}

export interface CafReceiverContext {
  addCustomMessageListener(
    namespace: string,
    listener: (event: CafCustomMessageEvent) => void,
  ): void
  addEventListener(
    type: string,
    listener: (event: CafSenderEvent) => void,
  ): void
  sendCustomMessage(namespace: string, senderId: string, data: unknown): void
  getSenders(): readonly unknown[]
  start(options: Record<string, unknown>): unknown
  stop(): void
}

/** `cast.framework`, as much of it as the receiver uses. */
export interface CafFramework {
  readonly CastReceiverContext: { getInstance(): CafReceiverContext }
  readonly system: {
    readonly EventType: {
      readonly SENDER_CONNECTED: string
      readonly SENDER_DISCONNECTED: string
    }
    readonly MessageType: { readonly JSON: string }
  }
}

/** What a sender's Cast menu shows while the stage runs. */
export const CAST_STATUS_TEXT = 'Mercury Pitch'

/** Starts the SDK's receiver for the stage and hands back its host. */
export function startCafHost(framework: CafFramework): CastReceiverHost {
  const context = framework.CastReceiverContext.getInstance()
  const messageListeners: ((senderId: string, data: unknown) => void)[] = []
  const connectedListeners: ((senderId: string) => void)[] = []
  const disconnectedListeners: ((senderId: string) => void)[] = []

  context.addCustomMessageListener(CAST_STAGE_NAMESPACE, (event) => {
    for (const listener of messageListeners)
      listener(event.senderId, event.data)
  })
  context.addEventListener(
    framework.system.EventType.SENDER_CONNECTED,
    (event) => {
      for (const listener of connectedListeners) listener(event.senderId)
    },
  )
  context.addEventListener(
    framework.system.EventType.SENDER_DISCONNECTED,
    (event) => {
      for (const listener of disconnectedListeners) listener(event.senderId)
    },
  )
  context.start({
    customNamespaces: {
      [CAST_STAGE_NAMESPACE]: framework.system.MessageType.JSON,
    },
    skipPlayersLoad: true,
    disableIdleTimeout: true,
    statusText: CAST_STATUS_TEXT,
  })

  return {
    onMessage: (listener) => {
      messageListeners.push(listener)
    },
    onSenderConnected: (listener) => {
      connectedListeners.push(listener)
    },
    onSenderDisconnected: (listener) => {
      disconnectedListeners.push(listener)
    },
    senderCount: () => context.getSenders().length,
    send: (senderId, data) => {
      context.sendCustomMessage(CAST_STAGE_NAMESPACE, senderId, data)
    },
    stop: () => {
      context.stop()
    },
  }
}
