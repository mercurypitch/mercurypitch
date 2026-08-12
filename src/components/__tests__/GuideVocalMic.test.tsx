import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { GuideVocalMic } from '@/components/mobile/GuideVocalMic'

/**
 * The colour mapping here is the inverse of the singer's input mic, where red
 * means "live and capturing". On a vocal STEM red means muted, because there
 * is nothing to be live about — it is a recording. That inversion is the sort
 * of thing a later reader corrects on sight, so it is pinned.
 */
describe('GuideVocalMic', () => {
  const micOf = (el: HTMLElement): HTMLImageElement => {
    const img = el.querySelector('img')
    if (img === null) throw new Error('no mic image rendered')
    return img
  }

  it('shows the violet mic while the guide vocal is audible', () => {
    const { container } = render(() => <GuideVocalMic muted={false} />)

    expect(micOf(container).getAttribute('src')).toBe(
      '/mic/guide-vocal-on.webp',
    )
  })

  it('shows the red mic when the guide vocal is muted', () => {
    const { container } = render(() => <GuideVocalMic muted />)

    expect(micOf(container).getAttribute('src')).toBe(
      '/mic/guide-vocal-off.webp',
    )
  })

  it('leaves the state to the hosting pill rather than announcing it twice', () => {
    const { container } = render(() => <GuideVocalMic muted />)
    const mic = micOf(container)

    // PillControl already carries aria-pressed and a stateful aria-label.
    expect(mic.getAttribute('aria-hidden')).toBe('true')
    expect(mic.getAttribute('alt')).toBe('')
  })

  it('renders bigger than a line glyph by default, and takes an override', () => {
    const { container: dflt } = render(() => <GuideVocalMic muted={false} />)
    // A lit 3D object stops reading around 22px where an outline still does,
    // so the default is deliberately above the 17px icon default.
    expect(Number(micOf(dflt).getAttribute('width'))).toBeGreaterThanOrEqual(28)

    const { container: small } = render(() => (
      <GuideVocalMic muted={false} size={24} />
    ))
    expect(micOf(small).getAttribute('width')).toBe('24')
    expect(micOf(small).getAttribute('height')).toBe('24')
  })
})
