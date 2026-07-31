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
import { OfficialAdmissionsCard } from '@/components/university/OfficialAdmissionsCard'

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
    // 这里同步的是浏览器导航这一外部状态；本地 state 仍负责滑杆的即时响应。
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const volumeById = useMemo(() => computeVolumeById(), [])

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

  return (
    <>
      {/* ── 双屏地图前置。
             地图是**控制器**：在上面选大学、选城市，下面的榜单整个跟着变。
             控制器就该在它所控制的东西前面 —— 之前放在榜单之后，用户点完
             地图还得往回滚才能看到变化，是反的。

             左右布局 + 全幅撑满：并排时每张图拿到约 50vw × 400px 的横向容器，
             世界地图（280°×50° 的极扁横向）终于填得满；上一版竖向容器怎么调
             视野都只能缩成一颗小地球。移动端没有横向空间，退回上下堆叠。 */}
      <section className="mt-12 sm:mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <p className="label text-ink/40">01 / MAP · 先选目标</p>
          <hr className="mt-2 border-ink" />
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/60">
            左图点一所大学，右图立刻按生源校所在城市点亮，下面的榜单也跟着换。
            生源校录取数据目前仍以牛津和剑桥为主；大学官方公布的全校申请、录取与入学数据会在地图下方单独展示，
            不会混进高中榜单口径。其余空心点表示尚无生源校记录（见{' '}
            <a href="/about" className="text-ink/80">
              关于页
            </a>
            ）。
          </p>
        </div>

        {/* 全幅撑满：地图不受 max-w-6xl 约束，跟着屏幕走 */}
        <div className="mt-5 grid border-y border-ink lg:grid-cols-2">
          <div className="border-ink lg:border-r">
            <WorldMap
              universities={dataset.universities}
              volumeById={volumeById}
              selectedId={universityId}
              onSelect={(id) => commit({ ...filters, universityId: id })}
            />
          </div>
          <div className="border-t border-ink lg:border-t-0">
            <ChinaMap
              cities={dataset.cities}
              heatByCityId={heatByCityId}
              selectedCityId={filters.cityId}
              onSelect={(id) => commit({ ...filters, cityId: id })}
            />
          </div>
        </div>

        {university && (
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <OfficialAdmissionsCard university={university} />
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-ink/60">
              {leverageCopy(university.leverage?.level ?? null, university.nameCn)}
            </p>
          </div>
        )}
      </section>

      {/* ── 可行性闸门 */}
      <section className="mx-auto max-w-6xl px-4 sm:px-8 mt-14 sm:mt-20">
        <p className="label text-ink/40">02 / ELIGIBILITY</p>
        <hr className="mt-2 border-ink" />
        <h2 className="mt-5 text-2xl leading-tight sm:text-[40px]">先看你报不报得了</h2>
        <div className="mt-6">
          <FeasibilityGate
            gate={filters.gate}
            cities={dataset.cities}
            onChange={(gate: Gate) => commit({ ...filters, gate })}
          />
        </div>
      </section>

      {/* ── 榜单 */}
      <section className="mx-auto max-w-6xl px-4 sm:px-8 mt-14 sm:mt-20">
        <p className="label text-ink/40">03 / RANKING</p>
        <hr className="mt-2 border-ink" />
        <h2 className="mt-5 text-2xl leading-tight sm:text-[40px]">
          {university ? `${university.nameCn}的中国生源校` : '中国大陆生源校'}
        </h2>
        <p className="mt-2 text-sm text-ink/60 tnum">
          {cityLabel} · {trackLabel} · 2023–2025 三届加权 · 默认规模与人均密度各占一半
        </p>

        <div className="mt-6">
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
              <div className="border border-ink/15 bg-ink/[0.04] p-5 text-sm leading-relaxed">
                <p>{empty.text}</p>
                {empty.action && empty.nextFilters && (
                  <button
                    onClick={() => commit(empty.nextFilters!)}
                    className="mt-3 border border-ink px-3 py-1.5 text-sm text-ink"
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
            <div className="mt-6">
              <PosterButton universityId={universityId} rows={rows} filters={filters} />
            </div>
          )}
        </div>
      </section>

      {/* ── 对比 */}
      {filters.compare.length >= 2 && (
        <section className="mt-14 sm:mt-20">
          <p className="label text-ink/40">04 / COMPARE</p>
          <hr className="mt-2 border-ink" />
          <h2 className="mt-5 text-2xl leading-tight sm:text-[40px]">并排对比</h2>
          <div className="mt-6">
            <CompareTable schoolIds={filters.compare} universityId={universityId} />
          </div>
        </section>
      )}
    </>
  )
}
