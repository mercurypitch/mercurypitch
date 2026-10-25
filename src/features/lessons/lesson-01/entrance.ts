// ============================================================
// Lesson 1 entrance — one shot: the camera pushes in, Merc and Tavi drop
// ============================================================
//
// The copy reads in order (kicker, the question, the rest) while the camera
// pushes in slowly on the night stage. Merc and Tavi wait above the frame until
// their live mounts settle (or 1.4 s, then the stills fall): Merc lands first
// and Tavi about 0.4 s later, each with a squash, a jelly settle and a ring
// on the floor; then the bubbles speak in the film's order. A deep link, a
// scrolled page or reduced motion skips all of it.
//
// The shot has ended once both have landed and both bubbles are up: their
// animations' own finish, not a guess at the time. On the visit that offers
// the welcome tour, the page holds still until then and the tour waits for
// it (kit/opening-hold.ts).

import { q, qa } from '@/features/lessons/kit/dom'
import { mercsReady } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { holdForOpening } from '@/features/lessons/kit/opening-hold'
import { EASE, easeOut2, easeOut3, elasticOut, tweenTo, } from '@/features/lessons/kit/reveal'
import { heroCamera } from './hero'

function fromState(
  els: Element[],
  keyframe: Keyframe,
  seconds: number,
  opts: { delay?: number; stagger?: number; easing?: string } = {},
): void {
  els.forEach((el, i) =>
    el.animate([keyframe, {}], {
      duration: seconds * 1000,
      delay: ((opts.delay ?? 0) + i * (opts.stagger ?? 0)) * 1000,
      easing: opts.easing ?? EASE.expoOut,
      fill: 'backwards',
    }),
  )
}

/** A landing: the fall (power2.in), then the squash and elastic settle, as one keyframe list. */
function landing(above: number): Keyframe[] {
  const fall = 0.52
  const settle = 0.75
  const total = fall + settle
  // one function list throughout, so every segment interpolates as written
  const frames: Keyframe[] = [
    {
      transform: `translateY(${above}px) scale(1, 1)`,
      offset: 0,
      easing: EASE.power2In,
    },
    { transform: 'translateY(0px) scale(1, 1)', offset: fall / total },
  ]
  for (let i = 0; i <= 24; i++) {
    const e = elasticOut(i / 24)
    const sy = 0.8 + 0.2 * e
    const sx = 1.14 - 0.14 * e
    frames.push({
      transform: `translateY(0px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
      offset: (fall + (settle * i) / 24) / total,
    })
  }
  return frames
}

export function initEntrance(): void {
  const duo = q('#duo')
  const stage = q('#heroStage')
  const shot = q('#stageShot')
  const settleStills = (): void => {
    void mercsReady.then(() => duo.classList.remove('pending'))
  }
  const deep = window.location.hash.length > 1
  if (reducedMotion() || deep || window.scrollY >= 40) {
    heroCamera.intro = 1
    heroCamera.cam = 1
    settleStills()
    return
  }
  heroCamera.intro = 0
  heroCamera.cam = 0
  let end = (): void => undefined
  holdForOpening(
    new Promise<void>((resolve) => {
      end = resolve
    }),
  )
  fromState(
    qa('#heroKicker > *'),
    { transform: 'translateY(8px)', opacity: 0 },
    0.7,
    { stagger: 0.04 },
  )
  fromState([q('#hook')], { transform: 'translateY(22px)', opacity: 0 }, 1.1, {
    delay: 0.12,
  })
  fromState(
    qa('.hero .meta > *, .hero .promise, #gate'),
    { transform: 'translateY(12px)', opacity: 0 },
    0.8,
    {
      delay: 0.5,
      stagger: 0.05,
    },
  )
  shot.animate(
    [{ transform: 'translateY(12px) scale(1.08)' }, { transform: 'none' }],
    {
      duration: 2800,
      easing: EASE.power3Out,
    },
  )
  tweenTo(heroCamera, 'cam', 2.8, easeOut3)
  tweenTo(heroCamera, 'intro', 1.6, easeOut2, 0.35)
  fromState([q('.duo .floor')], { transform: 'scaleX(.3)', opacity: 0 }, 1.4, {
    delay: 0.15,
  })
  q('#heroRail').animate(
    [
      { transform: 'scaleY(.2)', transformOrigin: '50% 60%', opacity: 0 },
      { transform: 'none', transformOrigin: '50% 60%', opacity: 1 },
    ],
    { duration: 900, delay: 1000, easing: EASE.expoOut, fill: 'backwards' },
  )
  fromState([q('#predict')], { transform: 'translateY(20px)' }, 0.9, {
    delay: 0.6,
  })
  // a hidden tab stalls requestAnimationFrame: never leave the hero half drawn
  window.setTimeout(() => {
    heroCamera.intro = 1
    heroCamera.cam = 1
  }, 3400)

  const mercs = [q('#mercBlue'), q('#mercOrange')]
  const bubbles = [q('#bubbleO'), q('#bubbleB')]
  const above = (el: HTMLElement): number =>
    -(
      el.getBoundingClientRect().bottom -
      stage.getBoundingClientRect().top +
      16
    )
  const heights = mercs.map(above)
  mercs.forEach((el, i) => {
    el.style.transform = `translateY(${heights[i]}px)`
    el.classList.add('dropping')
  })
  bubbles.forEach((b) => {
    b.style.opacity = '0'
    b.style.transform = 'translateY(10px) scale(.94)'
  })
  const t0 = performance.now()
  let dropped = false
  const drop = (): void => {
    if (dropped) return
    dropped = true
    duo.classList.remove('pending')
    // never before the shot has begun
    const at = Math.max(0, 0.4 - (performance.now() - t0) / 1000)
    // the landings and the bubbles: the shot has ended when all four have
    const shot: Animation[] = []
    mercs.forEach((el, i) => {
      const start = at + i * 0.42
      const splash = q('.splash', el)
      el.style.transformOrigin = '50% 83.5%'
      const fall = el.animate(landing(heights[i]), {
        duration: 1270,
        delay: start * 1000,
        fill: 'backwards',
      })
      shot.push(fall)
      el.style.transform = ''
      window.setTimeout(
        () => el.classList.remove('dropping'),
        (start + 0.52) * 1000,
      )
      void fall.finished.then(() => {
        el.style.transformOrigin = ''
      })
      splash.animate(
        [
          { transform: 'scale(.35)', opacity: 0.85 },
          { transform: 'scale(1.7)', opacity: 0 },
        ],
        { duration: 900, delay: (start + 0.52) * 1000, easing: EASE.power2Out },
      )
    })
    // the conversation in film order: Tavi speaks, Merc answers about 1.4 s later
    bubbles.forEach((b, i) => {
      b.style.transformOrigin = i === 0 ? '80% 100%' : '20% 100%'
      const speak = b.animate(
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
      )
      shot.push(speak)
      b.style.opacity = ''
      b.style.transform = ''
      void speak.finished.then(() => {
        b.style.transformOrigin = ''
      })
    })
    void Promise.all(shot.map((a) => a.finished)).then(end, end)
  }
  void Promise.race([
    mercsReady,
    new Promise((resolve) => window.setTimeout(resolve, 1400)),
  ]).then(drop)
}
