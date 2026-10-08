// Runner session runtime — browser scheduling and unique epochs, replaceable by deterministic tests.

/** Only scheduling is injected; tests still exercise the real core and timestamp routing. */
export interface RunnerSessionRuntime {
  requestFrame(callback: () => void): number
  cancelFrame(id: number): void
  epoch(): string
}

let nextEpoch = 0
export const browserRunnerRuntime: RunnerSessionRuntime = {
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  epoch: () => `runner:${++nextEpoch}`,
}
