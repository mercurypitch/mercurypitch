// ============================================================
// Field above keyboard — a focused field lifted clear of a phone's keyboard
// ============================================================
//
// jsdom has no visual viewport, no layout and no scrollBy, so the three are
// stood in for: a viewport whose height drops by a keyboard's, a region that
// fills a 390x844 screen, and a field whose box moves up as the region
// scrolls. The numbers are the onboarding plan's Q3 on that screen: the
// typed line at 724-772, a 336 px keyboard, so 508 px left in view. The room
// is read as the region's stylesheet reads it: the attribute that shows the
// spacer, and the spacer's height.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FIELD_MARGIN_PX, keepFieldAboveKeyboard, ROOM_ATTRIBUTE, ROOM_PROPERTY, } from './field-above-keyboard'

const SCREEN = 844
const KEYBOARD = 336
const FIELD_TOP = 724
const FIELD_HEIGHT = 48
/** The region's own padding at its foot, which the room never touches. */
const FOOT = 6
/** The room the keyboard calls for: all it covers of the region, and the margin. */
const ROOM: Room = [true, `${KEYBOARD + FIELD_MARGIN_PX}px`]
const NO_ROOM: Room = [false, '']

/** A visual viewport whose height is the screen's less the keyboard's. */
class StandInViewport extends EventTarget {
  keyboard = 0
  offsetTop = 0
  offsetLeft = 0
  width = 390
  scale = 1
  get height(): number {
    return SCREEN - this.keyboard
  }
  raise(px: number): void {
    this.keyboard = px
    this.dispatchEvent(new Event('resize'))
  }
}

interface Stage {
  region: HTMLDivElement
  field: HTMLInputElement
  /** Every scroll the region was asked for. */
  scrolls: ScrollToOptions[]
  /** The field's box, where the region's scroll has put it. */
  fieldBox: () => DOMRect
  stop: () => void
}

/** Whether the region shows its spacer, and the spacer's height. */
type Room = [shown: boolean, height: string]

function roomOf(region: HTMLElement): Room {
  return [
    region.hasAttribute(ROOM_ATTRIBUTE),
    region.style.getPropertyValue(ROOM_PROPERTY),
  ]
}

let viewport: StandInViewport
let stages: Stage[] = []

/** A region filling the screen, with one text field in it and a button. */
function stage(fieldTop = FIELD_TOP): Stage {
  const region = document.createElement('div')
  region.style.paddingBottom = `${FOOT}px`
  const field = document.createElement('input')
  field.type = 'text'
  region.append(field, document.createElement('button'))
  document.body.append(region)
  const fieldBox = (): DOMRect =>
    new DOMRect(0, fieldTop - region.scrollTop, 390, FIELD_HEIGHT)
  region.getBoundingClientRect = () => new DOMRect(0, 0, 390, SCREEN)
  field.getBoundingClientRect = fieldBox
  const scrolls: ScrollToOptions[] = []
  region.scrollBy = ((options: ScrollToOptions) => {
    scrolls.push(options)
    region.scrollTop += options.top ?? 0
  }) as typeof region.scrollBy
  const s = { region, field, scrolls, fieldBox, stop: () => {} }
  s.stop = keepFieldAboveKeyboard(region)
  stages.push(s)
  return s
}

/** The px of the field's box outside what is seen, 0 when it is all in view. */
function outOfView(box: DOMRect): number {
  const top = viewport.offsetTop
  const bottom = top + viewport.height
  return Math.max(0, box.bottom - bottom) + Math.max(0, top - box.top)
}

beforeEach(() => {
  viewport = new StandInViewport()
  vi.stubGlobal('visualViewport', viewport)
})

afterEach(() => {
  for (const s of stages) {
    s.stop()
    s.region.remove()
  }
  stages = []
  vi.unstubAllGlobals()
})

describe('a focused field when the keyboard comes up', () => {
  it('is lifted into what the keyboard leaves in view, the margin under it', () => {
    // Arrange
    const s = stage()
    s.field.focus()

    // Act
    viewport.raise(KEYBOARD)

    // Assert
    expect(s.fieldBox().bottom).toBe(SCREEN - KEYBOARD - FIELD_MARGIN_PX)
  })

  it('gives the region room at its foot for all the keyboard covers', () => {
    // Arrange
    const s = stage()
    s.field.focus()

    // Act
    viewport.raise(KEYBOARD)

    // Assert
    expect(roomOf(s.region)).toEqual(ROOM)
  })

  it('stays where it is when the keyboard leaves it in view', () => {
    // Arrange
    const s = stage(200)
    s.field.focus()

    // Act
    viewport.raise(KEYBOARD)

    // Assert
    expect(s.scrolls).toEqual([])
  })

  it('leaves alone a field the browser has panned into view itself', () => {
    // Arrange: the browser shows the foot of the page as the keyboard rises
    const s = stage()
    s.field.focus()
    viewport.offsetTop = KEYBOARD

    // Act
    viewport.raise(KEYBOARD)

    // Assert
    expect([outOfView(s.fieldBox()), s.scrolls]).toEqual([0, []])
  })

  it('glides up by default', () => {
    // Arrange
    const s = stage()
    s.field.focus()

    // Act
    viewport.raise(KEYBOARD)

    // Assert
    expect(s.scrolls.map((o) => o.behavior)).toEqual(['smooth'])
  })

  it('jumps instead of gliding under reduced motion', () => {
    // Arrange
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    }))
    const s = stage()
    s.field.focus()

    // Act
    viewport.raise(KEYBOARD)

    // Assert
    expect(s.scrolls.map((o) => o.behavior)).toEqual(['auto'])
  })
})

describe('letting go', () => {
  it('stops lifting the field once it has lost focus', () => {
    // Arrange: lifted once, then blurred
    const s = stage()
    s.field.focus()
    viewport.raise(KEYBOARD)
    s.field.blur()
    const before = s.scrolls.length

    // Act: a taller keyboard, which would lift a followed field further
    viewport.raise(KEYBOARD + 100)

    // Assert
    expect(s.scrolls).toHaveLength(before)
  })

  it('keeps the room through a blur, so a tap under way does not move', () => {
    // Arrange
    const s = stage()
    s.field.focus()
    viewport.raise(KEYBOARD)

    // Act
    s.field.blur()

    // Assert
    expect(roomOf(s.region)).toEqual(ROOM)
  })

  it('gives the room back once the keyboard has gone', () => {
    // Arrange: blurred with the keyboard still up
    const s = stage()
    s.field.focus()
    viewport.raise(KEYBOARD)
    s.field.blur()

    // Act
    viewport.raise(0)

    // Assert
    expect(roomOf(s.region)).toEqual(NO_ROOM)
  })

  it('gives the room back at once, and lifts nothing more, once stopped', () => {
    // Arrange
    const s = stage()
    s.field.focus()
    viewport.raise(KEYBOARD)
    const before = s.scrolls.length

    // Act
    s.stop()
    viewport.raise(KEYBOARD + 100)

    // Assert
    expect([roomOf(s.region), s.scrolls.length]).toEqual([NO_ROOM, before])
  })

  it('touches nothing, and throws nothing, where there is no visual viewport', () => {
    // Arrange
    vi.stubGlobal('visualViewport', null)
    const s = stage()
    const errors: unknown[] = []
    const onError = (e: ErrorEvent): void => {
      errors.push(e.error)
    }
    window.addEventListener('error', onError)

    // Act
    s.field.focus()

    // Assert
    window.removeEventListener('error', onError)
    expect([errors, roomOf(s.region), s.scrolls]).toEqual([[], NO_ROOM, []])
  })

  it("leaves the region's own padding exactly as it found it throughout", () => {
    // Arrange
    const s = stage()
    const seen: string[] = []
    const look = (): void => {
      seen.push(s.region.style.paddingBottom)
    }

    // Act: a whole visit, from the keyboard coming up to the region stopping
    s.field.focus()
    viewport.raise(KEYBOARD)
    look()
    s.field.blur()
    look()
    viewport.raise(0)
    look()
    s.stop()
    look()

    // Assert
    expect(seen).toEqual(Array(4).fill(`${FOOT}px`))
  })
})
