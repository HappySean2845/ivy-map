import { schoolById, sourceById } from '@/lib/data'
import type { FeederEvidence, University } from '@/types'

interface Props {
  university: University
  evidence: FeederEvidence[]
}

export function FeederEvidencePanel({ university, evidence }: Props) {
  if (evidence.length === 0) return null
  const rows = [...evidence].sort(
    (left, right) =>
      right.countValue - left.countValue ||
      (schoolById.get(left.schoolId)?.nameCn ?? left.schoolId).localeCompare(
        schoolById.get(right.schoolId)?.nameCn ?? right.schoolId,
        'zh-CN',
      ),
  )
  const total = rows.reduce((sum, row) => sum + row.countValue, 0)
  const source = sourceById.get(rows[0].sourceId)

  return (
    <section className="mt-6 border border-ink bg-paper">
      <div className="grid gap-5 border-b border-ink p-5 sm:grid-cols-[1fr_auto] sm:p-6">
        <div>
          <p className="label text-ink/40">Feeder evidence · 未拆分赛道</p>
          <h2 className="mt-2 text-xl leading-tight sm:text-2xl">
            {university.nameCn} · 2026Fall 北京早申去向
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/60">
            这是媒体汇总的北京公办国际部早申 offer，不是大学官方全校录取数据；来源没有拆分
            AP、IB 或 A-Level，因此只作为去向证据展示，不参与密度排名。
          </p>
        </div>
        <div className="border-l-0 border-ink pl-0 sm:border-l sm:pl-6">
          <p className="text-3xl tnum">{total}</p>
          <p className="mt-1 text-xs text-ink/50">枚早申 offer · {rows.length} 所高中</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink/15 text-left text-xs text-ink/45">
              <th className="px-5 py-3 font-normal sm:px-6">高中</th>
              <th className="px-5 py-3 font-normal">城市</th>
              <th className="px-5 py-3 text-right font-normal">2026Fall 早申</th>
              <th className="px-5 py-3 font-normal sm:px-6">赛道口径</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const school = schoolById.get(row.schoolId)
              return (
                <tr
                  key={`${row.schoolId}-${row.universityId}`}
                  className="border-b border-ink/10 last:border-b-0"
                >
                  <td className="px-5 py-3 sm:px-6">{school?.nameCn ?? row.schoolId}</td>
                  <td className="px-5 py-3 text-ink/55">北京</td>
                  <td className="px-5 py-3 text-right text-lg tnum">{row.countValue} 枚</td>
                  <td className="px-5 py-3 text-ink/55 sm:px-6">未拆分 · 不参与排名</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-ink/15 px-5 py-3 text-xs leading-relaxed text-ink/50 sm:px-6">
        口径：早申合计 · offer 数 · L2 二手来源 · 非完整名单
        {source && (
          <>
            {' · '}
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-ink underline underline-offset-2"
            >
              查看原始来源 ↗
            </a>
          </>
        )}
      </div>
    </section>
  )
}
