// ============================================================
// The native Progress page's words and orders, from the snapshot alone
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ProgressHistoryItemView, ProgressWeekView, } from '@/features/progress/ProgressPage'
import { historyDays, historyLine, historyWhere, inAppAction, keyboardSpan, leadNumber, linkHref, measuredRange, momentGlyph, pagerOrder, pathTag, pushedScreenFor, weekLabel, } from './progress-lines'

function week(over: Partial<ProgressWeekView> = {}): ProgressWeekView {
  return {
    id: '2026-10-26',
    shortLabel: 'Oct 26',
    rangeLabel: 'Oct 26–Nov 1',
    activityLevel: 0.5,
    activeDaysLabel: '3 active days',
    attemptsLabel: '5 attempts',
    summary: '5 scored attempts across 3 active days.',
    sources: ['weekly', 'practice'],
    coverage: 'complete',
    ...over,
  }
}

function item(
  id: string,
  occurredAtLabel: string,
  over: Partial<ProgressHistoryItemView> = {},
): ProgressHistoryItemView {
  return {
    id,
    occurredAtLabel,
    title: 'Long Note',
    context: 'Comparable attempt details',
    facts: ['78% score', '82% accuracy'],
    storageLabel: 'On this device',
    source: 'exercise',
    coverageLabel: 'Ready for like-for-like comparison',
    ...over,
  }
}

describe("a tile's figure and its words", () => {
  it('splits a label at the figure it leads with', () => {
    expect(leadNumber('3 active days')).toEqual({
      value: '3',
      words: 'active days',
    })
    expect(leadNumber('1,204 notes')).toEqual({
      value: '1,204',
      words: 'notes',
    })
  })

  it('keeps a label with no leading figure whole, as the value', () => {
    expect(leadNumber('Holding zone')).toEqual({
      value: 'Holding zone',
      words: '',
    })
  })
})

describe("the moments' order in the pager", () => {
  it('starts with the chosen moment, then the others in the record’s order', () => {
    expect(pagerOrder([], 'a', ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('keeps the order it showed when a swipe chooses another of the same moments', () => {
    // Choosing b reorders the record's list around it: b, then a and c.
    expect(pagerOrder(['a', 'b', 'c'], 'b', ['a', 'c'])).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('starts again, the chosen one first, when the record offers other moments', () => {
    expect(pagerOrder(['a', 'b', 'c'], 'd', ['a', 'e'])).toEqual([
      'd',
      'a',
      'e',
    ])
  })
})

describe('the steps the phone can follow', () => {
  it('keeps an in-app place and a step with none', () => {
    const hash = { id: 'x', label: 'Open Exercises', href: '#/exercises' }
    const step = { id: 'y', label: 'Retry' }
    expect(inAppAction(hash)).toBe(hash)
    expect(inAppAction(step)).toBe(step)
  })

  it('leaves out a page of the web app the bundle does not carry', () => {
    expect(
      inAppAction({ id: 'voice-map', label: 'Map my voice', href: '/mirror' }),
    ).toBeUndefined()
    expect(inAppAction(undefined)).toBeUndefined()
  })
})

describe('a place the phone draws as its own screen', () => {
  const constellation = {
    id: 'voice-constellation',
    label: 'Explore constellation',
    href: '#/voice-constellation',
  }

  it('pushes Voice Constellation, from the voice card and from a moment', () => {
    expect(pushedScreenFor(constellation)).toBe('voice-constellation')
    expect(
      pushedScreenFor({ ...constellation, id: 'continue:voiceprint-growth' }),
    ).toBe('voice-constellation')
    // A button, not a link: the web route would open over the whole shell.
    expect(linkHref(constellation)).toBeUndefined()
  })

  it('leaves every other place a link, and a step with none a button', () => {
    const hash = { id: 'x', label: 'Open Exercises', href: '#/exercises' }
    expect(pushedScreenFor(hash)).toBeUndefined()
    expect(linkHref(hash)).toBe('#/exercises')
    expect(linkHref({ id: 'y', label: 'Retry' })).toBeUndefined()
  })
})

describe('the history list', () => {
  it('puts a heading over each run of the same date, in the record’s order', () => {
    const days = historyDays([
      item('one', 'Nov 4, 2026'),
      item('two', 'Nov 4, 2026'),
      item('three', 'Nov 3, 2026'),
      item('four', 'Nov 4, 2026'),
    ])
    expect(
      days.map((day) => [day.label, day.items.map((entry) => entry.id)]),
    ).toEqual([
      ['Nov 4, 2026', ['one', 'two']],
      ['Nov 3, 2026', ['three']],
      ['Nov 4, 2026', ['four']],
    ])
  })

  it('says how an attempt went, and its kind only when there is no figure', () => {
    expect(historyLine(item('a', 'Nov 4'))).toBe('78% score · 82% accuracy')
    expect(historyLine(item('b', 'Nov 4', { facts: [] }))).toBe(
      'Comparable attempt details',
    )
  })

  it('says where an attempt is kept and whether it compares, once', () => {
    expect(historyWhere(item('a', 'Nov 4'))).toBe(
      'On this device · Ready for like-for-like comparison',
    )
    expect(historyWhere(item('b', 'Nov 4', { coverageLabel: undefined }))).toBe(
      'On this device · Comparable attempt details',
    )
  })
})

describe('the measured range on a keyboard', () => {
  it('reads the range the voice card states as two notes', () => {
    expect(measuredRange('C3–A4')).toEqual({ low: 48, high: 69 })
    expect(measuredRange('F#2–G4')).toEqual({ low: 42, high: 67 })
  })

  it('reads nothing it cannot be sure of', () => {
    expect(measuredRange('21 semitones')).toBeNull()
    expect(measuredRange('A4–C3')).toBeNull()
  })

  it('draws C2 to C6, wider from a C to a C for a range past either end', () => {
    expect(keyboardSpan({ low: 48, high: 69 })).toEqual({ low: 36, high: 84 })
    // E1 to E6: down to C1, up to C7.
    expect(keyboardSpan({ low: 28, high: 88 })).toEqual({ low: 24, high: 96 })
  })
})

describe("a week's bar, as a screen reader hears it", () => {
  it('names the week, its dates, its summary and its kinds of run', () => {
    expect(weekLabel(week(), 11, 13)).toBe(
      'Week 12 of 13, Oct 26–Nov 1. 5 scored attempts across 3 active days. Weekly Legend, Practice.',
    )
  })

  it('says when a week was read from part of the history, and its milestone', () => {
    const label = weekLabel(
      week({ coverage: 'partial', milestoneLabel: 'Steady Return' }),
      0,
      13,
    )
    expect(label).toContain('From the loaded history only.')
    expect(label).toContain('Milestone: Steady Return.')
  })
})

describe("a path stop's tag", () => {
  it('names the kind beside a stop the record names otherwise', () => {
    expect(pathTag('Long Note', 'exercise')).toBe('Exercise')
    expect(pathTag('The Evening Bell', 'weekly')).toBe('Weekly Legend')
  })

  it('adds none where the name is the kind already, or there is no kind', () => {
    expect(pathTag('Exercises', 'exercise')).toBeUndefined()
    expect(pathTag('Singing', 'practice')).toBeUndefined()
    expect(pathTag('Weekly Legend', 'weekly')).toBeUndefined()
    expect(pathTag('Karaoke performances', undefined)).toBeUndefined()
  })
})

describe("a moment chip's glyph", () => {
  it('follows the kind, and falls to the sparkle for a kind it does not know', () => {
    expect(momentGlyph('Consistency')).toBe('calendar')
    expect(momentGlyph('Voiceprint')).toBe('print')
    expect(momentGlyph('First reading')).toBe('sparkle')
  })
})
