// Jam Doctor presentation tests protect completed-review hierarchy and focus recovery.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { GuitarNightDoctorView } from './GuitarNightJamDoctor'
import { GuitarNightDoctorCue, GuitarNightJamDoctor, } from './GuitarNightJamDoctor'
import { GuitarNightStage } from './GuitarNightStage'

const REVIEW: GuitarNightDoctorView = {
  anchorLabel: 'Bars 5–8 · Take 2',
  headline: 'The return lands early.',
  detail: 'Four traceable attacks arrive before the authored beat.',
  evidence: [
    {
      label: 'Median offset',
      value: '−54 ms',
      detail: 'Across four latency-compensated attacks.',
    },
    { label: 'Attacks matched', value: '4 of 4' },
  ],
  unavailableReasons: ['Sustain needs a reliable note release.'],
  comparison: 'The center moved 18 ms closer to the beat.',
  recoveryLabel: 'Rehearse bars 5–8',
  recoveryDetail: '72 BPM · four-beat count-in',
  privacyCopy: 'Measured on this device. Audio is not saved.',
}

const STAGE_SOURCE: GuitarPerformanceStageSource = {
  title: () => 'Velvet phrase',
  notes: () => [],
  timeline: {
    positionSeconds: () => 0,
    durationSeconds: () => 8,
    playheadBeat: () => null,
    tempoBpm: () => 84,
  },
}

describe('GuitarNightJamDoctor', () => {
  afterEach(cleanup)

  it('presents one completed-take review and its direct recovery', () => {
    const recover = vi.fn()
    const clear = vi.fn()

    render(() => (
      <GuitarNightJamDoctor
        open={true}
        view={REVIEW}
        footer={<p>Input timing was sample-exact.</p>}
        onClose={vi.fn()}
        onClear={clear}
        onRecover={recover}
      />
    ))

    const dialog = screen.getByRole('dialog', { name: REVIEW.headline })
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getAllByText('Bars 5–8 · Take 2')).toHaveLength(2)
    expect(screen.getByText('−54 ms')).toBeTruthy()
    expect(screen.getByText(REVIEW.comparison ?? '')).toBeTruthy()
    expect(
      screen.getByText('Sustain needs a reliable note release.'),
    ).toBeTruthy()
    expect(screen.getByText(REVIEW.privacyCopy)).toBeTruthy()
    expect(screen.getByText('Input timing was sample-exact.')).toBeTruthy()

    const recovery = screen.getByRole('button', {
      name: REVIEW.recoveryLabel,
    })
    const recoveryDetailId = recovery.getAttribute('aria-describedby')
    expect(recoveryDetailId).not.toBeNull()
    expect(document.getElementById(recoveryDetailId ?? '')).toHaveTextContent(
      REVIEW.recoveryDetail ?? '',
    )

    fireEvent.click(recovery)
    fireEvent.click(screen.getByRole('button', { name: 'Discard review' }))
    expect(recover).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('keeps keyboard focus inside the modal faceplate', () => {
    render(() => (
      <GuitarNightJamDoctor
        open={true}
        view={REVIEW}
        onClose={vi.fn()}
        onClear={vi.fn()}
        onRecover={vi.fn()}
      />
    ))

    const close = screen.getByRole('button', { name: 'Close Jam Doctor' })
    const clear = screen.getByRole('button', { name: 'Discard review' })
    clear.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(clear)
  })

  it('blocks background pointer actions while the stage faceplate is modal', () => {
    const outsideAction = vi.fn()
    const close = vi.fn()
    render(() => (
      <>
        <button type="button" onClick={outsideAction}>
          Background transport
        </button>
        <GuitarNightJamDoctor
          open={true}
          view={REVIEW}
          onClose={close}
          onRecover={vi.fn()}
        />
      </>
    ))

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Background transport' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Background transport' }),
    )
    expect(outsideAction).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('guitar-night-doctor-backdrop'))
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('keeps a running take separate from completed review evidence', () => {
    render(() => (
      <GuitarNightJamDoctor
        open={true}
        view={null}
        recording={true}
        liveEventCount={7}
        onClose={vi.fn()}
        onRecover={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('dialog', {
        name: 'Finish the phrase when you are ready.',
      }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        '7 input events are held locally so far. The review appears after Listening stops.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText('Median offset')).toBeNull()
    expect(
      screen.queryByRole('button', { name: REVIEW.recoveryLabel }),
    ).toBeNull()
  })

  it('focuses recovery, closes on Escape, and restores the trigger', async () => {
    function Harness() {
      const [open, setOpen] = createSignal(false)
      let trigger: HTMLButtonElement | undefined

      return (
        <>
          <button ref={trigger} type="button" onClick={() => setOpen(true)}>
            Jam Doctor
          </button>
          <GuitarNightJamDoctor
            id="focus-doctor"
            open={open()}
            view={REVIEW}
            returnFocus={() => trigger ?? null}
            onClose={() => setOpen(false)}
            onRecover={vi.fn()}
          />
        </>
      )
    }

    render(() => <Harness />)
    const trigger = screen.getByRole('button', { name: 'Jam Doctor' })
    fireEvent.click(trigger)
    await Promise.resolve()

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: REVIEW.recoveryLabel }),
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    await Promise.resolve()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('restores focus to the cue remounted after the sheet closes', async () => {
    function Harness() {
      const [open, setOpen] = createSignal(false)
      let trigger: HTMLButtonElement | undefined

      return (
        <>
          <Show when={!open()}>
            <button ref={trigger} type="button" onClick={() => setOpen(true)}>
              Review take
            </button>
          </Show>
          <GuitarNightJamDoctor
            open={open()}
            view={REVIEW}
            returnFocus={() => trigger ?? null}
            onClose={() => setOpen(false)}
            onRecover={vi.fn()}
          />
        </>
      )
    }

    render(() => <Harness />)
    const originalTrigger = screen.getByRole('button', {
      name: 'Review take',
    })
    fireEvent.click(originalTrigger)
    await Promise.resolve()

    fireEvent.keyDown(document, { key: 'Escape' })
    await Promise.resolve()

    const restoredTrigger = screen.getByRole('button', {
      name: 'Review take',
    })
    expect(restoredTrigger).not.toBe(originalTrigger)
    expect(document.activeElement).toBe(restoredTrigger)
  })

  it('keeps recovery focus connected while the next take removes its cue', async () => {
    function Harness() {
      const [open, setOpen] = createSignal(true)
      const [view, setView] = createSignal<GuitarNightDoctorView | null>(REVIEW)
      const [recovering, setRecovering] = createSignal(false)
      let trigger: HTMLButtonElement | undefined
      let heading!: HTMLHeadingElement

      return (
        <>
          <h1 ref={heading} tabindex="-1">
            Guitar Night
          </h1>
          <Show when={!open() && view() !== null}>
            <button ref={trigger} type="button">
              Review take
            </button>
          </Show>
          <GuitarNightJamDoctor
            open={open()}
            view={view()}
            returnFocus={() => (recovering() ? heading : (trigger ?? null))}
            fallbackFocus={() => heading}
            onClose={() => setOpen(false)}
            onRecover={() => {
              setRecovering(true)
              setOpen(false)
              queueMicrotask(() => setView(null))
            }}
          />
        </>
      )
    }

    render(() => <Harness />)
    fireEvent.click(screen.getByRole('button', { name: REVIEW.recoveryLabel }))
    await Promise.resolve()
    await Promise.resolve()

    expect(screen.queryByRole('button', { name: 'Review take' })).toBeNull()
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Guitar Night' }),
    )
    expect(document.activeElement?.isConnected).toBe(true)
  })

  it('falls back to a stable focus target when an action removes the cue', async () => {
    function Harness() {
      const [open, setOpen] = createSignal(false)
      const [showCue, setShowCue] = createSignal(true)
      let trigger: HTMLButtonElement | undefined
      let heading!: HTMLHeadingElement

      return (
        <>
          <h1 ref={heading} tabindex="-1">
            Guitar Night
          </h1>
          <Show when={showCue()}>
            <button ref={trigger} type="button" onClick={() => setOpen(true)}>
              Review take
            </button>
          </Show>
          <GuitarNightJamDoctor
            open={open()}
            view={REVIEW}
            returnFocus={() => trigger ?? null}
            fallbackFocus={() => heading}
            onClose={() => setOpen(false)}
            onClear={() => {
              setShowCue(false)
              setOpen(false)
            }}
            onRecover={vi.fn()}
          />
        </>
      )
    }

    render(() => <Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Review take' }))
    await Promise.resolve()
    fireEvent.click(screen.getByRole('button', { name: 'Discard review' }))
    await Promise.resolve()

    expect(screen.queryByRole('button', { name: 'Review take' })).toBeNull()
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Guitar Night' }),
    )
  })

  it('announces a completed take and exposes the review trigger', async () => {
    const open = vi.fn()
    let trigger: HTMLButtonElement | undefined

    function Harness() {
      const [view, setView] = createSignal<GuitarNightDoctorView | null>(null)

      return (
        <>
          <button type="button" onClick={() => setView(REVIEW)}>
            Complete take
          </button>
          <GuitarNightJamDoctor
            open={false}
            view={view()}
            onClose={vi.fn()}
            onRecover={vi.fn()}
          />
          <Show when={view()}>
            {(completedView) => (
              <GuitarNightDoctorCue
                view={completedView()}
                expanded={false}
                controlsId="take-review"
                buttonRef={(element) => {
                  trigger = element
                }}
                onOpen={open}
              />
            )}
          </Show>
        </>
      )
    }

    render(() => <Harness />)
    expect(screen.getByRole('status')).toHaveTextContent('')
    fireEvent.click(screen.getByRole('button', { name: 'Complete take' }))
    await Promise.resolve()

    expect(screen.getByRole('status')).toHaveTextContent(
      `Take review ready. ${REVIEW.anchorLabel}. ${REVIEW.headline}`,
    )
    const review = screen.getByRole('button', {
      name: `Review ${REVIEW.anchorLabel}: ${REVIEW.headline}`,
    })
    expect(trigger).toBe(review)
    expect(review.getAttribute('aria-controls')).toBe('take-review')
    fireEvent.click(review)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('does not re-announce an unchanged take when its sheet closes', async () => {
    function Harness() {
      const [open, setOpen] = createSignal(false)

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open review
          </button>
          <GuitarNightJamDoctor
            open={open()}
            view={REVIEW}
            onClose={() => setOpen(false)}
            onRecover={vi.fn()}
          />
        </>
      )
    }

    render(() => <Harness />)
    const status = screen.getByRole('status')
    const announcement = `Take review ready. ${REVIEW.anchorLabel}. ${REVIEW.headline}`
    expect(status).toHaveTextContent(announcement)

    fireEvent.click(screen.getByRole('button', { name: 'Open review' }))
    await Promise.resolve()
    fireEvent.keyDown(document, { key: 'Escape' })
    await Promise.resolve()

    expect(status).toHaveTextContent(announcement)
  })

  it('instantiates a stage overlay once, so Escape closes once', async () => {
    const close = vi.fn()

    render(() => (
      <GuitarNightStage
        source={STAGE_SOURCE}
        active={() => true}
        initialMode="tab"
        overlay={
          <GuitarNightJamDoctor
            open={true}
            view={REVIEW}
            onClose={close}
            onRecover={vi.fn()}
          />
        }
      />
    ))

    fireEvent.keyDown(document, { key: 'Escape' })
    await Promise.resolve()

    expect(close).toHaveBeenCalledTimes(1)
  })

  it('mounts host overlays inside the fixed stage rectangle', () => {
    render(() => (
      <GuitarNightStage
        source={STAGE_SOURCE}
        active={() => true}
        initialMode="tab"
        overlay={<div data-testid="stage-owned-review">Review</div>}
      />
    ))

    const stage = screen.getByTestId('guitar-night-stage')
    const review = screen.getByTestId('stage-owned-review')
    expect(stage.contains(review)).toBe(true)
  })
})
