// ============================================================
// Welcome mails — the first mail a new account gets, and its confirm link
// ============================================================
//
// Three mails share one layout: the welcome (Google, Apple and email-code
// sign-ups, whose address is already confirmed), the confirm mail (password
// sign-ups; it is their welcome too) and the fresh confirm link for accounts
// that never confirmed. The design and its copy were approved by the owner
// on 8 Oct 2026; the plan is in <user-dotfiles>/mercurypitch/welcome-mail/.
//
// Mail clients set the rules: tables and inline styles only, no SVG, live
// text never inside an image, and pictures as JPEG or PNG under /email/ on
// the app's own origin. Each picture is versioned in its name because a sent
// mail can never be updated: a changed picture gets a new name.

import type { RenderedEmail, ResendConfig } from './email'
import { ABOUT_URL, escapeHtml, footerHtml, REPO_URL, resendSend, } from './email'
import type { SignupSource, SignupVoiceprint } from './signup-hint'
import { noteName } from './signup-hint'

/**
 * Where a mail's links and pictures point. Links follow the app the sign-up
 * came from, so a dev sign-up lands on dev. Pictures always come from a
 * public host: a mail opened on a phone cannot load anything from localhost.
 */
export interface MailOrigins {
  appOrigin: string
  assetOrigin: string
}

export interface WelcomeEmailVars extends MailOrigins {
  voiceprint: SignupVoiceprint | null
  signupSource: SignupSource | null
}

export interface ConfirmEmailVars extends MailOrigins {
  /** Absolute confirm link (GET /api/auth/verify-email?token=…&returnTo=…). */
  verifyUrl: string
  voiceprint: SignupVoiceprint | null
  /** Link lifetime for the "works for" line. Pass the token's real TTL. */
  ttlHours: number
}

export interface FreshLinkEmailVars extends ConfirmEmailVars {
  /** When the account was created, for "You signed up on October 3". */
  signedUpAt: string
}

// ── pictures ─────────────────────────────────────────────────────────

interface MailArt {
  path: string
  height: number
  alt: string
}

/** Every picture a mail can show, by role. Shown 600 wide, stored at 2x. */
export const MAIL_ART = {
  firstNote: {
    path: '/email/hero-01-first-note-v1.jpg',
    height: 400,
    alt: 'Merc, a glowing droplet, sings on a round brass stage under an amber spotlight while a ribbon of light rises through three rings.',
  },
  constellation: {
    path: '/email/hero-04-constellation-v1.jpg',
    height: 400,
    alt: 'Merc, a glowing droplet, stands on a rooftop ledge looking up at two linked constellations, with city lights below.',
  },
  karaokeNight: {
    path: '/email/hero-06-karaoke-night-v1.jpg',
    height: 400,
    alt: 'Merc, a glowing droplet, sings into a vintage microphone on a small stage under an amber spotlight.',
  },
  letter: {
    path: '/email/banner-07-letter-v1.jpg',
    height: 260,
    alt: 'Merc, a glowing droplet, peeks out of an open black envelope, holding up an amber key of light.',
  },
} as const satisfies Record<string, MailArt>

export const WORDMARK_PATH = '/email/wordmark-v1@2x.png'

/** The 192 px portrait made for mail from the legend's catalogue picture. */
export function legendPortraitPath(legendId: string): string {
  return `/email/legends/${legendId}-v1.jpg`
}

/** A twin beats Karaoke Night: the welcome is about the singer first. */
function welcomeArt(vars: WelcomeEmailVars): MailArt {
  if (vars.voiceprint !== null) return MAIL_ART.constellation
  if (vars.signupSource === 'karaoke') return MAIL_ART.karaokeNight
  return MAIL_ART.firstNote
}

// ── look ─────────────────────────────────────────────────────────────

const W = {
  page: '#010409',
  card: '#0d1117',
  panel: '#0b1520',
  panelLine: '#1c2a3b',
  line: '#30363d',
  text: '#e6edf3',
  soft: '#c3ccd6',
  muted: '#8b949e',
  blue: '#58a6ff',
  teal: '#2dd4bf',
  violet: '#bc8cff',
  amber: '#f2b45c',
  ink: '#04121f',
  track: '#1c2433',
  mystery: '#101b2a',
  mysteryLine: '#3b4a5f',
} as const

const SANS = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
// Outfit loads where a client honours the <link> in the head (Apple Mail);
// everywhere else the headline falls back to the sans stack.
const DISPLAY = "Outfit,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

/** The range bar's track: C2 to C6, wide enough for nearly every voice. */
const TRACK_LOW = 36
const TRACK_HIGH = 84

// ── building blocks ──────────────────────────────────────────────────

const url = (origin: string, path: string): string =>
  escapeHtml(`${origin}${path}`)

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;"><tr><td bgcolor="${W.teal}" style="background:${W.teal};border-radius:12px;"><a href="${href}" style="display:inline-block;padding:15px 28px;font:700 16px/1.2 ${SANS};color:${W.ink};text-decoration:none;border-radius:12px;">${label}</a></td></tr></table>`
}

function arrowLink(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:12px;font:600 15px/1.4 ${SANS};color:${W.blue};text-decoration:none;">${label} &rarr;</a>`
}

function inlineLink(label: string, href: string): string {
  return `<a href="${href}" style="color:${W.blue};text-decoration:none;font-weight:600;">${label}</a>`
}

function eyebrow(text: string, color: string = W.teal): string {
  return `<div style="font:700 12px/1.4 ${SANS};letter-spacing:1.6px;text-transform:uppercase;color:${color};margin:0 0 10px;">${escapeHtml(text)}</div>`
}

/** "24 hours", "7 days". */
function lifetime(hours: number): string {
  if (hours >= 48 && hours % 24 === 0) return `${hours / 24} days`
  return hours === 1 ? '1 hour' : `${hours} hours`
}

function signupDate(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

interface Lines {
  eyebrow: string
  headline: string
  body: string
}

interface Room {
  kicker: string
  color: string
  title: string
  /** Plain text, or text around one inline link. */
  blurb: string | { before: string; link: [string, string]; after: string }
  cta: string
  path: string
}

const ROOMS: readonly Room[] = [
  {
    kicker: 'Sing',
    color: W.teal,
    title: 'Learn to sing',
    blurb: {
      before: 'The Ascent guides you one week at a time, or you can ',
      link: ['sing freely', '/#/singing'],
      after: '.',
    },
    cta: 'Begin the Ascent',
    path: '/#/path',
  },
  {
    kicker: 'Warm up',
    color: W.blue,
    title: 'Exercises',
    blurb: 'Pitch, ear and timing drills that fit in a coffee break.',
    cta: 'Try a drill',
    path: '/#/exercises',
  },
  {
    kicker: 'Karaoke',
    color: W.violet,
    title: 'Your song, your stage',
    blurb:
      'Load a song, separate the vocal, and take the lead with lyrics and scoring.',
    cta: 'Pick a song',
    path: '/karaoke',
  },
  {
    kicker: 'Together',
    color: W.amber,
    title: 'Jam Rooms',
    blurb: 'Sing and jam with the whole band, live.',
    cta: 'Start a jam',
    path: '/#/jam',
  },
]

const ALSO_WAITING: ReadonlyArray<[string, string]> = [
  ['Community Challenges', '/#/challenges'],
  ['Piano', '/piano-night'],
  ['Guitar', '/guitar-night'],
  ['Drums', '/drum-night'],
]

// ── sections ─────────────────────────────────────────────────────────

function heroRow(
  art: MailArt,
  origins: MailOrigins,
  linkHome: boolean,
): string {
  const img = `<img src="${url(origins.assetOrigin, art.path)}" width="600" height="${art.height}" alt="${escapeHtml(art.alt)}" style="display:block;width:100%;height:auto;border:0;border-radius:17px 17px 0 0;">`
  // A welcome's picture opens Home. A confirm mail's stays unlinked, so
  // confirming is always a deliberate tap on the button: someone who got a
  // mistyped address must not confirm a stranger's account by scrolling.
  const hero = linkHome
    ? `<a href="${url(origins.appOrigin, '/#/home')}" aria-label="Open Mercury Pitch" style="display:block;text-decoration:none;">${img}</a>`
    : img
  return `<tr><td style="padding:0;font-size:0;line-height:0;">${hero}</td></tr>`
}

function introRow(lines: Lines, after = ''): string {
  return `<tr><td style="padding:30px 36px 4px;">${eyebrow(lines.eyebrow)}<h1 style="margin:0;font:700 31px/1.12 ${DISPLAY};letter-spacing:-0.4px;color:${W.text};">${escapeHtml(lines.headline)}</h1><p style="margin:14px 0 0;font:17px/1.6 ${SANS};color:${W.soft};">${escapeHtml(lines.body)}</p>${after}</td></tr>`
}

function confirmBlock(verifyUrl: string, ttlHours: number): string {
  const href = escapeHtml(verifyUrl)
  return `${button('Confirm my email', href)}<p style="margin:12px 0 0;font:13px/1.6 ${SANS};color:${W.muted};">The link works for ${lifetime(ttlHours)}. If the button doesn&#39;t open, paste this into your browser:<br><a href="${href}" style="color:${W.blue};text-decoration:none;word-break:break-all;font:12px/1.6 ${MONO};">${href}</a></p>`
}

/** Widths of the three range-bar cells on the C2 to C6 track, summing to 100. */
export function rangeBarWidths(
  lowMidi: number,
  highMidi: number,
): [number, number, number] {
  // Round the two edges and take the widths between them. Rounding each
  // width on its own can add up to 101 (F#3 to C6 came out 38 + 63).
  const edge = (midi: number): number =>
    Math.round(
      ((Math.min(TRACK_HIGH, Math.max(TRACK_LOW, midi)) - TRACK_LOW) /
        (TRACK_HIGH - TRACK_LOW)) *
        100,
    )
  // The sung cell keeps at least 1%, even for a range off either end.
  const start = Math.min(edge(lowMidi), 99)
  const end = Math.min(100, Math.max(edge(highMidi), start + 1))
  return [start, end - start, 100 - end]
}

function rangeBar(lowMidi: number, highMidi: number): string {
  const [before, sung, after] = rangeBarWidths(lowMidi, highMidi)
  // An empty cell still draws a sliver in some clients, so leave it out and
  // move the rounded end onto its neighbour.
  const cells = [
    before > 0
      ? `<td width="${before}%" height="8" bgcolor="${W.track}" style="font-size:0;line-height:0;border-radius:4px 0 0 4px;">&nbsp;</td>`
      : '',
    `<td width="${sung}%" height="8" bgcolor="${W.teal}" style="background:${W.teal};background-image:linear-gradient(90deg,${W.blue},${W.teal},${W.violet});font-size:0;line-height:0;border-radius:${before > 0 ? '0' : '4px'} ${after > 0 ? '0 0' : '4px 4px'} ${before > 0 ? '0' : '4px'};">&nbsp;</td>`,
    after > 0
      ? `<td width="${after}%" height="8" bgcolor="${W.track}" style="font-size:0;line-height:0;border-radius:0 4px 4px 0;">&nbsp;</td>`
      : '',
  ].join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 2px;"><tr>${cells}</tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font:11px/1.4 ${MONO};color:${W.muted};">C2</td><td align="right" style="font:11px/1.4 ${MONO};color:${W.muted};">C6</td></tr></table>`
}

function scoresLine(voiceprint: SignupVoiceprint): string {
  const parts = [
    voiceprint.accuracy === null ? null : `Accuracy ${voiceprint.accuracy}%`,
    voiceprint.steadiness === null
      ? null
      : `Steadiness ${voiceprint.steadiness}%`,
  ].filter((part): part is string => part !== null)
  return parts.length === 0
    ? ''
    : `<div style="font:13px/1.5 ${SANS};color:${W.muted};margin-top:6px;">${parts.join(' &middot; ')}</div>`
}

/**
 * The voiceprint panel: the twin when the sign-up brought one, otherwise an
 * invitation to find one. Its action is a button in the welcome, where it is
 * the main call, and a text link where Confirm my email is.
 */
function voiceprintPanel(
  voiceprint: SignupVoiceprint | null,
  origins: MailOrigins,
  primary: boolean,
): string {
  const action = (label: string, path: string): string =>
    primary
      ? button(label, url(origins.appOrigin, path))
      : arrowLink(label, url(origins.appOrigin, path))
  let left: string
  let inner: string
  if (voiceprint === null) {
    left = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="80" height="80" align="center" valign="middle" bgcolor="${W.mystery}" style="width:80px;height:80px;border-radius:50%;border:2px dashed ${W.mysteryLine};font:700 34px/1 ${DISPLAY};color:${W.violet};">?</td></tr></table>`
    inner =
      eyebrow('Your voiceprint twin', W.violet) +
      `<div style="font:700 22px/1.2 ${DISPLAY};color:${W.text};margin:-4px 0 6px;">Who shares your range?</div><div style="font:14px/1.55 ${SANS};color:${W.soft};">Sing for a minute and the Voice Mirror names the legend whose range matches yours.</div>` +
      action('Find my twin', '/mirror')
  } else {
    const twin = escapeHtml(voiceprint.twin)
    const span = voiceprint.highMidi - voiceprint.lowMidi
    left = `<img src="${url(origins.assetOrigin, legendPortraitPath(voiceprint.legendId))}" width="80" height="80" alt="Painted portrait of ${twin} from the Voice Mirror legends" style="display:block;border:0;outline:none;text-decoration:none;width:80px;height:80px;border-radius:50%;border:2px solid ${W.violet};">`
    inner =
      eyebrow('Your voiceprint twin', W.violet) +
      `<div style="font:700 24px/1.15 ${DISPLAY};color:${W.text};margin:-4px 0 6px;">${twin}</div><div style="font:14px/1.5 ${SANS};color:${W.soft};">${escapeHtml(voiceprint.voiceType)} &middot; ${noteName(voiceprint.lowMidi)} to ${noteName(voiceprint.highMidi)} &middot; ${span} semitones</div>` +
      rangeBar(voiceprint.lowMidi, voiceprint.highMidi) +
      scoresLine(voiceprint) +
      action('See my voiceprint', '/#/voice-constellation')
  }
  return `<tr><td style="padding:${primary ? 18 : 26}px 24px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${W.panel};border:1px solid ${W.panelLine};border-radius:16px;"><tr><td width="100" valign="top" style="padding:20px 0 20px 20px;">${left}</td><td valign="top" style="padding:20px 20px 20px 16px;">${inner}</td></tr></table></td></tr>`
}

function roomBlurb(room: Room, appOrigin: string): string {
  if (typeof room.blurb === 'string') return escapeHtml(room.blurb)
  const [label, path] = room.blurb.link
  return `${escapeHtml(room.blurb.before)}${inlineLink(escapeHtml(label), url(appOrigin, path))}${escapeHtml(room.blurb.after)}`
}

/** 2x2 on desktop, stacked on phones: inline blocks that wrap. */
function roomsRow(appOrigin: string): string {
  const tiles = ROOMS.map(
    (room) =>
      `<div style="display:inline-block;width:100%;max-width:263px;vertical-align:top;font-size:16px;"><div style="margin:0 6px 12px;background:${W.panel};border:1px solid ${W.panelLine};border-radius:14px;padding:16px 16px 14px;"><div style="font:700 11px/1.3 ${SANS};letter-spacing:1.4px;text-transform:uppercase;color:${room.color};">${room.kicker}</div><div style="font:700 17px/1.3 ${DISPLAY};color:${W.text};margin:6px 0 4px;">${room.title}</div><div style="font:14px/1.5 ${SANS};color:${W.muted};min-height:63px;">${roomBlurb(room, appOrigin)}</div><a href="${url(appOrigin, room.path)}" style="display:inline-block;margin-top:10px;font:600 14px/1.4 ${SANS};color:${W.blue};text-decoration:none;">${room.cta} &rarr;</a></div></div>`,
  ).join('')
  const [challenges, piano, guitar, drums] = ALSO_WAITING.map(([label, path]) =>
    inlineLink(label, url(appOrigin, path)),
  )
  return `<tr><td style="padding:22px 18px 4px;"><div style="font:700 12px/1.4 ${SANS};letter-spacing:1.6px;text-transform:uppercase;color:${W.muted};padding:0 6px 12px;">Start anywhere</div><div style="font-size:0;">${tiles}</div><div style="font:14px/1.55 ${SANS};color:${W.muted};padding:4px 6px 0;">Also waiting for you: ${challenges} and the night practice rooms for ${piano}, ${guitar} and ${drums}.</div></td></tr>`
}

function signOffRow(ignoreLine: string | null): string {
  const ignore =
    ignoreLine === null
      ? ''
      : `<div style="border-top:1px solid ${W.line};margin-top:20px;padding-top:16px;font:13px/1.6 ${SANS};color:${W.muted};">${escapeHtml(ignoreLine)}</div>`
  return `<tr><td style="padding:22px 36px 30px;"><p style="margin:0;font:15px/1.6 ${SANS};color:${W.soft};">Have a question? Reply to this email. Merc reads every one.</p>${ignore}</td></tr>`
}

function documentHtml(
  subject: string,
  preheader: string,
  origins: MailOrigins,
  rows: string[],
  reason: string,
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&amp;display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background:${W.page}; -webkit-text-size-adjust:100%;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:${W.page}; font-size:1px; line-height:1px;">${escapeHtml(preheader)}&#8203;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${W.page}" style="background:${W.page};"><tr><td align="center" style="padding:22px 12px 30px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:2px 4px 16px;"><a href="${escapeHtml(origins.appOrigin)}" style="text-decoration:none;"><img src="${url(origins.assetOrigin, WORDMARK_PATH)}" width="204" height="40" alt="MercuryPitch" style="display:block;border:0;width:204px;height:40px;"></a></td></tr>
<tr><td style="background:${W.card};border:1px solid ${W.line};border-radius:18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table></td></tr>
${footerHtml(reason)}
</table></td></tr></table>
</body>
</html>`
}

// ── plain text ───────────────────────────────────────────────────────
//
// The text part says what the HTML says, link by link, for clients that
// show text only and for spam filters that compare the two.

function voiceprintText(
  voiceprint: SignupVoiceprint | null,
  appOrigin: string,
): string[] {
  if (voiceprint === null) {
    return [
      'Who shares your range?',
      'Sing for a minute and the Voice Mirror names the legend whose range matches yours.',
      `Find my twin: ${appOrigin}/mirror`,
    ]
  }
  const scores = [
    voiceprint.accuracy === null ? null : `Accuracy ${voiceprint.accuracy}%`,
    voiceprint.steadiness === null
      ? null
      : `Steadiness ${voiceprint.steadiness}%`,
  ].filter((part): part is string => part !== null)
  return [
    `Your voiceprint twin: ${voiceprint.twin}`,
    `${voiceprint.voiceType}, ${noteName(voiceprint.lowMidi)} to ${noteName(voiceprint.highMidi)}, ${voiceprint.highMidi - voiceprint.lowMidi} semitones`,
    ...(scores.length === 0 ? [] : [scores.join(', ')]),
    `See my voiceprint: ${appOrigin}/#/voice-constellation`,
  ]
}

function roomsText(appOrigin: string): string[] {
  const rooms = ROOMS.flatMap((room) => {
    const blurb =
      typeof room.blurb === 'string'
        ? room.blurb
        : `${room.blurb.before}${room.blurb.link[0]} (${appOrigin}${room.blurb.link[1]})${room.blurb.after}`
    return [
      `${room.title}: ${blurb}`,
      `${room.cta}: ${appOrigin}${room.path}`,
      '',
    ]
  })
  const [challenges, piano, guitar, drums] = ALSO_WAITING.map(
    ([label, path]) => `${label} (${appOrigin}${path})`,
  )
  return [
    'Start anywhere',
    '',
    ...rooms,
    `Also waiting for you: ${challenges} and the night practice rooms for ${piano}, ${guitar} and ${drums}.`,
  ]
}

function footerText(reason: string): string[] {
  return [
    'Mercury Pitch · Learn to sing and play. Practice has never been more fun.',
    `${ABOUT_URL} · ${REPO_URL}`,
    `${reason} mercurypitch.com.`,
  ]
}

function linkText(verifyUrl: string, ttlHours: number): string[] {
  return [
    `Confirm my email: ${verifyUrl}`,
    `The link works for ${lifetime(ttlHours)}.`,
  ]
}

const SIGN_OFF = 'Have a question? Reply to this email. Merc reads every one.'
const WELCOME_REASON = "You're receiving this because you created an account on"
const CONFIRM_REASON =
  "You're receiving this because this address was used to create an account on"

// ── the three mails ──────────────────────────────────────────────────

function welcomeLines(voiceprint: SignupVoiceprint | null): Lines {
  return voiceprint === null
    ? {
        eyebrow: 'Welcome to Mercury Pitch',
        headline: 'Only the first note has to be brave.',
        body: "After that, it's practice. Mercury Pitch shows every note you sing as a line on screen, so you can see right away if you're sharp or flat.",
      }
    : {
        eyebrow: 'Welcome to Mercury Pitch',
        headline: `You share a range with ${voiceprint.twin}.`,
        body: "Your voiceprint is saved to your account. Here's what it found.",
      }
}

/** Google, Apple and email-code sign-ups: the address is already confirmed. */
export function renderWelcomeEmail(vars: WelcomeEmailVars): RenderedEmail {
  const { voiceprint } = vars
  const subject =
    voiceprint === null
      ? "Welcome to Mercury Pitch. Let's hear you."
      : `You share a range with ${voiceprint.twin}`
  const preheader =
    voiceprint === null
      ? "Your account is ready. Here's where to start."
      : 'Your voiceprint is saved. Open it on any device.'
  const lines = welcomeLines(voiceprint)
  const html = documentHtml(
    subject,
    preheader,
    vars,
    [
      heroRow(welcomeArt(vars), vars, true),
      introRow(lines),
      voiceprintPanel(voiceprint, vars, true),
      roomsRow(vars.appOrigin),
      signOffRow(null),
    ],
    WELCOME_REASON.replace("'", '&#39;'),
  )
  const text = [
    lines.headline,
    '',
    lines.body,
    '',
    ...voiceprintText(voiceprint, vars.appOrigin),
    '',
    ...roomsText(vars.appOrigin),
    '',
    SIGN_OFF,
    '',
    ...footerText(WELCOME_REASON),
  ].join('\n')
  return { subject, html, text }
}

/** Password sign-ups. It is their welcome too, so it carries the rooms. */
export function renderConfirmEmail(vars: ConfirmEmailVars): RenderedEmail {
  const { voiceprint } = vars
  const subject =
    voiceprint === null
      ? 'Confirm your email for Mercury Pitch'
      : `Confirm your email, then meet ${voiceprint.twin} again`
  const preheader =
    voiceprint === null
      ? 'One tap and your account is set. Then the fun part.'
      : 'Your voiceprint is on your account. One tap confirms the address it lives on.'
  const lines: Lines = {
    eyebrow: 'One last step',
    headline: 'Last thing before the first note.',
    body: 'Confirm your email so we know this address is yours.',
  }
  const ignore = "Didn't sign up for Mercury Pitch? You can ignore this email."
  const html = documentHtml(
    subject,
    preheader,
    vars,
    [
      heroRow(MAIL_ART.letter, vars, false),
      introRow(lines, confirmBlock(vars.verifyUrl, vars.ttlHours)),
      voiceprintPanel(voiceprint, vars, false),
      roomsRow(vars.appOrigin),
      signOffRow(ignore),
    ],
    CONFIRM_REASON.replace("'", '&#39;'),
  )
  const text = [
    lines.headline,
    '',
    lines.body,
    '',
    ...linkText(vars.verifyUrl, vars.ttlHours),
    '',
    ...voiceprintText(voiceprint, vars.appOrigin),
    '',
    ...roomsText(vars.appOrigin),
    '',
    SIGN_OFF,
    ignore,
    '',
    ...footerText(CONFIRM_REASON),
  ].join('\n')
  return { subject, html, text }
}

/**
 * A fresh confirm link for an account that never confirmed, sent days after
 * sign-up. No rooms: the one job is the link. The voiceprint panel shows only
 * when the account has one, read from the account rather than a hint.
 */
export function renderFreshLinkEmail(vars: FreshLinkEmailVars): RenderedEmail {
  const { voiceprint } = vars
  const subject =
    voiceprint === null
      ? 'A fresh link to confirm your Mercury Pitch email'
      : 'Your voiceprint is still on your account'
  const preheader =
    voiceprint === null
      ? 'The first one may have expired or landed in another folder.'
      : 'One tap confirms the email it belongs to.'
  const signedUp = signupDate(vars.signedUpAt)
  const lines: Lines =
    voiceprint === null
      ? {
          eyebrow: 'A fresh link',
          headline: 'Your account is one tap from done.',
          body: `${signedUp === null ? 'You signed up a while ago' : `You signed up on ${signedUp}`}, and this address still isn't confirmed. The first link may have expired or ended up in another folder.`,
        }
      : {
          eyebrow: 'A fresh link',
          headline: `Your ${voiceprint.voiceType} voiceprint is still here.`,
          body: `It's on your account: ${noteName(voiceprint.lowMidi)} to ${noteName(voiceprint.highMidi)}, a range you share with ${voiceprint.twin}. Confirm your email so we know this address is yours.`,
        }
  const ignore =
    "Didn't sign up for Mercury Pitch? Ignore this and we won't write to this address again."
  const html = documentHtml(
    subject,
    preheader,
    vars,
    [
      heroRow(MAIL_ART.letter, vars, false),
      introRow(lines, confirmBlock(vars.verifyUrl, vars.ttlHours)),
      voiceprint === null ? '' : voiceprintPanel(voiceprint, vars, false),
      signOffRow(ignore),
    ],
    CONFIRM_REASON.replace("'", '&#39;'),
  )
  const text = [
    lines.headline,
    '',
    lines.body,
    '',
    ...linkText(vars.verifyUrl, vars.ttlHours),
    '',
    ...(voiceprint === null
      ? []
      : [...voiceprintText(voiceprint, vars.appOrigin), '']),
    SIGN_OFF,
    ignore,
    '',
    ...footerText(CONFIRM_REASON),
  ].join('\n')
  return { subject, html, text }
}

// ── sending ──────────────────────────────────────────────────────────

/** Send the welcome. Best-effort; see resendSend. */
export async function sendWelcomeMail(
  cfg: ResendConfig,
  to: string,
  vars: WelcomeEmailVars,
): Promise<boolean> {
  const ok = await resendSend(cfg, to, renderWelcomeEmail(vars))
  if (ok) console.log(`[email] signup welcome sent to ${to}`)
  return ok
}

/** Send the confirm mail. Best-effort; see resendSend. */
export async function sendConfirmMail(
  cfg: ResendConfig,
  to: string,
  vars: ConfirmEmailVars,
): Promise<boolean> {
  const ok = await resendSend(cfg, to, renderConfirmEmail(vars))
  if (ok) console.log(`[email] verification sent to ${to}`)
  return ok
}
