// ============================================================
// UVR Panel Component Tests
// ============================================================

import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { UvrPanel } from '../UvrPanel'

// Mock the entire stores barrel
vi.mock('@/stores', () => ({
  currentUvrSession: vi.fn(() => null),
  getAllUvrSessions: vi.fn(() => []),
  startUvrSession: vi.fn(() => 'session-123'),
  cancelUvrSession: vi.fn(),
  completeUvrSession: vi.fn(),
  updateUvrSessionProgress: vi.fn(),
  setErrorUvrSession: vi.fn(),
  getUvrSession: vi.fn(() => null),

  // Types
  UvrStatus: {
    idle: 'idle',
    uploading: 'uploading',
    processing: 'processing',
    completed: 'completed',
    error: 'error',
    cancelled: 'cancelled',
  } as const,
  UvrMode: {
    separate: 'separate',
    instrumental: 'instrumental',
    vocal: 'vocal',
    duo: 'duo',
  } as const,

  // Other exports
  walkthroughStep: vi.fn(() => ({
    title: '',
    targetSelector: '',
    description: '',
  })),
  walkthroughActive: vi.fn(() => false),
  WALKTHROUGH_STEPS: vi.fn(() => []),
  getSessionHistory: vi.fn(() => []),
  sessionResults: vi.fn(() => []),

  // Settings
  setKeyName: vi.fn(),
  setScaleType: vi.fn(),
  setInstrument: vi.fn(),

  // Stores
  micStore: {},
  notifStore: {},
  practiceStore: {},
  settingsStore: {},
  themeStore: {},
  transportStore: {},
  uiStore: {},
  playbackStateStore: {},

  // Audio engine
  initAudioEngine: vi.fn().mockResolvedValue(undefined),
  applyUvrSettings: vi.fn().mockResolvedValue(undefined),

  // Utils
  buildSessionItemMelody: vi.fn(),
}))

describe('UvrPanel Component', () => {
  const defaultProps = {
    initialView: 'upload' as const,
    onPracticeStart: vi.fn(),
    onExport: vi.fn(),
    onSessionView: vi.fn(),
    onClose: vi.fn(),
  }

  describe('Initial Rendering', () => {
    it('renders default upload view when no session exists', () => {
      render(() => <UvrPanel {...defaultProps} />)
      expect(screen.getByText('Upload Audio')).toBeInTheDocument()
    })

    it('renders header with correct title and subtitle', () => {
      render(() => <UvrPanel {...defaultProps} />)
      expect(screen.getByText(/Vocal Separation/)).toBeInTheDocument()
      expect(
        screen.getByText(/Separate vocals and create MIDI/),
      ).toBeInTheDocument()
    })

    it('renders header buttons', () => {
      render(() => <UvrPanel {...defaultProps} />)
      expect(screen.getByTitle('View Guide')).toBeInTheDocument()
      expect(screen.getByTitle('UVR Settings')).toBeInTheDocument()
    })

    it('defaults to upload when initialView is not set', () => {
      render(() => <UvrPanel {...defaultProps} />)

      expect(screen.getByText('Upload Audio')).toBeInTheDocument()
    })

    it('renders results view when initialView is results', () => {
      render(() => <UvrPanel {...defaultProps} initialView="results" />)

      expect(screen.getByText(/Processing Results/)).toBeInTheDocument()
    })
  })
})
