// Practice deck tests cover passive controls and exact controller callbacks.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarFreeFormPracticeDeck } from './GuitarFreeFormPracticeDeck'
import type { GuitarFreeFormPractice } from './useGuitarFreeFormPractice'
import type { GuitarRecordingController } from './useGuitarRecordingController'

function renderDeck() {
  const [running, setRunning] = createSignal(false)
  const [pending, setPending] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [disabled, setDisabled] = createSignal(false)
  const [hearScore, setHearScore] = createSignal(true)
  const [tempo, setTempo] = createSignal(60)
  const [countIn, setCountIn] = createSignal(2)
  const [reference, setReference] = createSignal({ songId: 'first' })
  const [recordState, setRecordState] = createSignal<'idle' | 'recording'>(
    'idle',
  )
  const toggle = vi.fn()
  const seekSeconds = vi.fn()
  const seekBeat = vi.fn()
  const changeMark = vi.fn()
  const mark = vi.fn()
  const clearLoop = vi.fn(async () => undefined)
  const settle = vi.fn(async (): Promise<void> => undefined)
  const onScore = vi.fn()
  const setGuide = vi.fn(setHearScore)
  const setTempoBpm = vi.fn(async (value: number) => {
    setTempo(value)
  })
  const setCountInBeats = vi.fn(async (value: number) => {
    setCountIn(value)
  })
  const recordStart = vi.fn(async () => {
    setRecordState('recording')
  })
  const recordStop = vi.fn(async () => {
    setRecordState('idle')
  })
  const practice = {
    running,
    pending,
    busy,
    toggle,
    seekSeconds,
    seekBeat,
    changeMark,
    mark,
    clearLoop,
    settle,
    setTempo: setTempoBpm,
    setCountIn: setCountInBeats,
    room: {
      displayReference: reference,
      displayPositionSeconds: () => 2,
      durationSeconds: () => 16,
      durationBeats: () => 8,
      secondsForBeat: (beat: number) => beat * 2,
      beatForSeconds: (seconds: number) => seconds / 2,
      tempoBpm: tempo,
      countInBeats: countIn,
      hearScore,
      setHearScore: setGuide,
    },
    loop: { markA: () => 0, markB: () => 8, isLooping: () => true },
  } as unknown as GuitarFreeFormPractice
  const recording = {
    state: recordState,
    busy: () => recordState() !== 'idle',
    duration: () => 0,
    start: recordStart,
    stop: recordStop,
  } as unknown as GuitarRecordingController
  const view = render(() => (
    <GuitarFreeFormPracticeDeck
      practice={practice}
      recording={recording}
      disabled={disabled()}
      onScore={onScore}
    />
  ))
  return {
    ...view,
    toggle,
    seekSeconds,
    seekBeat,
    changeMark,
    mark,
    clearLoop,
    settle,
    onScore,
    setGuide,
    setTempoBpm,
    setCountInBeats,
    recordStart,
    recordStop,
    setRunning,
    setPending,
    setBusy,
    setDisabled,
    setReference,
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('GuitarFreeFormPracticeDeck', () => {
  it('mounts silent with a seconds rail and centered transport actions', () => {
    const deck = renderDeck()

    expect(
      screen.getByRole('slider', { name: 'Practice position' }),
    ).toHaveValue('2')
    expect(
      screen
        .getByRole('group', { name: 'Practice transport' })
        .querySelectorAll('button'),
    ).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Play practice' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Record a melody' }),
    ).toBeEnabled()
    expect(deck.toggle).not.toHaveBeenCalled()
    expect(deck.settle).not.toHaveBeenCalled()
    expect(deck.recordStart).not.toHaveBeenCalled()
    expect(deck.seekSeconds).not.toHaveBeenCalled()
  })

  it('keeps pending Play cancellable and mirrors the running pause action', () => {
    const deck = renderDeck()
    fireEvent.click(screen.getByRole('button', { name: 'Play practice' }))
    expect(deck.toggle).toHaveBeenCalledOnce()
    deck.setPending(true)
    deck.setBusy(true)

    const pause = screen.getByRole('button', { name: 'Pause practice' })
    expect(pause).toBeEnabled()
    expect(pause).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(pause)
    expect(deck.toggle).toHaveBeenCalledTimes(2)

    deck.setPending(false)
    deck.setBusy(false)
    deck.setRunning(true)
    expect(screen.getByRole('button', { name: 'Pause practice' })).toBeEnabled()
  })

  it('waits for Stop to settle the score before returning to beat zero', async () => {
    const deck = renderDeck()
    let finish!: () => void
    deck.settle.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Stop practice' }))

    expect(deck.settle).toHaveBeenCalledOnce()
    expect(deck.seekBeat).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Stop practice' })).toBeDisabled()
    finish()
    await Promise.resolve()
    expect(deck.seekBeat).toHaveBeenCalledWith(0)
  })

  it('does not seek a departed deck after its pending Stop finishes', async () => {
    const deck = renderDeck()
    let finish!: () => void
    deck.settle.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Stop practice' }))
    deck.unmount()
    finish()
    await Promise.resolve()

    expect(deck.seekBeat).not.toHaveBeenCalled()
  })

  it('uses the coordinated recording proxy without starting practice', () => {
    const deck = renderDeck()
    fireEvent.click(screen.getByRole('button', { name: 'Record a melody' }))
    expect(deck.recordStart).toHaveBeenCalledOnce()
    expect(deck.toggle).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Play practice' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }))
    expect(deck.recordStop).toHaveBeenCalledOnce()
  })

  it('does not rewind a replacement source after a pending Stop finishes', async () => {
    const deck = renderDeck()
    let finish!: () => void
    deck.settle.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Stop practice' }))
    deck.setReference({ songId: 'replacement' })
    finish()
    await Promise.resolve()

    expect(deck.seekBeat).not.toHaveBeenCalled()
  })

  it('lets coordinated Record cancel a pending Practice start', () => {
    const deck = renderDeck()
    deck.setPending(true)
    deck.setBusy(true)
    const record = screen.getByRole('button', { name: 'Record a melody' })
    expect(record).toBeEnabled()
    fireEvent.click(record)
    expect(deck.recordStart).toHaveBeenCalledOnce()
    expect(deck.toggle).not.toHaveBeenCalled()
  })

  it('keeps tempo, count-in, and A/B edits on the practice controller', () => {
    const deck = renderDeck()
    const choose = (id: string) => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Practice tempo and loop' }),
      )
      fireEvent.click(screen.getByTestId(`overflow-${id}`))
    }
    choose('practice-tempo-down')
    expect(deck.setTempoBpm).toHaveBeenLastCalledWith(55)
    choose('practice-tempo-up')
    expect(deck.setTempoBpm).toHaveBeenLastCalledWith(60)
    choose('practice-count-in')
    expect(deck.setCountInBeats).toHaveBeenCalledWith(4)
    choose('practice-mark-a')
    choose('practice-mark-b')
    expect(deck.mark.mock.calls).toEqual([['A'], ['B']])
    choose('practice-clear-loop')
    expect(deck.clearLoop).toHaveBeenCalledOnce()
  })

  it('keeps guide muting independent from score results and input', () => {
    const deck = renderDeck()
    fireEvent.click(screen.getByRole('button', { name: 'Mute guide notes' }))
    expect(deck.setGuide).toHaveBeenCalledWith(false)
    expect(
      screen.getByRole('button', { name: 'Hear guide notes' }),
    ).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Score results' }))
    expect(deck.onScore).toHaveBeenCalledOnce()
    expect(deck.recordStart).not.toHaveBeenCalled()
    expect(deck.toggle).not.toHaveBeenCalled()
  })

  it('maps keyboard seeking and A/B edits through the shared musical rail', () => {
    const deck = renderDeck()
    const seek = screen.getByRole('slider', { name: 'Practice position' })
    fireEvent.keyDown(seek, { key: 'ArrowRight' })
    fireEvent.input(seek, { target: { value: '7' } })
    expect(deck.seekSeconds).not.toHaveBeenCalled()
    fireEvent.keyUp(seek, { key: 'ArrowRight' })
    expect(deck.seekSeconds).toHaveBeenCalledWith(7)
    fireEvent.keyDown(
      screen.getByRole('slider', { name: 'Loop start marker' }),
      { key: 'ArrowRight' },
    )
    expect(deck.changeMark).toHaveBeenCalledWith('A', 1)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Loop end marker' }), {
      key: 'ArrowLeft',
    })
    expect(deck.changeMark).toHaveBeenCalledWith('B', 7)
  })

  it('locks configuration while a capture is settling', () => {
    const deck = renderDeck()
    deck.setBusy(true)
    expect(
      screen.getByRole('slider', { name: 'Practice position' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Play practice' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Record a melody' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Practice tempo and loop' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Score results' })).toBeDisabled()
  })
})
