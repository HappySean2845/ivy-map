import raw from '@/data/course-attribution.json'
import { cityById, dataset, schoolById as catalogSchoolById } from '@/lib/data'
import { scoreFeeders } from '@/lib/scoring'
import {
  CURRICULUM_CODES,
  type AttributionStatus,
  type CourseAdmissionObservation,
  type CourseAttributionDataset,
  type CourseAttributionSchool,
  type SchoolProgram,
} from '@/types/course-attribution'

export const courseAttributionData = raw as unknown as CourseAttributionDataset

const STATUS_WEIGHT: Record<AttributionStatus, number> = {
  confirmed: 4,
  inferred: 3,
  possible: 2,
  excluded: 1,
}

const CURRICULUM_WEIGHT = new Map(CURRICULUM_CODES.map((code, index) => [code, index]))

export interface SchoolAttributionView {
  school: CourseAttributionSchool
  programs: SchoolProgram[]
  observations: CourseAdmissionObservation[]
  years: number[]
  reportedTotal: number
  bestStatus: AttributionStatus
  regionLabel: string
  /** 旧榜单的人均命中率口径；null 表示分母缺失，不能估算。 */
  hitRate: number | null
}

export interface CurriculumRouteStat {
  curriculumCode: 'AP' | 'IB' | 'ALEVEL'
  confirmedSchools: number
  inferredSchools: number
  possibleSchools: number
  observations: number
}

export interface UniversityCourseEvidence {
  schools: SchoolAttributionView[]
  observations: CourseAdmissionObservation[]
  routes: CurriculumRouteStat[]
}

const schoolById = new Map(courseAttributionData.schools.map((school) => [school.id, school]))
const programsBySchool = new Map<string, SchoolProgram[]>()
for (const program of courseAttributionData.programs) {
  const current = programsBySchool.get(program.schoolId) ?? []
  current.push(program)
  programsBySchool.set(program.schoolId, current)
}

const latestLegacyAdmissionYear = dataset.admissions.length
  ? Math.max(...dataset.admissions.map((admission) => admission.year))
  : undefined

function regionLabel(school: CourseAttributionSchool): string {
  const catalogSchool = catalogSchoolById.get(school.id)
  const cityName = catalogSchool ? cityById.get(catalogSchool.cityId)?.name : undefined
  if (cityName && ['北京', '上海', '广州', '深圳'].includes(cityName)) return cityName

  switch (school.region) {
    case '北京地区':
      return '北京'
    case '上海地区':
      return '上海'
    case '广东/港澳地区':
      return '广东 / 港澳'
    case '江浙地区':
      return '江浙'
    case '其他省份':
      return '其他'
    default:
      return school.region || '其他'
  }
}

function hitRatesForUniversity(universityId: string): Map<string, number> {
  const admissions = dataset.admissions.filter(
    (admission) => admission.universityId === universityId,
  )
  const rows = scoreFeeders({
    admissions,
    cohorts: dataset.cohorts,
    alpha: 0,
    latestYear: latestLegacyAdmissionYear,
  })

  return new Map(
    rows.flatMap((row) => (row.density == null ? [] : [[row.schoolId, row.density] as const])),
  )
}

function bestStatus(observations: CourseAdmissionObservation[]): AttributionStatus {
  return observations.reduce<AttributionStatus>(
    (best, observation) =>
      STATUS_WEIGHT[observation.attributionStatus] > STATUS_WEIGHT[best]
        ? observation.attributionStatus
        : best,
    'excluded',
  )
}

function routeStats(observations: CourseAdmissionObservation[]): CurriculumRouteStat[] {
  return (['AP', 'IB', 'ALEVEL'] as const).map((curriculumCode) => {
    const schoolStatus = new Map<string, AttributionStatus>()
    let observationCount = 0

    for (const observation of observations) {
      const matches = observation.attributions.filter(
        (attribution) =>
          attribution.curriculumCode === curriculumCode && attribution.status !== 'excluded',
      )
      if (matches.length === 0) continue
      observationCount++
      const status = matches.reduce<AttributionStatus>(
        (best, attribution) =>
          STATUS_WEIGHT[attribution.status] > STATUS_WEIGHT[best] ? attribution.status : best,
        'excluded',
      )
      const current = schoolStatus.get(observation.schoolId)
      if (!current || STATUS_WEIGHT[status] > STATUS_WEIGHT[current]) {
        schoolStatus.set(observation.schoolId, status)
      }
    }

    const statuses = [...schoolStatus.values()]
    return {
      curriculumCode,
      confirmedSchools: statuses.filter((status) => status === 'confirmed').length,
      inferredSchools: statuses.filter((status) => status === 'inferred').length,
      possibleSchools: statuses.filter((status) => status === 'possible').length,
      observations: observationCount,
    }
  })
}

export function universityCourseEvidence(universityId: string): UniversityCourseEvidence {
  const hitRateBySchool = hitRatesForUniversity(universityId)
  const observations = courseAttributionData.observations
    .filter((observation) => observation.universityId === universityId)
    .sort(
      (left, right) => right.year - left.year || left.schoolId.localeCompare(right.schoolId),
    )

  const grouped = new Map<string, CourseAdmissionObservation[]>()
  for (const observation of observations) {
    grouped.set(observation.schoolId, [
      ...(grouped.get(observation.schoolId) ?? []),
      observation,
    ])
  }

  const schools = [...grouped.entries()]
    .flatMap(([schoolId, schoolObservations]): SchoolAttributionView[] => {
      const school = schoolById.get(schoolId)
      if (!school) return []
      return [
        {
          school,
          programs: [...(programsBySchool.get(schoolId) ?? [])].sort(
            (left, right) =>
              (CURRICULUM_WEIGHT.get(left.curriculumCode) ?? 99) -
              (CURRICULUM_WEIGHT.get(right.curriculumCode) ?? 99),
          ),
          observations: schoolObservations,
          years: [...new Set(schoolObservations.map((observation) => observation.year))].sort(
            (left, right) => right - left,
          ),
          reportedTotal: schoolObservations.reduce(
            (sum, observation) => sum + observation.countValue,
            0,
          ),
          bestStatus: bestStatus(schoolObservations),
          regionLabel: regionLabel(school),
          hitRate: hitRateBySchool.get(schoolId) ?? null,
        },
      ]
    })
    .sort(
      (left, right) =>
        STATUS_WEIGHT[right.bestStatus] - STATUS_WEIGHT[left.bestStatus] ||
        (right.years[0] ?? 0) - (left.years[0] ?? 0) ||
        right.reportedTotal - left.reportedTotal ||
        left.school.nameCn.localeCompare(right.school.nameCn, 'zh'),
    )

  return { schools, observations, routes: routeStats(observations) }
}
