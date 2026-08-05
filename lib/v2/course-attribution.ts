import raw from '@/data/course-attribution.json'
import { cityById, dataset, schoolById as catalogSchoolById } from '@/lib/data'
import { scoreFeeders } from '@/lib/scoring'
import {
  CURRICULUM_CODES,
  type AttributionStatus,
  type CourseAdmissionObservation,
  type CourseAttributionDataset,
  type CourseAttributionSchool,
  type CourseCohort,
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
  schoolDensity: DestinationDensity | null
  departmentDensities: DestinationDensity[]
}

export interface DestinationDensity {
  scope: 'school' | 'department'
  curriculumCode: 'AP' | 'IB' | 'ALEVEL' | null
  /** 每 100 名毕业生对应的公开目标大学录取记录数。 */
  perHundred: number
  years: number[]
  partial: boolean
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
const cohortsBySchool = new Map<string, CourseCohort[]>()
for (const cohort of courseAttributionData.cohorts) {
  const current = cohortsBySchool.get(cohort.schoolId) ?? []
  current.push(cohort)
  cohortsBySchool.set(cohort.schoolId, current)
}
const reviewedLegacyCohortKeys = new Set(
  courseAttributionData.cohorts
    .filter(
      (cohort) => cohort.sourceKind === 'legacy_csv' && cohort.reviewStatus === 'reviewed',
    )
    .map((cohort) => `${cohort.schoolId}|${cohort.year}|${cohort.curriculumCode ?? ''}`),
)
const reviewedLegacyCohorts = dataset.cohorts.filter((cohort) =>
  reviewedLegacyCohortKeys.has(`${cohort.schoolId}|${cohort.year}|${cohort.track}`),
)
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

function destinationDensity(
  observations: CourseAdmissionObservation[],
  cohorts: CourseCohort[],
  scope: DestinationDensity['scope'],
  curriculumCode: DestinationDensity['curriculumCode'],
): DestinationDensity | null {
  const scopedCohorts = cohorts.filter(
    (cohort) =>
      cohort.scope === scope &&
      cohort.curriculumCode === curriculumCode &&
      cohort.reviewStatus === 'reviewed',
  )
  const scopedObservations =
    scope === 'school'
      ? observations
      : observations.filter(
          (observation) =>
            observation.track === curriculumCode &&
            observation.attributionStatus === 'confirmed',
        )
  if (scopedCohorts.length === 0 || scopedObservations.length === 0) return null

  // Multiple sources and rounds can coexist for one school/university/year. Taking the
  // largest published count keeps this a conservative lower bound without double-counting.
  const countByYear = new Map<number, number>()
  for (const observation of scopedObservations) {
    countByYear.set(
      observation.year,
      Math.max(countByYear.get(observation.year) ?? 0, observation.countValue),
    )
  }
  const cohortByYear = new Map(scopedCohorts.map((cohort) => [cohort.year, cohort]))
  const overlapYears = [...countByYear.keys()]
    .filter((year) => cohortByYear.has(year))
    .sort((left, right) => right - left)
  if (overlapYears.length === 0) return null

  const latestYear = overlapYears[0]
  let weightedCount = 0
  let weightedGraduates = 0
  const years: number[] = []
  for (const year of overlapYears) {
    const offset = latestYear - year
    const weight = [0.5, 0.3, 0.2][offset] ?? 0
    if (weight === 0) continue
    const graduates = cohortByYear.get(year)?.graduates
    const count = countByYear.get(year)
    if (!graduates || count == null) continue
    weightedCount += weight * count
    weightedGraduates += weight * graduates
    years.push(year)
  }
  if (weightedGraduates === 0) return null

  const recentObservationYears = new Set(
    scopedObservations
      .map((observation) => observation.year)
      .filter((year) => year <= latestYear && latestYear - year <= 2),
  )
  return {
    scope,
    curriculumCode,
    perHundred: (weightedCount / weightedGraduates) * 100,
    years,
    partial: years.length < recentObservationYears.size,
  }
}

function densitiesForSchool(
  observations: CourseAdmissionObservation[],
  cohorts: CourseCohort[],
  legacyDepartmentDensities: DestinationDensity[],
  programs: SchoolProgram[],
): Pick<SchoolAttributionView, 'schoolDensity' | 'departmentDensities'> {
  const departmentDensities = new Map(
    legacyDepartmentDensities.flatMap((density) =>
      density.curriculumCode ? [[density.curriculumCode, density] as const] : [],
    ),
  )
  for (const curriculumCode of ['AP', 'IB', 'ALEVEL'] as const) {
    const hasDepartmentCohort = cohorts.some(
      (cohort) => cohort.scope === 'department' && cohort.curriculumCode === curriculumCode,
    )
    const isSingleTrack = programs.some(
      (program) => program.curriculumCode === curriculumCode && program.isSingleTrack,
    )
    const effectiveCohorts =
      !hasDepartmentCohort && isSingleTrack
        ? [
            ...cohorts,
            ...cohorts
              .filter((cohort) => cohort.scope === 'school')
              .map((cohort): CourseCohort => ({
                ...cohort,
                scope: 'department',
                curriculumCode,
              })),
          ]
        : cohorts
    const density = destinationDensity(
      observations,
      effectiveCohorts,
      'department',
      curriculumCode,
    )
    if (density) departmentDensities.set(curriculumCode, density)
  }
  return {
    schoolDensity: destinationDensity(observations, cohorts, 'school', null),
    departmentDensities: [...departmentDensities.values()],
  }
}

function legacyDepartmentDensitiesForUniversity(
  universityId: string,
): Map<string, DestinationDensity[]> {
  const admissions = dataset.admissions.filter(
    (admission) => admission.universityId === universityId,
  )
  const bySchool = new Map<string, DestinationDensity[]>()
  for (const curriculumCode of ['AP', 'IB', 'ALEVEL'] as const) {
    const rows = scoreFeeders({
      admissions,
      cohorts: reviewedLegacyCohorts,
      alpha: 0,
      tracks: [curriculumCode],
      latestYear: latestLegacyAdmissionYear,
    })
    for (const row of rows) {
      if (row.density == null) continue
      const density: DestinationDensity = {
        scope: 'department',
        curriculumCode,
        perHundred: row.density * 100,
        years: row.densityYears,
        partial: row.densityPartial,
      }
      bySchool.set(row.schoolId, [...(bySchool.get(row.schoolId) ?? []), density])
    }
  }
  return bySchool
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
  const legacyDepartmentDensities = legacyDepartmentDensitiesForUniversity(universityId)
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
      const schoolPrograms = [...(programsBySchool.get(schoolId) ?? [])].sort(
        (left, right) =>
          (CURRICULUM_WEIGHT.get(left.curriculumCode) ?? 99) -
          (CURRICULUM_WEIGHT.get(right.curriculumCode) ?? 99),
      )
      const densities = densitiesForSchool(
        schoolObservations,
        cohortsBySchool.get(schoolId) ?? [],
        legacyDepartmentDensities.get(schoolId) ?? [],
        schoolPrograms,
      )
      return [
        {
          school,
          programs: schoolPrograms,
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
          ...densities,
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
