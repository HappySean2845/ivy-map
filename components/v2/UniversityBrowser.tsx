// 大学目录。所有卡片服务端直出，不再有刷卡或收藏状态。

import { UniversityCard } from '@/components/v2/UniversityCard'
import { deckOrder } from '@/lib/v2/profile'

export function UniversityBrowser() {
  const views = deckOrder()

  return (
    <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {views.map((view) => (
        <li key={view.university.id}>
          <UniversityCard view={view} variant="grid" className="h-full" />
        </li>
      ))}
    </ul>
  )
}

export default UniversityBrowser
