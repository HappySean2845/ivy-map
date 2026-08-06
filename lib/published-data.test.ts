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
    expect(dataset.feederEvidence).toHaveLength(39)
    expect(dataset.feederEvidence.every((row) => row.track === null)).toBe(true)
  })

  it('publishes reviewed US feeder evidence without mixing it into ranking rows', () => {
    const destinations = new Set(dataset.feederEvidence.map((row) => row.universityId))
    expect(destinations.size).toBe(16)
    expect(universityById.has('washu')).toBe(true)
    expect(
      dataset.feederEvidence
        .filter((row) => row.universityId === 'washu')
        .reduce((sum, row) => sum + row.countValue, 0),
    ).toBe(13)
    expect(dataset.admissions.some((row) => row.universityId === 'washu')).toBe(false)
    expect(sourceById.get('jiaoyubao-beijing-us-early-2026')).toMatchObject({
      type: 'media',
      confidence: 'L2',
    })
  })

  it('publishes the reviewed CDS batch without dropping the expanded catalog', () => {
    const status = dataStatus()
    expect(status.universities).toBe(32)
    expect(status.feederEvidence).toBe(39)
    expect(status.officialAdmissions).toBe(19)
    expect(universityById.has('uw')).toBe(true)

    expect(universityById.get('harvard')?.officialAdmissions[0]).toMatchObject({
      academicYearStart: 2025,
      applied: 47_893,
      admitted: 2_003,
      enrolled: 1_675,
      confidence: 'L1',
      sourceId: 'harvard-official',
    })

    expect(universityById.get('brown')?.officialAdmissions[0]).toMatchObject({
      academicYearStart: 2024,
      applied: 48_904,
      admitted: 2_638,
      enrolled: 1_719,
      sourceId: 'brown-official',
    })
    expect(universityById.get('columbia')?.officialAdmissions[0]).toMatchObject({
      academicYearStart: 2024,
      campus: 'Columbia College and Columbia Engineering',
      applied: 60_247,
      admitted: 2_325,
      enrolled: 1_483,
    })
    expect(universityById.get('ucla')?.officialAdmissions[0]).toMatchObject({
      academicYearStart: 2025,
      campus: 'Los Angeles',
      applied: 145_086,
      admitted: 13_659,
      enrolled: 6_553,
    })
    expect(universityById.get('jhu')?.officialAdmissions).toEqual([])
    expect(universityById.get('nyu')?.officialAdmissions).toEqual([])
  })

  it('keeps every official snapshot linked to a published source', () => {
    for (const university of dataset.universities) {
      for (const snapshot of university.officialAdmissions) {
        expect(sourceById.has(snapshot.sourceId)).toBe(true)
      }
    }
  })

  it('publishes reviewed scoped admission-rate trends without dropping legacy data', () => {
    const series = dataset.universities.flatMap((university) => university.admissionRateSeries)
    const points = series.flatMap((item) => item.points)
    const covered = dataset.universities.filter(
      (university) => university.admissionRateSeries.length > 0,
    )

    expect(series).toHaveLength(32)
    expect(points).toHaveLength(522)
    expect(covered).toHaveLength(28)
    expect(universityById.get('jhu')?.admissionRateSeries[0]?.points).toHaveLength(20)
    expect(universityById.get('nyu')?.admissionRateSeries[0]?.points).toHaveLength(20)

    const cambridge = universityById.get('cambridge')?.admissionRateSeries ?? []
    expect(cambridge).toHaveLength(2)
    expect(cambridge.find((item) => item.primary)?.scope.applicantScope).toBe('all')
    expect(cambridge.find((item) => item.primary)?.points.at(-1)?.rate).toBeCloseTo(0.163)
    expect(cambridge.find((item) => !item.primary)?.points.at(-1)?.rate).toBeCloseTo(0.098)

    const imperialRanges = (universityById.get('imperial')?.admissionRateSeries ?? [])
      .flatMap((item) => item.points)
      .filter((point) => point.rateMin != null && point.rateMax != null)
    expect(imperialRanges).toHaveLength(3)

    expect(
      universityById.get('utokyo')?.admissionRateSeries.find((item) => item.primary)?.scope,
    ).toMatchObject({ applicantScope: 'international_program', pathway: 'PEAK' })

    for (const point of points) expect(sourceById.has(point.sourceId)).toBe(true)
  })
})
