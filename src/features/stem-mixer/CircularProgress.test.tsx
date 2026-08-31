// ============================================================
// CircularProgress unit tests
// ============================================================

import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { CircularProgress } from './CircularProgress'

describe('CircularProgress', () => {
  it('renders SVG with default size and computes correct offset', () => {
    createRoot((dispose) => {
      const el = CircularProgress({ pct: 50 }) as SVGElement
      expect(el.getAttribute('width')).toBe('24')
      expect(el.getAttribute('height')).toBe('24')
      expect(el.classList.contains('circular-progress')).toBe(true)

      const circles = el.querySelectorAll('circle')
      expect(circles.length).toBe(2)
      // Radius = (24 - 4) / 2 = 10
      // Circ = 2 * PI * 10 = 20 * PI (~62.83)
      // 50% offset = 10 * PI (~31.41)
      expect(circles[0].getAttribute('r')).toBe('10')
      expect(circles[1].getAttribute('stroke-dasharray')).toBe(
        String(20 * Math.PI),
      )
      expect(circles[1].getAttribute('stroke-dashoffset')).toBe(
        String(10 * Math.PI),
      )

      dispose()
    })
  })

  it('renders SVG with custom size', () => {
    createRoot((dispose) => {
      const el = CircularProgress({ pct: 100, size: 40 }) as SVGElement
      expect(el.getAttribute('width')).toBe('40')
      expect(el.getAttribute('height')).toBe('40')

      const circles = el.querySelectorAll('circle')
      // Radius = (40 - 4) / 2 = 18
      expect(circles[0].getAttribute('r')).toBe('18')
      // 100% offset = 0
      expect(circles[1].getAttribute('stroke-dashoffset')).toBe('0')

      dispose()
    })
  })
})
