'use client'

// 全站数值溯源（PRD US-7.1）—— 产品原则 §5.1「每个数字都要有出处」的落地件。
//
// 包住任意数值，点一下展开它的全部出处。两点值得说明：
//
// 1. 移动端走底部抽屉而不是浮层。主要流量来自微信里点开的链接，浮层在 390px
//    上要么盖住数值本身，要么被顶出视口。
// 2. 面板挂到 body 上（Portal）+ position: fixed。榜单表格是 overflow-x-auto，
//    绝对定位的浮层会被它裁掉。

import { createPortal } from 'react-dom'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { dataset, schoolById, sourceById, universityById } from '@/lib/data'
import { TRACK_LABEL, type Admission, type Source } from '@/types'
import ConfidenceBadge from './ConfidenceBadge'

const SOURCE_TYPE_LABEL: Record<Source['type'], string> = {
  official: '官方发布',
  media: '媒体报道',
  report: '行业报告',
  crowdsourced: '众包补充',
}

// SSR 时 useLayoutEffect 会告警，但换成 useEffect 又会让浮层先按抽屉样式画一帧。
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const PANEL_W = 336
const MARGIN = 8
/** 低于这个宽度用底部抽屉，和 Tailwind 的 sm 断点保持一致 */
const SHEET_MAX_W = 640

interface Pos {
  top: number
  left: number
}

export default function SourcePopover({
  sourceIds,
  children,
  className = '',
}: {
  sourceIds: string[]
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null) // null = 底部抽屉
  const triggerRef = useRef<HTMLButtonElement>(null)

  const ids = useMemo(() => dedupe(sourceIds), [sourceIds])
  const sources = useMemo(
    () => ids.map((id) => sourceById.get(id)).filter((s): s is Source => s != null),
    [ids],
  )
  const missingIds = useMemo(() => ids.filter((id) => !sourceById.has(id)), [ids])
  const conflicts = useMemo(() => findConflicts(ids), [ids])

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    if (window.innerWidth < SHEET_MAX_W) {
      setPos(null)
      return
    }
    const r = el.getBoundingClientRect()
    const left = Math.min(
      Math.max(MARGIN, r.left),
      Math.max(MARGIN, window.innerWidth - PANEL_W - MARGIN),
    )
    // 下方放不下就翻到上方，翻上去也放不下就贴顶
    const spaceBelow = window.innerHeight - r.bottom
    const top = spaceBelow > 240 ? r.bottom + 6 : Math.max(MARGIN, r.top - 6 - 280)
    setPos({ top, left })
  }, [])

  useIsoLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const panel = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="数据来源"
      className={
        pos
          ? 'fixed z-[70] w-[336px] overflow-hidden rounded-sm border border-rule bg-paper shadow-sm'
          : 'fixed inset-x-0 bottom-0 z-[70] max-h-[80vh] overflow-hidden rounded-t-2xl border-t border-rule bg-paper shadow-sm'
      }
      style={pos ? { top: pos.top, left: pos.left } : undefined}
    >
      {pos ? null : (
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-paper-sunk" />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-2.5">
        <h3 className="text-sm font-semibold">数据来源</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="-mr-1 rounded px-2 py-1 text-xs text-ink-muted hover:bg-paper"
        >
          关闭
        </button>
      </div>

      <div className="max-h-[calc(80vh-6rem)] overflow-y-auto px-4 py-3 sm:max-h-[19rem]">
        {conflicts.length > 0 && <ConflictNotice conflicts={conflicts} />}

        {sources.length === 0 ? (
          <p className="text-xs leading-relaxed text-ink-muted">
            这项数据尚未登记来源。按产品原则，没有出处的数值不应出现在界面上 ——
            如果你看到了它，是我们的疏漏，请通过页面底部的纠错入口告诉我们。
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sources.map((s) => (
              <li key={s.id} className="text-xs leading-relaxed">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline underline-offset-2 hover:text-accent"
                >
                  {s.title}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-muted">
                  <span>{SOURCE_TYPE_LABEL[s.type]}</span>
                  <span aria-hidden>·</span>
                  <span>发布 {s.publishedAt ?? '未标注'}</span>
                  <span aria-hidden>·</span>
                  <span>采集 {s.capturedAt}</span>
                  <ConfidenceBadge level={s.confidence} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {missingIds.length > 0 && (
          <p className="mt-3 border-t border-rule pt-2 text-[11px] leading-relaxed text-signal">
            另有 {missingIds.length} 条来源记录未在本次数据集中找到，已按「无来源」处理。
          </p>
        )}

        <p className="mt-3 border-t border-rule pt-2 text-[11px] leading-relaxed text-ink-muted">
          来源为公开发布内容，由 IVY Map 整理，可能存在滞后。
        </p>
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-0.5 border-b border-dotted border-rule-strong text-left hover:border-rule-strong ${className}`}
        title="查看数据来源"
      >
        {children}
        <span aria-hidden className="text-[10px] leading-none text-ink-faint">
          ⓘ
        </span>
        <span className="sr-only">查看数据来源</span>
      </button>

      {/* open 只可能由点击置为 true，SSR 时永远是 false，所以这里碰不到 document */}
      {open
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[60] bg-ink/20 sm:bg-transparent"
                onClick={() => setOpen(false)}
              />
              {panel}
            </>,
            document.body,
          )
        : null}
    </>
  )
}

export { SourcePopover }

// ---------------------------------------------------------------------------

function dedupe(ids: string[]): string[] {
  return ids.filter((id, i) => id && ids.indexOf(id) === i)
}

/**
 * 找出这些来源牵扯到的「多来源数值不一致」的录取记录。
 *
 * conflict 挂在 Admission 上而不是 Source 上，而本组件按契约只拿得到 sourceIds，
 * 所以只能反查。数据量是个位数条，这个开销可以忽略。
 */
function findConflicts(ids: string[]): Admission[] {
  if (ids.length === 0) return []
  const set = new Set(ids)
  return dataset.admissions.filter(
    (a) =>
      a.conflict != null &&
      (set.has(a.sourceId) || a.conflict.otherSourceIds.some((id) => set.has(id))),
  )
}

function ConflictNotice({ conflicts }: { conflicts: Admission[] }) {
  return (
    <div className="mb-3 rounded-sm border border-signal bg-signal-soft p-2.5/60">
      <p className="text-xs font-semibold text-signal">多来源不一致</p>
      <ul className="mt-1.5 flex flex-col gap-2">
        {conflicts.map((a, i) => {
          const school = schoolById.get(a.schoolId)?.nameCn ?? a.schoolId
          const university = universityById.get(a.universityId)?.nameCn ?? a.universityId
          const values = a.conflict?.values ?? []
          const involved = dedupe([a.sourceId, ...(a.conflict?.otherSourceIds ?? [])])
          return (
            <li
              key={`${a.schoolId}-${a.universityId}-${a.year}-${a.track}-${i}`}
              className="text-[11px] leading-relaxed text-signal"
            >
              <span className="font-medium">
                {a.year} · {school} → {university} · {TRACK_LABEL[a.track]}
              </span>
              <br />
              各来源给出的数值：
              {values.length > 0 ? (
                <span className="font-semibold tabular-nums">{values.join(' / ')}</span>
              ) : (
                <span>—</span>
              )}
              <br />
              {/* 不标注「哪个值出自哪个来源」：数据里只记了数值集合与来源集合，
                  没记两者的对应关系，硬配对就是编造。 */}
              涉及来源：{involved.map((id) => sourceById.get(id)?.title ?? id).join('、')}
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-signal/90">
        本站不替你在这些数值之间做选择。榜单采用置信等级最高的那条，其余数值全部列在上面，请点开原始链接自行判断。
      </p>
    </div>
  )
}
