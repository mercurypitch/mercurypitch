// Browser proof for actual decoded delivery loops and the museum output's real Web Audio envelope.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../..')
const { chromium } = await import(
  pathToFileURL(resolve(repo, 'node_modules/@playwright/test/index.mjs')).href
)
const base = process.env.MUSEUM_AUDIO_PROOF_URL ?? 'http://localhost:5188'
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  // A controlled blank host keeps GPU/game rendering out of this audio proof.
  await page.route('**/museum-audio-proof.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Museum audio proof</title><button>Enable audio</button>',
    }),
  )
  await page.goto(`${base}/museum-audio-proof.html`)
  await page.getByRole('button', { name: 'Enable audio' }).click()
  const result = await page.evaluate(
    async ({ repo, base }) => {
      const source = `${base}/@fs${repo}/packages`
      const { repairMuseumLoop } = await import(
        `${source}/glass-game/src/browser/museum-loop.ts`
      )
      const { createMuseumOutput } = await import(
        `${source}/glass-game/src/browser/museum-output.ts`
      )
      const {
        resetSharedAudioContext,
        acquireSharedAudioContext,
        sharedAudioContextOwners,
      } = await import(`${source}/audio-io/src/shared-audio-context.ts`)
      const { createBrowserMuseumAudio } = await import(
        `${source}/glass-game/src/browser/museum-audio.ts`
      )
      const decoder = new OfflineAudioContext(2, 48000, 48000)
      const decoded = []
      for (const cue of ['m01', 'm03', 'a01', 'a02', 'a03']) {
        const response = await fetch(
          `${base}/games/adventure-audio-v1/${cue}-loop.mp3`,
        )
        if (!response.ok) throw new Error(`Missing ${cue}`)
        const original = await decoder.decodeAudioData(
          await response.arrayBuffer(),
        )
        const repaired = repairMuseumLoop(decoder, original)
        let peak = 0
        let boundaryStep = 0
        let maxAdjacentStep = 0
        for (let channel = 0; channel < repaired.numberOfChannels; channel++) {
          const pcm = repaired.getChannelData(channel)
          boundaryStep = Math.max(
            boundaryStep,
            Math.abs(pcm[0] - pcm[pcm.length - 1]),
          )
          for (let frame = 0; frame < pcm.length; frame++) {
            peak = Math.max(peak, Math.abs(pcm[frame]))
            if (frame)
              maxAdjacentStep = Math.max(
                maxAdjacentStep,
                Math.abs(pcm[frame] - pcm[frame - 1]),
              )
          }
        }
        if (
          !Number.isFinite(peak) ||
          peak >= 0.95 ||
          boundaryStep > maxAdjacentStep
        )
          throw new Error(`Bad decoded loop: ${cue}`)
        decoded.push({
          cue,
          sampleRate: repaired.sampleRate,
          decodedSeconds: original.duration,
          repairedSeconds: repaired.duration,
          peak,
          boundaryStep,
          maxAdjacentStep,
        })
      }
      const offline = new OfflineAudioContext(1, 48000 * 2, 48000)
      // Only transport/state is substituted: all buffers, sources, GainNodes and
      // AudioParam automation below are Chromium's real audio rendering graph.
      const context = new Proxy(offline, {
        get(target, property) {
          if (property === 'state') return 'running'
          if (property === 'resume' || property === 'suspend')
            return async () => undefined
          if (
            property === 'addEventListener' ||
            property === 'removeEventListener'
          )
            return () => undefined
          const value = Reflect.get(target, property, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
      resetSharedAudioContext({ createContext: () => context })
      const output = createMuseumOutput(() => undefined)
      await output.unlocked
      const tone = offline.createBuffer(1, 48000, 48000)
      const samples = tone.getChannelData(0)
      for (let frame = 0; frame < samples.length; frame++)
        samples[frame] = 0.25 * Math.sin((2 * Math.PI * 220 * frame) / 48000)
      output.play([tone], {
        muted: false,
        musicVolume: 0.65,
        ambienceVolume: 0.55,
      })
      const suspended = offline.suspend(1.2)
      const rendering = offline.startRendering()
      await suspended
      const releaseAt = offline.currentTime
      const released = output.release()
      await offline.resume()
      const pcm = (await rendering).getChannelData(0)
      const rms = (start, end) => {
        const begin = Math.round(start * 48000),
          finish = Math.round(end * 48000)
        let square = 0
        for (let frame = begin; frame < finish; frame++)
          square += pcm[frame] ** 2
        return Math.sqrt(square / (finish - begin))
      }
      const before = rms(releaseAt - 0.03, releaseAt)
      const late = rms(releaseAt + 0.16, releaseAt + 0.18)
      const after = rms(releaseAt + 0.25, releaseAt + 0.3)
      const first = rms(0, 0.01),
        settled = rms(0.7, 0.73)
      await released
      resetSharedAudioContext()
      if (
        before < 0.1 ||
        late / before >= 0.02 ||
        after !== 0 ||
        first / settled >= 0.001
      )
        throw new Error(
          `Bad output envelope: ${JSON.stringify({ before, late, after, first, settled })}`,
        )
      // The last encounter lease queues suspend(), then Cancel immediately asks
      // the soundtrack to resume. This uses a real browser AudioContext and its
      // asynchronous statechange order, not the offline transport adapter above.
      const encounterLease = acquireSharedAudioContext('music-proof-encounter')
      const realContext = encounterLease.ensure()
      await encounterLease.unlock()
      const states = []
      realContext.addEventListener('statechange', () =>
        states.push(realContext.state),
      )
      const music = createBrowserMuseumAudio({
        assetUrl: (id) =>
          `${base}/games/adventure-audio-v1/${id.replace('audio-', '')}.mp3`,
        readPreference: () => null,
        writePreference: () => undefined,
      })
      encounterLease.release()
      const resumedAfterQueuedSuspend = await music.start()
      const ownersAfterResume = sharedAudioContextOwners()
      await music.silenceForVoice()
      music.dispose()
      resetSharedAudioContext()
      if (!resumedAfterQueuedSuspend)
        throw new Error(
          `Queued encounter suspension cancelled new music: ${JSON.stringify(states)}`,
        )
      return {
        decoded,
        envelope: {
          releaseAt,
          beforeRms: before,
          lateRms: late,
          lateRatio: late / before,
          afterStopRms: after,
          attackStartRms: first,
          settledRms: settled,
        },
        encounterResume: {
          resumedAfterQueuedSuspend,
          states,
          ownersAfterResume,
        },
      }
    },
    { repo, base },
  )
  if (errors.length) throw new Error(errors.join('\n'))
  const modules = ['museum-loop.ts', 'museum-output.ts', 'museum-audio.ts']
  const hashes = Object.fromEntries(
    await Promise.all(
      modules.map(async (file) => [
        file,
        createHash('sha256')
          .update(
            await readFile(
              resolve(repo, 'packages/glass-game/src/browser', file),
            ),
          )
          .digest('hex'),
      ]),
    ),
  )
  const report = {
    checkedAt: new Date().toISOString(),
    status: 'passed',
    scope:
      'Actual Chromium MP3 decode + real module seam repair; actual OfflineAudioContext GainNode/source envelope with controlled transport/state only. Native lifecycle covered separately by unit tests; no physical-device or musical owner-audition claim.',
    browserVersion: browser.version(),
    moduleSha256: hashes,
    errors,
    ...result,
  }
  await writeFile(
    resolve(here, 'runtime-browser-proof.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
