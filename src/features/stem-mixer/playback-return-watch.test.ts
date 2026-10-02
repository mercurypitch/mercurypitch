// ============================================================
// The return watch: what the page leaving and coming back says, and a
// song left playing on a clock that does not move
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RETURN_CHECK_MS, watchPlaybackReturn } from './playback-return-watch'

function setPageHidden(hidden: boolean): void {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(
    hidden ? 'hidden' : 'visible',
  )
  document.dispatchEvent(new Event('visibilitychange'))
}

/** A clock the test moves, as the audio thread would. */
function fakeClock(state = 'running') {
  return { currentTime: 0, state } as unknown as BaseAudioContext & {
    currentTime: number
  }
}

function watch(options: { playing?: boolean } = {}) {
  const clock = fakeClock()
  let playing = options.playing ?? true
  const report = vi.fn()
  const recover = vi.fn()
  const giveUp = vi.fn(() => {
    playing = false
  })
  const stop = watchPlaybackReturn({
    clock: () => clock,
    playing: () => playing,
    position: () => 42.5,
    report,
    recover,
    giveUp,
  })
  const events = (): string[] =>
    report.mock.calls.map((call) => String(call[0]))
  return { clock, report, recover, giveUp, stop, events }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the return watch', () => {
  it('records the page leaving and coming back, and how far the clock went', () => {
    const { clock, report, stop } = watch()
    clock.currentTime = 10

    setPageHidden(true)
    vi.advanceTimersByTime(30_000)
    clock.currentTime = 40
    setPageHidden(false)

    expect(report).toHaveBeenNthCalledWith(1, 'page-hidden', {
      playing: true,
      position: 42.5,
      state: 'running',
      clock: 10,
    })
    expect(report).toHaveBeenNthCalledWith(
      2,
      'page-visible',
      expect.objectContaining({ awayMs: 30_000, clockMoved: 30, clock: 40 }),
    )
    stop()
  })

  it('leaves a song alone whose clock runs on after the return', () => {
    const { clock, recover, giveUp, events, stop } = watch()
    setPageHidden(true)
    setPageHidden(false)

    clock.currentTime += RETURN_CHECK_MS / 1000
    vi.advanceTimersByTime(RETURN_CHECK_MS * 3)

    expect(recover).not.toHaveBeenCalled()
    expect(giveUp).not.toHaveBeenCalled()
    expect(events()).toEqual(['page-hidden', 'page-visible'])
    stop()
  })

  it('asks for a stuck clock back, and stops the run if it stays stuck', () => {
    const { report, recover, giveUp, stop } = watch()
    setPageHidden(true)
    setPageHidden(false)

    vi.advanceTimersByTime(RETURN_CHECK_MS)
    expect(recover).toHaveBeenCalledOnce()
    expect(giveUp).not.toHaveBeenCalled()

    vi.advanceTimersByTime(RETURN_CHECK_MS)
    expect(giveUp).toHaveBeenCalledOnce()
    expect(report).toHaveBeenCalledWith(
      'clock-stuck',
      expect.objectContaining({ attempt: 2, moved: 0 }),
      true,
    )
    stop()
  })

  it('stops worrying once the clock it asked for comes back', () => {
    const { clock, recover, giveUp, stop } = watch()
    setPageHidden(true)
    setPageHidden(false)

    vi.advanceTimersByTime(RETURN_CHECK_MS)
    expect(recover).toHaveBeenCalledOnce()
    clock.currentTime += 1
    vi.advanceTimersByTime(RETURN_CHECK_MS)

    expect(giveUp).not.toHaveBeenCalled()
    stop()
  })

  it('does not check a song that is not playing', () => {
    const { recover, giveUp, stop } = watch({ playing: false })
    setPageHidden(true)
    setPageHidden(false)

    vi.advanceTimersByTime(RETURN_CHECK_MS * 3)

    expect(recover).not.toHaveBeenCalled()
    expect(giveUp).not.toHaveBeenCalled()
    stop()
  })

  it('drops a check when the page goes away again before it is due', () => {
    const { recover, stop } = watch()
    setPageHidden(true)
    setPageHidden(false)
    setPageHidden(true)

    vi.advanceTimersByTime(RETURN_CHECK_MS * 3)

    expect(recover).not.toHaveBeenCalled()
    stop()
  })

  it('stops listening when it is stopped', () => {
    const { report, stop } = watch()
    stop()

    setPageHidden(true)

    expect(report).not.toHaveBeenCalled()
  })
})
