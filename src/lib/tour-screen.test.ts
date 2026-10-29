// ============================================================
// tour-screen — a tour asks before it closes, and puts back what it set
// ============================================================
//
// The engines (Walkthrough.tsx, the coach) and the pages that name their
// detours and settings are tested where they live; this holds the rules
// they share: a tour leaves the tab only when the app lets it, asks before
// it closes what is open over its page, and restores every setting it
// changed, once, the way the singer had it.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TourDetour, TourSettingName } from './tour-screen'
import { answerTourAsk, applyTourSettings, provideTourDetour, provideTourLeave, provideTourSetting, startWhenClear, tourAsk, tourDetours, undoTourSettings, } from './tour-screen'

const taken: (() => void)[] = []
const keep = (remove: () => void): void => {
  taken.push(remove)
}

afterEach(() => {
  answerTourAsk(false)
  for (const remove of taken.splice(0)) remove()
})

/** A view the page holds: 'other' until a tour sets 'wanted'. */
function view(name: TourSettingName, start: 'wanted' | 'other' = 'other') {
  const page = { now: start, sets: 0 }
  keep(
    provideTourSetting(name, () => {
      if (page.now === 'wanted') return null
      const was = page.now
      page.now = 'wanted'
      page.sets += 1
      return () => {
        page.now = was
      }
    }),
  )
  return page
}

function drill(name: string, tab = 'exercises' as const) {
  const open = { now: true }
  const closed: string[] = []
  const detour: TourDetour = {
    name,
    close: () => {
      open.now = false
      closed.push(name)
    },
  }
  keep(
    provideTourDetour((asked) => (asked === tab && open.now ? detour : null)),
  )
  return { open, closed }
}

describe('settings', () => {
  it('sets a page for a step and puts it back once the tour ends', () => {
    const notation = view('sing.melody')
    const undo = new Map<TourSettingName, () => void>()

    expect(applyTourSettings(['sing.melody'], undo)).toBe(true)
    expect(notation.now).toBe('wanted')

    undoTourSettings(undo)
    expect(notation.now).toBe('other')
    expect(undo.size).toBe(0)
  })

  it('changes nothing, and keeps nothing to put back, for a page already set', () => {
    const melody = view('sing.melody', 'wanted')
    const undo = new Map<TourSettingName, () => void>()

    expect(applyTourSettings(['sing.melody'], undo)).toBe(false)
    expect(undo.size).toBe(0)
    undoTourSettings(undo)
    expect(melody.now).toBe('wanted')
  })

  it('puts back what the singer had, not what a later step found', () => {
    const page = view('compose.piano-roll')
    const undo = new Map<TourSettingName, () => void>()
    applyTourSettings(['compose.piano-roll'], undo)
    // The singer switched away mid-tour, and the next step set it again.
    page.now = 'other'
    applyTourSettings(['compose.piano-roll'], undo)
    expect(page.sets).toBe(2)

    undoTourSettings(undo)
    expect(page.now).toBe('other')
  })

  it('puts settings back newest first', () => {
    const order: string[] = []
    keep(provideTourSetting('sing.melody', () => () => order.push('melody')))
    keep(provideTourSetting('sing.bar', () => () => order.push('bar')))
    const undo = new Map<TourSettingName, () => void>()
    applyTourSettings(['sing.melody', 'sing.bar'], undo)

    undoTourSettings(undo)
    expect(order).toEqual(['bar', 'melody'])
  })

  it('skips a setting no page has named, and one whose page has gone', () => {
    const remove = provideTourSetting('path.ascent', () => () => undefined)
    remove()
    const undo = new Map<TourSettingName, () => void>()

    expect(applyTourSettings(['path.ascent', 'community.feed'], undo)).toBe(
      false,
    )
    expect(applyTourSettings(undefined, undo)).toBe(false)
  })

  it("keeps a newer page's setting when an older page goes", () => {
    const first = vi.fn(() => null)
    const second = vi.fn(() => null)
    const removeFirst = provideTourSetting('piano.melody', first)
    keep(provideTourSetting('piano.melody', second))
    removeFirst()

    applyTourSettings(['piano.melody'], new Map())
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })
})

describe('detours', () => {
  it('names what is open over the tabs a tour shows, each once', () => {
    drill('Long Note')
    expect(tourDetours(['singing']).map((d) => d.name)).toEqual([])
    expect(tourDetours(['exercises', 'singing', 'exercises'])).toHaveLength(1)
  })

  it('starts at once with nothing open', () => {
    const start = vi.fn()
    startWhenClear(['exercises'], 'the Exercises tour', start)

    expect(start).toHaveBeenCalledTimes(1)
    expect(tourAsk()).toBe(null)
  })

  it('asks before it closes a drill, and starts on a yes', () => {
    const longNote = drill('Long Note')
    const start = vi.fn(() => {
      // The drill is gone by the time the tour starts.
      expect(longNote.open.now).toBe(false)
    })
    startWhenClear(['exercises'], 'the Exercises tour', start)

    expect(start).not.toHaveBeenCalled()
    expect(tourAsk()).toMatchObject({ tour: 'the Exercises tour' })
    expect(tourAsk()?.detours.map((d) => d.name)).toEqual(['Long Note'])

    answerTourAsk(true)
    expect(longNote.closed).toEqual(['Long Note'])
    expect(start).toHaveBeenCalledTimes(1)
    expect(tourAsk()).toBe(null)
  })

  it('changes nothing on a no', () => {
    const longNote = drill('Long Note')
    const start = vi.fn()
    startWhenClear(['exercises'], 'the Exercises tour', start)

    answerTourAsk(false)
    expect(longNote.open.now).toBe(true)
    expect(start).not.toHaveBeenCalled()
    expect(tourAsk()).toBe(null)
  })

  it('takes a detour back when its page goes', () => {
    const remove = provideTourDetour(() => ({
      name: 'Zen',
      close: () => undefined,
    }))
    remove()
    expect(tourDetours(['singing'])).toEqual([])
  })
})

describe('leaving the tab', () => {
  it('starts nothing when the app keeps the singer where they are', () => {
    const asked: (readonly string[])[] = []
    keep(
      provideTourLeave((tabs, done) => {
        asked.push(tabs)
        done(false)
      }),
    )
    drill('Long Note')
    const start = vi.fn()
    startWhenClear(['exercises', 'singing'], 'the Exercises tour', start)

    expect(asked).toEqual([['exercises', 'singing']])
    expect(start).not.toHaveBeenCalled()
    // Nothing is asked about the drill either: the tour is not coming.
    expect(tourAsk()).toBe(null)
  })

  it('waits for the app before it asks about a detour or starts', () => {
    const app: { answer?: (ok: boolean) => void } = {}
    keep(
      provideTourLeave((_tabs, done) => {
        app.answer = done
      }),
    )
    drill('Long Note')
    const start = vi.fn()
    startWhenClear(['exercises'], 'the Exercises tour', start)
    expect(tourAsk()).toBe(null)

    app.answer?.(true)
    expect(tourAsk()?.detours.map((d) => d.name)).toEqual(['Long Note'])
    answerTourAsk(true)
    expect(start).toHaveBeenCalledTimes(1)
  })
})
