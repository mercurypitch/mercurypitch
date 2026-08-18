// ============================================================
// The fretboard is what the page is for
// ============================================================
//
// Eight practice modes each hang their own controls above the fretboard on
// the Guitar page. On a desktop there is room. On a phone they stack and push
// the fretboard below the fold, which is the thing somebody opened the page
// to use.
//
// The whole set collapses into one tappable row under 768px. Desktop is
// untouched by design — the toggle is `display: none` and the body is never
// hidden — so this is a media query and a wrapper rather than a rebuild.
// That matters: these HUDs go away entirely once Guitar Night reaches
// parity, and rewriting them now would be work with a known expiry date.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function repoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const page = repoFile('src/pages/GuitarPage.tsx')
const css = repoFile('src/styles/guitar-practice.css')

/** The declarations of the first rule whose selector list is exactly `sel`. */
function ruleBody(source: string, sel: string): string {
  const opener = `${sel} {`
  const start = source.indexOf(opener)
  expect(start, `missing rule for ${sel}`).toBeGreaterThan(-1)
  const from = start + opener.length
  return source.slice(from, source.indexOf('}', from))
}

const phone = ((): string => {
  const marker = '@media (max-width: 768px)'
  const start = css.lastIndexOf(marker)
  expect(start, 'missing the phone block').toBeGreaterThan(-1)
  let depth = 1
  let index = start + marker.length + 2
  while (depth > 0 && index < css.length) {
    if (css[index] === '{') depth += 1
    else if (css[index] === '}') depth -= 1
    index += 1
  }
  return css.slice(start, index)
})()

describe('the dock', () => {
  it('wraps every mode HUD, not just the first', () => {
    // One wrapper around the contiguous block. If a later HUD drifts outside
    // it, that mode keeps crowding the fretboard and nobody notices, because
    // only one mode is on screen at a time.
    const opened = page.indexOf('<div class="gp-mode-hud-body"')
    expect(opened, 'the dock body is gone').toBeGreaterThan(-1)
    const closed = page.indexOf('\n          </div>\n        </div>', opened)
    expect(closed, 'the dock body is never closed').toBeGreaterThan(opened)
    const dockBody = page.slice(opened, closed)
    for (const mode of [
      'noteQuiz',
      'earTraining',
      'melodyTranscription',
      'callResponse',
      'cagedTrainer',
      'chordProgression',
      'singToFretboard',
      'transcriptionTrainer',
    ]) {
      expect(dockBody, `${mode} is outside the dock`).toContain(
        `fretboardMode() === '${mode}'`,
      )
    }
  })

  it('starts closed', () => {
    // Open by default would leave the phone exactly where it was.
    expect(page).toContain(
      'const [modeHudOpen, setModeHudOpen] = createSignal(false)',
    )
  })

  it('says which mode it is holding', () => {
    // "Practice controls" on every mode is a drawer you have to open to find
    // out whether you wanted it.
    expect(page).toContain('GUITAR_MODE_HUD_LABELS')
    expect(page).toContain('<span>{modeHudLabel()}</span>')
    for (const mode of ['noteQuiz', 'earTraining', 'transcriptionTrainer']) {
      expect(page).toContain(`${mode}: '`)
    }
  })

  it('tells a screen reader what it does', () => {
    const toggle = page.slice(
      page.indexOf('class="gp-mode-hud-toggle"'),
      page.indexOf('data-testid="guitar-mode-hud-toggle"') + 200,
    )
    expect(toggle).toContain('aria-expanded={modeHudOpen()}')
    expect(toggle).toContain('aria-controls="gp-mode-hud-body"')
    expect(page).toContain('id="gp-mode-hud-body"')
  })

  it('uses an icon component rather than a character', () => {
    expect(page).toContain('<ChevronDown size={16} />')
  })
})

describe('desktop is untouched', () => {
  it('never hides the body outside the phone block', () => {
    // The body rule must exist ONLY inside the media query. A stray
    // `display: none` at top level hides the HUDs for everyone.
    const outsidePhone = css.replace(phone, '')
    expect(outsidePhone).not.toContain('.gp-mode-hud-body')
  })

  it('hides only the toggle at full width', () => {
    expect(ruleBody(css, '.gp-mode-hud-toggle')).toContain('display: none')
  })
})

describe('the phone block', () => {
  it('collapses the body and opens it on the modifier', () => {
    expect(ruleBody(phone, '  .gp-mode-hud-body')).toContain('display: none')
    const open = ruleBody(phone, '  .gp-mode-hud-dock--open .gp-mode-hud-body')
    expect(open).toContain('display: block')
  })

  it('gives the toggle a thumb-sized target', () => {
    // It is the only way back to the controls once they are closed.
    expect(ruleBody(phone, '  .gp-mode-hud-toggle')).toContain(
      'min-height: 40px',
    )
  })

  it("keeps a tall HUD from taking the fretboard's place", () => {
    const open = ruleBody(phone, '  .gp-mode-hud-dock--open .gp-mode-hud-body')
    expect(open).toContain('max-height: 45vh')
    expect(open).toContain('overflow-y: auto')
  })

  it('respects a reduced-motion preference', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
