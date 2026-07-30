// 解读文案生成（PRD US-1.5、§9）。
//
// **文案是这个产品的功能，不是包装。** 模板拼接，不走 LLM —— 每句话里的每个数字
// 都来自传进来的参数，没有一个字是模型编的。
//
// 写这里的每一句话之前，先看一眼 PRD §9 的禁用词清单和「不做评价性表述」那两条
// （本文件不复述那些词，否则上线前的禁用词扫描会扫到自己）。
// 一律中性陈述事实，不对学校做褒贬、不做任何预测性表述。
//
// 滑杆两端的固定标签由 US-1.4 规定，此处不动；但解读文案里一律说「人均密度」，
// 比说得像在预测结果更准确，也离禁用词更远。

import { cityById, dataset, universityById } from '@/lib/data'
import { DEFAULT_FILTERS, type Filters } from '@/lib/filters'
import { TRACK_LABEL, SCHOOL_TYPE_LABEL } from '@/types'

// ---------------------------------------------------------------------------
// 工具

/** 加权人数是小数，展示到一位就够；整数不拖 .0 */
function fmt(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** a 相对 b 的百分比。b 为 0 时返回 null —— 除不了就不说，不糊弄 */
function ratioPct(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null
  return Math.round((a / b) * 100)
}

function cityName(id: string | null): string | null {
  return id ? (cityById.get(id)?.name ?? null) : null
}

function uniName(id: string | null): string | null {
  return id ? (universityById.get(id)?.nameCn ?? null) : null
}

// ---------------------------------------------------------------------------
// US-1.5 滑杆解读

/**
 * 滑杆拖动后的一句话解读（metrics.md §6.1）。
 *
 * 榜首变了就说清楚新旧第一名在**录取人数**和**毕业生规模**上差在哪 ——
 * 这两个数正是「大校偏差」的全部内容，用户看懂这一句就看懂了整个产品。
 * 榜首没变则给对应文案。没有可比对象时返回 null，由 UI 决定不渲染。
 */
export function sliderExplain(args: {
  prevTop: { name: string; volume: number; graduates: number | null } | null
  nextTop: { name: string; volume: number; graduates: number | null } | null
  alpha: number
}): string | null {
  const { prevTop, nextTop, alpha } = args
  // 首次渲染没有对照，不硬凑一句
  if (!nextTop || !prevTop) return null

  const side = alpha > 0.5 ? '规模' : alpha < 0.5 ? '人均密度' : '规模与人均密度各占一半'
  const lead =
    alpha === 0.5 ? '你正在按规模与人均密度各占一半排序。' : `你正在偏向${side}排序。`

  if (prevTop.name === nextTop.name) {
    return `无论按规模还是按人均密度排序，「${nextTop.name}」都排在第 1 —— 两个维度同时靠前的学校并不多见。`
  }

  const volPct = ratioPct(nextTop.volume, prevTop.volume)
  const gradPct =
    nextTop.graduates != null && prevTop.graduates != null
      ? ratioPct(nextTop.graduates, prevTop.graduates)
      : null

  const parts: string[] = [`${lead}第 1 名从「${prevTop.name}」换成了「${nextTop.name}」——`]

  parts.push(
    volPct == null
      ? `「${nextTop.name}」近三年加权录取 ${fmt(nextTop.volume)} 人`
      : `后者近三年加权录取 ${fmt(nextTop.volume)} 人，是前者（${fmt(prevTop.volume)} 人）的 ${volPct}%`,
  )

  if (gradPct != null) {
    parts.push(
      `，但该赛道毕业生规模 ${fmt(nextTop.graduates as number)} 人，只有前者（${fmt(prevTop.graduates as number)} 人）的 ${gradPct}%。`,
    )
  } else if (nextTop.graduates == null || prevTop.graduates == null) {
    parts.push('；两校中有一方的毕业生规模暂未收录，人均密度按分母缺失处理。')
  } else {
    parts.push('。')
  }

  return parts.join('')
}

// ---------------------------------------------------------------------------
// US-1.5 择校杠杆率解读

/**
 * 择校杠杆率的一句话解读（metrics.md §7）。
 *
 * level 为 'low' 时**必须建议用户把精力放在别处**（PRD 原则 §5.6）——
 * 一个只会说「快来择校」的产品是营销物料，会说「这件事对你不重要」的才是决策工具。
 * level 为 null 时说「样本不足」，不给结论。
 */
export function leverageCopy(
  level: 'high' | 'mid' | 'low' | null,
  universityName: string,
): string {
  const u = universityName || '这所大学'
  switch (level) {
    case 'high':
      return `${u}的中国大陆录取高度集中在少数几所高中。在这个目标上，进入哪所高中带来的影响，可能大于标化成绩上的边际提升。`
    case 'mid':
      return `${u}的中国大陆录取有明显的头部学校，也有很长的长尾。择校会有帮助，但不是决定性的一环。`
    case 'low':
      return `${u}的中国大陆录取分散在上百所高中，看不出对特定高中的偏好。与其在择校上反复折腾，把时间和预算花在别处（学术、标化、活动）更值得。`
    default:
      return `${u}目前收录的生源校数量或加权录取总量还不够，样本不足以计算择校杠杆率，这里不给结论。`
  }
}

// ---------------------------------------------------------------------------
// US-1.3 空结果

/**
 * 空结果文案（PRD §9：必须给具体建议 + 一键执行入口，不得只显示「暂无数据」）。
 *
 * 返回的 nextFilters 就是那个「一键执行」的目标状态，UI 直接写进 URL 即可。
 * 放宽顺序：先退最可能是误伤的条件（隐藏开关 → 学校性质 → 赛道 → 城市），
 * 全都退完还是空，才承认是收录范围的问题。
 */
export function emptyResultCopy(f: Filters): {
  text: string
  action: string | null
  nextFilters: Filters | null
} {
  const uName = uniName(f.universityId)
  const city = cityName(f.cityId)
  const trackText = f.tracks.map((t) => TRACK_LABEL[t]).join(' / ')
  const typeText = f.schoolTypes.map((t) => SCHOOL_TYPE_LABEL[t]).join(' / ')
  const target = uName ?? '当前目标大学'

  if (!f.universityId) {
    return {
      text: '还没有选定目标大学。这个工具是反着用的 —— 先选一所目标大学，再看国内哪些高中在往那里送人。',
      action: '回到默认视图',
      nextFilters: { ...DEFAULT_FILTERS, gate: { ...f.gate } },
    }
  }

  if (f.hideIneligible) {
    return {
      text: `当前筛选下没有可显示的学校。「隐藏不可申请的学校」是打开的 —— 符合筛选条件的学校可能都被闸门排除了，先看看它们是哪些、卡在哪一条。`,
      action: '显示不可申请的学校',
      nextFilters: { ...f, hideIneligible: false },
    }
  }

  if (f.schoolTypes.length > 0) {
    return {
      text: `${city ? city + ' · ' : ''}${trackText ? trackText + ' · ' : ''}${typeText}，暂时没有收录到向${target}输送学生的高中。学校性质这一条限制最紧，先把它放开。`,
      action: '不限学校性质',
      nextFilters: { ...f, schoolTypes: [] },
    }
  }

  if (f.tracks.length > 0) {
    return {
      text: `${city ?? '当前城市'} + ${trackText} 冲${target}的样本不足。不同赛道的出口差别很大，换个赛道或先不限赛道，通常能看到更多学校。`,
      action: '不限赛道',
      nextFilters: { ...f, tracks: [] },
    }
  }

  if (f.cityId) {
    return {
      text: `${city} 暂时没有收录到向${target}输送学生的高中。放宽到全国范围看看 —— 也可能只是这座城市的数据还没录进来。`,
      action: '不限城市',
      nextFilters: { ...f, cityId: null },
    }
  }

  return {
    text: `${target}目前还没有收录到中国大陆的生源校数据。当前收录范围是 ${dataset.universities.length} 所大学 × ${dataset.schools.length} 所高中，仍在持续补充中。如果你知道相关的公开数据，欢迎通过页脚的纠错入口告诉我们。`,
    action: null,
    nextFilters: null,
  }
}
