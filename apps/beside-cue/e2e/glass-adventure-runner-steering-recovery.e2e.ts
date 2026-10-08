// Steering contact recovery — a fresh primary touch can replace a stale touch without stealing active controls.

import { expect, test, type Page } from '@playwright/test'
import { portableConsoleEnabled } from '../scripts/portable-console-policy'
import { useRunnerControlsRenderer } from './helpers/runner-controls-renderer'
import { installRunnerVoice } from './helpers/runner-voice-fixture'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
test.setTimeout(120_000)

const diagnosticsEnabled = portableConsoleEnabled({
  ...process.env,
  VITE_BESIDE_CUE_GAMES: '1',
})

function observeRecoveries(page: Page) {
  const events: unknown[] = []
  page.on('console', (message) => {
    if (message.text().startsWith('[Glassworks runner input]'))
      void message
        .args()[1]
        ?.jsonValue()
        .then((value) => events.push(value))
  })
  return events
}

async function openStudy(page: Page) {
  await useRunnerControlsRenderer(page)
  await installRunnerVoice(page)
  await page.goto('/glass-game/?layout=singing-current&steering=continuous')
  const runner = page.getByTestId('song-runner')
  const start = page.getByRole('button', { name: 'Start course' })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 30_000,
  })
  return runner
}

test('a fresh primary touch replaces a lost terminal without interrupting a stationary hold or second finger @smoke', async ({
  page,
  context,
}, testInfo) => {
  const recoveries = observeRecoveries(page)
  const runner = await openStudy(page)
  const steering = page.getByRole('slider', { name: 'Steer Merc' })
  const box = (await steering.boundingBox())!
  const origin = { id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const right = { ...origin, x: origin.x + 40 }
  const cdp = await context.newCDPSession(page)
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [origin],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [right],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '100')
    const holdStarted = Number(await runner.getAttribute('data-course-seconds'))
    await expect
      .poll(async () =>
        Number(await runner.getAttribute('data-course-seconds')),
      )
      .toBeGreaterThan(holdStarted + 0.75)
    await expect(steering).toHaveAttribute('aria-valuenow', '100')

    // A genuine concurrent second touch must not displace the stationary owner.
    const second = { ...origin, id: 2 }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [right, second],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [right, { ...second, x: second.x - 40 }],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '100')
    // Script-dispatched primary contacts are not evidence of a fresh native gesture.
    await steering.evaluate((element) =>
      element.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          pointerType: 'touch',
          isPrimary: true,
          pointerId: 900,
          button: 0,
          clientX: 10,
        }),
      ),
    )
    await expect(steering).toHaveAttribute('aria-valuenow', '100')

    expect(recoveries).toEqual([])

    // Deliberately hide all terminals from the component, leaving its owner stale.
    await steering.evaluate((element) => {
      const drop = (event: Event) => {
        if (element.contains(event.target as Node))
          event.stopImmediatePropagation()
      }
      for (const type of [
        'pointerup',
        'pointercancel',
        'lostpointercapture',
        'touchend',
        'touchcancel',
      ])
        document.addEventListener(type, drop, true)
      document.addEventListener(
        'pointerdown',
        () => {
          for (const type of [
            'pointerup',
            'pointercancel',
            'lostpointercapture',
            'touchend',
            'touchcancel',
          ])
            document.removeEventListener(type, drop, true)
        },
        { capture: true, once: true },
      )
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '100')
    // Start a fresh native gesture after every previous contact ended.
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [origin],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '0')
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...origin, x: origin.x - 40 }],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '-100')
    await expect.poll(() => recoveries.length).toBe(diagnosticsEnabled ? 1 : 0)
    expect(recoveries).toEqual(
      diagnosticsEnabled
        ? [{ event: 'primary-touch-replaced-owner', steeringAxis: 1 }]
        : [],
    )
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '0')
    await expect
      .poll(async () =>
        Number(await runner.getAttribute('data-lateral-velocity')),
      )
      .toBe(0)
    await expect(runner).toHaveAttribute('data-phase', 'running')
    await page.screenshot({
      path: testInfo.outputPath('fresh-touch-steering-recovered.png'),
    })
  } finally {
    await cdp.detach()
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  }
})

test('a primary touch cannot steal a held mouse steering contact @smoke', async ({
  page,
  context,
}) => {
  await openStudy(page)
  const steering = page.getByRole('slider', { name: 'Steer Merc' })
  const box = (await steering.boundingBox())!
  const origin = { id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const cdp = await context.newCDPSession(page)
  try {
    await page.mouse.move(origin.x, origin.y)
    await page.mouse.down()
    await page.mouse.move(origin.x + 40, origin.y)
    await expect(steering).toHaveAttribute('aria-valuenow', '100')
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [origin],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...origin, x: origin.x - 40 }],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '100')
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '100')
    await page.mouse.up()
    await expect(steering).toHaveAttribute('aria-valuenow', '0')
  } finally {
    await cdp.detach()
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  }
})

test('a primary Jump contact and secondary steering contact stay independent @smoke', async ({
  page,
  context,
}) => {
  const runner = await openStudy(page)
  const steering = page.getByRole('slider', { name: 'Steer Merc' })
  const box = (await steering.boundingBox())!
  const jump = (await page
    .getByRole('button', { name: 'Jump', exact: true })
    .boundingBox())!
  const action = {
    id: 1,
    x: jump.x + jump.width / 2,
    y: jump.y + jump.height / 2,
  }
  const origin = { id: 2, x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const cdp = await context.newCDPSession(page)
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [action],
    })
    await expect(runner).toHaveAttribute('data-player-grounded', 'false')
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [action, origin],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [action, { ...origin, x: origin.x - 40 }],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '-100')
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '0')
    await expect
      .poll(async () =>
        Number(await runner.getAttribute('data-lateral-velocity')),
      )
      .toBe(0)
  } finally {
    await cdp.detach()
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  }
})

test('the end of every touch clears a missed pointer terminal but another held touch does not @smoke', async ({
  page,
  context,
}, testInfo) => {
  const recoveries = observeRecoveries(page)
  const runner = await openStudy(page)
  const steering = page.getByRole('slider', { name: 'Steer Merc' })
  const box = (await steering.boundingBox())!
  const jump = (await page
    .getByRole('button', { name: 'Jump', exact: true })
    .boundingBox())!
  const origin = { id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const right = { ...origin, x: origin.x + 40 }
  const action = {
    id: 2,
    x: jump.x + jump.width / 2,
    y: jump.y + jump.height / 2,
  }
  const cdp = await context.newCDPSession(page)
  try {
    await steering.evaluate((element) => {
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
        document.addEventListener(
          type,
          (event) => {
            if (element.contains(event.target as Node))
              event.stopImmediatePropagation()
          },
          true,
        )
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [origin],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [right],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [right, action],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [right],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '100')
    await steering.evaluate((element) =>
      element.dispatchEvent(
        new TouchEvent('touchend', { bubbles: true, touches: [] }),
      ),
    )
    await expect(steering).toHaveAttribute('aria-valuenow', '100')
    expect(recoveries).toEqual([])
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '0')
    await expect
      .poll(async () =>
        Number(await runner.getAttribute('data-lateral-velocity')),
      )
      .toBe(0)
    await expect.poll(() => recoveries.length).toBe(diagnosticsEnabled ? 1 : 0)
    expect(recoveries).toEqual(
      diagnosticsEnabled
        ? [{ event: 'touch-sequence-ended', steeringAxis: 1 }]
        : [],
    )

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [origin],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [right],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '0')
    await expect.poll(() => recoveries.length).toBe(diagnosticsEnabled ? 2 : 0)

    // Clearing only the touch restores an independently held keyboard direction.
    await page.keyboard.down('KeyA')
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [origin],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [right],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '100')
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '-100')
    await page.keyboard.up('KeyA')
    await expect(steering).toHaveAttribute('aria-valuenow', '0')
    // Repeated rescues continue working after the portable log budget is spent.
    for (let repeat = 0; repeat < 3; repeat++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [origin],
      })
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [right],
      })
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
      await expect(steering).toHaveAttribute('aria-valuenow', '0')
    }
    await expect.poll(() => recoveries.length).toBe(diagnosticsEnabled ? 4 : 0)
    await page.screenshot({
      path: testInfo.outputPath('ended-touch-steering-recovered.png'),
    })
  } finally {
    await cdp.detach()
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  }
})

test('held steering clears through a bounded display stall and release after recovery cannot restart it @smoke', async ({
  page,
  context,
}, testInfo) => {
  const runner = await openStudy(page)
  const steering = page.getByRole('slider', { name: 'Steer Merc' })
  const box = (await steering.boundingBox())!
  const origin = { id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const cdp = await context.newCDPSession(page)
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [origin],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...origin, x: origin.x + 40 }],
    })
    await expect(steering).toHaveAttribute('aria-valuenow', '100')
    await expect
      .poll(async () =>
        Number(await runner.getAttribute('data-lateral-velocity')),
      )
      .toBeGreaterThan(0)
    const stoppedBefore = await page.evaluate(
      () => window.runnerVoiceFixture.stoppedTracks,
    )

    // Deliberate fault injection: the real audio clock continues while this
    // bounded task blocks presentation. It is not a physical iPhone diagnosis.
    await page.evaluate(() => {
      const deadline = performance.now() + 500
      while (performance.now() < deadline) {
        /* simulate an unresponsive main thread */
      }
    })
    await expect(runner).toHaveAttribute('data-phase', 'recovering')
    await expect(runner).toHaveAttribute('data-recovery-reason', 'frame-gap')
    await expect(runner).toHaveAttribute('data-lateral-velocity', '0.000')
    await expect(runner).toHaveAttribute('data-microphone', 'closed')
    await expect(steering).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => window.runnerVoiceFixture.stoppedTracks))
      .toBeGreaterThan(stoppedBefore)
    await page.screenshot({
      path: testInfo.outputPath('held-steering-display-gap-recovery.png'),
    })

    // The thumb is released only after recovery has cleared and hidden input.
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await page.getByRole('button', { name: 'Resume from checkpoint' }).click()
    await expect(runner).toHaveAttribute('data-phase', 'running', {
      timeout: 30_000,
    })
    await expect(runner).toHaveAttribute('data-microphone', 'ready')
    await expect(steering).toHaveAttribute('aria-valuenow', '0')
    await expect(runner).toHaveAttribute('data-lateral-velocity', '0.000')
    const resumedAt = Number(await runner.getAttribute('data-course-seconds'))
    const lateralAfterResume = await runner.getAttribute('data-lateral-x')
    await expect
      .poll(async () =>
        Number(await runner.getAttribute('data-course-seconds')),
      )
      .toBeGreaterThan(resumedAt + 0.75)
    await expect(steering).toHaveAttribute('aria-valuenow', '0')
    await expect(runner).toHaveAttribute('data-lateral-x', lateralAfterResume!)
    await expect(runner).toHaveAttribute('data-lateral-velocity', '0.000')
    await page.screenshot({
      path: testInfo.outputPath('resumed-without-stale-steering.png'),
    })
  } finally {
    await cdp.detach()
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  }
})
