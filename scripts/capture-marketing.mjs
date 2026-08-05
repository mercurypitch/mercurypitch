// ============================================================
// Marketing capture — deterministic local product screenshots
// ============================================================
//
// Product state belongs here, beside the product. The Agentic Marketing Studio
// consumes the resulting manifest and never needs to know how MercuryPitch is
// staged. Captures are intentionally localhost-only and use synthetic/demo
// state so marketing work cannot accidentally read production or personal data.
// Recipes: karaoke-zen, jam-karaoke, voice-mirror.
// Usage: pnpm marketing:capture -- --recipe <recipe> [options]

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { chromium } from '@playwright/test'

const cliArgs =
  process.argv[2] === '--' ? process.argv.slice(3) : process.argv.slice(2)

const { values } = parseArgs({
  args: cliArgs,
  options: {
    'base-url': { type: 'string', default: 'http://127.0.0.1:3000' },
    background: { type: 'string' },
    chromium: { type: 'string' },
    out: { type: 'string', default: './output/marketing-captures' },
    profile: { type: 'string', default: 'freddie' },
    recipe: { type: 'string', default: 'karaoke-zen' },
    viewport: { type: 'string', default: '1280x860' },
  },
  strict: true,
})

const baseUrl = new URL(values['base-url'])
const loopbackHosts = new Set(['127.0.0.1', 'localhost'])
if (!loopbackHosts.has(baseUrl.hostname)) {
  throw new Error(
    `Marketing capture is localhost-only; received ${baseUrl.hostname}`,
  )
}
if (baseUrl.username !== '' || baseUrl.password !== '') {
  throw new Error('Marketing capture base URLs must not contain credentials')
}
if (!['http:', 'https:'].includes(baseUrl.protocol)) {
  throw new Error('Marketing capture base URLs must use HTTP or HTTPS')
}

function isLoopbackNetworkUrl(rawUrl, protocols) {
  try {
    const target = new URL(rawUrl)
    return (
      protocols.includes(target.protocol) && loopbackHosts.has(target.hostname)
    )
  } catch {
    return false
  }
}

function networkOrigin(rawUrl) {
  try {
    const target = new URL(rawUrl)
    return `${target.protocol}//${target.host}`
  } catch {
    return 'invalid-url'
  }
}

const viewportMatch = /^(\d+)x(\d+)$/.exec(values.viewport)
if (viewportMatch === null) {
  throw new Error('Viewport must use WIDTHxHEIGHT, for example 1280x860')
}
const viewport = {
  width: Number(viewportMatch[1]),
  height: Number(viewportMatch[2]),
}
if (
  !Number.isInteger(viewport.width) ||
  !Number.isInteger(viewport.height) ||
  viewport.width < 320 ||
  viewport.height < 480 ||
  viewport.width > 4096 ||
  viewport.height > 4096
) {
  throw new Error('Viewport must be between 320x480 and 4096x4096')
}

const recipe = values.recipe
if (!['jam-karaoke', 'karaoke-zen', 'voice-mirror'].includes(recipe)) {
  throw new Error(`Unknown recipe: ${recipe}`)
}
const mirrorProfiles = new Set(['freddie'])
const profile = values.profile
if (recipe === 'voice-mirror' && !mirrorProfiles.has(profile)) {
  throw new Error(`Unknown Voice Mirror profile: ${profile}`)
}
if (recipe === 'voice-mirror' && values.background !== undefined) {
  throw new Error('Voice Mirror capture does not accept a background override')
}

// A deterministic capture-only target melody. Jam shows these as denoised
// guide notes, never as somebody's live performance. The preview room remains
// labelled in-product, and the manifest records the synthetic state.
const syntheticPitchGuides = (() => {
  const pattern = [57, 59, 60, 62, 64, 62, 60, 59, 57, 55, 57, 60, 62, 64]
  const names = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ]
  return Array.from({ length: 160 }, (_, index) => {
    const midi = pattern[index % pattern.length]
    const startSec = 16.4 + index * 0.68
    return {
      midi,
      noteName: `${names[midi % 12]}${Math.floor(midi / 12) - 1}`,
      startSec,
      endSec: startSec + (index % 4 === 3 ? 0.58 : 0.46),
    }
  })
})()

// Capture-only lyrics. They are deliberately original rather than a bundled
// copy of the demo song's lyric sheet; the screenshot needs stable timing and
// assignment rows, not a network dependency or a claim about the recording.
const captureDemoLrc = `[00:00.00]The room wakes up in violet light
[00:08.00]A quiet count rolls through the air
[00:16.00]Ada takes the opening line
[00:24.00]Her melody rises through the room
[00:32.00]Bo answers from the other side
[00:40.00]The harmony settles into place
[00:48.00]Now the chorus turns toward you
[00:56.00]Every voice can find its lane
[01:04.00]Sing the moment into color
[01:12.00]Let the final note ring clear
[01:20.00]We leave the stage a little brighter
[01:28.00]And carry the music home
`

function createSilentPcmWav(durationSec = 100, sampleRate = 8000) {
  const dataLength = Math.round(durationSec * sampleRate)
  const wav = Buffer.alloc(44 + dataLength, 128)
  wav.write('RIFF', 0, 'ascii')
  wav.writeUInt32LE(36 + dataLength, 4)
  wav.write('WAVE', 8, 'ascii')
  wav.write('fmt ', 12, 'ascii')
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate, 28)
  wav.writeUInt16LE(1, 32)
  wav.writeUInt16LE(8, 34)
  wav.write('data', 36, 'ascii')
  wav.writeUInt32LE(dataLength, 40)
  return wav
}

const outDir = resolve(values.out)
const backgroundPath = values.background ? resolve(values.background) : null
const backgroundBytes = backgroundPath ? await readFile(backgroundPath) : null
const backgroundHash = backgroundBytes
  ? createHash('sha256').update(backgroundBytes).digest('hex')
  : null

await mkdir(outDir, { recursive: true })

const launchOptions = {
  args: [
    '--autoplay-policy=no-user-gesture-required',
    ...(recipe === 'jam-karaoke'
      ? [
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream',
          '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        ]
      : []),
  ],
  ...(values.chromium ? { executablePath: resolve(values.chromium) } : {}),
}
const browser = await chromium.launch(launchOptions)
const context = await browser.newContext({
  viewport,
  colorScheme: 'dark',
  deviceScaleFactor: 1,
  ignoreHTTPSErrors: true,
  reducedMotion: 'no-preference',
  serviceWorkers: 'block',
  ...(recipe === 'jam-karaoke' ? { permissions: ['microphone'] } : {}),
})

const blockedEgressOrigins = new Set()
await context.route('**/*', async (route) => {
  const requestUrl = route.request().url()
  if (isLoopbackNetworkUrl(requestUrl, ['http:', 'https:'])) {
    await route.continue()
    return
  }
  blockedEgressOrigins.add(networkOrigin(requestUrl))
  await route.abort('blockedbyclient')
})
await context.routeWebSocket('**/*', async (webSocket) => {
  const socketUrl = webSocket.url()
  if (isLoopbackNetworkUrl(socketUrl, ['ws:', 'wss:'])) {
    webSocket.connectToServer()
    return
  }
  blockedEgressOrigins.add(networkOrigin(socketUrl))
  await webSocket.close({
    code: 1008,
    reason: 'Marketing capture is loopback-only',
  })
})
await context.addInitScript(
  (init) => {
    window.E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_welcome_version', 'marketing-capture')
    localStorage.setItem('pitchperfect_kn_stage_alpha', '0.68')
    localStorage.setItem('pitchperfect_jam_alpha', '0.42')
    localStorage.setItem('pitchperfect_sidebar_collapsed', 'true')
    for (const tab of [
      'exercises',
      'singing',
      'piano',
      'guitar',
      'karaoke',
      'community',
      'leaderboard',
      'challenges',
      'jam',
      'compose',
      'analysis',
      'settings',
    ]) {
      localStorage.setItem(`pitchperfect_page_tour_offered_${tab}`, 'true')
    }

    const networkAudit = {
      rtcPeerConnectionAttempts: 0,
      getUserMediaCalls: [],
      disallowedMediaRequests: 0,
    }
    Object.defineProperty(window, '__mercuryMarketingNetworkAudit', {
      configurable: false,
      value: networkAudit,
    })

    if (!init.jamRecipe) return

    // Playwright's request routing does not see ICE/STUN/TURN. A preview room
    // must never need them, so turn any RTCPeerConnection construction into a
    // hard capture failure that is asserted below.
    const blockedPeerConnection = function () {
      networkAudit.rtcPeerConnectionAttempts += 1
      throw new DOMException(
        'Peer connections are disabled in marketing preview rooms',
        'NotAllowedError',
      )
    }
    Object.defineProperty(window, 'RTCPeerConnection', {
      configurable: true,
      value: blockedPeerConnection,
    })
    if ('webkitRTCPeerConnection' in window) {
      Object.defineProperty(window, 'webkitRTCPeerConnection', {
        configurable: true,
        value: blockedPeerConnection,
      })
    }

    const mediaDevices = navigator.mediaDevices
    if (mediaDevices?.getUserMedia === undefined) return
    const nativeGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices)
    Object.defineProperty(mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async (constraints) => {
        const audio =
          constraints?.audio !== undefined && constraints.audio !== false
        const video =
          constraints?.video !== undefined && constraints.video !== false
        networkAudit.getUserMediaCalls.push({ audio, video })
        if (!audio || video) {
          networkAudit.disallowedMediaRequests += 1
          throw new DOMException(
            'Marketing previews allow the fake microphone only',
            'NotAllowedError',
          )
        }
        return nativeGetUserMedia({ audio: constraints.audio, video: false })
      },
    })
  },
  { jamRecipe: recipe === 'jam-karaoke' },
)

const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(String(error)))

function assertCurrentPageIsLoopback(action) {
  if (!isLoopbackNetworkUrl(page.url(), ['http:', 'https:'])) {
    throw new Error(
      `Refusing ${action} from a non-loopback page: ${networkOrigin(page.url())}`,
    )
  }
}

async function screenshotLocal(options) {
  assertCurrentPageIsLoopback('a marketing screenshot')
  await page.screenshot(options)
}

const demoAssetHits = {
  manifest: 0,
  instrumental: 0,
  vocal: 0,
  lyrics: 0,
}
if (recipe === 'karaoke-zen' || recipe === 'jam-karaoke') {
  const captureRoot = new URL('/__marketing-capture/demo/', baseUrl)
  const captureUrls = {
    instrumental: new URL('instrumental.wav', captureRoot).toString(),
    vocal: new URL('vocal.wav', captureRoot).toString(),
    lyrics: new URL('lyrics.lrc', captureRoot).toString(),
  }
  const captureManifest = {
    title: 'Goodbye to Spring',
    artist: 'Josh Woodward',
    attribution: {
      text: 'Music: "Goodbye to Spring" by Josh Woodward',
      url: 'https://www.joshwoodward.com/song/GoodbyeToSpring',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    },
    stems: {
      vocal: captureUrls.vocal,
      instrumental: captureUrls.instrumental,
    },
    lyrics: captureUrls.lyrics,
    durationSec: 100,
  }
  const silentWav = createSilentPcmWav()

  await page.route(
    new URL('/karaoke-demo-song.json', baseUrl).toString(),
    async (route) => {
      demoAssetHits.manifest += 1
      await route.fulfill({ json: captureManifest })
    },
  )
  for (const stem of ['instrumental', 'vocal']) {
    await page.route(captureUrls[stem], async (route) => {
      demoAssetHits[stem] += 1
      await route.fulfill({ body: silentWav, contentType: 'audio/wav' })
    })
  }
  await page.route(captureUrls.lyrics, async (route) => {
    demoAssetHits.lyrics += 1
    await route.fulfill({
      body: captureDemoLrc,
      contentType: 'text/plain; charset=utf-8',
    })
  })
}

async function gotoLocal(routePath) {
  await page.goto(new URL(routePath, baseUrl).toString(), {
    waitUntil: 'domcontentloaded',
  })
  if (!isLoopbackNetworkUrl(page.url(), ['http:', 'https:'])) {
    throw new Error(`Marketing capture followed a non-loopback redirect`)
  }
}

async function seedCaptureLyrics() {
  await page.evaluate(async (text) => {
    const { loadLyricsFromDb, saveLyricsToDb } =
      await import('/src/db/services/lyrics-db-service.ts')
    await saveLyricsToDb('karaoke-night-demo', {
      text,
      format: 'lrc',
      filename: 'marketing-capture-demo.lrc',
    })
    const saved = await loadLyricsFromDb('karaoke-night-demo')
    if (saved?.text !== text || saved.format !== 'lrc') {
      throw new Error('Capture lyrics did not persist in the local demo row')
    }
  }, captureDemoLrc)
}

let backgroundOverrideUsed = false
if (backgroundBytes !== null) {
  const backgroundPattern =
    recipe === 'karaoke-zen'
      ? '**/karaoke-night-stage.webp'
      : /\/jam\/room-[^/]+(?:-4k)?\.webp(?:\?.*)?$/
  await page.route(backgroundPattern, async (route) => {
    backgroundOverrideUsed = true
    await route.fulfill({
      body: backgroundBytes,
      contentType: backgroundPath?.endsWith('.webp')
        ? 'image/webp'
        : 'image/png',
    })
  })
}

try {
  let routePath
  let outputName
  const outputs = []
  if (recipe === 'karaoke-zen') {
    routePath = '/karaoke-night'
    await gotoLocal(routePath)
    await seedCaptureLyrics()
    await page
      .getByRole('button', { name: /sing this song/i })
      .first()
      .click()

    const stage = page.locator('[data-testid="karaoke-mobile-stage"]')
    if (!(await stage.isVisible())) {
      const zen = page.getByRole('button', { name: /^zen/i }).first()
      await zen.waitFor({ state: 'visible' })
      await zen.click()
    }

    await stage.waitFor({ state: 'visible' })
    await page
      .getByText('Goodbye to Spring', { exact: false })
      .first()
      .waitFor()
    await page.waitForTimeout(1800)

    const pause = stage.getByRole('button', { name: /^pause$/i })
    if (await pause.isVisible()) {
      await page.waitForTimeout(2200)
    }
  } else if (recipe === 'jam-karaoke') {
    routePath = '/#/jam'
    await gotoLocal(routePath)
    const mockSignaling = await page.evaluate(async () => {
      const { jamSignalingIsMocked } = await import('/src/lib/jam/signaling.ts')
      return jamSignalingIsMocked()
    })
    if (!mockSignaling) {
      throw new Error(
        'Jam marketing captures require VITE_JAM_MOCK_SIGNALING=1',
      )
    }
    await seedCaptureLyrics()
    await page.evaluate(async (notes) => {
      const { savePitchAnalysisToDb } =
        await import('/src/db/services/session-pitch-analysis-service.ts')
      await savePitchAnalysisToDb('karaoke-night-demo', {
        segmentedNotes: notes,
        mergedNotes: notes,
        pitchHistory: [],
      })
    }, syntheticPitchGuides)
    const name = page.getByLabel('Display Name')
    await name.waitFor({ state: 'visible' })
    await name.fill('Merc')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await page.getByText('Preview room — these peers are not real').waitFor()
    const collapseSidebar = page.getByRole('button', {
      name: 'Collapse sidebar',
    })
    if (await collapseSidebar.isVisible()) await collapseSidebar.click()
    await page.getByText('Ada', { exact: true }).first().waitFor()
    await page.getByText('Bo', { exact: true }).first().waitFor()
    const unmuteMicrophone = page.getByTitle('Unmute microphone')
    await unmuteMicrophone.waitFor({ state: 'visible' })
    await unmuteMicrophone.click()
    await page.getByRole('button', { name: 'Choose a drill or a song' }).click()
    const demoSong = page.getByRole('button', {
      name: /Goodbye to Spring/i,
    })
    await demoSong.waitFor({ state: 'visible' })
    await demoSong.click()
    await page.getByText('Josh Woodward', { exact: false }).first().waitFor()

    const paintLines = async (singer, fromLine, toLine) => {
      await page.getByRole('button', { name: singer, exact: true }).click()
      const first = page.locator(`[data-line="${fromLine}"]`)
      const last = page.locator(`[data-line="${toLine}"]`)
      await first.scrollIntoViewIfNeeded()
      const firstBox = await first.boundingBox()
      const lastBox = await last.boundingBox()
      if (firstBox === null || lastBox === null) {
        throw new Error(`Could not stage ${singer}'s lyric assignment`)
      }
      await page.mouse.move(firstBox.x + 24, firstBox.y + firstBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(lastBox.x + 24, lastBox.y + lastBox.height / 2, {
        steps: 8,
      })
      await page.mouse.up()
    }
    await paintLines('Ada', 0, 2)
    await paintLines('Bo', 3, 5)
    await paintLines('You', 6, 8)
    await page.getByRole('button', { name: 'Done' }).click()

    const play = page.getByRole('button', {
      name: 'Start playback for everyone here',
    })
    await play.waitFor({ state: 'visible' })
    await play.click()
    await page.waitForTimeout(500)

    // Let the real local audio clock drive lyrics and pitch lanes, accelerated
    // only so the capture does not idle for a full minute of silent fixture.
    const acceleratedAudioClocks = await page.evaluate(() => {
      const audioElements = Array.from(document.querySelectorAll('audio'))
      for (const audio of audioElements) audio.playbackRate = 8
      return audioElements.length
    })
    if (acceleratedAudioClocks === 0) {
      throw new Error('Jam capture has no local song clocks to stage')
    }
    await page.waitForFunction(
      () => {
        const slider = document.querySelector(
          '[role="slider"][aria-label="Song position"]',
        )
        return Number(slider?.getAttribute('aria-valuenow')) >= 63
      },
      undefined,
      { timeout: 15_000 },
    )
    await page.evaluate(() => {
      for (const audio of document.querySelectorAll('audio')) {
        audio.playbackRate = 1
      }
    })
    await page.waitForTimeout(500)
  } else {
    routePath = `/mirror?demo=${encodeURIComponent(profile)}&revealed=1`
    await gotoLocal(routePath)
    const portrait = page.locator('.mirror-back-img')
    await portrait.waitFor({ state: 'visible' })
    await portrait.evaluate(async (image) => {
      if (image instanceof HTMLImageElement) await image.decode()
    })
    const shareTwin = page.getByRole('button', { name: 'Share with twin' })
    await shareTwin.waitFor({ state: 'visible' })
    await page.waitForTimeout(700)
  }

  if (backgroundBytes !== null && !backgroundOverrideUsed) {
    throw new Error(
      `The ${recipe} background override was not consumed; refusing a mislabeled capture`,
    )
  }

  const networkAudit = await page.evaluate(
    () => window.__mercuryMarketingNetworkAudit,
  )
  if (recipe === 'jam-karaoke') {
    if (networkAudit.rtcPeerConnectionAttempts !== 0) {
      throw new Error(
        `Jam preview attempted ${networkAudit.rtcPeerConnectionAttempts} peer connection(s)`,
      )
    }
    if (
      networkAudit.getUserMediaCalls.length !== 1 ||
      networkAudit.disallowedMediaRequests !== 0 ||
      networkAudit.getUserMediaCalls.some((call) => !call.audio || call.video)
    ) {
      throw new Error(
        `Jam preview did not use exactly one fake-mic-only capture: ${JSON.stringify(networkAudit.getUserMediaCalls)}`,
      )
    }
  }
  if (recipe === 'karaoke-zen' || recipe === 'jam-karaoke') {
    const requiredAssets =
      recipe === 'jam-karaoke'
        ? ['manifest', 'instrumental', 'lyrics']
        : ['manifest', 'instrumental']
    for (const requiredAsset of requiredAssets) {
      if (demoAssetHits[requiredAsset] === 0) {
        throw new Error(
          `Capture did not consume its local ${requiredAsset} fixture`,
        )
      }
    }
  }

  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-play-state: paused !important;
        caret-color: transparent !important;
      }
      [data-testid="consent-banner"],
      [data-tour-popover],
      [aria-label="Notifications"],
      div:has(> [title="Drag to reposition"]) { display: none !important; }
    `,
  })
  await page.evaluate(async () => {
    await document.fonts.ready
    document.documentElement.dataset.marketingCapture = 'ready'
  })

  outputName =
    recipe === 'voice-mirror'
      ? `${recipe}-${profile}-${viewport.width}x${viewport.height}.png`
      : `${recipe}-${viewport.width}x${viewport.height}.png`
  const outputPath = resolve(outDir, outputName)
  await screenshotLocal({ path: outputPath, fullPage: false })
  outputs.push({ file: outputName, format: 'png', kind: 'ui-screenshot' })

  if (recipe === 'voice-mirror') {
    const cardName = `${recipe}-${profile}-card.png`
    assertCurrentPageIsLoopback('a Voice Mirror card capture')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Share with twin' }).click()
    const download = await downloadPromise
    assertCurrentPageIsLoopback('a Voice Mirror card save')
    await download.saveAs(resolve(outDir, cardName))
    outputs.push({
      file: cardName,
      format: 'png',
      kind: 'app-rendered-card',
    })
  }

  const manifest = {
    schemaVersion: 1,
    project: 'mercurypitch',
    createdAt: new Date().toISOString(),
    recipe,
    source: {
      baseUrl: `${baseUrl.protocol}//${baseUrl.host}${baseUrl.pathname}`,
      route: routePath,
      demoData: true,
      personalData: backgroundPath === null ? false : null,
      personalDataReview:
        backgroundPath === null
          ? 'synthetic-local-state'
          : 'required-for-local-background-override',
      illustrative:
        backgroundPath !== null ||
        recipe === 'voice-mirror' ||
        recipe === 'jam-karaoke',
      networkPolicy: {
        mode: 'loopback-only',
        blockedOrigins: [...blockedEgressOrigins].sort(),
        rtcPeerConnections: networkAudit.rtcPeerConnectionAttempts,
        mediaRequests: networkAudit.getUserMediaCalls,
      },
      ...(recipe === 'jam-karaoke'
        ? {
            syntheticState: [
              'preview-peers',
              'denoised-pitch-guides',
              'lyric-assignments',
              'local-fake-mic-trail',
              'capture-only-silent-demo-stems',
              'capture-only-lyrics',
            ],
          }
        : recipe === 'karaoke-zen'
          ? {
              syntheticState: [
                'capture-only-silent-demo-stems',
                'capture-only-lyrics',
              ],
            }
          : {}),
      ...(recipe === 'voice-mirror' ? { profile } : {}),
    },
    viewport,
    background: backgroundPath
      ? {
          file: basename(backgroundPath),
          provenance: 'local-override-unverified',
          sha256: backgroundHash,
        }
      : null,
    outputs,
    pageErrors,
  }
  await writeFile(
    resolve(outDir, `${recipe}-manifest.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )

  if (pageErrors.length > 0) {
    throw new Error(
      `Capture completed with page errors: ${pageErrors.join('; ')}`,
    )
  }
  console.log(outputPath)
} catch (error) {
  const failurePath = resolve(outDir, `${recipe}-failure.png`)
  await screenshotLocal({ path: failurePath, fullPage: false }).catch(
    () => undefined,
  )
  throw error
} finally {
  await browser.close()
}
