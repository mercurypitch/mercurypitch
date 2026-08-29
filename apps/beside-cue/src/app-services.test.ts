// ============================================================
// Beside Cue app services tests — lazy app-owned audio output
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultAppServices } from './app-services'

class TestAudioContext {
  readonly state = 'running'

  async resume(): Promise<void> {}

  async close(): Promise<void> {}
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Beside Cue app services', () => {
  it('creates one lazy Web Audio output for each app service lifetime', async () => {
    let contextsCreated = 0
    vi.stubGlobal(
      'AudioContext',
      class extends TestAudioContext {
        constructor() {
          super()
          contextsCreated += 1
        }
      },
    )

    const first = createDefaultAppServices()
    const second = createDefaultAppServices()

    expect(first.audioOutput).toBeDefined()
    expect(second.audioOutput).toBeDefined()
    expect(first.audioOutput).not.toBe(second.audioOutput)
    expect(contextsCreated).toBe(0)
    await expect(first.audioOutput?.unlock()).resolves.toBe(true)
    await expect(first.audioOutput?.unlock()).resolves.toBe(true)
    expect(contextsCreated).toBe(1)
  })
})
