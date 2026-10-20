// ============================================================
// Lesson menu — the season in the masthead: every lesson, and where this viewer is
// ============================================================
//
// The masthead's "Season 1 · Lesson 02" is this menu's button, its ring
// filling as the viewer moves through the steps. It opens the season as one
// list, each lesson done, here, in progress, up next, ready or coming later
// (lesson-state.ts, which the explorer's card asks too), and this page's
// lesson open to its steps. Without it a page had no way to another lesson
// from the top: every path ran through the map at its foot.
//
// One panel, three layouts (lesson-menu.css): a dropdown under the button
// on tablets and desktops, and under 821 px a sheet under the masthead that
// also carries the page's sections, so a phone has one menu, not two. It is
// a native <dialog> opened with showModal(): focus stays inside, the page
// behind is inert, and Escape and the backdrop close it, with no trap made
// by hand. It is drawn each time it opens, from the done list, the steps
// remembered (position.ts) and the deck's step showing now, so it is never
// stale.
//
// Drafts: the rows read LESSONS, where a draft the build hides has no page,
// so it is "Coming later" and not a link. This module writes no lesson's
// address of its own (scripts/assert-draft-lessons.mjs).

import './lesson-menu.css'
import { clamp } from './dom'
import { ARCS } from './explorer-graph'
import type { LessonState, LessonView } from './lesson-state'
import { lessonViews, stateWords } from './lesson-state'
import type { StepMarks } from './position'
import { Positions } from './position'
import { Done } from './progress'
import type { Lane, Lesson } from './season'
import { LESSONS } from './season'
import type { StepDeck } from './step-deck'
import { stepFromHash } from './step-deck'

/** This page's step deck, as the menu shows it. */
export interface DeckNow {
  /** The step showing. */
  readonly now: number
  /** Each step's title, step 1's first. */
  readonly titles: readonly string[]
  /** What follows the last step, and where it is on the page ("#sing"); null for nothing. */
  readonly after: { readonly label: string; readonly href: string } | null
}

/** A step the viewer has been through, the one showing, one ahead, or what follows the last. */
export type StepState = 'seen' | 'now' | 'ahead' | 'after'

export interface MenuStep {
  /** Its number; null for what follows the last step. */
  readonly n: number | null
  readonly title: string
  readonly href: string
  readonly state: StepState
}

export interface MenuRow {
  readonly n: number
  readonly title: string
  readonly lane: Lane
  readonly state: LessonState
  /** Marked done; true of this page's lesson too, whose state stays 'here'. */
  readonly done: boolean
  /** The right-hand text: "Done · 10 min", "Step 3 of 6", "Up next", "Coming later". */
  readonly meta: string
  /** What a screen reader says for the row: "Lesson 9, Landing a leap, coming later". */
  readonly label: string
  /** Where the row goes; null for a lesson coming later, a list item and not a link. */
  readonly href: string | null
  /** How much of its bead a lesson begun fills, 0 to 1. */
  readonly fill: number
  /** This page's lesson's steps; none on any other row. */
  readonly steps: readonly MenuStep[]
}

export interface MenuArc {
  readonly name: string
  readonly span: string
  readonly rows: readonly MenuRow[]
}

export type BarKind = 'done' | 'here' | 'progress' | 'ready' | 'later'

export interface MenuModel {
  /** "Season 1 · 14 lessons". */
  readonly season: string
  /** "1 of 14 done". */
  readonly count: string
  /** One bar a lesson, Lesson 1's first. */
  readonly bars: readonly { readonly kind: BarKind; readonly fill: number }[]
  /** The card at the top: this page's lesson and the step showing. */
  readonly here: {
    /** "You are here: step 3 of 6". */
    readonly title: string
    /** "Lesson 2 · Count the steps". */
    readonly line: string
    /** What a screen reader says for the card: "Continue at step 3 of 6: Count the steps". */
    readonly label: string
    readonly href: string
    readonly fill: number
  }
  readonly arcs: readonly MenuArc[]
}

const SEASON = 'Season 1'

/** A row's right-hand text; this page's lesson counts the step showing. */
function metaOf(v: LessonView, deck: DeckNow): string {
  if (v.state === 'here')
    return `${v.done ? 'Done · step' : 'Step'} ${deck.now} of ${deck.titles.length}`
  return v.state === 'next' ? 'Up next' : stateWords(v)
}

/** A lesson done is full; one begun is filled to its step. */
function fillOf(v: LessonView, deck: DeckNow): number {
  if (v.done) return 1
  if (v.state === 'here') return deck.now / Math.max(1, deck.titles.length)
  return v.step === null ? 0 : v.step.step / v.step.of
}

function barOf(v: LessonView): BarKind {
  if (v.done) return 'done'
  if (v.state === 'here' || v.state === 'progress' || v.state === 'later')
    return v.state
  return 'ready'
}

/**
 * This page's steps: each one up to the furthest reached is seen (all of
 * them once the lesson is done), and what follows the last closes the list.
 */
function stepsOf(v: LessonView, deck: DeckNow): MenuStep[] {
  const of = deck.titles.length
  const furthest = v.step !== null && v.step.of === of ? v.step.step : 0
  const steps = deck.titles.map((title, i): MenuStep => {
    const n = i + 1
    const seen = v.done || n < deck.now || n <= furthest
    return {
      n,
      title,
      href: `#step-${n}`,
      state: n === deck.now ? 'now' : seen ? 'seen' : 'ahead',
    }
  })
  if (deck.after !== null)
    steps.push({
      n: null,
      title: deck.after.label,
      href: deck.after.href,
      state: 'after',
    })
  return steps
}

function rowOf(v: LessonView, deck: DeckNow, current: number): MenuRow {
  const L = v.lesson
  const here = L.n === current
  const meta = metaOf(v, deck)
  const spoken = meta
    .replace(/ · /g, ', ')
    .replace(/ min$/, ' minutes')
    .toLowerCase()
  return {
    n: L.n,
    title: L.title,
    lane: L.lane,
    state: v.state,
    done: v.done,
    meta,
    label: `Lesson ${L.n}, ${L.title}, ${spoken}`,
    // this page's own row goes to its top: its steps are listed under it
    href: v.state === 'later' ? null : here ? '#top' : (v.action?.href ?? null),
    fill: fillOf(v, deck),
    steps: here ? stepsOf(v, deck) : [],
  }
}

/**
 * The menu as this viewer stands with the season: the trailer left out,
 * every lesson's row in its arc, and this page's lesson at the step its deck
 * shows now. Pure: the caller hands in the done list, the remembered steps
 * and the deck.
 */
export function menuModel(
  lessons: readonly Lesson[],
  done: readonly number[],
  positions: StepMarks,
  current: number,
  deck: DeckNow,
): MenuModel {
  const views = lessonViews(lessons, {
    current,
    done: new Set(done),
    steps: positions,
  }).filter((v) => v.lesson.n >= 1)
  const rows = views.map((v) => rowOf(v, deck, current))
  const finished = views.filter((v) => v.done && v.state !== 'later').length
  const self = views.find((v) => v.lesson.n === current)
  const of = deck.titles.length
  const step = deck.titles[deck.now - 1] ?? ''
  return {
    season: `${SEASON} · ${views.length} lessons`,
    count: `${finished} of ${views.length} done`,
    bars: views.map((v) => ({ kind: barOf(v), fill: fillOf(v, deck) })),
    here: {
      title: `You are here: step ${deck.now} of ${of}`,
      line: `Lesson ${current} · ${step}`,
      label: `Continue at step ${deck.now} of ${of}: ${step}`,
      href: `#step-${deck.now}`,
      fill: self === undefined ? 0 : fillOf(self, deck),
    },
    arcs: ARCS.map(([name, span, from, to]) => ({
      name,
      span,
      rows: rows.filter((r) => r.n >= from && r.n <= to),
    })),
  }
}

// ---------------------------------------------------------------- markup

const LANES: Readonly<Record<Lane, string>> = {
  theory: 'Theory',
  voice: 'Voice',
  both: 'Voice and theory',
}

/** A page's section, as the phone sheet's "On this page" offers it. */
export interface Section {
  readonly href: string
  readonly name: string
  /** The section on screen now (the masthead's scroll-spy). */
  readonly current: boolean
}

/** What the menu's foot links to on this page. */
interface Foot {
  /** The season map's address on this page, when it has one. */
  readonly map: string | null
  /** This lesson's drill in MercuryPitch, when it has one. */
  readonly practise: string | null
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

const icon = (id: string, cls = 'ico'): string =>
  `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`

const dash = (fill: number): string =>
  `${Math.round(clamp(fill, 0, 1) * 100)} 100`

/** A progress ring, filled to `fill` from twelve o'clock. */
const ring = (fill: number): string =>
  `<svg class="lm-ring" viewBox="0 0 24 24" aria-hidden="true"><circle class="tr" cx="12" cy="12" r="9"/><circle class="arc" cx="12" cy="12" r="9" pathLength="100" stroke-dasharray="${dash(fill)}" transform="rotate(-90 12 12)"/></svg>`

/** This page's steps, a titled list or a row of chips (lesson-menu.css), and the chips' caption. */
function stepsMarkup(r: MenuRow): string {
  if (r.steps.length === 0) return ''
  const items = r.steps
    .map((s) =>
      s.n === null
        ? `<li class="after"><a href="${esc(s.href)}">${icon('i-play')}<span>${esc(s.title)}</span></a></li>`
        : `<li><a class="${s.state}" href="${s.href}" aria-label="${esc(`Step ${s.n}: ${s.title}`)}"${s.state === 'now' ? ' aria-current="step"' : ''}><b>${s.n}</b>${s.state === 'seen' ? icon('i-check') : ''}<span>${esc(s.title)}</span></a></li>`,
    )
    .join('')
  const now = r.steps.find((s) => s.state === 'now')
  const cap = now === undefined ? '' : esc(`Step ${now.n}: ${now.title}`)
  return `<ol class="lm-steps" aria-label="Steps of Lesson ${r.n}">${items}</ol><p class="lm-cap" aria-hidden="true" data-now="${cap}">${cap}</p>`
}

function rowMarkup(r: MenuRow): string {
  const body = `<span class="sr">${esc(r.label)}</span><span class="nb" aria-hidden="true" style="--fill: ${r.fill.toFixed(3)}">${r.done ? icon('i-check') : r.n}</span><span class="tt" aria-hidden="true">${esc(r.title)}</span><small class="k" aria-hidden="true"><span class="ln ${r.lane}">${LANES[r.lane]}</span><span class="kn"> · Lesson ${r.n}</span></small><span class="st" aria-hidden="true">${r.state === 'later' ? icon('i-lock') : ''}${esc(r.meta)}</span>`
  const cls = `lm-row ${r.state}${r.done ? ' is-done' : ''}`
  const row =
    r.href === null
      ? `<div class="${cls}">${body}</div>`
      : `<a class="${cls}" href="${esc(r.href)}"${r.state === 'here' ? ' aria-current="page"' : ''}>${body}</a>`
  return `<li>${row}${stepsMarkup(r)}</li>`
}

/** "Season 1 · 14 lessons" with the count in its own span, which a phone leaves out: the count beside it gives the 14. */
function seasonMarkup(season: string): string {
  const at = season.indexOf(' · ')
  return at < 0
    ? season
    : `${season.slice(0, at)}<span class="lm-size">${season.slice(at)}</span>`
}

/** The panel's contents: heading, season bar, sections (phones), where the viewer is, the lessons, the foot. */
export function menuMarkup(
  m: MenuModel,
  sections: readonly Section[],
  foot: Foot,
): string {
  const bars = m.bars
    .map(
      (b) =>
        `<i class="${b.kind}"${b.kind === 'progress' ? ` style="--fill: ${b.fill.toFixed(3)}"` : ''}></i>`,
    )
    .join('')
  const onPage =
    sections.length === 0
      ? ''
      : `<nav class="lm-onpage" aria-label="On this page"><p class="lm-k" aria-hidden="true">On this page</p>${sections
          .map(
            (s) =>
              `<a class="btn sm" href="${esc(s.href)}"${s.current ? ' aria-current="true"' : ''}>${esc(s.name)}</a>`,
          )
          .join('')}</nav>`
  const arcs = m.arcs
    .map(
      (a) =>
        `<h3 class="lm-arc">${a.name} <small>${a.span}</small></h3><ol class="lm-rows">${a.rows.map(rowMarkup).join('')}</ol>`,
    )
    .join('')
  const map =
    foot.map === null
      ? ''
      : `<a class="btn sm" href="${esc(foot.map)}">See the season map</a>`
  const practise =
    foot.practise === null
      ? ''
      : `<a class="btn sm" href="${esc(foot.practise)}" target="_blank" rel="noopener">Practise in MercuryPitch${icon('i-out')}<span class="sr">, opens in a new tab</span></a>`
  return `<div class="lm-in"><div class="lm-head"><h2 id="lessonMenuTitle">Find Your Pitch <small>${seasonMarkup(m.season)}</small></h2><p class="lm-count">${m.count}</p><button class="btn icon lm-x" type="button" data-close aria-label="Close">${icon('i-x')}</button></div><div class="lm-bar" aria-hidden="true">${bars}</div>${onPage}<a class="lm-here" href="${m.here.href}" aria-label="${esc(m.here.label)}">${ring(m.here.fill)}<span class="lm-here-t"><b>${esc(m.here.title)}</b><span>${esc(m.here.line)}</span></span><span class="btn primary sm" aria-hidden="true">Continue</span></a><nav class="lm-season" aria-label="${SEASON} lessons">${arcs}</nav><div class="lm-foot">${map}${practise}<a class="btn sm" href="/">MercuryPitch home</a></div></div>`
}

// ---------------------------------------------------------------- the menu on a page

export interface LessonMenuOptions {
  /** This page's lesson. */
  readonly lesson: number
  readonly deck: StepDeck
  /** The masthead's "Season 1 · Lesson 02", which becomes the menu's button. */
  readonly label: HTMLElement
  /** The masthead's section links, which the phone sheet carries. */
  readonly sections: readonly HTMLAnchorElement[]
}

/**
 * Whether the page shows a masthead link and the section it names: a lesson
 * whose film is not out keeps its Watch section and link, `hidden`.
 */
function shown(a: HTMLAnchorElement): boolean {
  const href = a.getAttribute('href') ?? ''
  const to = href.startsWith('#')
    ? document.getElementById(href.slice(1))
    : null
  return (
    a.closest('[hidden]') === null &&
    to !== null &&
    to.closest('[hidden]') === null
  )
}

/** A section link as the sheet offers it: its name without its numeral ("<b>II</b>Sing" is "Sing"). */
function sectionOf(a: HTMLAnchorElement): Section {
  const words = Array.from(a.childNodes).filter((n) => n.nodeName !== 'B')
  return {
    href: a.getAttribute('href') ?? '',
    name: words
      .map((n) => n.textContent ?? '')
      .join('')
      .trim(),
    current: a.getAttribute('aria-current') === 'true',
  }
}

/** Is a click on the backdrop, outside the panel's own box? */
function outside(dialog: HTMLDialogElement, e: MouseEvent): boolean {
  if (e.target !== dialog) return false
  const r = dialog.getBoundingClientRect()
  return (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  )
}

/**
 * Turns the masthead's lesson label into the menu's button and builds the
 * panel. In-page links (a step, a section, the map) close the panel first
 * and then move the page, a step through the deck so the phone deck shows
 * it; a link to another page closes the panel and leaves the browser to it.
 */
export function createLessonMenu(o: LessonMenuOptions): void {
  const { deck } = o
  const L = LESSONS.find((x) => x.n === o.lesson)
  const total = LESSONS.filter((x) => x.n >= 1).length
  const sheet = window.matchMedia('(max-width: 820px)')
  const root = document.documentElement

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'lm-btn'
  btn.setAttribute('aria-haspopup', 'dialog')
  btn.setAttribute('aria-expanded', 'false')
  btn.setAttribute('aria-controls', 'lessonMenu')
  btn.setAttribute(
    'aria-label',
    `Lesson ${o.lesson} of ${total}, ${L?.title ?? ''}: all lessons`,
  )
  btn.innerHTML = `${ring(0)}<span class="lm-l"><span class="lm-s">${SEASON} · </span>Lesson ${String(o.lesson).padStart(2, '0')}</span>${icon('i-right', 'ico lm-chev')}`
  o.label.replaceWith(btn)
  const arc = btn.querySelector('.arc')
  const paintRing = (): void => {
    const fill = Done.has(o.lesson) ? 1 : deck.current / deck.count
    arc?.setAttribute('stroke-dasharray', dash(fill))
  }
  paintRing()
  deck.subscribe(paintRing)
  Done.subscribe(paintRing)

  const dialog = document.createElement('dialog')
  dialog.id = 'lessonMenu'
  dialog.className = 'lmenu'
  dialog.setAttribute('aria-labelledby', 'lessonMenuTitle')
  document.body.appendChild(dialog)

  const after = deck.after.selector.startsWith('#')
    ? { label: deck.after.label, href: deck.after.selector }
    : null
  const foot: Foot = {
    map: document.getElementById('explorer') === null ? null : '#explorer',
    practise: L?.pr.link?.href ?? null,
  }

  function render(): void {
    const m = menuModel(LESSONS, Done.list(), Positions.all(), o.lesson, {
      now: deck.current,
      titles: deck.titles,
      after,
    })
    const sections = o.sections.filter(shown).map(sectionOf)
    dialog.innerHTML = menuMarkup(m, sections, foot)
  }

  /** Under the button on a wide screen, kept 16 px inside the viewport; the sheet is full width. */
  function place(): void {
    if (sheet.matches) {
      dialog.style.removeProperty('--lm-left')
      return
    }
    const left = clamp(
      btn.getBoundingClientRect().left,
      16,
      window.innerWidth - dialog.offsetWidth - 16,
    )
    dialog.style.setProperty('--lm-left', `${Math.round(left)}px`)
  }

  /** The current lesson's row, with its steps, scrolled into the panel's view. */
  function reveal(row: HTMLElement): void {
    const box = dialog.querySelector<HTMLElement>('.lm-in')
    const item = row.parentElement
    if (box === null || item === null) return
    const top =
      item.getBoundingClientRect().top -
      box.getBoundingClientRect().top +
      box.scrollTop
    const bottom = top + item.offsetHeight
    if (bottom + 8 > box.clientHeight)
      box.scrollTop = Math.min(top - 8, bottom + 8 - box.clientHeight)
  }

  function open(): void {
    render()
    root.classList.add('lm-open')
    dialog.showModal()
    place()
    btn.setAttribute('aria-expanded', 'true')
    const row = dialog.querySelector<HTMLElement>('[aria-current="page"]')
    if (row === null) return
    row.focus({ preventScroll: true })
    reveal(row)
  }

  /** Any way the panel closes: Escape, the backdrop, a link or its button. */
  function settle(): void {
    root.classList.remove('lm-open')
    btn.setAttribute('aria-expanded', 'false')
    btn.focus({ preventScroll: true })
  }

  function shut(): void {
    if (dialog.open) dialog.close()
    settle()
  }

  /** An in-page address: a step through the deck, anything else scrolled to. */
  function go(href: string): void {
    const n = stepFromHash(href, deck.count)
    if (n !== null) {
      deck.jump(n)
      return
    }
    document.getElementById(href.slice(1))?.scrollIntoView({ block: 'start' })
  }

  btn.addEventListener('click', open)
  dialog.addEventListener('close', settle)
  window.addEventListener('resize', () => {
    if (dialog.open) place()
  })

  let downOutside = false
  dialog.addEventListener('pointerdown', (e) => {
    downOutside = outside(dialog, e)
  })
  dialog.addEventListener('click', (e) => {
    if (outside(dialog, e)) {
      if (downOutside) shut()
      return
    }
    const t = e.target as Element
    if (t.closest('[data-close]') !== null) {
      shut()
      return
    }
    const a = t.closest('a')
    if (a === null || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const href = a.getAttribute('href') ?? ''
    if (!href.startsWith('#')) {
      shut()
      return
    }
    e.preventDefault()
    shut()
    go(href)
  })

  // the chips' caption names the step under the finger or the focus, then the step showing again
  const caption = (e: Event): void => {
    const cap = dialog.querySelector<HTMLElement>('.lm-cap')
    const a = (e.target as Element).closest('.lm-steps a')
    if (cap === null) return
    const over = e.type === 'pointerover' || e.type === 'focusin'
    cap.textContent =
      over && a !== null
        ? (a.getAttribute('aria-label') ?? a.textContent ?? '')
        : (cap.dataset.now ?? '')
  }
  for (const type of ['pointerover', 'pointerout', 'focusin', 'focusout'])
    dialog.addEventListener(type, caption)
}
