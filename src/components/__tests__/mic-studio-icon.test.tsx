import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { MicStudio, MicStudioOff } from '../icons'

/**
 * The studio mic is the first icon in the set to use `defs` — a gradient and a
 * mask, both referenced by id. Ids are document-global, so two instances on one
 * page (the karaoke transport and the mic-monitor row are exactly that) would
 * otherwise fight over them and the second render would repaint the first.
 */
function gradientIds(root: HTMLElement): string[] {
  return [...root.querySelectorAll('linearGradient, mask')].map(
    (n) => n.getAttribute('id') ?? '',
  )
}

describe('MicStudio', () => {
  it('gives every instance its own gradient id', () => {
    const { container } = render(() => (
      <>
        <MicStudio />
        <MicStudio />
        <MicStudioOff />
      </>
    ))
    const ids = gradientIds(container)
    expect(ids.length).toBeGreaterThanOrEqual(3)
    expect(ids.every((id) => id !== '')).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('resolves every url(#…) reference inside its own svg', () => {
    const { container } = render(() => (
      <>
        <MicStudio />
        <MicStudioOff />
      </>
    ))
    for (const svg of container.querySelectorAll('svg')) {
      const refs = [...svg.querySelectorAll('[fill], [mask]')]
        .flatMap((n) => [n.getAttribute('fill'), n.getAttribute('mask')])
        .filter((v): v is string => v !== null && v.startsWith('url(#'))
      expect(refs.length).toBeGreaterThan(0)
      for (const ref of refs) {
        const id = ref.slice(5, -1)
        expect(svg.querySelector(`#${id}`)).not.toBeNull()
      }
    }
  })

  it('honours the size prop and inherits the button colour', () => {
    const { container } = render(() => <MicStudio size={18} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('18')
    expect(svg.getAttribute('height')).toBe('18')
    // The mic sits on buttons that recolour for active / muted / error, so the
    // glyph must never hard-code its own hue.
    expect(svg.getAttribute('fill')).toBe('currentColor')
  })

  it('is hidden from assistive tech — the button carries the label', () => {
    const { container } = render(() => (
      <>
        <MicStudio />
        <MicStudioOff />
      </>
    ))
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true')
    }
  })
})
