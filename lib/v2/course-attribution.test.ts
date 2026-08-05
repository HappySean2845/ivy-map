import { describe, expect, it } from 'vitest'

import { courseAttributionData, universityCourseEvidence } from './course-attribution'

describe('published course attribution data', () => {
  it('keeps every observation linked to a published school', () => {
    const schoolIds = new Set(courseAttributionData.schools.map((school) => school.id))
    expect(courseAttributionData.schools).toHaveLength(173)
    expect(courseAttributionData.programs).toHaveLength(348)
    expect(courseAttributionData.cohorts).toHaveLength(84)
    expect(courseAttributionData.observations).toHaveLength(1551)
    expect(courseAttributionData.observations.every((row) => schoolIds.has(row.schoolId))).toBe(
      true,
    )
  })

  it('preserves Oxford and Cambridge feeder coverage', () => {
    const oxford = universityCourseEvidence('oxford')
    const cambridge = universityCourseEvidence('cambridge')

    expect(oxford.schools).toHaveLength(64)
    expect(oxford.observations).toHaveLength(141)
    expect(cambridge.schools).toHaveLength(67)
    expect(cambridge.observations).toHaveLength(128)
    expect(
      oxford.routes.find((route) => route.curriculumCode === 'ALEVEL')?.confirmedSchools,
    ).toBeGreaterThan(0)
  })

  it('calculates only source-backed school or confirmed department densities', () => {
    const oxford = universityCourseEvidence('oxford')
    const columbia = universityCourseEvidence('columbia')
    const ulink = oxford.schools.find((school) => school.school.id === 'ulink')
    const scie = oxford.schools.find((school) => school.school.id === 'scie')
    const daystar = columbia.schools.find((school) => school.school.id === 'hs-cn-d7ec78a15d9b')

    expect(ulink?.regionLabel).toBe('上海')
    expect(ulink?.schoolDensity).toBeNull()
    expect(ulink?.departmentDensities[0]?.perHundred).toBeGreaterThan(0)
    expect(scie?.regionLabel).toBe('深圳')
    expect(daystar?.schoolDensity?.perHundred).toBeCloseTo(100 / 15, 5)
    expect(daystar?.departmentDensities[0]?.perHundred).toBeCloseTo(100 / 15, 5)
  })

  it('keeps known cohort scopes and rejects ambiguous source ranges', () => {
    expect(
      courseAttributionData.cohorts.find(
        (cohort) =>
          cohort.schoolId === 'shsid' && cohort.year === 2026 && cohort.scope === 'school',
      )?.graduates,
    ).toBe(204)
    expect(
      courseAttributionData.cohorts.find(
        (cohort) =>
          cohort.schoolId === 'ulink' && cohort.year === 2026 && cohort.curriculumCode === 'IB',
      )?.graduates,
    ).toBe(40)
    expect(
      courseAttributionData.cohorts.some(
        (cohort) => cohort.sourceLine === 3951 && cohort.graduates === 55,
      ),
    ).toBe(false)
    expect(
      courseAttributionData.cohorts.some(
        (cohort) =>
          cohort.schoolId === 'szzx' && cohort.year === 2024 && cohort.curriculumCode === 'AP',
      ),
    ).toBe(false)
  })

  it('does not turn inferred or possible records into confirmed tracks', () => {
    for (const observation of courseAttributionData.observations) {
      if (observation.attributionStatus !== 'confirmed') {
        expect(observation.track).toBeNull()
      }
    }
  })
})
