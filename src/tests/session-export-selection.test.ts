// ============================================================
// Session export selection tests — safe global presets across mixed sessions
// ============================================================

import { describe, expect, it } from 'vitest'
import { resolveSessionExportStems } from '@/db/services/session-export-service'

describe('session library export selection', () => {
  it('intersects a global selection with each session in stable stem order', () => {
    expect(
      resolveSessionExportStems(
        ['vocal', 'instrumental', 'drums', 'bass'],
        ['bass', 'vocal', 'piano'],
      ),
    ).toEqual(['vocal', 'bass'])
  })

  it('keeps every stored stem when no global selection is supplied', () => {
    expect(
      resolveSessionExportStems(['other', 'vocal', 'guitar', 'drums']),
    ).toEqual(['vocal', 'drums', 'guitar', 'other'])
  })
})
