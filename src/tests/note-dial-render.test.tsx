// The octave moved from a chip row beside the dial onto the rim itself.
// The geometry has its own tests; this covers the wiring that geometry
// cannot see — that the segments actually render, that the chip row
// stays away unless the rim cannot do the job, and that the octave is
// still reachable by something a screen reader can use, since an SVG
// path is nothing to one.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PITCH_CLASSES } from '@/components/note-dial-model'
import { NoteDial } from '@/components/NoteDial'

// The pulse tests below commit picks with the preview ON, which reaches
// for the audio engine; give them a silent one.
vi.mock('@/stores/app-store', () => ({
  initAudioEngine: async () => ({
    previewNote: async () => 1,
    stopNote: () => {},
  }),
}))

/** Every semitone across the given octaves, the way getNoteOptions does. */
const notesFor = (octaves: number[]): string[] =>
  octaves.flatMap((o) => PITCH_CLASSES.map((pc) => `${pc}${o}`))

const TENOR = notesFor([3, 4, 5])

describe('NoteDial — the octave on the rim', () => {
  afterEach(cleanup)

  it('draws one labelled segment per octave', () => {
    const { container } = render(() => (
      <NoteDial notes={TENOR} selected="A3" onChange={() => {}} />
    ))
    const labels = [...container.querySelectorAll('svg text')]
      .map((t) => t.textContent)
      .filter((t) => t === '3' || t === '4' || t === '5')
    expect(labels.sort()).toEqual(['3', '4', '5'])
  })

  it('leaves the chip row out — the rim already answers it', () => {
    const { queryByTestId } = render(() => (
      <NoteDial notes={TENOR} selected="A3" onChange={() => {}} />
    ))
    expect(queryByTestId('octave-chips')).toBeNull()
  })

  it('keeps the octave reachable without the SVG', () => {
    // The segments are aria-hidden decoration; this is the real control.
    const { container } = render(() => (
      <NoteDial notes={TENOR} selected="A4" onChange={() => {}} />
    ))
    const radios = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ]
    expect(radios).toHaveLength(3)
    expect(radios.filter((r) => r.checked)).toHaveLength(1)
  })

  it('changes octave and keeps the pitch class', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <NoteDial
        notes={TENOR}
        selected="A3"
        onChange={onChange}
        previewSound={false}
      />
    ))
    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    )
    radios[2].click()
    expect(onChange).toHaveBeenCalledWith('A5')
  })

  it('falls back to chips when there are more octaves than the rim can label', () => {
    const wide = notesFor([1, 2, 3, 4, 5, 6, 7])
    const { getByTestId, container } = render(() => (
      <NoteDial notes={wide} selected="A3" onChange={() => {}} />
    ))
    expect(getByTestId('octave-chips').querySelectorAll('button')).toHaveLength(
      7,
    )
    // And no segment labels, since there are no segments.
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(0)
  })

  it('draws no segments for a single-octave range', () => {
    const { container, queryByTestId } = render(() => (
      <NoteDial
        notes={PITCH_CLASSES.map((pc) => `${pc}4`)}
        selected="A4"
        onChange={() => {}}
      />
    ))
    // Nothing to divide, and nothing to offer: no arcs, no chips.
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(0)
    expect(queryByTestId('octave-chips')).toBeNull()
  })

  it('still says where the note sits in the range', () => {
    const { container } = render(() => (
      <NoteDial notes={TENOR} selected="A3" onChange={() => {}} />
    ))
    expect(container.textContent).toContain('up your')
    expect(container.textContent).toContain('C3')
    expect(container.textContent).toContain('B5')
  })
})

describe('NoteDial — the preview made visible', () => {
  const pulseIn = (container: HTMLElement): Element | null =>
    container.querySelector('[data-testid="dial-preview-pulse"]')

  let nowMs = 0

  beforeEach(() => {
    vi.useFakeTimers()
    // Start the clock well past RETRIGGER_MS so a first pick is never held
    // by the preview throttle's trailing timer.
    nowMs = 100_000
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('pulses the picked seat while the tone plays, then clears', () => {
    const { container } = render(() => (
      <NoteDial notes={TENOR} selected="A3" onChange={() => {}} />
    ))
    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    )
    radios[2]!.click()
    expect(pulseIn(container)).not.toBeNull()
    vi.advanceTimersByTime(500)
    expect(pulseIn(container)).toBeNull()
  })

  it('stays quiet when the preview sound is off', () => {
    const { container } = render(() => (
      <NoteDial
        notes={TENOR}
        selected="A3"
        onChange={() => {}}
        previewSound={false}
      />
    ))
    container
      .querySelectorAll<HTMLInputElement>('input[type="radio"]')[2]!
      .click()
    expect(pulseIn(container)).toBeNull()
  })

  it('marks a sharp pulse with the sharp seat radius', () => {
    const { container } = render(() => (
      <NoteDial notes={TENOR} selected="A3" onChange={() => {}} />
    ))
    const face = container.querySelector('svg[role="group"]')!
    fireEvent.keyDown(face, { key: 'ArrowRight' }) // A3 → A#3
    const pulse = pulseIn(container)!
    expect(pulse.getAttribute('r')).toBe('11')
  })

  it('a second pick mid-pulse restarts the clock instead of stacking timers', () => {
    const { container } = render(() => (
      <NoteDial notes={TENOR} selected="A3" onChange={() => {}} />
    ))
    const face = container.querySelector('svg[role="group"]')!
    fireEvent.keyDown(face, { key: 'ArrowRight' })
    nowMs += 100 // past the throttle, inside the 500ms pulse
    vi.advanceTimersByTime(100)
    fireEvent.keyDown(face, { key: 'ArrowRight' })
    expect(pulseIn(container)).not.toBeNull()
    // The stale timer must not clear the SECOND pulse at the first's expiry.
    vi.advanceTimersByTime(450)
    expect(pulseIn(container)).not.toBeNull()
    vi.advanceTimersByTime(50)
    expect(pulseIn(container)).toBeNull()
  })

  it('shrugs off notes the seat map cannot place', () => {
    // The dial's own note lists are sharps-only, but the notes prop is
    // public: a flat spelling plays fine yet has no seat to pulse, and an
    // off-map class like E# must not crash the keyed render.
    for (const exotic of ['Db4', 'E#4']) {
      cleanup()
      const onChange = vi.fn()
      const { container } = render(() => (
        <NoteDial notes={['C4', exotic]} selected="C4" onChange={onChange} />
      ))
      const face = container.querySelector('svg[role="group"]')!
      fireEvent.keyDown(face, { key: 'ArrowRight' })
      expect(onChange).toHaveBeenCalledWith(exotic)
      expect(pulseIn(container)).toBeNull()
    }
  })
})
