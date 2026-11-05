// ============================================================
// Lesson 15 wrap — the practice card's rest line, free play, the tease still
// ============================================================
//
// The practice card is Compose, in Sheet Music, in every version, since
// Compose asks for no voice (WEB-SPEC, Practice links; Toys 5). After
// "Effortful", "Uncomfortable" or "Just listen today" it shows Lesson 8's
// rest line above its text, which puts off only this page's sung line.
// Sing it's ending is held in memory for the visit (kit/comfort.ts
// `VisitEnding`), never stored, so a new visit opens with no rest line.
//
// Free play (Toys 1, state 7) is the staff toy again on a card of its own,
// nothing locked: its seg picks the treble staff, the bass staff or the
// grand staff (sounds.ts `FREE_STATE`), and only the grand staff's key
// strip shows Lower keys and Higher keys. A tap, a step or an arrow plays
// as in the steps, the pitch-line switch is the page's one switch, and
// every note is the page's one sound; the card off screen for 600 ms, or
// the page hidden, stops what it plays (kit/leave.ts).
//
// The tease still (Toys 8) sits in the next-lesson card's slot: five plain
// noteheads on the treble staff, up two places and back down, with no
// names, no house and nothing lit. It is drawn once, at the slot's size,
// and plays nothing.

import { VisitEnding } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { StaffToy } from '@/features/lessons/kit/staff'
import { mountStaff } from '@/features/lessons/kit/staff'
import { drawScene, emptyScene } from '@/features/lessons/kit/staff-draw'
import { noteAt } from '@/features/lessons/kit/staff-places'
import { FREE_STATE } from './sounds'

type FreeKind = keyof typeof FREE_STATE

const isKind = (k: string | undefined): k is FreeKind =>
  k === 'treble' || k === 'bass' || k === 'grand'

/** Mounts free play's staff toy and binds its seg; hands back the toy. */
export function initFreePlay(): StaffToy {
  const root = q('#freePlay')
  const toy = mountStaff(root, { state: FREE_STATE.treble, owner: NowPlaying })
  const kinds = qa<HTMLButtonElement>('[data-free-kind] [data-kind]', root)
  const keys = qa<HTMLElement>('[data-free-keys]', root)
  for (const b of kinds)
    b.addEventListener('click', () => {
      const kind = b.dataset.kind
      if (!isKind(kind) || b.getAttribute('aria-pressed') === 'true') return
      for (const o of kinds) o.setAttribute('aria-pressed', String(o === b))
      for (const k of keys) k.hidden = kind !== 'grand'
      toy.setState(FREE_STATE[kind])
    })
  onLeave(root, () => {
    toy.stop()
  })
  return toy
}

/** The tease still's notes, as places on the treble staff: G4, A4, B4, A4, G4. */
export const TEASE_PLACES: readonly number[] = [2, 3, 4, 3, 2]

/** The tease still's size, px, as lesson-15.css sets its slot. */
const TEASE_SIZE = { w: 288, h: 120 }

/**
 * The places the still makes room for: a space past each edge line, so the
 * clef, which reaches about one and a half spaces past them, fits inside.
 */
const TEASE_ROOM: readonly [number, number] = [-2, 10]

/** Draws the tease still into `el`. */
export function drawTease(el: SVGSVGElement): void {
  drawScene(
    el,
    {
      ...emptyScene('treble', TEASE_ROOM),
      marks: TEASE_PLACES.map((p, col) => ({
        note: noteAt(p, 'treble'),
        col,
        tone: 'rest',
      })),
      cols: TEASE_PLACES.length,
      small: true,
    },
    TEASE_SIZE,
  )
}

export function initWrap(): void {
  const rest = q('#practiseCard [data-ending="rest"]')
  VisitEnding.subscribe((ending) => {
    rest.hidden = ending !== 'rest'
  })
  initFreePlay()
  const tease = document.querySelector<SVGSVGElement>(
    '.l15-tease svg[data-tease-staff]',
  )
  if (tease !== null) drawTease(tease)
}
