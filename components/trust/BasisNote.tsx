// 口径标注（PRD US-7.3）。
//
// 「4 个人」和「4 枚 offer」在战报里长得一模一样，但对家长的含义差一个数量级。
// 所以每个录取数值旁边都得挂一个这玩意儿，不能只在页面顶部说一次。

import type { Basis } from '@/types'
import { Tip } from './tip'

const BASES: Record<Basis, { label: string; desc: string; cls: string }> = {
  admits: {
    label: '人数',
    desc: '人数口径：去重后的人头数，一个学生只计一次。这是本站的默认口径。',
    cls: 'border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
  },
  offers: {
    label: 'offer 数',
    desc: 'offer 口径：学校公布的 offer 枚数，一个学生可能贡献多枚，因此会高于实际人数。',
    cls: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300',
  },
  estimated: {
    label: '估算',
    desc: '估算口径：由 offer 数按该校当年人均 offer 系数折算而来，不是学校公布的人数。',
    cls: 'border-dashed border-zinc-400 bg-zinc-50 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400',
  },
}

export default function BasisNote({
  basis,
  className = '',
}: {
  basis: Basis
  className?: string
}) {
  const meta = BASES[basis]
  return (
    <Tip text={meta.desc}>
      <span
        className={`inline-flex cursor-help items-center rounded border px-1.5 py-px text-[11px] font-medium leading-tight ${meta.cls} ${className}`}
        aria-label={meta.desc}
      >
        {meta.label}
      </span>
    </Tip>
  )
}

export { BasisNote }
