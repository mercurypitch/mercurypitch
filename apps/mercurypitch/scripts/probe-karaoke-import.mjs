// ============================================================
// Import a song, walked against the built bundle (plan S8, Stage 2)
// ============================================================
//
// A build that imports songs (every build but the store's: api-base.mjs
// karaokeImportFor) is walked through one import, end to end, on each
// upright frame, the way a singer meets it:
//
//   - the library opens on Import, and says where imported songs go;
//   - Import opens the phone's picker inside the tap (several songs at once),
//     and a song that passes the checks is asked about once: what it uses,
//     where it goes, how long to keep the app open. Asking is what gives the
//     phone its identity, so the songs left are only known from then on;
//   - Separate puts it in the queue, whose row says each thing it waits for:
//     Sending with the keep-open line, a studio slot, Separating with its
//     bar (and the room's song line says so too), Saving to this phone;
//   - the song arrives as yours, marked new, and plays in the room;
//   - the room's options and Settings count the songs; Restore purchases
//     and Subscribe fail closed, since no store is there yet (owner, 27 Sep);
//   - the song's own menu removes it from this phone;
//   - with no songs and no subscription, Import is the paywall.
//
// NO REAL HOST IS REACHED. The db-worker and the separation host the build
// names (api-base.mjs) are answered here by a stand-in that keeps the little
// state an import needs: the songs left, one job and its phase. What the
// stand-in does not answer is refused, as the rest of the probe refuses the
// network. The walk holds the upload and the stems open while it reads the
// rows that only exist while they are in flight.
//
// Nothing scrolls sideways on any surface it opens (readSideways).

import { Buffer } from 'node:buffer'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { karaokeImportFor, readEnvFiles, resolveApiBase, resolveUvrOrigin, } from '../api-base.mjs'
import { cueReady, readSideways, readStage } from './probe-karaoke.mjs'

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Whether the bundle imports songs, and the two hosts it would reach, from
 * the switch the build read (api-base.mjs), as assert-bundle.mjs reads it.
 * assert-bundle proves the bundle says the same.
 */
export function importTarget(processEnv = process.env) {
  const api = resolveApiBase(readEnvFiles(APP_DIR, 'production'), processEnv)
  return {
    importing: karaokeImportFor(api),
    target: api.target,
    api: api.base,
    uvr: resolveUvrOrigin(api, processEnv),
  }
}

/** Two short takes of real AAC in the bundle: the song, and its "stems". */
const MEDIA = {
  song: 'rooms/alley/ear-lab-workshop-ambient-take2-loop.m4a',
  vocal: 'rooms/alley/ear-lab-workshop-ambient-take2-loop.m4a',
  instrumental: 'rooms/alley/retro-analog-studio-ambient-take2-loop.m4a',
}

const SONG = 'Harbour Lights'
const JOB = 'probe-import-job'
const SINGER = 'probe-singer'
/** When the stand-in's subscription renews: "27 October" in the sheets. */
const RENEWS = '2026-10-27T09:00:00.000Z'

const SUBSCRIBED = Object.freeze({
  subscribed: true,
  left: 18,
  renewsAt: RENEWS,
  perPeriod: 20,
  cap: 50,
})
const LAPSED = Object.freeze({
  subscribed: false,
  left: 0,
  renewsAt: null,
  perPeriod: 20,
  cap: 50,
})

function deferred() {
  let release = () => undefined
  const done = new Promise((resolveIt) => {
    release = resolveIt
  })
  return { done, release }
}

const b64url = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url')

/** A token shaped like the worker's: the app reads its subject and expiry. */
function probeToken() {
  const now = Math.floor(Date.now() / 1000)
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: SINGER, iat: now, exp: now + 3600 }),
    'probe',
  ].join('.')
}

/** The bytes the stand-in serves, read from the bundle being walked. */
async function readMedia(context, baseUrl) {
  const bytes = {}
  for (const [name, path] of Object.entries(MEDIA)) {
    const response = await context.request.get(new URL(path, baseUrl).href)
    if (!response.ok()) {
      throw new Error(
        `the stand-in's ${name}: ${path} answered ${response.status()}`,
      )
    }
    bytes[name] = await response.body()
  }
  return bytes
}

/**
 * The db-worker and the separation host, as far as one import goes. Every
 * answer carries the CORS headers the real workers send, because the page
 * reaches both across origins.
 */
function standIn(media) {
  const token = probeToken()
  const state = {
    songs: SUBSCRIBED,
    phase: 'queued',
    upload: deferred(),
    stems: deferred(),
    anonymous: 0,
    billing: { withToken: 0, without: 0 },
    uploads: [],
    downloads: [],
    refused: new Set(),
  }

  const cors = (headers) => ({
    'access-control-allow-origin': headers.origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers':
      headers['access-control-request-headers'] ??
      'authorization, content-type',
    vary: 'Origin',
  })
  const json = (route, headers, body, status = 200) =>
    route.fulfill({
      status,
      headers: cors(headers),
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  const refuse = (route, method, pathname) => {
    state.refused.add(`${method} ${pathname}`)
    return route.abort('internetdisconnected')
  }
  const signedIn = (headers) => headers.authorization === `Bearer ${token}`

  async function answerApi(route) {
    const request = route.request()
    const headers = await request.allHeaders()
    const method = request.method()
    const { pathname } = new URL(request.url())
    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors(headers) })
    }
    if (method === 'POST' && pathname === '/api/auth/anonymous') {
      state.anonymous += 1
      const at = new Date().toISOString()
      return json(route, headers, {
        token,
        userId: SINGER,
        isNew: true,
        user: {
          id: SINGER,
          createdAt: at,
          updatedAt: at,
          authProvider: 'anonymous',
          email: null,
          emailVerified: false,
          lastLoginAt: null,
          isTestAccount: false,
          testAccountExpiresAt: null,
        },
      })
    }
    if (method === 'GET' && pathname === '/api/billing/me') {
      // As the worker does: nobody's songs without an identity.
      if (!signedIn(headers)) {
        state.billing.without += 1
        return json(route, headers, { error: 'Unauthorized' }, 401)
      }
      state.billing.withToken += 1
      return json(route, headers, {
        creditBalance: state.songs.left,
        entitlements: [],
        stripeConfigured: false,
        songs: state.songs,
      })
    }
    return refuse(route, method, pathname)
  }

  const statusOf = () => {
    const job = { session_id: JOB, files: [] }
    if (state.phase === 'separating') {
      return {
        ...job,
        status: 'processing',
        message: 'Separating',
        progress: 62,
      }
    }
    if (state.phase === 'done') {
      return {
        ...job,
        status: 'completed',
        progress: 100,
        files: ['vocal', 'instrumental'].map((stem) => ({
          stem,
          filename: `${stem}.m4a`,
          path: `${stem}.m4a`,
          size: media[stem].length,
        })),
      }
    }
    return { ...job, status: 'processing', message: 'Queued', progress: null }
  }

  async function answerUvr(route) {
    const request = route.request()
    const headers = await request.allHeaders()
    const method = request.method()
    const { pathname } = new URL(request.url())
    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors(headers) })
    }
    if (method === 'POST' && pathname === '/api/uvr/process') {
      const body = request.postDataBuffer()?.toString('latin1') ?? ''
      state.uploads.push({
        signedIn: signedIn(headers),
        m4a: /name="output_format"\r\n\r\nM4A\r\n/u.test(body),
        song: body.includes(`filename="${SONG}.m4a"`),
      })
      await state.upload.done
      // The server's admission takes the song.
      state.songs = { ...state.songs, left: state.songs.left - 1 }
      return json(route, headers, {
        session_id: JOB,
        status: 'processing',
        message: 'Queued',
        model: 'roformer',
        output_format: 'M4A',
      })
    }
    if (method === 'GET' && pathname === `/api/uvr/status/${JOB}`) {
      return json(route, headers, statusOf())
    }
    const output = new RegExp(
      `^/api/uvr/output/${JOB}/(vocal|instrumental)\\.m4a$`,
      'u',
    ).exec(pathname)
    if (method === 'GET' && output !== null) {
      state.downloads.push(output[1])
      await state.stems.done
      return route.fulfill({
        status: 200,
        headers: cors(headers),
        contentType: 'audio/mp4',
        body: media[output[1]],
      })
    }
    return refuse(route, method, pathname)
  }

  const quietly = (answer) => (route) =>
    answer(route).catch(() => {
      // The context closed under a held answer: the walk is over.
    })

  return {
    state,
    answerApi: quietly(answerApi),
    answerUvr: quietly(answerUvr),
    releaseAll() {
      state.upload.release()
      state.stems.release()
    },
  }
}

/** In the page: the library sheet as a singer reads it. */
const readLibrary = () => {
  const sheet = document.querySelector('[data-testid="karaoke-library"]')
  if (sheet === null) return null
  const text = (el) => (el?.textContent ?? '').trim().replace(/\s+/gu, ' ')
  const importBlock = sheet.querySelector('[data-testid="karaoke-import"]')
  return {
    importFirst:
      sheet
        .querySelector('[data-testid="karaoke-import"], section')
        ?.getAttribute('data-testid') === 'karaoke-import',
    button: text(importBlock?.querySelector('button')),
    line: text(importBlock?.querySelector('p')),
    keepOpen:
      [...sheet.querySelectorAll('p[role="status"]')]
        .map(text)
        .find((line) => line.startsWith('Keep Mercury Pitch open')) ?? null,
    empty: [...sheet.querySelectorAll('p')].some(
      (p) => text(p) === 'Songs you import appear here.',
    ),
    queue: [...sheet.querySelectorAll('[data-testid="karaoke-queue-row"]')].map(
      (row) => {
        const [title, line] = [
          ...row.querySelectorAll(':scope > span:nth-of-type(2) > span'),
        ].map(text)
        return {
          title,
          line,
          state: row.getAttribute('data-state'),
          bar:
            row
              .querySelector('[role="progressbar"]')
              ?.getAttribute('aria-valuenow') ?? null,
          buttons: row.querySelectorAll('button').length,
        }
      },
    ),
    songs: [
      ...sheet.querySelectorAll('[data-testid="karaoke-library-row"]'),
    ].map((row) => {
      const title = row.querySelector('span > span')
      return {
        id: row.getAttribute('data-session'),
        title: (title?.firstChild?.textContent ?? '').trim(),
        fresh: title?.querySelector('span') !== null,
        group: text(row.closest('section')?.querySelector('h3')),
      }
    }),
  }
}

/** In the page: an open sheet's words, in order, and its buttons. */
const readSheet = (selector) => {
  const dialog = document.querySelector(selector)
  if (dialog === null) return null
  const text = (el) => (el?.textContent ?? '').trim().replace(/\s+/gu, ' ')
  return {
    title: text(dialog.querySelector('h2')),
    items: [...dialog.querySelectorAll('li')].map(text),
    // A line of links is read as links.
    lines: [...dialog.querySelectorAll('p')]
      .filter((p) => p.querySelector('a') === null)
      .map(text),
    buttons: [...dialog.querySelectorAll('button')].map(
      (button) => button.getAttribute('aria-label') ?? text(button),
    ),
    links: [...dialog.querySelectorAll('a')].map(text),
    all: text(dialog),
  }
}

/** In the page: Settings rows by id, each line of a row as it is laid out. */
const readSettingsRows = (ids) => {
  const rows = {}
  for (const id of ids) {
    const row = document.querySelector(`[data-settings-row="${id}"]`)
    rows[id] =
      row === null
        ? null
        : row.innerText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join(' | ')
  }
  return rows
}

/** Copy the singer never reads in the app (owner, 27 Sep; plan §6.7). */
const NEVER = /credit|7 days|seven days|practise|nothing uploaded/iu

const exactly = (text) => `^${text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`

/**
 * One upright frame, one import from the picker to the room and back out.
 * Returns the step lines; throws with every problem found.
 */
export async function walkKaraokeImport(browser, args, frame, kit, target) {
  const {
    isolate,
    seed,
    shoot,
    tapDoor,
    waitPhase,
    walkOpen,
    bootTimeoutMs,
    stepTimeoutMs,
    runTimeoutMs,
  } = kit
  const ctx = { ...args, frame }
  const context = await isolate(
    await browser.newContext({
      viewport: frame,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
    }),
  )
  const failures = []
  const steps = []
  let at = 'boot'
  let server = null
  try {
    const media = await readMedia(context, args.baseUrl)
    server = standIn(media)
    const separation =
      target.uvr === '' ? new URL(args.baseUrl).origin : target.uvr
    // Registered after isolate's refusal, so these answer first.
    await context.route((url) => url.origin === target.api, server.answerApi)
    await context.route(
      (url) =>
        url.origin === separation && url.pathname.startsWith('/api/uvr/'),
      server.answerUvr,
    )
    const { state } = server

    const page = await context.newPage()
    page.on('pageerror', (error) => {
      failures.push(`page error: ${error.message}`)
    })
    await page.addInitScript(seed, args.theme)
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page
      .locator('#root.loaded')
      .waitFor({ state: 'attached', timeout: bootTimeoutMs })

    const visible = (selector, timeout = stepTimeoutMs) =>
      page
        .locator(selector)
        .first()
        .waitFor({ state: 'visible', timeout })
        .catch(() => {
          throw new Error(`${selector} never showed`)
        })
    const hidden = (selector) =>
      page
        .locator(selector)
        .first()
        .waitFor({ state: 'hidden', timeout: stepTimeoutMs })
        .catch(() => {
          throw new Error(`${selector} never went`)
        })
    const settle = (ms = 400) => page.waitForTimeout(ms)
    const until = async (test, what, timeout = stepTimeoutMs) => {
      const end = Date.now() + timeout
      while (!test()) {
        if (Date.now() > end) throw new Error(what)
        await page.waitForTimeout(100)
      }
    }
    const library = () => page.evaluate(readLibrary)
    const sheetOf = (selector) => page.evaluate(readSheet, selector)
    const sideways = async (name, scope) => {
      const read = await page.evaluate(readSideways, scope)
      if (read.over.length > 0) {
        failures.push(...read.over.map((line) => `${name}: ${line}`))
        return null
      }
      return `${name} ${read.elements}`
    }
    const said = (name, words) => {
      const found = words.match(NEVER)
      if (found !== null) failures.push(`${name} says "${found[0]}"`)
    }
    /** Waits for the song's queue row to read `line` (a pattern). */
    const rowSays = async (line, what, timeout = runTimeoutMs) => {
      await page
        .waitForFunction(
          ([song, pattern]) => {
            const rows = document.querySelectorAll(
              '[data-testid="karaoke-queue-row"]',
            )
            return [...rows].some((row) => {
              const [title, sub] = [
                ...row.querySelectorAll(':scope > span:nth-of-type(2) > span'),
              ].map((el) => (el.textContent ?? '').trim())
              return title === song && new RegExp(pattern, 'u').test(sub ?? '')
            })
          },
          [SONG, line],
          { timeout },
        )
        .catch(async () => {
          throw new Error(
            `${what}: the row never read /${line}/ (${JSON.stringify((await library())?.queue)})`,
          )
        })
      return (await library()).queue.find((row) => row.title === SONG)
    }
    const cued = async (want, what) => {
      await page
        .waitForFunction(cueReady, want, { timeout: runTimeoutMs })
        .catch(async () => {
          throw new Error(
            `${what}: no song ready to play (${JSON.stringify(await page.evaluate(readStage))})`,
          )
        })
      const now = await page.evaluate(readStage)
      if (now.error !== null) throw new Error(`${what}: "${now.error}"`)
      return now
    }
    const librarySheet = '[role="dialog"][aria-label="Songs"]'
    const openLibrary = async () => {
      await page.locator('[data-testid="karaoke-songline"]').tap()
      await visible('[data-testid="karaoke-library"]')
      await settle()
    }
    const closeLibrary = async () => {
      await page
        .locator('[data-testid="karaoke-library"] button[aria-label="Close"]')
        .first()
        .tap()
      await hidden('[data-testid="karaoke-library"]')
    }
    const read = []

    // ── Into the room ─────────────────────────────────────────
    at = 'the Karaoke door'
    await visible('[data-testid="rooms-alley"]')
    await settle(600)
    await tapDoor(page, 'karaoke')
    await waitPhase(page, 'alive', 'karaoke', 'select Karaoke')
    await walkOpen(page, ctx, 'import-open', '[data-testid="karaoke-room"]')
    await cued(null, 'arrival')

    // ── The library opens on Import ───────────────────────────
    at = 'the library, before an import'
    await openLibrary()
    const first = await library()
    const baseLine =
      'Songs from Files: MP3, M4A, WAV or FLAC, up to 12 minutes.'
    if (
      !first.importFirst ||
      first.button !== 'Import a song' ||
      first.line !== baseLine ||
      !first.empty ||
      first.queue.length !== 0 ||
      first.songs.some((song) => song.group !== 'Examples')
    ) {
      throw new Error(`the library: ${JSON.stringify(first)}`)
    }
    // Opening the room made no identity: the songs are not known yet.
    if (state.anonymous !== 0 || state.billing.withToken !== 0) {
      throw new Error(
        `the room made an identity before an import (${state.anonymous} anonymous, ${state.billing.withToken} signed-in /me)`,
      )
    }
    const accept =
      (await page
        .locator('[data-testid="karaoke-import-input"]')
        .getAttribute('accept')) ?? ''
    if (
      !['.mp3', '.m4a', '.wav', '.flac', 'audio/mpeg'].every((type) =>
        accept.split(',').includes(type),
      ) ||
      accept.includes('audio/*')
    ) {
      throw new Error(`the picker's accept: "${accept}"`)
    }
    await shoot(page, ctx, 'import-library')
    read.push(await sideways('the library with Import', librarySheet))
    steps.push(
      `karaoke import: the library opens on "${first.button}", "${first.line}", "Songs you import appear here." over ${first.songs.length} examples; no identity yet; the picker accepts ${accept.split(',').length} named types, not audio/*`,
    )

    // ── The picker, and the question asked once ──────────────
    at = 'Import a song'
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: stepTimeoutMs }),
      page
        .locator('[data-testid="karaoke-import"] button', {
          hasText: 'Import a song',
        })
        .tap(),
    ])
    if (!chooser.isMultiple()) {
      failures.push('Import: the picker takes one song at a time')
    }
    await chooser.setFiles({
      name: `${SONG}.m4a`,
      mimeType: 'audio/mp4',
      buffer: media.song,
    })
    at = 'the confirm sheet'
    const confirm = '[role="dialog"][aria-label="Separate this song?"]'
    await visible(confirm, runTimeoutMs)
    await settle()
    const asked = await sheetOf(confirm)
    const wantAsked = {
      title: 'Separate this song?',
      items: [SONG],
      lines: [
        'Uses 1 of your 20 songs this month. 17 left after this.',
        'Sends: this song to our server, which splits it into voice and music.',
        'Open Mercury Pitch within about a day to save it to this phone.',
        'Keep Mercury Pitch open while it is sent, about half a minute. The separating carries on if you leave.',
      ],
      buttons: ['Close', 'Separate', 'Cancel'],
    }
    for (const key of Object.keys(wantAsked)) {
      if (JSON.stringify(asked[key]) !== JSON.stringify(wantAsked[key])) {
        throw new Error(
          `the confirm sheet's ${key}: ${JSON.stringify(asked[key])}, not ${JSON.stringify(wantAsked[key])}`,
        )
      }
    }
    said('the confirm sheet', asked.all)
    if (state.anonymous !== 1 || state.billing.withToken < 1) {
      throw new Error(
        `the confirm: the phone's identity (${state.anonymous} anonymous, ${state.billing.withToken} signed-in /me)`,
      )
    }
    await shoot(page, ctx, 'import-confirm')
    read.push(await sideways('the confirm sheet', confirm))
    steps.push(
      `karaoke import: the picker opens inside the tap (several at once); "${asked.title}" names "${SONG}", "${asked.lines[0]}", the day to collect it in and the keep-open line; asking made the phone's identity (1 anonymous, then /me)`,
    )

    // ── The queue, each thing it waits for ────────────────────
    at = 'Separate'
    await page.locator(`${confirm} button`, { hasText: /^Separate$/u }).tap()
    await hidden(confirm)
    const sending = await rowSays('^Sending · \\d{1,3}%$', 'sending')
    await until(
      () => state.uploads.length === 1,
      'the upload never reached the separation host',
    )
    const [upload] = state.uploads
    if (!upload.signedIn || !upload.m4a || !upload.song) {
      throw new Error(`the upload: ${JSON.stringify(upload)}`)
    }
    const whileSending = await library()
    if (
      whileSending.keepOpen !== `Keep Mercury Pitch open until ${SONG} is sent.`
    ) {
      throw new Error(
        `while sending: the keep-open line is "${whileSending.keepOpen}"`,
      )
    }
    if (whileSending.empty) {
      throw new Error('while sending: the library still says it has no songs')
    }
    await shoot(page, ctx, 'import-sending')
    read.push(await sideways('the library, sending', librarySheet))

    at = 'a studio slot'
    state.upload.release()
    const queued = await rowSays(exactly('Waiting for a studio slot'), 'queued')
    if (queued.bar !== null || queued.buttons !== 0) {
      throw new Error(`queued: ${JSON.stringify(queued)}`)
    }
    const afterSend = await library()
    if (afterSend.keepOpen !== null) {
      throw new Error(
        `queued: the keep-open line stayed ("${afterSend.keepOpen}")`,
      )
    }
    await shoot(page, ctx, 'import-queued')

    at = 'separating'
    state.phase = 'separating'
    const separating = await rowSays(exactly('Separating · 62%'), 'separating')
    if (separating.bar !== '62') {
      throw new Error(`separating: the bar reads ${separating.bar}`)
    }
    await shoot(page, ctx, 'import-separating')
    read.push(await sideways('the library, separating', librarySheet))
    await closeLibrary()
    const badge = page.locator('[data-testid="karaoke-songline-badge"]')
    await visible('[data-testid="karaoke-songline-badge"]')
    const badgeText = (await badge.textContent())?.trim()
    if (badgeText !== 'Separating 1') {
      throw new Error(`the song line's badge reads "${badgeText}"`)
    }
    await shoot(page, ctx, 'import-badge')

    at = 'saving'
    state.phase = 'done'
    await openLibrary()
    await rowSays(exactly('Saving to this phone'), 'saving')
    await until(
      () => state.downloads.length === 2,
      `the stems were not both asked for (${state.downloads.join(', ')})`,
      runTimeoutMs,
    )
    await shoot(page, ctx, 'import-saving')
    state.stems.release()
    steps.push(
      `karaoke import: the row reads "${sending.line}" with "${whileSending.keepOpen}", then "${queued.line}", "${separating.line}" (bar ${separating.bar}, the song line "${badgeText}"), then "Saving to this phone"; the upload carried the identity and asked for M4A`,
    )

    // ── Yours, new, and it plays ──────────────────────────────
    at = 'the song arrives'
    await visible(`text=${SONG} is ready to sing.`, runTimeoutMs)
    await page
      .waitForFunction(
        (song) =>
          document.querySelectorAll('[data-testid="karaoke-queue-row"]')
            .length === 0 &&
          [
            ...document.querySelectorAll('[data-testid="karaoke-library-row"]'),
          ].some((row) => (row.textContent ?? '').trim().startsWith(song)),
        SONG,
        { timeout: runTimeoutMs },
      )
      .catch(async () => {
        throw new Error(
          `the song never arrived: ${JSON.stringify(await library())}`,
        )
      })
    await settle()
    const arrived = await library()
    const mine = arrived.songs.find((song) => song.title === SONG)
    const leftLine = `${baseLine} 17 of 20 songs left this month.`
    if (
      mine === undefined ||
      mine.group !== 'Your songs' ||
      !mine.fresh ||
      arrived.empty ||
      arrived.line !== leftLine ||
      arrived.songs.filter((song) => song.fresh).length !== 1
    ) {
      throw new Error(`the song arrived as ${JSON.stringify(arrived)}`)
    }
    await shoot(page, ctx, 'import-ready')
    read.push(await sideways('the library, a song arrived', librarySheet))

    at = 'the imported song plays'
    await page
      .locator(`[data-testid="karaoke-library-row"][data-session="${mine.id}"]`)
      .tap()
    await hidden('[data-testid="karaoke-library"]')
    const cue = await cued(SONG, 'the imported song')
    if (cue.button !== 'Play') {
      throw new Error(`the imported song: ${JSON.stringify(cue)}`)
    }
    const stage = '[data-testid="karaoke-mobile-stage"]'
    await page.locator(`${stage} button[aria-label="Play"]`).tap()
    await visible(`${stage} button[aria-label="Pause"]`)
    await page.waitForTimeout(2600)
    const playing = await page.evaluate(readStage)
    if (!(playing.elapsed >= cue.elapsed + 1)) {
      throw new Error(
        `the imported song: the time did not move (${cue.elapsed}s, then ${playing.elapsed}s)`,
      )
    }
    await page.locator(`${stage} button[aria-label="Pause"]`).tap()
    await visible(`${stage} button[aria-label="Play"]`)
    await shoot(page, ctx, 'import-playing')
    const badgeGone = (await badge.count()) === 0
    if (!badgeGone)
      failures.push('the song line still says a song is separating')
    steps.push(
      `karaoke import: "${SONG}" arrives under ${mine.group}, marked new, the only new one; the line reads "17 of 20 songs left this month."; it cues and plays (${cue.elapsed}s to ${playing.elapsed}s) from the stems saved on the phone`,
    )

    // ── The options and Settings count the songs ──────────────
    at = 'the options count the songs'
    await page.locator('[data-testid="shell-room-gear"]').tap()
    await visible('[data-testid="karaoke-options"]')
    const songsRow = page.locator(
      '[data-testid="karaoke-options"] button[aria-label="Songs this month: 17 of 20 left"]',
    )
    if ((await songsRow.count()) !== 1) {
      throw new Error(
        `the options: no "Songs this month: 17 of 20 left" (${JSON.stringify(await sheetOf('[role="dialog"][aria-label="Karaoke options"]'))})`,
      )
    }
    await songsRow.tap()
    at = 'Settings, Karaoke'
    await visible('[data-testid="karaoke-settings-screen"]')
    await settle(600)
    const settingsRows = await page.evaluate(readSettingsRows, [
      'karaoke-subscription',
      'karaoke-songs-left',
      'karaoke-manage',
      'karaoke-restore',
      'karaoke-imported-songs',
      'karaoke-remove-imported',
    ])
    const wantRows = {
      'karaoke-subscription':
        /^Subscribed, renews on 27 October \| 20 songs a month$/u,
      'karaoke-songs-left': /^Songs this month \| 17 of 20 left$/u,
      'karaoke-manage': null,
      'karaoke-restore': /^Restore purchases$/u,
      'karaoke-imported-songs':
        /^Imported songs \| 1 song · \d+(\.\d)? (KB|MB)$/u,
      'karaoke-remove-imported': /^Remove imported songs$/u,
    }
    for (const [id, want] of Object.entries(wantRows)) {
      const row = settingsRows[id]
      if (want === null ? row !== null : row === null || !want.test(row)) {
        throw new Error(`Settings, Karaoke: ${id} reads ${JSON.stringify(row)}`)
      }
    }
    await page.locator('[data-settings-row="karaoke-restore"]').tap()
    await visible('text=Purchases are not available yet.')
    const settingsScreen =
      '[data-testid="shell-pushed"]:has([data-testid="karaoke-settings-screen"])'
    said(
      'Settings, Karaoke',
      (await page.locator(settingsScreen).textContent()) ?? '',
    )
    await shoot(page, ctx, 'import-settings')
    read.push(await sideways('Settings, Karaoke', settingsScreen))
    for (let back = 0; back < 3; back += 1) {
      const pushed = page.locator('[data-testid="shell-pushed-back"]')
      if ((await pushed.count()) === 0) break
      await pushed.first().tap()
      await settle(500)
    }
    await visible('[data-testid="karaoke-room"]')
    steps.push(
      `karaoke import: the options say "Songs this month: 17 of 20 left" and open Settings, Karaoke: "${settingsRows['karaoke-subscription']}", "${settingsRows['karaoke-imported-songs']}", no Manage without a store; Restore purchases says "Purchases are not available yet."`,
    )

    // ── Removed from this phone ──────────────────────────────
    at = 'remove the song'
    await openLibrary()
    await page.getByRole('button', { name: `More for ${SONG}` }).tap()
    const menu = page.getByRole('menu', { name: SONG })
    await menu.waitFor({ state: 'visible', timeout: stepTimeoutMs })
    const items = await menu.getByRole('menuitem').allTextContents()
    if (JSON.stringify(items) !== JSON.stringify(['Remove from this phone'])) {
      throw new Error(`the song's menu: ${JSON.stringify(items)}`)
    }
    await menu.getByRole('menuitem').first().tap()
    await page
      .waitForFunction(
        (song) =>
          ![
            ...document.querySelectorAll('[data-testid="karaoke-library-row"]'),
          ].some((row) => (row.textContent ?? '').trim().startsWith(song)),
        SONG,
        { timeout: stepTimeoutMs },
      )
      .catch(() => {
        throw new Error(`${SONG} stayed after Remove from this phone`)
      })
    const removed = await library()
    if (!removed.empty) {
      throw new Error(`after removing: ${JSON.stringify(removed)}`)
    }
    await closeLibrary()
    steps.push(
      `karaoke import: the song's one menu item, "Remove from this phone", removes it; "Songs you import appear here." is back`,
    )

    // ── No songs, no subscription: the paywall ────────────────
    at = 'the paywall'
    state.songs = LAPSED
    await openLibrary()
    const paywallLine =
      'Any song from Files. Our server separates the voice from the music, and the song then lives on this phone. Part of the subscription.'
    await page
      .waitForFunction(
        (line) =>
          document
            .querySelector('[data-testid="karaoke-import"] p')
            ?.textContent?.trim() === line,
        paywallLine,
        { timeout: stepTimeoutMs },
      )
      .catch(async () => {
        throw new Error(`the import line: "${(await library()).line}"`)
      })
    let picker = false
    const noPicker = () => {
      picker = true
    }
    page.on('filechooser', noPicker)
    await page
      .locator('[data-testid="karaoke-import"] button', {
        hasText: 'Import a song',
      })
      .tap()
    const paywall = '[role="dialog"][aria-label="Sing your own songs"]'
    await visible(paywall)
    await settle()
    page.off('filechooser', noPicker)
    if (picker) failures.push('the paywall: the picker opened too')
    const offer = await sheetOf(paywall)
    const wantOffer = {
      title: 'Sing your own songs',
      items: [
        'Any song from Files on this phone',
        'Voice and music separated on our server',
        'Your songs stay on this phone and play offline',
      ],
      lines: [
        '20 songs a month · €4.99',
        'Renews every month until you cancel. Cancel any time in Settings.',
      ],
      buttons: ['Later', 'Subscribe', 'Restore purchases'],
      links: ['Terms of Use', 'Privacy Policy'],
    }
    for (const key of Object.keys(wantOffer)) {
      if (JSON.stringify(offer[key]) !== JSON.stringify(wantOffer[key])) {
        throw new Error(
          `the paywall's ${key}: ${JSON.stringify(offer[key])}, not ${JSON.stringify(wantOffer[key])}`,
        )
      }
    }
    said('the paywall', offer.all)
    await page.locator(`${paywall} button`, { hasText: /^Subscribe$/u }).tap()
    await visible(`${paywall} >> text=Subscriptions are not available yet.`)
    await shoot(page, ctx, 'import-paywall')
    read.push(await sideways('the paywall', paywall))
    await page
      .locator(`${paywall} button`, { hasText: /^Restore purchases$/u })
      .tap()
    await visible(`${paywall} >> text=Purchases are not available yet.`)
    await page.locator(`${paywall} button[aria-label="Later"]`).tap()
    await hidden(paywall)
    steps.push(
      `karaoke import: with no songs and no subscription Import is the paywall, no picker: "${offer.lines[0]}", Terms and Privacy; Subscribe says "Subscriptions are not available yet.", Restore "Purchases are not available yet."`,
    )

    const measured = read.filter((line) => line !== null)
    if (measured.length === read.length) {
      steps.push(
        `karaoke import sideways: nothing wider than its box (elements read: ${measured.join(', ')})`,
      )
    }
    steps.push(
      `karaoke import network: the stand-in answered ${state.anonymous} anonymous identity, ${state.billing.withToken} signed-in /me (${state.billing.without} refused without one), ${state.uploads.length} upload, ${state.downloads.length} stems; refused ${state.refused.size === 0 ? 'nothing else' : [...state.refused].sort().join(', ')}`,
    )
  } catch (error) {
    failures.push(`${at}: ${error.message.split('\n')[0]}`)
  } finally {
    server?.releaseAll()
    await context.close()
  }
  const where = `${frame.width}x${frame.height}`
  if (failures.length > 0) {
    throw new Error(failures.map((f) => `[${where}] ${f}`).join('; '))
  }
  return steps.map((step) => `[${where}] ${step}`)
}
