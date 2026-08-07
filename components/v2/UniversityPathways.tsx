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
  type DestinationDensity,
  type SchoolAttributionView,
} from '@/lib/v2/course-attribution'
import {
  destinationSharesForUniversity,
  formatDestinationShare,
} from '@/lib/v2/university-enrichment'
import { RegionSchoolTabs, type RegionSchoolGroup } from '@/components/v2/RegionSchoolTabs'
import type { DestinationShareObservation } from '@/types/university-enrichment'

const STATUS_STYLE: Record<AttributionStatus, string> = {
  confirmed: 'border-forest bg-forest text-paper',
  inferred: 'border-leaf bg-surface text-forest',
  possible: 'border-line bg-cream text-ink/60',
  excluded: 'border-line text-ink/40 line-through',
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

const OUTCOME_LABEL: Record<DestinationShareObservation['outcomeKind'], string> = {
  offers: 'offer',
  admits: '录取',
  unknown: '去向记录',
}

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

function formatDensity(density: DestinationDensity) {
  const value = density.perHundred
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} / 百人`
}

function densityYears(density: DestinationDensity) {
  const years = yearRange(density.years)
  return density.partial ? `${years} · 部分年份` : years
}

export function UniversityPathways({
  universityId,
  universityNameCn,
}: {
  universityId: string
  universityNameCn: string
}) {
  const evidence = universityCourseEvidence(universityId)
  const destinationShares = destinationSharesForUniversity(universityId)
  const destinationSharesBySchool = new Map<string, DestinationShareObservation[]>()
  for (const observation of destinationShares) {
    destinationSharesBySchool.set(observation.schoolId, [
      ...(destinationSharesBySchool.get(observation.schoolId) ?? []),
      observation,
    ])
  }

  if (evidence.schools.length === 0) {
    return (
      <section className="mt-12 rounded-[14px] border border-line bg-surface p-5 sm:p-7">
        <p className="label text-leaf">课程与国内生源校</p>
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
        (REGION_ORDER.indexOf(right) === -1
          ? REGION_ORDER.length
          : REGION_ORDER.indexOf(right)) || left.localeCompare(right, 'zh'),
  )
  const schoolDensityCount = evidence.schools.filter((school) => school.schoolDensity).length
  const departmentDensityCount = evidence.schools.reduce(
    (sum, school) => sum + school.departmentDensities.length,
    0,
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
            <FeederSchoolCard
              key={view.school.id}
              view={view}
              index={schoolIndex + 1}
              destinationShares={destinationSharesBySchool.get(view.school.id) ?? []}
            />
          ))}
        </ul>
      ),
    }
  })

  return (
    <>
      <section className="mt-12">
        <p className="label text-leaf">课程路径</p>
        <h2 className="mt-3 text-2xl text-forest-deep sm:text-[34px]">
          从课程体系看可追溯的去向
        </h2>
        <div className="mt-5 grid overflow-hidden rounded-[14px] border border-line bg-surface sm:grid-cols-3">
          {evidence.routes.map((route, index) => (
            <div
              key={route.curriculumCode}
              className={`p-5 sm:p-6 ${index > 0 ? 'border-t border-line sm:border-l sm:border-t-0' : ''}`}
            >
              <p className="label text-leaf">{CURRICULUM_LABEL[route.curriculumCode]}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-forest tnum">
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
        <p className="label text-leaf">对应高中</p>
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl leading-tight text-forest-deep sm:text-[32px]">
            {evidence.schools.length} 所高中有去向证据
          </h2>
          <p className="text-xs text-ink/45 tnum">
            {schoolDensityCount} 所整校可算 · {departmentDensityCount} 条学部可算 ·{' '}
            {destinationShares.filter((item) => item.share != null).length} 条大学生源占比可算 ·{' '}
            {courseAttributionData.source.capturedAt.slice(0, 10)} 整理
          </p>
        </div>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-ink/45">
          先选地区，再看该地区的高中。整校去向密度是同年公开录取记录数 ÷ 全校毕业生数 ×
          100；学部去向密度只在课程归因和该学部毕业生数都已证实时计算。它不是申请录取率，
          同一学生可能持有多份 offer；缺少分母时明确标为“待补毕业生数”。
        </p>
        <RegionSchoolTabs groups={regionGroups} />
      </section>
    </>
  )
}

function FeederSchoolCard({
  view,
  index,
  destinationShares,
}: {
  view: SchoolAttributionView
  index: number
  destinationShares: DestinationShareObservation[]
}) {
  const attributions = schoolAttributions(view)
  const primaryPrograms = view.programs.filter((program) =>
    ['AP', 'IB', 'ALEVEL'].includes(program.curriculumCode),
  )
  const otherPrograms = view.programs.filter(
    (program) => !['AP', 'IB', 'ALEVEL'].includes(program.curriculumCode),
  )
  const headlineDensity = view.schoolDensity ?? view.departmentDensities[0] ?? null
  const headlineLabel = view.schoolDensity
    ? '整校去向密度'
    : headlineDensity?.curriculumCode
      ? `${CURRICULUM_LABEL[headlineDensity.curriculumCode]} 学部去向密度`
      : '去向密度'
  const orderedShares = [...destinationShares].sort((left, right) => right.year - left.year)
  const latestShare = orderedShares[0] ?? null

  return (
    <li className="rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-leaf hover:shadow-[var(--shadow-card)] sm:p-6">
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
        <div className="ml-auto shrink-0 rounded-lg bg-cream px-3 py-2.5 text-right">
          <p className="label max-w-28 text-leaf">{headlineLabel}</p>
          <p
            className={`mt-1 tracking-tight tnum ${
              headlineDensity
                ? 'text-xl font-semibold text-forest'
                : 'max-w-28 text-xs text-ink/35'
            }`}
          >
            {headlineDensity ? formatDensity(headlineDensity) : '待补毕业生数'}
          </p>
          {headlineDensity && (
            <p className="mt-1 text-[10px] text-ink/35 tnum">{densityYears(headlineDensity)}</p>
          )}
        </div>
      </header>

      <dl className="mt-4 border-t border-line pt-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-[5rem_1fr]">
          <dt className="label text-ink/40">学校课程</dt>
          <dd className="flex flex-wrap gap-1.5">
            {primaryPrograms.length > 0 ? (
              primaryPrograms.map((program) => (
                <span
                  key={program.curriculumCode}
                  className="rounded-md border border-line bg-cream px-2.5 py-1 text-xs text-forest"
                >
                  {CURRICULUM_LABEL[program.curriculumCode]}
                  {program.isSingleTrack ? ' · 单轨' : ''}
                </span>
              ))
            ) : (
              <span className="text-xs text-ink/45">AP / IB / A-Level 课程未核实</span>
            )}
            {otherPrograms.length > 0 && (
              <span className="rounded-md border border-line px-2.5 py-1 text-xs text-ink/50">
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
                className={`rounded-md border px-2.5 py-1 text-xs ${STATUS_STYLE[attribution.status]}`}
              >
                {CURRICULUM_LABEL[attribution.curriculumCode]} ·{' '}
                {ATTRIBUTION_STATUS_LABEL[attribution.status]}
                {attribution.exclusionRisk ? ' · 有排除风险' : ''}
              </span>
            ))}
          </dd>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[5rem_1fr]">
          <dt className="label text-ink/40">密度分母</dt>
          <dd className="flex flex-wrap gap-1.5">
            {view.schoolDensity && (
              <span className="rounded-md border border-line bg-cream px-2.5 py-1 text-xs tnum">
                整校 · {formatDensity(view.schoolDensity)} · {densityYears(view.schoolDensity)}
              </span>
            )}
            {view.departmentDensities.map((density) => (
              <span
                key={density.curriculumCode}
                className="rounded-md border border-line bg-cream px-2.5 py-1 text-xs tnum"
              >
                {CURRICULUM_LABEL[density.curriculumCode!]} 学部 · {formatDensity(density)} ·{' '}
                {densityYears(density)}
              </span>
            ))}
            {!view.schoolDensity && view.departmentDensities.length === 0 && (
              <span className="text-xs text-ink/45">待补同届毕业生数，暂不计算</span>
            )}
          </dd>
        </div>

        {latestShare && (
          <div className="mt-3 grid gap-2 rounded-lg bg-cream p-3 sm:grid-cols-[5rem_1fr]">
            <dt className="label text-ink/40">大学生源占比</dt>
            <dd>
              {latestShare.share != null && latestShare.denominator != null ? (
                <>
                  <p className="text-sm text-ink/75 tnum">
                    {latestShare.numerator} / {latestShare.denominator} ={' '}
                    <strong className="font-medium">
                      {formatDestinationShare(latestShare.share)}
                    </strong>
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink/45">
                    {latestShare.year} · {OUTCOME_LABEL[latestShare.outcomeKind]} · 分母范围：
                    {latestShare.denominatorScopeLabel ?? '未注明'}
                    {latestShare.denominatorStatus === 'estimated' && ' · 分母为估算'}
                  </p>
                </>
              ) : (
                <p className="text-xs leading-relaxed text-ink/50">
                  {latestShare.year} 已收录 {latestShare.numerator} 条
                  {OUTCOME_LABEL[latestShare.outcomeKind]}
                  ，但大学对应中国学生总数待补，暂不计算比例。
                </p>
              )}
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink/40">
                表示这所高中占该大学对应中国学生录取或 offer
                总数的比例，不是学生个人命中率，也不是上方“每百名高中毕业生”的去向密度。
              </p>

              {orderedShares.length > 1 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-ink/55">
                    查看 {orderedShares.length} 年记录
                  </summary>
                  <ol className="mt-2 space-y-1.5 border-l border-leaf/30 pl-3">
                    {orderedShares.map((observation) => (
                      <li
                        key={`${observation.year}:${observation.outcomeKind}`}
                        className="text-[11px] leading-relaxed text-ink/55 tnum"
                      >
                        {observation.year} · {observation.numerator}
                        {observation.denominator != null && ` / ${observation.denominator}`}
                        {observation.share != null &&
                          ` = ${formatDestinationShare(observation.share)}`}
                        {' · '}
                        {OUTCOME_LABEL[observation.outcomeKind]}
                        {observation.denominatorStatus === 'estimated' && ' · 估算分母'}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </dd>
          </div>
        )}
      </dl>

      <details className="mt-4 rounded-lg bg-cream px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-forest">
          查看 {view.observations.length} 条逐年原文记录
        </summary>
        <ol className="mt-3 space-y-3">
          {view.observations.map((observation, observationIndex) => (
            <li
              key={`${observation.year}:${observation.sourceLine}:${observationIndex}`}
              className="border-t border-line pt-3 text-xs leading-relaxed first:border-t-0 first:pt-0"
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
