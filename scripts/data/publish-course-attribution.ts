import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { CourseAttributionDataset } from '../../types/course-attribution.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const input = resolve(ROOT, process.argv[2] ?? '.data/course-attribution/cleaned.json')
const output = resolve(ROOT, process.argv[3] ?? 'data/course-attribution.json')

function plainText(markdown: string): string {
  return markdown.replaceAll('**', '').replaceAll('`', '').trim()
}

const cleaned = JSON.parse(readFileSync(input, 'utf8')) as {
  schemaVersion: 1
  source: CourseAttributionDataset['source'] & { byteSize: number }
  schools: Array<{
    id: string
    nameLocal: string
    nameEn: string | null
    region: string
  }>
  programs: CourseAttributionDataset['programs']
  cohorts: CourseAttributionDataset['cohorts']
  observations: CourseAttributionDataset['observations']
}

if (cleaned.schemaVersion !== 1) {
  throw new Error(`不支持的课程归因数据版本：${cleaned.schemaVersion}`)
}

const published: CourseAttributionDataset = {
  schemaVersion: 1,
  source: {
    filename: cleaned.source.filename,
    sha256: cleaned.source.sha256,
    capturedAt: cleaned.source.capturedAt,
  },
  schools: cleaned.schools.map((school) => ({
    id: school.id,
    nameCn: school.nameLocal,
    nameEn: school.nameEn,
    region: school.region,
  })),
  programs: cleaned.programs.map((program) => ({
    schoolId: program.schoolId,
    curriculumCode: program.curriculumCode,
    role: program.role,
    validFromYear: program.validFromYear,
    firstGraduatingYear: program.firstGraduatingYear,
    validToYear: program.validToYear,
    isSingleTrack: program.isSingleTrack,
    sourceLine: program.sourceLine,
  })),
  cohorts: cleaned.cohorts.map((cohort) => ({
    schoolId: cohort.schoolId,
    year: cohort.year,
    scope: cohort.scope,
    curriculumCode: cohort.curriculumCode,
    graduates: cohort.graduates,
    totalOffers: cohort.totalOffers,
    sourceKind: cohort.sourceKind,
    sourceReference: cohort.sourceReference,
    sourceLine: cohort.sourceLine,
    sourceExcerpt: plainText(cohort.sourceExcerpt),
    confidence: cohort.confidence,
    reviewStatus: cohort.reviewStatus,
  })),
  observations: cleaned.observations.map((observation) => ({
    schoolId: observation.schoolId,
    universityId: observation.universityId,
    year: observation.year,
    track: observation.track,
    countKind: observation.countKind,
    countValue: observation.countValue,
    sourceLine: observation.sourceLine,
    sourceExcerpt: plainText(observation.sourceExcerpt),
    attributionStatus: observation.attributionStatus,
    attributions: observation.attributions.map((attribution) => ({
      curriculumCode: attribution.curriculumCode,
      status: attribution.status,
      basis: attribution.basis,
      allocationKind: attribution.allocationKind,
      allocatedCount: attribution.allocatedCount,
      exclusionRisk: attribution.exclusionRisk,
    })),
  })),
}

writeFileSync(output, `${JSON.stringify(published, null, 2)}\n`)
console.log(
  `Published ${published.schools.length} schools, ${published.programs.length} programs, ` +
    `${published.cohorts.length} cohorts, ${published.observations.length} university observations to ${output}`,
)
