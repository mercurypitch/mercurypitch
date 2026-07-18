// Ergonomic alias for the platform haptics service —
// `import { haptics } from '@/lib/haptics'` at every call site keeps the
// platform seam (src/lib/platform) as the single swap point for Capacitor.

import { platform } from '@/lib/platform'

export const haptics = platform.haptics
