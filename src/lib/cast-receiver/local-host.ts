// ============================================================
// Local host — the receiver in a browser, with no Cast SDK
// ============================================================
//
// Opened in an ordinary browser the page finds no `cast.framework`: Google's
// SDK only runs a receiver on a Cast device. It then shows the idle screen
// and takes messages from the console instead, as the iPhone's stage page
// does (`__mpStage.receive`):
//
//   __mpCast.message({ v: 1, kind: 'demo' })   as a sender's message
//   __mpCast.leave()                            the last sender leaving
//   __mpCast.replies                            what the receiver answered
//
// A message from a sender not yet seen joins it first, as on a device a
// sender connects before it sends. `stop` only marks the receiver stopped:
// a browser tab is not the receiver's to close.

import type { CastReceiverHost } from './receiver'

export interface LocalCastControls {
  message(data: unknown, senderId?: string): void
  join(senderId?: string): void
  leave(senderId?: string): void
  readonly replies: { readonly senderId: string; readonly data: unknown }[]
  stopped(): boolean
}

const LOCAL_SENDER = 'local'

export function createLocalHost(): {
  host: CastReceiverHost
  controls: LocalCastControls
} {
  const senders = new Set<string>()
  const replies: LocalCastControls['replies'] = []
  const onMessage: ((senderId: string, data: unknown) => void)[] = []
  const onConnected: ((senderId: string) => void)[] = []
  const onDisconnected: ((senderId: string) => void)[] = []
  let stopped = false

  const join = (senderId: string = LOCAL_SENDER): void => {
    if (senders.has(senderId)) return
    senders.add(senderId)
    for (const listener of onConnected) listener(senderId)
  }

  const host: CastReceiverHost = {
    onMessage: (listener) => {
      onMessage.push(listener)
    },
    onSenderConnected: (listener) => {
      onConnected.push(listener)
    },
    onSenderDisconnected: (listener) => {
      onDisconnected.push(listener)
    },
    senderCount: () => senders.size,
    send: (senderId, data) => {
      replies.push({ senderId, data })
    },
    stop: () => {
      stopped = true
    },
  }

  const controls: LocalCastControls = {
    message: (data, senderId = LOCAL_SENDER) => {
      join(senderId)
      for (const listener of onMessage) listener(senderId, data)
    },
    join,
    leave: (senderId = LOCAL_SENDER) => {
      if (!senders.delete(senderId)) return
      for (const listener of onDisconnected) listener(senderId)
    },
    replies,
    stopped: () => stopped,
  }

  return { host, controls }
}
