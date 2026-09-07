// Guitar Night amp-control tests protect progressive disclosure and explicit monitoring.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { ComponentProps } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadGuitarAmpCabinet, retryGuitarAmpCabinet, } from '@/lib/guitar/guitar-amp-cabinet'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import { GUITAR_NIGHT_AMP_PRESETS, GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY, } from './guitar-amp-settings'
import { GuitarNightAmpControls } from './GuitarNightAmpControls'
import { useGuitarNightAmpSettings } from './useGuitarNightAmpSettings'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  retryGuitarAmpCabinet()
  vi.restoreAllMocks()
  localStorage.clear()
})

function renderStudioControls() {
  return render(() => {
    const amp = useGuitarNightAmpSettings()
    return (
      <GuitarNightAmpControls
        parameters={amp.parameters}
        presetId={() => amp.settings().presetId}
        inputProfile={() => 'microphone'}
        canMonitor={() => false}
        monitoringEnabled={() => false}
        monitoringActive={() => false}
        onEnabled={amp.setEnabled}
        onPreset={amp.selectPreset}
        onParameter={amp.setContinuousParameter}
        onParameterCommit={amp.persist}
        onCabinet={amp.setCabinet}
        onMonitor={() => undefined}
        onReset={amp.reset}
      />
    )
  })
}

function renderMonitorControls(
  overrides: Partial<ComponentProps<typeof GuitarNightAmpControls>>,
) {
  return render(() => (
    <GuitarNightAmpControls
      parameters={() => DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS}
      presetId={() => 'lead'}
      inputProfile={() => 'interface'}
      canMonitor={() => false}
      monitoringEnabled={() => false}
      monitoringActive={() => false}
      onEnabled={() => undefined}
      onPreset={() => undefined}
      onParameter={() => undefined}
      onParameterCommit={() => undefined}
      onCabinet={() => undefined}
      onMonitor={() => undefined}
      onReset={() => undefined}
      {...overrides}
    />
  ))
}

describe('GuitarNightAmpControls', () => {
  it('explicitly starts Direct Listening and monitoring without leaving Session', async () => {
    const [ready, setReady] = createSignal(false)
    const start = vi.fn(async () => {
      setReady(true)
      return true
    })
    const monitor = vi.fn()
    renderMonitorControls({
      canMonitor: ready,
      listeningStatus: () => 'off',
      onStartListening: start,
      onMonitor: monitor,
    })
    expect(start).not.toHaveBeenCalled()
    const button = screen.getByRole('button', {
      name: 'Start Listening and monitoring',
    })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Monitoring off')).toBeInTheDocument()

    fireEvent.click(button)
    await Promise.resolve()
    await Promise.resolve()

    expect(start).toHaveBeenCalledOnce()
    expect(monitor).toHaveBeenCalledWith(true)
  })

  it.each(['denied', 'changed', 'unmounted'] as const)(
    'does not enable a %s monitoring request after async Listening',
    async (outcome) => {
      let finish!: (result: boolean) => void
      const start = vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            finish = resolve
          }),
      )
      const monitor = vi.fn()
      const [profile, setProfile] = createSignal<'interface' | 'microphone'>(
        'interface',
      )
      const [ready, setReady] = createSignal(false)
      const view = renderMonitorControls({
        inputProfile: profile,
        canMonitor: ready,
        listeningStatus: () => 'off',
        onStartListening: start,
        onMonitor: monitor,
      })
      fireEvent.click(
        screen.getByRole('button', { name: 'Start Listening and monitoring' }),
      )
      if (outcome === 'changed') setProfile('microphone')
      if (outcome === 'unmounted') view.unmount()
      setReady(true)

      finish(outcome !== 'denied')
      await Promise.resolve()
      await Promise.resolve()

      expect(monitor).not.toHaveBeenCalled()
    },
  )

  it('exposes the selected mono input without changing it on mount', () => {
    const change = vi.fn()
    renderMonitorControls({
      canMonitor: () => true,
      monitorInputChannel: () => 0,
      monitorInputChannelCount: () => 2,
      onMonitorInputChannel: change,
    })
    const select = screen.getByRole('combobox', {
      name: 'Monitor input channel',
    })
    expect(select).toHaveValue('0')
    expect(change).not.toHaveBeenCalled()
    fireEvent.change(select, { target: { value: '1' } })
    expect(change).toHaveBeenCalledWith(1)
  })
  it('selects the Studio Lead head without starting audio or showing Definition-only controls', () => {
    const audio = vi.spyOn(globalThis, 'AudioContext')
    const fetch = vi.spyOn(globalThis, 'fetch')
    renderStudioControls()

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Guitar amp preset' }),
      {
        target: { value: 'lead' },
      },
    )

    expect(screen.getByText('Studio · Lead head')).toBeInTheDocument()
    expect(
      screen.queryByRole('slider', { name: 'Guitar amp character' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Guitar cabinet voicing' }),
    ).not.toBeInTheDocument()
    expect(
      JSON.parse(
        localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY) ?? '{}',
      ),
    ).toMatchObject({
      presetId: 'lead',
      engine: 'studio',
      head: 'lead',
    })
    expect(audio).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps preset, bypass, and Drive immediate while deferring tone controls', () => {
    const choosePreset = vi.fn()
    const setEnabled = vi.fn()
    const setParameter = vi.fn()
    const commit = vi.fn()

    render(() => (
      <GuitarNightAmpControls
        parameters={() => DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS}
        presetId={() => 'edge'}
        inputProfile={() => 'microphone'}
        canMonitor={() => false}
        monitoringEnabled={() => false}
        monitoringActive={() => false}
        onEnabled={setEnabled}
        onPreset={choosePreset}
        onParameter={setParameter}
        onParameterCommit={commit}
        onCabinet={() => undefined}
        onMonitor={() => undefined}
        onReset={() => undefined}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Bypass guitar amp' }))
    expect(setEnabled).toHaveBeenCalledWith(false)

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Guitar amp preset' }),
      {
        target: { value: 'lead' },
      },
    )
    expect(choosePreset).toHaveBeenCalledWith('lead')
    expect(screen.getByRole('option', { name: 'Custom' })).toBeDisabled()

    const drive = screen.getByRole('slider', { name: 'Guitar amp drive' })
    fireEvent.input(drive, { target: { value: '0.72' } })
    fireEvent.change(drive, { target: { value: '0.72' } })
    expect(setParameter).toHaveBeenCalledWith('drive', 0.72, false)
    expect(commit).toHaveBeenCalledOnce()

    const toneDisclosure = screen
      .getByText('Shape tone & cabinet')
      .closest('details')
    expect(toneDisclosure).not.toHaveAttribute('open')
    fireEvent.click(screen.getByText('Shape tone & cabinet'))
    expect(toneDisclosure).toHaveAttribute('open')
    expect(
      screen.getByRole('slider', { name: 'Guitar amp bass' }),
    ).toHaveAttribute('min', '-1')
    expect(
      screen.getByRole('slider', { name: 'Guitar amp output' }),
    ).toHaveAttribute('aria-valuetext', '-3 dB')
  })

  it('explains the safe Direct-input monitor and never enables it implicitly', () => {
    const [enabled, setEnabled] = createSignal(false)
    const [profile, setProfile] = createSignal<'microphone' | 'interface'>(
      'microphone',
    )
    const monitor = vi.fn((next: boolean) => setEnabled(next))

    render(() => (
      <GuitarNightAmpControls
        parameters={() => DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS}
        presetId={() => 'edge'}
        inputProfile={profile}
        canMonitor={() => profile() === 'interface'}
        monitoringEnabled={enabled}
        monitoringActive={enabled}
        onEnabled={() => undefined}
        onPreset={() => undefined}
        onParameter={() => undefined}
        onParameterCommit={() => undefined}
        onCabinet={() => undefined}
        onMonitor={monitor}
        onReset={() => undefined}
      />
    ))

    expect(
      screen.getByRole('button', { name: /Turn monitoring on/i }),
    ).toBeDisabled()
    expect(
      screen.getByText(
        'Choose Direct input to hear your guitar through this amp.',
      ),
    ).toBeInTheDocument()
    expect(monitor).not.toHaveBeenCalled()

    setProfile('interface')

    const monitorButton = screen.getByRole('button', {
      name: /Turn monitoring on/i,
    })
    expect(monitorButton).toHaveAccessibleDescription(
      'Browser latency applies. Saved takes stay dry.',
    )
    fireEvent.click(monitorButton)
    expect(monitor).toHaveBeenCalledWith(true)
    expect(
      screen.getByText(
        'Your guitar plays through the amp. Browser latency applies. Saved takes stay dry.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Headphones recommended/)).not.toBeInTheDocument()
  })

  it('uses the shared preset catalogue and discloses the same IR rather than offering a fake cabinet choice', () => {
    const audio = vi.spyOn(globalThis, 'AudioContext')
    const fetch = vi.spyOn(globalThis, 'fetch')

    renderStudioControls()

    expect(
      screen.getByRole('combobox', { name: 'Guitar amp preset' }),
    ).toHaveValue('tight')
    for (const preset of GUITAR_NIGHT_AMP_PRESETS) {
      expect(screen.getByRole('option', { name: preset.label })).toHaveValue(
        preset.id,
      )
    }
    expect(screen.getByText('Studio · Definition head')).toBeInTheDocument()
    expect(
      screen.getByText('Cabinet IR · Jester Cookie Monster'),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Cabinet loads when you play an electric part or monitor Direct input.',
    )
    expect(
      screen.queryByRole('combobox', { name: 'Guitar cabinet voicing' }),
    ).not.toBeInTheDocument()
    expect(audio).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(
      localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY),
    ).toBeNull()
  })

  it('keeps the Character slider mounted as a live preview becomes Custom and commits on release', () => {
    renderStudioControls()
    const character = screen.getByRole('slider', {
      name: 'Guitar amp character',
    })
    expect(character).toHaveAttribute('aria-valuetext', 'Tight')

    fireEvent.input(character, { target: { value: '0.38' } })

    expect(screen.getByRole('slider', { name: 'Guitar amp character' })).toBe(
      character,
    )
    expect(character).toHaveValue('0.38')
    expect(character).toHaveAttribute('aria-valuetext', '38% toward Tight')
    expect(
      screen.getByRole('combobox', { name: 'Guitar amp preset' }),
    ).toHaveValue('custom')
    expect(screen.getByText('Studio · Definition head')).toBeInTheDocument()
    expect(
      localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY),
    ).toBeNull()
    fireEvent.change(character)
    expect(
      JSON.parse(
        localStorage.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY) ?? '{}',
      ),
    ).toMatchObject({
      presetId: 'custom',
      character: 0.38,
      engine: 'studio',
      head: 'definition',
    })
  })

  it('names the Heavy head even after a manual adjustment and leaves bypass in place', () => {
    renderStudioControls()
    fireEvent.click(screen.getByRole('button', { name: 'Bypass guitar amp' }))

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Guitar amp preset' }),
      { target: { value: 'heavy' } },
    )
    fireEvent.input(screen.getByRole('slider', { name: 'Guitar amp drive' }), {
      target: { value: '0.65' },
    })

    expect(
      screen.getByRole('combobox', { name: 'Guitar amp preset' }),
    ).toHaveValue('custom')
    expect(screen.getByText('Studio · Heavy head')).toBeInTheDocument()
    expect(
      screen.queryByRole('slider', { name: 'Guitar amp character' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Turn guitar amp on' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows Studio output in relative dB and restores Lite voicing controls when a Lite preset is chosen', () => {
    renderStudioControls()
    fireEvent.click(screen.getByText('Shape tone & cabinet'))
    expect(
      screen.getByRole('slider', { name: 'Guitar amp output' }),
    ).toHaveAttribute('aria-valuetext', '0 dB')

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Guitar amp preset' }),
      { target: { value: 'edge' } },
    )

    expect(
      screen.getByRole('slider', { name: 'Guitar amp output' }),
    ).toHaveAttribute('aria-valuetext', '-3 dB')
    expect(
      screen.getByRole('combobox', { name: 'Guitar cabinet voicing' }),
    ).toHaveValue('balanced')
    expect(
      screen.queryByRole('slider', { name: 'Guitar amp character' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Cabinet IR · Jester Cookie Monster'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Lite amp · Filtered cabinet')).toBeInTheDocument()
  })

  it('reports a real cabinet request failure and offers an explicit retry without starting audio', async () => {
    let rejectRequest: (error: Error) => void = () => undefined
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectRequest = reject
        }),
    )
    const audio = vi.spyOn(globalThis, 'AudioContext')
    renderStudioControls()
    const request = loadGuitarAmpCabinet({
      sampleRate: 48_000,
    } as BaseAudioContext)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading cabinet. Lite tone is used until it is ready.',
    )

    rejectRequest(new Error('Offline'))
    await expect(request).rejects.toThrow('Offline')

    expect(screen.getByRole('status')).toHaveTextContent(
      'Studio tone unavailable. Using Lite tone; try loading it again.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry Studio tone' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Cabinet loads when you play an electric part or monitor Direct input.',
    )
    expect(fetch).toHaveBeenCalledOnce()
    expect(audio).not.toHaveBeenCalled()
  })
})
