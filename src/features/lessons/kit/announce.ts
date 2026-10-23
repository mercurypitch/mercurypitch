// ============================================================
// Lesson announcer — one polite status line for news a screen reader must hear
// ============================================================
//
// A live region speaks a change to a region the screen reader already
// knows. One that appears from display:none in the same tick as its words
// is usually skipped (VoiceOver especially), and a result drawn inside an
// aria-hidden figure is never heard at all. This is the page's one
// always-present, visually hidden status line, made the first time a module
// asks for it: a predict's reveal and a tapped tempo are written here, and
// focus stays where the learner left it.

/** The pause between emptying the line and writing it, so the same words twice still count as a change. */
export const ANNOUNCE_DELAY_MS = 60

let line: HTMLElement | null = null
let pending: number | undefined

/**
 * The status line, made on first use. A module that will speak calls this
 * as it mounts, so the line is in the page before its first words: a
 * region added and written in one go is the very thing screen readers skip.
 */
export function announcer(): HTMLElement {
  if (line?.isConnected === true) return line
  line = document.createElement('p')
  line.className = 'sr'
  line.setAttribute('role', 'status')
  line.dataset.announcer = ''
  ;(document.querySelector('main') ?? document.body).append(line)
  return line
}

/** Speaks `text` politely, after whatever is being said. Empty text says nothing. */
export function announce(text: string): void {
  const el = announcer()
  window.clearTimeout(pending)
  el.textContent = ''
  if (text === '') return
  pending = window.setTimeout(() => {
    el.textContent = text
  }, ANNOUNCE_DELAY_MS)
}

/** The blocks a reveal draws on lines of their own; a `br` ends a line too. */
const LINE_ENDS = '.mono, p, blockquote, .k, .bubble b'

/**
 * The words of `el` as one spoken line: each line the page draws becomes a
 * sentence, so "You said: higher" and the reveal under it are not run
 * together. It reads a copy's text rather than innerText, which keeps the
 * glyphs a screen reader is told to skip, sets words in the capitals the
 * page draws them in, and breaks a line around each visually hidden word.
 */
export function spokenText(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement
  copy
    .querySelectorAll('[aria-hidden="true"], [hidden], button')
    .forEach((n) => n.remove())
  // the markup's line breaks only wrap its source, so they go first
  const texts = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT)
  for (let t = texts.nextNode(); t !== null; t = texts.nextNode())
    t.textContent = (t.textContent ?? '').replace(/\s+/g, ' ')
  copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  copy.querySelectorAll(LINE_ENDS).forEach((block) => block.append('\n'))
  return (copy.textContent ?? '')
    .split('\n')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part !== '')
    .map((part, i, all) =>
      i < all.length - 1 && !/[.!?:;,]$/.test(part) ? `${part}.` : part,
    )
    .join(' ')
}
