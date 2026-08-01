'use client'

import { useRef, type KeyboardEvent } from 'react'

import type { DataMode } from '@/lib/filters'

interface Props {
  value: DataMode
  feederCount: number
  officialCount: number
  total: number
  onChange(value: DataMode): void
}

const MODES: DataMode[] = ['feeders', 'official']

export function DataModeTabs({ value, feederCount, officialCount, total, onChange }: Props) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const select = (next: DataMode, focus = false) => {
    onChange(next)
    if (focus) refs.current[MODES.indexOf(next)]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % MODES.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + MODES.length) % MODES.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = MODES.length - 1
    if (nextIndex == null) return
    event.preventDefault()
    select(MODES[nextIndex], true)
  }

  const tabs: Array<{ id: DataMode; label: string; count: number }> = [
    { id: 'feeders', label: '生源校去向', count: feederCount },
    { id: 'official', label: '大学录取概况', count: officialCount },
  ]

  return (
    <div
      role="tablist"
      aria-label="选择数据栏目"
      className="mt-5 grid max-w-2xl grid-cols-2 border border-ink"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[index] = node
            }}
            id={`data-mode-tab-${tab.id}`}
            role="tab"
            aria-selected={selected}
            aria-controls="data-mode-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`min-h-12 px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:px-4 ${
              index > 0 ? 'border-l border-ink' : ''
            } ${selected ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-ink/[0.05]'}`}
          >
            <span className="block text-sm sm:text-base">{tab.label}</span>
            <span
              className={`mt-0.5 block text-[11px] tnum ${selected ? 'text-paper/60' : 'text-ink/40'}`}
            >
              {tab.count} / {total} 所大学有数据
            </span>
          </button>
        )
      })}
    </div>
  )
}
