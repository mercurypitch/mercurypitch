import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { ModeLadder } from './ModeLadder'

const rungs = (container: HTMLElement): HTMLElement[] =>
  [...container.querySelectorAll('.mode-ladder__rung')] as HTMLElement[]

/** The `bottom: N%` a rung was placed at. */
const heightOf = (el: HTMLElement): number => Number.parseFloat(el.style.bottom)

describe('the mode ladder', () => {
  it('draws one rung per mode, lowest at the bottom', () => {
    const { container } = render(() => (
      <ModeLadder
        modes={[3, 4, 5]}
        fundamentalMidi={48}
        nearest={null}
        semisOff={0}
        onIt={false}
        charge={[0, 0, 0]}
      />
    ))
    const found = rungs(container)
    expect(found).toHaveLength(3)
    expect(heightOf(found[0]!)).toBe(0)
    expect(heightOf(found[2]!)).toBe(100)
  })

  // The whole reason the ladder is drawn to scale: the rungs get closer
  // as they climb, and an evenly spaced list would say the opposite.
  it('spaces the rungs in semitones, so the top ones bunch', () => {
    const { container } = render(() => (
      <ModeLadder
        modes={[3, 4, 5]}
        fundamentalMidi={48}
        nearest={null}
        semisOff={0}
        onIt={false}
        charge={[0, 0, 0]}
      />
    ))
    const [low, mid, high] = rungs(container)
    const lower = heightOf(mid!) - heightOf(low!)
    const upper = heightOf(high!) - heightOf(mid!)
    expect(upper).toBeLessThan(lower)
  })

  it('names each rung by the note it actually asks for', () => {
    const { container } = render(() => (
      <ModeLadder
        modes={[1, 2]}
        fundamentalMidi={48}
        nearest={null}
        semisOff={0}
        onIt={false}
        charge={[0, 0]}
      />
    ))
    const names = rungs(container).map(
      (r) => r.querySelector('span')!.textContent,
    )
    // Mode 1 is the fundamental; mode 2 is an octave above it.
    expect(names).toEqual(['C3', 'C4'])
  })

  it('lights the rung being sung, and says which way it is off', () => {
    const { container } = render(() => (
      <ModeLadder
        modes={[3, 4]}
        fundamentalMidi={48}
        nearest={4}
        semisOff={-0.9}
        onIt={false}
        charge={[0, 0]}
      />
    ))
    const [, upper] = rungs(container)
    expect(upper!.classList.contains('is-near')).toBe(true)
    expect(upper!.classList.contains('is-on')).toBe(false)
    expect(upper!.querySelector('b')!.textContent).toBe('flat')
  })

  it('drops the correction once the note is close enough to matter', () => {
    const { container } = render(() => (
      <ModeLadder
        modes={[3, 4]}
        fundamentalMidi={48}
        nearest={4}
        semisOff={0.1}
        onIt
        charge={[0, 0]}
      />
    ))
    const [, upper] = rungs(container)
    expect(upper!.classList.contains('is-on')).toBe(true)
    expect(upper!.querySelector('b')).toBeNull()
  })

  it('shows the charge on the pane that mode opens', () => {
    const { container } = render(() => (
      <ModeLadder
        modes={[3, 4]}
        fundamentalMidi={48}
        nearest={3}
        semisOff={0}
        onIt
        charge={[0.4, 0]}
      />
    ))
    expect(rungs(container)[0]!.querySelector('i')!.style.width).toBe('40%')
  })

  it('survives a single-mode room without dividing by nothing', () => {
    const { container } = render(() => (
      <ModeLadder
        modes={[3]}
        fundamentalMidi={48}
        nearest={3}
        semisOff={0}
        onIt
        charge={[0]}
      />
    ))
    expect(heightOf(rungs(container)[0]!)).toBe(0)
  })
})
