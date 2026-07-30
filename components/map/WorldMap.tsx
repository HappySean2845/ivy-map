'use client'

// 左屏：全球大学分布（PRD US-1.1）。
//
// **为什么这里没有世界地图底图**：
//   1. 合规。世界地图 GeoJSON 涉及国界画法，第三方来源的国界（尤其是我国
//      主张的边界）几乎都是错的，一张错的国界图挂在线上是硬伤。
//   2. 信息密度。30 所大学分散在美/英/港/加/日，一张世界地图 90% 面积是
//      海洋，美东那一撮点还会挤成一坨 —— 家长要的是「哪所大学、送了多少
//      人」，不是「它在地球上哪个经纬度」。
//   3. 体积。世界底图又是几百 KB，换来的信息量还不如下面这张气泡图。
//
// 所以改成：**按国家/地区分组的气泡图**（ECharts scatter + 自定义坐标）。
// 组内按录取量降序，气泡面积反映近三年加权录取人数，空心 = 暂无收录数据。

import { useEffect, useMemo, useRef } from 'react'

import {
  clamp,
  esc,
  fmtNumber,
  useChart,
  useLatest,
  useMapTheme,
  type ChartOption,
  type MapTheme,
  type ScatterData,
} from './echarts'
import type { University } from '@/types'

interface Props {
  universities: University[]
  volumeById: Record<string, number>
  selectedId: string | null
  onSelect(id: string): void
}

/**
 * 分组顺序固定，不按数据量排 —— 否则数据一变，家长上次点的位置就挪了。
 * 英国放第一是有意的：主线在英国方向，且英国口径最干净（PRD §1.4），
 * 移动端首屏不滚动就能看到牛剑。
 */
const REGION_ORDER = ['UK', 'US', 'HK', 'CA', 'JP']
const REGION_LABEL: Record<string, string> = {
  US: '美国',
  UK: '英国',
  HK: '中国香港',
  CA: '加拿大',
  JP: '日本',
}

/** 每个分组上方留出的行高，用来放分组标题 */
const GROUP_GAP = 0.62

/**
 * 一行的最小像素高度。低于这个值气泡下面的校名就摆不下了，而 30 个没有
 * 名字的气泡等于没有信息 —— 所以宁可让容器纵向滚动，也不压缩行高。
 */
const MIN_ROW_PX = 60

interface Placed {
  u: University
  volume: number
  col: number
  /** 纵坐标，单位是「行」，可以是小数 */
  row: number
}

interface Layout {
  points: Placed[]
  headers: { label: string; count: number; row: number }[]
  cols: number
  units: number
}

/** 「剑桥大学」→「剑桥」。气泡下面放不下全名，全名在 tooltip 里。 */
function shortName(name: string): string {
  const s = name.replace(/(大学|学院|学校)$/, '') || name
  return s.length > 6 ? `${s.slice(0, 5)}…` : s
}

function buildLayout(
  universities: University[],
  volumeById: Record<string, number>,
  cols: number,
): Layout {
  const groups = new Map<string, University[]>()
  for (const u of universities) {
    const key = u.country || 'OTHER'
    const list = groups.get(key)
    if (list) list.push(u)
    else groups.set(key, [u])
  }

  const known = REGION_ORDER.filter((k) => groups.has(k))
  const rest = [...groups.keys()].filter((k) => !REGION_ORDER.includes(k)).sort()
  const keys = [...known, ...rest]

  const points: Placed[] = []
  const headers: Layout['headers'] = []
  let y = 0

  for (const key of keys) {
    const list = [...(groups.get(key) ?? [])].sort((a, b) => {
      const dv = (volumeById[b.id] ?? 0) - (volumeById[a.id] ?? 0)
      return dv !== 0 ? dv : a.nameCn.localeCompare(b.nameCn, 'zh-Hans-CN')
    })
    y += GROUP_GAP
    headers.push({ label: REGION_LABEL[key] ?? key, count: list.length, row: y - 0.44 })
    list.forEach((u, i) => {
      points.push({
        u,
        volume: volumeById[u.id] ?? 0,
        col: i % cols,
        row: y + Math.floor(i / cols),
      })
    })
    y += Math.ceil(list.length / cols)
  }

  return { points, headers, cols, units: y + 0.25 }
}

export default function WorldMap({ universities, volumeById, selectedId, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const theme = useMapTheme()
  const { chart, width, height } = useChart(boxRef)

  const withData = useMemo(
    () => universities.filter((u) => (volumeById[u.id] ?? 0) > 0).length,
    [universities, volumeById],
  )

  // 点空心点不能静默无响应（US-1.1 验收项）。这句话由 selectedId 推导，
  // 不用本地 state —— 免得「提示还在、选中的却已经换了一所」。
  const notice = useMemo(() => {
    if (!selectedId) return null
    const u = universities.find((x) => x.id === selectedId)
    if (!u || (volumeById[u.id] ?? 0) > 0) return null
    return `「${u.nameCn}」暂无充分数据。当前收录 ${universities.length} 所大学，其中 ${withData} 所已有录取记录 —— 我们只放有出处的数字。`
  }, [selectedId, universities, volumeById, withData])

  const onSelectRef = useLatest(onSelect)

  const layout = useMemo(() => {
    // 一列约 72px，移动端 390px 下是 5 列
    const cols = clamp(Math.floor((width || 360) / 72), 3, 9)
    return buildLayout(universities, volumeById, cols)
  }, [universities, volumeById, width])

  useEffect(() => {
    if (!chart) return
    const handler = (params: unknown) => {
      const p = params as { data?: { uniId?: string } }
      const id = p.data?.uniId
      if (id) onSelectRef.current(id)
    }
    chart.on('click', handler)
    return () => {
      chart.off('click', handler)
    }
  }, [chart, onSelectRef])

  useEffect(() => {
    if (!chart || width === 0 || height === 0) return
    chart.setOption(buildOption(layout, selectedId, theme, width, height))
  }, [chart, layout, selectedId, theme, width, height])

  if (universities.length === 0) {
    return (
      <Frame>
        <Empty title="暂无大学数据" detail="数据还没录进来。收录范围与进度见「关于」页。" />
      </Frame>
    )
  }

  return (
    <Frame>
      {/* 行高不够就纵向滚动，不把气泡和校名压扁 */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div
          ref={boxRef}
          className="h-full w-full"
          // 高度封顶：原本随大学数线性增长，30 所就把首屏占满了，
          // 把榜单和滑杆全推到折叠以下。地图是探索工具，不该抢主视图。
          style={{
            height: Math.min(360, Math.max(260, Math.round(layout.units * MIN_ROW_PX) + 16)),
          }}
        />
        {!chart && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-ink-faint">
            图表加载中…
          </div>
        )}
      </div>

      {notice && (
        <p className="mt-2 shrink-0 rounded-sm border border-signal/60 bg-signal-soft px-3 py-2 text-xs leading-relaxed text-ink-faint/10">
          {notice}
        </p>
      )}

      <p className="mt-2 shrink-0 text-[11px] leading-relaxed text-ink-faint">
        点的大小 = 近三年加权录取人数（已有数据 {withData} / {universities.length} 所）；空心 =
        暂无收录数据。按国家/地区分组，非地理位置。
      </p>
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full w-full min-h-[320px] flex-col">{children}</div>
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid flex-1 place-items-center rounded-sm border border-dashed border-rule px-6 text-center">
      <div>
        <p className="text-sm text-ink-muted">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-faint">{detail}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function buildOption(
  layout: Layout,
  selectedId: string | null,
  theme: MapTheme,
  width: number,
  height: number,
): ChartOption {
  const { points, headers, cols, units } = layout
  const maxVol = points.reduce((m, p) => Math.max(m, p.volume), 0)

  // 气泡大小跟着容器走：容器再矮也不会互相压住
  const colPitch = (width - 12) / cols
  const rowPitch = (height - 8) / Math.max(units, 1)
  const maxSym = clamp(Math.min(rowPitch * 0.52, colPitch * 0.62), 12, 46)
  const minSym = clamp(maxSym * 0.34, 7, 13)
  const showLabel = colPitch >= 44 && rowPitch >= 38

  const sizeOf = (v: number) =>
    v > 0 && maxVol > 0
      ? minSym + (maxSym - minSym) * Math.sqrt(v / maxVol)
      : Math.max(7, minSym * 0.8)

  const data = points.map((p) => {
    const selected = p.u.id === selectedId
    const hasData = p.volume > 0
    return {
      name: p.u.nameCn,
      value: [p.col, p.row],
      uniId: p.u.id,
      volume: p.volume,
      nameEn: p.u.nameEn,
      country: p.u.country,
      symbolSize: sizeOf(p.volume),
      itemStyle: hasData
        ? {
            color: selected ? theme.accent : theme.accentFill,
            borderColor: selected ? theme.accentStrong : theme.accent,
            borderWidth: selected ? 2 : 1,
          }
        : {
            color: 'transparent',
            borderColor: selected ? theme.accent : theme.ring,
            borderWidth: selected ? 2 : 1,
            borderType: 'dashed' as const,
          },
      label: {
        show: showLabel || selected,
        position: 'bottom' as const,
        distance: 3,
        formatter: shortName(p.u.nameCn),
        fontSize: 10,
        fontWeight: (selected ? 'bold' : 'normal') as 'bold' | 'normal',
        color: selected ? theme.accentStrong : theme.textDim,
      },
    }
  })

  const selectedPoint = points.find((p) => p.u.id === selectedId)
  const halo = selectedPoint
    ? [
        {
          value: [selectedPoint.col, selectedPoint.row],
          symbolSize: sizeOf(selectedPoint.volume) + 12,
          itemStyle: {
            color: 'transparent',
            borderColor: theme.accent,
            borderWidth: 1.5,
            opacity: 0.75,
          },
        },
      ]
    : []

  return {
    animation: true,
    animationDuration: 240,
    grid: { left: 6, right: 6, top: 4, bottom: 4, containLabel: false },
    xAxis: { type: 'value', min: -0.55, max: cols - 0.45, show: false },
    yAxis: { type: 'value', min: 0, max: units, inverse: true, show: false },
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
          data?: { name?: string; nameEn?: string; volume?: number; uniId?: string }
        }
        if (!p.data?.uniId) return ''
        const vol = p.data.volume ?? 0
        const line =
          vol > 0
            ? `近三年加权录取 <b>${fmtNumber(vol)}</b> 人`
            : '暂无收录数据 <span style="opacity:.7">（不是 0，是我们还没有有出处的记录）</span>'
        return [
          `<div style="font-weight:600">${esc(p.data.name ?? '')}</div>`,
          p.data.nameEn
            ? `<div style="opacity:.6;font-size:11px">${esc(p.data.nameEn)}</div>`
            : '',
          `<div style="margin-top:4px">${line}</div>`,
        ].join('')
      },
    },
    series: [
      {
        id: 'regions',
        type: 'scatter',
        silent: true,
        animation: false,
        symbolSize: 0,
        data: headers.map((h) => ({
          value: [-0.5, h.row],
          label: {
            show: true,
            position: 'inside' as const,
            align: 'left' as const,
            verticalAlign: 'middle' as const,
            formatter: `${h.label} · ${h.count}`,
            fontSize: 11,
            color: theme.text,
          },
        })) as unknown as ScatterData,
      },
      {
        id: 'halo',
        type: 'scatter',
        silent: true,
        z: 2,
        data: halo as unknown as ScatterData,
      },
      {
        id: 'universities',
        type: 'scatter',
        z: 3,
        cursor: 'pointer',
        emphasis: { scale: 1.12 },
        data: data as unknown as ScatterData,
      },
    ],
  }
}
