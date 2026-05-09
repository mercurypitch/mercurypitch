// ============================================================
// UVR Upload Control Component Tests
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  /** Create a mock file without allocating real content for large sizes */
  const createMockFileCheap = (
    name: string,
    size: number,
    type: string = 'audio/mpeg',
  ): File => {
    const file = new File(['x'], name, { type })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  const defaultProps = {
    onFileSelect: vi.fn(),
    onProcessStart: vi.fn(),
    processing: false,
    isDragging: false,
  }

  /** Simulate file selection via the hidden input element */
  const selectFileViaInput = (file: File) => {
    const fileInput = document.getElementById(
      'uvr-file-input',
    ) as HTMLInputElement | null
    if (!fileInput) return

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    })
    fireEvent.input(fileInput)
    fireEvent.change(fileInput)
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

      selectFileViaInput(testFile)

      expect(defaultProps.onFileSelect).toHaveBeenCalledWith(testFile)
    })

    it('shows alert for file larger than 100MB', () => {
      vi.spyOn(window, 'alert').mockImplementation(() => {})
      render(() => <UvrUploadControl {...defaultProps} />)

      // Use cheap file to avoid allocating 100MB+ in memory
      const largeFile = createMockFileCheap('large.mp3', 101 * 1024 * 1024)
      selectFileViaInput(largeFile)

      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('File too large'),
      )
    })

    it('shows alert for invalid file type', () => {
      vi.spyOn(window, 'alert').mockImplementation(() => {})
      render(() => <UvrUploadControl {...defaultProps} />)

      const invalidFile = createMockFile('test.pdf', 1024, 'application/pdf')
      selectFileViaInput(invalidFile)

      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Invalid file type'),
      )
    })
  })

  describe('Drag and Drop', () => {
    it('highlights zone when dragging over', async () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const uploadZone = document.querySelector('.upload-zone') as HTMLElement
      expect(uploadZone).toBeTruthy()
      fireEvent.dragEnter(uploadZone)

      expect(uploadZone).toHaveClass('dragging')
    })

    it('clears highlight when leaving zone', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      const uploadZone = document.querySelector('.upload-zone') as HTMLElement
      expect(uploadZone).toBeTruthy()
      fireEvent.dragEnter(uploadZone)
      fireEvent.dragLeave(uploadZone)

      expect(uploadZone).not.toHaveClass('dragging')
    })

    it('calls onFileSelect with dropped file', () => {
      const testFile = new File(['test'], 'test.wav', { type: 'audio/wav' })
      render(() => <UvrUploadControl {...defaultProps} />)

      const uploadZone = document.querySelector('.upload-zone') as HTMLElement
      expect(uploadZone).toBeTruthy()

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
      expect(fileInput).toBeTruthy()
    })

    it('shows file info after selection', () => {
      const testFile = createMockFile('song.mp3', 1024 * 5000, 'audio/mpeg')

      render(() => <UvrUploadControl {...defaultProps} />)

      selectFileViaInput(testFile)

      expect(screen.getByText('song.mp3')).toBeInTheDocument()
      expect(screen.getByText(/4.88 MB/)).toBeInTheDocument()
    })

    it('shows processing indicator when file selected and processing', () => {
      const testFile = createMockFile('song.mp3', 1024 * 5000, 'audio/mpeg')

      render(() => <UvrUploadControl {...defaultProps} processing={true} />)
      selectFileViaInput(testFile)

      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })
  })

  describe('Clear File', () => {
    it('clears selected file when change button clicked', () => {
      const testFile = createMockFile('song.mp3', 1024 * 5000, 'audio/mpeg')

      render(() => <UvrUploadControl {...defaultProps} />)

      selectFileViaInput(testFile)

      expect(screen.getByText('song.mp3')).toBeInTheDocument()

      const changeButton = screen.getByText('Change File')
      fireEvent.click(changeButton)

      expect(screen.queryByText('song.mp3')).not.toBeInTheDocument()
    })
  })

  describe('Process Button', () => {
    it('calls onProcessStart when clicked', () => {
      const testFile = createMockFile('song.mp3', 1024 * 5000, 'audio/mpeg')

      render(() => <UvrUploadControl {...defaultProps} />)
      selectFileViaInput(testFile)

      const processButton = screen.getByText('Process with UVR')
      fireEvent.click(processButton)

      expect(defaultProps.onProcessStart).toHaveBeenCalled()
    })

    it('is not visible when no file selected', () => {
      render(() => <UvrUploadControl {...defaultProps} />)

      // Button only renders after a file is selected
      expect(screen.queryByText('Process with UVR')).not.toBeInTheDocument()
    })

    it('replaces button with processing indicator when processing', () => {
      const testFile = createMockFile('song.mp3', 1024 * 5000, 'audio/mpeg')

      render(() => <UvrUploadControl {...defaultProps} processing={true} />)
      selectFileViaInput(testFile)

      const processButton = screen.queryByText('Process with UVR')
      expect(processButton).not.toBeInTheDocument()
    })

    it('is enabled when file is selected and not processing', () => {
      const testFile = createMockFile('song.mp3', 1024 * 5000, 'audio/mpeg')

      render(() => <UvrUploadControl {...defaultProps} />)
      selectFileViaInput(testFile)

      const processButton = screen.getByText('Process with UVR')
      expect(processButton).not.toBeDisabled()
    })
  })

  describe('File Size Formatting', () => {
    it('formats small files in KB when >= 1024 bytes', () => {
      // Use audio/mpeg type to pass validation
      const testFile = createMockFile('small.mp3', 1024, 'audio/mpeg')
      render(() => <UvrUploadControl {...defaultProps} />)

      selectFileViaInput(testFile)

      // 1024 bytes = 1 KB
      expect(screen.getByText(/1 KB/)).toBeInTheDocument()
    })

    it('formats medium files in KB', () => {
      const testFile = createMockFile('medium.mp3', 1024 * 500, 'audio/mpeg')
      render(() => <UvrUploadControl {...defaultProps} />)

      selectFileViaInput(testFile)

      // 1024 * 500 = 512000 bytes = 500 KB
      expect(screen.getByText(/500 KB/)).toBeInTheDocument()
    })

    it('formats large files in MB', () => {
      // Use cheap mock to avoid allocating 50MB in memory
      const testFile = createMockFileCheap('large.mp3', 1024 * 1024 * 50)
      render(() => <UvrUploadControl {...defaultProps} />)

      selectFileViaInput(testFile)

      expect(screen.getByText(/50 MB/)).toBeInTheDocument()
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
