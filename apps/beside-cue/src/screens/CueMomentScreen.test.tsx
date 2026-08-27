import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { CueMomentScreen } from './CueMomentScreen'

function sources(container: HTMLElement): string[] {
  return [...container.querySelectorAll('img')].map(
    (element) => element.getAttribute('src') ?? '',
  )
}

function noop(): void {}

const base = {
  pullText: 'Scrolling in bed',
  bSideText: 'Read one page',
  phrase: 'A small turn is still a turn.',
  onChooseBSide: noop,
  onNotNow: noop,
  onClose: noop,
}

describe('cue moment screen', () => {
  it('uses current Corky with the pull-specific creature, not the generic token', () => {
    // The notice render deliberately carries no cue, and MascotStage only draws
    // one when it is told which pull the beat is about. This screen is the only
    // place in the app that knows, so if it stops passing the id the seven
    // registered overlays go quietly unused and every cue looks the same.
    const { container } = render(() => (
      <CueMomentScreen {...base} pullId="snacking" />
    ))

    expect(sources(container)).toEqual([
      expect.stringMatching(/corky-home-rest-v0_23/u) as unknown as string,
      expect.stringMatching(/notice-cue-snacking/u) as unknown as string,
    ])
  })

  it('falls back to the canon cue when the pull is self-named', () => {
    const { container } = render(() => <CueMomentScreen {...base} />)

    expect(sources(container)).toEqual([
      expect.stringMatching(/corky-home-rest-v0_23/u) as unknown as string,
      expect.stringMatching(/notice-cue-generic/u) as unknown as string,
    ])
  })
})
