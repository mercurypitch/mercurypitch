import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTranscriptionTrainer } from '@/features/guitar-practice/TranscriptionTrainerState'
import type { AudioEngine } from '@/lib/audio-engine'

function createFakeSourceNode() {
  return {
    buffer: null as AudioBuffer | null,
    playbackRate: { value: 1 },
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
}

describe('createTranscriptionTrainer — loop handling', () => {
  let rafCallback: (() => void) | null = null
  let fakeCtx: {
    currentTime: number
    createBufferSource: ReturnType<typeof vi.fn>
    decodeAudioData: ReturnType<typeof vi.fn>
  }
  let sourceNodes: ReturnType<typeof createFakeSourceNode>[]

  beforeEach(() => {
    rafCallback = null
    sourceNodes = []
    fakeCtx = {
      currentTime: 0,
      createBufferSource: vi.fn(() => {
        const node = createFakeSourceNode()
        sourceNodes.push(node)
        return node
      }),
      decodeAudioData: vi.fn(async () => ({ duration: 10 }) as AudioBuffer),
    }
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: () => void) => {
        rafCallback = cb
        return 1
      }),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not tear down and recreate the source node at the loop boundary', async () => {
    // The AudioBufferSourceNode already loops natively (loop/loopStart/
    // loopEnd) — the previous behavior of also calling restartSource() from
    // the JS polling loop at the same boundary caused an audible glitch by
    // stopping a perfectly-fine, already-looping source and replacing it.
    await createRoot(async (dispose) => {
      const fakeAudioEngine = { audioCtx: fakeCtx } as unknown as AudioEngine
      const trainer = createTranscriptionTrainer(fakeAudioEngine)

      const fakeFile = {
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as File
      await trainer.loadAudio(fakeFile)

      trainer.setLoopEnd(5)
      trainer.setLoopStart(2)
      trainer.toggleLoop() // loopEnabled = true (not playing yet, no restart)

      trainer.play() // creates + starts the (looping) source node
      expect(sourceNodes.length).toBe(1)
      expect(sourceNodes[0].loop).toBe(true)

      // Advance real audio-clock time past loopEnd and run the polling
      // loop's callback, simulating the native loop having already wrapped.
      fakeCtx.currentTime = 5.2
      rafCallback?.()

      expect(sourceNodes.length).toBe(1) // no new source was created
      expect(sourceNodes[0].stop).not.toHaveBeenCalled() // original never stopped
      expect(trainer.currentTime()).toBe(2) // display re-synced to loopStart

      dispose()
    })
  })
})
