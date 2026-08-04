'use client'

// date app 式刷卡。左划跳过，右划收藏。
//
// **为什么手写而不引 framer-motion**：整个仓库目前零动画库，为一个手势加一个
// 50KB gzip 的运行时不划算。pointer events 覆盖触屏和鼠标两种输入，
// 一百多行就够，而且能精确控制「点链接不算划卡」这种细节。
//
// 三件容易漏的事：
// 1. **键盘也要能划。** 桌面端没人愿意用鼠标拖，而且这是无障碍的底线。
// 2. **`prefers-reduced-motion` 下不做位移动画**，直接换卡。
// 3. **卡片里的链接不能触发拖动** —— 靠链接自己 stopPropagation（见 UniversityCard），
//    这里再兜一层 closest('a')。

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { UniversityCard } from '@/components/v2/UniversityCard'
import { brandOf } from '@/lib/v2/brand'
import type { UniversityView } from '@/lib/v2/profile'
import { useShortlist } from '@/lib/v2/shortlist'

type Direction = 'left' | 'right'

/** 划出判定：位移过屏宽这个比例，或者甩得够快 */
const DISTANCE_RATIO = 0.25
const VELOCITY = 0.5 // px/ms
const EXIT_MS = 200

export function SwipeDeck({
  views,
  onExhausted,
}: {
  views: UniversityView[]
  /** 刷完时展示的下一步入口，由页面提供 */
  onExhausted?: React.ReactNode
}) {
  const { add } = useShortlist()
  const [index, setIndex] = useState(0)
  const [skipped, setSkipped] = useState<string[]>([])
  const [liked, setLiked] = useState<string[]>([])
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null)
  const [exit, setExit] = useState<Direction | null>(null)

  const startRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const reduceMotion = useRef(false)

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const current = views[index]
  const next = views[index + 1]

  const commit = useCallback(
    (dir: Direction) => {
      const view = views[index]
      if (!view) return
      const id = view.university.id
      if (dir === 'right') {
        add(id)
        setLiked((prev) => (prev.includes(id) ? prev : [...prev, id]))
      } else {
        setSkipped((prev) => (prev.includes(id) ? prev : [...prev, id]))
      }
      setDrag(null)

      if (reduceMotion.current) {
        setIndex((i) => i + 1)
        return
      }
      setExit(dir)
      window.setTimeout(() => {
        setIndex((i) => i + 1)
        setExit(null)
      }, EXIT_MS)
    },
    [add, index, views],
  )

  // 键盘操作。输入框聚焦时让位给光标移动，否则搜索框里没法用左右键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      if (typing || exit != null || !views[index]) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        commit('left')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        commit('right')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commit, exit, index, views])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (exit != null) return
    // 卡片里的链接和按钮各管各的
    if (e.target instanceof Element && e.target.closest('a,button')) return
    startRef.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ dx: 0, dy: 0 })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current
    if (!start) return
    setDrag({ dx: e.clientX - start.x, dy: (e.clientY - start.y) * 0.35 })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current
    startRef.current = null
    if (!start) return

    const dx = e.clientX - start.x
    const dt = Math.max(1, e.timeStamp - start.t)
    const threshold = Math.min(window.innerWidth, 640) * DISTANCE_RATIO
    const fast = Math.abs(dx) / dt > VELOCITY && Math.abs(dx) > 40

    if (Math.abs(dx) > threshold || fast) commit(dx > 0 ? 'right' : 'left')
    else setDrag(null) // 没过阈值，弹回去
  }

  // ── 刷完了
  if (!current) {
    return (
      <section className="border border-ink p-6 sm:p-8">
        <p className="label text-ink/40">刷完了</p>
        <h2 className="mt-3 text-2xl leading-tight sm:text-[32px]">
          {views.length} 所都过了一遍
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/60 tnum">
          收藏 {liked.length} 所 · 跳过 {skipped.length} 所。
          跳过的没有被删掉 —— 换成瀑布流可以一次看全部，也能用右上角搜索直接找。
        </p>
        <div className="mt-5 flex flex-wrap gap-5 text-sm">
          <Link href="/v2/shortlist">看我的收藏 →</Link>
          <button
            type="button"
            onClick={() => {
              setIndex(0)
              setSkipped([])
              setLiked([])
            }}
            className="text-ink/70"
          >
            再刷一遍 →
          </button>
        </div>
        {onExhausted}
      </section>
    )
  }

  const brand = brandOf(current.profile.brandColor)
  const dx = exit ? (exit === 'right' ? 1 : -1) * 640 : (drag?.dx ?? 0)
  const dy = exit ? -40 : (drag?.dy ?? 0)
  const moving = drag != null

  // 拖动过半程时提示会落到哪一边
  const intent =
    Math.abs(dx) > 56 && !exit ? (dx > 0 ? 'right' : 'left') : exit ? exit : null

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <p className="label text-ink/40 tnum">
          {index + 1} / {views.length}
        </p>
        <p className="text-xs text-ink/50 tnum">已收藏 {liked.length}</p>
      </div>

      <div className="relative mt-3 h-[540px] select-none sm:h-[560px]">
        {/* 下一张露出边缘，告诉用户后面还有 */}
        {next && (
          <div aria-hidden className="absolute inset-x-2 top-2 bottom-0 -z-10 opacity-40">
            <UniversityCard view={next} variant="deck" className="h-full" />
          </div>
        )}

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute inset-0 touch-pan-y"
          style={{
            transform: `translate(${dx}px, ${dy}px) rotate(${dx * 0.03}deg)`,
            opacity: exit ? 0 : 1,
            // 拖动中不能有 transition，否则跟手感全没了
            transition: moving
              ? 'none'
              : `transform ${EXIT_MS}ms ease-out, opacity ${EXIT_MS}ms ease-out`,
          }}
        >
          <UniversityCard view={current} variant="deck" className="h-full" />

          {/* 划动意图提示。右划用校色（design-system-v2.md 允许的第四处），左划纯黑 */}
          {intent && (
            <span
              aria-hidden
              className="label absolute top-5 px-2 py-1 text-paper"
              style={{
                background: intent === 'right' ? brand : 'var(--ink)',
                ...(intent === 'right' ? { right: '1.25rem' } : { left: '1.25rem' }),
              }}
            >
              {intent === 'right' ? '收藏' : '跳过'}
            </span>
          )}
        </div>
      </div>

      {/* 按钮不是装饰：触屏之外的人靠它，也是键盘操作的说明书 */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => commit('left')}
          className="border border-ink px-5 py-2 text-sm"
          data-tap
        >
          ← 跳过
        </button>
        <button
          type="button"
          onClick={() => commit('right')}
          className="border border-ink bg-ink px-5 py-2 text-sm text-paper"
          data-tap
        >
          收藏 →
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-ink/40">
        也可以直接拖动卡片，或用键盘左右方向键
      </p>
    </section>
  )
}

export default SwipeDeck
