// ============================================================
// Record artwork — generated noise stays inside the disc
// ============================================================
// A paper-grain effect built from feTurbulence paints across the whole
// filter region, not the shape the filter is attached to. Without a
// composite back to SourceGraphic the grain lands as a translucent
// RECTANGLE, which on pale paper reads as a grey box hanging in the air
// behind the record. The marketing landing shipped exactly that on
// 2026-09-10, copied from this artwork; these two records are the
// original and carry no such filter. This is the tripwire that keeps the
// defect from arriving here the next time the two are synced.

import { render } from '@solidjs/testing-library'
import { Show } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { HomePressing } from './HomePressing'
import { PunchedTimeDial } from './PunchedTimeDial'

// Local names, not CSS type selectors: SVG filter primitives are
// camelCase and selector case-folding in an HTML document is not
// something to bet a guard on.
function descendants(root: ParentNode, localName: string): readonly Element[] {
  return [...root.querySelectorAll('*')].filter(
    (element) => element.localName === localName,
  )
}

/**
 * Ids of filters that generate noise and never clip it back to the shape
 * they are applied to. `feComposite operator="in"` against SourceGraphic
 * is the node that does the clipping.
 */
function unclippedNoiseFilters(root: ParentNode): readonly string[] {
  return descendants(root, 'filter')
    .filter((filter) => descendants(filter, 'feTurbulence').length > 0)
    .filter(
      (filter) =>
        !descendants(filter, 'feComposite').some(
          (node) =>
            node.getAttribute('in2') === 'SourceGraphic' &&
            node.getAttribute('operator') === 'in',
        ),
    )
    .map((filter) => filter.getAttribute('id') ?? '(unnamed filter)')
}

function GrainedDisc(props: { readonly clipped: boolean }) {
  return (
    <svg viewBox="0 0 400 400">
      <defs>
        <filter id="paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
          <Show when={props.clipped}>
            <feComposite in2="SourceGraphic" operator="in" />
          </Show>
        </filter>
      </defs>
      <circle
        cx="200"
        cy="200"
        r="192"
        filter="url(#paper-grain)"
        opacity="0.16"
      />
    </svg>
  )
}

describe('Record artwork noise filters', () => {
  // Without this pair the guard below could pass by never looking at
  // anything. These are the two constructions it has to tell apart.
  it('recognises noise that escapes its shape, and noise that does not', () => {
    const broken = render(() => <GrainedDisc clipped={false} />)
    expect(unclippedNoiseFilters(broken.container)).toEqual(['paper-grain'])

    const clipped = render(() => <GrainedDisc clipped={true} />)
    expect(unclippedNoiseFilters(clipped.container)).toEqual([])
  })

  it('leaves no unclipped noise filter in the home pressing', () => {
    const { container } = render(() => (
      <HomePressing sideA="Side A plan" sideB="Side B plan" paused={false} />
    ))
    expect(unclippedNoiseFilters(container)).toEqual([])
  })

  it('leaves no unclipped noise filter in the punched time dial', () => {
    const { container } = render(() => (
      <PunchedTimeDial value="07:30" onValueChange={() => {}} />
    ))
    expect(unclippedNoiseFilters(container)).toEqual([])
  })
})
