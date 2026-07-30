// 纠错入口（PRD US-7.4 最小版）。
//
// 只是一个指向外部表单的链接：产品自身不接收任何写入，全站保持纯读架构。
// 线上产品最怕的是错了没人告诉你，所以这个链接必须出现在每一处「待补充」旁边，
// 而不是只在页脚放一个。

import type { School } from '@/types'
import { correctionUrl } from './schoolData'

export function CorrectionLink({
  school,
  field,
  className = '',
}: {
  school: School
  /** 从哪个字段点进来的，会带进表单以减少填写成本 */
  field?: string
  className?: string
}) {
  return (
    <a
      href={correctionUrl(school, field)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-[32px] items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-100 ${className}`}
      title="提交的更正会经过人工核实，不会立即生效"
    >
      数据有误 / 我知道这项 →
    </a>
  )
}

export default CorrectionLink
