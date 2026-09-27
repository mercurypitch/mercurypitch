// Studio contracts — imported courses keep the same runtime semantics and bounded authoring options.

import { describe, expect, it } from 'vitest'
import thawing from '../content/data/cloudway-thawing-song.course.json'
import { THAWING_SONG_PROFILES } from '../content/thawing-song-profiles'
import { cloudwayStudioCatalog, compileStudioDocument, summarizeStudioDocument, } from './cloudway-studio'
import { compileCloudwayCourseDocument } from './compile-cloudway-course'

describe('Cloudway studio', () => {
  it('round trips the complete source and compiles identically to the game', () => {
    const imported = JSON.parse(JSON.stringify(thawing))
    expect(compileStudioDocument(imported)).toEqual(
      compileCloudwayCourseDocument(thawing, THAWING_SONG_PROFILES),
    )
    expect(imported).toEqual(thawing)
    expect(summarizeStudioDocument(imported)[0]).toMatchObject({
      id: 'cloudway-thawing-song-audition',
      encounters: 6,
      melodyLessonId: thawing.courses[0]!.melodyLesson.id,
    })
  })

  it('exports measured profiles and independent, compilable example snapshots', () => {
    const catalog = cloudwayStudioCatalog()
    expect(
      catalog.platforms.find((p) => p?.id === 'gilt-scroll'),
    ).toMatchObject({ scrollLocalAxis: 'x' })
    expect(catalog.melodyLessons).toHaveLength(4)
    for (const example of catalog.examples)
      expect(compileStudioDocument(example.document).length).toBeGreaterThan(0)
    catalog.examples[0]!.document.courses[0]!.title =
      'Changed in private editor'
    expect(
      cloudwayStudioCatalog().examples[0]!.document.courses[0]!.title,
    ).not.toBe('Changed in private editor')
  })

  it('accepts certified pace/root offsets without mutating the profile or source', () => {
    const source = structuredClone(thawing)
    Object.assign(source.courses[0]!.melodyLesson, {
      defaultPace: 0.8,
      comfortableOffsetSemitones: -3,
    })
    const lesson = compileStudioDocument(source)[0]!.melodyLesson!
    expect(lesson.defaultPace).toBe(0.8)
    expect(lesson.comfortableOffsetSemitones).toBe(-3)
    expect(compileStudioDocument(thawing)[0]!.melodyLesson!.defaultPace).toBe(
      1.25,
    )
  })

  it.each([
    { defaultPace: 2 },
    { defaultPace: null },
    { comfortableOffsetSemitones: 13 },
    { comfortableOffsetSemitones: -13 },
    { comfortableOffsetSemitones: 0.5 },
    { rootMidi: 60 },
  ])('rejects unsupported lesson options %j', (override) => {
    const source = structuredClone(thawing)
    Object.assign(source.courses[0]!.melodyLesson, override)
    expect(() => compileStudioDocument(source)).toThrow()
  })

  it('rejects imported prerequisite bypasses through the real compiler', () => {
    const source = structuredClone(thawing)
    source.courses[0]!.exit.requiresCompleted = []
    expect(() => compileStudioDocument(source)).toThrow('whole-melody finale')
  })

  it('bounds empty courses and oversized graphs before expensive compilation', () => {
    expect(() => compileStudioDocument({ ...thawing, courses: [] })).toThrow(
      'At least one',
    )
    expect(() =>
      compileStudioDocument({
        ...thawing,
        courses: Array(9).fill(thawing.courses[0]),
      }),
    ).toThrow('at most 8')
    const source = structuredClone(thawing)
    source.courses[0]!.platforms = Array(257).fill(
      source.courses[0]!.platforms[0],
    )
    expect(() => compileStudioDocument(source)).toThrow('at most 256')
  })
})
