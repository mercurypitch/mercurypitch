// ============================================================
// Tests: annotation-store.ts
// ============================================================

import { describe, expect, it } from 'vitest'
import { clearAnnotations, createRegion, createTimeInstant, createTimeValue, exportAnnotationsCSV, getAnnotationsByType, getAnnotationsInRange, importAnnotationsCSV, removeAnnotation, updateAnnotation, } from '@/stores/annotation-store'

describe('annotation store CRUD', () => {
  it('adds and retrieves annotations', () => {
    clearAnnotations()
    const ann = createTimeInstant(1.5, 'Test mark')
    expect(ann.type).toBe('instant')
    expect(ann.time).toBe(1.5)
    expect(ann.label).toBe('Test mark')
    expect(ann.id).toBeTruthy()
  })

  it('removes an annotation by id', () => {
    clearAnnotations()
    const ann = createTimeInstant(1.0)
    removeAnnotation(ann.id)
    expect(getAnnotationsInRange(0, 10)).toHaveLength(0)
  })

  it('updates an annotation label', () => {
    clearAnnotations()
    const ann = createTimeInstant(1.0, 'Old')
    updateAnnotation(ann.id, { label: 'New' })
    const found = getAnnotationsInRange(0, 10)
    expect(found[0]!.label).toBe('New')
  })

  it('filters by type', () => {
    clearAnnotations()
    createTimeInstant(1.0)
    createTimeValue(2.0, 50, 'cents')
    createRegion(3.0, 5.0)
    expect(getAnnotationsByType('instant')).toHaveLength(1)
    expect(getAnnotationsByType('value')).toHaveLength(1)
    expect(getAnnotationsByType('region')).toHaveLength(1)
  })

  it('filters by time range', () => {
    clearAnnotations()
    createTimeInstant(1.0)
    createTimeInstant(5.0)
    createTimeInstant(10.0)
    expect(getAnnotationsInRange(0, 6)).toHaveLength(2)
    expect(getAnnotationsInRange(8, 12)).toHaveLength(1)
  })

  it('includes regions that span the time range', () => {
    clearAnnotations()
    createRegion(1.0, 10.0, 'Long region')
    // Region spans 1-10, should appear in any query that overlaps
    expect(getAnnotationsInRange(5, 6)).toHaveLength(1)
    expect(getAnnotationsInRange(0, 0.5)).toHaveLength(0)
  })
})

describe('annotation store CSV', () => {
  it('exports and imports round-trip', () => {
    clearAnnotations()
    createTimeInstant(1.0, 'Start')
    createTimeValue(2.0, 15, 'cents', '+15¢')
    createRegion(3.0, 6.0, 'Chorus')

    const csv = exportAnnotationsCSV()
    expect(csv).toContain('Start')
    expect(csv).toContain('+15¢')
    expect(csv).toContain('Chorus')

    clearAnnotations()
    const imported = importAnnotationsCSV(csv)
    expect(imported).toHaveLength(3)
    expect(imported[0]!.type).toBe('instant')
    expect(imported[1]!.type).toBe('value')
    expect(imported[2]!.type).toBe('region')
  })
})
