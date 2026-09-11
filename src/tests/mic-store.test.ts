// ============================================================
// Mic store — the counted hold that pauses voice control
// ============================================================
//
// `singingCaptureActive` is the one signal voice control stands its
// recognizer down on. It had a single writer, the stem mixer; a take that
// opened the microphone through MicManager never raised it, and on iOS —
// where the browser's speech recognizer and getUserMedia are one capture
// path — the two fought over the device. Takes now count holds into the same
// signal, so the controller that reads it needed no change.

import { createEffect, createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { holdExclusiveCapture, setSingingCaptureActive, singingCaptureActive, } from '@/stores/mic-store'

vi.mock('@/lib/mic-manager', () => ({ micManager: { subscribe: vi.fn() } }))
vi.mock('@/lib/mic-lock', () => ({ onMicLockChange: vi.fn() }))

describe('holdExclusiveCapture', () => {
  it('pauses voice control the way singing does, and releasing resumes it', () => {
    expect(singingCaptureActive()).toBe(false)

    const release = holdExclusiveCapture()
    expect(singingCaptureActive()).toBe(true)

    release()
    expect(singingCaptureActive()).toBe(false)
  })

  it('counts overlapping holds, so one take cannot release another', () => {
    const first = holdExclusiveCapture()
    const second = holdExclusiveCapture()

    first()
    expect(singingCaptureActive()).toBe(true)

    second()
    expect(singingCaptureActive()).toBe(false)
  })

  it('releases once, however often the release is called', () => {
    const first = holdExclusiveCapture()
    const second = holdExclusiveCapture()

    first()
    first()
    first()
    // Were the count driven below one, the second hold would already be gone.
    expect(singingCaptureActive()).toBe(true)

    second()
    expect(singingCaptureActive()).toBe(false)
  })

  it('stands beside the stem mixer flag rather than replacing it', () => {
    setSingingCaptureActive(true)
    const release = holdExclusiveCapture()

    release()
    expect(singingCaptureActive()).toBe(true)

    setSingingCaptureActive(false)
    expect(singingCaptureActive()).toBe(false)
  })

  it('flips synchronously for whoever is tracking it', () => {
    // Voice control's controller reacts in a createEffect, and the stop it
    // issues has to land before the take asks MicManager for the device —
    // which is the very next statement after the hold.
    const seen: boolean[] = []
    const dispose = createRoot((rootDispose) => {
      createEffect(() => {
        seen.push(singingCaptureActive())
      })
      return rootDispose
    })
    expect(seen).toEqual([false])

    const release = holdExclusiveCapture()
    expect(seen).toEqual([false, true])

    release()
    expect(seen).toEqual([false, true, false])
    dispose()
  })
})
