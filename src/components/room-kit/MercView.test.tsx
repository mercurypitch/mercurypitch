// ============================================================
// MercView: reduced motion reaches the stage, at mount and after
// ============================================================

import { render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MercVoice } from '@/lib/merc/sim'
import { MercView } from './MercView'

const merc = vi.hoisted(() => ({
  options: [] as unknown[],
  still: [] as boolean[],
}))
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: (_host: HTMLElement, options: unknown) => {
    merc.options.push(options)
    return {
      ok: true,
      setState: () => undefined,
      setVoice: () => undefined,
      setPaused: () => undefined,
      setStill: (still: boolean) => merc.still.push(still),
      destroy: () => undefined,
    }
  },
}))

const SILENT: MercVoice = {
  voiced: false,
  cents: 0,
  level: 0,
  steady: 0,
  midi: 57,
}

afterEach(() => {
  merc.options = []
  merc.still = []
})

describe('MercView', () => {
  it("mounts the stage with the room's reduced motion and hands over a change", async () => {
    // Arrange
    const [still, setStill] = createSignal(true)
    render(() => (
      <MercView
        state={() => 'ride'}
        voice={() => SILENT}
        still={still}
        testId="glide-merc"
      />
    ))
    await vi.waitFor(() => expect(merc.options).toHaveLength(1))

    // Act
    setStill(false)
    setStill(false)

    // Assert
    expect(merc.options[0]).toMatchObject({ state: 'ride', still: true })
    expect(merc.still).toEqual([false])
  })

  it("follows the phone's own setting when the room names none", async () => {
    // Arrange
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    }))

    // Act
    render(() => (
      <MercView state={() => 'hum'} voice={() => SILENT} testId="glide-merc" />
    ))
    await vi.waitFor(() => expect(merc.options).toHaveLength(1))
    vi.unstubAllGlobals()

    // Assert
    expect(merc.options[0]).toMatchObject({ still: true })
    expect(merc.still).toEqual([])
  })
})
