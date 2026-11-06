// ============================================================
// CAF host tests — the Web Receiver SDK started for the stage
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { CafCustomMessageEvent, CafFramework, CafReceiverContext, CafSenderEvent, } from '@/lib/cast-receiver/caf-host'
import { CAST_STATUS_TEXT, startCafHost } from '@/lib/cast-receiver/caf-host'
import { CAST_STAGE_NAMESPACE } from '@/lib/cast-receiver/cast-config'

/** A stand-in for `cast.framework`, recording what the host asks of it. */
function fakeFramework() {
  const calls: string[] = []
  const messageListeners = new Map<
    string,
    (event: CafCustomMessageEvent) => void
  >()
  const eventListeners = new Map<string, (event: CafSenderEvent) => void>()
  const senders: string[] = []
  const context: CafReceiverContext = {
    addCustomMessageListener: (namespace, listener) => {
      calls.push(`listen ${namespace}`)
      messageListeners.set(namespace, listener)
    },
    addEventListener: (type, listener) => {
      calls.push(`on ${type}`)
      eventListeners.set(type, listener)
    },
    sendCustomMessage: vi.fn(),
    getSenders: () => senders,
    start: vi.fn(() => {
      calls.push('start')
    }),
    stop: vi.fn(),
  }
  const framework: CafFramework = {
    CastReceiverContext: { getInstance: () => context },
    system: {
      EventType: {
        SENDER_CONNECTED: 'senderconnected',
        SENDER_DISCONNECTED: 'senderdisconnected',
      },
      MessageType: { JSON: 'JSON' },
    },
  }
  return {
    framework,
    context,
    calls,
    messageListeners,
    eventListeners,
    senders,
  }
}

describe('starting the SDK for the stage', () => {
  it('listens on the stage’s namespace before it starts, as the SDK requires', () => {
    const { framework, calls } = fakeFramework()
    startCafHost(framework)
    expect(calls).toEqual([
      `listen ${CAST_STAGE_NAMESPACE}`,
      'on senderconnected',
      'on senderdisconnected',
      'start',
    ])
  })

  it('starts with the namespace as JSON, no media players and no idle timeout', () => {
    const { framework, context } = fakeFramework()
    startCafHost(framework)
    expect(context.start).toHaveBeenCalledWith({
      customNamespaces: { [CAST_STAGE_NAMESPACE]: 'JSON' },
      skipPlayersLoad: true,
      disableIdleTimeout: true,
      statusText: CAST_STATUS_TEXT,
    })
  })

  it('hands on messages and senders, and sends on the namespace', () => {
    const { framework, context, messageListeners, eventListeners, senders } =
      fakeFramework()
    const host = startCafHost(framework)
    const onMessage = vi.fn()
    const onConnected = vi.fn()
    const onDisconnected = vi.fn()
    host.onMessage(onMessage)
    host.onSenderConnected(onConnected)
    host.onSenderDisconnected(onDisconnected)

    messageListeners.get(CAST_STAGE_NAMESPACE)?.({
      senderId: 'phone',
      data: { v: 1, kind: 'probe' },
    })
    expect(onMessage).toHaveBeenCalledWith('phone', { v: 1, kind: 'probe' })

    senders.push('phone')
    eventListeners.get('senderconnected')?.({ senderId: 'phone' })
    expect(onConnected).toHaveBeenCalledWith('phone')
    expect(host.senderCount()).toBe(1)

    senders.pop()
    eventListeners.get('senderdisconnected')?.({ senderId: 'phone' })
    expect(onDisconnected).toHaveBeenCalledWith('phone')
    expect(host.senderCount()).toBe(0)

    host.send('phone', { v: 1, kind: 'capabilities' })
    expect(context.sendCustomMessage).toHaveBeenCalledWith(
      CAST_STAGE_NAMESPACE,
      'phone',
      { v: 1, kind: 'capabilities' },
    )
    host.stop()
    expect(context.stop).toHaveBeenCalledTimes(1)
  })
})
