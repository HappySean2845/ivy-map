import { describe, expect, it } from 'vitest'

import {
  chinaEcosystemLevel,
  destinationSharesForUniversity,
  requirementProfile,
  universityEnrichmentData,
} from '@/lib/v2/university-enrichment'
import { REQUIREMENT_KEYS } from '@/types/university-enrichment'

describe('university enrichment snapshot', () => {
  it('publishes complete requirements for all 32 universities', () => {
    expect(universityEnrichmentData.requirements).toHaveLength(32)
    expect(new Set(universityEnrichmentData.requirements.map((item) => item.universityId)).size).toBe(
      32,
    )

    for (const profile of universityEnrichmentData.requirements) {
      expect(Object.keys(profile.requirements).sort()).toEqual([...REQUIREMENT_KEYS].sort())
      for (const key of REQUIREMENT_KEYS) {
        expect(profile.requirements[key].text.length, `${profile.universityId}.${key}`).toBeGreaterThan(
          0,
        )
      }
    }
  })

  it('keeps invalid WashU editorial ratings out of the product', () => {
    const washu = requirementProfile('washu')
    expect(washu?.safety).toBeNull()
    expect(washu?.chinaFriendliness).toBeNull()
  })

  it('quarantines only the known appendix aggregates and 2022 row', () => {
    expect(universityEnrichmentData.quarantined).toHaveLength(21)
    expect(
      universityEnrichmentData.quarantined.filter(
        (row) => row.reason === 'synthetic_school_heading',
      ),
    ).toHaveLength(20)
    expect(
      universityEnrichmentData.quarantined.filter((row) => row.reason === 'out_of_scope_year'),
    ).toHaveLength(1)
    expect(
      universityEnrichmentData.destinationShares.some(
        (row) => row.schoolName === '版本与口径声明',
      ),
    ).toBe(false)
  })

  it('reproduces every published destination share from visible counts', () => {
    const computable = universityEnrichmentData.destinationShares.filter(
      (row) => row.share != null,
    )
    expect(computable).toHaveLength(400)
    for (const row of computable) {
      expect(row.denominator).not.toBeNull()
      expect(row.share).toBeCloseTo(row.numerator / row.denominator!, 12)
      expect(row.share!).toBeLessThanOrEqual(1)
      expect(row.outcomeKind).not.toBe('unknown')
    }
  })

  it('preserves numerator-only history when the university denominator is missing', () => {
    const missing = universityEnrichmentData.destinationShares.filter(
      (row) => row.denominator == null,
    )
    expect(missing.length).toBeGreaterThan(100)
    expect(missing.every((row) => row.share == null)).toBe(true)
  })

  it('maps aliases and retains multi-year observations', () => {
    expect(destinationSharesForUniversity('upenn').length).toBeGreaterThan(0)
    expect(destinationSharesForUniversity('utokyo').length).toBeGreaterThan(0)
    expect(destinationSharesForUniversity('penn')).toEqual([])
    expect(destinationSharesForUniversity('oxford').some((row) => row.year === 2022)).toBe(false)
  })

  it('uses stable fixed China-ecosystem bands', () => {
    expect(chinaEcosystemLevel({ value: 64, band: null, text: '' })).toBe(1)
    expect(chinaEcosystemLevel({ value: 65, band: null, text: '' })).toBe(2)
    expect(chinaEcosystemLevel({ value: 75, band: null, text: '' })).toBe(3)
    expect(chinaEcosystemLevel({ value: 82, band: null, text: '' })).toBe(4)
    expect(chinaEcosystemLevel({ value: 90, band: null, text: '' })).toBe(5)
  })
})
