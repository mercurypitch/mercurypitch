import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notifications, setNotifications } from '@/stores/notifications-store'
import { UvrUploadControl } from '../UvrUploadControl'

vi.mock('../icons', () => ({
  FileUpload: () => <span data-testid="file-upload-icon">FileUpload</span>,
  MusicNote: () => <span data-testid="music-note-icon">MusicNote</span>,
}))

function file(name: string, type = 'audio/mpeg', size?: number): File {
  const result = new File(['audio'], name, { type })
  if (size !== undefined) Object.defineProperty(result, 'size', { value: size })
  return result
}

function selectFiles(files: File[]) {
  const input = document.getElementById('uvr-file-input') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  fireEvent.change(input)
}

describe('UvrUploadControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setNotifications([])
  })

  it('presents a multi-song drop zone and concrete format limits', () => {
    render(() => <UvrUploadControl />)
    expect(screen.getByText('Add songs to your setlist')).toBeInTheDocument()
    expect(screen.getByText(/Drop MP3, WAV or FLAC/i)).toBeInTheDocument()
    expect(screen.getByText(/Up to 15 at once/i)).toBeInTheDocument()
    expect(screen.getByText('MP3')).toBeInTheDocument()
    expect(screen.getByText('WAV')).toBeInTheDocument()
    expect(screen.getByText('FLAC')).toBeInTheDocument()

    const input = document.getElementById('uvr-file-input') as HTMLInputElement
    expect(input.multiple).toBe(true)
  })

  it('passes every valid selected song in its original order', () => {
    const onFilesSelect = vi.fn()
    render(() => <UvrUploadControl onFilesSelect={onFilesSelect} />)
    const files = [
      file('one.mp3'),
      file('two.wav', 'audio/wav'),
      file('three.flac', 'audio/flac'),
    ]
    selectFiles(files)
    expect(onFilesSelect).toHaveBeenCalledWith(files)
  })

  it('accepts multiple dropped songs and keeps the drag affordance stable', async () => {
    const onFilesSelect = vi.fn()
    render(() => <UvrUploadControl onFilesSelect={onFilesSelect} />)
    const zone = document.querySelector('.upload-zone') as HTMLElement
    const files = [file('one.mp3'), file('two.wav', 'audio/wav')]

    zone.dispatchEvent(
      new Event('dragover', { bubbles: true, cancelable: true }),
    )
    await vi.waitFor(() => expect(zone).toHaveClass('dragging'))
    fireEvent.drop(zone, {
      dataTransfer: { files },
      preventDefault: vi.fn(),
    } as unknown as DragEvent)

    expect(zone).not.toHaveClass('dragging')
    expect(onFilesSelect).toHaveBeenCalledWith(files)
  })

  it('accepts valid songs while aggregating oversized and unsupported files', () => {
    const onFilesSelect = vi.fn()
    render(() => (
      <UvrUploadControl
        onFilesSelect={onFilesSelect}
        maxSize={7 * 1024 * 1024}
        maxSizeNote="Cloud GPU upload limit — for larger files use Browser mode"
      />
    ))
    const valid = file('good.mp3')
    selectFiles([
      valid,
      file('large.wav', 'audio/wav', 8 * 1024 * 1024),
      file('notes.pdf', 'application/pdf'),
    ])

    expect(onFilesSelect).toHaveBeenCalledWith([valid])
    expect(
      notifications().some((item) => item.message.includes('over the 7 MB')),
    ).toBe(true)
    expect(
      notifications().some((item) => item.message.includes('unsupported file')),
    ).toBe(true)
  })

  it('routes ZIP drops to session import instead of the audio queue', () => {
    const onFilesSelect = vi.fn()
    const onImportZips = vi.fn()
    render(() => (
      <UvrUploadControl
        onFilesSelect={onFilesSelect}
        onImportZips={onImportZips}
      />
    ))
    const archive = file('sessions.zip', 'application/zip')
    const zone = document.querySelector('.upload-zone') as HTMLElement
    fireEvent.drop(zone, {
      dataTransfer: { files: [archive] },
      preventDefault: vi.fn(),
    } as unknown as DragEvent)

    expect(onImportZips).toHaveBeenCalledWith([archive])
    expect(onFilesSelect).not.toHaveBeenCalled()
  })

  it('splits a mixed drop between the session importer and audio queue', () => {
    const onFilesSelect = vi.fn()
    const onImportZips = vi.fn()
    render(() => (
      <UvrUploadControl
        onFilesSelect={onFilesSelect}
        onImportZips={onImportZips}
      />
    ))
    const archive = file('sessions.zip', 'application/zip')
    const song = file('song.wav', 'audio/wav')
    const zone = document.querySelector('.upload-zone') as HTMLElement

    fireEvent.drop(zone, {
      dataTransfer: { files: [archive, song] },
      preventDefault: vi.fn(),
    } as unknown as DragEvent)

    expect(onImportZips).toHaveBeenCalledWith([archive])
    expect(onFilesSelect).toHaveBeenCalledWith([song])
  })

  it('exposes the selected mode limit and accepted types', () => {
    render(() => (
      <UvrUploadControl
        maxSize={50 * 1024 * 1024}
        maxSizeNote="Cloud GPU limit"
        allowedTypes={['audio/aac', '.aac']}
      />
    ))
    const input = document.getElementById('uvr-file-input') as HTMLInputElement
    expect(input.accept).toBe('audio/aac,.aac')
    const limit = screen.getByTestId('uvr-max-size-pill')
    expect(limit).toHaveTextContent('50 MB')
    expect(limit).toHaveAttribute('title', 'Cloud GPU limit')
  })
})
