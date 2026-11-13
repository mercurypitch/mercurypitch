// ============================================================
// Lesson 26 Sing it's figure tests — what it paints over the chart draws on its own
// ============================================================
//
// The figure on the page's frame loop, run by hand
// (kit/frame-loop.test-fixtures.ts). The band chart draws only in a frame
// where something it compares has changed, and a click of the count-in
// changes nothing else: the cursor is not yet moving. So each dot lit, and
// the other part's note lit, paints a frame of its own, and a new set
// clears both (WEB-SPEC, Toys 5, states 5 to 8).

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { HandLoop } from '@/features/lessons/kit/frame-loop.test-fixtures'
import { handLoop } from '@/features/lessons/kit/frame-loop.test-fixtures'
import { loadPage } from './page-dom.test-fixtures'
import type { SingFigure } from './sing-figure'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

/** The figure on screen with the lower voice's first set, its paints counted from before its first frame, settled. */
async function settledFigure(): Promise<
  HandLoop & { fig: SingFigure; painted: () => number }
> {
  const hand = await handLoop()
  const { mountSingFigure } = await import('./sing-figure')
  const { setParts } = await import('./sing-plan')
  loadPage()
  const canvas = document.querySelector<HTMLCanvasElement>('#singChart canvas')
  if (canvas === null) throw new Error('no canvas')
  const painted = hand.paints(canvas)
  const fig = mountSingFigure()
  const { mine, other } = setParts('lower', 'part')
  fig.set(mine, other, 'Your part as five bands')
  hand.see(canvas)
  hand.settle()
  return { ...hand, fig, painted }
}

describe('what the figure paints over the chart', () => {
  it('paints a frame for each click of the count-in, though nothing else moves', async () => {
    // Arrange
    const { fig, settle, painted } = await settledFigure()
    const first = painted()

    // Act: the four clicks, each in a frame of its own
    const after = [1, 2, 3, 4].map((n) => {
      fig.count(n)
      settle()
      return painted()
    })

    // Assert
    expect(first).toBe(1)
    expect(after).toEqual([2, 3, 4, 5])
  })

  it('paints a frame when the other part’s note is lit or let go, the cursor standing still', async () => {
    // Arrange
    const { fig, settle, painted } = await settledFigure()
    fig.cursor(1.5)
    settle()
    const before = painted()

    // Act
    fig.other(1)
    settle()
    const lit = painted()
    fig.other(null)
    settle()

    // Assert
    expect(lit).toBe(before + 1)
    expect(painted()).toBe(before + 2)
  })

  it('clears the dots and the lit note with a new set', async () => {
    // Arrange
    const { fig } = await settledFigure()
    const { setParts } = await import('./sing-plan')
    fig.count(4)
    fig.other(2)

    // Act
    const { mine, other } = setParts('lower', 'swap')
    fig.set(mine, other, 'The tune as five bands')

    // Assert
    expect(fig.chart.scene.over).toBeUndefined()
  })
})
