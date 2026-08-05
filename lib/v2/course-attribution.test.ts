import { describe, expect, it } from 'vitest'

import { courseAttributionData, universityCourseEvidence } from './course-attribution'

describe('published course attribution data', () => {
  it('keeps every observation linked to a published school', () => {
    const schoolIds = new Set(courseAttributionData.schools.map((school) => school.id))
    expect(courseAttributionData.schools).toHaveLength(173)
    expect(courseAttributionData.programs).toHaveLength(348)
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

  it('reuses legacy hit rates without estimating missing denominators', () => {
    const oxford = universityCourseEvidence('oxford')
    const harvard = universityCourseEvidence('harvard')
    const ulink = oxford.schools.find((school) => school.school.id === 'ulink')
    const scie = oxford.schools.find((school) => school.school.id === 'scie')

    expect(ulink?.regionLabel).toBe('上海')
    expect(ulink?.hitRate).toBeGreaterThan(0)
    expect(scie?.regionLabel).toBe('深圳')
    expect(harvard.schools.every((school) => school.hitRate == null)).toBe(true)
  })

  it('does not turn inferred or possible records into confirmed tracks', () => {
    for (const observation of courseAttributionData.observations) {
      if (observation.attributionStatus !== 'confirmed') {
        expect(observation.track).toBeNull()
      }
    }
  })
})
