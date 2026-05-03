// ============================================================
// UVR Upload Control Component Tests
// ============================================================

import { fireEvent,render, screen } from '@solidjs/testing-library'
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest'
import { UvrUploadControl } from '../UvrUploadControl'

// Mock icons
vi.mock('../icons', () => ({
  FileUpload: () => <span data-testid="file-upload-icon">FileUpload</span>,
  MusicNote: () => <span data-testid="music-note-icon">MusicNote</span>,
}))

describe('UvrUploadControl Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createMockFile = (
    name: string,
    size: number,
    type: string = 'text/plain',
  ): File => {
    const blob = new Blob(['x'.repeat(size)], { type })
    return new File([blob], name, { type })
  }

  const defaultProps = {
    onFileSelect: vi.fn(),
    onProcessStart: vi.fn(),
    processing: false,
    isDragging: false,
  }

  describe('Initial Rendering', () => {
    it('renders upload header with icon and title', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      expect(screen.getByText('Import Audio File')).toBeInTheDocument()
      expect(screen.getByTestId('music-note-icon')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Upload MP3 or WAV files to separate vocals and create MIDI',
        ),
      ).toBeInTheDocument()
    })

    it('renders upload zone with drop instruction', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      expect(
        screen.getByText(/Drag & drop your file here/i),
      ).toBeInTheDocument()
      expect(screen.getByText(/browse/i)).toBeInTheDocument()
    })

    it('displays supported formats', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      expect(screen.getByText('Supported formats:')).toBeInTheDocument()
      expect(screen.getByText('MP3')).toBeInTheDocument()
      expect(screen.getByText('WAV')).toBeInTheDocument()
      expect(screen.getByText('FLAC')).toBeInTheDocument()
    })

    it('shows file upload icon in empty state', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      expect(screen.getByTestId('file-upload-icon')).toBeInTheDocument()
    })
  })

  describe('File Validation', () => {
    it('calls onFileSelect with valid file', () => {
      const testFile = createMockFile('test.mp3', 1024, 'audio/mpeg')
      render(() => <UvrUploadControl {...defaultProps} />)

      const fileInput = document.getElementById(
        'uvr-file-input',
      ) as HTMLInputElement | null
      if (fileInput) {
        const mockEvent = new Event('change')
        Object.defineProperty(mockEvent, 'target', {
          writable: false,
          value: { files: [testFile] },
        })
        fireEvent(fileInput, mockEvent)
      }

      expect(defaultProps.onFileSelect).toHaveBeenCalledWith(testFile)
    })

    it('shows error for file larger than 100MB', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const largeFile = createMockFile(
        'large.mp3',
        100 * 1024 * 1024,
        'audio/mpeg',
      )
      defaultProps.onFileSelect(largeFile)

      expect(screen.getByText(/File too large/i)).toBeInTheDocument()
      expect(screen.getByText(/100 MB/i)).toBeInTheDocument()
    })

    it('shows error for invalid file type', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const invalidFile = createMockFile('test.pdf', 1024, 'application/pdf')
      defaultProps.onFileSelect(invalidFile)

      expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Please upload MP3 or WAV files/i),
      ).toBeInTheDocument()
    })
  })

  describe('Drag and Drop', () => {
    it('highlights zone when dragging over', async () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const uploadZone = screen.getByText(/Drag & drop/i)
      fireEvent.dragEnter(uploadZone)

      expect(uploadZone).toHaveClass('dragging')
    })

    it('clears highlight when leaving zone', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const uploadZone = screen.getByText(/Drag & drop/i)
      fireEvent.dragEnter(uploadZone)
      fireEvent.dragLeave(uploadZone)

      expect(uploadZone).not.toHaveClass('dragging')
    })

    it('calls onFileSelect with dropped file', () => {
      const testFile = new File(['test'], 'test.wav', { type: 'audio/wav' })
      render(() => <UvrUploadControl {...defaultProps} />)

      const uploadZone = screen.getByText(/Drag & drop/i)
      const mockEvent = {
        dataTransfer: { files: [testFile] },
        preventDefault: vi.fn(),
      }

      fireEvent.drop(uploadZone, mockEvent as unknown as DragEvent)

      expect(defaultProps.onFileSelect).toHaveBeenCalledWith(testFile)
    })
  })

  describe('File Selection', () => {
    it('opens file input when browse is clicked', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const browseLink = screen.getByText('browse')
      fireEvent.click(browseLink)

      const fileInput = document.getElementById(
        'uvr-file-input',
      ) as HTMLInputElement | null
      expect(fileInput).toHaveProperty('click')
    })

    it('shows file info after selection', () => {
      const testFile = createMockFile('song.mp3', 1024 * 5000, 'audio/mpeg')

      render(() => <UvrUploadControl {...defaultProps} />)

      const fileInput = document.getElementById(
        'uvr-file-input',
      ) as HTMLInputElement | null
      if (fileInput) {
        const mockEvent = new Event('change')
        Object.defineProperty(mockEvent, 'target', {
          writable: false,
          value: { files: [testFile] },
        })
        fireEvent(fileInput, mockEvent)
      }

      expect(screen.getByText('song.mp3')).toBeInTheDocument()
      expect(screen.getByText(/5000 KB/i)).toBeInTheDocument()
    })

    it('shows processing indicator when processing', () => {
      render(() => <UvrUploadControl {...defaultProps} processing={true} />)

      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })
  })

  describe('Clear File', () => {
    it('clears selected file when change button clicked', () => {
      const testFile = createMockFile('song.mp3', 1024 * 5000, 'audio/mpeg')

      render(() => <UvrUploadControl {...defaultProps} />)

      const fileInput = document.getElementById(
        'uvr-file-input',
      ) as HTMLInputElement | null
      if (fileInput) {
        const mockEvent = new Event('change')
        Object.defineProperty(mockEvent, 'target', {
          writable: false,
          value: { files: [testFile] },
        })
        fireEvent(fileInput, mockEvent)
      }

      expect(screen.getByText('song.mp3')).toBeInTheDocument()

      const changeButton = screen.getByText('Change File')
      fireEvent.click(changeButton)

      expect(screen.queryByText('song.mp3')).not.toBeInTheDocument()
    })
  })

  describe('Process Button', () => {
    it('calls onProcessStart when clicked', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const processButton = screen.getByText('Process with UVR')
      fireEvent.click(processButton)

      expect(defaultProps.onProcessStart).toHaveBeenCalled()
    })

    it('is disabled when no file selected', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const processButton = screen.getByText('Process with UVR')
      expect(processButton).toBeDisabled()
    })

    it('is disabled when processing', () => {
      render(() => <UvrUploadControl {...defaultProps} processing={true} />)

      const processButton = screen.getByText('Process with UVR')
      expect(processButton).toBeDisabled()
    })

    it('is enabled when file is selected and not processing', () => {
      const testFile = createMockFile('song.mp3', 1024 * 5000, 'audio/mpeg')

      render(() => <UvrUploadControl {...defaultProps} />)

      const fileInput = document.getElementById(
        'uvr-file-input',
      ) as HTMLInputElement | null
      if (fileInput) {
        const mockEvent = new Event('change')
        Object.defineProperty(mockEvent, 'target', {
          writable: false,
          value: { files: [testFile] },
        })
        fireEvent(fileInput, mockEvent)
      }

      const processButton = screen.getByText('Process with UVR')
      expect(processButton).not.toBeDisabled()
    })
  })

  describe('File Size Formatting', () => {
    it('formats small files in Bytes', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const testFile = createMockFile('small.txt', 1024, 'text/plain')
      if (defaultProps.onFileSelect) {
        defaultProps.onFileSelect(testFile)
      }

      expect(screen.getByText(/Bytes/i)).toBeInTheDocument()
    })

    it('formats medium files in KB', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const testFile = createMockFile('medium.mp3', 1024 * 500, 'audio/mpeg') // 500 KB
      if (defaultProps.onFileSelect) {
        defaultProps.onFileSelect(testFile)
      }

      expect(screen.getByText(/KB/i)).toBeInTheDocument()
    })

    it('formats large files in MB', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const testFile = createMockFile(
        'large.mp3',
        1024 * 1024 * 50,
        'audio/mpeg',
      )
      if (defaultProps.onFileSelect) {
        defaultProps.onFileSelect(testFile)
      }

      expect(screen.getByText(/MB/i)).toBeInTheDocument()
    })
  })

  describe('Processing Props', () => {
    it('passes maxSize prop', () => {
      render(() => (
        <UvrUploadControl {...defaultProps} maxSize={50 * 1024 * 1024} />
      ))

      expect(screen.getByText(/50 MB/i)).toBeInTheDocument()
    })

    it('passes allowedTypes prop', () => {
      render(() => (
        <UvrUploadControl
          {...defaultProps}
          allowedTypes={['audio/aac', 'audio/ogg']}
        />
      ))

      expect(screen.getByText('Supported formats:')).toBeInTheDocument()
    })
  })
})
