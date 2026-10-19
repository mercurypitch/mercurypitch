// ============================================================
// MercView: reduced motion, the rings and the mouth reach the stage
// ============================================================

import { render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MercVoice } from '@/lib/merc/sim'
import { MercView } from './MercView'

const merc = vi.hoisted(() => ({
  options: [] as unknown[],
  still: [] as boolean[],
  ok: true,
}))
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: (_host: HTMLElement, options: unknown) => {
    merc.options.push(options)
    return {
      ok: merc.ok,
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
  merc.ok = true
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
    // Rings on unless the room says otherwise.
    expect(merc.options[0]).toMatchObject({ rings: undefined })
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

  it('hands the stage the mouth the room names, and none when it names none', async () => {
    // Arrange, act
    render(() => (
      <MercView
        state={() => 'ride'}
        voice={() => SILENT}
        mouth="buzz"
        testId="lip-merc"
      />
    ))
    await vi.waitFor(() => expect(merc.options).toHaveLength(1))
    render(() => (
      <MercView state={() => 'hum'} voice={() => SILENT} testId="glide-merc" />
    ))
    await vi.waitFor(() => expect(merc.options).toHaveLength(2))

    // Assert: none is the closed smile (the stage's default).
    expect(merc.options[0]).toMatchObject({ state: 'ride', mouth: 'buzz' })
    expect(merc.options[1]).toMatchObject({ state: 'hum', mouth: undefined })
  })

  it('says when his stage starts drawing, once, and never without WebGL', async () => {
    // Arrange
    const drawing = vi.fn()
    const without = vi.fn()

    // Act
    render(() => (
      <MercView
        state={() => 'drop'}
        voice={() => SILENT}
        onReady={drawing}
        testId="alley-merc"
      />
    ))
    await vi.waitFor(() => expect(merc.options).toHaveLength(1))
    merc.ok = false
    render(() => (
      <MercView
        state={() => 'drop'}
        voice={() => SILENT}
        onReady={without}
        testId="alley-merc"
      />
    ))
    await vi.waitFor(() => expect(merc.options).toHaveLength(2))

    // Assert
    expect(drawing).toHaveBeenCalledTimes(1)
    expect(without).not.toHaveBeenCalled()
  })

  it('hands the stage his rings when the room turns them off', async () => {
    // Arrange, act
    render(() => (
      <MercView
        state={() => 'ride'}
        voice={() => SILENT}
        rings={false}
        testId="glide-merc"
      />
    ))
    await vi.waitFor(() => expect(merc.options).toHaveLength(1))

    // Assert
    expect(merc.options[0]).toMatchObject({ state: 'ride', rings: false })
  })
})
