// ============================================================
// Lesson 2 free play — the whole object and every control, on one stage
// ============================================================
//
// The Wrap's playground: one copy of the object with its own lit beads
// (DECISIONS 81), switched by Spiral, Keyboard, Tiles and Ruler, with every
// control the steps had: Climb and Look down on the spiral; the keyboard as
// Unroll leaves it; Lift out the five, the names toggle, Sharp, Flat, Play
// both ways and Show the rare ones on the tiles; the ruler with One
// semitone and Glide. Nothing locks: the guided steps come first on the
// page (playbook rule 17). On a phone the stage takes the layouts of the
// steps it repeats: the keyboard's octave, step 5's close-up for the names,
// and step 4's whole row while the five are lifted.

import { q, qa } from '@/features/lessons/kit/dom'
import { bindModeToggle, Names } from '@/features/lessons/kit/names'
import { mountKeysToy } from './keys-toy'
import { mountRuler } from './ruler'

type View = 'spiral' | 'keys' | 'tiles' | 'ruler'

const VIEWS: readonly View[] = ['spiral', 'keys', 'tiles', 'ruler']

export function initFreePlay(): void {
  const root = q('#freePlay')
  const object = q('[data-fp-object]', root)
  const rulerBox = q('[data-fp-ruler]', root)
  const namesBar = q('[data-fp-names]', root)
  const toy = mountKeysToy(object, {
    tiles: [12, 24],
    phoneTiles: [14, 20],
    liftTiles: [12, 24],
    pairs: true,
    opens: 'spiral',
  })
  const ruler = mountRuler(rulerBox)
  bindModeToggle(namesBar, Names, 'data-names')

  const buttons = qa<HTMLButtonElement>('[data-fp-view]', root)
  const panels = qa<HTMLElement>('[data-fp-for]', object)

  function show(view: View): void {
    for (const b of buttons)
      b.setAttribute('aria-pressed', String(b.dataset.fpView === view))
    object.hidden = view === 'ruler'
    rulerBox.hidden = view !== 'ruler'
    namesBar.hidden = view === 'spiral' || view === 'ruler'
    for (const p of panels) p.hidden = p.dataset.fpFor !== view
    if (view !== 'ruler') ruler.stop()
    if (view === 'spiral') toy.setUnrolled(false)
    else if (view === 'keys') {
      toy.setUnrolled(true)
      toy.setStraight(false)
    } else if (view === 'tiles') toy.setStraight(true)
  }

  for (const b of buttons)
    b.addEventListener('click', () => {
      const view = VIEWS.find((v) => v === b.dataset.fpView)
      if (view !== undefined) show(view)
    })
}
