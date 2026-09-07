// ============================================================
// Monitor latency UI tests — partial estimates never become a measured total
// ============================================================
import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AudioRouteDiagnosticsSnapshot } from '@/lib/audio-route-diagnostics'
import { createAudioRouteDiagnosticsReader } from '@/lib/audio-route-diagnostics'
import { GuitarNightMonitorLatency } from './GuitarNightMonitorLatency'

function snapshot(): AudioRouteDiagnosticsSnapshot {
  const context = {
    state: 'running',
    sampleRate: 48000,
    baseLatency: 0.003,
    outputLatency: 0.018,
    sinkId: 'private-output',
    playbackStats: {
      averageLatency: 0.019,
      minimumLatency: 0.017,
      maximumLatency: 0.025,
      totalDuration: 60,
      underrunEvents: 2,
      underrunDuration: 0.006,
    },
  } as unknown as AudioContext
  const track = {
    readyState: 'live',
    muted: false,
    getSettings: () => ({
      deviceId: 'private-input',
      groupId: 'private-group',
      sampleRate: 48000,
      channelCount: 2,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }),
    getConstraints: () => ({
      deviceId: { exact: 'private-input' },
      echoCancellation: false,
    }),
  } as unknown as MediaStreamTrack
  return createAudioRouteDiagnosticsReader({
    context,
    track,
    requestedDeviceId: 'private-input',
  })(0)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('GuitarNightMonitorLatency', () => {
  it('names the selected mono channel without claiming a multichannel monitor mix', () => {
    const data = snapshot()
    data.capture.monitorChannelMode = 'selected-mono'
    data.capture.monitorInputChannel = 1
    render(() => (
      <GuitarNightMonitorLatency snapshot={data} monitoring={true} />
    ))
    fireEvent.click(screen.getByText('Monitoring latency'))
    expect(
      screen.getByText(/Monitoring uses Input 2, mono and centered/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/browser's channel mix/)).not.toBeInTheDocument()
    expect(screen.getByText(/saved takes stay dry/)).toBeInTheDocument()
  })

  it('opens without activating audio and explains why no physical measurement is available', () => {
    const audio = vi.spyOn(globalThis, 'AudioContext')
    const fetch = vi.spyOn(globalThis, 'fetch')
    render(() => (
      <GuitarNightMonitorLatency snapshot={null} monitoring={false} />
    ))
    const summary = screen.getByText('Monitoring latency')

    fireEvent.click(summary)

    expect(summary.closest('details')).toHaveAttribute('open')
    expect(screen.getByText('Monitoring off')).toBeInTheDocument()
    expect(screen.getByText('Round trip not measured')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Choose Room mic or Direct input, then turn on Listening/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Download report' }),
    ).toBeDisabled()
    expect(audio).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(
      screen.getByText(/browser and system audio buffer settings/),
    ).toBeInTheDocument()
    expect(screen.getByText(/clicks or dropouts/)).toBeInTheDocument()
  })

  it('keeps unavailable capture latency separate from real output estimates without adding a total', () => {
    render(() => (
      <GuitarNightMonitorLatency snapshot={snapshot()} monitoring={true} />
    ))

    fireEvent.click(screen.getByText('Monitoring latency'))

    expect(screen.getByText('Output estimate 18 ms')).toBeInTheDocument()
    const inputRow = screen.getByText('Input estimate').parentElement!
    expect(within(inputRow).getByText('Unavailable')).toBeInTheDocument()
    expect(screen.getByText('3 ms')).toBeInTheDocument()
    expect(screen.getByText('18 ms')).toBeInTheDocument()
    expect(screen.queryByText('21 ms')).not.toBeInTheDocument()
    expect(screen.getByText('2 over 60 s')).toBeInTheDocument()
    expect(
      screen.getByText(/Underruns cover this audio context's playback history/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/strongest channel used for pitch/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Scoring calibration does not make monitoring faster/),
    ).toBeInTheDocument()
  })

  it('retains the open disclosure across readings and stops presenting stale values after capture ends', () => {
    const [current, setCurrent] =
      createSignal<AudioRouteDiagnosticsSnapshot | null>(snapshot())
    render(() => (
      <GuitarNightMonitorLatency snapshot={current()} monitoring={true} />
    ))
    fireEvent.click(screen.getByText('Monitoring latency'))
    const details = screen.getByText('Monitoring latency').closest('details')

    setCurrent({
      ...snapshot(),
      context: { ...snapshot().context, state: 'suspended' },
    })

    expect(screen.getByText('Audio paused')).toBeInTheDocument()
    expect(details).toHaveAttribute('open')
    setCurrent(null)
    expect(screen.queryByText('18 ms')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Download report' }),
    ).toBeDisabled()
    expect(details).toHaveAttribute('open')
  })

  it('keeps a browser-reported zero distinct from unsupported output latency', () => {
    const data = snapshot()
    data.context.outputLatencySeconds = 0
    data.playback.supported = false
    data.playback.underrunCount = null
    render(() => (
      <GuitarNightMonitorLatency snapshot={data} monitoring={true} />
    ))

    fireEvent.click(screen.getByText('Monitoring latency'))

    expect(screen.getByText('Output estimate 0 ms')).toBeInTheDocument()
    expect(screen.getByText('Round trip not measured')).toBeInTheDocument()
    expect(
      screen.queryByText(/Playback estimate: average/),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByText('Playback underruns').parentElement!).getByText(
        'Unavailable',
      ),
    ).toBeInTheDocument()
  })

  it.each([
    ['interrupted', 'Audio interrupted'],
    ['closed', 'Audio closed'],
    ['unavailable', 'Audio state unavailable'],
  ] as const)(
    'names a %s context without calling it paused',
    (state, label) => {
      const data = snapshot()
      data.context.state = state
      render(() => (
        <GuitarNightMonitorLatency snapshot={data} monitoring={true} />
      ))
      expect(screen.getByText(label)).toBeInTheDocument()
      expect(screen.queryByText('Audio paused')).not.toBeInTheDocument()
    },
  )

  it.each([
    ['ended', false, 'Input ended'],
    ['unavailable', false, 'Input unavailable'],
    ['live', true, 'Input muted'],
  ] as const)(
    'names %s/muted=%s capture before output estimates',
    (state, muted, label) => {
      const data = snapshot()
      data.capture.trackState = state
      data.capture.muted = muted
      render(() => (
        <GuitarNightMonitorLatency snapshot={data} monitoring={true} />
      ))
      expect(screen.getByText(label)).toBeInTheDocument()
      expect(
        screen.queryByText('Output estimate 18 ms'),
      ).not.toBeInTheDocument()
    },
  )

  it('gives repeated downloads distinct dated UTC filenames even within the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 8, 7, 14, 35, 15, 457))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dated-report')
    const downloads: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download)
    })
    render(() => <GuitarNightMonitorLatency snapshot={snapshot()} monitoring />)
    fireEvent.click(screen.getByText('Monitoring latency'))
    const download = screen.getByRole('button', { name: 'Download report' })
    fireEvent.click(download)
    fireEvent.click(download)
    expect(downloads).toEqual([
      'guitar-monitor-diagnostics_2026-09-07T14-35-15-457Z.json',
      'guitar-monitor-diagnostics_2026-09-07T14-35-15-458Z.json',
    ])
  })

  it('downloads only redacted readings and releases its object URL on unmount', async () => {
    const createUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:diagnostics')
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL')
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const view = render(() => (
      <GuitarNightMonitorLatency snapshot={snapshot()} monitoring={true} />
    ))
    fireEvent.click(screen.getByText('Monitoring latency'))

    fireEvent.click(screen.getByRole('button', { name: 'Download report' }))

    const blob = createUrl.mock.calls[0]![0] as Blob
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsText(blob)
    })
    expect(JSON.parse(text)).toMatchObject({
      schemaVersion: 1,
      monitoring: true,
      physicalRoundTripMeasured: false,
    })
    expect(text).not.toMatch(/private-input|private-output|private-group/)
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download]')).toBeNull()
    view.unmount()
    expect(revokeUrl).toHaveBeenCalledWith('blob:diagnostics')
  })
})
