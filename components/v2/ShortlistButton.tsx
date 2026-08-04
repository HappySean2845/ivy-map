'use client'

// 收藏按钮。详情页和网格里都用它。
//
// `ready` 之前不能显示「未收藏」—— 那一帧会让已经收藏过的学校闪成没收藏，
// 用户会以为收藏丢了（见 lib/v2/shortlist.ts）。

import { useShortlist } from '@/lib/v2/shortlist'

export function ShortlistButton({
  universityId,
  className = '',
  labels = { on: '已收藏', off: '收藏' },
}: {
  universityId: string
  className?: string
  labels?: { on: string; off: string }
}) {
  const { ids, ready, toggle } = useShortlist()
  const saved = ready && ids.includes(universityId)

  return (
    <button
      type="button"
      onClick={() => toggle(universityId)}
      aria-pressed={saved}
      className={`${saved ? 'bg-ink text-paper' : 'bg-paper text-ink/60'} ${className}`}
      data-tap
    >
      {saved ? labels.on : labels.off}
    </button>
  )
}

export default ShortlistButton
