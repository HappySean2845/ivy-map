// 可信层内部工具，不对外暴露。
//
// 说明气泡故意不用 JS：ConfidenceBadge / BasisNote 会被塞进榜单的每一行，
// 每行挂一个 client 组件不划算。悬停和聚焦都能触发 —— 移动端点一下即聚焦，
// 所以不违反 US-8.1「不依赖悬停交互」。
//
// 气泡向左展开（right-0）而不是居中：徽章常出现在表格右侧，居中展开会顶出
// 视口右边缘，在 390px 上会撑出横向滚动。向左溢出则不会。

import type { ReactNode } from 'react'

export function Tip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex align-middle" tabIndex={0}>
      {children}
      <span
        role="note"
        className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 hidden w-56 max-w-[calc(100vw-2rem)] rounded-sm border border-rule bg-paper px-2.5 py-2 text-left text-[11px] font-normal leading-relaxed text-ink-muted shadow-sm group-hover:block group-focus:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  )
}
