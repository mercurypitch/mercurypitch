// ============================================================
// Voice Mirror backdrop: which plate sits behind which screen
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import type { MirrorScreen } from './MirrorBackdrop'
import { MirrorBackdrop, plateFor } from './MirrorBackdrop'

afterEach(cleanup)

describe('MirrorBackdrop', () => {
  it("gives the start screens Merc's sky and steps back everywhere else", () => {
    const screens: MirrorScreen[] = ['landing', 'shared', 'flow', 'results']
    expect(screens.map((s) => plateFor(s))).toEqual([
      'sky',
      'sky-aside',
      'plain',
      'none',
    ])
  })

  it('paints no plate behind the results, where the card is the picture', () => {
    const { container } = render(() => <MirrorBackdrop plate="none" />)

    expect(container.querySelectorAll('.mirror-backdrop')).toHaveLength(1)
    expect(container.querySelectorAll('.mirror-plate')).toHaveLength(0)
  })

  it('names the plate it paints, for the stylesheet to pick the picture', () => {
    const { container } = render(() => <MirrorBackdrop plate="plain" />)

    expect(
      Array.from(container.querySelectorAll('.mirror-plate'), (el) =>
        el.getAttribute('data-plate'),
      ),
    ).toEqual(['plain'])
  })
})
