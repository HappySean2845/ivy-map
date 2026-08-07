'use client'

import { useState, type ReactNode } from 'react'

export interface RegionSchoolGroup {
  id: string
  label: string
  count: number
  content: ReactNode
}

export function RegionSchoolTabs({ groups }: { groups: RegionSchoolGroup[] }) {
  const [selectedId, setSelectedId] = useState(groups[0]?.id ?? '')

  if (groups.length === 0) return null

  return (
    <div className="mt-5">
      <div
        role="tablist"
        aria-label="按地区筛选高中"
        className="flex overflow-x-auto rounded-2xl bg-cream p-1.5"
      >
        {groups.map((group) => {
          const selected = group.id === selectedId
          return (
            <button
              key={group.id}
              id={`${group.id}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${group.id}-panel`}
              onClick={() => setSelectedId(group.id)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-left transition-colors ${
                selected
                  ? 'bg-forest text-paper'
                  : 'text-ink/60 hover:bg-mint hover:text-forest'
              }`}
            >
              <span className="text-sm">{group.label}</span>
              <span
                className={`ml-2 text-[11px] tnum ${selected ? 'text-paper/60' : 'text-ink/40'}`}
              >
                {group.count}
              </span>
            </button>
          )
        })}
      </div>

      {groups.map((group) => (
        <div
          key={group.id}
          id={`${group.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${group.id}-tab`}
          hidden={group.id !== selectedId}
        >
          {group.content}
        </div>
      ))}
    </div>
  )
}

export default RegionSchoolTabs
