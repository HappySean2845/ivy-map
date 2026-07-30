// 大学录取画像（PRD US-1.2）。
//
// 三条硬要求，一条都不能省：
//   1. 每个数值标口径（人数 / offer / 估算）并可溯源 —— 见 BasisNote / SourcePopover。
//   2. CAI 没算出来就说「暂未评级」，**不给一个看起来像评级的字母**。
//   3. 杠杆率为「低」时文案要明确劝用户把精力放在别处（PRD 原则 §5.6）——
//      这句话由 lib/copy 的 leverageCopy 生成，本组件只负责让它显眼。
//
// 没有回调、没有 hooks，所以服务端和客户端两棵树都能渲染它。

import BasisNote from '@/components/trust/BasisNote'
import ConfidenceBadge from '@/components/trust/ConfidenceBadge'
import SourcePopover from '@/components/trust/SourcePopover'
import { leverageCopy } from '@/lib/copy'
import type { University } from '@/types'

import { universityProfile } from './derive'

const REGION_LABEL: Record<string, string> = {
  US: '美国',
  UK: '英国',
  HK: '中国香港',
  CA: '加拿大',
  JP: '日本',
}

const LEVERAGE_LABEL = { high: '高', mid: '中', low: '低' } as const

const CAI_DIM_LABEL: Record<string, string> = {
  volume: '录取体量',
  trend: '趋势',
  breadth: '来源广度',
  presence: '在华投入',
  aid: '国际生资助',
}

function fmt(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

export function UniversityCard({ university }: { university: University }) {
  const profile = universityProfile(university.id)
  const level = university.leverage?.level ?? null
  const maxYear = profile
    ? profile.byYear.reduce((m, y) => Math.max(m, y.admits), 0)
    : 0

  return (
    <section
      aria-label={`${university.nameCn}的录取画像`}
      className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <header>
        <h2 className="text-base font-semibold tracking-tight">{university.nameCn}</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          {university.nameEn}
          {university.city ? ` · ${university.city}` : ''}
          {university.country ? ` · ${REGION_LABEL[university.country] ?? university.country}` : ''}
        </p>
      </header>

      {!profile ? (
        <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
          暂未收录这所大学的中国大陆生源校数据。这不等于「没有中国学生」，只表示我们还没有可逐条溯源的公开记录。
        </p>
      ) : (
        <>
          {/* ---- 近三年趋势。口径必须明标（US-1.2 验收项）---- */}
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-medium text-neutral-500">近三年中国大陆录取</h3>
              <BasisNote basis={profile.basis} />
              <ConfidenceBadge
                level={profile.confidence}
                estimated={profile.basis === 'estimated'}
              />
            </div>

            <ul className="mt-2 space-y-1.5">
              {profile.byYear.map((y) => (
                <li key={y.year} className="flex items-center gap-2.5">
                  <span className="w-9 shrink-0 font-mono text-[11px] tabular-nums text-neutral-500">
                    {y.year}
                  </span>
                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
                    <span
                      className="block h-full rounded-full bg-emerald-500/70 dark:bg-emerald-400/70"
                      style={{ width: `${maxYear > 0 ? (y.admits / maxYear) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-right font-mono text-[12px] tabular-nums">
                    <SourcePopover sourceIds={profile.sourceIds}>{fmt(y.admits)} 人</SourcePopover>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
              逐年为已收录生源校的录取人数合计，未加权；下方榜单用的是「近三年加权」口径（0.5 / 0.3 /
              0.2）。画像不随榜单筛选变化。
            </p>
          </div>

          {/* ---- 生源地域 Top 5 ---- */}
          <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-neutral-900">
            <h3 className="text-xs font-medium text-neutral-500">
              生源地域 Top {profile.topCities.length}
            </h3>
            <ul className="mt-2 space-y-1">
              {profile.topCities.map((c) => (
                <li key={c.cityId} className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span>{c.name}</span>
                  <span className="font-mono text-[12px] tabular-nums text-neutral-500">
                    {fmt(c.volume)} 人 · {Math.round(c.share * 100)}%
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
              占比的分母是已收录的 {profile.schoolCount} 所生源校合计 {fmt(profile.totalVolume)}{' '}
              人，不是这所大学的全部中国录取。
            </p>
          </div>
        </>
      )}

      {/* ---- 中国友好度 CAI ---- */}
      <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-neutral-900">
        <h3 className="text-xs font-medium text-neutral-500">中国友好度 CAI</h3>
        {university.cai ? (
          <>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl leading-none">{university.cai.grade}</span>
              <span className="text-[11px] text-neutral-500">A–E 五级</span>
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
              {Object.entries(university.cai.dims).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span className="text-neutral-500">{CAI_DIM_LABEL[k] ?? k}</span>
                  <span className="font-mono tabular-nums">
                    <SourcePopover sourceIds={university.cai?.sourceIds ?? []}>{v} / 2</SourcePopover>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">
            暂未评级。CAI 的五个维度（录取体量、趋势、来源广度、在华投入、国际生资助）里，「在华投入」和「国际生资助」这两项需要大学官方口径的资料，目前还没有采到可溯源的来源，所以这里不给一个看起来像评级的字母。
          </p>
        )}
      </div>

      {/* ---- 择校杠杆率。低杠杆的那句话是全站可信度最高的一句，别藏起来 ---- */}
      <div
        className={`mt-4 rounded-md border p-3 ${
          level === 'low'
            ? 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'
            : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-medium text-neutral-500">择校杠杆率</h3>
          <span className="font-mono text-[13px]">
            {level ? LEVERAGE_LABEL[level] : '样本不足'}
            {university.leverage ? (
              <span className="ml-1.5 text-[11px] text-neutral-400">
                HHI {university.leverage.hhi.toFixed(3)}
              </span>
            ) : null}
          </span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-600 dark:text-neutral-300">
          {leverageCopy(level, university.nameCn)}
        </p>
      </div>
    </section>
  )
}

export default UniversityCard
