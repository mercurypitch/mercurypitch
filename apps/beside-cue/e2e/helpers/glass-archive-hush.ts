// Archive Hush browser fixtures — oscillator PCM enters the real capture worker; real raster checkpoints surround voice behavior.
import { expect, type Page } from '@playwright/test'
import { installMuseumRasterCheckpoints, renderMuseumCheckpoint, } from './museum-raster-checkpoints'
import { ARCHIVE_HUSH_ROOMS } from '../../../../packages/glass-game/src/content/archive-hush-room'

const levelId = 'glassworks-unbroken-archive/archive-hush'

declare global {
  interface Window {
    archiveHushPcm: {
      set(midi: number, amplitude: number): void
      read(): { acquired: number; live: number; contexts: string[] }
      dispose(): Promise<void>
    }
    archiveHushLabels: { read(canvas: HTMLCanvasElement): string | null }
    archiveHushDraw: {
      read(): {
        roomId: string
        curtainClosed: boolean | null
        coverX: number | null
        draws: number
        labels: (string | null)[]
        vessels: { intact: boolean; shards: number; shardsVisible: boolean }[]
      }
    }
  }
}

export async function openArchiveHush(
  page: Page,
  calibrated = true,
): Promise<string[]> {
  await installMuseumRasterCheckpoints(page)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.addInitScript(
    ({ id, calibrated }) => {
      const prefix = 'beside-cue:glass-adventure:'
      localStorage.setItem(
        `${prefix}tutorial:${id}:archive-hush-route:v2`,
        'seen',
      )
      localStorage.setItem(`${prefix}automatic-singing`, 'off')
      if (calibrated) localStorage.setItem(`${prefix}comfortable-note`, '57')
      else localStorage.removeItem(`${prefix}comfortable-note`)
      const paintedLabels = new WeakMap<HTMLCanvasElement, string>()
      const originalFillText = CanvasRenderingContext2D.prototype.fillText
      CanvasRenderingContext2D.prototype.fillText = function (...args) {
        paintedLabels.set(this.canvas, args[0])
        originalFillText.apply(this, args)
      }
      window.archiveHushLabels = {
        read: (canvas) => paintedLabels.get(canvas) ?? null,
      }
      let midi = 57
      let amplitude = 0
      const sources: {
        context: AudioContext
        oscillator: OscillatorNode
        gain: GainNode
        track: MediaStreamTrack
      }[] = []
      const original = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      )
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (!constraints?.audio) return original(constraints)
        const context = new AudioContext()
        await context.resume()
        const oscillator = context.createOscillator()
        oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12)
        const gain = context.createGain()
        gain.gain.value = amplitude
        const destination = context.createMediaStreamDestination()
        oscillator.connect(gain).connect(destination)
        oscillator.start()
        const track = destination.stream.getAudioTracks()[0]!
        const stop = track.stop.bind(track)
        let ended = false
        track.stop = () => {
          if (ended) return
          ended = true
          stop()
          oscillator.stop()
          oscillator.disconnect()
          gain.disconnect()
          void context.close()
        }
        sources.push({ context, oscillator, gain, track })
        return destination.stream
      }
      window.archiveHushPcm = {
        set(value, level) {
          midi = value
          amplitude = level
          for (const source of sources)
            if (source.track.readyState === 'live') {
              source.oscillator.frequency.setValueAtTime(
                440 * 2 ** ((midi - 69) / 12),
                source.context.currentTime,
              )
              source.gain.gain.setValueAtTime(
                amplitude,
                source.context.currentTime,
              )
            }
        },
        read: () => ({
          acquired: sources.length,
          live: sources.filter((source) => source.track.readyState === 'live')
            .length,
          contexts: sources.map((source) => source.context.state),
        }),
        async dispose() {
          for (const source of sources)
            if (source.track.readyState === 'live') source.track.stop()
          await Promise.all(
            sources.map((source) =>
              source.context.state === 'closed'
                ? Promise.resolve()
                : source.context.close(),
            ),
          )
        },
      }
    },
    { id: levelId, calibrated },
  )
  await page.route('**/src/games/adventure/standalone.tsx*', async (route) => {
    const response = await route.fetch()
    const entry = await response.text()
    await route.fulfill({
      response,
      body: `
const { Scene: HushScene } = await import('/@id/three');
const hushBeforeRender = HushScene.prototype.onBeforeRender;
const hushAfterRender = HushScene.prototype.onAfterRender;
let hushScene, hushDraws = 0, hushFrameStart = 0;
const isHushDraw = renderer => renderer.getRenderTarget() === null && renderer.domElement.closest('[data-testid="glass-adventure"]');
HushScene.prototype.onBeforeRender = function (...args) {
  const result = hushBeforeRender.apply(this, args);
  if (isHushDraw(args[0])) {
    window.museumRasterCheckpoints.beginFrame(args[0].getContext());
    hushFrameStart = window.museumRasterCheckpoints.read().forwardedDraws;
  }
  return result;
};
HushScene.prototype.onAfterRender = function (...args) {
  const result = hushAfterRender.apply(this, args);
  if (isHushDraw(args[0])) {
    hushScene = this;
    if (window.museumRasterCheckpoints.read().forwardedDraws > hushFrameStart) hushDraws++;
    window.museumRasterCheckpoints.finishFrame(args[0].getContext());
  }
  return result;
};
window.archiveHushDraw = { read() {
const roomId = document.querySelector('[data-testid="archive-hush-panel"]')?.dataset.room ?? 'diadem';
const room = hushScene?.getObjectByName('archive-dark-room-' + roomId);
const ids = ${JSON.stringify(Object.fromEntries(ARCHIVE_HUSH_ROOMS.map((room) => [room.id, room.vesselIds])))}[roomId] ?? [];
return {
  roomId,
  curtainClosed: room?.getObjectByName('archive-acoustic-curtain')?.userData.closed ?? null,
  coverX: room?.getObjectByName('archive-protective-cloche')?.position.x ?? null,
  draws: hushDraws,
  labels: ids.map(id => window.archiveHushLabels.read(hushScene?.getObjectByName('archive-note-' + id)?.material.map?.image)),
  vessels: ids.map(id => {
    const intact = hushScene?.getObjectByName('vessel-intact-' + id);
    const shards = hushScene?.getObjectByName('vessel-shards-' + id);
    return { intact: intact?.visible === true, shards: shards?.children.length ?? -1, shardsVisible: shards?.visible === true };
  }),
}; } };
${entry}`,
    })
  })
  const response = await page.goto('/glass-game/?layout=archive-hush')
  expect(response?.status()).toBe(200)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 60_000 },
  )
  await expect(page.getByTestId('archive-hush-panel')).toHaveAttribute(
    'data-mode',
    'off',
  )
  await renderMuseumCheckpoint(page)
  await expect
    .poll(() => page.evaluate(() => window.archiveHushDraw.read().draws))
    .toBeGreaterThan(0)
  return errors
}

export async function setArchiveVoice(
  page: Page,
  midi: number,
  amplitude: number,
): Promise<void> {
  await page.evaluate(
    ({ midi, amplitude }) => window.archiveHushPcm.set(midi, amplitude),
    { midi, amplitude },
  )
}

export async function expectArchiveMicrophoneOff(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.archiveHushPcm.read()))
    .toMatchObject({ live: 0 })
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.archiveHushPcm
          .read()
          .contexts.every((state) => state === 'closed'),
      ),
    )
    .toBe(true)
}

export async function archivePlayer(
  page: Page,
): Promise<{ x: number; z: number; yaw: number }> {
  return page.getByTestId('glass-adventure').evaluate((element) => ({
    x: Number(element.getAttribute('data-player-x')),
    z: Number(element.getAttribute('data-player-z')),
    yaw: Number(element.getAttribute('data-merc-yaw')),
  }))
}

/** Physical keyboard travel only: camera-relative direction is sampled between released contacts. */
export async function walkArchiveTo(
  page: Page,
  x: number,
  z: number,
  stopAtEscape = false,
): Promise<void> {
  const deadline = Date.now() + 20_000
  const root = page.getByTestId('glass-adventure')
  while (Date.now() < deadline) {
    // Crossing the exit freezes movement before the destination beyond it.
    // Only the final route leg may terminate at the actual completion dialog.
    if (
      stopAtEscape &&
      (await page
        .getByRole('dialog', { name: 'The archive is safe', exact: true })
        .isVisible())
    )
      return
    const player = await archivePlayer(page)
    const dx = x - player.x,
      dz = z - player.z
    if (Math.hypot(dx, dz) < 0.22) return
    const yaw = Number(await root.getAttribute('data-camera-yaw'))
    const side = dx * Math.cos(yaw) - dz * Math.sin(yaw)
    const forward = -dx * Math.sin(yaw) - dz * Math.cos(yaw)
    const key =
      Math.abs(side) > Math.abs(forward)
        ? side > 0
          ? 'KeyD'
          : 'KeyA'
        : forward > 0
          ? 'KeyW'
          : 'KeyS'
    await page.keyboard.down(key)
    try {
      await page.waitForTimeout(
        Math.min(250, Math.max(70, Math.hypot(dx, dz) * 300)),
      )
    } finally {
      await page.keyboard.up(key)
    }
    await page.waitForTimeout(25)
  }
  throw new Error(
    `Archive route did not reach ${x}, ${z}: ${JSON.stringify(await archivePlayer(page))}`,
  )
}
