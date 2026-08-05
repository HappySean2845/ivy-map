import {
  ATTRIBUTION_STATUS_LABEL,
  CURRICULUM_LABEL,
  type AdmissionAttribution,
  type AttributionStatus,
  type CourseAdmissionObservation,
} from '@/types/course-attribution'
import {
  courseAttributionData,
  universityCourseEvidence,
  type SchoolAttributionView,
} from '@/lib/v2/course-attribution'
import { RegionSchoolTabs, type RegionSchoolGroup } from '@/components/v2/RegionSchoolTabs'

const STATUS_STYLE: Record<AttributionStatus, string> = {
  confirmed: 'border-ink bg-ink text-paper',
  inferred: 'border-ink text-ink',
  possible: 'border-ink/25 text-ink/55',
  excluded: 'border-ink/15 text-ink/40 line-through',
}

const COUNT_KIND_LABEL: Record<CourseAdmissionObservation['countKind'], string> = {
  admits: '录取人数',
  offers: 'offer',
  reported: '原文报告',
  estimated: '估算',
  enrolled: '入学人数',
  interviews: '面试',
}

const REGION_ORDER = ['北京', '上海', '广州', '深圳', '广东 / 港澳', '江浙', '其他']

function attributionKey(attribution: AdmissionAttribution) {
  return `${attribution.curriculumCode}:${attribution.status}:${attribution.exclusionRisk}`
}

function schoolAttributions(view: SchoolAttributionView): AdmissionAttribution[] {
  const unique = new Map<string, AdmissionAttribution>()
  for (const observation of view.observations) {
    for (const attribution of observation.attributions) {
      unique.set(attributionKey(attribution), attribution)
    }
  }
  return [...unique.values()]
}

function yearRange(years: number[]) {
  if (years.length === 0) return '年份未明'
  if (years.length === 1) return `${years[0]}`
  return `${years.at(-1)}–${years[0]}`
}

function formatHitRate(rate: number | null) {
  if (rate == null) return '—'
  const percentage = rate * 100
  return `${percentage >= 10 ? percentage.toFixed(1) : percentage.toFixed(2)}%`
}

export function UniversityPathways({
  universityId,
  universityNameCn,
}: {
  universityId: string
  universityNameCn: string
}) {
  const evidence = universityCourseEvidence(universityId)

  if (evidence.schools.length === 0) {
    return (
      <section className="mt-12">
        <p className="label text-ink/40">课程与国内生源校</p>
        <hr className="mt-2 border-ink" />
        <h2 className="mt-5 text-xl leading-tight">
          还没有收录往{universityNameCn}的高中去向记录
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">
          当前资料覆盖 31 所目标大学；没有记录就保持空白，不用估算值补齐。
        </p>
      </section>
    )
  }

  const schoolsByRegion = new Map<string, SchoolAttributionView[]>()
  for (const school of evidence.schools) {
    schoolsByRegion.set(school.regionLabel, [
      ...(schoolsByRegion.get(school.regionLabel) ?? []),
      school,
    ])
  }
  const regionLabels = [...schoolsByRegion.keys()].sort(
    (left, right) =>
      (REGION_ORDER.indexOf(left) === -1 ? REGION_ORDER.length : REGION_ORDER.indexOf(left)) -
        (REGION_ORDER.indexOf(right) === -1 ? REGION_ORDER.length : REGION_ORDER.indexOf(right)) ||
      left.localeCompare(right, 'zh'),
  )
  const regionGroups: RegionSchoolGroup[] = regionLabels.map((label, regionIndex) => {
    const schools = schoolsByRegion.get(label) ?? []
    return {
      id: `school-region-${regionIndex}`,
      label,
      count: schools.length,
      content: (
        <ul className="mt-6 grid items-start gap-4 lg:grid-cols-2">
          {schools.map((view, schoolIndex) => (
            <FeederSchoolCard key={view.school.id} view={view} index={schoolIndex + 1} />
          ))}
        </ul>
      ),
    }
  })

  return (
    <>
      <section className="mt-12">
        <p className="label text-ink/40">课程路径</p>
        <hr className="mt-2 border-ink" />
        <div className="mt-5 grid border border-ink sm:grid-cols-3">
          {evidence.routes.map((route, index) => (
            <div
              key={route.curriculumCode}
              className={`p-5 sm:p-6 ${index > 0 ? 'border-t border-ink sm:border-t-0 sm:border-l' : ''}`}
            >
              <p className="label text-ink/40">{CURRICULUM_LABEL[route.curriculumCode]}</p>
              <p className="mt-3 text-3xl tracking-tight tnum">
                {route.confirmedSchools}
                <span className="ml-1 text-xs text-ink/40">所已证实</span>
              </p>
              <p className="mt-3 text-xs leading-relaxed text-ink/55 tnum">
                {route.inferredSchools} 所方向性归因 · {route.possibleSchools} 所可能涉及 ·{' '}
                {route.observations} 条原文记录
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-ink/45">
          “已证实”表示来源点名学部或该校当届为单轨；“方向性”是根据主力课程与去向规律判断；
          “可能涉及”表示原始放榜没有拆到 AP / IB / A-Level，不能拿来做分赛道人均排名。
        </p>
      </section>

      <section className="mt-12">
        <p className="label text-ink/40">对应高中</p>
        <hr className="mt-2 border-ink" />
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl leading-tight sm:text-[32px]">
            {evidence.schools.length} 所高中有去向证据
          </h2>
          <p className="text-xs text-ink/45 tnum">
            {evidence.observations.length} 条记录 ·{' '}
            {courseAttributionData.source.capturedAt.slice(0, 10)} 整理
          </p>
        </div>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-ink/45">
          先选地区，再看该地区的高中。命中率沿用旧榜单口径：近三届加权录取人数 ÷
          对应赛道加权毕业生数；缺少毕业生分母时显示“—”。
        </p>
        <RegionSchoolTabs groups={regionGroups} />
      </section>
    </>
  )
}

function FeederSchoolCard({ view, index }: { view: SchoolAttributionView; index: number }) {
  const attributions = schoolAttributions(view)
  const primaryPrograms = view.programs.filter((program) =>
    ['AP', 'IB', 'ALEVEL'].includes(program.curriculumCode),
  )
  const otherPrograms = view.programs.filter(
    (program) => !['AP', 'IB', 'ALEVEL'].includes(program.curriculumCode),
  )

  return (
    <li className="border border-ink/20 p-5 sm:p-6">
      <header className="flex items-start gap-3">
        <span className="label mt-1 shrink-0 text-ink/35 tnum">
          {String(index).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <h3 className="text-lg leading-tight">{view.school.nameCn}</h3>
          {view.school.nameEn && (
            <p className="mt-1 text-xs text-ink/45">{view.school.nameEn}</p>
          )}
          <p className="mt-1.5 text-xs text-ink/55 tnum">
            {view.regionLabel} · {yearRange(view.years)} · {view.observations.length} 条记录 ·
            原文计数合计 {view.reportedTotal}
          </p>
        </div>
        <div className="ml-auto shrink-0 border-l border-ink/15 pl-4 text-right">
          <p className="label text-ink/40">命中率</p>
          <p
            className={`mt-1 text-xl tracking-tight tnum ${
              view.hitRate == null ? 'text-ink/30' : 'text-ink'
            }`}
          >
            {formatHitRate(view.hitRate)}
          </p>
        </div>
      </header>

      <dl className="mt-4 border-t border-ink/15 pt-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-[5rem_1fr]">
          <dt className="label text-ink/40">学校课程</dt>
          <dd className="flex flex-wrap gap-1.5">
            {primaryPrograms.length > 0 ? (
              primaryPrograms.map((program) => (
                <span
                  key={program.curriculumCode}
                  className="border border-ink/20 px-2 py-0.5 text-xs"
                >
                  {CURRICULUM_LABEL[program.curriculumCode]}
                  {program.isSingleTrack ? ' · 单轨' : ''}
                </span>
              ))
            ) : (
              <span className="text-xs text-ink/45">AP / IB / A-Level 课程未核实</span>
            )}
            {otherPrograms.length > 0 && (
              <span className="border border-ink/15 px-2 py-0.5 text-xs text-ink/45">
                另有{' '}
                {otherPrograms
                  .map((program) => CURRICULUM_LABEL[program.curriculumCode])
                  .join(' / ')}
              </span>
            )}
          </dd>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[5rem_1fr]">
          <dt className="label text-ink/40">学部归因</dt>
          <dd className="flex flex-wrap gap-1.5">
            {attributions.map((attribution) => (
              <span
                key={attributionKey(attribution)}
                className={`border px-2 py-0.5 text-xs ${STATUS_STYLE[attribution.status]}`}
              >
                {CURRICULUM_LABEL[attribution.curriculumCode]} ·{' '}
                {ATTRIBUTION_STATUS_LABEL[attribution.status]}
                {attribution.exclusionRisk ? ' · 有排除风险' : ''}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      <details className="mt-4 border-t border-ink/15 pt-3">
        <summary className="cursor-pointer text-xs text-ink/60">
          查看 {view.observations.length} 条逐年原文记录
        </summary>
        <ol className="mt-3 space-y-3">
          {view.observations.map((observation, observationIndex) => (
            <li
              key={`${observation.year}:${observation.sourceLine}:${observationIndex}`}
              className="border-t border-ink/10 pt-3 text-xs leading-relaxed first:border-t-0 first:pt-0"
            >
              <p className="text-ink/70 tnum">
                {observation.year} · {COUNT_KIND_LABEL[observation.countKind]}{' '}
                {observation.countValue} ·{' '}
                {ATTRIBUTION_STATUS_LABEL[observation.attributionStatus]}
              </p>
              <p className="mt-1 text-ink/45">{observation.sourceExcerpt}</p>
            </li>
          ))}
        </ol>
      </details>
    </li>
  )
}

export default UniversityPathways
