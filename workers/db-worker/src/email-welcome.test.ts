import { describe, expect, it } from 'vitest'
import type { RenderedEmail } from './email'
import type { MailOrigins } from './email-welcome'
import { legendPortraitPath, MAIL_ART, rangeBarWidths, renderConfirmEmail, renderFreshLinkEmail, renderWelcomeEmail, WORDMARK_PATH, } from './email-welcome'
import type { SignupVoiceprint } from './signup-hint'
import { parseVoiceprintHint } from './signup-hint'

// Links and pictures on different hosts, so a test can tell which one a URL
// was built from.
const APP = 'https://app.test'
const PICTURES = 'https://pictures.test'
const ORIGINS: MailOrigins = { appOrigin: APP, assetOrigin: PICTURES }
const VERIFY_URL = 'https://api.test/api/auth/verify-email?token=t0k&returnTo=x'

const SINATRA = parseVoiceprintHint({
  twin: 'Frank Sinatra',
  lowMidi: 40,
  highMidi: 67,
  accuracy: 80,
  steadiness: 85,
}) as SignupVoiceprint

const welcome = (
  voiceprint: SignupVoiceprint | null,
  signupSource: 'karaoke' | null = null,
): RenderedEmail => renderWelcomeEmail({ ...ORIGINS, voiceprint, signupSource })

const confirm = (voiceprint: SignupVoiceprint | null): RenderedEmail =>
  renderConfirmEmail({
    ...ORIGINS,
    verifyUrl: VERIFY_URL,
    voiceprint,
    ttlHours: 24,
  })

const freshLink = (
  voiceprint: SignupVoiceprint | null,
  signedUpAt = '2026-10-03T18:20:00.000Z',
): RenderedEmail =>
  renderFreshLinkEmail({
    ...ORIGINS,
    verifyUrl: VERIFY_URL,
    voiceprint,
    ttlHours: 7 * 24,
    signedUpAt,
  })

const EVERY_MAIL: ReadonlyArray<[string, () => RenderedEmail]> = [
  ['welcome', () => welcome(null)],
  ['welcome from Karaoke Night', () => welcome(null, 'karaoke')],
  ['welcome with a twin', () => welcome(SINATRA)],
  ['confirm', () => confirm(null)],
  ['confirm with a twin', () => confirm(SINATRA)],
  ['fresh link', () => freshLink(null)],
  ['fresh link with a twin', () => freshLink(SINATRA)],
]

const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
const srcs = (html: string): string[] =>
  [...html.matchAll(/src="([^"]*)"/g)].map((m) => m[1])

/** What a reader sees: tags gone, entities read. */
function visibleText(html: string): string {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<\/?(?:a|span)\b[^>]*>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&rarr;/g, '→')
    .replace(/&copy;/g, '©')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

describe('which picture a mail opens with', () => {
  const heroOf = (mail: RenderedEmail): string | undefined =>
    srcs(mail.html).find(
      (src) => src.includes('/email/hero-') || src.includes('/email/banner-'),
    )

  it('gives the welcome the first-note stage, Karaoke Night its own, and a twin the constellations', () => {
    expect(heroOf(welcome(null))).toBe(PICTURES + MAIL_ART.firstNote.path)
    expect(heroOf(welcome(null, 'karaoke'))).toBe(
      PICTURES + MAIL_ART.karaokeNight.path,
    )
    expect(heroOf(welcome(SINATRA))).toBe(
      PICTURES + MAIL_ART.constellation.path,
    )
  })

  it('lets a twin win over Karaoke Night', () => {
    expect(heroOf(welcome(SINATRA, 'karaoke'))).toBe(
      PICTURES + MAIL_ART.constellation.path,
    )
  })

  it('gives both confirm mails the letter', () => {
    for (const mail of [
      confirm(null),
      confirm(SINATRA),
      freshLink(null),
      freshLink(SINATRA),
    ]) {
      expect(heroOf(mail)).toBe(PICTURES + MAIL_ART.letter.path)
    }
  })

  it('opens Home from the welcome picture only', () => {
    expect(welcome(null).html).toContain(
      `<a href="${APP}/#/home" aria-label="Open Mercury Pitch"`,
    )
    // A confirm mail's picture is not a link, so confirming is always a tap
    // on the button and never a stray tap on the picture.
    for (const mail of [confirm(null), freshLink(SINATRA)]) {
      expect(hrefs(mail.html)).not.toContain(`${APP}/#/home`)
    }
  })

  it('describes every picture for a reader who cannot see it', () => {
    for (const [, render] of EVERY_MAIL) {
      for (const tag of render().html.match(/<img [^>]*>/g) ?? []) {
        expect(tag).toMatch(/alt="[^"]+"/)
      }
    }
  })
})

describe('subject and preheader', () => {
  it.each([
    [
      'welcome',
      () => welcome(null),
      "Welcome to Mercury Pitch. Let's hear you.",
      "Your account is ready. Here's where to start.",
    ],
    [
      'welcome with a twin',
      () => welcome(SINATRA),
      'You share a range with Frank Sinatra',
      'Your voiceprint is saved. Open it on any device.',
    ],
    [
      'confirm',
      () => confirm(null),
      'Confirm your email for Mercury Pitch',
      'One tap and your account is set. Then the fun part.',
    ],
    [
      'confirm with a twin',
      () => confirm(SINATRA),
      'Confirm your email, then meet Frank Sinatra again',
      'Your voiceprint is on your account. One tap confirms the address it lives on.',
    ],
    [
      'fresh link',
      () => freshLink(null),
      'A fresh link to confirm your Mercury Pitch email',
      'The first one may have expired or landed in another folder.',
    ],
    [
      'fresh link with a twin',
      () => freshLink(SINATRA),
      'Your voiceprint is still on your account',
      'One tap confirms the email it belongs to.',
    ],
  ] as const)('%s', (_label, render, subject, preheader) => {
    const mail = render()
    expect(mail.subject).toBe(subject)
    expect(visibleText(mail.html)).toContain(preheader)
  })
})

describe('the voiceprint panel', () => {
  it('names the twin with portrait, range and scores', () => {
    const { html } = welcome(SINATRA)
    expect(srcs(html)).toContain(PICTURES + legendPortraitPath('frank-sinatra'))
    expect(legendPortraitPath('frank-sinatra')).toBe(
      '/email/legends/frank-sinatra-v1.jpg',
    )
    expect(html).toContain(
      'alt="Painted portrait of Frank Sinatra from the Voice Mirror legends"',
    )
    const text = visibleText(html)
    expect(text).toContain('Baritone · E2 to G4 · 27 semitones')
    expect(text).toContain('Accuracy 80% · Steadiness 85%')
    expect(hrefs(html)).toContain(`${APP}/#/voice-constellation`)
  })

  it('draws the range on a C2 to C6 track', () => {
    expect(rangeBarWidths(40, 67)).toEqual([8, 57, 35])
    expect(welcome(SINATRA).html).toMatch(
      /<td width="8%"[\s\S]*?<td width="57%"[\s\S]*?<td width="35%"/,
    )
  })

  it('fills exactly the whole track for every range a hint can carry', () => {
    // Every range parseVoiceprintHint accepts: 24 to 96, at most 48 apart.
    const broken: string[] = []
    for (let low = 24; low < 96; low++) {
      for (let high = low + 1; high <= Math.min(96, low + 48); high++) {
        const [before, sung, after] = rangeBarWidths(low, high)
        if (
          before + sung + after !== 100 ||
          sung < 1 ||
          Math.min(before, after) < 0
        ) {
          broken.push(`${low}-${high}: ${before}/${sung}/${after}`)
        }
      }
    }
    expect(broken).toEqual([])
  })

  it('shows only the scores the take has', () => {
    const one = welcome({ ...SINATRA, steadiness: null })
    expect(visibleText(one.html)).toContain('Accuracy 80%')
    expect(visibleText(one.html)).not.toContain('Steadiness')
    const none = welcome({ ...SINATRA, accuracy: null, steadiness: null })
    expect(visibleText(none.html)).not.toContain('Accuracy')
  })

  it('invites a singer without a twin to find one', () => {
    const { html } = welcome(null)
    expect(visibleText(html)).toContain('Who shares your range?')
    expect(hrefs(html)).toContain(`${APP}/mirror`)
    expect(html).not.toContain('/email/legends/')
  })

  it('is a button in the welcome and a text link beside Confirm my email', () => {
    const buttons = (html: string): number =>
      (html.match(/<td bgcolor="#2dd4bf"/g) ?? []).length
    expect(buttons(welcome(SINATRA).html)).toBe(1)
    expect(buttons(confirm(SINATRA).html)).toBe(1)
    expect(visibleText(confirm(SINATRA).html)).toContain('See my voiceprint →')
  })

  it('appears in a fresh-link mail only when the account has a twin', () => {
    expect(visibleText(freshLink(SINATRA).html)).toContain('Frank Sinatra')
    expect(visibleText(freshLink(null).html)).not.toContain(
      'Who shares your range?',
    )
  })
})

describe('the rooms', () => {
  const ROOM_LINKS = [
    '/#/singing',
    '/#/path',
    '/#/exercises',
    '/karaoke',
    '/#/jam',
    '/#/challenges',
    '/piano-night',
    '/guitar-night',
    '/drum-night',
  ]

  it('come with the welcome and the confirm mail', () => {
    for (const mail of [welcome(null), confirm(SINATRA)]) {
      expect(visibleText(mail.html)).toContain('Start anywhere')
      for (const path of ROOM_LINKS)
        expect(hrefs(mail.html)).toContain(APP + path)
    }
  })

  it('stay out of the fresh link, whose one job is the link', () => {
    expect(visibleText(freshLink(SINATRA).html)).not.toContain('Start anywhere')
  })
})

describe('the confirm link', () => {
  it('is the button and the fallback text, with its real lifetime', () => {
    const { html, text } = confirm(null)
    expect(hrefs(html).filter((href) => href === VERIFY_URL)).toHaveLength(2)
    expect(visibleText(html)).toContain(`The link works for 24 hours.`)
    expect(text).toContain(`Confirm my email: ${VERIFY_URL}`)
    expect(visibleText(freshLink(null).html)).toContain(
      'The link works for 7 days.',
    )
  })

  it('tells a fresh-link reader when they signed up', () => {
    expect(visibleText(freshLink(null).html)).toContain(
      'You signed up on October 3,',
    )
    expect(visibleText(freshLink(null, 'not a date').html)).toContain(
      'You signed up a while ago,',
    )
    expect(visibleText(freshLink(SINATRA).html)).toContain(
      'Your Baritone voiceprint is still here.',
    )
  })
})

describe('every mail', () => {
  it.each(EVERY_MAIL)(
    '%s: links go to the app, pictures to the picture host',
    (_label, render) => {
      const { html } = render()
      for (const src of srcs(html))
        expect(src.startsWith(PICTURES + '/email/')).toBe(true)
      expect(srcs(html)).toContain(PICTURES + WORDMARK_PATH)
      // In-app links follow the app. The footer's fixed links (about, legal,
      // source code) and the font stylesheet are the only others.
      const elsewhere = hrefs(html).filter(
        (href) =>
          !href.startsWith(APP) &&
          href !== VERIFY_URL &&
          !href.startsWith('https://about.mercurypitch.com') &&
          href !== 'https://github.com/mercurypitch/mercurypitch' &&
          href !== 'https://mercurypitch.com' &&
          !href.startsWith('https://fonts.googleapis.com/'),
      )
      expect(elsewhere).toEqual([])
    },
  )

  it.each(EVERY_MAIL)(
    '%s: the text part carries every link the HTML offers',
    (_label, render) => {
      const { html, text } = render()
      const offered = hrefs(html).filter(
        (href) =>
          (href.startsWith(APP + '/') && href !== `${APP}/#/home`) ||
          href === VERIFY_URL,
      )
      for (const href of offered) expect(text).toContain(href)
    },
  )

  it.each(EVERY_MAIL)('%s: keeps the house style', (_label, render) => {
    const { subject, html, text } = render()
    for (const copy of [subject, html, text]) {
      expect(copy).not.toMatch(/—|&mdash;|&#8212;/)
      expect(copy).not.toMatch(/practise/i)
    }
    // The wordmark picture's alt is the logo; anywhere a person reads the
    // name, it is two words.
    expect(visibleText(html)).not.toContain('MercuryPitch')
    expect(text).not.toContain('MercuryPitch')
    expect(visibleText(html)).toContain(
      'Learn to sing and play. Practice has never been more fun.',
    )
    expect(visibleText(html)).toContain('© 2026 Mercury Pitch · AGPL-3.0')
  })

  it.each(EVERY_MAIL)(
    '%s: stays under the size Gmail clips at',
    (_label, render) => {
      expect(new TextEncoder().encode(render().html).length).toBeLessThan(
        102 * 1024,
      )
    },
  )

  it('says why it was sent', () => {
    expect(visibleText(welcome(null).html)).toContain(
      "You're receiving this because you created an account on mercurypitch.com.",
    )
    for (const mail of [confirm(null), freshLink(null)]) {
      expect(visibleText(mail.html)).toContain(
        "You're receiving this because this address was used to create an account on mercurypitch.com.",
      )
    }
  })

  it('escapes whatever it prints', () => {
    const odd: SignupVoiceprint = {
      ...SINATRA,
      twin: 'A <b>"Bold"</b> & Co',
      voiceType: '<i>x</i>',
    }
    const verifyUrl = 'https://api.test/verify?token=a"b<c&d'
    const mail = renderConfirmEmail({
      ...ORIGINS,
      verifyUrl,
      voiceprint: odd,
      ttlHours: 24,
    })
    expect(mail.html).not.toContain('<b>')
    expect(mail.html).not.toContain('<i>x</i>')
    expect(mail.html).toContain(
      'A &lt;b&gt;&quot;Bold&quot;&lt;/b&gt; &amp; Co',
    )
    expect(mail.html).toContain('token=a&quot;b&lt;c&amp;d')
    expect(mail.html).not.toContain('token=a"b<c')
    const twinWelcome = renderWelcomeEmail({
      ...ORIGINS,
      voiceprint: odd,
      signupSource: null,
    })
    expect(twinWelcome.html).toContain(
      '<title>You share a range with A &lt;b&gt;',
    )
  })
})
