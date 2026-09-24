// Conservatory lesson proof — full adventure UI with a synthetic microphone port.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const out = new URL('../proofs/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const errors = []
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  page.setDefaultTimeout(120000)
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/__conservatory-proof', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#app{margin:0;height:100%;overflow:hidden}body{font-family:Arial,sans-serif}</style><div id="app"></div>',
    }),
  )
  await page.goto('http://127.0.0.1:5224/__conservatory-proof')
  await page.evaluate(async () => {
    const { render } = await import('/node_modules/solid-js/web/dist/web.js')
    const { createComponent } =
      await import('/node_modules/solid-js/dist/solid.js')
    const { GlassAdventure } =
      await import('/packages/glass-game/src/ui/GlassAdventure.tsx')
    const { RESONANCE_CONSERVATORY } =
      await import('/packages/glass-game/src/content/resonance-conservatory.ts')
    const { createMercuryGlassHost } =
      await import('/src/features/glass-adventure/host.ts')
    const level = structuredClone(RESONANCE_CONSERVATORY)
    const target = level.breakables.find((v) => v.id.endsWith('/fern-wave'))
    const checkpoint = level.checkpoints[0]
    checkpoint.position = { ...target.anchor }
    level.spawn = {
      position: { ...target.anchor },
      facingYaw: Math.PI,
      checkpointId: checkpoint.id,
    }
    const saved = {
      version: 2,
      levelId: level.id,
      checkpointId: checkpoint.id,
      completedBreakableIds: target.requiresCompleted ?? [],
    }
    const host = createMercuryGlassHost(() => {})
    host.readPreference = (key) =>
      key === 'comfortable-note'
        ? '57'
        : key.includes('tutorial')
          ? 'seen'
          : null
    host.loadProgress = () => saved
    host.saveProgress = () => {}
    host.writePreference = () => {}
    delete host.createMusic
    delete host.createNarration
    window.proof = { listener: null, sequence: 0 }
    host.createVoice = () => ({
      start: async () => {},
      latest: () => null,
      subscribe: (listener) => {
        window.proof.listener = listener
        return () => {
          window.proof.listener = null
        }
      },
      stop: () => {},
    })
    window.proof.dispose = render(
      () => createComponent(GlassAdventure, { host, level }),
      document.querySelector('#app'),
    )
  })
  await page.waitForSelector(
    '[data-testid="glass-adventure"][data-ready="true"]',
  )
  const skip = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skip.isVisible()) await skip.click()
  await page.getByRole('button', { name: /Sing to the glass/ }).click()
  await page.waitForSelector('[data-voice-mode="singing"]')
  await page.evaluate(async () => {
    const start = performance.now()
    for (let i = 0; i < 40; i++) {
      const now = performance.now()
      window.proof.listener?.(
        {
          sequence: ++window.proof.sequence,
          captureSeconds: (now - start) / 1000,
          capturedAtMs: now,
          midi: 57,
          confidence: 0.95,
        },
        now,
      )
      await new Promise((r) => setTimeout(r, 25))
    }
  })
  await page.waitForSelector('[data-step-index="1"]')
  const panel = page.getByRole('region', { name: 'Voice challenge' })
  const layouts = []
  for (const [name, width, height] of [
    ['phone', 390, 844],
    ['tablet', 1024, 768],
  ]) {
    await page.setViewportSize({ width, height })
    await page.screenshot({
      path: new URL(`conservatory-wave-${name}.png`, out).pathname,
    })
    layouts.push(
      await panel.evaluate((element) => {
        const b = element.getBoundingClientRect()
        return {
          width: innerWidth,
          height: innerHeight,
          left: b.left,
          right: b.right,
          top: b.top,
          bottom: b.bottom,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          text: element.textContent,
        }
      }),
    )
  }
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  if (await panel.count()) throw Error('Cancel did not remove lesson panel')
  await page.evaluate(() => window.proof.dispose())
  if (errors.length) throw Error(errors.join('; '))
  await writeFile(
    new URL('manifest.json', out),
    JSON.stringify(
      {
        scope:
          'Actual GlassAdventure UI and reference playback, synthetic steady microphone observations to wave phase; no physical-microphone or FPS claim.',
        layouts,
        cancelRemovedPanel: true,
        errors,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(JSON.stringify({ layouts, errors }))
} finally {
  await browser.close()
}
