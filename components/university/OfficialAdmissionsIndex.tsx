import type { University } from '@/types'

interface Props {
  universities: University[]
  selectedId: string | null
  onSelect(id: string): void
}

function percent(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

export function OfficialAdmissionsIndex({ universities, selectedId, onSelect }: Props) {
  const available = universities
    .filter((university) => university.officialAdmissions.length > 0)
    .sort((left, right) => left.nameEn.localeCompare(right.nameEn))

  return (
    <aside className="flex h-full flex-col" aria-label="已有大学官方录取数据">
      <div className="flex min-h-[42px] items-center justify-between border-b border-ink/15 px-4 py-2 sm:px-6">
        <span className="label text-ink/40">OFFICIAL DATA</span>
        <span className="text-xs text-ink/50 tnum">{available.length} 所已复核</span>
      </div>

      <div className="divide-y divide-ink/10">
        {available.map((university) => {
          const snapshot = university.officialAdmissions[0]
          const selected = university.id === selectedId
          return (
            <button
              key={university.id}
              onClick={() => onSelect(university.id)}
              aria-pressed={selected}
              className={`grid min-h-[55px] w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink sm:px-6 ${
                selected ? 'bg-ink text-paper' : 'hover:bg-ink/[0.04]'
              }`}
              data-tap
            >
              <span>
                <span className="block text-sm">{university.nameCn}</span>
                <span
                  className={`mt-0.5 block text-[11px] ${selected ? 'text-paper/55' : 'text-ink/40'}`}
                >
                  {snapshot.academicYearStart}–
                  {String(snapshot.academicYearStart + 1).slice(-2)} 学年
                  {snapshot.campus ? ` · ${snapshot.campus}` : ''}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-lg tnum">
                  {percent(snapshot.admitted, snapshot.applied)}
                </span>
                <span
                  className={`block text-[10px] ${selected ? 'text-paper/55' : 'text-ink/40'}`}
                >
                  录取率
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-auto border-t border-ink/15 px-4 py-2 text-[11px] leading-relaxed text-ink/40 sm:px-6">
        仅列出已抓取、已复核且申请/录取/入学三项完整的官方数据；不使用估算值补空。
      </p>
    </aside>
  )
}
