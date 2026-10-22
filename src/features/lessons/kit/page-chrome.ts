// ============================================================
// Lesson page chrome — the sound gate, the switches and the masthead
// ============================================================

import { q, qa, svg } from './dom'
import { createLessonMenu } from './lesson-menu'
import { Motion } from './motion-switch'
import { A3, A4, hz } from './notes'
import { followPageState } from './page-state'
import { rememberSteps } from './position'
import { Sound } from './sound'
import type { StepDeck } from './step-deck'
import { hideToast, toast } from './toast'

/** The sound gate's two lines: before sound is on, and once it is. */
export interface GateLines {
  readonly off: string
  readonly on: string
}

/**
 * The masthead's Sound switch, the hero's gate and the toast's "Turn on" all
 * drive one state. The gate's line while sound is off is the page's own, as
 * its markup words it (each lesson says what its sound is about). A lesson
 * whose gate says more once sound is on (a voice lesson names the
 * microphone) passes its own line. Both lines stay in the gate, in one cell
 * (kit/lesson-stage.css), so it keeps the taller one's height in either
 * state; the one not current is hidden, from a screen reader too.
 */
export function initSoundSwitch(lines: Partial<GateLines> = {}): void {
  const sw = q('#soundSwitch')
  const gate = q('#gate')
  const gateText = q('#gateText')
  const gateBtn = q('#gateBtn')
  const offText =
    lines.off ??
    ((gateText.textContent ?? '').replace(/\s+/g, ' ').trim() ||
      'This lesson is about sound. Tap to turn it on: nothing plays until you press a play button.')
  const onText =
    lines.on ??
    'Sound is on. Each example plays only when you press its button.'
  const line = (state: 'off' | 'on', text: string): HTMLSpanElement => {
    const el = document.createElement('span')
    el.dataset.gateLine = state
    el.textContent = text
    return el
  }
  // the markup's line until now, and the same words after: first paint keeps it
  gateText.replaceChildren(line('off', offText), line('on', onText))
  Sound.subscribe((state) => {
    const on = state === 'on'
    sw.setAttribute('aria-pressed', String(on))
    // the gate's class picks the line that shows (kit/lesson-stage.css)
    gate.classList.toggle('is-on', on)
    gateBtn.textContent = on ? 'Turn sound off' : 'Turn sound on'
    // "Sound is off" waits for an answer (toast.ts): sound on from any control is one
    if (on) hideToast()
  })
  const toggle = (): void => {
    const turningOn = Sound.state !== 'on'
    Sound.set(turningOn ? 'on' : 'off')
    // a soft A3 and A4 confirm it
    if (turningOn) {
      Sound.voice(hz(A3), { dur: 0.7, gain: 0.07 })
      Sound.voice(hz(A4), { dur: 0.7, gain: 0.05 })
    }
  }
  sw.addEventListener('click', toggle)
  gateBtn.addEventListener('click', toggle)
  q('#toastBtn').addEventListener('click', () => {
    Sound.set('on')
    hideToast()
    sw.focus({ preventScroll: true })
  })
}

export function initMotionSwitch(): void {
  const b = q('#motionSwitch')
  const note = q('#motionNote')
  Motion.subscribe((paused) => {
    const locked = Motion.locked
    b.setAttribute('aria-pressed', String(paused))
    if (locked) {
      b.setAttribute('aria-disabled', 'true')
      b.setAttribute('aria-describedby', 'motionNote')
      b.title = 'Paused by your reduced-motion setting'
    } else {
      b.removeAttribute('aria-disabled')
      b.removeAttribute('aria-describedby')
      b.title = 'Pause or play the background animations'
    }
    note.hidden = !locked
  })
  b.addEventListener('click', () => {
    if (Motion.locked) {
      toast('Paused by your reduced-motion setting.')
      return
    }
    Motion.set(!Motion.paused)
  })
}

/** A lesson page as its masthead needs it: its lesson's number and its step deck. */
export interface MastheadLesson {
  readonly lesson: number
  readonly deck: StepDeck
}

/**
 * The active section in the nav, and the lesson menu (lesson-menu.ts): the
 * masthead's "Season 1 · Lesson 02" opens the season, and under 821 px its
 * sheet carries the sections the nav shows on a wider screen. `sections`
 * maps a section id to its nav link. The page's steps are remembered as the
 * viewer moves through them (position.ts), for every page's menu and map.
 * Every lesson page calls this, so it is also where the page's own links
 * to other lessons, and its readings of their state, follow the state the
 * page was served with (page-state.ts `followPageState`).
 */
export function initMasthead(
  sections: Record<string, string>,
  page: MastheadLesson,
): void {
  followPageState()
  const links = qa<HTMLAnchorElement>('.mast-nav a')
  const spy = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        const href = sections[e.target.id]
        links.forEach((a) => {
          const on = a.getAttribute('href') === href
          a.classList.toggle('on', on)
          if (on) a.setAttribute('aria-current', 'true')
          else a.removeAttribute('aria-current')
        })
      }),
    { rootMargin: '-35% 0px -60% 0px' },
  )
  for (const id of Object.keys(sections)) {
    const el = document.getElementById(id)
    if (el) spy.observe(el)
  }
  rememberSteps(page.lesson, page.deck)
  createLessonMenu({
    lesson: page.lesson,
    deck: page.deck,
    label: q('.mast-ep'),
    sections: links,
  })
}

/**
 * An engraved G clef on every section's staff: one staff space is 9 px, as in
 * the stats kit, and the clef's curl sits on the G line (the second line up,
 * 27 px down the staff; the svg starts 24 px above it).
 */
export function engraveClefs(gClefPath: string): void {
  const k = 9.6 / 244
  qa<SVGSVGElement>('svg.clef[data-clef="g"]').forEach((el) =>
    svg(
      'path',
      { d: gClefPath, transform: `translate(2 ${24 + 27}) scale(${k})` },
      el,
    ),
  )
}
