// Studio comp panel tests — Clip details lists the passes to use whole and opens the comp, the lane sheet's bars take a tap, the clip bar's Comp waits for a take, and a comped clip draws each stretch from its pass.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioClip } from '@/lib/studio/model/types'
import { setStudioTakeRunning } from '../record/take-running'
import { closeStudioComp, studioCompClipId } from '../timeline/comp-editor'
import { StudioClipToolbar } from '../timeline/StudioClipToolbar'
import { studioEnvelopeColumns } from '../timeline/StudioWaveform'
import { StudioClipDetails } from './StudioClipDetails'
import { StudioCompSheet } from './StudioCompSheet'

/** Three one-bar passes at 120 bpm from frame 0; the clip plays the newest from bar 2 of the song. */
const BAR = 96_000
const take: StudioClip = {
  id: 'take',
  trackId: 'lane',
  assetId: 'asset-1',
  startFrame: BAR,
  sourceInFrame: 4 * BAR,
  sourceOutFrame: 6 * BAR,
  gainDb: 0,
  fades: { curve: 'linear-amplitude' },
  passes: { firstFrame: 0, frames: 2 * BAR, count: 3 },
}

afterEach(() => {
  cleanup()
  setStudioTakeRunning(false)
  closeStudioComp()
})

describe('Clip details for a loop take', () => {
  it('lists the passes newest first, each to use whole, and opens the comp', () => {
    const command = vi.fn(() => true)
    render(() => (
      <StudioClipDetails
        clip={take}
        asset={{ ...studioFixture().asset, id: 'asset-1' }}
        writable
        onCommand={command}
      />
    ))

    const passes = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(passes).toEqual([
      'Pass 3 newestPlays whole',
      'Pass 2Use whole pass',
      'Pass 1Use whole pass',
    ])
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Use whole pass' })[1],
    )
    expect(command).toHaveBeenCalledWith({
      type: 'choose-pass',
      clipId: 'take',
      pass: 0,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Comp the passes' }))
    expect(studioCompClipId()).toBe('take')
    expect(
      screen.getByRole('button', { name: 'Close the passes' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers every pass whole once the clip plays a comp', () => {
    render(() => (
      <StudioClipDetails
        clip={{
          ...take,
          comp: [
            { fromSourceFrame: 4 * BAR, toSourceFrame: 5 * BAR, pass: 0 },
            { fromSourceFrame: 5 * BAR, toSourceFrame: 6 * BAR, pass: 2 },
          ],
        }}
        asset={{ ...studioFixture().asset, id: 'asset-1' }}
        writable
        onCommand={vi.fn(() => true)}
      />
    ))

    expect(
      screen.getAllByRole('button', { name: 'Use whole pass' }),
    ).toHaveLength(3)
  })

  it('has nothing to say about passes for a clip without them', () => {
    const { clip, asset } = studioFixture()
    render(() => (
      <StudioClipDetails
        clip={clip}
        asset={asset}
        writable
        onCommand={vi.fn(() => true)}
      />
    ))
    expect(screen.queryByRole('button', { name: /Comp/ })).toBeNull()
  })
})

describe('the lane sheet on a phone', () => {
  function sheet() {
    const command = vi.fn(() => true)
    render(() => (
      <StudioCompSheet
        trackId="lane"
        clips={[take, { ...take, id: 'elsewhere', trackId: 'other' }]}
        assets={[]}
        tempoBpm={120}
        writable
        onCommand={command}
      />
    ))
    return command
  }

  it('stands the passes newest on top, a cell a bar, lit where each plays', () => {
    sheet()

    const rows = screen.getAllByRole('group', { name: /^Pass/ })
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'Pass 3',
      'Pass 2',
      'Pass 1',
    ])
    const lit = (row: HTMLElement) =>
      [...row.querySelectorAll('button')].map(
        (cell) => `${cell.textContent}:${cell.getAttribute('aria-pressed')}`,
      )
    // The clip covers bars 2 and 3 of the song.
    expect(lit(rows[0])).toEqual(['2:true', '3:true'])
    expect(lit(rows[2])).toEqual(['2:false', '3:false'])
  })

  it('uses the tapped pass over the tapped bar', () => {
    const command = sheet()
    const oldest = screen.getAllByRole('group', { name: /^Pass/ })[2]

    fireEvent.click(oldest.querySelectorAll('button')[1])

    expect(command).toHaveBeenCalledWith({
      type: 'comp-pass',
      clipId: 'take',
      fromSourceFrame: 5 * BAR,
      toSourceFrame: 6 * BAR,
      pass: 0,
    })
  })

  it('holds its cells while a take runs, and says why', () => {
    setStudioTakeRunning(true)
    sheet()

    expect(screen.getByText('Stop the take to comp.')).toBeInTheDocument()
    for (const cell of screen.getAllByRole('button', { name: /^Bar/ }))
      expect(cell).toBeDisabled()
  })
})

describe("the clip bar's Comp", () => {
  function bar(clip: StudioClip) {
    render(() => (
      <StudioClipToolbar
        clip={clip}
        playheadFrame={0}
        writable
        label="Voice"
        left={0}
        bottom={0}
        onCommand={vi.fn(() => true)}
        onDetails={vi.fn()}
        onRemove={vi.fn()}
      />
    ))
  }

  it('opens and closes the passes of a loop take', () => {
    bar(take)
    const comp = screen.getByRole('button', { name: 'Comp' })

    fireEvent.click(comp)
    expect(studioCompClipId()).toBe('take')
    expect(comp).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(comp)
    expect(studioCompClipId()).toBeNull()
  })

  it('calls the pass of a comped clip Comped, so Comp names the button alone', () => {
    bar({
      ...take,
      comp: [
        { fromSourceFrame: 4 * BAR, toSourceFrame: 5 * BAR, pass: 0 },
        { fromSourceFrame: 5 * BAR, toSourceFrame: 6 * BAR, pass: 2 },
      ],
    })
    const picker = screen.getByRole<HTMLSelectElement>('combobox', {
      name: 'Pass this clip plays',
    })
    expect(picker.selectedOptions[0]?.textContent).toBe('Comped')
    expect(screen.getByRole('button', { name: 'Comp' })).toBeInTheDocument()
  })

  it('waits for a take, and is not there for a clip with one pass', () => {
    setStudioTakeRunning(true)
    bar(take)
    expect(screen.getByRole('button', { name: 'Comp' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Comp' })).toHaveAttribute(
      'title',
      'Stop the take to comp',
    )
    cleanup()

    bar({ ...take, passes: undefined })
    expect(screen.queryByRole('button', { name: 'Comp' })).toBeNull()
  })
})

describe('a comped clip on the timeline', () => {
  it('draws each stretch from the pass playing there', () => {
    // Two 1000-frame passes, the first quiet and the second loud, in peaks of 100 frames.
    const level = (values: number[]) => Int16Array.from(values)
    const wave = {
      frameCount: 2000,
      scale: 1 / 10_000,
      levels: [
        {
          framesPerPeak: 100,
          maxima: level([...Array(10).fill(2000), ...Array(10).fill(8000)]),
          minima: level([...Array(10).fill(-2000), ...Array(10).fill(-8000)]),
          rms: level(Array(20).fill(1000)),
        },
      ],
    }
    const clip: StudioClip = {
      ...take,
      sourceInFrame: 1000,
      sourceOutFrame: 2000,
      passes: { firstFrame: 0, frames: 1000, count: 2 },
    }
    const comped: StudioClip = {
      ...clip,
      comp: [
        { fromSourceFrame: 1000, toSourceFrame: 1500, pass: 0 },
        { fromSourceFrame: 1500, toSourceFrame: 2000, pass: 1 },
      ],
    }

    const high = (shown: StudioClip) =>
      [...studioEnvelopeColumns(wave, shown, 10, 1000, 2000).high].map(
        (value) => Math.round(value * 10) / 10,
      )

    expect(high(clip)).toEqual(Array(10).fill(0.8))
    expect(high(comped)).toEqual([...Array(5).fill(0.2), ...Array(5).fill(0.8)])
  })
})
