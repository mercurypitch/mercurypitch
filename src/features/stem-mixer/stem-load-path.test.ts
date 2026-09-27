// ============================================================
// Which way the Karaoke room held the last song, written down
// ============================================================
//
// The Developer screen's Karaoke audio section reads this record, and the
// Audio section's Copy report carries its lines. The record is kept in
// storage and written before a whole decode starts, because that decode is
// what iOS kills the app for: a song still loading after a relaunch is the
// crash test's answer.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { audioDiagnosticEntries, resetAudioDiagnosticsForTests, } from '@/lib/audio-diagnostics'
import { createSongPathLog, describeSongPath, LAST_SONG_PATH_KEY, readLastSongPath, resetSongPathForTests, } from './stem-load-path'

const MIB = 1024 * 1024
/** Four minutes of stereo at 48 kHz, decoded: about 90 MB. */
const WHOLE = Math.round(246.3 * 48_000 * 2 * 4)

beforeEach(() => {
  localStorage.clear()
  resetAudioDiagnosticsForTests()
  resetSongPathForTests()
})

afterEach(() => {
  localStorage.clear()
  resetAudioDiagnosticsForTests()
  resetSongPathForTests()
})

const karaokeLines = () =>
  audioDiagnosticEntries().filter((entry) => entry.source === 'karaoke')

describe('a streamed song', () => {
  it('is written down as streamed, with its size, its whole decode and what it holds', () => {
    const log = createSongPathLog({ streams: true })
    for (const name of ['vocal.mp3', 'instrumental.mp3']) {
      log.decided({
        name,
        path: 'stream',
        bytes: 9 * MIB,
        wholeDecodeBytes: WHOLE,
        codec: 'mp3',
        sampleRate: 44_100,
        channelCount: 2,
      })
      log.held(name, 3 * MIB)
    }
    log.finished()

    const record = readLastSongPath()
    expect(record).toMatchObject({
      path: 'stream',
      songBytes: 18 * MIB,
      wholeDecodeBytes: 2 * WHOLE,
      residentBytes: 6 * MIB,
      codec: 'mp3',
      sampleRate: 44_100,
      channelCount: 2,
      stems: 2,
      state: 'done',
      pastGuard: false,
    })
    expect(describeSongPath(record)).toBe(
      'streamed · 18.0 MB in 2 stems · a whole decode would hold about 180.4 MB · holds 6.0 MB · mp3',
    )
  })

  it('leaves a line per step in the audio record', () => {
    const log = createSongPathLog({ streams: true })
    log.decided({
      name: 'vocal.mp3',
      path: 'stream',
      bytes: 9 * MIB,
      wholeDecodeBytes: WHOLE,
      codec: 'mp3',
    })
    log.held('vocal.mp3', 3 * MIB)
    log.finished()

    const lines = karaokeLines()
    expect(lines.map((line) => line.event)).toEqual([
      'song-open',
      'stem-stream',
      'stem-held',
      'song-path',
    ])
    expect(lines[0].detail).toEqual({ audioDecoder: 'absent', streams: true })
    expect(lines[1].detail).toMatchObject({
      stem: 'vocal.mp3',
      bytes: 9 * MIB,
      wholeDecodeMB: '90.2',
      codec: 'mp3',
    })
    expect(lines[3].detail).toMatchObject({
      path: 'stream',
      stems: 1,
      songMB: '9.0',
      residentMB: '3.0',
    })
    expect(lines.some((line) => line.failed)).toBe(false)
  })
})

describe('a refused song', () => {
  it('is written down as refused, and warned, holding nothing', () => {
    const log = createSongPathLog({ streams: false })
    log.decided({
      name: 'vocal.mp3',
      path: 'refused',
      bytes: 9 * MIB,
      wholeDecodeBytes: WHOLE,
    })
    log.finished()

    const record = readLastSongPath()
    expect(record).toMatchObject({
      path: 'refused',
      residentBytes: null,
      state: 'done',
    })
    expect(describeSongPath(record)).toBe(
      'refused by the guard · 9.0 MB in 1 stem · a whole decode would hold about 90.2 MB',
    )
    const refused = karaokeLines().filter((line) =>
      ['stem-refused', 'song-path'].includes(line.event),
    )
    expect(refused.map((line) => line.failed)).toEqual([true, true])
    expect(karaokeLines()[0].detail).toMatchObject({ streams: false })
  })
})

describe('a song decoded whole', () => {
  it('is on the record before the decode starts', () => {
    const log = createSongPathLog({ streams: false })
    log.decided({
      name: 'vocal.mp3',
      path: 'whole',
      bytes: MIB,
      wholeDecodeBytes: WHOLE,
    })

    // What a relaunch would find if the decode killed the app here.
    expect(readLastSongPath()).toMatchObject({
      path: 'whole',
      state: 'loading',
      residentBytes: null,
    })
  })

  it('says so after a relaunch when it never finished', () => {
    const log = createSongPathLog({ streams: false })
    log.decided({
      name: 'vocal.mp3',
      path: 'whole',
      bytes: 9 * MIB,
      wholeDecodeBytes: WHOLE,
      pastGuard: true,
    })
    expect(describeSongPath(readLastSongPath())).toMatch(/ · loading$/u)

    // The app dies; the next launch holds no song of its own.
    resetSongPathForTests()
    expect(describeSongPath(readLastSongPath())).toBe(
      'decoded whole past the guard (crash test) · 9.0 MB in 1 stem · whole decode about 90.2 MB · never finished: the app restarted while holding it',
    )
  })

  it('says what it holds once it survives', () => {
    const log = createSongPathLog({ streams: false })
    log.decided({
      name: 'vocal.mp3',
      path: 'whole',
      bytes: MIB,
      wholeDecodeBytes: WHOLE,
    })
    log.held('vocal.mp3', WHOLE)
    log.finished()

    expect(readLastSongPath()).toMatchObject({
      state: 'done',
      residentBytes: WHOLE,
    })
    expect(describeSongPath(readLastSongPath())).toBe(
      'decoded whole · 1.0 MB in 1 stem · whole decode about 90.2 MB · holds 90.2 MB',
    )
  })
})

describe('a song held two ways', () => {
  it('is mixed, and its whole decode is unknown when one stem could not be read', () => {
    const log = createSongPathLog({ streams: true })
    log.decided({
      name: 'vocal.mp3',
      path: 'stream',
      bytes: MIB,
      wholeDecodeBytes: WHOLE,
    })
    log.decided({
      name: 'instrumental.ogg',
      path: 'whole',
      bytes: MIB,
      wholeDecodeBytes: null,
    })
    log.finished()

    const record = readLastSongPath()
    expect(record).toMatchObject({ path: 'mixed', wholeDecodeBytes: null })
    expect(describeSongPath(record)).toContain(
      'streamed in part, decoded whole in part',
    )
    expect(describeSongPath(record)).toContain('whole decode: unknown')
  })
})

describe('the record', () => {
  it('is empty until a song is opened', () => {
    expect(readLastSongPath()).toBeNull()
    expect(describeSongPath(null)).toBe(
      'none yet: open a song in the Karaoke room',
    )
  })

  it('ignores what it cannot read', () => {
    localStorage.setItem(LAST_SONG_PATH_KEY, 'not json')
    expect(readLastSongPath()).toBeNull()
    localStorage.setItem(LAST_SONG_PATH_KEY, JSON.stringify({ path: 1 }))
    expect(readLastSongPath()).toBeNull()
  })

  it('is finished once, however often the room says so', () => {
    const log = createSongPathLog({ streams: true })
    log.finished()
    log.finished()
    expect(
      karaokeLines().filter((line) => line.event === 'song-path'),
    ).toHaveLength(1)
  })
})
