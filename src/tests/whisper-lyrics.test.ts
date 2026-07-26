import { describe, expect, it } from 'vitest'
import type { LyricsEditRow } from '@/lib/whisper-lyrics'
import { buildEditedLrc, insertedLineTime, segmentsToLrc, stripInlineWordStamps, } from '@/lib/whisper-lyrics'
import type { WhisperSegment } from '@/lib/whisper-service'

const seg = (text: string, start: number, end: number): WhisperSegment => ({
  text,
  timestamp: [start, end],
})

const row = (over: Partial<LyricsEditRow>): LyricsEditRow => ({
  time: 0,
  text: '',
  rawText: null,
  originalIndex: null,
  ...over,
})

describe('segmentsToLrc', () => {
  it('turns each segment into one synced LRC line', () => {
    const out = segmentsToLrc([
      seg('Hello world', 1.5, 3),
      seg('Second line', 4.25, 6),
    ])
    expect(out).toBe('[00:01.50]Hello world\n[00:04.25]Second line')
  })

  it('drops empty and whitespace-only segments', () => {
    const out = segmentsToLrc([
      seg('   ', 1, 2),
      seg('', 2, 3),
      seg('kept', 3, 4),
    ])
    expect(out).toBe('[00:03.00]kept')
  })

  it('collapses internal whitespace to single spaces', () => {
    const out = segmentsToLrc([seg('  a \n b\t\tc  ', 0, 1)])
    expect(out).toBe('[00:00.00]a b c')
  })

  it('clamps overlapping timestamps monotonically non-decreasing', () => {
    const out = segmentsToLrc([
      seg('one', 5, 7),
      seg('two', 4, 6),
      seg('three', -2, 1),
    ])
    expect(out).toBe('[00:05.00]one\n[00:05.00]two\n[00:05.00]three')
  })

  it('returns an empty string for no usable segments', () => {
    expect(segmentsToLrc([])).toBe('')
    expect(segmentsToLrc([seg('  ', 0, 1)])).toBe('')
  })
})

describe('buildEditedLrc', () => {
  it('re-emits untouched rows verbatim, keeping inline word stamps', () => {
    const out = buildEditedLrc([
      row({
        time: 10,
        text: 'First word here',
        rawText: 'First [00:11.00]word [00:12.00]here',
        originalIndex: 0,
      }),
    ])
    expect(out).toBe('[00:10.00]First [00:11.00]word [00:12.00]here')
  })

  it('re-emits edited rows from their clean text at line level', () => {
    const out = buildEditedLrc([
      row({ time: 5, text: '  Fixed   line ', originalIndex: 0 }),
      row({ time: 8.5, text: 'Added below', originalIndex: null }),
    ])
    expect(out).toBe('[00:05.00]Fixed line\n[00:08.50]Added below')
  })

  it('drops timed rows whose text ends up empty', () => {
    const out = buildEditedLrc([
      row({ time: 1, text: 'kept', originalIndex: 0 }),
      row({ time: 2, text: '   ', originalIndex: null }),
      row({ time: 3, text: 'also kept', originalIndex: 1 }),
    ])
    expect(out).toBe('[00:01.00]kept\n[00:03.00]also kept')
  })

  it('emits plain rows (null time) bare, without stamps', () => {
    const out = buildEditedLrc([
      row({ time: null, text: ' hello  there ', originalIndex: 0 }),
      row({ time: null, text: 'world', originalIndex: 1 }),
    ])
    expect(out).toBe('hello there\nworld')
  })

  it('returns an empty string when no rows survive', () => {
    expect(buildEditedLrc([])).toBe('')
    expect(buildEditedLrc([row({ time: 4, text: '  ' })])).toBe('')
  })
})

describe('insertedLineTime', () => {
  it('places an inserted line halfway to the next one', () => {
    expect(insertedLineTime(10, 14)).toBe(12)
    expect(insertedLineTime(0, 1)).toBe(0.5)
  })

  it('steps forward when inserting after the last row', () => {
    expect(insertedLineTime(10, undefined)).toBe(12)
  })

  it('steps forward when the next time is not ahead', () => {
    expect(insertedLineTime(10, 10)).toBe(12)
    expect(insertedLineTime(10, 9)).toBe(12)
  })
})

describe('stripInlineWordStamps', () => {
  it('removes inline word-level stamps and collapses whitespace', () => {
    expect(stripInlineWordStamps('First [00:11.00]word [00:12.50]here')).toBe(
      'First word here',
    )
  })

  it('handles stamps that abut the surrounding text', () => {
    expect(stripInlineWordStamps('First[00:11.00]word')).toBe('First word')
  })

  it('accepts colon fractional separators and bare mm:ss stamps', () => {
    expect(stripInlineWordStamps('[00:11:50]word [01:02]next')).toBe(
      'word next',
    )
  })

  it('leaves stamp-free text alone apart from whitespace cleanup', () => {
    expect(stripInlineWordStamps('  just   words ')).toBe('just words')
  })
})
