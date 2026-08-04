'use client'

// 右上角搜索。
//
// 两个用途，所以 onPick 是可选的：
//   - 导航里：不传 onPick，选中即跳到该校详情页
//   - 「选高中」分支：传 onPick，选中只是把目标大学填进上一层的状态，不跳页
//
// 32 条数据在内存里，搜索是同步的，所以没有 loading 态也不需要防抖。

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { countryLabel } from '@/lib/v2/profile'
import { searchUniversities } from '@/lib/v2/search'

export function SearchBox({
  onPick,
  placeholder = '搜索大学（中文名 / 英文名 / 缩写）',
  autoFocus = false,
  className = '',
}: {
  onPick?: (universityId: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const hits = useMemo(() => searchUniversities(query), [query])

  // 点外面关掉
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (universityId: string) => {
    setOpen(false)
    setQuery('')
    if (onPick) onPick(universityId)
    else router.push(`/v2/u/${universityId}`)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (hits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % hits.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = hits[active] ?? hits[0]
      if (hit) pick(hit.university.id)
    }
  }

  const showList = open && query.trim() !== ''

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="搜索大学"
        className="w-full text-sm"
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-[60vh] overflow-y-auto border border-ink bg-paper"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-ink/50">
              没有匹配的大学。目前收录 32 所，还在补。
            </li>
          ) : (
            hits.map((hit, i) => (
              <li key={hit.university.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => pick(hit.university.id)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left ${
                    i === active ? 'bg-ink text-paper' : ''
                  }`}
                  data-tap
                >
                  <span className="min-w-0">
                    <span className="text-sm">{hit.university.nameCn}</span>
                    <span
                      className={`ml-2 text-xs ${i === active ? 'text-paper/70' : 'text-ink/50'}`}
                    >
                      {hit.university.nameEn}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${i === active ? 'text-paper/70' : 'text-ink/50'}`}
                  >
                    {countryLabel(hit.university.country)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export default SearchBox
