// Subdivide's lanes: each hit lands on its drum's lane as it sounds, at
// one spacing whatever the metre and with no bar lines; the reveal drops
// the bar lines in, lights beat one and groups the bar.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import type { MetrePattern } from '@/lib/ear/metre'
import { patternOf } from '@/lib/ear/metre'
import { LitLanes } from './LitLanes'

afterEach(cleanup)

function pattern(id: string): MetrePattern {
  const found = patternOf(id)
  if (!found) throw new Error(id)
  return found
}

const hit = (n: number): Element | null =>
  document.querySelector(`[data-hit="${n}"]`)

/** Where hit `n` stands across the lanes, read off its orb. */
const hitX = (n: number): string =>
  /translate\(([\d.]+) /u.exec(
    hit(n)?.querySelector('g')?.getAttribute('transform') ?? '',
  )?.[1] ?? ''

describe("Subdivide's lanes", () => {
  it('lands each hit on its lane as it sounds, two bars and no bar lines', () => {
    const [lit, setLit] = createSignal(0)
    render(() => (
      <LitLanes
        steps={7}
        lit={lit()}
        reveal={null}
        pattern={pattern('metre:7-8:a')}
      />
    ))
    setLit(1)
    setLit(2)
    setLit(3)
    expect(document.querySelectorAll('[data-hit]')).toHaveLength(14)
    expect(
      [...document.querySelectorAll('[data-hit][data-sounded]')].map((h) =>
        h.getAttribute('data-lane'),
      ),
    ).toEqual(['kick', 'hat', 'snare'])
    expect(document.querySelector('[data-part="bar-line"]')).toBeNull()
    expect(document.querySelector('[data-one]')).toBeNull()
  })

  it('runs on into the second bar without starting again', () => {
    const [lit, setLit] = createSignal(0)
    render(() => (
      <LitLanes
        steps={3}
        lit={lit()}
        reveal={null}
        pattern={pattern('metre:3-4:a')}
      />
    ))
    for (const n of [1, 2, 3, 1]) setLit(n)
    expect(
      [...document.querySelectorAll('[data-hit][data-sounded]')].map((h) =>
        h.getAttribute('data-hit'),
      ),
    ).toEqual(['1', '2', '3', '4'])
  })

  it('spaces the steps alike whatever the metre, so the spacing tells nothing', () => {
    const { unmount } = render(() => (
      <LitLanes
        steps={3}
        lit={0}
        reveal={null}
        pattern={pattern('metre:3-4:a')}
      />
    ))
    const waltz = hitX(2)
    expect(waltz).toBe('95.4')
    unmount()
    render(() => (
      <LitLanes
        steps={7}
        lit={0}
        reveal={null}
        pattern={pattern('metre:7-8:a')}
      />
    ))
    expect(hitX(2)).toBe(waltz)
  })

  it('drops the bar lines in at the reveal, lights beat one and groups the bar', () => {
    render(() => (
      <LitLanes
        steps={7}
        lit={0}
        reveal={{ name: '7/8' }}
        pattern={pattern('metre:7-8:a')}
      />
    ))
    expect(document.querySelectorAll('[data-part="bar-line"]')).toHaveLength(3)
    expect(
      [...document.querySelectorAll('[data-one]')].map((h) =>
        h.getAttribute('data-hit'),
      ),
    ).toEqual(['1', '8'])
    expect(
      document.querySelector('[data-part="metre-name"]')?.textContent,
    ).toBe('7/8')
    expect(
      [...document.querySelectorAll('[data-part="grouping"]')].map(
        (group) => group.textContent,
      ),
    ).toEqual(['2', '2', '3', '2', '2', '3'])
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'The kit on three lanes: 7/8, two bars of 2 + 2 + 3',
    )
  })
})
