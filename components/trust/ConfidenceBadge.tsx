// 置信等级标注（PRD US-7.2 + design-system.md §4）。
//
// 从彩色徽章改成**脚注式上标**。这不是审美偏好：
// 论文引注的形式本身就在说「我说的话你可以去查」——和这个产品要说的话
// 是同一件事。彩色徽章看起来像 App 的状态标签，反而削弱可信度。
//
//   L1 官方一手   →  ¹        实心数字
//   L2 权威二手   →  ⁽²⁾      加括号
//   L3 推断/众包  →  ⁽³⁾ˀ     括号加问号
//
// 折算过的数字额外跟一个 ≈，并且用信号色（朱红）——它是四种「需要注意」
// 的场景之一（design-system.md §2）。

import type { Confidence } from '@/types'
import { Tip } from './tip'

const LEVELS: Record<Confidence, { mark: string; desc: string }> = {
  L1: {
    mark: '1',
    desc: 'L1 · 官方一手：学校或大学官方渠道直接发布的数据，未经转述。',
  },
  L2: {
    mark: '(2)',
    desc: 'L2 · 权威二手：媒体报道或行业报告转述的官方数据，可能存在转述误差。',
  },
  L3: {
    mark: '(3)?',
    desc: 'L3 · 推断或众包：由其他数据推断，或来自家长、校友等非官方渠道，建议自行核实。',
  },
}

const ESTIMATED_DESC =
  '估算：这个数字由 offer 数按该校当年人均 offer 系数折算而来，不是学校公布的人数，置信等级已相应下调一级。'

export default function ConfidenceBadge({
  level,
  estimated,
}: {
  level: Confidence
  estimated?: boolean
}) {
  const meta = LEVELS[level]
  return (
    <span className="inline-flex items-baseline">
      <Tip text={meta.desc}>
        <sup className="footnote-ref" aria-label={meta.desc}>
          {meta.mark}
        </sup>
      </Tip>
      {estimated ? (
        <Tip text={ESTIMATED_DESC}>
          <sup className="footnote-ref !text-ink/50" aria-label={ESTIMATED_DESC}>
            ≈
          </sup>
        </Tip>
      ) : null}
    </span>
  )
}

export { ConfidenceBadge }
