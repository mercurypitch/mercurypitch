/* ==========================================================================================
   INTERACTION PATTERNS worth reusing in the lesson explorer, condensed from the stats site:
   the picker bundle (programme list, plate tilt, auto-cycle, sound switch) and the report's
   stage.js / app.js (scroll reveals, active-section nav, deep links, tooltips, one sound switch
   shared by every page). Rewritten readable; behaviour and timings are the site's.
   ========================================================================================== */

/* ---------------------------------------------------------------- 1. the programme list */
// Each lesson is a big serif title (38% opacity until hovered or selected) with a hairline "string"
// under it. Hover (mouse only) or focus selects it: the hero visual retunes, the accent colour
// cross-fades (registered @property --accent, .9 s), the string is plucked and, with sound on, the
// lesson's key is strummed. Arrow keys move between items. A click plays an exit (the plate's burst)
// before navigating. After 9 s without input and 7 s since the last change the list advances by
// itself; ?cycle=0 turns that off (useful for screenshots and tests).
export function programme(
  root,
  items,
  { onSelect, onOpen, pluck, idleMs = 9000, holdMs = 7000 },
) {
  const links = items.map((it) =>
    root.querySelector(`[data-piece="${it.slug}"] a[href]`),
  )
  let current = -1,
    hovered = -1,
    lastInput = performance.now(),
    lastChange = performance.now(),
    opening = false
  const select = (i, how = {}) => {
    if (i === current || opening) return
    current = i
    lastChange = performance.now()
    items.forEach((_, k) =>
      root
        .querySelector(`[data-piece="${items[k].slug}"]`)
        .toggleAttribute('data-selected', k === i),
    )
    root.style.setProperty('--accent', items[i].accent)
    root.style.setProperty('--accent-2', items[i].accent2)
    if (how.pluck !== false && pluck) pluck(i)
    onSelect && onSelect(i, how)
  }
  links.forEach((a, i) => {
    a.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') {
        lastInput = performance.now()
        hovered = i
        select(i)
      }
    })
    a.addEventListener('pointerleave', () => {
      lastInput = performance.now()
      hovered = -1
    })
    a.addEventListener('focus', () => {
      lastInput = performance.now()
      select(i)
    })
    a.addEventListener('click', (e) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return
      e.preventDefault()
      opening = true
      root.classList.add('is-opening')
      Promise.resolve(onOpen && onOpen(i)).then(() => location.assign(a.href))
    })
    a.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
      if (d) {
        e.preventDefault()
        links[(i + d + links.length) % links.length].focus()
      }
    })
  })
  const cycle = new URLSearchParams(location.search).get('cycle') !== '0'
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  setInterval(() => {
    const now = performance.now()
    if (
      !cycle ||
      hovered >= 0 ||
      opening ||
      reduce.matches ||
      document.visibilityState !== 'visible' ||
      now - lastInput < idleMs ||
      now - lastChange < holdMs ||
      links.includes(document.activeElement)
    )
      return
    select((current + 1) % items.length, { sound: false })
  }, 1000)
  // a hash (#slug) selects without sound, and the Back button (pageshow persisted) restores the page
  const fromHash = () =>
    items.findIndex((it) => `#${it.slug}` === location.hash)
  addEventListener('hashchange', () => {
    const i = fromHash()
    if (i >= 0) select(i, { sound: false })
  })
  addEventListener('pageshow', (e) => {
    if (e.persisted) {
      opening = false
      root.classList.remove('is-opening')
      const p = current
      current = -1
      select(p < 0 ? 0 : p, { sound: false, pluck: false })
    }
  })
  select(Math.max(0, fromHash()), { sound: false, pluck: false })
  return { select }
}
// The pluck itself (picker Bt): animate the path for 1.5 s with requestAnimationFrame, using
// pluckPath(t) from strings-and-waves.js, then restore the straight line.
export function pluckString(path, pluckPath, restPath) {
  const t0 = performance.now()
  const frame = (now) => {
    const t = (now - t0) / 1000
    if (t >= 1.5) {
      path.setAttribute('d', restPath())
      return
    }
    path.setAttribute('d', pluckPath(t))
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/* ---------------------------------------------------------------- 2. the tilting plate */
// The visual tilts up to 3.5 degrees towards the mouse (perspective 1600 px), easing back on leave
// through the CSS transition (.7 s var(--ease)). Mouse only: touch and reduced motion stay flat.
export function tilt(el, max = 3.5) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || reduce.matches) return
    const r = el.getBoundingClientRect(),
      x = (e.clientX - r.left) / r.width - 0.5,
      y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--tilt-x', `${(-y * 2 * max).toFixed(2)}deg`)
    el.style.setProperty('--tilt-y', `${(x * 2 * max).toFixed(2)}deg`)
  })
  el.addEventListener('pointerleave', () => {
    el.style.removeProperty('--tilt-x')
    el.style.removeProperty('--tilt-y')
  })
}

/* ---------------------------------------------------------------- 3. one sound switch for the whole site */
// Off by default; the choice lives in localStorage under one key, so every page (picker and every
// report) agrees, and other tabs follow through the storage event. No AudioContext exists until the
// switch is on; turning it on is the user gesture that starts audio, answered with the page's chord.
const KEY = 'stats-sound' // a lesson site should use its own key, e.g. 'lessons-sound'
const store = () => {
  try {
    return window.localStorage
  } catch (e) {
    return null
  }
}
export const soundOn = () => {
  try {
    return (store() && store().getItem(KEY)) === 'on'
  } catch (e) {
    return false
  }
}
export function soundSwitch(btn, { onTurnOn } = {}) {
  const show = () => {
    btn.setAttribute('aria-pressed', String(soundOn()))
    const l = btn.querySelector('[data-sound-label]')
    if (l) l.textContent = soundOn() ? 'Sound on' : 'Sound off'
  }
  btn.hidden = false
  show()
  btn.addEventListener('click', () => {
    const on = !soundOn()
    try {
      store().setItem(KEY, on ? 'on' : 'off')
    } catch (e) {
      /* this visit only */
    }
    show()
    if (on && onTurnOn) onTurnOn()
  })
  addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) show()
  })
  addEventListener('pageshow', (e) => {
    if (e.persisted) show()
  })
}
// Sound owns all audio: hiding the tab or leaving the page fades every phrase out over 300 ms.

/* ---------------------------------------------------------------- 4. scroll reveals and performances */
// stage.js: a card fades up (opacity 0 -> 1, translateY 14px -> 0, .7 s cubic-bezier(.2,.8,.2,1)) the
// first time any of it enters the view (rootMargin 0 0 -6% 0). Once half of it (or half the viewport)
// shows, it counts as seen and, with sound on, performs once per visit. One performance at a time:
// a button's outranks a scroll's. Reduced motion, printing and deep links show the final state.
export function stage(cards, { reveal, perform } = {}) {
  const revealed = new Set(),
    performed = new Set(),
    reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const show = (c) => {
    if (revealed.has(c)) return
    revealed.add(c)
    c.classList.add('in')
    if (!reduce && reveal) reveal(c)
  }
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((en) => {
        const px = en.isIntersecting ? en.intersectionRect.height : 0,
          vh = en.rootBounds ? en.rootBounds.height : innerHeight
        if (px > 0) show(en.target)
        if (
          px > 0 &&
          (en.intersectionRatio >= 0.5 || px >= vh / 2) &&
          perform &&
          soundOn() &&
          !performed.has(en.target)
        ) {
          performed.add(en.target)
          perform(en.target)
        }
      }),
    { rootMargin: '0px 0px -6% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
  )
  cards.forEach((c) => io.observe(c))
  addEventListener('beforeprint', () =>
    cards.forEach((c) => c.classList.add('in')),
  )
  if (reduce) cards.forEach((c) => c.classList.add('in'))
}

/* ---------------------------------------------------------------- 5. the movement nav */
// The section whose top passes 35% of the viewport lights its nav pill (rootMargin -35% 0 -60% 0).
export function activeNav(links, sections) {
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((en) => {
        if (!en.isIntersecting) return
        links.forEach((a) => {
          const on = a.getAttribute('href') === '#' + en.target.id
          a.classList.toggle('on', on)
          on
            ? a.setAttribute('aria-current', 'true')
            : a.removeAttribute('aria-current')
        })
      }),
    { rootMargin: '-35% 0px -60% 0px' },
  )
  sections.forEach((s) => io.observe(s))
}
// Nav markup: <a href="#tempo"><b>II</b>Tempo</a>, roman numerals in mono 11 px ink-3, aqua when on.
// For lessons: <a href="#l3"><b>III</b>Intervals</a>; symbols for non-numbered parts (the site uses a
// four-pointed star for Showstoppers and a section sign for Notes).

/* ---------------------------------------------------------------- 6. deep links */
// #fig-score scrolls to that card instantly (a smooth scroll would still be travelling when the web
// fonts land and move it), reveals it without the slide, pulses an aqua ring (.flash, 2.2 s), and
// scrolls once more after document.fonts.ready.
export function focusHash() {
  const t = document.getElementById(decodeURIComponent(location.hash.slice(1)))
  if (!t) return
  if (t.classList.contains('card')) {
    t.style.transition = 'none'
    t.classList.add('in')
    void t.offsetWidth
    t.style.transition = ''
    t.classList.remove('flash')
    void t.offsetWidth
    t.classList.add('flash')
  }
  t.scrollIntoView({ block: 'start', behavior: 'instant' })
  if (document.fonts)
    document.fonts.ready.then(() =>
      requestAnimationFrame(() =>
        t.scrollIntoView({ block: 'start', behavior: 'instant' }),
      ),
    )
}

/* ---------------------------------------------------------------- 7. tooltips that work on touch */
// Mouse: the tip follows the pointer and hides on leave. Touch: a tap shows it and it stays until the
// next tap elsewhere or a scroll (pointerleave fires as soon as a finger lifts). Elements carry
// data-tip keys; one delegate per figure looks the content up.
export function tipDelegate(root, tip, lookup) {
  const move = (e) => {
    const r = tip.getBoundingClientRect()
    let x = e.clientX + 16,
      y = e.clientY + 16
    if (x + r.width > innerWidth - 10) x = e.clientX - r.width - 14
    if (y + r.height > innerHeight - 10) y = e.clientY - r.height - 14
    tip.style.transform = `translate(${Math.max(6, x)}px, ${Math.max(6, y)}px)`
  }
  const on = (e) => {
    const t = e.target.closest('[data-tip]')
    if (!t || !root.contains(t)) {
      tip.classList.remove('on')
      return
    }
    const html = lookup(t.getAttribute('data-tip'), t, e)
    if (!html) {
      tip.classList.remove('on')
      return
    }
    tip.innerHTML = html
    tip.classList.add('on')
    move(e)
  }
  root.addEventListener('pointermove', on)
  root.addEventListener('pointerdown', on)
  root.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') tip.classList.remove('on')
  })
  addEventListener('scroll', () => tip.classList.remove('on'), {
    passive: true,
  })
}

/* ---------------------------------------------------------------- 8. navigation between lessons */
// The picker -> report hop: an inline <style>@view-transition { navigation: auto; }</style> first in
// <head> (Chrome decides on the cross-fade as soon as any stylesheet is ready), plus
//   <script type="speculationrules">{ "prerender": [{ "where": { "href_matches": "/*/" }, "eagerness": "moderate" }] }</script>
// so hovering a lesson prerenders it and the click lands instantly. A prerendered page waits for
// document.prerenderingchange before starting its reveals, so they play for the visitor.
