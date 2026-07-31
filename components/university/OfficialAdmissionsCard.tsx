import SourcePopover from '@/components/trust/SourcePopover'
import type { University } from '@/types'

function percent(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function schoolYear(start: number): string {
  return `${start}–${String(start + 1).slice(-2)}`
}

export function OfficialAdmissionsCard({ university }: { university: University }) {
  const snapshot = university.officialAdmissions[0]

  if (!snapshot) {
    return (
      <aside className="mt-5 border-y border-ink/15 py-4">
        <p className="label text-ink/40">Official admissions · 待补</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/60">
          {university.nameCn}仍保留在大学地图和已有生源校录取数据中；目前尚未发布经过复核的全校
          申请、录取与入学人数。这里不使用估算值补空。
        </p>
      </aside>
    )
  }

  return (
    <aside className="mt-5 border-y border-ink py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label text-ink/40">Official admissions · CDS C1</p>
        <SourcePopover sourceIds={[snapshot.sourceId]}>
          <span className="text-xs text-ink/60">查看官方来源 →</span>
        </SourcePopover>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-5">
        <Metric label="申请" value={snapshot.applied.toLocaleString('en-US')} />
        <Metric label="录取" value={snapshot.admitted.toLocaleString('en-US')} />
        <Metric label="入学" value={snapshot.enrolled.toLocaleString('en-US')} />
        <Metric label="录取率" value={percent(snapshot.admitted, snapshot.applied)} />
        <Metric label="录取后入学率" value={percent(snapshot.enrolled, snapshot.admitted)} />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink/50 tnum">
        {schoolYear(snapshot.academicYearStart)} 学年 · 全日制/非全日制本科新生合计
        {snapshot.campus ? ` · ${snapshot.campus} 校区` : ''} · L1 官方一手
      </p>
    </aside>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink/40">{label}</p>
      <p className="mt-1 text-xl tracking-tight tnum sm:text-2xl">{value}</p>
    </div>
  )
}
