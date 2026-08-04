'use client'

// 右划收藏。
//
// 这个产品没有后端也没有账号（docs/design.md §1.2），所以收藏只能存在浏览器里。
//
// **用 useSyncExternalStore 而不是 useEffect + setState。** localStorage 就是
// React 之外的一个 store，这个 hook 就是为它设计的：SSR 时走 getServerSnapshot
// 拿到空列表，hydrate 之后自动切到真实值，不需要在 effect 里同步 setState
// （那会触发级联渲染，eslint 的 react-hooks/set-state-in-effect 拦得对）。
//
// 一个坑：getSnapshot **必须返回稳定引用**。每次调用都 JSON.parse 出一个新数组
// 会让 React 认为状态一直在变，直接无限重渲染。所以下面缓存快照，只在写入时失效。

import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'ivy-map:shortlist:v1'

/** 服务端快照必须是同一个常量引用 */
const EMPTY: readonly string[] = Object.freeze([])

let cache: string[] | null = null
const listeners = new Set<() => void>()

function parse(rawValue: string | null): string[] {
  if (!rawValue) return []
  try {
    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    // 存坏了就当空的。收藏列表不值得为它白屏。
    return []
  }
}

function notify() {
  for (const fn of listeners) fn()
}

// 别的标签页改了也要跟上。挂在模块级，只挂一次 —— subscribe 会被每个组件各调一遍。
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    cache = null
    notify()
  })
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function getSnapshot(): readonly string[] {
  if (typeof window === 'undefined') return EMPTY
  if (cache == null) cache = parse(window.localStorage.getItem(KEY))
  return cache
}

function getServerSnapshot(): readonly string[] {
  return EMPTY
}

export function readShortlist(): readonly string[] {
  return getSnapshot()
}

function write(ids: string[]): string[] {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(ids))
    } catch {
      // 隐私模式下 localStorage 会抛 —— 收藏丢了，但页面不能挂
    }
  }
  cache = ids // 直接存新引用，省一次 parse，也保证快照稳定
  notify()
  return ids
}

/** 加入收藏。已在其中则原样返回，不重复也不报错。 */
export function addToShortlist(id: string): readonly string[] {
  const current = readShortlist()
  if (current.includes(id)) return current
  return write([...current, id])
}

export function removeFromShortlist(id: string): readonly string[] {
  return write(readShortlist().filter((x) => x !== id))
}

export function toggleShortlist(id: string): readonly string[] {
  return readShortlist().includes(id) ? removeFromShortlist(id) : addToShortlist(id)
}

const noopSubscribe = () => () => {}

/**
 * 是否已经 hydrate。
 *
 * 用来区分「还没读 localStorage」和「读出来是空的」—— 否则收藏页会在
 * 加载的那一帧闪一下「还没有收藏」，已经收了十所的人会以为名单丢了。
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

export function useShortlist() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const ready = useHydrated()

  const toggle = useCallback((id: string) => toggleShortlist(id), [])
  const remove = useCallback((id: string) => removeFromShortlist(id), [])
  const add = useCallback((id: string) => addToShortlist(id), [])

  return { ids, ready, toggle, remove, add }
}
