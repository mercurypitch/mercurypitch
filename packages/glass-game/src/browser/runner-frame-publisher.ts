// Runner frame publisher — deliver reentrant session updates in order while isolating presentation listeners.

import type { RunnerSessionFrame } from '../runner/session-contracts'

export function createRunnerFramePublisher() {
  let publishing = false
  const frames: RunnerSessionFrame[] = []
  const listeners = new Set<(frame: RunnerSessionFrame) => void>()

  return {
    publish(frame: RunnerSessionFrame): void {
      frames.push(Object.freeze(frame))
      if (publishing) return
      publishing = true
      try {
        while (frames.length) {
          const next = frames.shift()!
          for (const listener of [...listeners]) {
            if (!listeners.has(listener)) continue
            try {
              listener(next)
            } catch {
              /* Presentation cannot interrupt clock or resource cleanup. */
            }
          }
        }
      } finally {
        publishing = false
      }
    },
    subscribe(
      listener: (frame: RunnerSessionFrame) => void,
      initial: RunnerSessionFrame,
    ): () => void {
      listeners.add(listener)
      listener(initial)
      return () => {
        listeners.delete(listener)
      }
    },
    clearListeners(): void {
      listeners.clear()
    },
  }
}
