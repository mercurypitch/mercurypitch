// ============================================================
// Lesson 2 entrance — the copy reads in, Merc and Tavi land, the bubbles speak
// ============================================================
//
// One short shot on the night stage: the kicker, the question and the rest
// of the copy rise in reading order, the stage pushes in a little, the
// floor line draws out under the hero spiral, and Merc and Tavi drop onto
// it (Merc first, Tavi about 0.4 s later, each with a squash and a ring on
// the floor) once their live mounts settle, or after 1.4 s with the stills.
// Then the bubbles speak in the film's order, Tavi's guess and Merc's
// reply. A deep link, a page already scrolled or reduced motion skips all of
// it, and the stills settle in place.
//
// The shot has ended once both have landed and both bubbles are up: their
// animations' own finish, not a guess at the time. On the visit that offers
// the welcome tour, the page holds still until then and the tour waits for
// it (kit/opening-hold.ts).

import { q, qa } from '@/features/lessons/kit/dom'
import { mercsReady } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { holdForOpening } from '@/features/lessons/kit/opening-hold'
import { EASE } from '@/features/lessons/kit/reveal'

/** Fades and lifts `els` in from `keyframe`, one after another. */
function riseIn(
  els: readonly Element[],
  keyframe: Keyframe,
  seconds: number,
  o: { delay?: number; stagger?: number } = {},
): void {
  els.forEach((el, i) =>
    el.animate([keyframe, {}], {
      duration: seconds * 1000,
      delay: ((o.delay ?? 0) + i * (o.stagger ?? 0)) * 1000,
      easing: EASE.expoOut,
      fill: 'backwards',
    }),
  )
}

/** A landing from `above` px: the fall, a squash on the floor, the settle. */
const landing = (above: number): Keyframe[] => [
  { transform: `translateY(${above}px) scale(1, 1)`, easing: EASE.power2In },
  {
    transform: 'translateY(0px) scale(1.12, 0.84)',
    offset: 0.42,
    easing: 'cubic-bezier(.34, 1.56, .64, 1)',
  },
  { transform: 'translateY(0px) scale(1, 1)' },
]

/** Drops Merc and Tavi and has the bubbles speak; settles once all four are done. */
function dropMercs(stage: HTMLElement, duo: HTMLElement): Promise<void> {
  const mercs = [q('#mercBlue'), q('#mercOrange')]
  const bubbles = [q('#bubbleO'), q('#bubbleB')]
  const heights = mercs.map(
    (el) =>
      -(
        el.getBoundingClientRect().bottom -
        stage.getBoundingClientRect().top +
        16
      ),
  )
  mercs.forEach((el, i) => {
    el.style.transform = `translateY(${heights[i]}px)`
    el.classList.add('dropping')
  })
  for (const b of bubbles) b.style.opacity = '0'
  const t0 = performance.now()
  let end = (): void => undefined
  const ended = new Promise<void>((resolve) => {
    end = resolve
  })
  let dropped = false
  const drop = (): void => {
    if (dropped) return
    dropped = true
    duo.classList.remove('pending')
    const at = Math.max(0, 0.4 - (performance.now() - t0) / 1000)
    const shot: Animation[] = []
    mercs.forEach((el, i) => {
      const start = at + i * 0.42
      el.style.transformOrigin = '50% 83.5%'
      shot.push(
        el.animate(landing(heights[i]), {
          duration: 1150,
          delay: start * 1000,
          fill: 'backwards',
        }),
      )
      el.style.transform = ''
      window.setTimeout(
        () => {
          el.classList.remove('dropping')
          el.style.transformOrigin = ''
        },
        (start + 1.15) * 1000,
      )
      el.querySelector('.splash')?.animate(
        [
          { transform: 'scale(.35)', opacity: 0.85 },
          { transform: 'scale(1.7)', opacity: 0 },
        ],
        { duration: 900, delay: (start + 0.48) * 1000, easing: EASE.power2Out },
      )
    })
    // Tavi speaks first, Merc answers about 1.4 s later
    bubbles.forEach((b, i) => {
      b.style.opacity = ''
      shot.push(
        b.animate(
          [
            { opacity: 0, transform: 'translateY(10px) scale(.94)' },
            { opacity: 1, transform: 'none' },
          ],
          {
            duration: 600,
            delay: (at + (i === 0 ? 1.35 : 2.75)) * 1000,
            easing: EASE.expoOut,
            fill: 'backwards',
          },
        ),
      )
    })
    void Promise.all(shot.map((a) => a.finished)).then(end, end)
  }
  void Promise.race([
    mercsReady,
    new Promise((resolve) => window.setTimeout(resolve, 1400)),
  ]).then(drop)
  return ended
}

export function initEntrance(): void {
  const duo = q('#duo')
  const stage = q('#heroStage')
  const deep = window.location.hash.length > 1
  if (reducedMotion() || deep || window.scrollY >= 40) {
    void mercsReady.then(() => duo.classList.remove('pending'))
    return
  }
  riseIn(
    qa('#heroKicker > *'),
    { transform: 'translateY(8px)', opacity: 0 },
    0.7,
    {
      stagger: 0.04,
    },
  )
  riseIn([q('#hook')], { transform: 'translateY(22px)', opacity: 0 }, 1.1, {
    delay: 0.12,
  })
  riseIn(
    qa('.hero .meta > *, .hero .promise, #gate'),
    { transform: 'translateY(12px)', opacity: 0 },
    0.8,
    { delay: 0.5, stagger: 0.05 },
  )
  q('#stageShot').animate(
    [{ transform: 'translateY(10px) scale(1.05)' }, { transform: 'none' }],
    { duration: 2400, easing: EASE.power3Out },
  )
  riseIn([q('.duo .floor')], { transform: 'scaleX(.3)', opacity: 0 }, 1.4, {
    delay: 0.15,
  })
  riseIn(
    [q('#heroSpiral')],
    { opacity: 0, transform: 'translateY(14px)' },
    1.2,
    {
      delay: 0.3,
    },
  )
  riseIn([q('#predict')], { transform: 'translateY(20px)' }, 0.9, {
    delay: 0.6,
  })
  holdForOpening(dropMercs(stage, duo))
}
