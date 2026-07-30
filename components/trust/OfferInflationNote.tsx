'use client'

// 「什么是 offer 膨胀」（PRD US-1.0 / US-7.3）。
//
// 这个组件放在首屏，是访客理解「这个榜单和别的榜单不一样」的唯一入口 ——
// 线上没有解说员，这段字就是解说词。
//
// 正文含括号注记共 144 字（去空白），卡在 PRD 要求的 150 字以内。改文案前先数一遍。

import { useState } from 'react'

const BODY =
  '学校战报公布的是 offer 数，不是入读人数——一个学生可以同时拿到多所大学的 offer。深圳国际交流学院 2025 届约 450 名毕业生，收到 2000 多份 offer，人均 4.4 枚。所以「斩获 30 枚藤校 offer」可能只对应 6 个学生。本站默认展示去重人数。'

// 这组数字目前来自战报的公开转述，尚未逐条回溯到学校官方发布页（docs/metrics.md §3.1）。
// 在补上来源链接之前，界面上必须自己说清楚它待核实 —— 不能只在文档里说。
const CAVEAT = '（深国交这组数字来自公开转述，待核实。）'

export default function OfferInflationNote() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-sm border border-rule bg-paper/70 px-3 py-2 text-sm leading-relaxed">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-medium">什么是 offer 膨胀？</span>
        <span className="shrink-0 text-xs text-ink-muted">{open ? '收起' : '展开'}</span>
      </button>

      {open && (
        <div className="mt-2 border-t border-rule pt-2">
          <p className="text-[13px] leading-relaxed text-ink-muted">{BODY}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{CAVEAT}</p>
        </div>
      )}
    </div>
  )
}

export { OfferInflationNote }
