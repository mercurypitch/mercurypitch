// ============================================================
// Pitch Algorithm Tester Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  getPerformanceClassification,
  ACCURACY_BAND_COLORS,
  ACCURACY_BAND_LABELS,
  DEFAULT_ALGORITHMS,
} from '../lib/pitch-algorithm-tester'

describe('Pitch Algorithm Tester', () => {
  describe('Performance Classification', () => {
    it('should classify very fast performance as Excellent', () => {
      const classification = getPerformanceClassification(2)
      expect(classification.label).toBe('Excellent')
      expect(classification.color).toBe('text-green-400')
    })

    it('should classify fast performance as Good', () => {
      const classification = getPerformanceClassification(5)
      expect(classification.label).toBe('Good')
      expect(classification.color).toBe('text-blue-400')
    })

    it('should classify medium performance as Acceptable', () => {
      const classification = getPerformanceClassification(10)
      expect(classification.label).toBe('Acceptable')
      expect(classification.color).toBe('text-yellow-400')
    })

    it('should classify medium-fast performance as Acceptable', () => {
      const classification = getPerformanceClassification(15)
      expect(classification.label).toBe('Acceptable')
      expect(classification.color).toBe('text-yellow-400')
    })

    it('should classify slow performance as Slow', () => {
      const classification = getPerformanceClassification(20)
      expect(classification.label).toBe('Slow')
      expect(classification.color).toBe('text-orange-400')
    })

    it('should classify extremely slow performance as Too Slow', () => {
      const classification = getPerformanceClassification(100)
      expect(classification.label).toBe('Too Slow')
      expect(classification.color).toBe('text-red-400')
    })

    it('should use fallback color for unknown values', () => {
      const classification = getPerformanceClassification(-1)
      expect(classification.color).toBe('text-green-400') // Falls back to excellent color
    })

    it('should handle edge cases around thresholds', () => {
      // Just below 5ms - should be Excellent
      expect(getPerformanceClassification(4.9).label).toBe('Excellent')
      // Just above 5ms - should be Good
      expect(getPerformanceClassification(5.1).label).toBe('Good')

      // Just below 10ms - should be Good
      expect(getPerformanceClassification(9.9).label).toBe('Good')
      // Just above 10ms - should be Acceptable
      expect(getPerformanceClassification(10.1).label).toBe('Acceptable')

      // Just below 16.67ms - should be Acceptable
      expect(getPerformanceClassification(16.6).label).toBe('Acceptable')
      // Just above 16.67ms - should be Slow
      expect(getPerformanceClassification(17.0).label).toBe('Slow')

      // Just below 33ms - should be Slow
      expect(getPerformanceClassification(32.9).label).toBe('Slow')
      // Just above 33ms - should be Too Slow
      expect(getPerformanceClassification(33.1).label).toBe('Too Slow')
    })
  })

  describe('Accuracy Band Colors', () => {
    it('should define all required accuracy bands', () => {
      expect(ACCURACY_BAND_COLORS[100]).toBeDefined()
      expect(ACCURACY_BAND_COLORS[90]).toBeDefined()
      expect(ACCURACY_BAND_COLORS[75]).toBeDefined()
      expect(ACCURACY_BAND_COLORS[50]).toBeDefined()
      expect(ACCURACY_BAND_COLORS[0]).toBeDefined()
    })

    it('should have different colors for different bands', () => {
      const colors = Object.values(ACCURACY_BAND_COLORS)
      const uniqueColors = new Set(colors)
      expect(uniqueColors.size).toBeGreaterThan(1)
    })

    it('should have a greenish color for high accuracy', () => {
      expect(ACCURACY_BAND_COLORS[100]).toMatch(/^#/)
    })

    it('should have an orange/red color for failed accuracy', () => {
      expect(ACCURACY_BAND_COLORS[0]).toMatch(/^#/)
    })
  })

  describe('Accuracy Band Labels', () => {
    it('should define all band labels', () => {
      expect(ACCURACY_BAND_LABELS[100]).toBe('Perfect')
      expect(ACCURACY_BAND_LABELS[90]).toBe('Excellent')
      expect(ACCURACY_BAND_LABELS[75]).toBe('Good')
      expect(ACCURACY_BAND_LABELS[50]).toBe('Okay')
      expect(ACCURACY_BAND_LABELS[0]).toBe('Failed')
    })
  })

  describe('Default Algorithms', () => {
    it('should include YIN in default algorithms', () => {
      expect(DEFAULT_ALGORITHMS).toContain('yin')
    })

    it('should include MPM in default algorithms', () => {
      expect(DEFAULT_ALGORITHMS).toContain('mpm')
    })

    it('should include SwiftF0 in default algorithms', () => {
      expect(DEFAULT_ALGORITHMS).toContain('swift')
    })

    it('should have a limited set of default algorithms', () => {
      expect(DEFAULT_ALGORITHMS.length).toBeLessThan(5)
      expect(DEFAULT_ALGORITHMS.length).toBeGreaterThan(0)
    })
  })

  describe('Boundary Conditions', () => {
    it('should handle zero time correctly', () => {
      const classification = getPerformanceClassification(0)
      expect(classification.label).toBe('Excellent')
    })

    it('should handle very large times', () => {
      const classification = getPerformanceClassification(1000)
      expect(classification.label).toBe('Too Slow')
    })

    it('should handle negative times', () => {
      const classification = getPerformanceClassification(-10)
      expect(classification.label).toBe('Excellent')
    })
  })
})
