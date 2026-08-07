// ============================================================
// LrcMapperStage — the full-screen mapper surface
// ============================================================
//
// Smoke coverage for the composition: it is a lot of props threaded into two
// shared components, and the failure mode is a blank stage rather than a
// thrown error, which no type check catches.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { LrcMapperStage } from '@/components/lrc-mapper/LrcMapperStage'
import type { GenViewLine } from '@/features/stem-mixer/types'

function makeLine(index: number, over: Partial<GenViewLine> = {}): GenViewLine {
  return {
    index,
    line: `line ${index}`,
    words: ['line', String(index)],
    isRest: false,
    isCurrent: index === 0,
    isDone: false,
    isFuture: index > 0,
    isMapped: index === 0,
    isSessionMapped: false,
    lineTime: index === 0 ? 1 : undefined,
    wordTimes: index === 0 ? [1, 1.5] : [],
    wordEndTimes: [],
    wordSweeps: {},
    activeWordIdx: index === 0 ? 0 : -1,
    blockInfo: null,
    blockLabel: undefined,
    isPlaceholder: false,
    isPlaceholderStart: false,
    ...over,
  }
}

function renderStage(over: Partial<Parameters<typeof LrcMapperStage>[0]> = {}) {
  const onClose = vi.fn()
  const [lines] = createSignal([makeLine(0), makeLine(1)])
  const [playing, setPlaying] = createSignal(false)
  render(() => (
    <LrcMapperStage
      blockInstances={() => ({})}
      duration={() => 200}
      elapsed={() => 12}
      formatTime={(t) => `0:${String(Math.floor(t)).padStart(2, '0')}`}
      formatTimeMs={(t) => t.toFixed(2)}
      genShiftMs={() => 0}
      genViewData={lines}
      getBlockById={() => undefined}
      getBlockColor={() => '#f0a060'}
      getBlockForLine={() => null}
      getGenLines={() => ['line 0', 'line 1']}
      handleLrcGenFinish={() => {}}
      handleLrcGenReset={() => {}}
      handleLyricLineClick={() => {}}
      handleMarkerSample={() => {}}
      handleNextLine={() => {}}
      handleNextWord={() => {}}
      handlePause={() => setPlaying(false)}
      handlePlay={() => setPlaying(true)}
      handleRedoCurrentLine={() => {}}
      highlightWord={() => null}
      liveHighlight={() => false}
      loopPreview={() => false}
      lrcGenInputMode={() => 'marker'}
      lrcGenLineIdx={() => 0}
      lrcGenPass={() => 'all'}
      lrcGenWordIdx={() => 0}
      lrcTimingOffsetMs={() => 180}
      lyricsFontSize={() => 1}
      onClose={onClose}
      playbackSpeed={() => 1}
      playing={playing}
      previewLineIdx={() => null}
      setLiveHighlight={() => {}}
      setLoopPreview={() => false}
      setLrcGenInputMode={() => 'marker'}
      setLrcGenPass={() => {}}
      setLrcTimingOffsetMs={() => 0}
      setLyricsFontSize={() => 1}
      setPlaybackSpeed={() => {}}
      setPreviewLoop={() => {}}
      setShowWordMarkers={() => true}
      showWordMarkers={() => true}
      shiftGenTimings={() => 0}
      songTitle="Josephine"
      toggleLinePreview={() => true}
      wordPassProgress={() => ({ done: 0, total: 2 })}
      {...over}
    />
  ))
  return { onClose, playing }
}

describe('LrcMapperStage', () => {
  it('renders the mapper rows inside the shared stage chrome', () => {
    renderStage()
    const stage = screen.getByRole('region', {
      name: 'Lyric mapper — Josephine',
    })
    expect(stage).toHaveAttribute('data-pitch-stage-mode', 'lrc-mapper')
    expect(stage).toHaveAttribute('data-has-canvas', 'true')
    expect(stage).toHaveAttribute('data-has-footer', 'true')
    // No sidecar: the lyric list gets the full width.
    expect(stage).toHaveAttribute('data-has-sidecar', 'false')
    expect(screen.getAllByText('line').length).toBeGreaterThan(0)
  })

  it('reports progress in the units of the pass being mapped', () => {
    renderStage()
    expect(screen.getByText('0/2 lines')).toBeInTheDocument()
    renderStage({
      lrcGenPass: () => 'words',
      wordPassProgress: () => ({ done: 3, total: 7 }),
    })
    expect(screen.getByText('3/7 words')).toBeInTheDocument()
  })

  it('keeps the mapping actions on the surface and the rest behind Settings', () => {
    renderStage()
    // Redo is a mapping action — pressed in time with the music.
    expect(screen.getByTitle('Clear and replay the current line')).toBeVisible()
    // Reaction correction is set once a session, so it starts hidden.
    expect(
      screen.queryByLabelText('Reaction correction in milliseconds'),
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(
      screen.getByLabelText('Reaction correction in milliseconds'),
    ).toBeInTheDocument()
  })

  it('does not offer to expand a mapper that is already full screen', () => {
    renderStage()
    expect(screen.queryByTitle('Map full screen')).toBeNull()
  })

  it('closes on Done without ending the mapping session', () => {
    const { onClose } = renderStage()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('drives the transport from the footer', () => {
    const { playing } = renderStage()
    expect(playing()).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(playing()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(playing()).toBe(false)
  })
})
