// ============================================================
// Letter mode — opening a word and timing its glyph boundaries
// ============================================================
//
// The gesture layer over `word-letters`. Two things it has to get right and
// no type check can: that letter mode really does suspend marking, and that
// only the word the user opened expands.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { LrcMapperLineList } from '@/components/lrc-mapper/LrcMapperLineList'
import { LrcWordLetters } from '@/components/lrc-mapper/LrcWordLetters'
import type { GenViewLine } from '@/features/stem-mixer/types'

const fmt = (t: number) => t.toFixed(2)

describe('LrcWordLetters', () => {
  function renderWord(
    splits: Record<number, number> = {},
    over: Partial<Parameters<typeof LrcWordLetters>[0]> = {},
  ) {
    const onSet = vi.fn()
    const onClear = vi.fn()
    const onClose = vi.fn()
    const onSuggestSyllables = vi.fn()
    render(() => (
      <LrcWordLetters
        formatTimeMs={fmt}
        onClear={onClear}
        onClose={onClose}
        onSet={onSet}
        onSuggestSyllables={onSuggestSyllables}
        progress={() => 0}
        splits={() => splits}
        word="soul"
        {...over}
      />
    ))
    return { onSet, onClear, onClose, onSuggestSyllables }
  }

  /** The join targets alone — not the close and syllable controls beside them. */
  const boundaries = () =>
    document.querySelectorAll('.sm-lyrics-letter-boundary')

  it('offers one target per join, including the word edges', () => {
    renderWord()
    // "soul" has four letters, so five joins.
    expect(boundaries()).toHaveLength(5)
    expect(screen.getByLabelText('Time the start of the word')).toBeVisible()
    expect(screen.getByLabelText('Time the end of the word')).toBeVisible()
    expect(screen.getByLabelText('Time the start of "oul"')).toBeVisible()
  })

  it('stamps the boundary that was clicked', () => {
    const { onSet } = renderWord()
    fireEvent.click(screen.getByLabelText('Time the start of "ul"'))
    expect(onSet).toHaveBeenCalledWith(2)
  })

  it('clears an interior boundary on shift-click', () => {
    const { onSet, onClear } = renderWord({ 2: 10.5 })
    fireEvent.click(screen.getByLabelText('Time the start of "ul"'), {
      shiftKey: true,
    })
    expect(onClear).toHaveBeenCalledWith(2)
    expect(onSet).not.toHaveBeenCalled()
  })

  it('will not let a shift-click remove the word itself', () => {
    // The edges are the word's bounds, not splits inside it. Removing one
    // would leave a word with no interval at all.
    const { onSet, onClear } = renderWord({ 0: 10, 4: 11 })
    fireEvent.click(screen.getByLabelText('Time the start of the word'), {
      shiftKey: true,
    })
    expect(onClear).not.toHaveBeenCalled()
    expect(onSet).toHaveBeenCalledWith(0)
  })

  it('shows the time on boundaries that carry one', () => {
    renderWord({ 0: 10, 2: 10.5 })
    expect(screen.getByText('10.00')).toBeVisible()
    expect(screen.getByText('10.50')).toBeVisible()
  })

  it('shows a word that starts at 0:00', () => {
    // A truthiness check would hide the first line of a song that opens
    // immediately, which is exactly the case nobody tests by hand.
    renderWord({ 0: 0 })
    expect(screen.getByText('0.00')).toBeVisible()
  })

  it('counts graphemes, not code units', () => {
    renderWord({}, { word: 'café' })
    // Four letters over five code points: a .length split would offer six.
    expect(boundaries()).toHaveLength(5)
  })

  // ── Getting back out, and undoing ──────────────────────────────
  //
  // The expanded row is almost entirely boundary buttons, each of which stops
  // the click from reaching the word. Without a control of its own the only
  // way out is hitting a glyph, which nothing tells you.

  it('offers a way out that is not a guess', () => {
    const { onClose } = renderWord()
    fireEvent.click(screen.getByLabelText('Close the letter editor'))
    expect(onClose).toHaveBeenCalled()
  })

  it('clears a boundary on right-click, for people without a shift key', () => {
    const { onClear, onSet } = renderWord({ 2: 10.5 })
    fireEvent.contextMenu(screen.getByLabelText('Time the start of "ul"'))
    expect(onClear).toHaveBeenCalledWith(2)
    expect(onSet).not.toHaveBeenCalled()
  })

  it('will not let a right-click remove the word itself', () => {
    const { onClear } = renderWord({ 0: 10, 4: 11 })
    fireEvent.contextMenu(screen.getByLabelText('Time the start of the word'))
    expect(onClear).not.toHaveBeenCalled()
  })

  it('says how to clear, on the boundaries that can be', () => {
    // The gesture has no visible control, so the title is the only place it
    // can be discovered. An unset boundary must not advertise it.
    renderWord({ 2: 10.5 })
    expect(screen.getByLabelText('Time the start of "ul"')).toHaveAttribute(
      'title',
      expect.stringContaining('clear'),
    )
    expect(screen.getByLabelText('Time the start of "oul"')).toHaveAttribute(
      'title',
      'Time the start of "oul"',
    )
  })

  it('offers the syllable pre-fill only when a caller can handle it', () => {
    renderWord({}, { word: 'Josephine' })
    expect(
      screen.getByLabelText('Split this word at its syllables'),
    ).toBeVisible()

    cleanup()
    render(() => (
      <LrcWordLetters
        formatTimeMs={fmt}
        onClear={() => {}}
        onClose={() => {}}
        onSet={() => {}}
        progress={() => 0}
        splits={() => ({})}
        word="Josephine"
      />
    ))
    expect(
      screen.queryByLabelText('Split this word at its syllables'),
    ).toBeNull()
  })

  // Most words in a lyric are one syllable, so this button spends most of its
  // life with nothing to do. It looked broken rather than inapplicable.
  it('disables the pre-fill on a word with one syllable', () => {
    renderWord()
    const button = screen.getByLabelText('One syllable — nothing to split')
    expect(button).toBeDisabled()
  })

  it('does not call out to the suggestion when it is disabled', () => {
    const { onSuggestSyllables } = renderWord()
    fireEvent.click(screen.getByLabelText('One syllable — nothing to split'))
    expect(onSuggestSyllables).not.toHaveBeenCalled()
  })

  // ── The live highlight ─────────────────────────────────────────

  it('fills each glyph in turn as the highlighter crosses it', () => {
    // The word-level fill paints .sm-lyrics-gen-word-text, which does not
    // exist once the word is expanded — so without a per-glyph fill the one
    // thing letter mode is for is the one thing you cannot watch.
    renderWord({}, { progress: () => 0.5 })
    const glyphs = document.querySelectorAll<HTMLElement>(
      '.sm-lyrics-letter-glyph',
    )
    // "soul" at halfway: s and o full, u and l empty.
    expect(glyphs[0].style.getPropertyValue('--glyph-fill')).toBe('100.0%')
    expect(glyphs[1].style.getPropertyValue('--glyph-fill')).toBe('100.0%')
    expect(glyphs[2].style.getPropertyValue('--glyph-fill')).toBe('0.0%')
    expect(glyphs[3].style.getPropertyValue('--glyph-fill')).toBe('0.0%')
  })

  it('fills a glyph part-way through, rather than snapping', () => {
    renderWord({}, { progress: () => 0.375 })
    const glyphs = document.querySelectorAll<HTMLElement>(
      '.sm-lyrics-letter-glyph',
    )
    // 0.375 * 4 = 1.5 — the second glyph is half covered.
    expect(glyphs[1].style.getPropertyValue('--glyph-fill')).toBe('50.0%')
  })

  it('leaves every glyph empty before the word starts', () => {
    renderWord({}, { progress: () => 0 })
    for (const glyph of document.querySelectorAll<HTMLElement>(
      '.sm-lyrics-letter-glyph',
    )) {
      expect(glyph.style.getPropertyValue('--glyph-fill')).toBe('0.0%')
    }
  })
})

// ── Letter mode inside the row list ──────────────────────────────

function makeLine(index: number, over: Partial<GenViewLine> = {}): GenViewLine {
  return {
    index,
    line: 'hold on',
    words: ['hold', 'on'],
    isRest: false,
    isCurrent: index === 0,
    isDone: false,
    isFuture: index > 0,
    isMapped: true,
    isSessionMapped: false,
    lineTime: 1,
    wordTimes: [1, 1.5],
    wordEndTimes: [],
    wordSweeps: {},
    activeWordIdx: 0,
    blockInfo: null,
    blockLabel: undefined,
    isPlaceholder: false,
    isPlaceholderStart: false,
    ...over,
  }
}

function renderList(
  over: Partial<Parameters<typeof LrcMapperLineList>[0]> = {},
) {
  const handleMarkerSample = vi.fn()
  const handleLyricLineClick = vi.fn()
  const openLetterTarget = vi.fn()
  const closeLetterTarget = vi.fn()
  const setLetterSplit = vi.fn()
  const [lines] = createSignal([makeLine(0), makeLine(1)])
  render(() => (
    <LrcMapperLineList
      blockInstances={() => ({})}
      clearLetterSplit={() => {}}
      suggestSyllableSplits={() => 0}
      closeLetterTarget={closeLetterTarget}
      elapsed={() => 12.25}
      formatTimeMs={fmt}
      genViewData={lines}
      getBlockById={() => undefined}
      getBlockColor={() => '#f0a060'}
      handleLyricLineClick={handleLyricLineClick}
      handleMarkerSample={handleMarkerSample}
      handlePlay={() => {}}
      highlightWord={() => null}
      letterMode={() => true}
      letterSplits={() => ({})}
      letterTarget={() => null}
      loopPreview={() => false}
      lrcGenInputMode={() => 'marker'}
      lrcGenLineIdx={() => 0}
      lrcGenWordIdx={() => 0}
      lyricsFontSize={() => 1}
      openLetterTarget={openLetterTarget}
      playing={() => true}
      previewLineIdx={() => null}
      setLetterSplit={setLetterSplit}
      setLyricsFontSize={() => 1}
      toggleLinePreview={() => true}
      {...over}
    />
  ))
  return {
    handleMarkerSample,
    handleLyricLineClick,
    openLetterTarget,
    closeLetterTarget,
    setLetterSplit,
  }
}

describe('letter mode in the row list', () => {
  it('opens the word that was clicked', () => {
    const { openLetterTarget } = renderList()
    fireEvent.click(screen.getAllByText('on')[0])
    expect(openLetterTarget).toHaveBeenCalledWith(0, 1)
  })

  it('expands only the open word', () => {
    renderList({ letterTarget: () => ({ lineIdx: 0, wordIdx: 0 }) })
    // "hold" became four glyphs and five joins; "on" is still one span.
    expect(screen.getAllByRole('button', { name: /Time the/ })).toHaveLength(5)
    expect(screen.getAllByText('on').length).toBeGreaterThan(0)
  })

  // Closing used to live on the word itself, and every glyph bubbles up to
  // it — so the whole expanded row was a dismiss target and the only safe
  // things to press were the hairline boundaries between the letters.
  it('keeps the open word open when a letter is clicked', () => {
    const { closeLetterTarget, openLetterTarget } = renderList({
      letterTarget: () => ({ lineIdx: 0, wordIdx: 1 }),
    })
    fireEvent.click(screen.getAllByText('o')[0])
    expect(closeLetterTarget).not.toHaveBeenCalled()
    expect(openLetterTarget).not.toHaveBeenCalled()
  })

  it('closes it from the row own X button', () => {
    const { closeLetterTarget } = renderList({
      letterTarget: () => ({ lineIdx: 0, wordIdx: 1 }),
    })
    fireEvent.click(screen.getByLabelText('Close the letter editor'))
    expect(closeLetterTarget).toHaveBeenCalled()
  })

  it('stamps the playhead at the boundary that was clicked', () => {
    const { setLetterSplit } = renderList({
      letterTarget: () => ({ lineIdx: 0, wordIdx: 0 }),
    })
    fireEvent.click(screen.getByLabelText('Time the start of "ld"'))
    expect(setLetterSplit).toHaveBeenCalledWith(0, 0, 2, 12.25)
  })

  it('suspends marking while letters are being split', () => {
    // Both gestures start with a press on the current line. Without this the
    // click that opens a word would also stamp its onset at the wrong time.
    const { handleMarkerSample } = renderList()
    const word = screen.getAllByText('hold')[0]
    fireEvent.pointerDown(word, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerUp(word, { clientX: 10, clientY: 10, pointerId: 1 })
    expect(handleMarkerSample).not.toHaveBeenCalled()
  })

  it('does not move the mapping cursor when a word is clicked', () => {
    // Outside letter mode a click on a line selects it. In here that would
    // fight the click that opens a word.
    const { handleLyricLineClick } = renderList()
    fireEvent.click(screen.getAllByText('hold')[0])
    expect(handleLyricLineClick).not.toHaveBeenCalled()
  })

  it('hands clicks back to line selection once letter mode is off', () => {
    // The second row is not the mapping cursor's line, so a click on it means
    // "go there" — the behaviour letter mode has to give back when it exits.
    const { handleLyricLineClick } = renderList({ letterMode: () => false })
    fireEvent.click(screen.getAllByText('hold')[1])
    expect(handleLyricLineClick).toHaveBeenCalledWith(1)
    expect(screen.queryByLabelText('Time the start of the word')).toBeNull()
  })

  it('leaves other lines selectable while letter mode is on', () => {
    // Letter mode must not strand the cursor: you still need to walk the song.
    const { handleLyricLineClick, openLetterTarget } = renderList()
    fireEvent.click(screen.getAllByText('hold')[1])
    expect(handleLyricLineClick).not.toHaveBeenCalled()
    expect(openLetterTarget).toHaveBeenCalledWith(1, 0)
  })
})
