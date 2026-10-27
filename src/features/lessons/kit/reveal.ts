// ============================================================
// Lesson reveals — the page's motion, on the browser's own animations
// ============================================================
//
// Each section enters once, as it scrolls into view, with its own
// vocabulary: a movement head slides its tempo marking in and raises its
// title, its staff engraves itself left to right, cards land from a little
// depth. Web Animations with `fill: 'backwards'` hold the first frame until a
// stagger's delay runs out and leave no inline style behind, so a page whose
// script never runs simply shows everything where it belongs. Nothing here
// runs under prefers-reduced-motion.

import { qa } from './dom'
import { reducedMotion } from './motion-switch'

/** The GSAP curves the page was designed with, as CSS cubic-beziers. */
export const EASE = {
  expoOut: 'cubic-bezier(.16, 1, .3, 1)',
  power3Out: 'cubic-bezier(.215, .61, .355, 1)',
  power2Out: 'cubic-bezier(.33, 1, .68, 1)',
  power2In: 'cubic-bezier(.32, 0, .67, 0)',
} as const

/** power3.out and power2.out as functions, for values a canvas reads. */
export const easeOut3 = (t: number): number => 1 - (1 - t) ** 3
export const easeOut2 = (t: number): number => 1 - (1 - t) ** 2
/** expo.out as a function, the curve `EASE.expoOut` draws in CSS, for a canvas's spread and fold. */
export const easeOutExpo = (t: number): number =>
  t >= 1 ? 1 : 1 - 2 ** (-10 * t)

/** GSAP's elastic.out(amplitude 1, period p). */
export function elasticOut(t: number, period = 0.45): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const s = period / 4
  return 2 ** (-10 * t) * Math.sin(((t - s) * 2 * Math.PI) / period) + 1
}

/** Tweens `obj[key]` to 1 over `seconds` with `ease`, driven by requestAnimationFrame. */
export function tweenTo<K extends string>(
  obj: Record<K, number>,
  key: K,
  seconds: number,
  ease: (t: number) => number,
  delay = 0,
): void {
  const from = obj[key]
  const t0 = performance.now() + delay * 1000
  const frame = (now: number): void => {
    const u = Math.min(1, Math.max(0, (now - t0) / (seconds * 1000)))
    obj[key] = from + (1 - from) * ease(u)
    if (u < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/** Runs `fn` once, when the top of `el` crosses `percent` of the viewport's height. */
export function onEnter(el: Element, percent: number, fn: () => void): void {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      fn()
    },
    { rootMargin: `0px 0px -${100 - percent}% 0px` },
  )
  io.observe(el)
}

function from(
  el: Element,
  keyframe: Keyframe,
  seconds: number,
  opts: { delay?: number; easing?: string } = {},
): void {
  el.animate([keyframe, {}], {
    duration: seconds * 1000,
    delay: (opts.delay ?? 0) * 1000,
    easing: opts.easing ?? EASE.expoOut,
    fill: 'backwards',
  })
}

/** Every section's entrance. Call once, after the markup is in place. */
export function initReveals(): void {
  if (reducedMotion()) return
  for (const head of qa('.mv-head')) {
    onEnter(head, 90, () => {
      const tempo = head.querySelector('.mv-tempo')
      const title = head.querySelector('.mv-title')
      const lede = head.querySelector('.mv-lede')
      if (tempo) from(tempo, { transform: 'translateX(-22px)' }, 0.9)
      if (title)
        from(title, { transform: 'translateY(26px)' }, 1, { delay: 0.08 })
      if (lede)
        from(lede, { transform: 'translateY(14px)' }, 0.9, { delay: 0.18 })
    })
  }
  for (const staff of qa('.mv-staff')) {
    onEnter(staff, 96, () =>
      staff.animate(
        [
          { clipPath: 'inset(-48px 100% -48px 0)' },
          { clipPath: 'inset(-48px 0% -48px 0)' },
        ],
        { duration: 1400, easing: EASE.power3Out, fill: 'backwards' },
      ),
    )
  }
  // the three tickets are dealt one by one, each settling from a slight tilt
  const tickets = qa('.tickets > *')
  if (tickets.length > 0) {
    onEnter(tickets[0].parentElement ?? tickets[0], 92, () =>
      tickets.forEach((t, i) =>
        from(
          t,
          {
            transform: `translateY(30px) rotate(${i % 2 === 1 ? 1.4 : -1.4}deg)`,
          },
          1.1,
          {
            delay: i * 0.09,
          },
        ),
      ),
    )
  }
  // cards land from a little depth
  for (const card of qa(
    '.sing-grid > *, .app-card, .quiz, .wrapup > *, .player-grid > *, #graph, .ex-bar',
  )) {
    onEnter(card, 94, () =>
      from(card, { transform: 'translateY(20px) scale(.975)' }, 1),
    )
  }
}
