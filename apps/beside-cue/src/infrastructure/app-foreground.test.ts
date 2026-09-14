// Native foreground recovery — an existing game clock needs no ambient output.
import { acquireSharedAudioContext, resetSharedAudioContext, } from '@irchiinnuss/audio-io/shared-audio-context'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeAppForeground } from './app-foreground'

const native = vi.hoisted(() => ({
  handler: undefined as ((state: 'active' | 'background') => void) | undefined,
}))
vi.mock('@irchiinnuss/mobile-runtime/platform', () => ({
  onAppState: (handler: (state: 'active' | 'background') => void) => {
    native.handler = handler
    return () => {
      native.handler = undefined
    }
  },
}))

class GameContext extends EventTarget {
  state: AudioContextState = 'suspended'
  readonly resume = vi.fn(async () => {
    this.state = 'running'
    this.dispatchEvent(new Event('statechange'))
  })
  readonly suspend = vi.fn(async () => {
    this.state = 'suspended'
    this.dispatchEvent(new Event('statechange'))
  })
  readonly close = vi.fn(async () => {
    this.state = 'closed'
  })
}

let hidden = false
let stopForeground: (() => void) | undefined
const settle = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

function setHidden(next: boolean) {
  hidden = next
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  hidden = false
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() =>
    hidden ? 'hidden' : 'visible',
  )
})
afterEach(() => {
  stopForeground?.()
  stopForeground = undefined
  resetSharedAudioContext()
  vi.restoreAllMocks()
})

describe('native game foreground recovery', () => {
  it.each(['native first', 'page first'] as const)(
    'resumes an owned game clock after both gates return: %s',
    async (order) => {
      const context = new GameContext()
      resetSharedAudioContext({
        createContext: () => context as unknown as AudioContext,
      })
      const foreground = vi.fn()
      stopForeground = subscribeAppForeground(foreground)
      const driver = acquireSharedAudioContext('sing-driver:game')
      await driver.unlock()

      if (order === 'native first') {
        native.handler!('background')
        setHidden(true)
        native.handler!('active')
      } else {
        setHidden(true)
        native.handler!('background')
        setHidden(false)
      }
      expect(foreground).toHaveBeenLastCalledWith(false)
      expect(context.state).toBe('suspended')
      expect(context.resume).toHaveBeenCalledOnce()

      if (order === 'native first') setHidden(false)
      else native.handler!('active')
      await settle()
      expect(foreground).toHaveBeenLastCalledWith(true)
      expect(context.state).toBe('running')
      expect(context.resume).toHaveBeenCalledTimes(2)
      driver.release()
    },
  )

  it.each([false, true])(
    'handles a delayed resume after another return: %s',
    async (returnedAgain) => {
      const context = new GameContext()
      resetSharedAudioContext({
        createContext: () => context as unknown as AudioContext,
      })
      stopForeground = subscribeAppForeground(() => undefined)
      const driver = acquireSharedAudioContext('sing-driver:game')
      await driver.unlock()
      native.handler!('background')
      let finishResume!: () => void
      context.resume.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishResume = () => {
              context.state = 'running'
              resolve()
            }
          }),
      )
      native.handler!('active')
      expect(context.resume).toHaveBeenCalledTimes(2)
      native.handler!('background')
      if (returnedAgain) native.handler!('active')
      finishResume()
      await settle()
      expect(context.state).toBe(returnedAgain ? 'running' : 'suspended')
      expect(context.suspend).toHaveBeenCalledTimes(returnedAgain ? 1 : 2)
      driver.release()
    },
  )
})
