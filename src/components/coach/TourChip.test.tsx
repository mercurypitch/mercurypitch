// ============================================================
// TourChip: seen is half on screen, once
// ============================================================
//
// A page can restore its scroll below the chip (Path does), so the offer is
// spent and reported only once the chip has been at least half on screen
// (TourChipHost). The chip watches for that itself, with an
// IntersectionObserver, and says so once. jsdom has none, so these cases
// drive a stand-in by hand; without one at all the chip counts as seen as it
// mounts.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SEEN_SHARE, TourChip } from './TourChip'

interface Watch {
  callback: IntersectionObserverCallback
  options: IntersectionObserverInit | undefined
  targets: Element[]
  disconnected: boolean
}

let watches: Watch[] = []

function stubObserver(): void {
  watches = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly watch: Watch
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        this.watch = { callback, options, targets: [], disconnected: false }
        watches.push(this.watch)
      }
      observe(target: Element): void {
        this.watch.targets.push(target)
      }
      disconnect(): void {
        this.watch.disconnected = true
      }
    },
  )
}

/** The share of the chip on screen now, as the browser would report it. */
function showShare(share: number): void {
  for (const watch of watches) {
    if (watch.disconnected) continue
    watch.callback(
      watch.targets.map(
        (target) =>
          ({
            target,
            isIntersecting: share > 0,
            intersectionRatio: share,
          }) as IntersectionObserverEntry,
      ),
      {} as IntersectionObserver,
    )
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('TourChip', () => {
  it('says it was seen once half of it has been on screen, and only once', () => {
    stubObserver()
    const onSeen = vi.fn()
    render(() => (
      <TourChip onStart={vi.fn()} onDismiss={vi.fn()} onSeen={onSeen} />
    ))

    expect(watches).toHaveLength(1)
    expect(watches[0]?.options?.threshold).toBe(SEEN_SHARE)
    expect(watches[0]?.targets).toEqual([screen.getByTestId('tour-chip')])
    showShare(0)
    showShare(0.3)
    expect(onSeen).not.toHaveBeenCalled()

    showShare(0.5)
    expect(onSeen).toHaveBeenCalledOnce()
    expect(watches[0]?.disconnected).toBe(true)
    showShare(1)
    expect(onSeen).toHaveBeenCalledOnce()
  })

  it('stops watching when it goes unseen', () => {
    stubObserver()
    const onSeen = vi.fn()
    const { unmount } = render(() => (
      <TourChip onStart={vi.fn()} onDismiss={vi.fn()} onSeen={onSeen} />
    ))
    unmount()

    expect(watches[0]?.disconnected).toBe(true)
    expect(onSeen).not.toHaveBeenCalled()
  })

  it('counts as seen as it mounts where there is no IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const onSeen = vi.fn()
    render(() => (
      <TourChip onStart={vi.fn()} onDismiss={vi.fn()} onSeen={onSeen} />
    ))

    expect(onSeen).toHaveBeenCalledOnce()
  })

  it('watches nothing when nobody asks whether it was seen', () => {
    stubObserver()
    render(() => <TourChip onStart={vi.fn()} onDismiss={vi.fn()} />)

    expect(watches).toHaveLength(0)
  })
})
