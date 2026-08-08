import { describe, expect, it } from 'vitest'

import { admissionOpennessLevel, deckOrder } from '@/lib/v2/profile'
import {
  CURATED_TRAITS,
  PROFILE_TRAITS,
  PROFILE_TRAIT_DIRECTION,
  type ProfileLevel,
} from '@/types/profile'

describe('university profile fingerprint', () => {
  it('uses stable absolute admission-rate bands', () => {
    expect(admissionOpennessLevel(0.049)).toBe(1)
    expect(admissionOpennessLevel(0.05)).toBe(2)
    expect(admissionOpennessLevel(0.079)).toBe(2)
    expect(admissionOpennessLevel(0.08)).toBe(3)
    expect(admissionOpennessLevel(0.12)).toBe(3)
    expect(admissionOpennessLevel(0.121)).toBe(4)
    expect(admissionOpennessLevel(0.3)).toBe(4)
    expect(admissionOpennessLevel(0.301)).toBe(5)
  })

  it('keeps every curated trait complete', () => {
    const views = deckOrder()
    expect(views).toHaveLength(32)

    for (const view of views) {
      for (const trait of CURATED_TRAITS) {
        expect(view.fingerprint[trait].level, `${view.university.id}.${trait}`).not.toBeNull()
        expect(view.fingerprint[trait].basis.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps known fields as disciplines instead of school or college names', () => {
    const collegeNames =
      /Thayer|Wharton|Medill|Peabody|Tisch|Stern|EECS|Ross|Olin|Bartlett|Rotman/

    for (const view of deckOrder()) {
      expect(view.profile.strengths.join(' '), view.university.id).not.toMatch(collegeNames)
    }
  })

  it('preserves meaningful spread on every axis', () => {
    const views = deckOrder()

    for (const trait of PROFILE_TRAITS) {
      const levels = views
        .map((view) => view.fingerprint[trait].level)
        .filter((level): level is ProfileLevel => level != null)
      const counts = new Map<ProfileLevel, number>()
      for (const level of levels) counts.set(level, (counts.get(level) ?? 0) + 1)

      expect(counts.size, trait).toBe(5)
      expect(Math.max(...counts.values()), trait).toBeLessThanOrEqual(levels.length / 2)
    }
  })

  it('gives every axis the same outward semantic', () => {
    for (const trait of PROFILE_TRAITS) {
      expect(PROFILE_TRAIT_DIRECTION[trait]).toMatch(/^越外/)
    }
  })
})
