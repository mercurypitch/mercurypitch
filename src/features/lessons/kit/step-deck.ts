// ============================================================
// Lesson step deck — the text scrolls, the figure stage stays put
// ============================================================
//
// On a wide screen the steps are a column of text beside a sticky figure
// stage; the step in the middle of the viewport picks the toy. Below 960 px,
// or on a screen under 560 px tall (`DECK_QUERY`), the stage becomes a
// one-card deck: buttons and a swipe on the text move between steps. Each
// toy registers here and hears every step change, so it can stop a note that
// belongs to a step the viewer has left; anything else that follows the
// steps (position.ts, which remembers how far the viewer got) subscribes to
// the deck itself. The masthead's lesson menu lists the steps by their
// titles and jumps to the one the viewer picks.
//
// The stuck stage must fit the screen beside the text: on every step, and
// whenever a toy's box changes, stage-fit.ts measures what the toy needs
// besides its figure, and the stylesheet gives the figure the rest.
//
// One toy per step (`toyFor`); a step's other parts, such as a game card in
// its text, live in the text and hear the steps the same way. An address
// that names a step (`/learn/02#step-3`, as a later lesson's recall check
// links one) opens the deck there: the browser's own jump cannot reach a
// step the phone deck hides.
//
// A step the viewer moves to (Next, Previous, a swipe, the lesson menu) is
// said whole, "Step 3 of 6: Two names for one key", on the page's status
// line. The counter is no live region: on a wide screen it follows the
// scroll, and every step scrolled past would be said.

import { announce, announcer } from './announce'
import { clamp, q, qa } from './dom'
import { watch } from './frame-loop'
import { reducedMotion } from './motion-switch'
import { fitStage, watchStageFit } from './stage-fit'

/**
 * Where the one-card deck takes over: below 960 px, where the text and the
 * stage cannot sit side by side, and under 560 px of height, where a toy's
 * controls and a 180 px figure no longer fit beside the text. The deck's
 * rules in lesson-stage.css sit under this same query (step-deck.test.ts
 * holds the two to it).
 */
export const DECK_QUERY = '(max-width: 960px), (max-height: 560px)'

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
  /** Each step's title, as its heading words it; step 1's first. */
  readonly titles: readonly string[]
  /** Where "Next" goes after the last step, and its label. */
  readonly after: StepDeckOptions['after']
  show(step: number, options?: { scroll?: boolean }): void
  /**
   * Shows step `n` and brings it into view from anywhere on the page: the
   * step beside the stage, or the deck's card. The lesson menu's step links.
   */
  jump(n: number): void
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
  const titles = steps.map((s) =>
    (q('h3', s).textContent ?? '').replace(/\s+/g, ' ').trim(),
  )
  const stage = q('#stepsStage')
  const card = q('.stage-card', stage)
  const deckQuery = window.matchMedia(DECK_QUERY)
  let current = 1
  let deck = false
  let lockUntil = 0
  const listeners = new Set<(step: number) => void>()
  const behavior = (): ScrollBehavior => (reducedMotion() ? 'auto' : 'smooth')
  announcer()
  /** Says the step the viewer moved to. */
  const sayStep = (): void =>
    announce(`Step ${current} of ${count}: ${titles[current - 1]}`)

  /**
   * The page scroll that centres step `n` under the masthead, as
   * `scrollIntoView({ block: 'center' })` would, but never short of the
   * scroll at which the stage sticks: centring a step near the top of the
   * column left the stage lower down, its foot below the fold. The stage's
   * place in the flow is the top of its grid row.
   */
  function stepScroll(n: number): number {
    const r = steps[n - 1].getBoundingClientRect()
    const pad =
      parseFloat(
        window.getComputedStyle(document.documentElement).scrollPaddingTop,
      ) || 0
    const centre = r.top + r.height / 2 - (pad + window.innerHeight) / 2
    const flowTop = stage.parentElement?.getBoundingClientRect().top ?? 0
    const sticks =
      flowTop - (parseFloat(window.getComputedStyle(stage).top) || 0)
    return window.scrollY + Math.max(centre, sticks)
  }

  function show(n: number, o: { scroll?: boolean } = {}): void {
    const next = clamp(n, 1, count)
    const previous = current
    current = next
    card.dataset.dir = next < previous ? 'b' : 'f'
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
    // the toy as its step left it; a stage still over budget scrolls inside
    // itself, and each step starts at the stage's head
    fitStage(stage, deck)
    if (next !== previous) card.scrollTop = 0
    if (o.scroll === true) {
      if (!deck) {
        lockUntil = performance.now() + 1100
        window.scrollTo({ top: stepScroll(next), behavior: behavior() })
      } else if (stage.getBoundingClientRect().top < 0) {
        stage.scrollIntoView({ behavior: behavior(), block: 'start' })
      }
    }
  }

  function setMode(): void {
    deck = deckQuery.matches
    root.classList.toggle('is-deck', deck)
  }
  setMode()
  deckQuery.addEventListener('change', () => {
    setMode()
    show(current)
  })
  watchStageFit(stage, () => deck)

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
      sayStep()
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
        const was = current
        show(current + (dx < 0 ? 1 : -1), { scroll: true })
        // a swipe past either end stays put, and says nothing
        if (current !== was) sayStep()
      }
    },
    { passive: true },
  )

  /** Step `n`, and the stage or the step brought into view, at once or smoothly. */
  function bring(n: number, how: ScrollBehavior): void {
    if (deck) {
      stage.scrollIntoView({ behavior: how, block: 'start' })
      return
    }
    lockUntil = performance.now() + 1100
    window.scrollTo({ top: stepScroll(n), behavior: how })
  }

  /** A step opened from the address: the step beside the stage, or the stage above it. */
  function openAt(n: number): void {
    // the lock comes first: a scroll's observer report still on its way would
    // otherwise land after this step and show the step that scroll reached
    lockUntil = performance.now() + 1100
    show(n)
    requestAnimationFrame(() => bring(n, 'auto'))
  }

  const stageSeen = watch(stage)
  return {
    get current() {
      return current
    },
    count,
    titles,
    after: opts.after,
    show,
    jump(n) {
      show(n)
      bring(current, behavior())
      sayStep()
    },
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
