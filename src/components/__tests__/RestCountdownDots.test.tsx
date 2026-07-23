import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRestDotSeekTime, RestCountdownDots, } from '@/components/RestCountdownDots'

afterEach(cleanup)

describe('RestCountdownDots', () => {
  it('renders keyboard controls that seek on the shared five-second cadence', () => {
    const onSeek = vi.fn()
    const parentClick = vi.fn()
    render(() => (
      <div onClick={parentClick}>
        <RestCountdownDots
          dotCount={5}
          elapsed={() => 10}
          gapEnd={33}
          gapStart={10}
          onSeek={onSeek}
        />
      </div>
    ))

    const dots = screen.getAllByRole('button', { name: /Seek to/ })
    expect(dots).toHaveLength(5)
    fireEvent.click(dots[2])

    expect(onSeek).toHaveBeenCalledWith(20)
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('renders the fill represented by the current playback time', () => {
    const { container } = render(() =>
      RestCountdownDots({
        dotCount: 4,
        elapsed: () => 15,
        gapEnd: 30,
        gapStart: 10,
      }),
    )

    const dots = container.querySelectorAll<HTMLElement>('.sm-lyrics-rest-dot')
    expect(dots[0].style.getPropertyValue('--fill')).toBe('100%')
    expect(dots[1].style.getPropertyValue('--fill')).toBe('0%')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('getRestDotSeekTime', () => {
  it('clamps the final seek target to the end of the rest', () => {
    expect(getRestDotSeekTime(10, 18, 3)).toBe(18)
  })
})
