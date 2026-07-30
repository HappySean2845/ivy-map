'use client'

// 「规模 ↔ 概率」滑杆（PRD US-1.4）—— 本产品的签名交互。
//
// 三条不能破的规矩：
//   1. 拖动即回调，没有提交按钮、没有 debounce。重排必须跟手，慢一帧都不行。
//   2. 线上没有解说员，所以 autoDemo 载入后自己拖一次给用户看（US-1.0）。
//      用户一动手就立刻中止 —— 抢用户的手是最讨厌的交互。
//   3. 尊重 prefers-reduced-motion：不演示，改成一句常驻引导。
//
// 方向按 metrics.md §6 走：alpha=1 在最左（规模优先），alpha=0 在最右（概率优先）。
// 所以 input 的 value 是 1 - alpha，不要把这两个搞反。

import { useEffect, useRef, useState } from 'react'
import { normalizeAlpha } from '@/lib/urlState'
import { useReducedMotion } from './_shared'

/** 演示时间线：等一下 → 滑到概率端 → 停一下 → 滑回默认。合计约 2 秒。 */
const DEMO_DELAY = 700
const DEMO_LEG = 850
const DEMO_HOLD = 300
const DEMO_TOTAL = DEMO_LEG * 2 + DEMO_HOLD

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** 演示时间线上某一刻的 alpha 值。from 是演示开始前的位置，演示结束回到它。 */
function demoAlphaAt(elapsed: number, from: number): number {
  if (elapsed < DEMO_LEG) {
    return lerp(from, 0, easeInOutCubic(elapsed / DEMO_LEG))
  }
  if (elapsed < DEMO_LEG + DEMO_HOLD) return 0
  const t = (elapsed - DEMO_LEG - DEMO_HOLD) / DEMO_LEG
  return lerp(0, from, easeInOutCubic(Math.min(1, t)))
}

const TRACK_CLASS = [
  // WebKit / Blink
  '[&::-webkit-slider-runnable-track]:h-1.5',
  '[&::-webkit-slider-runnable-track]:rounded-full',
  '[&::-webkit-slider-runnable-track]:bg-neutral-200',
  'dark:[&::-webkit-slider-runnable-track]:bg-neutral-700',
  '[&::-webkit-slider-thumb]:appearance-none',
  '[&::-webkit-slider-thumb]:-mt-[9px]',
  '[&::-webkit-slider-thumb]:h-6',
  '[&::-webkit-slider-thumb]:w-6',
  '[&::-webkit-slider-thumb]:rounded-full',
  '[&::-webkit-slider-thumb]:border-2',
  '[&::-webkit-slider-thumb]:border-neutral-900',
  '[&::-webkit-slider-thumb]:bg-white',
  '[&::-webkit-slider-thumb]:shadow-sm',
  'dark:[&::-webkit-slider-thumb]:border-neutral-100',
  'dark:[&::-webkit-slider-thumb]:bg-neutral-900',
  // Gecko
  '[&::-moz-range-track]:h-1.5',
  '[&::-moz-range-track]:rounded-full',
  '[&::-moz-range-track]:bg-neutral-200',
  'dark:[&::-moz-range-track]:bg-neutral-700',
  '[&::-moz-range-thumb]:h-6',
  '[&::-moz-range-thumb]:w-6',
  '[&::-moz-range-thumb]:rounded-full',
  '[&::-moz-range-thumb]:border-2',
  '[&::-moz-range-thumb]:border-neutral-900',
  '[&::-moz-range-thumb]:bg-white',
  'dark:[&::-moz-range-thumb]:border-neutral-100',
  'dark:[&::-moz-range-thumb]:bg-neutral-900',
].join(' ')

export function WeightSlider({
  alpha,
  onChange,
  explain,
  autoDemo,
}: {
  alpha: number
  onChange: (a: number) => void
  explain: string | null
  autoDemo?: boolean
}) {
  const reduced = useReducedMotion()
  const [demoing, setDemoing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 演示要在 effect 里连续调 onChange，但不能因为 onChange 的引用变化就重启演示
  const onChangeRef = useRef(onChange)
  const alphaRef = useRef(alpha)
  useEffect(() => {
    onChangeRef.current = onChange
    alphaRef.current = alpha
  })

  const demoedRef = useRef(false)

  useEffect(() => {
    if (!autoDemo || reduced || demoedRef.current) return

    const from = alphaRef.current
    let raf = 0
    let done = false

    function stop() {
      done = true
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      window.removeEventListener('pointerdown', abort, true)
      window.removeEventListener('keydown', abort, true)
      window.removeEventListener('touchstart', abort, true)
      setDemoing(false)
    }

    // 用户一动手就让位。若他动的正是滑杆本身，就别再把值抢回去 ——
    // 他的拖动紧接着就会覆盖，中间插一次回弹只会看起来像卡了一下。
    function abort(e: Event) {
      if (done) return
      const target = e.target as Node | null
      const onSlider = !!target && !!containerRef.current?.contains(target)
      stop()
      if (!onSlider) onChangeRef.current(normalizeAlpha(from))
    }

    function play() {
      if (done) return
      // 「只演示一次」的标记打在真的开演这一刻，不能打在 effect 入口 ——
      // 开发模式下 StrictMode 会把 effect 跑两遍（挂载→清理→再挂载），
      // 打在入口的话第二遍会被自己的标记挡掉，演示在 dev 里永远不播。
      demoedRef.current = true
      setDemoing(true)
      const t0 = performance.now()
      const step = (now: number) => {
        if (done) return
        const elapsed = now - t0
        if (elapsed >= DEMO_TOTAL) {
          onChangeRef.current(normalizeAlpha(from))
          stop()
          return
        }
        onChangeRef.current(normalizeAlpha(demoAlphaAt(elapsed, from)))
        raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }

    const timer = setTimeout(play, DEMO_DELAY)
    window.addEventListener('pointerdown', abort, true)
    window.addEventListener('keydown', abort, true)
    window.addEventListener('touchstart', abort, true)

    return stop
  }, [autoDemo, reduced])

  // 滑杆左端 = 规模优先 = alpha 1，所以 UI 值要翻过来
  const uiValue = Number((1 - alpha).toFixed(2))

  const valueText =
    alpha > 0.5
      ? `偏向规模优先 ${Math.round((alpha - 0.5) * 200)}%`
      : alpha < 0.5
        ? `偏向概率优先 ${Math.round((0.5 - alpha) * 200)}%`
        : '规模与概率各占一半'

  return (
    <div ref={containerRef} className="select-none">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-medium">规模优先</div>
          <div className="mt-0.5 text-[11px] leading-tight text-neutral-500 dark:text-neutral-400">
            人多、氛围强、校友网密
          </div>
        </div>
        <div className="min-w-0 text-right">
          <div className="text-[13px] font-medium">概率优先</div>
          <div className="mt-0.5 text-[11px] leading-tight text-neutral-500 dark:text-neutral-400">
            只看我家孩子的命中率
          </div>
        </div>
      </div>

      <div className="relative mt-2.5 py-2">
        {/* 中点刻度：默认位置在哪儿要看得见 */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-neutral-300 dark:bg-neutral-600"
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={uiValue}
          onChange={(e) => onChange(normalizeAlpha(1 - Number(e.target.value)))}
          aria-label="排序权重：规模优先 ↔ 概率优先"
          aria-valuetext={valueText}
          // touch-action:pan-y —— 横向手势归滑杆（不加的话拖动会被页面滚动抢走），
          // 纵向手势仍然还给页面。不能用 none：滑杆在 390px 下是通栏的，
          // 手指落在它上面就划不动页面，还会顺手把榜单排序刮走。
          className={`relative w-full cursor-pointer appearance-none bg-transparent [touch-action:pan-y] focus-visible:outline-none ${TRACK_CLASS}`}
        />
      </div>

      <div className="flex min-h-10 items-start gap-2">
        {demoing ? (
          <span className="mt-px shrink-0 rounded-full border border-neutral-300 px-1.5 py-px text-[10px] leading-tight text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            演示中
          </span>
        ) : null}
        <p className="text-[12px] leading-relaxed text-neutral-600 dark:text-neutral-400">
          {explain ??
            (reduced && autoDemo
              ? '拖动上面的滑杆试试 —— 榜单会实时重排，第 1 名通常会换人。'
              : `当前：${valueText}。拖动即重排，没有确定按钮。`)}
        </p>
      </div>
    </div>
  )
}

export default WeightSlider
