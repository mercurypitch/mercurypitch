// ============================================================
// The bench instruments, by their geometry.
//
// Each one has a rule the eye must not break: the stylus never
// slopes before the reveal and never leaves the drum; the gear
// train's wheels never overlap for any chord in the bank; the
// lattice's chase steps on the grid and only the reveal pushes a
// pallet off it; the index arc's needle shows an angle only once
// the interval is told.
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { STACK_BANK } from '@/lib/ear/banks'
import { recordThresholdReading, resetEarLabStore, } from '@/stores/ear-lab-store'
import styles from './EarInstruments.module.css'
import { EscapementLattice } from './EscapementLattice'
import { GearTrain } from './GearTrain'
import { IndexArc } from './IndexArc'
import { instrumentReading, INSTRUMENTS } from './instruments'
import { StylusTrace } from './StylusTrace'

afterEach(cleanup)

const num = (el: Element | null | undefined, attr: string): number =>
  Number(el?.getAttribute(attr))

const svgOf = (container: HTMLElement): SVGSVGElement => {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('no instrument rendered')
  return svg
}

/** Attribute-space bounds of a pen part: rail, carriage, nib, tip. */
function partBounds(svg: SVGSVGElement, part: string) {
  const el = svg.querySelector(`[data-part="${part}"]`)
  if (!el) throw new Error(`no ${part}`)
  switch (el.tagName) {
    case 'line':
      return {
        left: Math.min(num(el, 'x1'), num(el, 'x2')),
        right: Math.max(num(el, 'x1'), num(el, 'x2')),
        top: Math.min(num(el, 'y1'), num(el, 'y2')),
        bottom: Math.max(num(el, 'y1'), num(el, 'y2')),
      }
    case 'circle':
      return {
        left: num(el, 'cx') - num(el, 'r'),
        right: num(el, 'cx') + num(el, 'r'),
        top: num(el, 'cy') - num(el, 'r'),
        bottom: num(el, 'cy') + num(el, 'r'),
      }
    default:
      return {
        left: num(el, 'x'),
        right: num(el, 'x') + num(el, 'width'),
        top: num(el, 'y'),
        bottom: num(el, 'y') + num(el, 'height'),
      }
  }
}

function expectPenInsideDrum(svg: SVGSVGElement): void {
  const drum = partBounds(svg, 'drum')
  for (const part of ['rail', 'carriage', 'nib', 'tip']) {
    const box = partBounds(svg, part)
    expect(box.left, `${part} left`).toBeGreaterThanOrEqual(drum.left)
    expect(box.right, `${part} right`).toBeLessThanOrEqual(drum.right)
    expect(box.top, `${part} top`).toBeGreaterThanOrEqual(drum.top)
    expect(box.bottom, `${part} bottom`).toBeLessThanOrEqual(drum.bottom)
  }
}

const nibOf = (svg: SVGSVGElement) => {
  const nib = svg.querySelector('[data-part="nib"]')
  if (!nib) throw new Error('no nib')
  return {
    tipX: num(nib, 'data-tip-x'),
    tipY: num(nib, 'data-tip-y'),
    x: num(nib, 'x'),
    height: num(nib, 'height'),
  }
}

describe('StylusTrace', () => {
  it('rests the pen at the start of the drum before anything sounds', () => {
    const { container } = render(() => (
      <StylusTrace sounding={0} armed={false} reveal={null} />
    ))
    const svg = svgOf(container)
    expect(svg.getAttribute('aria-label')).toContain('not yet drawn')
    expect(nibOf(svg)).toMatchObject({ tipX: 120, tipY: 130 })
    expect(svg.querySelector(`.${styles.trace}`)).toBeNull()
    expectPenInsideDrum(svg)
  })

  it('draws the first tone level and waits at its end, straight down, while the answer is open', () => {
    for (const state of [
      { sounding: 1 as const, armed: false },
      { sounding: 0 as const, armed: true },
    ]) {
      const { container, unmount } = render(() => (
        <StylusTrace
          sounding={state.sounding}
          armed={state.armed}
          reveal={null}
        />
      ))
      const svg = svgOf(container)
      const segment = svg.querySelector(`.${styles.trace}`)
      expect(segment?.getAttribute('x1')).toBe('120')
      expect(segment?.getAttribute('x2')).toBe('250')
      expect(segment?.getAttribute('y1')).toBe(segment?.getAttribute('y2'))
      const nib = nibOf(svg)
      expect(nib).toMatchObject({ tipX: 250, tipY: 130 })
      // The nib is vertical: its x is the tip's x, its height reaches the paper.
      expect(nib.x + 1.1).toBeCloseTo(250)
      expect(nib.height).toBe(130 - 64)
      expect(svg.querySelector(`.${styles.traceTrue}`)).toBeNull()
      expectPenInsideDrum(svg)
      unmount()
    }
  })

  it('reveals the direction as the second segment and moves the pen to its end', () => {
    const cases = [
      { direction: 'up' as const, y: 80, word: 'Up' },
      { direction: 'down' as const, y: 180, word: 'Down' },
      { direction: 'same' as const, y: 130, word: 'The same' },
    ]
    for (const { direction, y, word } of cases) {
      const { container, unmount } = render(() => (
        <StylusTrace
          sounding={0}
          armed={false}
          reveal={{ direction, wrong: null }}
        />
      ))
      const svg = svgOf(container)
      const truth = svg.querySelector(`.${styles.traceTrue}`)
      expect(truth?.getAttribute('x2')).toBe('380')
      expect(truth?.getAttribute('y2')).toBe(String(y))
      expect(nibOf(svg)).toMatchObject({ tipX: 380, tipY: y })
      expect(nibOf(svg).height).toBeGreaterThan(0)
      expect(svg.querySelector(`.${styles.traceGhost}`)).toBeNull()
      expect(svg.textContent).toContain(word)
      expect(svg.getAttribute('aria-label')).toContain('went')
      expectPenInsideDrum(svg)
      unmount()
    }
  })

  it('ghosts a wrong pick beside the truth', () => {
    const { container } = render(() => (
      <StylusTrace
        sounding={0}
        armed={false}
        reveal={{ direction: 'down', wrong: 'up' }}
      />
    ))
    const svg = svgOf(container)
    const ghost = svg.querySelector(`.${styles.traceGhost}`)
    expect(ghost?.getAttribute('y2')).toBe('80')
    expect(svg.querySelector(`.${styles.traceTrue}`)?.getAttribute('y2')).toBe(
      '180',
    )
  })
})

describe('GearTrain', () => {
  const wheels = (svg: SVGSVGElement) =>
    [...svg.querySelectorAll(`circle.${styles.teeth}`)].map((c) => ({
      x: num(c, 'cx'),
      y: num(c, 'cy'),
      r: num(c, 'r'),
    }))

  it('turns four ghost wheels at even spacing while the chord sounds', () => {
    const { container } = render(() => (
      <GearTrain sounding={true} reveal={null} />
    ))
    const svg = svgOf(container)
    const ghosts = wheels(svg)
    expect(ghosts).toHaveLength(4)
    expect(ghosts.map((w) => w.y)).toEqual([236, 176, 116, 56])
    expect(svg.querySelectorAll(`.${styles.captionBrass}`)).toHaveLength(0)
    expect(svg.getAttribute('aria-label')).toContain('turning')
  })

  it('sets the true wheels at their intervals, meshing side by side, with captions and the nameplate', () => {
    const { container } = render(() => (
      <GearTrain
        sounding={false}
        reveal={{ intervals: [5, 7], name: 'Suspended 4th' }}
      />
    ))
    const svg = svgOf(container)
    const set = wheels(svg)
    expect(set.map((w) => [w.x, w.y])).toEqual([
      [134, 236],
      [206, 161],
      [134, 131],
    ])
    expect(
      [...svg.querySelectorAll(`.${styles.captionBrass}`)].map(
        (t) => t.textContent,
      ),
    ).toEqual(['root', '+5', '+7'])
    expect(svg.textContent).toContain('Suspended 4th')
    expect(svg.getAttribute('aria-label')).toBe(
      'Gear train of 3 wheels: Suspended 4th',
    )
  })

  it('never overlaps two wheels for any chord in the bank', () => {
    for (const item of STACK_BANK) {
      const { container, unmount } = render(() => (
        <GearTrain
          sounding={false}
          reveal={{ intervals: item.payload, name: item.name }}
        />
      ))
      const set = wheels(svgOf(container))
      for (let a = 0; a < set.length; a++) {
        for (let b = a + 1; b < set.length; b++) {
          const gap = Math.hypot(set[a].x - set[b].x, set[a].y - set[b].y)
          expect(
            gap,
            `${item.name}: wheels ${a} and ${b}`,
          ).toBeGreaterThanOrEqual(set[a].r + set[b].r)
        }
      }
      unmount()
    }
  })
})

describe('EscapementLattice', () => {
  const pallets = (svg: SVGSVGElement) => [
    ...svg.querySelectorAll(`rect.${styles.pallet}`),
  ]

  it('shows six pallets on the grid and no chase at rest', () => {
    const { container } = render(() => (
      <EscapementLattice lit={0} running={false} reveal={null} />
    ))
    const svg = svgOf(container)
    expect(pallets(svg)).toHaveLength(6)
    expect(
      pallets(svg).filter((p) => p.classList.contains(styles.palletLit)),
    ).toHaveLength(0)
    expect(
      svg.querySelector(`.${styles.chase}`)?.classList.contains(styles.chaseOn),
    ).toBe(false)
    expect(svg.getAttribute('aria-label')).toContain('one of the last four')
  })

  it('steps the chase light on the grid, lighting only the pallet sounding now', () => {
    const { container } = render(() => (
      <EscapementLattice lit={3} running={true} reveal={null} />
    ))
    const svg = svgOf(container)
    const lit = pallets(svg).map((p) => p.classList.contains(styles.palletLit))
    expect(lit).toEqual([false, false, true, false, false, false])
    const chase = svg.querySelector(`.${styles.chase}`)
    expect(chase?.classList.contains(styles.chaseOn)).toBe(true)
    // Centred under the third pallet: palletX(2) = 212, half-width 32.
    expect(chase?.getAttribute('x')).toBe('180')
    expect(
      pallets(svg).some((p) => p.classList.contains(styles.palletOff)),
    ).toBe(false)
  })

  it('pushes only the displaced pallet off the grid at the reveal, the way it was off', () => {
    const { container } = render(() => (
      <EscapementLattice
        lit={0}
        running={false}
        reveal={{ index: 4, early: true }}
      />
    ))
    const svg = svgOf(container)
    const off = pallets(svg).map((p) => p.classList.contains(styles.palletOff))
    expect(off).toEqual([false, false, false, false, true, false])
    expect(pallets(svg)[4].classList.contains(styles.palletEarly)).toBe(true)
    expect(pallets(svg)[4].classList.contains(styles.palletLate)).toBe(false)
    const captions = [...svg.querySelectorAll(`text.${styles.caption}`)]
    expect(
      captions
        .find((t) => t.textContent === '5')
        ?.classList.contains(styles.captionGarnet),
    ).toBe(true)
    expect(svg.getAttribute('aria-label')).toContain('the fifth is early')
  })
})

describe('IndexArc', () => {
  const needle = (svg: SVGSVGElement) =>
    [...svg.querySelectorAll(`line.${styles.needle}`)].find(
      (n) => !n.classList.contains(styles.needleGhost),
    )

  it('marks twelve divisions and lights the root index with the first note', () => {
    const { container } = render(() => (
      <IndexArc sounding={1} hunting={false} reveal={null} />
    ))
    const svg = svgOf(container)
    const captions = [...svg.querySelectorAll(`text.${styles.caption}`)].map(
      (t) => t.textContent,
    )
    expect(captions).toEqual(Array.from({ length: 13 }, (_, k) => String(k)))
    expect(
      svg
        .querySelector(`.${styles.rootIndex}`)
        ?.classList.contains(styles.rootIndexLit),
    ).toBe(true)
    expect(needle(svg)?.classList.contains(styles.needleIdle)).toBe(true)
    expect(needle(svg)?.getAttribute('style') ?? '').not.toContain('rotate')
  })

  it('hunts without settling while the answer is open', () => {
    const { container } = render(() => (
      <IndexArc sounding={0} hunting={true} reveal={null} />
    ))
    const svg = svgOf(container)
    expect(needle(svg)?.classList.contains(styles.needleHunting)).toBe(true)
    expect(needle(svg)?.getAttribute('style') ?? '').not.toContain('rotate')
    expect(svg.getAttribute('aria-label')).toContain('hunting')
  })

  it('sweeps to the true interval at the reveal and ghosts a wrong pick', () => {
    const { container } = render(() => (
      <IndexArc
        sounding={0}
        hunting={false}
        reveal={{ semitones: 7, name: 'Perfect 5th', wrongSemitones: 6 }}
      />
    ))
    const svg = svgOf(container)
    expect(needle(svg)?.getAttribute('style')).toContain('rotate(105deg)')
    expect(
      svg.querySelector(`.${styles.needleGhost}`)?.getAttribute('style'),
    ).toContain('rotate(90deg)')
    expect(svg.textContent).toContain('Perfect 5th')
    expect(svg.getAttribute('aria-label')).toBe(
      'Index arc swept 7 semitones from the root: Perfect 5th',
    )
  })
})

describe('instrumentReading', () => {
  afterEach(() => {
    resetEarLabStore()
  })

  const byView = (view: string) => {
    const found = INSTRUMENTS.find((instrument) => instrument.view === view)
    if (!found) throw new Error(`no instrument for view ${view}`)
    return found
  }

  it('reads each threshold tile from its own drill, not the desk', () => {
    resetEarLabStore()
    for (const view of ['hairline', 'grid', 'span'] as const) {
      const instrument = byView(view)
      expect(instrument.drillId).toBeTruthy()
      expect(instrumentReading(instrument)).toBeNull()
      recordThresholdReading({
        drillId: instrument.drillId ?? '',
        value: 9,
        spread: 1,
        tracks: 1,
        source: 'practice',
      })
      // Instruments differ in decimals; the number is what must match.
      expect(Number(instrumentReading(instrument)?.value)).toBe(9)
    }
    // A desk run must not light the catalogue tiles, and vice versa.
    resetEarLabStore()
    recordThresholdReading({
      drillId: 'desk-colour',
      value: 3,
      spread: 1,
      tracks: 1,
      source: 'practice',
    })
    expect(Number(instrumentReading(byView('desk'))?.value)).toBe(3)
    expect(instrumentReading(byView('hairline'))).toBeNull()
  })

  it('shows a shortened run as still settling', () => {
    resetEarLabStore()
    recordThresholdReading({
      drillId: 'hairline',
      value: 9,
      spread: 2,
      tracks: 1,
      source: 'practice',
      provisional: true,
    })
    expect(instrumentReading(byView('hairline'))?.settling).toBe(true)
  })
})
