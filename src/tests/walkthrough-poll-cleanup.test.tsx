// ============================================================
// The guide's target poll stops when the guide does
// ============================================================
//
// `waitForTarget` retries up to twenty times at 50ms, so a step whose target
// never appears leaves a second of `document.querySelector` scheduled. Nothing
// cancelled it on unmount. In the app that is a leak nobody sees; under vitest
// it is an unhandled `ReferenceError: document is not defined`, thrown from a
// timer that outlived the jsdom environment — which fails the whole run with
// every test still green.
//
// Pre-existing, and load-dependent: it surfaced once the suite grew past 775
// files and the scheduling shifted.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Walkthrough } from '@/components/Walkthrough'
import { startWalkthrough } from '@/stores/app-store'

describe('the walkthrough target poll', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('leaves nothing scheduled once the guide unmounts', () => {
    vi.useFakeTimers()
    render(() => <Walkthrough />)
    startWalkthrough()
    // Let the first step arm its poll against a target that is not there.
    vi.advanceTimersByTime(120)

    cleanup()

    // Anything still pending would run `document.querySelector` against a
    // page that no longer exists. The whole retry budget is ~1s.
    const spy = vi.spyOn(document, 'querySelector')
    vi.advanceTimersByTime(2000)
    expect(spy).not.toHaveBeenCalled()
  })
})
