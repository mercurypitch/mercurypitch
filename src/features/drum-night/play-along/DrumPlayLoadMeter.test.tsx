// @vitest-environment jsdom
import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import styles from '../DrumNightApp.module.css'
import { DrumPlayLoadMeter, drumPlayLoadPercent } from './DrumPlayLoadMeter'

describe('drumPlayLoadPercent', () => {
  it('has no number until the engine reports one', () => {
    expect(drumPlayLoadPercent(null)).toBeNull()
    expect(drumPlayLoadPercent(0)).toBeNull()
  })

  it('rounds to a whole percent and never says 100 before ready', () => {
    expect(drumPlayLoadPercent(0.424)).toBe(42)
    expect(drumPlayLoadPercent(0.999)).toBe(99)
    expect(drumPlayLoadPercent(1)).toBe(99)
  })
})

describe('DrumPlayLoadMeter', () => {
  it('turns without a number while the size is unknown', () => {
    const { getByTestId } = render(() => <DrumPlayLoadMeter fraction={null} />)
    expect(getByTestId('drum-play-load-ring').classList).toContain(
      styles.playLoadRingSpinning,
    )
    expect(getByTestId('drum-play-load-percent').textContent).toBe('')
  })

  it('fills the ring and says the percent once it has one', () => {
    const { getByTestId } = render(() => <DrumPlayLoadMeter fraction={0.42} />)
    const ring = getByTestId('drum-play-load-ring')
    expect(ring.classList).not.toContain(styles.playLoadRingSpinning)
    expect(ring.style.getPropertyValue('--load-fraction')).toBe('0.42')
    expect(getByTestId('drum-play-load-percent').textContent).toBe('42%')
  })
})
