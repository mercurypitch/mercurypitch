// ============================================================
// Lesson motion switch — one pause for every ambient loop
// ============================================================
//
// WCAG 2.2.2: anything that moves by itself for more than five seconds can be
// paused. The viewer's own choice is kept apart from the system setting:
// under prefers-reduced-motion everything is paused, whatever the toggle or a
// stored choice says, and a change to the setting applies at once.

import { store } from './dom'

const KEY = 'fyp-motion'
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

export const reducedMotion = (): boolean => reduceQuery.matches

type Listener = (paused: boolean) => void

let userPaused = store.get<string | null>(KEY, null) === 'paused'
const listeners = new Set<Listener>()

const isPaused = (): boolean => reducedMotion() || userPaused

function apply(): void {
  const paused = isPaused()
  document.documentElement.classList.toggle('motion-paused', paused)
  listeners.forEach((fn) => fn(paused))
}

reduceQuery.addEventListener('change', apply)

export const Motion = {
  get paused(): boolean {
    return isPaused()
  },
  /** True while the system setting holds everything still. */
  get locked(): boolean {
    return reducedMotion()
  },
  set(paused: boolean): void {
    if (reducedMotion()) return
    userPaused = paused
    store.set(KEY, paused ? 'paused' : 'playing')
    apply()
  },
  /** Calls `fn` now and on every change. */
  subscribe(fn: Listener): void {
    listeners.add(fn)
    fn(isPaused())
  },
  init: apply,
}
