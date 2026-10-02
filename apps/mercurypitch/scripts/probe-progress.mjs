// ============================================================
// Progress, with a record on it, walked against the built bundle
// ============================================================
//
// TestFlight build 451 (owner, 2 Oct 2026): "most images are not visible,
// like badges etc. in the progress page". Nothing failed loudly. Progress asks
// for its pictures by absolute URL into the web app's public/ tree — the
// medallions by icon (`/badges/<icon>.webp`, src/features/challenges/
// badge-art.ts), the league trophy by the rung's `trophyAsset`
// (`/leagues/l3.webp`, straight from the worker's `leagues` row), the Atlas
// plate in CSS and the share card's plate in a canvas — and the native bundle
// carries only what apps/mercurypitch/native-assets.mjs names. Every earlier
// walk opened Progress empty, signed out and offline, where none of those
// pictures is asked for, so none of them could be missed.
//
// So this walk opens it the way the owner sees it: an account on the phone,
// the worker answering with that account's record (every badge and
// achievement the seed defines, a few of each earned, a league standing, a
// voiceprint with a twin, a handful of scored runs), the page scrolled to its
// end and the share studio opened. Then two checks, both of which must come
// back empty:
//   - every picture request the page made that failed, answered with an
//     error status, or came back as something other than an image;
//   - every picture the page names (each `<img src>`, each CSS
//     `background-image`), fetched again from the bundle, because a lazy
//     image the scroll never brought near the viewport made no request at
//     all and would otherwise pass by saying nothing.
//
// The record is invented, all of it. The definitions are the real seed's
// (src/db/seed-data.json), because their icons are what decide which files
// are asked for. `probe-progress-0001` is nobody, the token is not signed and
// could not be, and nothing but this walk's own route ever answers for it.
//
// THE LEADERBOARD, TOO (owner, same round): the league card's "Open
// Leaderboard" leads there, and it drew no ladder trophies and no podium.
// Its pictures are named the same way, the ladder's straight from the
// worker's leagues rows, so the second walk follows that link and checks
// each of the four views (League, Global, Legends, Friends) the same way.
//
// Wired into probe-bundle.mjs, which owns the browser and passes its helpers
// in. `--progress-only` walks these two alone.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED = JSON.parse(
  readFileSync(resolve(HERE, '../../../src/db/seed-data.json'), 'utf8'),
)

const SINGER = { id: 'probe-progress-0001', provider: 'password' }

/** The worker, which this walk answers in place of. */
const WORKER = /^https:\/\/api(?:-dev)?\.mercurypitch\.com\/api\//u

/** Anything a picture can be asked for as. */
const PICTURE = /\.(?:webp|png|jpe?g|avif|gif|svg)(?:\?|$)/iu

function seedAccount(singer) {
  const part = (value) =>
    btoa(JSON.stringify(value))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/u, '')
  const issued = Math.floor(Date.now() / 1000) - 86_400
  try {
    localStorage.setItem(
      'mp:authToken',
      [
        part({ alg: 'none', typ: 'JWT' }),
        part({
          sub: singer.id,
          provider: singer.provider,
          iat: issued,
          exp: issued + 30 * 86_400,
        }),
        'probe',
      ].join('.'),
    )
    localStorage.setItem('mp:userId', singer.id)
    localStorage.setItem('pitchperfect_native_welcome_seen', 'true')
  } catch {
    /* storage blocked: Progress opens signed out, and the walk says so */
  }
}

/** An ISO time `days` before now, at a fixed hour so runs sort predictably. */
function daysAgo(days, hour = 18) {
  const at = new Date()
  at.setUTCDate(at.getUTCDate() - days)
  at.setUTCHours(hour, 0, 0, 0)
  return at.toISOString()
}

/** The account's record, as the worker would hand it back. */
function record() {
  const stamp = daysAgo(60)
  const row = (id) => ({ id, createdAt: stamp, updatedAt: stamp })
  const badges = SEED.badgeDefinitions.map((badge, index) => ({
    ...row(`probe-badge-${index + 1}`),
    ...badge,
  }))
  const achievements = SEED.achievementDefinitions.map((achievement, i) => ({
    ...row(`probe-achievement-${i + 1}`),
    ...achievement,
  }))
  const userBadges = badges.slice(0, 6).map((badge, index) => ({
    ...row(`probe-user-badge-${index + 1}`),
    userId: SINGER.id,
    badgeId: badge.id,
    earnedAt: daysAgo(30 - index * 4),
  }))
  const userAchievements = achievements.slice(0, 14).map((achievement, i) => ({
    ...row(`probe-user-achievement-${i + 1}`),
    userId: SINGER.id,
    achievementId: achievement.id,
    progress: i < 8 ? 100 : 40,
    unlocked: i < 8,
    unlockedAt: i < 8 ? daysAgo(40 - i * 4) : null,
  }))
  const sessionRecords = Array.from({ length: 12 }, (_, index) => {
    const endedAt = daysAgo(index * 5, 19)
    const score = 58 + ((index * 7) % 35)
    return {
      ...row(`probe-session-${index + 1}`),
      userId: SINGER.id,
      melodyName: 'C major scale',
      startedAt: daysAgo(index * 5, 18),
      endedAt,
      score,
      accuracy: score,
      notesHit: 8 + (index % 5),
      notesTotal: 14,
      streak: 3,
      source: 'practice',
      instrument: 'voice',
      durationMs: 95_000,
      results: [],
    }
  })
  const voiceprints = [
    {
      ...row('probe-voiceprint-1'),
      userId: SINGER.id,
      summary: {
        lowMidi: 45,
        highMidi: 69,
        semitones: 24,
        accuracy: 0.74,
        steadiness: 0.68,
      },
      twin: 'Adele',
      source: 'mirror',
      takenAt: daysAgo(9),
      madeBy: SINGER.id,
    },
  ]
  return {
    grantContext: {
      badgeDefinitions: badges,
      userBadges,
      achievements,
      userAchievements,
      sessionRecords,
      challengeDefinitions: [],
      challengeProgress: [],
      userActivity: [],
      profile: null,
      voiceprintCount: voiceprints.length,
      followingCount: 0,
      sharesPosted: 0,
    },
    league: {
      eligible: true,
      weekStart: daysAgo(3, 0).slice(0, 10),
      league: {
        id: 'l3',
        rank: 3,
        name: 'Skyvox',
        trophyAsset: '/leagues/l3.webp',
        badgeAsset: '/leagues/l3-badge.webp',
        isMystery: false,
        promoteCount: 10,
        relegateCount: 10,
      },
      points: 140,
      rank: 4,
      cohortSize: 20,
      standings: STANDINGS.map((name, index) => ({
        userId: index === 3 ? SINGER.id : `probe-rival-${index + 1}`,
        displayName: name,
        points: 220 - index * 20,
        rank: index + 1,
      })),
    },
    // The seven rungs as 0005_leagues.sql seeds them: the Leaderboard's
    // ladder draws every one, veiling the rungs above the singer's.
    ladder: LADDER.map(([rank, name], index) => ({
      id: `l${rank}`,
      rank,
      name,
      trophyAsset: `/leagues/l${rank}.webp`,
      badgeAsset: rank === 7 ? null : `/leagues/l${rank}-badge.webp`,
      isMystery: rank === 7,
      promoteCount: index === 0 ? 15 : rank >= 6 ? 0 : 10,
      relegateCount: rank === 1 || rank === 7 ? 0 : 10,
    })),
    board: {
      total: STANDINGS.length,
      entries: STANDINGS.map((name, index) => ({
        userId: index === 3 ? SINGER.id : `probe-rival-${index + 1}`,
        displayName: name,
        avatarUrl: null,
        score: 9_000 - index * 700,
        rank: index + 1,
        streak: 6 - index,
        longestStreak: 12 - index,
        totalSessions: 80 - index * 9,
        bestScore: 96 - index * 3,
        accuracy: 88 - index * 4,
      })),
    },
    archive: [
      {
        id: 'probe-weekly-1',
        slug: 'probe-weekly-1',
        title: 'The long note',
        description: 'Hold it, then land it.',
        featType: 'sustain',
        voiceTypeSplit: null,
        difficulty: 'intermediate',
        targetItems: [],
        targetScore: 70,
        hearItUrl: null,
        startsAt: daysAgo(14, 0),
        endsAt: daysAgo(7, 0),
        rewardBadgeId: null,
        founderScore: null,
        founderTrace: null,
        status: 'closed',
        results: {
          version: 1,
          top3: STANDINGS.slice(0, 3).map((name, index) => ({
            rank: index + 1,
            displayName: name,
            best: 94 - index * 4,
          })),
          attemptedCount: 41,
          completedCount: 23,
          closedAt: daysAgo(7, 0),
        },
      },
    ],
    tables: { sessionRecords, voiceprints, userActivity: [], follows: [] },
  }
}

/** Invented rivals; the fourth row is the probe's own singer. */
const STANDINGS = [
  'Probe Rival One',
  'Probe Rival Two',
  'Probe Rival Three',
  'Probe Singer',
  'Probe Rival Five',
]

/** The ladder's rungs and names, as the leagues migration seeds them. */
const LADDER = [
  [1, 'Mercling'],
  [2, 'Sparkwing'],
  [3, 'Skyvox'],
  [4, 'Highnova'],
  [5, 'Starcrest'],
  [6, 'Mercapex'],
  [7, '???'],
]

function answer(route, status, body) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    },
    body: body === null ? '' : JSON.stringify(body),
  })
}

/**
 * The reads Progress and the Leaderboard make, answered with the record above. Every other
 * request to the worker (writes included: the grant flush, a settings push)
 * falls through to the kit's isolation and is refused, the way a phone with
 * no signal would see it.
 */
async function standIn(context) {
  const data = record()
  await context.route(WORKER, async (route, request) => {
    const path = new URL(request.url()).pathname
    const method = request.method()
    if (method === 'OPTIONS') return answer(route, 204, null)
    if (method !== 'GET') return route.fallback()
    if (path === '/api/auth/me') {
      return answer(route, 200, {
        user: { id: SINGER.id, authProvider: SINGER.provider },
        profile: { displayName: 'Probe Singer' },
      })
    }
    if (path === '/api/me/grant-context') {
      return answer(route, 200, data.grantContext)
    }
    if (path === '/api/league/me') return answer(route, 200, data.league)
    if (path === '/api/leagues') return answer(route, 200, data.ladder)
    if (path === '/api/leaderboard') return answer(route, 200, data.board)
    if (path === '/api/weekly/active') {
      return answer(route, 200, { challenge: null })
    }
    if (path === '/api/weekly/archive') {
      return answer(route, 200, { archive: data.archive })
    }
    const table = /^\/api\/(\w+)(\/count)?$/u.exec(path)
    if (table !== null && table[1] in data.tables) {
      const rows = data.tables[table[1]]
      return answer(route, 200, table[2] ? { count: rows.length } : rows)
    }
    return route.fallback()
  })
}

/** In the page: every scroller, walked to its end on both axes. */
const scrollEverything = async () => {
  const pause = () => new Promise((done) => setTimeout(done, 120))
  const scrollers = [
    document.scrollingElement,
    ...document.querySelectorAll('*'),
  ].filter((el) => {
    if (el === null) return false
    const style = getComputedStyle(el)
    const y =
      el.scrollHeight > el.clientHeight + 1 &&
      /(auto|scroll)/u.test(style.overflowY)
    const x =
      el.scrollWidth > el.clientWidth + 1 &&
      /(auto|scroll)/u.test(style.overflowX)
    return el === document.scrollingElement || x || y
  })
  for (const el of scrollers) {
    for (
      let top = 0;
      top <= el.scrollHeight;
      top += el.clientHeight / 2 || 200
    ) {
      el.scrollTop = top
      await pause()
    }
    for (
      let left = 0;
      left <= el.scrollWidth;
      left += el.clientWidth / 2 || 200
    ) {
      el.scrollLeft = left
      await pause()
    }
  }
  return scrollers.length
}

/**
 * In the page: every picture Progress names, and what the bundle answers for
 * each. A lazy `<img>` that was never scrolled near made no request, so the
 * walk asks for it itself rather than trusting silence.
 */
const readPictures = async (scope) => {
  const root = document.querySelector(scope) ?? document.body
  const named = new Set()
  for (const img of root.querySelectorAll('img')) {
    if (img.currentSrc || img.src) named.add(img.currentSrc || img.src)
  }
  for (const el of [root, ...root.querySelectorAll('*')]) {
    const bg = getComputedStyle(el).backgroundImage
    for (const match of bg.matchAll(/url\("?([^")]+)"?\)/gu)) {
      if (!match[1].startsWith('data:')) named.add(match[1])
    }
  }
  const broken = [...root.querySelectorAll('img')]
    .filter((img) => img.complete && img.naturalWidth === 0)
    .map((img) => img.currentSrc || img.src)
  const answers = []
  for (const url of named) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      const type = res.headers.get('content-type') ?? ''
      answers.push({
        url,
        status: res.status,
        type,
        ok: res.ok && type.startsWith('image/'),
      })
    } catch (error) {
      answers.push({
        url,
        status: 0,
        type: '',
        ok: false,
        error: String(error),
      })
    }
  }
  return { answers, broken }
}

/**
 * A phone signed in to the invented account, booted to the alley, with every
 * picture request that fails (or answers with something other than an
 * image) collected into `requests`.
 */
async function openWithRecord(browser, args, frame, kit, problems, requests) {
  const { isolate, seed, bootTimeoutMs, stepTimeoutMs } = kit
  const context = await isolate(
    await browser.newContext({
      viewport: { width: frame.width, height: frame.height },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
      permissions: ['microphone'],
    }),
  )
  await standIn(context)
  const page = await context.newPage()
  page.on('pageerror', (error) => {
    problems.push(`page error: ${error.message}`)
  })
  const isPicture = (request) =>
    request.resourceType() === 'image' || PICTURE.test(request.url())
  page.on('requestfailed', (request) => {
    if (!isPicture(request)) return
    requests.push({
      url: request.url(),
      why: request.failure()?.errorText ?? 'failed',
    })
  })
  page.on('response', (response) => {
    const request = response.request()
    if (!isPicture(request)) return
    const type = response.headers()['content-type'] ?? ''
    if (response.status() >= 400 || !type.startsWith('image/')) {
      requests.push({
        url: request.url(),
        why: `${response.status()} ${type || 'no content-type'}`,
      })
    }
  })
  await page.addInitScript(seed, args.theme)
  await page.addInitScript(seedAccount, SINGER)
  await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
  await page
    .locator('#root.loaded')
    .waitFor({ state: 'attached', timeout: bootTimeoutMs })
  await page
    .locator('[data-testid="rooms-alley"]')
    .waitFor({ state: 'visible', timeout: stepTimeoutMs })
  return { context, page }
}

/** Progress, opened from the rail and loaded with the record. */
const PROGRESS = 'section[data-progress-state]'

async function openProgress(page, kit) {
  await page.locator('[data-rail-item="progress"]').click()
  await page.locator(PROGRESS).first().waitFor({
    state: 'visible',
    timeout: kit.stepTimeoutMs,
  })
  await page
    .locator('[data-testid^="cabinet-badge-"]')
    .first()
    .waitFor({ state: 'attached', timeout: kit.stepTimeoutMs })
  await page.waitForTimeout(800)
}

/**
 * Every picture under `scope`, asked of the bundle. Pushes a problem for each
 * one that is not served as an image or is drawn broken, and returns the
 * line that describes what was checked.
 */
async function checkPictures(page, scope, label, args, problems) {
  const scrollers = await page.evaluate(scrollEverything)
  await page.waitForTimeout(800)
  const pictures = await page.evaluate(readPictures, scope)
  const missing = pictures.answers.filter((answer) => !answer.ok)
  for (const answer of missing) {
    problems.push(
      `${label}: not in the bundle: ${new URL(answer.url).pathname} (${answer.status} ${answer.type || answer.error || ''})`.trim(),
    )
  }
  for (const url of pictures.broken) {
    problems.push(
      `${label}: drawn broken: ${new URL(url, args.baseUrl).pathname}`,
    )
  }
  const folders = new Map()
  for (const answer of pictures.answers) {
    const folder = new URL(answer.url).pathname.replace(/\/[^/]*$/u, '/')
    folders.set(folder, (folders.get(folder) ?? 0) + 1)
  }
  const where = [...folders].map(([folder, n]) => `${folder} ${n}`).join(', ')
  return `${label}: ${pictures.answers.length} pictures named after ${scrollers} scrollers walked (${where || 'none'}), ${pictures.answers.length - missing.length} served as images`
}

/** One problem per failed picture request, or a step saying there were none. */
function settleRequests(requests, label, steps, problems) {
  const failed = new Map()
  for (const request of requests) {
    failed.set(new URL(request.url).pathname, request.why)
  }
  for (const [path, why] of failed) {
    problems.push(`${label}: picture request failed: ${path} (${why})`)
  }
  if (failed.size === 0) steps.push(`${label}: no picture request failed`)
}

function finish(where, name, steps, problems) {
  if (problems.length > 0) {
    throw new Error(
      `[${where}] ${name}: ${problems.length} problem(s)\n  ${[...new Set(problems)].join('\n  ')}`,
    )
  }
  return steps.map((line) => `[${where}] ${line}`)
}

/**
 * Progress with a record on it, scrolled through and shared from. Throws
 * with every picture that did not arrive; returns the lines that passed.
 */
export async function walkProgress(browser, args, frame, kit) {
  const where = `${frame.width}x${frame.height}`
  const ctx = { frame, theme: args.theme, shots: args.shots }
  const steps = []
  const problems = []
  const requests = []

  const { context, page } = await openWithRecord(
    browser,
    args,
    frame,
    kit,
    problems,
    requests,
  )
  try {
    await openProgress(page, kit)
    await kit.shoot(page, ctx, 'progress-top')

    const counts = await page.evaluate((scope) => {
      const root = document.querySelector(scope)
      return {
        badges: root.querySelectorAll('[data-testid^="cabinet-badge-"]').length,
        images: root.querySelectorAll('img').length,
      }
    }, PROGRESS)
    steps.push(
      `progress: opened with a record, ${counts.badges} cabinet badges and ${counts.images} pictures drawn`,
    )

    const checked = await checkPictures(
      page,
      PROGRESS,
      'progress',
      args,
      problems,
    )

    for (const [name, selector] of [
      ['progress-milestones', '[aria-label^="Earned milestones"]'],
      ['progress-cabinet', '[data-testid^="cabinet-badge-"]'],
    ]) {
      const target = page.locator(selector).first()
      if ((await target.count()) === 0) {
        problems.push(`${name}: nothing matched ${selector}`)
        continue
      }
      await target.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      await kit.shoot(page, ctx, name)
    }
    steps.push(checked)

    // The share studio draws the Pressing plate into a canvas with `new
    // Image()`, outside the page tree the check above reads.
    const share = page.getByRole('button', { name: 'Share this moment' })
    if ((await share.count()) === 0) {
      problems.push('share: no "Share this moment" button on the page')
    } else {
      await share.first().scrollIntoViewIfNeeded()
      await share.first().click()
      await page
        .locator('[data-testid="progress-share-studio"]')
        .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
      await page.waitForTimeout(1200)
      await kit.shoot(page, ctx, 'progress-share')
      steps.push('progress: the share studio opened')
    }

    settleRequests(requests, 'progress', steps, problems)
  } finally {
    await context.close()
  }
  return finish(where, 'progress', steps, problems)
}

/** The Leaderboard's own root. */
const LEADERBOARD = '.community-leaderboard'

/**
 * The Leaderboard, reached the way the owner reached it: Progress's league
 * card, "Open Leaderboard". Then each of its four views in turn, every
 * picture each one names asked of the bundle: the ladder's trophies (the
 * rungs above the singer's veiled, the mystery rung its own), the podium's
 * three places, and the past weeks' place medals.
 */
export async function walkLeaderboard(browser, args, frame, kit) {
  const where = `${frame.width}x${frame.height}`
  const ctx = { frame, theme: args.theme, shots: args.shots }
  const steps = []
  const problems = []
  const requests = []

  const { context, page } = await openWithRecord(
    browser,
    args,
    frame,
    kit,
    problems,
    requests,
  )
  try {
    await openProgress(page, kit)
    const open = page
      .locator(PROGRESS)
      .getByRole('link', { name: 'Open Leaderboard' })
    await open.scrollIntoViewIfNeeded()
    await open.click()
    await page
      .locator(LEADERBOARD)
      .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    const hash = await page.evaluate(() => window.location.hash)
    steps.push(`leaderboard: opened from the league card, on ${hash}`)

    for (const [view, tab, ready] of [
      ['league', null, '.league-strip-trophy'],
      ['global', '[data-testid="global-tab"]', '.podium-art'],
      ['legends', '[data-testid="legends-tab"]', null],
      ['friends', '.leaderboard-tab:has(.tab-name:text-is("Friends"))', null],
    ]) {
      if (tab !== null) await page.locator(tab).click()
      if (ready !== null) {
        await page
          .locator(ready)
          .first()
          .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
      }
      await page.waitForTimeout(1000)
      await kit.shoot(page, ctx, `leaderboard-${view}`)
      steps.push(
        await checkPictures(
          page,
          LEADERBOARD,
          `leaderboard ${view}`,
          args,
          problems,
        ),
      )
      await page.evaluate(() => {
        for (const el of [
          document.scrollingElement,
          ...document.querySelectorAll('*'),
        ]) {
          if (el !== null) el.scrollTop = 0
        }
      })
    }

    settleRequests(requests, 'leaderboard', steps, problems)
  } finally {
    await context.close()
  }
  return finish(where, 'leaderboard', steps, problems)
}
