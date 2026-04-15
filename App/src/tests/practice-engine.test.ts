// ============================================================
// Practice Engine Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  centsToRating,
  centsToBand,
  ratingToScore,
  scoreGrade,
} from '@/lib/practice-engine';
import type { AccuracyRating } from '@/types';

describe('centsToRating', () => {
  it('returns perfect for very accurate pitches', () => {
    expect(centsToRating(0)).toBe('perfect');
    expect(centsToRating(3)).toBe('perfect');
    expect(centsToRating(5)).toBe('perfect');
  });

  it('returns excellent for close pitches', () => {
    expect(centsToRating(10)).toBe('excellent');
    expect(centsToRating(14)).toBe('excellent');
    expect(centsToRating(15)).toBe('excellent');
  });

  it('returns good for decent pitches', () => {
    expect(centsToRating(20)).toBe('good');
    expect(centsToRating(24)).toBe('good');
    expect(centsToRating(25)).toBe('good');
  });

  it('returns okay for rough pitches', () => {
    expect(centsToRating(30)).toBe('okay');
    expect(centsToRating(40)).toBe('okay');
    expect(centsToRating(50)).toBe('okay');
  });

  it('returns off for inaccurate pitches', () => {
    expect(centsToRating(60)).toBe('off');
    expect(centsToRating(100)).toBe('off');
    expect(centsToRating(500)).toBe('off');
  });

  it('handles null (no samples) as off', () => {
    expect(centsToRating(null)).toBe('off');
  });
});

describe('centsToBand', () => {
  it('returns 100 for perfect accuracy', () => {
    expect(centsToBand(0)).toBe(100);
    expect(centsToBand(5)).toBe(100);
    expect(centsToBand(10)).toBe(100);
  });

  it('returns 90 for excellent accuracy', () => {
    expect(centsToBand(15)).toBe(90);
    expect(centsToBand(20)).toBe(90);
    expect(centsToBand(25)).toBe(90);
  });

  it('returns 75 for good accuracy', () => {
    expect(centsToBand(30)).toBe(75);
    expect(centsToBand(40)).toBe(75);
    expect(centsToBand(50)).toBe(75);
  });

  it('returns 50 for okay accuracy', () => {
    expect(centsToBand(60)).toBe(50);
    expect(centsToBand(100)).toBe(50);
    expect(centsToBand(999)).toBe(50);
  });

  it('returns 0 for null', () => {
    expect(centsToBand(null)).toBe(0);
  });
});

describe('ratingToScore', () => {
  it('returns 100 for perfect', () => {
    expect(ratingToScore('perfect')).toBe(100);
  });

  it('returns 90 for excellent', () => {
    expect(ratingToScore('excellent')).toBe(90);
  });

  it('returns 75 for good', () => {
    expect(ratingToScore('good')).toBe(75);
  });

  it('returns 50 for okay', () => {
    expect(ratingToScore('okay')).toBe(50);
  });

  it('returns 0 for off', () => {
    expect(ratingToScore('off')).toBe(0);
  });
});

describe('scoreGrade', () => {
  it('returns perfect grade for scores 90+', () => {
    const grade = scoreGrade(90);
    expect(grade.label).toBe('Pitch Perfect!');
    expect(grade.cls).toBe('grade-perfect');

    const grade100 = scoreGrade(100);
    expect(grade100.cls).toBe('grade-perfect');
  });

  it('returns excellent grade for scores 80-89', () => {
    const grade = scoreGrade(80);
    expect(grade.label).toBe('Excellent!');
    expect(grade.cls).toBe('grade-excellent');

    const grade85 = scoreGrade(85);
    expect(grade85.cls).toBe('grade-excellent');
  });

  it('returns good grade for scores 65-79', () => {
    const grade = scoreGrade(65);
    expect(grade.label).toBe('Good!');
    expect(grade.cls).toBe('grade-good');

    const grade75 = scoreGrade(75);
    expect(grade75.cls).toBe('grade-good');
  });

  it('returns okay grade for scores 50-64', () => {
    const grade = scoreGrade(50);
    expect(grade.label).toBe('Okay!');
    expect(grade.cls).toBe('grade-okay');

    const grade60 = scoreGrade(60);
    expect(grade60.cls).toBe('grade-okay');
  });

  it('returns needs work grade for scores below 50', () => {
    const grade = scoreGrade(49);
    expect(grade.label).toBe('Needs Work');
    expect(grade.cls).toBe('grade-needs-work');

    const grade0 = scoreGrade(0);
    expect(grade0.cls).toBe('grade-needs-work');
  });
});

describe('Rating consistency', () => {
  it('ratingToScore and centsToBand are consistent', () => {
    const ratings: AccuracyRating[] = ['perfect', 'excellent', 'good', 'okay', 'off'];
    const scores = [100, 90, 75, 50, 0];

    for (let i = 0; i < ratings.length; i++) {
      expect(ratingToScore(ratings[i])).toBe(scores[i]);
    }
  });
});