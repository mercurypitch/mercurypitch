// ============================================================
// App localization — persisted language, exact speech and unchanged personal plans
// ============================================================

import type { BesideCueStateV1 } from '@irchiinnuss/beside-cue-core'
import { activateCue, createCue, createInitialState, } from '@irchiinnuss/beside-cue-core'
import { createMobileRuntimeProbe } from '@irchiinnuss/mobile-runtime/testing'
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import type { BesideCueAppServices } from './app-services'
import type { AudioSourceVariant } from './content/audio-manifest'
import { getVoiceLines } from './content/localized-voice-lines'
import type { VoiceAudioPort } from './content/voice'
import type { AppLocale } from './i18n/locale'
import { translateUi } from './i18n/ui-copy'
import { createIndexedDbBesideCueRepository } from './infrastructure/indexed-db-repository'
import { getLocalizedAppConfig } from './localized-app-config'
import { createCinematicOnboardingPreferenceStore } from './onboarding/cinematic-onboarding-preference'

function savedPlan(locale: AppLocale): BesideCueStateV1 {
  const at = '2026-09-05T09:00:00.000Z'
  const created = createCue(createInitialState(), {
    id: 'personal-plan',
    pullCategoryId: 'custom',
    pullText: 'My own words / meine Worte',
    bSideText: 'Abrir mi cuaderno',
    mascotSetId: 'corktop-v1',
    at,
  }).state
  const active = activateCue(created, 'personal-plan', at).state
  return { ...active, settings: { ...active.settings, locale } }
}

function createSpeechProbe() {
  const sources: AudioSourceVariant[] = []
  const stopped: string[] = []
  const audio: VoiceAudioPort = {
    supportsMimeType: () => true,
    play(source) {
      sources.push(source)
      let finish!: (value: 'stopped') => void
      return {
        started: Promise.resolve(),
        finished: new Promise<'stopped'>((resolve) => {
          finish = resolve
        }),
        stop() {
          stopped.push(source.src)
          finish('stopped')
        },
      }
    },
    dispose() {},
  }
  return { audio, sources, stopped }
}

function testServices(
  repository: BesideCueAppServices['repository'],
  voiceAudio?: VoiceAudioPort,
): BesideCueAppServices {
  let nextId = 0
  const values = new Map<string, string>()
  return {
    repository,
    voiceAudio,
    runtime: Promise.resolve(createMobileRuntimeProbe().runtime),
    platform: 'web',
    purchases: {
      entitlementId: 'BeSideCue Pro',
      problem: 'Purchases need the Android or iOS app.',
    },
    onboardingPreferences: createCinematicOnboardingPreferenceStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    }),
    now: () => new Date('2026-09-05T10:00:00.000Z'),
    createId: () => `localized-${++nextId}`,
  }
}

describe('localized app integration', () => {
  it.each(['de_DE', 'bad_locale', 'hr-HR'])(
    'safely falls back for persisted locale %s',
    async (storedLocale) => {
      const repository = createIndexedDbBesideCueRepository({
        databaseFactory: new IDBFactory(),
      })
      const state = savedPlan('en')
      await repository.saveState({
        ...state,
        settings: { ...state.settings, locale: storedLocale },
      })
      render(() => <App services={testServices(repository)} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
      expect(document.documentElement.lang).toBe('en')
      expect(screen.getByRole('combobox')).toHaveValue('en')
    },
  )

  it('cannot overwrite a reminder that is still saving by changing language', async () => {
    const stored = createIndexedDbBesideCueRepository({
      databaseFactory: new IDBFactory(),
    })
    await stored.saveState(savedPlan('en'))
    let releaseSave!: () => void
    let saveStarted = false
    const pendingSave = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    const repository: BesideCueAppServices['repository'] = {
      ...stored,
      async saveState(state) {
        if (state.scheduleRules.length > 0 && !saveStarted) {
          saveStarted = true
          await pendingSave
        }
        return stored.saveState(state)
      },
    }
    const runtime = createMobileRuntimeProbe({ permission: 'granted' })
    render(() => (
      <App
        services={{
          ...testServices(repository),
          platform: 'ios',
          runtime: Promise.resolve(runtime.runtime),
        }}
      />
    ))
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.input(screen.getByLabelText('Type exact time'), {
      target: { value: '09:05' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Set reminder' }))
    await waitFor(() => expect(saveStarted).toBe(true))
    const selector = screen.getByRole('combobox')
    expect(selector).toBeDisabled()
    // Even a programmatic change cannot bypass the mutation guard.
    fireEvent.change(selector, { target: { value: 'de' } })
    expect(document.documentElement.lang).toBe('en')
    releaseSave()
    await waitFor(() => expect(selector).toBeEnabled())
    fireEvent.change(selector, { target: { value: 'de' } })
    await waitFor(async () =>
      expect((await stored.loadState())?.settings.locale).toBe('de'),
    )
    expect((await stored.loadState())?.scheduleRules).toMatchObject([
      { enabled: true, localTime: '09:05' },
    ])
    expect(runtime.calls.permissionRequests).toBe(0)
  })

  it('reschedules translated reminder copy without asking permission again or changing its time', async () => {
    const repository = createIndexedDbBesideCueRepository({
      databaseFactory: new IDBFactory(),
    })
    await repository.saveState(savedPlan('en'))
    const runtime = createMobileRuntimeProbe({ permission: 'granted' })
    render(() => (
      <App
        services={{
          ...testServices(repository),
          platform: 'ios',
          runtime: Promise.resolve(runtime.runtime),
        }}
      />
    ))
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.input(screen.getByLabelText('Type exact time'), {
      target: { value: '09:05' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Set reminder' }))
    await waitFor(() => expect(runtime.calls.scheduled.at(-1)).toHaveLength(1))
    const initialSchedule = runtime.calls.scheduled.at(-1)![0]!
    const originalRules = (await repository.loadState())!.scheduleRules
    expect(screen.getByRole('status')).toHaveTextContent(
      'Reminder set for 9:05',
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'de' } })
    const translated = getLocalizedAppConfig('de').dailyCue.notification
    await waitFor(() =>
      expect(runtime.calls.scheduled.at(-1)?.[0]).toMatchObject(translated),
    )
    expect(runtime.calls.scheduled.at(-1)?.[0]?.schedule).toEqual(
      initialSchedule.schedule,
    )
    expect(runtime.calls.scheduled.at(-1)?.[0]?.id).toEqual(initialSchedule.id)
    expect(runtime.calls.permissionRequests).toBe(0)
    expect((await repository.loadState())?.scheduleRules).toEqual(originalRules)
    expect(screen.getByRole('status')).not.toHaveTextContent('Reminder set')
    expect(screen.getByRole('status')).toHaveTextContent('9:05')
  })

  it.each(['es', 'de'] as const)(
    'hydrates %s before choosing the spoken bytes',
    async (locale) => {
      const repository = createIndexedDbBesideCueRepository({
        databaseFactory: new IDBFactory(),
      })
      await repository.saveState(savedPlan(locale))
      const voice = createSpeechProbe()
      render(() => <App services={testServices(repository, voice.audio)} />)

      fireEvent.click(
        await screen.findByRole('button', {
          name: (name) => name.startsWith(translateUi('Cue me now', locale)),
        }),
      )

      await waitFor(() => expect(voice.sources).toHaveLength(1))
      expect(voice.sources[0]?.src).toContain(`/voice/${locale}/corky/`)
      const firstCue = getVoiceLines(locale).find(
        (line) => line.id === 'corky.cue-open.01',
      )!
      expect(screen.getByText(firstCue.text)).toBeVisible()
      expect(document.documentElement.lang).toBe(locale)
      expect(
        voice.sources.some((source) => source.src.includes('/voice/en/')),
      ).toBe(false)
    },
  )

  it('persists the language switch across remount without translating personal plan text', async () => {
    const repository = createIndexedDbBesideCueRepository({
      databaseFactory: new IDBFactory(),
    })
    const initial = savedPlan('en')
    await repository.saveState(initial)
    const services = testServices(repository)
    const app = render(() => <App services={services} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'de' } })

    await waitFor(async () =>
      expect((await repository.loadState())?.settings.locale).toBe('de'),
    )
    expect(screen.getByRole('combobox')).toHaveValue('de')
    expect(document.documentElement.lang).toBe('de')
    expect((await repository.loadState())?.cues).toEqual(initial.cues)
    app.unmount()
    render(() => <App services={testServices(repository)} />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Einstellungen' }),
    )
    expect(screen.getByRole('combobox')).toHaveValue('de')
    expect((await repository.loadState())?.cues).toEqual(initial.cues)
  })
})
