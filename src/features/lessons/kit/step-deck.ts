// ============================================================
// Lesson step deck — the text scrolls, the figure stage stays put
// ============================================================
//
// On a wide screen the steps are a column of text beside a sticky figure
// stage; the step in the middle of the viewport picks the toy. Below 960 px
// the stage becomes a one-card deck: buttons and a swipe on the text move
// between steps. Each toy registers here and hears every step change, so it
// can stop a note that belongs to a step the viewer has left; anything else
// that follows the steps (position.ts, which remembers how far the viewer
// got) subscribes to the deck itself.
//
// One toy per step (`toyFor`); a step's other parts, such as a game card in
// its text, live in the text and hear the steps the same way. An address
// that names a step (`/learn/02#step-3`, as a later lesson's recall check
// links one) opens the deck there: the browser's own jump cannot reach a
// step the phone deck hides.

import { clamp, q, qa } from './dom'
import { watch } from './frame-loop'
import { reducedMotion } from './motion-switch'

export interface Toy {
  onStep?: (step: number, previous: number) => void
}

export interface StepDeckOptions {
  /** Which toy a step shows (two steps can share one). */
  toyFor: (step: number) => number
  /** Where "Next" goes after the last step, and its label. */
  after: { label: string; selector: string }
}

export interface StepDeck {
  readonly current: number
  /** How many steps the deck has. */
  readonly count: number
  show(step: number, options?: { scroll?: boolean }): void
  /**
   * Calls `fn` with the new step whenever the step changes, not for the
   * step showing now; returns the unsubscribe.
   */
  subscribe(fn: (step: number) => void): () => void
  /**
   * Shows the step the address names (`#step-3`), or step 1, and from then
   * on follows the address. Call once, after every toy has registered.
   */
  start(): void
  /** True while toy `n`'s stage is on screen and one of its steps is showing. */
  toyActive(n: number): () => boolean
}

/** The step an address names (`#step-3` is 3), or null for none of the deck's `count` steps. */
export function stepFromHash(hash: string, count: number): number | null {
  const m = /^#step-(\d+)$/.exec(hash)
  if (m === null) return null
  const n = Number(m[1])
  return n >= 1 && n <= count ? n : null
}

const toys: Toy[] = []

export function registerToy(toy: Toy): void {
  toys.push(toy)
}

export function createStepDeck(opts: StepDeckOptions): StepDeck {
  const root = q('#lesson')
  const steps = qa('.step', root)
  const stages = qa('.toy', root)
  const bars = qa('.progress i', root)
  const count = steps.length
  const titles = steps.map((s) => q('h3', s).textContent ?? '')
  const narrow = window.matchMedia('(max-width: 960px)')
  let current = 1
  let deck = false
  let lockUntil = 0
  const listeners = new Set<(step: number) => void>()
  const behavior = (): ScrollBehavior => (reducedMotion() ? 'auto' : 'smooth')

  function show(n: number, o: { scroll?: boolean } = {}): void {
    const next = clamp(n, 1, count)
    const previous = current
    current = next
    q('.stage-card', root).dataset.dir = next < previous ? 'b' : 'f'
    steps.forEach((s) =>
      s.classList.toggle('is-active', Number(s.dataset.step) === next),
    )
    const toyN = opts.toyFor(next)
    stages.forEach((t) =>
      t.classList.toggle('is-active', Number(t.dataset.toy) === toyN),
    )
    q('#stepNow').textContent = String(next)
    bars.forEach((b, i) => {
      b.classList.toggle('done', i < next - 1)
      b.classList.toggle('now', i === next - 1)
    })
    qa<HTMLButtonElement>('[data-step-go="-1"]', root).forEach((b) => {
      b.disabled = next === 1
    })
    qa<HTMLButtonElement>('.stage-nav [data-step-go="1"]', root).forEach(
      (b) => {
        b.disabled = next === count
      },
    )
    q('#deckNextLabel').textContent =
      next < count ? `Next: ${titles[next]}` : `Next: ${opts.after.label}`
    toys.forEach((t) => t.onStep?.(next, previous))
    if (next !== previous) listeners.forEach((fn) => fn(next))
    if (o.scroll === true) {
      if (!deck) {
        lockUntil = performance.now() + 1100
        steps[next - 1].scrollIntoView({
          behavior: behavior(),
          block: 'center',
        })
      } else {
        const stage = q('#stepsStage')
        if (stage.getBoundingClientRect().top < 0) {
          stage.scrollIntoView({ behavior: behavior(), block: 'start' })
        }
      }
    }
  }

  function setMode(): void {
    deck = narrow.matches
    root.classList.toggle('is-deck', deck)
  }
  setMode()
  narrow.addEventListener('change', () => {
    setMode()
    show(current)
  })

  const follow = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (deck || !e.isIntersecting || performance.now() < lockUntil) return
        const n = Number((e.target as HTMLElement).dataset.step)
        if (n !== current) show(n)
      }),
    { rootMargin: '-42% 0px -52% 0px' },
  )
  steps.forEach((s) => follow.observe(s))

  qa<HTMLButtonElement>('[data-step-go]', root).forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.stepGo)
      if (d > 0 && current === count && b.closest('.deck-nav') !== null) {
        q(opts.after.selector).scrollIntoView({ behavior: behavior() })
        return
      }
      show(current + d, { scroll: true })
    }),
  )

  // swipe between steps on phones (on the text, so the toys keep their own drags)
  let sx = 0
  let sy = 0
  const text = q('#stepsText')
  text.addEventListener(
    'touchstart',
    (e) => {
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
    },
    { passive: true },
  )
  text.addEventListener(
    'touchend',
    (e) => {
      if (!deck) return
      const dx = e.changedTouches[0].clientX - sx
      const dy = e.changedTouches[0].clientY - sy
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        show(current + (dx < 0 ? 1 : -1), { scroll: true })
      }
    },
    { passive: true },
  )

  /** A step opened from the address: the step beside the stage, or the stage above it. */
  function openAt(n: number): void {
    show(n)
    requestAnimationFrame(() => {
      if (deck) {
        q('#stepsStage').scrollIntoView({ behavior: 'auto', block: 'start' })
        return
      }
      lockUntil = performance.now() + 1100
      steps[n - 1].scrollIntoView({ behavior: 'auto', block: 'center' })
    })
  }

  const stageSeen = watch(q('#stepsStage'))
  return {
    get current() {
      return current
    },
    count,
    show,
    subscribe(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    start() {
      const n = stepFromHash(window.location.hash, count)
      if (n === null) show(1)
      else openAt(n)
      window.addEventListener('hashchange', () => {
        const next = stepFromHash(window.location.hash, count)
        if (next !== null) openAt(next)
      })
    },
    toyActive(n) {
      return () => stageSeen() && opts.toyFor(current) === n
    },
  }
}
