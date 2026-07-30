'use client'

// 首页的 client 容器。
//
// 为什么要有这一层：如果 Server Component 直接 import FilterBar / WeightSlider
// 这些 'use client' 组件，它们就成了 client entry，Next 会要求函数 props 改名成
// *Action。改名是错的解法 —— 加一层 client 容器，那些组件就不再是 entry，
// onChange 这类命名完全正常。
//
// 这一层同时是 URL 状态的唯一读写点（PRD US-8.2）。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'

import { FeederTable } from '@/components/ranking/FeederTable'
import { WeightSlider } from '@/components/ranking/WeightSlider'
import { FilterBar } from '@/components/ranking/FilterBar'
import { FeasibilityGate } from '@/components/ranking/FeasibilityGate'
import { CompareTable } from '@/components/school/CompareTable'
import { PosterButton } from '@/components/share/PosterButton'

import { dataset, universityById, cityById } from '@/lib/data'
import { DEFAULT_FILTERS, MAX_COMPARE, type Filters, type Gate } from '@/lib/filters'
import { parseFilters, toQueryString } from '@/lib/urlState'
import { buildFeederRows, LATEST_YEAR, type FeederRowView } from '@/lib/view'
import { sliderExplain, leverageCopy, emptyResultCopy } from '@/lib/copy'
import { yearWeight } from '@/lib/scoring'
import { TRACK_LABEL } from '@/types'

// ECharts 要 DOM，不能 SSR
const WorldMap = dynamic(() => import('@/components/map/WorldMap'), { ssr: false })
const ChinaMap = dynamic(() => import('@/components/map/ChinaMap'), { ssr: false })

/** 每所大学的加权录取总量，决定世界地图上点的大小。不随筛选变化，算一次即可。 */
function computeVolumeById(): Record<string, number> {
  const out: Record<string, number> = {}
  if (LATEST_YEAR == null) return out
  for (const a of dataset.admissions) {
    const w = yearWeight(a.year, LATEST_YEAR)
    if (w === 0) continue
    const n = a.admits ?? a.offers
    if (n == null) continue
    out[a.universityId] = (out[a.universityId] ?? 0) + w * n
  }
  return out
}

/** 某一行数据里最近一届的毕业生规模，供滑杆解读文案对比大小校。 */
function latestGraduates(row: FeederRowView): number | null {
  for (const y of row.byYear) if (y.graduates != null) return y.graduates
  return null
}

export default function HomeClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL 是权威状态，但**重排不等 URL** —— 本地 state 立即驱动，
  // 否则滑杆拖动要等一次 router.replace，手感就没了。
  const [filters, setFilters] = useState<Filters>(() => parseFilters(searchParams))

  // 浏览器前进/后退时跟随 URL
  useEffect(() => {
    setFilters(parseFilters(searchParams))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  // 写 URL 节流，避免拖动滑杆时刷出几十条历史
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commit = useCallback(
    (next: Filters) => {
      setFilters(next)
      if (writeTimer.current) clearTimeout(writeTimer.current)
      writeTimer.current = setTimeout(() => {
        // replace 而不是 push —— 滑杆拖动不该污染后退栈
        router.replace(`/?${toQueryString(next)}`, { scroll: false })
      }, 120)
    },
    [router],
  )

  const volumeById = useMemo(computeVolumeById, [])

  const universityId = filters.universityId ?? DEFAULT_FILTERS.universityId
  const university = universityId ? universityById.get(universityId) : undefined

  const rows = useMemo(
    () => (universityId ? buildFeederRows({ universityId, filters }) : []),
    [universityId, filters],
  )

  // 中国地图的热力：按生源校所在城市汇总加权录取量
  const heatByCityId = useMemo(() => {
    const out: Record<string, number> = {}
    for (const r of rows) {
      out[r.school.cityId] = (out[r.school.cityId] ?? 0) + r.volume
    }
    return out
  }, [rows])

  // 滑杆解读：记住上一次的榜首，用来说清「谁换成了谁」
  const prevTopRef = useRef<{ name: string; volume: number; graduates: number | null } | null>(
    null,
  )
  const [explain, setExplain] = useState<string | null>(null)
  useEffect(() => {
    const top = rows[0]
    const nextTop = top
      ? { name: top.school.nameCn, volume: top.volume, graduates: latestGraduates(top) }
      : null
    setExplain(sliderExplain({ prevTop: prevTopRef.current, nextTop, alpha: filters.alpha }))
    if (nextTop) prevTopRef.current = nextTop
  }, [rows, filters.alpha])

  const empty = rows.length === 0 ? emptyResultCopy(filters) : null

  const trackLabel = filters.tracks.length === 1 ? TRACK_LABEL[filters.tracks[0]] : '全部赛道'
  const cityLabel = filters.cityId ? (cityById.get(filters.cityId)?.name ?? '') : '全国'

  const [mapTab, setMapTab] = useState<'world' | 'china'>('world')

  return (
    <>
      {/* ── 当前视图。这一行是动态的（跟着选择变），所以留在 client；
             产品说明那部分是静态的，已经搬到 page.tsx 由服务端直出，
             否则 SSR 出来的 HTML 里只有 Suspense 兜底，SEO 和
             「5 秒自解释」（US-1.0）双双落空。 */}
      <section className="mt-8">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-y-1">
          <div>
            <h2 className="font-serif text-lg leading-snug">
              {university ? `${university.nameCn} · 中国大陆生源校` : '中国大陆生源校'}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted tnum">
              {cityLabel} · {trackLabel} · 近三届加权
            </p>
          </div>
          <div className="flex gap-1 sm:hidden" role="tablist">
            {(['world', 'china'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={mapTab === t}
                onClick={() => setMapTab(t)}
                className={`rounded-sm border px-2.5 py-1 text-xs ${
                  mapTab === t
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-rule text-ink-muted'
                }`}
              >
                {t === 'world' ? '全球大学' : '中国生源'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── 可行性闸门 */}
      <section className="mt-8">
        <h2 className="mb-2 font-serif text-base">一 · 先看你报不报得了</h2>
        <FeasibilityGate
          gate={filters.gate}
          cities={dataset.cities}
          onChange={(gate: Gate) => commit({ ...filters, gate })}
        />
      </section>

      {/* ── 榜单 */}
      <section className="mt-8">
        <h2 className="mb-2 font-serif text-base">二 · 生源校榜单</h2>

        <FilterBar filters={filters} cities={dataset.cities} onChange={commit} />

        <div className="mt-4">
          <WeightSlider
            alpha={filters.alpha}
            onChange={(alpha) => commit({ ...filters, alpha })}
            explain={explain}
            autoDemo
          />
        </div>

        <div className="mt-4">
          {empty ? (
            <div className="border border-rule bg-paper-sunk p-5 text-sm leading-relaxed">
              <p>{empty.text}</p>
              {empty.action && empty.nextFilters && (
                <button
                  onClick={() => commit(empty.nextFilters!)}
                  className="mt-3 rounded-sm border border-accent px-3 py-1.5 text-sm text-accent"
                >
                  {empty.action}
                </button>
              )}
            </div>
          ) : (
            <FeederTable
              rows={rows}
              compare={filters.compare}
              hideIneligible={filters.hideIneligible}
              onToggleCompare={(id) => {
                const has = filters.compare.includes(id)
                const compare = has
                  ? filters.compare.filter((x) => x !== id)
                  : [...filters.compare, id].slice(-MAX_COMPARE)
                commit({ ...filters, compare })
              }}
              onOpen={(id) => router.push(`/school/${id}`)}
            />
          )}
        </div>

        {rows.length > 0 && universityId && (
          <div className="mt-4">
            <PosterButton universityId={universityId} rows={rows} filters={filters} />
          </div>
        )}
      </section>

      {/* ── 双屏地图放在榜单之后。
             原本它在最前面，结果占满整个首屏（约 780px），把榜单和滑杆全推到
             折叠以下 —— 而滑杆的自动演示是 US-1.0 的核心，访客落地根本看不到。
             「这是反着用的」这个认知任务已经由宋体标题和说明段落完成了，
             所以地图从「第一视觉锤」降级为「换一所大学看看」的探索工具：
             先给答案，再给工具。 */}
      <section className="mt-10">
        <h2 className="mb-2 font-serif text-base">三 · 换一所大学，或换一个城市</h2>
        <div className="grid gap-3 border border-rule sm:grid-cols-2">
          <div className={`${mapTab === 'world' ? '' : 'hidden'} sm:block`}>
            <WorldMap
              universities={dataset.universities}
              volumeById={volumeById}
              selectedId={universityId}
              onSelect={(id) => commit({ ...filters, universityId: id })}
            />
          </div>
          <div
            className={`${mapTab === 'china' ? '' : 'hidden'} border-rule sm:block sm:border-l`}
          >
            <ChinaMap
              cities={dataset.cities}
              heatByCityId={heatByCityId}
              selectedCityId={filters.cityId}
              onSelect={(id) => commit({ ...filters, cityId: id })}
            />
          </div>
        </div>

        {university && (
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {leverageCopy(university.leverage?.level ?? null, university.nameCn)}
          </p>
        )}
      </section>

      {/* ── 对比 */}
      {filters.compare.length >= 2 && (
        <section className="mt-10">
          <h2 className="mb-2 font-serif text-base">四 · 并排对比</h2>
          <CompareTable schoolIds={filters.compare} universityId={universityId} />
        </section>
      )}
    </>
  )
}
