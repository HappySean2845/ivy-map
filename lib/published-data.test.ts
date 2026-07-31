import { describe, expect, it } from 'vitest'

import { dataStatus, dataset, sourceById, universityById } from './data'

describe('published university data', () => {
  it('preserves Oxford, Cambridge, and the existing placement dataset', () => {
    expect(universityById.has('oxford')).toBe(true)
    expect(universityById.has('cambridge')).toBe(true)
    expect(dataset.defaultView?.universityId).toBe('cambridge')
    expect(dataset.admissions).toHaveLength(56)
    expect(dataset.admissions.some((row) => row.universityId === 'oxford')).toBe(true)
    expect(dataset.admissions.some((row) => row.universityId === 'cambridge')).toBe(true)
  })

  it('publishes the reviewed CDS batch without dropping the expanded catalog', () => {
    const status = dataStatus()
    expect(status.universities).toBe(31)
    expect(status.officialAdmissions).toBe(7)
    expect(universityById.has('uw')).toBe(true)

    expect(universityById.get('harvard')?.officialAdmissions[0]).toMatchObject({
      academicYearStart: 2025,
      applied: 47_893,
      admitted: 2_003,
      enrolled: 1_675,
      confidence: 'L1',
      sourceId: 'harvard-official',
    })
  })

  it('keeps every official snapshot linked to a published source', () => {
    for (const university of dataset.universities) {
      for (const snapshot of university.officialAdmissions) {
        expect(sourceById.has(snapshot.sourceId)).toBe(true)
      }
    }
  })
})
