// 大学搜索（右上角搜索框）。
//
// 32 所大学在内存里，不需要 fuse.js —— 引一个模糊搜索库来搜 32 条记录，
// 加载它的时间比搜索本身长几个数量级。
//
// 匹配中文名、英文名、缩写、城市、国家。排序按「命中在哪」分档：
// 名字开头命中排最前，因为输入 "co" 的人要的是 Columbia 而不是某个城市叫 Co… 的学校。

import { profileById, countryLabel } from '@/lib/v2/profile'
import { dataset } from '@/lib/data'
import type { University } from '@/types'

export interface SearchHit {
  university: University
  /** 越小越靠前 */
  rank: number
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '')
}

/**
 * 一条记录对一个查询的匹配档位，没命中返回 null。
 *
 * 0 中文名开头 / 1 英文名开头 / 2 缩写完全相同 / 3 名字中间 / 4 城市或国家
 */
function rankOf(u: University, q: string): number | null {
  const monogram = profileById.get(u.id)?.monogram ?? ''
  const cn = u.nameCn
  const en = normalize(u.nameEn)
  const id = normalize(u.id)
  const mono = normalize(monogram)

  if (cn.startsWith(q)) return 0
  if (en.startsWith(q) || id.startsWith(q)) return 1
  if (mono !== '' && mono === q) return 2
  if (cn.includes(q) || en.includes(q) || id.includes(q)) return 3
  if (normalize(u.city).includes(q) || normalize(countryLabel(u.country)).includes(q)) return 4
  return null
}

/** 空查询返回空数组 —— 搜索框不该在没输入时把 32 所学校全铺出来。 */
export function searchUniversities(query: string, limit = 8): SearchHit[] {
  const q = normalize(query)
  if (q === '') return []

  const hits: SearchHit[] = []
  for (const u of dataset.universities) {
    // 没有画像的学校点进去是空页，不如不给它出现在搜索结果里
    if (!profileById.has(u.id)) continue
    const rank = rankOf(u, q)
    if (rank != null) hits.push({ university: u, rank })
  }

  hits.sort((a, b) => a.rank - b.rank || a.university.nameCn.localeCompare(b.university.nameCn, 'zh'))
  return hits.slice(0, limit)
}
