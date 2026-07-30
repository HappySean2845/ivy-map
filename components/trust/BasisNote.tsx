// 口径标注（PRD US-7.3）。
//
// 「4 个人」和「4 枚 offer」在战报里长得一模一样，但对家长的含义差一个数量级。
// 所以每个录取数值旁边都得挂一个这玩意儿，不能只在页面顶部说一次。
//
// 配色规则（design-system.md §2）：人数是默认口径，不需要提醒，用弱色；
// offer 和估算属于「需要注意」，用信号色（朱红）。红色越稀有越有分量。

import type { Basis } from '@/types'
import { Tip } from './tip'

const BASES: Record<Basis, { label: string; desc: string; signal: boolean }> = {
  admits: {
    label: '人数',
    desc: '人数口径：去重后的人头数，一个学生只计一次。这是本站的默认口径。',
    signal: false,
  },
  offers: {
    label: 'offer 数',
    desc: 'offer 口径：学校公布的 offer 枚数，一个学生可能贡献多枚，因此会高于实际人数。',
    signal: true,
  },
  estimated: {
    label: '估算',
    desc: '估算口径：由 offer 数按该校当年人均 offer 系数折算而来，不是学校公布的人数。',
    signal: true,
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
        className={`cursor-help text-[11px] leading-tight ${
          meta.signal ? 'text-signal' : 'text-ink-faint'
        } ${className}`}
        aria-label={meta.desc}
      >
        {meta.label}
      </span>
    </Tip>
  )
}

export { BasisNote }
