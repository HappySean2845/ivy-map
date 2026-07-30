'use client'

// 右屏：中国生源分布（PRD US-1.1）。选中大学后，按生源校所在城市点亮。
//
// 底图是 public/geo/china.json（阿里云 DataV，34 省级行政区含台港澳 + 南海
// 诸岛）。**不要换来源** —— 国界完整性是合规问题。npm 包里没有地图数据，
// 所以只能运行时 fetch + registerMap，这也是本组件有 loading/失败态的原因。
//
// 省份本身不是交互对象（geo silent），可点的只有城市点：省级粒度点亮会
// 让家长误以为「整个江苏都在往剑桥送人」，而我们的数据粒度就是城市。

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  CHINA_MAP,
  esc,
  fmtNumber,
  loadChinaMap,
  useChart,
  useLatest,
  useMapTheme,
  type ChartOption,
  type MapTheme,
  type ScatterData,
} from './echarts'
import type { City } from '@/types'

interface Props {
  cities: City[]
  heatByCityId: Record<string, number>
  selectedCityId: string | null
  onSelect(id: string | null): void
}

type MapState = 'loading' | 'ready' | 'error'

export default function ChinaMap({ cities, heatByCityId, selectedCityId, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const theme = useMapTheme()
  const { chart, width, height } = useChart(boxRef)

  // attempt 和 status 放同一个 state：重试时由点击事件一次性改掉，
  // 避免在 effect 里同步 setState 触发级联渲染
  const [load, setLoad] = useState<{ attempt: number; status: MapState }>({
    attempt: 0,
    status: 'loading',
  })
  const state = load.status
  const attempt = load.attempt

  useEffect(() => {
    let alive = true
    const settle = (status: MapState) => {
      if (!alive) return
      setLoad((prev) => (prev.attempt === attempt ? { attempt, status } : prev))
    }
    loadChinaMap().then(
      () => settle('ready'),
      () => settle('error'),
    )
    return () => {
      alive = false
    }
  }, [attempt])

  const hot = useMemo(
    () => cities.filter((c) => (heatByCityId[c.id] ?? 0) > 0),
    [cities, heatByCityId],
  )

  const onSelectRef = useLatest(onSelect)
  const selectedRef = useLatest(selectedCityId)

  // 点城市点：同一个再点一次取消选中；点空白也取消
  useEffect(() => {
    if (!chart) return
    const onItem = (params: unknown) => {
      const p = params as { data?: { cityId?: string } }
      const id = p.data?.cityId
      if (!id) return
      onSelectRef.current(id === selectedRef.current ? null : id)
    }
    const zr = chart.getZr()
    const onBlank = (e: { target?: unknown }) => {
      if (!e.target && selectedRef.current) onSelectRef.current(null)
    }
    chart.on('click', onItem)
    zr.on('click', onBlank)
    return () => {
      chart.off('click', onItem)
      zr.off('click', onBlank)
    }
  }, [chart, onSelectRef, selectedRef])

  useEffect(() => {
    if (!chart || state !== 'ready' || width === 0 || height === 0) return
    chart.setOption(buildOption(cities, heatByCityId, selectedCityId, theme))
  }, [chart, state, cities, heatByCityId, selectedCityId, theme, width, height])

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative h-[300px] w-full sm:h-[440px]">
        <div
          ref={boxRef}
          className="h-full w-full"
          style={{ visibility: state === 'ready' ? 'visible' : 'hidden' }}
        />

        {state === 'loading' && (
          <div className="absolute inset-0 grid place-items-center">
            <p className="text-xs text-ink/40">正在载入中国底图…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div>
              <p className="text-sm text-ink/60">地图底图加载失败</p>
              <p className="mt-1 text-xs leading-relaxed text-ink/40">
                榜单不受影响，可以继续用右侧列表。
              </p>
              <button
                type="button"
                onClick={() => setLoad((p) => ({ attempt: p.attempt + 1, status: 'loading' }))}
                className="mt-3 border border-ink/15 px-3 py-1.5 text-xs text-ink/60 hover:bg-ink/[0.04]"
              >
                重新加载
              </button>
            </div>
          </div>
        )}

        {/* 数据极稀疏，空态是主路径不是边缘情况 */}
        {state === 'ready' && hot.length === 0 && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3">
            <p className=" border border-ink/15 bg-paper px-3 py-2 text-xs leading-relaxed text-ink/60">
              {cities.length === 0
                ? '暂无城市数据 —— 收录还没铺到这里，不是这些城市没有生源校。'
                : `暂无可点亮的生源城市 —— 我们还没有有出处的录取记录。灰色小点是已收录的 ${cities.length} 座城市，换一所大学或放宽赛道看看。`}
            </p>
          </div>
        )}
      </div>

      <p className="shrink-0 border-t border-ink/15 px-4 py-2 text-[11px] leading-relaxed text-ink/40 sm:px-6">
        点的大小 = 该城市生源校的近三年加权录取人数；灰点 =
        已收录但暂无数据。点城市可筛选榜单，再点一次取消。
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

function buildOption(
  cities: City[],
  heatByCityId: Record<string, number>,
  selectedCityId: string | null,
  theme: MapTheme,
): ChartOption {
  const maxHeat = cities.reduce((m, c) => Math.max(m, heatByCityId[c.id] ?? 0), 0)

  const sizeOf = (heat: number) =>
    heat > 0 && maxHeat > 0 ? 10 + 22 * Math.sqrt(heat / maxHeat) : 6

  const toItem = (c: City) => {
    const heat = heatByCityId[c.id] ?? 0
    const selected = c.id === selectedCityId
    const hasData = heat > 0
    return {
      name: c.name,
      value: [c.lng, c.lat, heat],
      cityId: c.id,
      heat,
      province: c.province,
      symbolSize: sizeOf(heat) + (selected ? 4 : 0),
      itemStyle: {
        color: hasData ? (selected ? theme.accent : theme.accentFill) : 'transparent',
        borderColor: selected ? theme.accentStrong : hasData ? theme.accent : theme.ring,
        borderWidth: selected ? 2.5 : 1,
        borderType: (hasData ? 'solid' : 'dashed') as 'solid' | 'dashed',
      },
      label: {
        show: selected || (hasData && maxHeat > 0),
        position: 'right' as const,
        distance: 4,
        formatter: c.name,
        fontSize: 10,
        fontWeight: (selected ? 'bold' : 'normal') as 'bold' | 'normal',
        color: selected ? theme.accentStrong : theme.textDim,
      },
    }
  }

  const hot = cities.filter((c) => (heatByCityId[c.id] ?? 0) > 0).map(toItem)
  const dim = cities.filter((c) => (heatByCityId[c.id] ?? 0) <= 0).map(toItem)

  return {
    animation: true,
    animationDuration: 240,
    geo: {
      map: CHINA_MAP,
      roam: false, // 移动端别抢页面滚动
      left: 'center',
      top: 8,
      bottom: 8,
      silent: true, // 省份不可点：数据粒度是城市，点亮整个省会误导
      itemStyle: {
        areaColor: theme.land,
        borderColor: theme.landBorder,
        borderWidth: 0.6,
      },
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: theme.tooltipText, fontSize: 12 },
      formatter: (params: unknown) => {
        const p = params as {
          data?: { name?: string; province?: string; heat?: number; cityId?: string }
        }
        if (!p.data?.cityId) return ''
        const heat = p.data.heat ?? 0
        const line =
          heat > 0
            ? `近三年加权录取 <b>${fmtNumber(heat)}</b> 人`
            : '暂无收录数据 <span style="opacity:.7">（不是 0）</span>'
        return [
          `<div style="font-weight:600">${esc(p.data.name ?? '')}</div>`,
          p.data.province && p.data.province !== p.data.name
            ? `<div style="opacity:.6;font-size:11px">${esc(p.data.province)}</div>`
            : '',
          `<div style="margin-top:4px">${line}</div>`,
        ].join('')
      },
    },
    series: [
      {
        id: 'cities-dim',
        type: 'scatter',
        coordinateSystem: 'geo',
        z: 2,
        cursor: 'pointer',
        data: dim as unknown as ScatterData,
      },
      {
        id: 'cities-hot',
        type: 'scatter',
        coordinateSystem: 'geo',
        z: 3,
        cursor: 'pointer',
        emphasis: { scale: 1.12 },
        data: hot as unknown as ScatterData,
      },
    ],
  }
}
