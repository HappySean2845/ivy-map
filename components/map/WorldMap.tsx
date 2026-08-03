'use client'

// 左屏：全球大学分布（PRD US-1.1）。
//
// 上一版是「按国家分组的气泡列表」，因为当时我不想引入世界地图 GeoJSON
// （不在 npm 包里，而且国界画错对面向中国用户的产品是合规事故）。
// 现在换成真正的地图，靠的是换数据集而不是冒风险：
//
//   用 Natural Earth 的 **land** 数据（只有陆地轮廓，没有任何国界线）。
//   没有国界线，就没有画错国界的可能——整类风险被移除，而不是被小心绕过。
//   纯白陆地剪影 + 1px 黑描边，正好就是野兽派参考的样子。
//
// 视觉语言（design-system.md §1）：
//   实心点 = 有录取数据，点越大录取量越大
//   空心点 = 已收录但暂无数据（靠形状区分，不靠颜色）

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  WORLD_MAP,
  esc,
  fmtNumber,
  loadWorldMap,
  useChart,
  useLatest,
  useMapTheme,
  type ChartOption,
  type MapTheme,
  type ScatterData,
} from './echarts'
import type { University } from '@/types'
import type { DataMode } from '@/lib/filters'

interface Props {
  universities: University[]
  volumeById: Record<string, number>
  evidenceById: Record<string, number>
  dataMode: DataMode
  selectedId: string | null
  onSelect(id: string): void
}

type MapState = 'loading' | 'ready' | 'error'

/** 所有点统一大小。够大才点得到，够小才不互相遮挡。 */
const DOT = 11

/**
 * 分区视野。
 *
 * 全球视野下，20 所美国大学挤在约 60×40px 的范围里叠成一坨蜂窝，既读不出
 * 是谁，也点不中。这不是标签排布能救的——那片区域的物理尺寸就是装不下。
 * 唯一的解法是**放大**：点一下「美国」，视野收到北美，20 个点自然散开。
 *
 * zoom 由包围盒算，不手调：ECharts geo 的 zoom=1 表示整图刚好铺满容器，
 * 所以要显示宽 w 度的区域，zoom ≈ 世界宽度 / w，再和高度方向取小的那个，
 * 留 15% 余量。数据里新增一所大学、区域范围变了，视野自己跟着变。
 */
interface Region {
  id: string
  label: string
  /** 属于这个区域的 country 值；'*' = 全部 */
  match: string[] | '*'
}

const REGIONS: Region[] = [
  { id: 'all', label: '全球', match: '*' },
  { id: 'us', label: '美国', match: ['US'] },
  { id: 'uk', label: '英国', match: ['UK'] },
  { id: 'asia', label: '港 / 日', match: ['HK', 'JP'] },
  { id: 'ca', label: '加拿大', match: ['CA'] },
]

const WORLD_W = 360
const WORLD_H = 174

function viewFor(pts: { lng: number; lat: number }[], whole: boolean) {
  if (whole || pts.length === 0) {
    // 全球视野：北半球中纬度带，南半球没有一所大学，裁掉才不浪费画面
    return { center: [5, 34] as [number, number], zoom: 1.25 }
  }
  const lngs = pts.map((p) => p.lng)
  const lats = pts.map((p) => p.lat)
  const w = Math.max(6, Math.max(...lngs) - Math.min(...lngs))
  const h = Math.max(4, Math.max(...lats) - Math.min(...lats))
  const zoom = Math.min(WORLD_W / w, WORLD_H / h) * 0.85
  return {
    center: [
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
      (Math.min(...lats) + Math.max(...lats)) / 2,
    ] as [number, number],
    zoom: Math.min(60, Math.max(1, zoom)),
  }
}

/**
 * 旧注释保留：视野曾用 boundingCoords。
 *
 * 收录的大学全在北半球中纬度带：北美西岸(-122) → 欧洲(0) → 东亚(139)，
 * 纬度 22–52。用 center+zoom 的话，为了塞进这 260 度经度跨度就得缩得很小，
 * 结果南半球（非洲、南美）占掉一半画面，而那里一所大学都没有。
 * 直接指定左上/右下角，把南半球裁掉，地图才饱满。
 */

interface Point {
  id: string
  nameCn: string
  nameEn: string
  country: string
  lng: number
  lat: number
  volume: number
  metricText: string
  hasData: boolean
  official: {
    academicYearStart: number
    applied: number
    admitted: number
    enrolled: number
  } | null
  feederKind: 'ranked' | 'evidence' | 'none'
}

function rate(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function buildOption(
  points: Point[],
  selectedId: string | null,
  t: MapTheme,
  view: { center: [number, number]; zoom: number },
  dataMode: DataMode,
  compact: boolean,
): ChartOption {
  const withData = points.filter((p) => p.hasData)
  const noData = points.filter((p) => !p.hasData)

  const toData = (list: Point[]): ScatterData =>
    list.map((p) => ({
      name: p.nameCn,
      value: [p.lng, p.lat],
      id: p.id,
      nameCn: p.nameCn,
      nameEn: p.nameEn,
      volume: p.volume,
      metricText: p.metricText,
      hasData: p.hasData,
      official: p.official,
      feederKind: p.feederKind,
      isSelected: p.id === selectedId,
    })) as ScatterData

  return {
    backgroundColor: 'transparent',
    geo: {
      map: WORLD_MAP,
      roam: false,
      silent: true, // 陆地不是交互对象，只有大学点可点
      center: view.center,
      zoom: view.zoom,
      itemStyle: {
        areaColor: t.land,
        borderColor: t.landBorder,
        borderWidth: 0.5,
      },
      emphasis: { disabled: true },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: t.tooltipBg,
      borderColor: t.tooltipBorder,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: t.tooltipText, fontSize: 12 },
      extraCssText: 'box-shadow:none;border-radius:0;',
      formatter: (raw: unknown) => {
        const d = (raw as { data: Point }).data
        const head = `<b>${esc(d.nameCn)}</b><br/><span style="opacity:.5">${esc(d.nameEn)}</span>`
        if (!d.hasData) {
          const emptyLabel = dataMode === 'official' ? '暂无官方招生数据' : '暂无生源校去向数据'
          return `${head}<br/><span style="opacity:.5">${emptyLabel}</span>`
        }
        if (dataMode === 'official' && d.official) {
          return `${head}<br/>${d.official.academicYearStart}–${String(d.official.academicYearStart + 1).slice(-2)} 学年<br/>申请 ${fmtNumber(d.official.applied)} · 录取 ${fmtNumber(d.official.admitted)} · 入学 ${fmtNumber(d.official.enrolled)}`
        }
        return d.feederKind === 'evidence'
          ? `${head}<br/>2026Fall 早申 offer ${fmtNumber(d.volume)} 枚<br/><span style="opacity:.5">赛道未拆分，不参与密度排名</span>`
          : `${head}<br/>近三届加权录取 ${fmtNumber(d.volume)} 人`
      },
    },
    series: [
      // 空心点先画，实心点压在上面
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        data: toData(noData),
        symbolSize: DOT,
        itemStyle: {
          color: t.land,
          borderColor: t.ring,
          borderWidth: 1,
          borderType: 'dashed',
          opacity: 0.6,
        },
        // 空心点的校名**不常驻**：28 所暂无数据的大学有 20 所挤在美国东岸
        // 约 60×40px 的范围里，标签同时显示只会互相压死，谁也读不出来。
        // 名字改由地图下方的可点列表承担（见组件底部）—— 那里既读得清，
        // 也真的点得到。这里只在 hover / 选中时显示。
        // 空心点**不标名字**，哪怕放大。
        //
        // moveOverlap:'shiftY' 只能沿 Y 轴推开标签，救不了「同一坐标上several
        // 个中文长标签」这种情况 —— 伦敦一地就有 UCL、LSE、帝国理工三所，
        // 名字又长，推开之后横向照样叠在一起。
        // 名字全部交给下面的列表承担（那里读得清也点得到），地图只标有数据的点。
        label: { show: false },
        emphasis: { scale: 1.7, label: { show: true, position: 'right', distance: 6 } },
        z: 2,
      },
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        data: toData(withData),
        // 统一大小。原来按录取量缩放到 38px，大圆直接盖住旁边的点——
        // 牛津和剑桥只差 1.4 个经度，在这个尺度下后者根本点不到。
        // 录取量改由常驻标签里的数字承担，点只负责「在哪里」和「能点」。
        symbolSize: DOT,
        itemStyle: {
          color: (params: unknown) => {
            const d = (params as { data: Point & { isSelected: boolean } }).data
            // 选中态用反白：白底 + 黑粗边，而不是换颜色
            return d.isSelected ? t.land : t.accentFill
          },
          borderColor: t.accent,
          borderWidth: (params: unknown) =>
            (params as { data: { isSelected: boolean } }).data.isSelected ? 3 : 1.5,
        },
        label: {
          show: true,
          position: compact && dataMode === 'official' ? 'left' : 'right',
          distance: 7,
          formatter: (p: unknown) => {
            const d = (p as { data: Point & { isSelected: boolean } }).data
            if (compact && dataMode === 'official' && !d.isSelected) return ''
            return `${d.nameCn} ${d.metricText}`
          },
          color: t.text,
          fontSize: 11,
          fontWeight: 500,
        },
        // 重叠处理是两件事的组合，缺一不可：
        //   moveOverlap 把压在一起的标签上下推开（不用 hideOverlap —— 那会
        //   直接丢掉其中一个，那所大学就等于从图上消失了）
        //   labelLine   给被推开的标签画一根引导线连回它自己的点，
        //               否则标签飘在旁边，读者根本不知道它指的是谁
        labelLine: {
          show: true,
          length2: 8,
          lineStyle: { color: t.landBorder, width: 0.6 },
        },
        labelLayout: { moveOverlap: 'shiftY', hideOverlap: false },
        emphasis: { scale: 1.6, itemStyle: { borderWidth: 2.5 } },
        z: 3,
      },
    ],
  } as ChartOption
}

export default function WorldMap({
  universities,
  volumeById,
  evidenceById,
  dataMode,
  selectedId,
  onSelect,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const t = useMapTheme()
  const { chart, width, height } = useChart(boxRef)
  const [load, setLoad] = useState<{ attempt: number; status: MapState }>({
    attempt: 0,
    status: 'loading',
  })
  const [regionId, setRegionId] = useState(dataMode === 'official' ? 'us' : 'all')
  const onSelectRef = useLatest(onSelect)

  useEffect(() => {
    let alive = true
    loadWorldMap()
      .then(() => alive && setLoad((p) => ({ ...p, status: 'ready' })))
      .catch(() => alive && setLoad((p) => ({ ...p, status: 'error' })))
    return () => {
      alive = false
    }
  }, [load.attempt])

  const points: Point[] = useMemo(
    () =>
      universities.map((u) => {
        const feederVolume = volumeById[u.id] ?? 0
        const feederEvidence = evidenceById[u.id] ?? 0
        const snapshot = u.officialAdmissions[0] ?? null
        const official = snapshot
          ? {
              academicYearStart: snapshot.academicYearStart,
              applied: snapshot.applied,
              admitted: snapshot.admitted,
              enrolled: snapshot.enrolled,
            }
          : null
        const feederKind =
          feederVolume > 0 ? 'ranked' : feederEvidence > 0 ? 'evidence' : 'none'
        const hasData = dataMode === 'official' ? official !== null : feederKind !== 'none'
        return {
          id: u.id,
          nameCn: u.nameCn,
          nameEn: u.nameEn,
          country: u.country,
          lng: u.lng,
          lat: u.lat,
          volume:
            dataMode === 'official'
              ? (official?.admitted ?? 0)
              : feederKind === 'ranked'
                ? feederVolume
                : feederEvidence,
          metricText:
            dataMode === 'official' && official
              ? rate(official.admitted, official.applied)
              : feederKind === 'evidence'
                ? `${fmtNumber(feederEvidence)}枚`
                : fmtNumber(feederVolume),
          hasData,
          official,
          feederKind,
        }
      }),
    [universities, volumeById, evidenceById, dataMode],
  )

  useEffect(() => {
    if (!chart) return
    const handler = (params: unknown) => {
      const d = (params as { data?: { id?: string } }).data
      if (d?.id) onSelectRef.current?.(d.id)
    }
    chart.on('click', handler)
    return () => {
      chart.off('click', handler)
    }
  }, [chart, onSelectRef])

  const region = REGIONS.find((r) => r.id === regionId) ?? REGIONS[0]
  const inRegion = useMemo(
    () =>
      region.match === '*'
        ? points
        : points.filter((p) => (region.match as string[]).includes(p.country)),
    [points, region],
  )
  const view = useMemo(() => viewFor(inRegion, region.match === '*'), [inRegion, region])

  useEffect(() => {
    if (!chart || load.status !== 'ready' || width === 0 || height === 0) return
    chart.setOption(buildOption(points, selectedId, t, view, dataMode, width < 640), true)
  }, [chart, load.status, points, selectedId, t, view, region, width, height, dataMode])

  const withData = points.filter((p) => p.hasData).length

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex min-h-[42px] flex-wrap items-center gap-x-1 gap-y-1 border-b border-ink/15 px-4 py-2 sm:px-6">
        <span className="label mr-2 text-ink/40">ZOOM</span>
        {REGIONS.map((r) => {
          const n =
            r.match === '*'
              ? points.length
              : points.filter((p) => (r.match as string[]).includes(p.country)).length
          const available =
            r.match === '*'
              ? withData
              : points.filter((p) => (r.match as string[]).includes(p.country) && p.hasData)
                  .length
          if (n === 0) return null
          return (
            <button
              key={r.id}
              onClick={() => setRegionId(r.id)}
              className={`border px-2 py-1 text-[11px] leading-none ${
                regionId === r.id
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/20 text-ink/50 hover:border-ink/50'
              }`}
              data-tap
            >
              {r.label} {available}/{n}
            </button>
          )
        })}
      </div>

      {/* 大学列表紧跟在区域按钮下面，并**跟着区域筛**。
          放在地图下方时，选了「英国」下面却还列着 30 所，读者得自己去对；
          跟着筛之后，选哪个区域就只剩哪几所，一眼看完。 */}
      <div className="scroll-x flex flex-wrap gap-x-4 gap-y-1.5 border-b border-ink/15 px-4 py-2.5 text-[11px] sm:px-6">
        {inRegion.length === 0 ? (
          <span className="text-ink/40">这个区域还没有收录大学</span>
        ) : (
          inRegion.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              title={p.nameEn}
              className={`whitespace-nowrap ${
                p.id === selectedId
                  ? 'bg-ink px-1 text-paper'
                  : p.hasData
                    ? 'text-ink underline decoration-ink/30 underline-offset-2'
                    : 'text-ink/35'
              }`}
            >
              {p.nameCn}
              {p.hasData ? ` ${p.metricText}` : ''}
            </button>
          ))
        )}
      </div>

      <div className="relative h-[300px] w-full sm:h-[440px]">
        <div
          ref={boxRef}
          className="absolute inset-0"
          style={{ visibility: load.status === 'ready' ? 'visible' : 'hidden' }}
        />
        {load.status !== 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-ink/40">
            {load.status === 'loading' ? (
              '正在载入世界底图…'
            ) : (
              <button
                onClick={() => setLoad((p) => ({ attempt: p.attempt + 1, status: 'loading' }))}
                className="border border-ink px-3 py-1.5 text-ink"
                data-tap
              >
                底图加载失败，重试 →
              </button>
            )}
          </div>
        )}
      </div>
      <p className="border-t border-ink/15 px-4 py-2 text-[11px] leading-relaxed text-ink/40 sm:px-6">
        {dataMode === 'official' ? (
          <>
            实心 = 已有完整官方招生数据（{withData} 所），标签显示录取率 · 空心 = 尚无完整数据 ·
            区域按钮显示有数据/收录总数 · 底图只有陆地轮廓，不含国界
          </>
        ) : (
          <>
            实心 = 已有生源校去向数据（{withData} 所），标签显示加权录取人数或已核实 offer 数 ·
            空心 = 尚无生源校记录 · 区域按钮显示有数据/收录总数 · 底图只有陆地轮廓，不含国界
          </>
        )}
      </p>
    </div>
  )
}
