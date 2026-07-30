'use client'

// ECharts 的按需引入与共用 hooks。地图组件只从这里拿实例，不要在别处
// import 'echarts' 整包 —— 完整包 1MB+，而我们只用到 scatter + geo。
//
// 三件事都在这里收口：
//   1. 注册用到的 chart / component / renderer（下面这份清单就是全部）
//   2. 深浅色两套配色（站点用 prefers-color-scheme，图表得跟着变）
//   3. 中国地图 GeoJSON 的加载与注册（npm 包里没有，只能运行时 fetch）

import { ScatterChart } from 'echarts/charts'
import { GeoComponent, GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef, useState, type RefObject } from 'react'

import type { ScatterSeriesOption } from 'echarts/charts'
import type {
  GeoComponentOption,
  GridComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import type { ComposeOption, EChartsType } from 'echarts/core'

echarts.use([ScatterChart, GeoComponent, GridComponent, TooltipComponent, CanvasRenderer])

export { echarts }

export type ChartOption = ComposeOption<
  | ScatterSeriesOption
  | GeoComponentOption
  | GridComponentOption
  | TooltipComponentOption
>

/** scatter 的 data 数组类型。我们往 item 上挂了自定义字段，赋值处需要 cast。 */
export type ScatterData = NonNullable<ScatterSeriesOption['data']>

// ---------------------------------------------------------------------------
// 配色

export interface MapTheme {
  dark: boolean
  /** 主色，与站点 emerald 系保持一致 */
  accent: string
  accentStrong: string
  /** 气泡填充（半透明，重叠时还能看出层次） */
  accentFill: string
  /** 空心点的描边 —— 「暂无收录数据」的视觉语言 */
  ring: string
  text: string
  textDim: string
  land: string
  landBorder: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
}

/**
 * 唯一一套配色：纯黑白（design-system.md §1）。
 *
 * 上一版有 LIGHT/DARK 两套 emerald 系配色，现在删掉——设计系统只有 #000 和
 * #fff，热力靠 opacity 阶梯而不是色阶。地图上的层级全部由「实心 / 空心 /
 * 不同透明度」承担，这样截图、黑白打印、色弱视觉下都无损。
 */
const BW: MapTheme = {
  dark: false,
  accent: '#000000',
  accentStrong: '#000000',
  accentFill: 'rgba(0, 0, 0, 0.62)',
  ring: '#000000',
  text: '#000000',
  textDim: 'rgba(0, 0, 0, 0.45)',
  land: '#ffffff',
  landBorder: '#000000',
  tooltipBg: '#ffffff',
  tooltipBorder: '#000000',
  tooltipText: '#000000',
}

/** 热力的 opacity 阶梯。0 = 无数据（空心），其余按权重分档。 */
export const HEAT_STEPS = [0.08, 0.22, 0.4, 0.62, 0.85] as const

export function heatOpacity(value: number, max: number): number {
  if (!(value > 0) || !(max > 0)) return 0
  const i = Math.min(HEAT_STEPS.length - 1, Math.floor((value / max) * HEAT_STEPS.length))
  return HEAT_STEPS[i]
}

/** 设计系统只有 light，所以这里恒定返回黑白一套。保留 hook 形态是为了
    调用方不用改，也方便以后真要加主题时只动这一处。 */
export function useMapTheme(): MapTheme {
  return BW
}

// ---------------------------------------------------------------------------
// 实例

export interface ChartHandle {
  chart: EChartsType | null
  /** 容器像素尺寸。布局要用它算列数和气泡大小，所以得往外传。 */
  width: number
  height: number
}

/**
 * 初始化 ECharts 并跟随容器尺寸变化。
 * 容器必须自己有高度（h-full 或 min-h-*），否则 ECharts 会警告 0 高度。
 */
export function useChart(ref: RefObject<HTMLDivElement | null>): ChartHandle {
  const [chart, setChart] = useState<EChartsType | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const inst = echarts.init(el, undefined, { renderer: 'canvas' })
    setChart(inst)
    setSize({ width: el.clientWidth, height: el.clientHeight })

    const ro = new ResizeObserver((entries) => {
      inst.resize()
      const r = entries[0]?.contentRect
      if (!r) return
      setSize((prev) =>
        Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
          ? prev
          : { width: r.width, height: r.height },
      )
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      inst.dispose()
      setChart(null)
    }
  }, [ref])

  return { chart, width: size.width, height: size.height }
}

/**
 * 把随时会变的回调/值塞进 ref —— ECharts 事件只绑一次，省得 off/on 抖动。
 * 在 effect 里同步（不是 render 里），保证 React Compiler 那套规则也过得去；
 * 读取方都是用户交互回调，一定发生在 commit 之后，拿到的永远是最新值。
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

// ---------------------------------------------------------------------------
// 中国地图底图

export const CHINA_MAP = 'china'

let chinaPromise: Promise<void> | null = null

/**
 * 加载并注册中国地图。
 *
 * 底图固定用 public/geo/china.json（阿里云 DataV，34 省级行政区含台港澳 +
 * 南海诸岛）—— **不要换来源**，国界完整性是合规问题，不是画风问题。
 */
export function loadChinaMap(): Promise<void> {
  if (chinaPromise) return chinaPromise
  chinaPromise = fetch('/geo/china.json')
    .then((res) => {
      if (!res.ok) throw new Error(`geo/china.json ${res.status}`)
      return res.json()
    })
    .then((geo) => {
      echarts.registerMap(CHINA_MAP, geo)
    })
    .catch((err) => {
      chinaPromise = null // 允许重试
      throw err
    })
  return chinaPromise
}

// ---------------------------------------------------------------------------
// 世界底图

export const WORLD_MAP = 'world-land'

let worldPromise: Promise<void> | null = null

/**
 * 加载并注册世界底图。
 *
 * 用的是 **Natural Earth 的 land 数据（只有陆地轮廓，没有任何国界线）**，
 * 不是常见的 countries 数据。这不是偷懒，是两个理由的交集：
 *
 *   1. **合规**：面向中国用户的产品画错国界是事故。没有国界线，就没有
 *      画错国界的可能——把整类风险移除掉，比小心地画一遍更稳。
 *   2. **画风**：纯白陆地剪影 + 1px 黑描边，正好就是野兽派参考的样子。
 *      国界线在这个体量下只是噪声——我们要展示的是 30 个大学点，不是政区。
 *
 * ECharts 的 npm 包不含任何地图数据，所以只能运行时 fetch + registerMap。
 */
export function loadWorldMap(): Promise<void> {
  if (worldPromise) return worldPromise
  worldPromise = fetch('/geo/world-land.json')
    .then((res) => {
      if (!res.ok) throw new Error(`geo/world-land.json ${res.status}`)
      return res.json()
    })
    .then((geo) => {
      echarts.registerMap(WORLD_MAP, geo)
    })
    .catch((err) => {
      worldPromise = null // 允许重试
      throw err
    })
  return worldPromise
}

// ---------------------------------------------------------------------------
// 小工具

/** 缺数据显示「—」，绝不显示 0（PRD §7）。 */
export function fmtNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/** tooltip 用的转义。学校/大学名来自数据文件，仍然别直接拼进 HTML。 */
export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}
