// ============================================================
// UVR (Ultimate Vocal Remover) Types
// ============================================================

/** UVR processing modes */
export type UvrMode = 'separate' | 'instrumental' | 'vocal'

/** UVR processing status */
export type UvrStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'error'
  | 'cancelled'

/** UVR VR architecture options */
export type UvrArchitecture =
  | 'VR_architecture_abe'
  | 'VR_architecture_uvr'
  | 'VR_architecture_hpnetu'
  | 'VR_architecture_hpnetv'

/** UVR model options */
export type UvrModel =
  // UVR5 models
  | 'UVR_MDXNET_RVC_Model_v2'
  | 'UVR_MDXNET_KARAOKEMIX_V2_Model'
  | 'UVR_MDXNET_NaNNSplit_Model'
  // HTDemucs models
  | 'HTDemucs_2_htdemucs'
  | 'HTDemucs_4_htdemucs'
  | 'HTDemucs_5_htdemucs'
  // Other
  | 'MDX-Net_C_Vocal_6'

/** UVR processing options */
export interface UvrProcessOptions {
  /** Input audio file path */
  inputFile: string
  /** Processing mode */
  mode: UvrMode
  /** VR architecture */
  vrArchitecture: UvrArchitecture
  /** Model selection */
  model: UvrModel
  /** GPU ID (0 for CPU, 1+ for GPU) */
  gpuId?: number
  /** Output directory */
  outputDir: string
}

/** UVR processing result */
export interface UvrProcessResult {
  /** Status of processing */
  status: UvrStatus
  /** Path to vocal stem */
  vocalStem?: string
  /** Path to instrumental stem */
  instrumentalStem?: string
  /** Processing time in milliseconds */
  processingTime?: number
  /** Error message if failed */
  error?: string
  /** Session ID */
  sessionId: string
  /** File IDs for frontend */
  fileIds: {
    original: string
    vocal?: string
    instrumental?: string
  }
}

/** File upload result */
export interface FileUploadResult {
  /** Unique file ID */
  fileId: string
  /** Original filename */
  filename: string
  /** MIME type */
  mimeType: string
  /** File size in bytes */
  size: number
  /** Temporary path */
  path: string
  /** Processed by UVR */
  processed?: boolean
  /** Session ID */
  sessionId: string
}

/** MIDI note result */
export interface MidiNote {
  /** Note number (0-127) */
  note: number
  /** Velocity (0-127) */
  velocity: number
  /** Start time in seconds */
  startTime: number
  /** Duration in seconds */
  duration: number
}

/** MIDI generation result */
export interface MidiGenerationResult {
  /** MIDI notes */
  notes: MidiNote[]
  /** Detected tempo (BPM) */
  tempo: number
  /** Length in seconds */
  duration: number
  /** File path if exported */
  filePath?: string
}

/** UVR session state */
export interface UvrSession {
  /** Unique session ID */
  sessionId: string
  /** Original file info */
  originalFile: {
    name: string
    size: number
    mimeType: string
  }
  /** Processing mode */
  mode: UvrMode
  /** VR architecture */
  vrArchitecture: UvrArchitecture
  /** Model */
  model: UvrModel
  /** Current status */
  status: UvrStatus
  /** Progress (0-100) */
  progress: number
  /** Processing time */
  processingTime?: number
  /** Error message */
  error?: string
  /** Paths to outputs */
  outputs?: {
    vocal?: string
    instrumental?: string
    vocalMidi?: string
    instrumentalMidi?: string
  }
  /** When session was created */
  createdAt: number
}

/** UVR processing configuration */
export interface UvrConfig {
  /** Enable server-side processing */
  enabled: boolean
  /** Upload directory */
  uploadDir: string
  /** Temporary directory */
  tempDir: string
  /** Output directory */
  outputDir: string
  /** UVR CLI executable path */
  uvrPath: string
  /** Maximum file size in bytes (default: 100MB) */
  maxFileSize?: number
  /** Allowed file extensions */
  allowedExtensions?: string[]
}

/** Default UVR configuration */
export const DEFAULT_UVR_CONFIG: UvrConfig = {
  enabled: false, // Requires server-side setup
  uploadDir: './uploads/uvr',
  tempDir: './uploads/uvr/temp',
  outputDir: './uploads/uvr/output',
  uvrPath: './uvr/uvr5.exe',
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedExtensions: ['.mp3', '.wav', '.flac'],
}
