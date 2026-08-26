import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { MascotStage } from './MascotStage'

/** Every image the stage drew, in DOM order. */
function sources(container: HTMLElement): string[] {
  return [...container.querySelectorAll('img')].map(
    (element) => element.getAttribute('src') ?? '',
  )
}

describe('mascot stage', () => {
  it('draws the state art for a plain state', () => {
    const { container } = render(() => <MascotStage state="rest" />)

    expect(sources(container)).toEqual([
      expect.stringMatching(/corky-rest/u) as unknown as string,
    ])
  })

  it('captions the moment so the beat reads without audio', () => {
    render(() => <MascotStage moment="turn.b-side" />)

    expect(screen.getByText('Turn toward Side B')).toBeTruthy()
  })

  it('composites the pull cue over the notice art', () => {
    // The character render deliberately has no cue in it, so this is the only
    // thing that puts one on screen -- and it must be the pull's own.
    const { container } = render(() => (
      <MascotStage moment="cue.open" pullId="snacking" />
    ))
    const drawn = sources(container)

    expect(drawn.some((src) => /corky-notice/u.test(src))).toBe(true)
    expect(drawn.some((src) => /notice-cue-snacking/u.test(src))).toBe(true)
    expect(drawn.some((src) => /notice-cue-generic/u.test(src))).toBe(false)
  })

  it('falls back to the plain cue for a pull with no creature', () => {
    const { container } = render(() => (
      <MascotStage moment="cue.open" pullId="custom" />
    ))

    expect(
      sources(container).some((src) => /notice-cue-generic/u.test(src)),
    ).toBe(true)
  })

  it('shows exactly one cue, never two', () => {
    // Baking the cue into the notice render *and* overlaying an entity was the
    // first attempt, and it put two cues on screen.
    const { container } = render(() => (
      <MascotStage moment="cue.open" pullId="scrolling" />
    ))

    expect(
      sources(container).filter((src) => /notice-cue/u.test(src)),
    ).toHaveLength(1)
  })

  it('draws no cue at a beat that is not about one', () => {
    const { container } = render(() => <MascotStage moment="turn.a-side" />)

    expect(sources(container).some((src) => /notice-cue/u.test(src))).toBe(
      false,
    )
  })

  it('describes the character but not the cue, so it is read once', () => {
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
