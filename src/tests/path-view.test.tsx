import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ASCENT_WEEKS, DAYS_PER_WEEK } from '@/features/path/path-content'
import { resetAscent, setPathFreeRoam, startAscent, } from '@/features/path/path-progress'
import { buildPathDayNodes, DEFAULT_PATH_VIEW, PATH_VIEW_STORAGE_KEY, pathView, setPathView, } from '@/features/path/path-view'
import { PlainPathView } from '@/features/path/PlainPathView'

beforeEach(() => {
  localStorage.clear()
  resetAscent()
  setPathFreeRoam(false)
  setPathView('ascent')
})

afterEach(cleanup)

describe('Path view preference', () => {
  it('defaults first-time users to Ascent and persists later choices', () => {
    expect(DEFAULT_PATH_VIEW).toBe('ascent')
    expect(pathView()).toBe('ascent')

    setPathView('path')
    expect(pathView()).toBe('path')
    expect(localStorage.getItem(PATH_VIEW_STORAGE_KEY)).toBe('path')
  })
})

describe('plain Path day controls', () => {
  it('always derives seven controls per week and 49 in total', () => {
    const nodes = ASCENT_WEEKS.flatMap(() => buildPathDayNodes('locked', 0))
    expect(nodes).toHaveLength(49)
    expect(nodes.every((node) => !node.actionable)).toBe(true)
  })

  it('opens completed and next-day controls while keeping later days locked', () => {
    const nodes = buildPathDayNodes('active', 3)

    expect(nodes.map((node) => node.state)).toEqual([
      'complete',
      'complete',
      'complete',
      'current',
      'locked',
      'locked',
      'locked',
    ])
    expect(nodes.filter((node) => node.actionable)).toHaveLength(4)
  })

  it('marks every day complete for a completed week', () => {
    const nodes = buildPathDayNodes('complete', DAYS_PER_WEEK)
    expect(nodes.every((node) => node.state === 'complete')).toBe(true)
    expect(nodes.every((node) => node.actionable)).toBe(true)
  })

  it('renders all 49 buttons with only the first day ready before starting', () => {
    const { container } = render(() => <PlainPathView />)
    const nodes = [
      ...container.querySelectorAll<HTMLButtonElement>('[data-path-day]'),
    ]

    expect(nodes).toHaveLength(49)
    expect(nodes.filter((node) => !node.disabled)).toHaveLength(1)
    expect(nodes[0]?.getAttribute('aria-label')).toContain('ready')
  })

  it('exposes the endowed day and next day after The Ascent begins', () => {
    startAscent()
    const { container } = render(() => <PlainPathView />)
    const weekOne = [
      ...container.querySelectorAll<HTMLButtonElement>('[data-path-day^="1-"]'),
    ]

    expect(weekOne).toHaveLength(DAYS_PER_WEEK)
    expect(weekOne.filter((node) => !node.disabled)).toHaveLength(2)
    expect(weekOne[0]?.getAttribute('aria-label')).toContain('completed')
    expect(weekOne[1]?.getAttribute('aria-current')).toBe('step')
  })
})
