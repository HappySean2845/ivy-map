// 置信等级徽章（PRD US-7.2）。
//
// 等级本身不解释就是个没意义的字母，所以徽章必须自带说明 —— 见 tip.tsx。

import type { Confidence } from '@/types'
import { Tip } from './tip'

const LEVELS: Record<Confidence, { name: string; desc: string; cls: string }> = {
  L1: {
    name: '官方一手',
    desc: 'L1 · 官方一手：学校或大学官方渠道直接发布的数据，未经转述。',
    cls: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
  L2: {
    name: '权威二手',
    desc: 'L2 · 权威二手：媒体报道或行业报告转述的官方数据，可能存在转述误差。',
    cls: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
  },
  L3: {
    name: '推断或众包',
    desc: 'L3 · 推断或众包：由其他数据推断，或来自家长、校友等非官方渠道，建议自行核实。',
    cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
}

const ESTIMATED_DESC =
  '估算：这个数字由 offer 数按该校当年人均 offer 系数折算而来，不是学校公布的人数，置信等级已相应下调一级。'

const CHIP =
  'inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium leading-tight tabular-nums'

export default function ConfidenceBadge({
  level,
  estimated,
}: {
  level: Confidence
  estimated?: boolean
}) {
  const meta = LEVELS[level]
  return (
    <span className="inline-flex items-center gap-1">
      <Tip text={meta.desc}>
        <span className={`${CHIP} ${meta.cls} cursor-help`} aria-label={meta.desc}>
          {level}
        </span>
      </Tip>
      {estimated ? (
        <Tip text={ESTIMATED_DESC}>
          <span
            className={`${CHIP} cursor-help border-dashed border-zinc-400 bg-zinc-50 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400`}
            aria-label={ESTIMATED_DESC}
          >
            估算
          </span>
        </Tip>
      ) : null}
    </span>
  )
}

// 默认导出和具名导出都给 —— 别的组件用哪种 import 都不会踩空
export { ConfidenceBadge }
