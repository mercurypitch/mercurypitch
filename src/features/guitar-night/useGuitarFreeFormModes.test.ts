// Mode admission tests exercise cancellation and ordering without replacing mode logic.
import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { useGuitarFreeFormModes } from './useGuitarFreeFormModes'

function harness() {
  return createRoot((dispose) => {
    const [sourceId, source] = createSignal<string | null>(null)
    const [captureBusy, capture] = createSignal(false)
    const [blocked, block] = createSignal(false)
    const effects: string[] = []
    const settlePractice = vi.fn(async () => {
      effects.push('settled')
    })
    const preparePractice = vi.fn(async () => true)
    const onMissingSource = vi.fn()
    const modes = useGuitarFreeFormModes({
      sourceId,
      captureBusy,
      blocked,
      settlePractice,
      preparePractice,
      onMissingSource,
      pauseReplay: () => {
        effects.push('paused')
      },
      cancelPracticeStart: () => {
        effects.push('cancelled')
      },
      startRecording: async () => {
        effects.push('record')
        capture(true)
      },
    })
    return {
      modes,
      source,
      capture,
      block,
      effects,
      settlePractice,
      preparePractice,
      onMissingSource,
      dispose,
    }
  })
}

describe('free-form mode coordination', () => {
  it('defaults empty to Live and asks for a melody instead of activating playback', async () => {
    const h = harness()
    expect(h.modes.mode()).toBe('live')
    expect(await h.modes.select('practice')).toBe(false)
    expect(h.onMissingSource).toHaveBeenCalledOnce()
    expect(h.effects).toEqual([])
    h.dispose()
  })
  it('hides a selected melody in Live and returns without accepting a practice revision', async () => {
    const h = harness()
    h.source('melody-a')
    expect(h.modes.mode()).toBe('replay')
    await h.modes.select('live')
    await h.modes.select('replay')
    expect(h.modes.mode()).toBe('replay')
    expect(h.preparePractice).not.toHaveBeenCalled()
    h.dispose()
  })
  it('does not commit a late practice admission after Live supersedes it', async () => {
    const h = harness()
    h.source('melody-a')
    let finish!: (accepted: boolean) => void
    let prepared!: () => void
    const preparationEntered = new Promise<void>((resolve) => {
      prepared = resolve
    })
    h.preparePractice.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
          prepared()
        }),
    )
    const entering = h.modes.select('practice')
    await preparationEntered
    await h.modes.select('live')
    finish(true)
    expect(await entering).toBe(false)
    expect(h.modes.mode()).toBe('live')
    h.dispose()
  })
  it('settles Practice before admitting capture and blocks mode changes during recording', async () => {
    const h = harness()
    h.source('melody-a')
    await h.modes.select('practice')
    h.effects.length = 0
    await h.modes.record()
    expect(h.effects).toEqual(['cancelled', 'paused', 'settled', 'record'])
    expect(h.modes.mode()).toBe('live')
    expect(await h.modes.select('replay')).toBe(false)
    h.dispose()
  })
  it('cancels Record while a prior score is draining and retains the selected mode', async () => {
    const h = harness()
    h.source('melody-a')
    let finish!: () => void
    h.settlePractice.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const recording = h.modes.record()
    h.modes.cancel()
    finish()
    await recording
    expect(h.effects).not.toContain('record')
    expect(h.modes.mode()).toBe('replay')
    h.dispose()
  })
  it('rejects stale admissions after the source changes, or the host is suspended', async () => {
    const h = harness()
    h.source('melody-a')
    let finish!: (accepted: boolean) => void
    let prepared!: () => void
    const preparationEntered = new Promise<void>((resolve) => {
      prepared = resolve
    })
    h.preparePractice.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
          prepared()
        }),
    )
    const entering = h.modes.select('practice')
    await preparationEntered
    h.source('melody-b')
    h.block(true)
    finish(true)
    expect(await entering).toBe(false)
    expect(h.modes.mode()).toBe('replay')
    expect(h.modes.pending()).toBeNull()
    h.dispose()
  })
  it('lets Record supersede pending Practice without waiting for stale admission to finish', async () => {
    const h = harness()
    h.source('melody-a')
    let finish!: (accepted: boolean) => void
    let prepared!: () => void
    const preparationEntered = new Promise<void>((resolve) => {
      prepared = resolve
    })
    h.preparePractice.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
          prepared()
        }),
    )
    const entering = h.modes.select('practice')
    await preparationEntered

    await h.modes.record()
    finish(true)

    expect(await entering).toBe(false)
    expect(h.effects).toContain('record')
    expect(h.modes.mode()).toBe('live')
    h.dispose()
  })
  it('ignores duplicate Practice presses during the same pending admission', async () => {
    const h = harness()
    h.source('melody-a')
    let finish!: (accepted: boolean) => void
    let prepared!: () => void
    const preparationEntered = new Promise<void>((resolve) => {
      prepared = resolve
    })
    h.preparePractice.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
          prepared()
        }),
    )
    const entering = h.modes.select('practice')
    await preparationEntered

    const duplicate = h.modes.select('practice')
    finish(true)

    expect(await entering).toBe(true)
    expect(await duplicate).toBe(false)
    expect(h.preparePractice).toHaveBeenCalledOnce()
    expect(h.modes.mode()).toBe('practice')
    h.dispose()
  })
  it('preserves Replay when target validation refuses Practice and reports a failed drain', async () => {
    const h = harness()
    h.source('melody-a')
    h.preparePractice.mockResolvedValue(false)
    expect(await h.modes.select('practice')).toBe(false)
    expect(h.modes.mode()).toBe('replay')
    expect(h.modes.pending()).toBeNull()

    h.settlePractice.mockRejectedValue(new Error('Input boundary failed'))

    expect(await h.modes.select('live')).toBe(false)
    expect(h.modes.mode()).toBe('replay')
    expect(h.modes.error()).toBe('Input boundary failed')
    h.dispose()
  })
  it('does not start capture after source replacement during score drainage', async () => {
    const h = harness()
    h.source('melody-a')
    let finish!: () => void
    h.settlePractice.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const recording = h.modes.record()

    h.source('melody-b')
    finish()
    await recording

    expect(h.effects).not.toContain('record')
    expect(h.modes.mode()).toBe('replay')
    expect(h.modes.pending()).toBeNull()
    h.dispose()
  })
  it('rejects capture while saving or blocked without cancelling the current input session', async () => {
    const h = harness()
    h.capture(true)
    await h.modes.record()
    expect(await h.modes.select('live')).toBe(false)
    h.capture(false)
    h.block(true)
    await h.modes.record()

    expect(h.effects).toEqual([])
    expect(h.modes.pending()).toBeNull()
    h.dispose()
  })
})
