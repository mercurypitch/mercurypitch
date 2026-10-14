import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * The foot of a phone screen is a stack: the tab bar, then the cookie banner,
 * then the confirm-email pill, then the toasts, and none may cover another.
 * Each layer publishes its room on <html> (src/lib/foot-space.ts) and the
 * layers above stand on it. Everything else pinned to the foot stands on the
 * banner too, because the banner is drawn over everything.
 *
 * Measured in a production build with an EEA clock on 14 Oct 2026, before
 * these rules: the banner covered 46 px of the tab bar at 390x844 and all five
 * of its tabs, 108 px of Karaoke Night's confirm pill with Resend and Dismiss,
 * 39 px of the voice pill, and the karaoke stage's transport row. These pin
 * the CSS half; src/e2e/toast-above-confirm-bar.spec.ts lays it out for real.
 *
 * Raw CSS, because jsdom does not evaluate CSS modules into computed styles.
 */

const css = (path: string): string =>
  readFileSync(resolve(__dirname, '..', path), 'utf-8')

/** The body of the first rule whose selector is exactly `selector`. */
function rule(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  if (start < 0) return ''
  return source.slice(start, source.indexOf('\n}', start))
}

describe('the cookie banner stands on the tab bar', () => {
  it('floors at the room the tab bar publishes', () => {
    const banner = rule(css('components/ConsentBanner.module.css'), '.banner')
    expect(banner).toMatch(
      /bottom\s*:\s*max\([\s\S]*?calc\(var\(--tabbar-space, 0px\) \+ 0\.5rem\)/,
    )
  })

  it('is published by the tab bar while it is mounted', () => {
    const bar = css('components/mobile/BottomTabBar.tsx')
    expect(bar).toMatch(/publishFootSpace\(el, TABBAR_SPACE_VAR\)/)
    expect(bar).toMatch(/TABBAR_SPACE_VAR = '--tabbar-space'/)
  })
})

describe('the confirm-email pill publishes its room for the toasts', () => {
  it('publishes it unless it is the inline strip', () => {
    const pill = css('components/account/VerifyEmailBanner.tsx')
    expect(pill).toMatch(/VERIFY_SPACE_VAR = '--verify-banner-space'/)
    expect(pill).toMatch(
      /placement !== 'inline'\)\s*publishFootSpace\(el, VERIFY_SPACE_VAR\)/,
    )
  })
})

describe('everything else pinned to the foot stands on the banner', () => {
  it('ends a full-screen mobile stage on it', () => {
    const shell = rule(css('components/mobile/StageShell.module.css'), '.shell')
    expect(shell).toMatch(
      /height\s*:\s*calc\(100dvh - var\(--consent-banner-space, 0px\)\)/,
    )
  })

  it('lets the karaoke lyrics shrink with the stage', () => {
    // 24vh + 32vh of padding is a floor the column cannot go under, and it
    // pushed the transport row out of a 376px stage (320x568, banner open).
    const lyrics = rule(
      css('components/KaraokeMobileStage.module.css'),
      '.lyrics',
    )
    expect(lyrics).toMatch(/--lyrics-room\s*:[^;]*--consent-banner-space/)
    expect(lyrics).toMatch(/padding\s*:\s*min\(24vh,/)
  })

  it.each([
    [
      'the voice pill',
      'features/voice-control/VoiceControlHud.module.css',
      '.pill',
    ],
    [
      'the practice timer',
      'features/practice-timer/PracticeTimerPill.module.css',
      '.pill',
    ],
    [
      'the mixer edit toolbar',
      'components/StemMixerEditToolbar.module.css',
      '.bar',
    ],
    ['the history toast', 'styles/uvr.css', '.history-toast'],
    ['the session toast', 'styles/uvr.css', '.session-toast'],
    ['the result toast', 'styles/uvr.css', '.rv-toast'],
    [
      'the jam chat bubble',
      'components/jam/JamChatWidget.module.css',
      '.widgetContainer',
    ],
    ["Merc's dock", 'components/MascotDock.module.css', '.bl,\n.br'],
  ])('%s', (_name, path, selector) => {
    expect(rule(css(path), selector)).toMatch(/--consent-banner-space/)
  })

  it('keeps the jam guide dock in one row with the chat bubble', () => {
    const offset =
      'max(var(--tabbar-total, 62px), var(--consent-banner-space, 0px)) + 16px'
    expect(css('components/jam/JamPanel.module.css')).toContain(offset)
    expect(css('components/jam/JamChatWidget.module.css')).toContain(offset)
  })
})
