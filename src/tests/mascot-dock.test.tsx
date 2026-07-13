import { cleanup, render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { MascotDock, nearestCorner } from '@/components/MascotDock'

describe('MascotDock', () => {
  afterEach(cleanup)

  it('maps a point to its viewport quadrant', () => {
    expect(nearestCorner(10, 10, 100, 100)).toBe('tl')
    expect(nearestCorner(90, 10, 100, 100)).toBe('tr')
    expect(nearestCorner(10, 90, 100, 100)).toBe('bl')
    expect(nearestCorner(90, 90, 100, 100)).toBe('br')
  })

  it('renders a draggable Merc button wrapping the svg', () => {
    const { getByRole, container } = render(() => <MascotDock state="idle" />)
    const dock = getByRole('button')
    expect(dock.getAttribute('aria-label')).toContain('Merc')
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
