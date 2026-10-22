// ============================================================
// Lesson predict — commit to a guess, hear it, then the reveal
// ============================================================
//
// A committed guess helps even when it is wrong (TEACHING-PLAYBOOK rule 2),
// so the play buttons stay locked until a choice is in, and the choice
// locks. The reveal appears only once the sound that answers it has
// actually been heard, so it never describes a sound that a viewer with
// sound off did not hear, or one cut short before its end, and it never
// calls a choice wrong.
//
// Mounted on a root, any number per page. Inside the root: two to four
// `.choice` buttons (each with `data-choice`), the `[data-play]` buttons,
// the `.lock-hint` line and the `.reveal`, whose first `.mono` line says
// what the viewer chose. A `[data-free]` play works before a choice (an
// example the cold open's line already answers) and never reveals. What a
// play sounds like is the lesson's own: `play` does it.

import { announce, announcer, spokenText } from './announce'
import { q, qa } from './dom'
import { reducedMotion } from './motion-switch'
import { Sound } from './sound'

const ICON = {
  play: '<svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>',
  speaker: '<svg class="ico" aria-hidden="true"><use href="#i-speaker"/></svg>',
  check: '<svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>',
} as const

export interface PredictOptions {
  /**
   * Plays one example (the button's `data-play` value), its visuals running
   * even when `audible` is false; resolves when it has finished. A play
   * that may be cut short (stopped, or replaced by another sound) resolves
   * false when it was: it was not heard, so it reveals nothing and the hint
   * stays. Any other result, true or nothing, is a play heard to its end.
   */
  readonly play: (
    what: string,
    audible: boolean,
  ) => Promise<boolean> | Promise<void>
  /** The lines the lock hint takes (text, after an icon the widget supplies). */
  readonly hints: {
    /** Once a choice is in. */
    readonly chosen: string
    /** After a play that sound off kept silent, until a play is heard. */
    readonly silent: string
    /** After a heard play that does not reveal, until the reveal; `chosen` without it. */
    readonly next?: string
    /** After the reveal. */
    readonly again: string
  }
  /** The plays (`data-play` values) whose sound reveals the answer; default every play but the free ones. */
  readonly revealOn?: readonly string[]
  /**
   * 'any' reveals once one of those has been heard (the default); 'all' waits
   * until every one has, for a predict that compares two sounds.
   */
  readonly revealAfter?: 'any' | 'all'
  /** The reveal's line about the choice ("You said: ..."), never "right" or "wrong". */
  readonly guess?: (choice: string) => string
  /** After the reveal shows (a Merc's celebration). */
  readonly onReveal?: (choice: string) => void
  /** Hears the choice the moment it locks. */
  readonly onChoice?: (choice: string) => void
  /** Controls elsewhere that the choice unlocks too (a stage's Sharp and Flat). */
  readonly unlocks?: readonly HTMLButtonElement[]
  /** The play buttons, when they are not the `[data-play]` buttons inside the root. */
  readonly plays?: readonly HTMLButtonElement[]
  /** What the reveal shows, when it is not the root's `.reveal` (one or several elements). */
  readonly reveal?: HTMLElement | readonly HTMLElement[]
}

export interface Predict {
  /** The locked choice, or null before one. */
  readonly choice: string | null
  readonly revealed: boolean
}

export function mountPredict(root: HTMLElement, opts: PredictOptions): Predict {
  const choices = qa<HTMLButtonElement>('.choice', root)
  const plays = opts.plays ?? qa<HTMLButtonElement>('[data-play]', root)
  const hint = q('.lock-hint', root)
  // the page's own hint, asking for a choice
  const lockHint = hint.innerHTML
  const given = opts.reveal
  const reveals: readonly HTMLElement[] =
    given === undefined
      ? [q('.reveal', root)]
      : given instanceof HTMLElement
        ? [given]
        : given
  const free = (b: HTMLButtonElement): boolean => b.dataset.free !== undefined
  const revealsAnswer = (what: string): boolean =>
    opts.revealOn === undefined
      ? !plays.some((p) => p.dataset.play === what && free(p))
      : opts.revealOn.includes(what)
  // the answering plays heard so far, for a reveal that waits on all of them
  const heardPlays = new Set<string>()
  const answered = (): boolean =>
    opts.revealAfter !== 'all' ||
    (opts.revealOn ?? []).every((w) => heardPlays.has(w))
  let choice: string | null = null
  let busy = false
  let revealed = false
  // The reveal is spoken through the page's status line (showReveal): a
  // region that appears from display:none in the same tick as its words is
  // usually not read at all, and its own aria-live would only say it twice
  // where it is.
  reveals.forEach((r) => r.removeAttribute('aria-live'))
  if (reveals.length > 0) announcer()

  choices.forEach((b) =>
    b.addEventListener('click', () => {
      if (choice !== null) return
      choice = b.dataset.choice ?? null
      choices.forEach((c) => {
        c.setAttribute('aria-pressed', String(c === b))
        c.disabled = true
      })
      plays.forEach((p) => {
        p.disabled = false
      })
      opts.unlocks?.forEach((u) => {
        u.disabled = false
      })
      hint.innerHTML = `${ICON.play}${opts.hints.chosen}`
      plays.find((p) => !free(p))?.focus({ preventScroll: true })
      if (choice !== null) opts.onChoice?.(choice)
    }),
  )

  function showReveal(guessed: string): void {
    revealed = true
    const line = reveals[0]?.querySelector('.mono')
    if (line && opts.guess !== undefined) line.textContent = opts.guess(guessed)
    hint.innerHTML = `${ICON.check}${opts.hints.again}`
    reveals.forEach((r) => {
      r.hidden = false
    })
    opts.onReveal?.(guessed)
    // focus stays on the play that answered it, so the reveal is said, not moved to
    announce(
      reveals
        .map(spokenText)
        .filter((t) => t !== '')
        .join(' '),
    )
    if (reducedMotion()) return
    reveals.forEach((r) =>
      r.animate([{ transform: 'translateY(10px)' }, { transform: 'none' }], {
        duration: 700,
        easing: 'cubic-bezier(.16, 1, .3, 1)',
      }),
    )
  }

  // after a play: the reveal once its sound was heard, else a hint saying why
  // not yet; a heard play never leaves the sound-off hint standing
  function heard(what: string, audible: boolean): void {
    if (revealed) return
    if (!audible || Sound.state !== 'on') {
      hint.innerHTML = `${ICON.speaker}${opts.hints.silent}`
      return
    }
    // a free example, heard before a choice: the hint asks for one again
    if (choice === null) {
      hint.innerHTML = lockHint
      return
    }
    if (revealsAnswer(what)) heardPlays.add(what)
    if (revealsAnswer(what) && answered()) showReveal(choice)
    else hint.innerHTML = `${ICON.play}${opts.hints.next ?? opts.hints.chosen}`
  }

  plays.forEach((p) =>
    p.addEventListener('click', () => {
      void (async () => {
        if (busy || (choice === null && !free(p))) return
        busy = true
        plays.forEach((x) => x.classList.toggle('is-on', x === p))
        const what = p.dataset.play ?? ''
        const audible = Sound.canPlay()
        const finished = await opts.play(what, audible)
        plays.forEach((x) => x.classList.remove('is-on'))
        busy = false
        // a play cut short was not heard to its end: it answers nothing
        if (finished !== false) heard(what, audible)
      })()
    }),
  )

  return {
    get choice() {
      return choice
    },
    get revealed() {
      return revealed
    },
  }
}
