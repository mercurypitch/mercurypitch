// ============================================================
// Lesson page chrome — the sound gate, the switches and the masthead
// ============================================================

import { q, qa, svg } from './dom'
import { Motion } from './motion-switch'
import { A3, A4, hz } from './notes'
import { Sound } from './sound'
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
 * microphone) passes its own line.
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
  Sound.subscribe((state) => {
    const on = state === 'on'
    sw.setAttribute('aria-pressed', String(on))
    gate.classList.toggle('is-on', on)
    gateText.textContent = on ? onText : offText
    gateBtn.textContent = on ? 'Turn sound off' : 'Turn sound on'
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

/** The active section in the nav, and the phone menu. `sections` maps a section id to its nav link. */
export function initMasthead(sections: Record<string, string>): void {
  const links = qa<HTMLAnchorElement>('.mast-nav a')
  const nav = q('#mastNav')
  const btn = q('#menuBtn')
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
  const close = (): void => {
    nav.classList.remove('open')
    btn.setAttribute('aria-expanded', 'false')
  }
  btn.addEventListener('click', () => {
    const open = !nav.classList.contains('open')
    nav.classList.toggle('open', open)
    btn.setAttribute('aria-expanded', String(open))
  })
  links.forEach((a) => a.addEventListener('click', close))
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      close()
      btn.focus()
    }
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
