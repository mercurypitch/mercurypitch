// ============================================================
// Lesson 2 sing it — Merc's slide, the octave-up slide and the guide
// ============================================================
//
// Four lanes, G♯, A, A♯ and B, pitch as height (the kit's slide guide),
// beside the kit's breathing ring. Play Merc's slide sounds Merc's "ooh"
// along FACTS 50's contour, A3 held, up one lane, held and back in 4.2 s;
// Play it an octave up does the same on A4 (FACTS 51). While a slide plays
// its path lights in the app's target amber and the ring shows the still of
// the Merc singing it, blue for A3 and orange for A4; then it rests in
// chrome. Start the guide is the viewer's turn, enabled once a slide has
// been heard: a one-second count-in, then a chrome line sweeps the lanes
// along the path while the ring breathes. Nothing listens, nothing is
// scored. The lanes' names follow the page's spelling, and the guide's
// accessible name says them in words.

import { q, qa } from '@/features/lessons/kit/dom'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { Names, namesFor } from '@/features/lessons/kit/names'
import { hz, nameHtml, wordName } from '@/features/lessons/kit/notes'
import type { Ring, RingStills } from '@/features/lessons/kit/sing'
import { mountRing } from '@/features/lessons/kit/sing'
import type { GuidePoint, GuideRow } from '@/features/lessons/kit/slide-guide'
import { mountGuide } from '@/features/lessons/kit/slide-guide'
import { playContour, Sound } from '@/features/lessons/kit/sound'
import { slide } from './examples'

/** The slide's length, seconds (FACTS 50), and the count-in before the viewer's turn. */
const SLIDE_S = 4.2
const COUNT_IN_S = 1

/** Merc's path for a slide on `root`: A held, up one lane, held, and back (FACTS 50). */
export function slidePath(root: number): GuidePoint[] {
  return [
    { t: 0, midi: root },
    { t: 1.2, midi: root },
    { t: 1.7, midi: root + 1 },
    { t: 2.7, midi: root + 1 },
    { t: 3.2, midi: root },
    { t: SLIDE_S, midi: root },
  ]
}

/** The four lanes around a slide on `root` (an A): G♯, A, A♯ and B, the two the path skips faint. */
export function slideLanes(root: number): GuideRow[] {
  return [root + 2, root + 1, root, root - 1].map((midi) => ({
    midi,
    label: namesFor(midi, Names.mode)
      .map((n) => nameHtml(n))
      .join('<br />'),
    faint: midi === root - 1 || midi === root + 2,
  }))
}

/** The guide's accessible name: its lanes in words, low to high, and Merc's path. */
export function guideLabel(root: number): string {
  const say = (midi: number): string =>
    namesFor(midi, Names.mode)
      .map((n) => wordName(n))
      .join(' or ')
  const lanes = [root - 1, root, root + 1, root + 2].map(say)
  return (
    `Four rows, ${lanes[0]}, ${lanes[1]}, ${lanes[2]} and ${lanes[3]}, pitch as height, ` +
    `with Merc's path: ${lanes[1]} held, up one row to ${lanes[2]}, held, and back to ${lanes[1]}.`
  )
}

/** The ring's label for a slide: "A3 · 220 Hz". */
const ringLabel = (root: number): string =>
  `${nameHtml(namesFor(root)[0])} · ${Math.round(hz(root))} Hz`

export function initSing(stills: RingStills): void {
  const section = q('#sing')
  const guideRoot = q('#slideGuide', section)
  const startBtn = q<HTMLButtonElement>('[data-guide-start]', section)
  const slides = qa<HTMLButtonElement>('[data-slide]', section)
  const ring: Ring = mountRing(q('.ring', section), {
    stills,
    words: { done: 'Again whenever you like' },
  })
  let root = 57
  let heard = false
  const guide = mountGuide(guideRoot, {
    rows: slideLanes(root),
    path: slidePath(root),
  })

  function relabel(): void {
    guide.set(slideLanes(root), slidePath(root))
    guideRoot.setAttribute('aria-label', guideLabel(root))
  }
  Names.subscribe(relabel)

  const busy = (): boolean => guide.busy || ring.busy
  const which = (): Which => (root === 57 ? 'blue' : 'orange')

  function playSlide(b: HTMLButtonElement): void {
    if (busy()) return
    root = Number(b.dataset.slide)
    relabel()
    const audible = Sound.canPlay()
    b.classList.add('is-on')
    void playContour(slide(root), { kind: 'merc', audible })
    void ring.run({
      which: which(),
      label: ringLabel(root),
      listen: SLIDE_S,
      turn: 0,
    })
    void guide.model().then(() => {
      b.classList.remove('is-on')
      heard = true
      startBtn.setAttribute('aria-disabled', 'false')
    })
  }
  for (const b of slides) b.addEventListener('click', () => playSlide(b))

  startBtn.addEventListener('click', () => {
    if (!heard || busy()) return
    startBtn.classList.add('is-on')
    void ring.run({
      which: which(),
      label: ringLabel(root),
      listen: COUNT_IN_S,
      turn: SLIDE_S,
      ripples: false,
      words: { listen: 'Get ready' },
    })
    void guide.sweep(COUNT_IN_S).then(() => startBtn.classList.remove('is-on'))
  })
}
