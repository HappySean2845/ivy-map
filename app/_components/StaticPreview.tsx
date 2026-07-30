// Suspense 的兜底内容 —— 但它不是骨架屏，是**真的默认榜单**。
//
// useSearchParams 会让最近的 Suspense 边界在静态预渲染时回落到客户端渲染
// （Next.js 的既定行为），也就是说这块 fallback 就是构建产物里那份 HTML：
// 搜索引擎抓到的是它，用户在 JS 到位之前看到的也是它。
//
// 所以这里必须放真实内容，不能放三条灰条 —— 否则 US-1.0「落地即有榜单」
// 和 US-8.5「页面靠前位置有可抓取的内容」在静态 HTML 层面都不成立。
//
// 它是只读的：没有回调、没有交互，交互版由 HomeClient 在客户端接管。

import ConfidenceBadge from '@/components/trust/ConfidenceBadge'
import { universityById } from '@/lib/data'
import { DEFAULT_FILTERS } from '@/lib/filters'
import { buildFeederRows } from '@/lib/view'
import { TRACK_LABEL } from '@/types'

import { UniversityCard } from './UniversityCard'

const PREVIEW_ROWS = 8

const DASH = '—'

function fmtVolume(v: number): string {
  const r = Math.round(v * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

function fmtDensity(d: number | null): string {
  if (d == null) return DASH
  const pct = d * 100
  return `${pct >= 10 ? pct.toFixed(1) : pct.toFixed(2)}%`
}

export function StaticPreview() {
  const universityId = DEFAULT_FILTERS.universityId
  const university = universityId ? (universityById.get(universityId) ?? null) : null
  const rows = universityId
    ? buildFeederRows({ universityId, filters: DEFAULT_FILTERS })
    : []

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <h2 className="text-sm font-medium">
          {university ? `${university.nameCn} 的国内生源校榜单` : '生源校榜单'}
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
          当前口径：近三年加权去重人数（最近一届 0.5 / 前一届 0.3 / 再前一届
          0.2）；人均密度 = 加权录取人数 ÷ 该赛道加权毕业生数。
        </p>

        {rows.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-neutral-300 p-4 text-[13px] leading-relaxed text-neutral-500 dark:border-neutral-700">
            暂无可展示的榜单数据。
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full min-w-[34rem] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-neutral-200 text-[11px] text-neutral-500 dark:border-neutral-800">
                  <th scope="col" className="px-2.5 py-2 text-left font-medium">#</th>
                  <th scope="col" className="px-2.5 py-2 text-left font-medium">学校</th>
                  <th scope="col" className="px-2.5 py-2 text-left font-medium">赛道</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">近三年录取</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">人均密度</th>
                  <th scope="col" className="px-2.5 py-2 text-left font-medium">置信</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_ROWS).map((r) => (
                  <tr
                    key={r.school.id}
                    className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
                  >
                    <td className="px-2.5 py-2.5 font-mono tabular-nums text-neutral-400">{r.rank}</td>
                    <td className="px-2.5 py-2.5">
                      <a
                        href={`/school/${r.school.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {r.school.nameCn}
                      </a>
                      <span className="ml-1.5 text-[11px] text-neutral-400">{r.cityName}</span>
                    </td>
                    <td className="px-2.5 py-2.5 text-[11px] text-neutral-500">
                      {r.school.tracks.map((t) => TRACK_LABEL[t]).join(' / ')}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {fmtVolume(r.volume)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {fmtDensity(r.density)}
                      {r.denominatorMissing ? (
                        <span className="ml-1 text-[10px] text-neutral-400">分母缺失</span>
                      ) : null}
                    </td>
                    <td className="px-2.5 py-2.5">
                      <ConfidenceBadge level={r.confidence} estimated={r.basis === 'estimated'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
          这是默认视图的静态版本。地图、筛选、「规模 ↔ 概率」滑杆与可行性闸门会在页面加载完成后就位。
        </p>
      </div>

      {university ? (
        <div className="min-w-0">
          <UniversityCard university={university} />
        </div>
      ) : null}
    </div>
  )
}

export default StaticPreview
