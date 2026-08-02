import { describe, expect, it } from 'vitest'
import { parseLrcFile, parseLrcWordTimings } from '@/lib/lyrics-service'
import type { LyricsEditRow } from '@/lib/whisper-lyrics'
import { buildEditedLrc, groupWhisperWordsIntoLines, insertedLineTime, segmentsToLrc, stripInlineWordStamps, } from '@/lib/whisper-lyrics'
import type { WhisperSegment } from '@/lib/whisper-service'

const seg = (text: string, start: number, end: number): WhisperSegment => ({
  text,
  timestamp: [start, end],
})

/** A sung phrase as Whisper emits it: one segment per word, words back to back
 *  from `startSec`, each holding `perWordSec` with a hair of silence after. */
const phrase = (
  text: string,
  startSec: number,
  perWordSec = 0.3,
): WhisperSegment[] =>
  text
    .split(' ')
    .map((word, i) =>
      seg(
        word,
        startSec + i * perWordSec,
        startSec + (i + 1) * perWordSec - 0.01,
      ),
    )

const row = (over: Partial<LyricsEditRow>): LyricsEditRow => ({
  time: 0,
  text: '',
  rawText: null,
  originalIndex: null,
  ...over,
})

describe('groupWhisperWordsIntoLines', () => {
  it('gathers back-to-back words into one phrase, not one line per word', () => {
    const lines = groupWhisperWordsIntoLines(
      phrase('I never felt this way', 10),
    )
    expect(lines).toHaveLength(1)
    expect(lines[0].words.map((w) => w.text)).toEqual([
      'I',
      'never',
      'felt',
      'this',
      'way',
    ])
    expect(lines[0].startSec).toBeCloseTo(10)
  })

  it('starts a new line after a silence longer than the phrase gap', () => {
    const lines = groupWhisperWordsIntoLines([
      ...phrase('first phrase here', 10),
      ...phrase('second phrase here', 14),
    ])
    expect(lines).toHaveLength(2)
    expect(lines[1].startSec).toBeCloseTo(14)
  })

  it('keeps a short breath inside the same phrase', () => {
    const lines = groupWhisperWordsIntoLines([
      ...phrase('hold the note', 10),
      ...phrase('and carry on', 11.4),
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].words).toHaveLength(6)
  })

  it('breaks after sentence-final punctuation', () => {
    const lines = groupWhisperWordsIntoLines(
      phrase('this is only a dream. but I never felt', 10),
    )
    expect(lines).toHaveLength(2)
    expect(lines[0].words.map((w) => w.text).join(' ')).toBe(
      'this is only a dream.',
    )
  })

  it('caps a run-on phrase at the maximum word count', () => {
    const lines = groupWhisperWordsIntoLines(
      phrase('a b c d e f g h i j k l m n', 10, 0.2),
    )
    expect(lines[0].words).toHaveLength(10)
    expect(lines).toHaveLength(2)
  })

  it('caps a phrase that outlasts the maximum line span', () => {
    const lines = groupWhisperWordsIntoLines(phrase('a b c d e', 10, 2.5))
    expect(lines.length).toBeGreaterThan(1)
  })

  it('drops the single-frame words Whisper loops out over silence', () => {
    // The owner's dev run, verbatim: an instrumental intro decoded as 20ms
    // words seconds apart, "one." fourteen times over.
    const junk: WhisperSegment[] = [
      seg('You', 9.98, 10.0),
      seg('one.', 30.06, 30.08),
      seg("I'm", 32.24, 32.26),
      seg('one.', 32.26, 32.28),
      seg('one.', 34.24, 34.26),
      seg('one.', 36.0, 36.02),
      seg('one.', 37.92, 37.94),
      seg('one.', 39.86, 39.88),
      seg('one.', 44.4, 44.42),
      seg('one.', 46.06, 46.08),
      seg('one.', 48.94, 48.96),
    ]
    const lines = groupWhisperWordsIntoLines([
      ...junk,
      ...phrase('this is real singing', 53.6),
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].words.map((w) => w.text).join(' ')).toBe(
      'this is real singing',
    )
  })

  it('keeps a real phrase that happens to be short', () => {
    const lines = groupWhisperWordsIntoLines([seg('Oh', 10, 10.4)])
    expect(lines).toHaveLength(1)
  })

  it('splits a multi-word segment into its words', () => {
    const lines = groupWhisperWordsIntoLines([seg('Hello world', 1.5, 3)])
    expect(lines[0].words.map((w) => w.text)).toEqual(['Hello', 'world'])
  })

  it('drops empty, whitespace-only and noise-tag segments', () => {
    const lines = groupWhisperWordsIntoLines([
      seg('   ', 1, 2),
      seg('', 2, 3),
      seg('[Music]', 2.5, 3.5),
      seg('kept', 3, 4),
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].words.map((w) => w.text)).toEqual(['kept'])
  })

  it('clamps overlapping timestamps monotonically non-decreasing', () => {
    const lines = groupWhisperWordsIntoLines([
      seg('one', 5, 7),
      seg('two', 4, 6),
      seg('three', 4.5, 6.5),
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].words.map((w) => w.startSec)).toEqual([5, 5, 5])
  })

  it('drops segments with an impossible timestamp', () => {
    const lines = groupWhisperWordsIntoLines([
      seg('before', -2, 1),
      seg('zero-length', 5, 5),
      seg('kept', 6, 6.5),
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].words.map((w) => w.text)).toEqual(['kept'])
  })
})

describe('segmentsToLrc', () => {
  it('emits one LRC line per phrase, with the words stamped inline', () => {
    const out = segmentsToLrc(phrase('Heaven can wait', 12, 0.5))
    expect(out).toBe('[00:12.00]Heaven [00:12.50]can [00:13.00]wait')
  })

  it('reads back as word-timed LRC, so the draft keeps its alignment', () => {
    const out = segmentsToLrc(phrase('I never felt this way', 61, 0.4))
    const [line] = parseLrcFile(out)
    expect(line.time).toBeCloseTo(61)
    const timings = parseLrcWordTimings(line.text, line.time)
    expect(timings?.words).toEqual(['I', 'never', 'felt', 'this', 'way'])
    expect(timings?.wordTimes).toEqual([61, 61.4, 61.8, 62.2, 62.6])
  })

  it('never emits a one-word line for a multi-word phrase', () => {
    const out = segmentsToLrc([
      ...phrase('first line of the song', 10),
      ...phrase('second line of the song', 20),
    ])
    expect(out.split('\n')).toHaveLength(2)
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
