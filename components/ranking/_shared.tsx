'use client'

// 榜单区四个组件共用的小零件。只在 components/ranking/ 内部使用，
// 前缀下划线是为了让人一眼看出「这不是对外的组件契约」。

import { useSyncExternalStore, type ReactNode } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

let mql: MediaQueryList | null = null
function getMql(): MediaQueryList | null {
  if (!mql && typeof window !== 'undefined') mql = window.matchMedia(REDUCED_MOTION)
  return mql
}

/**
 * 尊重系统的「减弱动效」设置。
 * 走 useSyncExternalStore 而不是 useEffect + setState：服务端快照恒为 false，
 * 客户端首帧就是真实值，不会先播一帧动画再纠正。
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = getMql()
      m?.addEventListener('change', cb)
      return () => m?.removeEventListener('change', cb)
    },
    () => getMql()?.matches ?? false,
    () => false,
  )
}

/**
 * 筛选用的开关标签。移动端是主场景，所以最小高度按可点击尺寸给（32px + 外围间距）。
 */
export function Chip({
  selected,
  onClick,
  children,
  title,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[13px] leading-none transition-colors ${
        selected
          ? 'border-rule-strong bg-ink text-paper'
          : 'border-rule text-ink-muted hover:border-rule-strong hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/** 一行表单：左边标签，右边内容。窄屏下标签换到上面。 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <div className="shrink-0 pt-1 sm:w-24">
        <span className="text-[13px] text-ink-muted">{label}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-1.5">{children}</div>
        {hint ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}

/** 原生 select 的统一样式。color-scheme 让下拉面板在深色下也跟随系统。 */
export const SELECT_CLASS =
  'min-h-8 rounded-sm border border-rule bg-transparent px-2 text-[13px] text-ink [color-scheme:light_dark]'
