// ============================================================
// SessionEditorTimeline Tests — total duration and visible rest labels
// ============================================================

import { render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { setBpm } from '@/stores'
import type { SessionItem } from '@/types'
import { SessionEditorTimeline } from '../SessionEditorTimeline'

const noop = () => {}

describe('SessionEditorTimeline — rest labels', () => {
  it.each([
    [500, 'Duration: 0.5s'],
    [59600, 'Duration: 1m'],
  ])('displays a %s ms rest as "%s"', (restMs, label) => {
    const [duration, setDuration] = createSignal(restMs)
    render(() => (
      <SessionEditorTimeline
        sessionItems={[
          {
            id: 'rest',
            type: 'rest',
            label: 'Rest',
            startBeat: 0,
            restMs: duration(),
          },
        ]}
        onDeleteItem={noop}
        onAddRest={noop}
        onDragOver={noop}
      />
    ))

    const restCard = () =>
      screen.getByText('Rest').closest('[draggable="true"]')
    expect(restCard()).toHaveTextContent(label)

    setDuration(125000)
    expect(restCard()).toHaveTextContent('Duration: 2m 5s')
  })
})

describe('SessionEditorTimeline — total duration', () => {
  it('computes seconds correctly for beats-based items (not off by 1000x)', () => {
    setBpm(120)
    const items: SessionItem[] = [
      {
        id: '1',
        type: 'scale' as SessionItem['type'],
        startBeat: 0,
        label: 'Scale',
        beats: 8,
      },
    ]

    render(() => (
      <SessionEditorTimeline
        sessionItems={items}
        onDeleteItem={noop}
        onAddRest={noop}
        onDragOver={noop}
      />
    ))

    // 8 beats at 120 BPM = 8 * (60/120)s = 4s. The previous formula
    // produced 0.002s (1000x too small) for this same input.
    expect(
      screen.getByText(/Total duration:/).closest('span')?.textContent,
    ).toMatch(/4 seconds/)
  })

  it('adds rest (ms) and beats-based durations in the same unit', () => {
    setBpm(120)
    const items: SessionItem[] = [
      {
        id: '1',
        type: 'rest' as SessionItem['type'],
        startBeat: 0,
        label: 'Rest',
        restMs: 2000,
      },
      {
        id: '2',
        type: 'scale' as SessionItem['type'],
        startBeat: 4,
        label: 'Scale',
        beats: 8,
      },
    ]

    render(() => (
      <SessionEditorTimeline
        sessionItems={items}
        onDeleteItem={noop}
        onAddRest={noop}
        onDragOver={noop}
      />
    ))

    // 2s rest + 4s of beats = 6s total.
    expect(
      screen.getByText(/Total duration:/).closest('span')?.textContent,
    ).toMatch(/6 seconds/)
  })
})
