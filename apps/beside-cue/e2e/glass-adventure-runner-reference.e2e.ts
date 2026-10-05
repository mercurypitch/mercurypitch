// Runner reference acceptance — real audio leaves setup nodes, selected pitch and keyboard focus intact.
import { expect, test, type Locator } from '@playwright/test'
import { useRunnerControlsRenderer } from './helpers/runner-controls-renderer'
import { installRunnerVoice } from './helpers/runner-voice-fixture'

interface ReferenceSetupObservation {
  readonly removals: number
  readonly focusChanges: number
  readonly phases: readonly string[]
  readonly sameControls: boolean
  readonly playedNote: boolean
  readonly busyActivations: number
}

declare global {
  interface Window {
    runnerReferenceSourceStarts: number
    runnerReferenceSetupProbe: {
      read(): ReferenceSetupObservation
      stop(): void
    }
  }
}

async function observeReferenceSetup(dialog: Locator): Promise<void> {
  await dialog.evaluate((element) => {
    const runner = element.closest<HTMLElement>('[data-testid="song-runner"]')!
    const slider = element.querySelector<HTMLInputElement>(
      'input[aria-label="Comfortable note"]',
    )!
    const button = [...element.querySelectorAll('button')].find(
      (control) => control.textContent?.trim() === 'Hear note',
    )!
    let removals = 0
    let focusChanges = 0
    let playedNote = false
    let busyActivations = 0
    const phases = [runner.dataset.phase!]
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const removed of record.removedNodes) {
          if (
            [element, slider, button].some(
              (control) => removed === control || removed.contains(control),
            )
          )
            removals++
        }
      }
      const phase = runner.dataset.phase!
      if (phases.at(-1) !== phase) phases.push(phase)
      if (
        element.querySelector('[role="status"]')?.textContent?.trim() ===
        'Playing note'
      )
        playedNote = true
    })
    observer.observe(runner, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-phase'],
    })
    const onFocus = (event: FocusEvent) => {
      if (event.target !== button) focusChanges++
    }
    document.addEventListener('focusin', onFocus)
    const onClick = () => {
      if (button.getAttribute('aria-busy') === 'true') busyActivations++
    }
    button.addEventListener('click', onClick, true)
    window.runnerReferenceSetupProbe = {
      read: () => ({
        removals,
        focusChanges,
        phases,
        playedNote,
        busyActivations,
        sameControls:
          element.isConnected &&
          slider.isConnected &&
          button.isConnected &&
          element.querySelector('input[aria-label="Comfortable note"]') ===
            slider,
      }),
      stop: () => {
        observer.disconnect()
        document.removeEventListener('focusin', onFocus)
        button.removeEventListener('click', onClick, true)
      },
    }
  })
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`reference setup ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: viewport.width < 600 })

    test('Hear note retains setup, focus and the selected note before and after pause @smoke', async ({
      page,
    }, testInfo) => {
      await useRunnerControlsRenderer(page)
      await installRunnerVoice(page, false, { omitRaster: false })
      await page.addInitScript(() => {
        window.runnerReferenceSourceStarts = 0
        const start = AudioBufferSourceNode.prototype.start
        AudioBufferSourceNode.prototype.start = function (
          ...args: Parameters<typeof start>
        ) {
          window.runnerReferenceSourceStarts++
          return start.apply(this, args)
        }
      })
      await page.goto('/glass-game/?layout=singing-current')
      const runner = page.getByTestId('song-runner')
      const start = page.getByRole('button', { name: 'Start course' })
      await expect(start).toBeEnabled()
      const slider = page.getByRole('slider', { name: 'Comfortable note' })
      await slider.focus()
      await page.keyboard.press('ArrowRight')
      await expect(slider).toHaveValue('58')
      const hear = page.getByRole('button', { name: 'Hear note' })

      for (const phase of ['idle', 'paused']) {
        const setup = page.getByRole('dialog', {
          name: phase === 'idle' ? 'Ready when you are' : 'Course paused',
        })
        await hear.focus()
        await expect(hear).toBeFocused()
        await observeReferenceSetup(setup)
        const sourceStarts = await page.evaluate(
          () => window.runnerReferenceSourceStarts,
        )

        if (viewport.width < 600) await hear.tap()
        else await hear.press('Enter')
        await expect(hear).toHaveAttribute('aria-busy', 'true')
        // Native keyboard repeats fit within the 0.8-second example; the
        // phone's first activation above still uses the real touch target.
        for (let activation = 0; activation < 3; activation++)
          await hear.press('Enter')
        await expect(hear).toHaveAttribute('aria-busy', 'false')
        await expect(runner).toHaveAttribute('data-phase', phase)
        await expect(runner).toHaveAttribute('data-microphone', 'closed')
        await expect(hear).toBeFocused()
        await expect(slider).toHaveValue('58')
        expect(
          await page.evaluate(() => window.runnerReferenceSourceStarts),
        ).toBe(sourceStarts + 1)
        expect(
          await page.evaluate(() => window.runnerReferenceSetupProbe.read()),
        ).toEqual({
          removals: 0,
          focusChanges: 0,
          phases: [phase],
          sameControls: true,
          playedNote: true,
          busyActivations: 3,
        })
        await page.screenshot({
          path: testInfo.outputPath(`${phase}-reference-setup.png`),
        })
        await page.evaluate(() => window.runnerReferenceSetupProbe.stop())

        if (phase === 'idle') {
          expect(
            await page.evaluate(() => window.runnerVoiceFixture.requests),
          ).toBe(0)
          await page.evaluate(() => window.runnerVoiceFixture.silent())
          await start.click()
          await expect(runner).toHaveAttribute('data-phase', 'readiness')
          await page.getByRole('button', { name: 'Pause course' }).click()
          await expect(runner).toHaveAttribute('data-phase', 'paused')
        }
      }
      await page.evaluate(() => window.runnerVoiceFixture.dispose())
    })
  })
}
