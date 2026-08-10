// Guitar Night stage tests protect its shared, persisted visual presentations.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { Accessor } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { TabPresentation } from '@/features/guitar-tab-3d/renderer/TabRenderer'
import { GUITAR_NIGHT_FLOW_PRESENTATION_KEY, GuitarNightStage, } from './GuitarNightStage'

vi.mock('@/features/guitar/ui/Guitar3DStage', () => ({
  Guitar3DStage: (props: { presentation?: Accessor<TabPresentation> }) => (
    <div
      data-testid="shared-3d-stage"
      data-presentation={props.presentation?.() ?? 'fret-axis'}
    />
  ),
}))

const SOURCE: GuitarPerformanceStageSource = {
  title: () => 'Quiet room',
  notes: () => [],
  timeline: {
    positionSeconds: () => 0,
    durationSeconds: () => 60,
    playheadBeat: () => null,
    tempoBpm: () => 90,
  },
}

describe('GuitarNightStage views', () => {
  beforeEach(() => localStorage.removeItem(GUITAR_NIGHT_FLOW_PRESENTATION_KEY))
  afterEach(() => {
    cleanup()
    localStorage.removeItem(GUITAR_NIGHT_FLOW_PRESENTATION_KEY)
  })

  it('switches one mounted Flow stage between Highway and Grid and remembers it', async () => {
    const first = render(() => (
      <GuitarNightStage source={SOURCE} active={() => true} />
    ))
    const sharedStage = await screen.findByTestId('shared-3d-stage')

    expect(sharedStage).toHaveAttribute('data-presentation', 'string-highway')
    expect(screen.getByRole('button', { name: 'Highway' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Grid' }))

    expect(sharedStage).toHaveAttribute('data-presentation', 'fret-axis')
    expect(localStorage.getItem(GUITAR_NIGHT_FLOW_PRESENTATION_KEY)).toBe(
      'fret-axis',
    )
    first.unmount()

    render(() => <GuitarNightStage source={SOURCE} active={() => true} />)

    expect(await screen.findByTestId('shared-3d-stage')).toHaveAttribute(
      'data-presentation',
      'fret-axis',
    )
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('describes Tab as tablature instead of the last Flow projection', () => {
    render(() => <GuitarNightStage source={SOURCE} active={() => true} />)

    fireEvent.click(screen.getByRole('button', { name: 'Tab' }))

    expect(
      screen.getByRole('img', {
        name: /Empty 6-string tablature; no song tab is attached/,
      }),
    ).toBeVisible()
  })

  it('announces a heard note without live-reading changing clarity', () => {
    render(() => (
      <GuitarNightStage
        source={SOURCE}
        active={() => true}
        listening={() => true}
        heardNote={() => 'C3'}
        heardClarity={() => 0.51}
      />
    ))

    expect(screen.getByRole('status')).toHaveTextContent('Heard C3')
    expect(screen.getByRole('status')).not.toHaveTextContent('51')
  })
})
