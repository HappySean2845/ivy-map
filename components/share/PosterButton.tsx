'use client'

// 分享长图入口（PRD US-8.3，P0，「绝不砍」清单）。
//
// 家长的真实动作是「生成一张图，发到家长群 / 发给先生」。所以这里只有两条路径要顺：
//   1. 手机上长按图片保存到相册 —— 微信里的主路径，占绝大多数；
//   2. 桌面上点「下载图片」。
//
// 图不是截页面 DOM 来的，是 PosterLayout 用 canvas 画的（理由见那个文件的开头）。
// 这里只负责：什么时候画、画完怎么给用户、画不出来时说人话。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emptyResultCopy } from '@/lib/copy'
import { type Filters } from '@/lib/filters'
import { toQueryString } from '@/lib/urlState'
import type { FeederRowView } from '@/lib/view'
import { buildPosterModel, renderPosterPng, type PosterImage } from './PosterLayout'

export interface PosterButtonProps {
  universityId: string
  rows: FeederRowView[]
  filters: Filters
}

export function PosterButton({ universityId, rows, filters }: PosterButtonProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [image, setImage] = useState<PosterImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // 榜单里真正会出现在图上的行 —— 要和用户屏幕上看到的一致
  const visible = useMemo(
    () =>
      filters.hideIneligible ? rows.filter((r) => r.eligibility.status !== 'ineligible') : rows,
    [rows, filters.hideIneligible],
  )
  const hasContent = Boolean(universityId) && visible.length > 0

  /**
   * 输入指纹。筛选条件或榜单一变，上一张图就作废 ——
   * 否则用户拖完滑杆再点分享，拿到的还是旧排序那张，而他不会发现。
   */
  const signature = useMemo(
    () =>
      `${universityId}|${toQueryString(filters)}|${visible
        .slice(0, 5)
        .map((r) => r.school.id)
        .join(',')}`,
    [universityId, filters, visible],
  )
  const renderedFor = useRef<string | null>(null)

  const generate = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const model = buildPosterModel({ universityId, rows, filters })
      const img = await renderPosterPng(model)
      setImage(img)
      renderedFor.current = signature
    } catch (e) {
      setImage(null)
      renderedFor.current = null
      setError(
        e instanceof Error && e.message
          ? e.message
          : '长图生成失败。可以先用「复制链接」把当前视图发出去，对方打开看到的和你完全一样。',
      )
    } finally {
      setBusy(false)
    }
  }, [universityId, rows, filters, signature])

  // 打开时才画：出图要跑一遍排版，没人点就不该花这个时间
  useEffect(() => {
    if (!open || !hasContent) return
    if (renderedFor.current === signature && image) return
    void generate()
    // image 只用来判断「已经有图了」，不该因为它变化而重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasContent, signature, generate])

  // 弹层打开时锁背景滚动 + Esc 关闭
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const emptyHint = hasContent
    ? null
    : emptyResultCopy({ ...filters, universityId: universityId || filters.universityId }).text

  const fileName = `ivy-map-${universityId || 'view'}-${new Date().toISOString().slice(0, 10)}.png`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-rule bg-paper px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-rule-strong hover:bg-paper active:bg-paper"
      >
        <ImageIcon />
        生成分享长图
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="分享长图"
          className="fixed inset-0 z-50 flex flex-col bg-ink/70"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-paper">分享长图</p>
              <p className="truncate text-xs text-paper/60">图上已包含口径说明与免责声明</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-sm px-3 py-1.5 text-sm text-paper/80 hover:bg-paper/10 hover:text-paper"
            >
              关闭
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="mx-auto w-full max-w-[420px]">
              {!hasContent && (
                <div className="rounded-sm bg-paper p-5 text-sm leading-relaxed text-ink-muted">
                  <p className="mb-2 font-semibold">当前筛选下还没有可分享的榜单</p>
                  {/* 空态给具体原因，不给一张空图（PRD §9） */}
                  <p className="text-ink-muted">{emptyHint}</p>
                  <p className="mt-3 text-xs text-ink-muted">
                    调整筛选条件后再回来，长图会按新的榜单重新生成。
                  </p>
                </div>
              )}

              {hasContent && busy && (
                <div
                  aria-live="polite"
                  className="rounded-sm bg-paper/95 px-5 py-10 text-center text-sm text-ink-muted"
                >
                  正在生成长图…
                </div>
              )}

              {hasContent && !busy && error && (
                <div className="rounded-sm bg-paper p-5 text-sm leading-relaxed text-ink-muted">
                  <p className="mb-2 font-semibold text-signal">{error}</p>
                  <button
                    type="button"
                    onClick={() => void generate()}
                    className="mt-2 rounded-sm border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-paper"
                  >
                    重试
                  </button>
                </div>
              )}

              {hasContent && !busy && !error && image && (
                <figure className="m-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.dataUrl}
                    width={image.width}
                    height={image.height}
                    alt="IVY Map 分享长图：目标大学、筛选条件、榜单 Top 5、口径说明、数据来源与免责声明"
                    className="block h-auto w-full rounded-sm bg-paper"
                  />
                  <figcaption className="mt-3 text-center text-xs leading-relaxed text-paper/70">
                    手机上长按图片即可保存到相册，或转发到聊天
                  </figcaption>
                </figure>
              )}
            </div>
          </div>

          <footer className="shrink-0 border-t border-white/10 px-4 py-3">
            <div className="mx-auto flex w-full max-w-[420px] items-center gap-2">
              <a
                href={image?.dataUrl ?? '#'}
                download={fileName}
                aria-disabled={!image}
                onClick={(e) => {
                  if (!image) e.preventDefault()
                }}
                className={`flex-1 rounded-sm px-4 py-2.5 text-center text-sm font-semibold ${
                  image
                    ? 'bg-paper text-ink hover:bg-paper'
                    : 'pointer-events-none bg-paper/30 text-paper/60'
                }`}
              >
                下载图片
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm border border-white/25 px-4 py-2.5 text-sm text-paper/80 hover:bg-paper/10"
              >
                返回
              </button>
            </div>
          </footer>
        </div>
      )}
    </>
  )
}

function ImageIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <circle cx="7" cy="8" r="1.4" />
      <path d="M3 14l4.2-4 3 2.6L13.4 9l3.6 4" />
    </svg>
  )
}

export default PosterButton
