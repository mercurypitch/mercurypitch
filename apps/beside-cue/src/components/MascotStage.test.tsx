import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { MascotStage } from './MascotStage'

/** Every image the stage drew, in DOM order. */
function sources(container: HTMLElement): string[] {
  return [...container.querySelectorAll('img')].map(
    (element) => element.getAttribute('src') ?? '',
  )
}

/**
 * The neutral mark a self-named Pull gets instead of a creature. It is
 * decorative and hidden from assistive technology, so there is no role or
 * accessible name to query it by.
 */
function customMark(container: HTMLElement): Element | null {
  return container.querySelector('.mascot-stage__pull--mark')
}

describe('mascot stage', () => {
  it('draws the state art for a plain state', () => {
    const { container } = render(() => <MascotStage state="rest" />)

    expect(sources(container)).toEqual([
      expect.stringMatching(/corky-rest/u) as unknown as string,
    ])
  })

  it('accepts surface-specific art without changing the named state', () => {
    const { container } = render(() => (
      <MascotStage
        state="quiet"
        artOverride={{
          still: '/art/corky/surface-specific-1024.webp',
          alt: 'Corky settled beside the current plan.',
        }}
      />
    ))

    expect(container.querySelector('figure')).toHaveAttribute(
      'data-state',
      'quiet',
    )
    expect(sources(container)).toEqual([
      expect.stringMatching(/surface-specific/u) as unknown as string,
    ])
  })

  it('captions the moment so the beat reads without audio', () => {
    render(() => <MascotStage moment="turn.b-side" />)

    expect(screen.getByText('Turn toward Side B')).toBeTruthy()
  })

  it('shows the plan’s Pull as its approved render beside the notice Corky', () => {
    // The notice render deliberately has no Pull in it, so this is the only
    // thing that puts one on screen -- and it must be the Pull's own render,
    // the same file the picker shows.
    const { container } = render(() => (
      <MascotStage moment="cue.open" pullId="snacking" />
    ))

    expect(sources(container)).toEqual([
      expect.stringMatching(/corky-notice/u) as unknown as string,
      expect.stringMatching(
        /[/]art[/]pulls[/]pull-sugarlump-nanobanana-v0_1-512[.]webp$/u,
      ) as unknown as string,
    ])
    expect(customMark(container)).toBeNull()
  })

  it('shows a premium Pull with the cutout its shelf in the picker shows', () => {
    const { container } = render(() => (
      <MascotStage moment="cue.open" pullId="the-thimble" />
    ))

    expect(sources(container)).toEqual([
      expect.stringMatching(/corky-notice/u) as unknown as string,
      expect.stringMatching(
        /[/]art[/]pulls[/]pull-the-thimble-nanobanana-v0_1-512[.]webp$/u,
      ) as unknown as string,
    ])
  })

  it('insets a premium cutout, which has no margin of its own, and no free render', () => {
    // A premium still is cropped to the silhouette; in the free cast's box it
    // stood a third taller and lost its head to the sleeve's top edge.
    const premium = render(() => (
      <MascotStage moment="cue.open" pullId="the-thimble" />
    ))
    const free = render(() => (
      <MascotStage moment="cue.open" pullId="scrolling" />
    ))

    expect(premium.container.querySelector('.mascot-stage__pull')).toHaveClass(
      'mascot-stage__pull--token',
    )
    expect(free.container.querySelector('.mascot-stage__pull')).not.toHaveClass(
      'mascot-stage__pull--token',
    )
  })

  it('draws the neutral mark, and no creature, for a self-named Pull', () => {
    // The person's own words must never be handed a face from the cast, and
    // the spot Corky is looking at must not read as a missing image either.
    const { container } = render(() => (
      <MascotStage moment="cue.open" pullId="custom" />
    ))

    expect(sources(container)).toEqual([
      expect.stringMatching(/corky-notice/u) as unknown as string,
    ])
    expect(customMark(container)).not.toBeNull()
  })

  it('draws the mark as a punched ring the sleeve shows through, not a disc', () => {
    // At two dozen pixels a filled gold disc read as a dot or a small sun. The
    // label is an annulus with a real hole, rimmed in ink like the record
    // icon, and it stays decorative.
    const { container } = render(() => (
      <MascotStage moment="cue.open" pullId="custom" />
    ))
    const mark = customMark(container)
    const circles = [...(mark?.querySelectorAll('circle') ?? [])]

    expect(mark).toHaveAttribute('aria-hidden', 'true')
    expect(circles.length).toBeGreaterThan(0)
    for (const circle of circles) {
      expect(circle).toHaveAttribute('fill', 'none')
    }
    expect(
      circles.some((circle) => circle.getAttribute('stroke') === '#efc13b'),
    ).toBe(true)
  })

  it('treats a notice beat with no pull id like a self-named Pull', () => {
    const { container } = render(() => <MascotStage state="notice" />)

    expect(sources(container)).toHaveLength(1)
    expect(customMark(container)).not.toBeNull()
  })

  it('shows exactly one Pull, never two', () => {
    // Baking the Pull into the notice render *and* overlaying one was the
    // first attempt, and it put two on screen.
    const { container } = render(() => (
      <MascotStage moment="cue.open" pullId="scrolling" />
    ))

    expect(
      sources(container).filter((src) => /[/]art[/]pulls[/]/u.test(src)),
    ).toHaveLength(1)
    expect(customMark(container)).toBeNull()
  })

  it('draws no Pull at a beat that is not about one', () => {
    const { container } = render(() => (
      <MascotStage moment="turn.a-side" pullId="snacking" />
    ))

    expect(sources(container)).toHaveLength(1)
    expect(customMark(container)).toBeNull()
  })

  it('describes the character but not the Pull, so it is read once', () => {
    const { container } = render(() => (
      <MascotStage moment="cue.open" pullId="snacking" />
    ))
    const described = [...container.querySelectorAll('img')].filter(
      (element) => (element.getAttribute('alt') ?? '') !== '',
    )

    expect(described).toHaveLength(1)
    expect(described[0]?.getAttribute('alt')).toMatch(/Corky/u)
  })
})
