// 分享长图的排版与绘制（PRD US-8.3）。
//
// **为什么是手写 canvas，而不是 html-to-image 截 DOM**
//
//   1. 目标场景是微信内置浏览器（Android 的 X5 内核、iOS 的 WKWebView）。html-to-image
//      走的是 SVG foreignObject，这两个内核上大量出现「整图空白」和「只渲染上半张」，
//      而且都要在别人的手机上才复现。这是 P0 且在「绝不砍」清单里的功能，不能赌。
//   2. canvas 的产物跟页面 CSS、深浅色主题、视口宽度完全无关 —— 同一份 filters 在任何
//      设备上画出来都是同一张图。截真实页面 DOM 做不到这一点（响应式布局会让结果不可控）。
//   3. 不引入新依赖。
//
// **唯一保留下来的坑是字体。** canvas 的 measureText / fillText 在字体没加载完时会
// 静默降级到后备字体：宽度算错、中文出方框。开发机上字体早就缓存了，永远不复现；
// 线上产品全是别人的设备。所以 renderPosterPng() 必须先 await document.fonts.ready
// 才动手画 —— 见 ensureFontsReady()。

import { emptyResultCopy } from '@/lib/copy'
import { cityById, dataset, sourceById, universityById } from '@/lib/data'
import { isGateActive, type Filters } from '@/lib/filters'
import type { FeederRowView } from '@/lib/view'
import { SCHOOL_TYPE_LABEL, TRACK_LABEL, type Source } from '@/types'

// ---------------------------------------------------------------------------
// 常量

/** 逻辑宽度。微信里图片按宽度铺满，750 是最通用的竖图宽度。 */
export const POSTER_WIDTH = 750
/** 期望的像素密度。实际会被 MAX_EDGE 压低，见 renderPosterPng()。 */
export const POSTER_SCALE = 2
/**
 * canvas 的尺寸护栏。超限的表现不是报错，是**静默给一张全白的图** ——
 * 出在别人手机上、我们看不见，所以宁可降采样也不能撞线。
 * iOS WebView 卡的是总面积（约 1600 万像素），各端还都有单边上限。
 */
const MAX_EDGE = 8192
const MAX_AREA = 16_000_000

const PAD = 44
/** 内容宽度 */
const CW = POSTER_WIDTH - PAD * 2
/** 榜单取前几名（PRD US-8.3：Top 5） */
const TOP_N = 5

/**
 * 中文字体栈。canvas 的 font 属性接受完整的 CSS font 简写，字体列表同样生效。
 * 这里不用任何 Web Font —— 系统字体在所有目标设备上都存在，也就没有下载失败的可能。
 */
const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Source Han Sans SC", "WenQuanYi Micro Hei", sans-serif'

/** 海报是一张图片，不跟随系统深浅色 —— 固定浅色，在聊天窗口里最稳。 */
const C = {
  bg: '#ffffff',
  ink: '#16181d',
  sub: '#4b5563',
  muted: '#8b94a3',
  line: '#e6e8ec',
  panel: '#f6f7f9',
  accent: '#1f3b63',
  accentSoft: '#e9eff6',
  warn: '#8a5200',
  warnSoft: '#fbf1e0',
  danger: '#8c2f2f',
  dangerSoft: '#f9ecea',
} as const

/** PRD §12 免责声明全文。一个字都不要改。 */
export const DISCLAIMER =
  '本站数据来自学校官方公开发布、公开媒体报道及公开行业报告，由 IVY Map 整理，可能存在滞后或误差，不构成任何录取承诺或升学建议。数据如有出入，欢迎通过反馈入口提交更正。'

const COUNTRY_LABEL: Record<string, string> = {
  US: '美国',
  UK: '英国',
  HK: '中国香港',
  CA: '加拿大',
  JP: '日本',
}

const SOURCE_TYPE_LABEL: Record<Source['type'], string> = {
  official: '学校官方发布',
  media: '公开媒体报道',
  report: '公开行业报告',
  crowdsourced: '用户提供',
}

const CONFIDENCE_LABEL: Record<'L1' | 'L2' | 'L3', string> = {
  L1: 'L1 官方一手',
  L2: 'L2 权威二手',
  L3: 'L3 推断/众包',
}

const NATIONALITY_LABEL: Record<string, string> = {
  cn: '中国大陆护照',
  foreign: '外籍护照',
  hk_mo_tw: '港澳台身份',
  pr: '境外永久居留',
}

// ---------------------------------------------------------------------------
// 视图模型

export interface PosterRow {
  rank: number
  name: string
  /** 城市 · 赛道 · 学校性质 */
  meta: string
  /** 加权录取人数，已格式化。这个值不会缺失 —— 缺了这行根本不会出现在榜单里 */
  volumeText: string
  /** 人均密度，缺分母时是「—」，绝不写 0 */
  densityText: string
  densityMissing: boolean
  tags: Tag[]
  /** 资格状态说明，闸门没填时为 null */
  eligibilityNote: string | null
  eligibilityTone: 'warn' | 'danger' | null
}

export interface Tag {
  text: string
  tone: 'neutral' | 'warn' | 'danger'
}

export interface PosterModel {
  generatedAt: string
  builtAt: string
  siteHost: string | null
  university: { nameCn: string; nameEn: string; location: string } | null
  filterChips: string[]
  gateLine: string | null
  rows: PosterRow[]
  /** 榜单右上角的「共 N 所」 */
  totalNote: string | null
  /** rows 为空时的具体原因（PRD §9：不得只显示「暂无数据」） */
  emptyText: string | null
  /** 常驻的一句当前口径说明（US-7.3） */
  basisNote: string
  calibrationLines: string[]
  sourceLines: string[]
  sourceSamples: string[]
  disclaimer: string
}

function fmtNumber(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 从「大学 + 榜单 + 筛选条件」拼出海报要画的全部内容。
 * 纯数据，不碰 canvas —— 这样它在测试里也能直接断言。
 */
export function buildPosterModel(args: {
  universityId: string
  rows: FeederRowView[]
  filters: Filters
}): PosterModel {
  const { rows, filters } = args
  const universityId = args.universityId || filters.universityId || ''
  const uni = universityId ? (universityById.get(universityId) ?? null) : null

  // 图上要和用户屏幕上看到的一致：他开了「隐藏不可申请」，图里也不该冒出来
  const visible = filters.hideIneligible
    ? rows.filter((r) => r.eligibility.status !== 'ineligible')
    : rows
  const top = visible.slice(0, TOP_N)

  const gateActive = isGateActive(filters.gate)
  const alphaPct = Math.round(Math.min(1, Math.max(0, filters.alpha)) * 100)

  // --- 筛选条件 ---
  const chips: string[] = []
  chips.push(filters.cityId ? (cityById.get(filters.cityId)?.name ?? '指定城市') : '全国')
  chips.push(
    filters.tracks.length
      ? filters.tracks.map((t) => TRACK_LABEL[t]).join(' / ')
      : '不限赛道',
  )
  if (filters.schoolTypes.length) {
    chips.push(filters.schoolTypes.map((t) => SCHOOL_TYPE_LABEL[t]).join(' / '))
  }
  chips.push(`规模 ${alphaPct}% / 人均密度 ${100 - alphaPct}%`)
  if (filters.hideIneligible) chips.push('已隐藏不可申请的学校')

  // --- 可行性闸门。存的是条件本身，不含任何可识别孩子身份的信息 ---
  const g = filters.gate
  const gateParts: string[] = []
  if (g.nationality) gateParts.push(NATIONALITY_LABEL[g.nationality] ?? g.nationality)
  if (g.cityId) gateParts.push(`${cityById.get(g.cityId)?.name ?? '指定城市'}学籍`)
  if (g.localHukou !== null) gateParts.push(g.localHukou ? '本市户籍' : '非本市户籍')
  if (g.grade != null) gateParts.push(`当前 ${g.grade} 年级`)
  if (g.targetYear != null) gateParts.push(`${g.targetYear} 年入学`)
  const gateLine = gateParts.length ? `已按孩子情况判定资格：${gateParts.join(' · ')}` : null

  // --- 榜单行 ---
  const posterRows: PosterRow[] = top.map((r) => {
    const trackLabels = (
      filters.tracks.length
        ? r.school.tracks.filter((t) => filters.tracks.includes(t))
        : r.school.tracks
    ).map((t) => TRACK_LABEL[t])

    const tags: Tag[] = [{ text: r.confidence, tone: 'neutral' }]
    if (r.basis === 'estimated') tags.push({ text: '估算', tone: 'warn' })
    else if (r.basis === 'offers') tags.push({ text: 'offer 口径', tone: 'warn' })

    let eligibilityNote: string | null = null
    let eligibilityTone: PosterRow['eligibilityTone'] = null
    if (gateActive && r.eligibility.status === 'ineligible') {
      eligibilityNote = `不可申请：${r.eligibility.reasons[0] ?? '不符合该校招生条件'}`
      eligibilityTone = 'danger'
    } else if (gateActive && r.eligibility.status === 'unknown') {
      eligibilityNote = `需确认：${r.eligibility.reasons[0] ?? '门槛信息待补充'}`
      eligibilityTone = 'warn'
    }

    return {
      rank: r.rank,
      name: r.school.nameCn,
      meta: [r.cityName, trackLabels.join(' / '), SCHOOL_TYPE_LABEL[r.school.type]]
        .filter(Boolean)
        .join(' · '),
      volumeText: fmtNumber(r.volume),
      // 分母缺失就是「—」。metrics.md §5：绝不用 0 代替 null
      densityText: r.density == null ? '—' : `${(r.density * 100).toFixed(1)}%`,
      densityMissing: r.density == null,
      tags,
      eligibilityNote,
      eligibilityTone,
    }
  })

  // --- 当前口径（US-7.3：榜单顶部常驻一句） ---
  const worstBasis = top.some((r) => r.basis === 'estimated')
    ? 'estimated'
    : top.some((r) => r.basis === 'offers')
      ? 'offers'
      : 'admits'
  const basisNote =
    worstBasis === 'admits'
      ? '当前口径：录取人数（去重人头），近三年加权。'
      : worstBasis === 'offers'
        ? '当前口径：本图含 offer 口径数据（一人可拿多枚 offer），已在对应行标注。'
        : '当前口径：以录取人数（去重人头）为准；标「估算」的行由 offer 数折算而来。'

  const calibrationLines = [
    '排序按近三年加权录取人数：最近一届权重 0.5、前一届 0.3、再前一届 0.2。',
    '人均密度 = 加权录取人数 ÷ 该赛道加权毕业生数。分母缺失时显示「—」，不以 0 代替，也不估算分母。',
    `本图的排序权重：规模 ${alphaPct}% / 人均密度 ${100 - alphaPct}%（对应网站上的滑杆位置）。`,
  ]
  if (worstBasis !== 'admits') {
    calibrationLines.push(
      '标「估算」的数值由 offer 数按该校人均 offer 系数折算而来，置信等级已下调一级。',
    )
  }
  if (posterRows.some((r) => r.densityMissing)) {
    calibrationLines.push('标「分母缺失」的学校暂未收录该赛道毕业生数，人均密度算不出来，不是 0。')
  }
  if (gateActive) {
    calibrationLines.push(
      '资格判定基于已收录的招生门槛；门槛信息缺失时标为「需确认」，不默认判为可申请。',
    )
  }

  // --- 数据来源概述（US-7.1：图上至少要说清数据从哪来） ---
  const sourceIds = new Set<string>()
  for (const r of top) r.sourceIds.forEach((id) => sourceIds.add(id))
  const sources = [...sourceIds]
    .map((id) => sourceById.get(id))
    .filter((s): s is Source => s != null)

  const sourceLines: string[] = []
  const sourceSamples: string[] = []
  if (posterRows.length === 0) {
    sourceLines.push('当前筛选下没有可展示的榜单，本图不涉及任何录取数据的引用。')
  } else if (sources.length === 0) {
    sourceLines.push('本图涉及的行暂未关联到来源记录，请以网站上的溯源信息为准。')
  } else {
    const byType = new Map<Source['type'], number>()
    for (const s of sources) byType.set(s.type, (byType.get(s.type) ?? 0) + 1)
    const typeText = [...byType.entries()]
      .map(([t, n]) => `${SOURCE_TYPE_LABEL[t]} ${n} 条`)
      .join(' · ')

    const captured = sources.map((s) => s.capturedAt).filter(Boolean).sort()
    const range =
      captured.length === 0
        ? null
        : captured[0] === captured[captured.length - 1]
          ? captured[0]
          : `${captured[0]} 至 ${captured[captured.length - 1]}`

    sourceLines.push(`本图 Top ${top.length} 共引用 ${sources.length} 条公开来源：${typeText}。`)
    if (range) sourceLines.push(`采集日期：${range}。`)

    const order = { L1: 0, L2: 1, L3: 2 } as const
    for (const s of [...sources].sort((a, b) => order[a.confidence] - order[b.confidence]).slice(0, 3)) {
      sourceSamples.push(`[${CONFIDENCE_LABEL[s.confidence]}] ${s.title}`)
    }
    if (sources.length > sourceSamples.length) {
      sourceSamples.push(`……另有 ${sources.length - sourceSamples.length} 条，完整来源与链接见网站。`)
    }
  }

  return {
    generatedAt: fmtDate(new Date()),
    builtAt: dataset.builtAt.slice(0, 10),
    siteHost: typeof window === 'undefined' ? null : window.location.host,
    university: uni
      ? {
          nameCn: uni.nameCn,
          nameEn: uni.nameEn,
          location: [COUNTRY_LABEL[uni.country] ?? uni.country, uni.city]
            .filter(Boolean)
            .join(' · '),
        }
      : null,
    filterChips: chips,
    gateLine,
    rows: posterRows,
    totalNote: visible.length > posterRows.length ? `共 ${visible.length} 所` : null,
    emptyText:
      posterRows.length === 0
        ? emptyResultCopy({ ...filters, universityId: universityId || filters.universityId }).text
        : null,
    basisNote,
    calibrationLines,
    sourceLines,
    sourceSamples,
    disclaimer: DISCLAIMER,
  }
}

// ---------------------------------------------------------------------------
// 绘制原语
//
// 长图的高度取决于内容（学校名会换行、原因说明长短不一），所以要先量后画。
// P.dry = true 时所有落笔操作跳过、只推进坐标，量出来的总高度就是画布高度。
// measureText 在任何尺寸的 canvas 上都能用，所以量的那一遍用 1×1 的画布就够。

interface P {
  ctx: CanvasRenderingContext2D
  dry: boolean
}

interface TextOpts {
  size: number
  weight?: number
  color?: string
  align?: 'left' | 'center' | 'right'
}

interface ParaOpts extends TextOpts {
  lineHeight?: number
  maxLines?: number
}

interface Seg {
  t: string
  size: number
  weight?: number
  color?: string
}

function setFont(p: P, weight: number, size: number) {
  p.ctx.font = `${weight} ${size}px ${FONT_STACK}`
}

function measure(p: P, s: string, size: number, weight = 400): number {
  setFont(p, weight, size)
  return p.ctx.measureText(s).width
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

function rect(
  p: P,
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: string,
  radius = 0,
  stroke?: string,
) {
  if (p.dry) return
  const { ctx } = p
  roundedPath(ctx, x, y, w, h, radius)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function text(p: P, s: string, x: number, y: number, o: TextOpts) {
  setFont(p, o.weight ?? 400, o.size)
  if (p.dry) return
  const { ctx } = p
  ctx.fillStyle = o.color ?? C.ink
  ctx.textAlign = o.align ?? 'left'
  ctx.fillText(s, x, y)
  ctx.textAlign = 'left'
}

/** CJK 逐字断行，拉丁词整词不拆。 */
function tokenize(s: string): string[] {
  const out: string[] = []
  let buf = ''
  for (const ch of s) {
    // CJK 汉字 + 中日韩标点 + 全角符号，这些逐字断行
    const cjk = /[⺀-鿿　-〿＀-￯]/.test(ch)
    if (cjk || ch === ' ') {
      if (buf) {
        out.push(buf)
        buf = ''
      }
      out.push(ch)
    } else {
      buf += ch
    }
  }
  if (buf) out.push(buf)
  return out
}

/** 行首禁则：这些标点不能落在一行的开头，宁可让上一行超出一点点 */
const NO_LINE_START = '、。，．,.!?！？：；:;）)」』】》〉…～%'
/** 行尾禁则：这些标点不能留在一行的结尾，要跟着下一个字走 */
const NO_LINE_END = '（(「『【《〈'

function wrapLines(p: P, s: string, maxW: number, size: number, weight: number): string[] {
  setFont(p, weight, size)
  const { ctx } = p
  const lines: string[] = []
  for (const rawLine of s.split('\n')) {
    let line = ''
    for (const tk of tokenize(rawLine)) {
      if (line === '' && tk === ' ') continue
      const next = line + tk
      if (line !== '' && ctx.measureText(next).width > maxW) {
        // 中文排版的行首/行尾禁则。不做的话会出现「」，不默认…」这种断法，
        // 一眼就看得出是机器排的
        if (NO_LINE_START.includes(tk)) {
          line = next
          continue
        }
        const lastCh = [...line].pop() ?? ''
        if (NO_LINE_END.includes(lastCh) && line.length > lastCh.length) {
          lines.push(line.slice(0, line.length - lastCh.length))
          line = lastCh + tk
        } else {
          lines.push(line)
          line = tk === ' ' ? '' : tk
        }
      } else {
        line = next
      }
    }
    lines.push(line)
  }
  return lines
}

function ellipsize(p: P, s: string, maxW: number, size: number, weight = 400): string {
  setFont(p, weight, size)
  const { ctx } = p
  if (ctx.measureText(s).width <= maxW) return s
  let out = s
  while (out.length > 1 && ctx.measureText(out + '…').width > maxW) {
    out = out.slice(0, -1)
  }
  return out + '…'
}

/** 画一段可换行的文字，返回段落底部的 y。 */
function paragraph(p: P, s: string, x: number, y: number, maxW: number, o: ParaOpts): number {
  const size = o.size
  const weight = o.weight ?? 400
  const lh = o.lineHeight ?? Math.round(size * 1.45)
  let lines = wrapLines(p, s, maxW, size, weight)
  if (o.maxLines && lines.length > o.maxLines) {
    const kept = lines.slice(0, o.maxLines)
    const i = kept.length - 1
    // 先给省略号腾出宽度再截，否则加完省略号又超宽
    kept[i] = ellipsize(p, kept[i], maxW - measure(p, '…', size, weight), size, weight)
    if (!kept[i].endsWith('…')) kept[i] += '…'
    lines = kept
  }
  lines.forEach((ln, i) => {
    const lx = o.align === 'right' ? x + maxW : o.align === 'center' ? x + maxW / 2 : x
    text(p, ln, lx, y + i * lh, { size, weight, color: o.color, align: o.align })
  })
  return y + lines.length * lh
}

/** 同一基线上混排不同字号的片段（数值要比标签大一号），返回总宽度。 */
function inline(p: P, segs: Seg[], x: number, baselineY: number): number {
  let cur = x
  if (!p.dry) p.ctx.textBaseline = 'alphabetic'
  for (const s of segs) {
    const w = measure(p, s.t, s.size, s.weight ?? 400)
    if (!p.dry) {
      p.ctx.fillStyle = s.color ?? C.ink
      p.ctx.fillText(s.t, cur, baselineY)
    }
    cur += w
  }
  if (!p.dry) p.ctx.textBaseline = 'top'
  return cur - x
}

const TAG_H = 30
const TAG_PAD = 11
const TAG_SIZE = 19

function tagTone(tone: Tag['tone']): { bg: string; fg: string } {
  if (tone === 'warn') return { bg: C.warnSoft, fg: C.warn }
  if (tone === 'danger') return { bg: C.dangerSoft, fg: C.danger }
  return { bg: C.accentSoft, fg: C.accent }
}

function tagWidth(p: P, t: Tag): number {
  return measure(p, t.text, TAG_SIZE, 600) + TAG_PAD * 2
}

/** 一排标签右对齐到 rightX，返回占用的总宽度。 */
function drawTagsRight(p: P, tags: Tag[], rightX: number, y: number): number {
  const widths = tags.map((t) => tagWidth(p, t))
  const total = widths.reduce((s, w) => s + w, 0) + Math.max(0, tags.length - 1) * 8
  let cur = rightX - total
  tags.forEach((t, i) => {
    const { bg, fg } = tagTone(t.tone)
    rect(p, cur, y, widths[i], TAG_H, bg, 6)
    text(p, t.text, cur + TAG_PAD, y + 6, { size: TAG_SIZE, weight: 600, color: fg })
    cur += widths[i] + 8
  })
  return total
}

const CHIP_H = 40
const CHIP_PAD = 16
const CHIP_SIZE = 21

/** 筛选条件的胶囊，自动换行，返回底部 y。 */
function drawChips(p: P, items: string[], x: number, y: number, maxW: number): number {
  let cx = x
  let cy = y
  for (const it of items) {
    const w = measure(p, it, CHIP_SIZE, 500) + CHIP_PAD * 2
    if (cx > x && cx + w > x + maxW) {
      cx = x
      cy += CHIP_H + 10
    }
    rect(p, cx, cy, w, CHIP_H, C.panel, CHIP_H / 2, C.line)
    text(p, it, cx + CHIP_PAD, cy + 10, { size: CHIP_SIZE, weight: 500, color: C.sub })
    cx += w + 10
  }
  return cy + CHIP_H
}

function sectionHeader(p: P, title: string, y: number, rightNote?: string | null): number {
  rect(p, PAD, y + 4, 6, 24, C.accent, 3)
  text(p, title, PAD + 18, y, { size: 27, weight: 700, color: C.ink })
  if (rightNote) {
    text(p, rightNote, PAD + CW, y + 6, { size: 20, color: C.muted, align: 'right' })
  }
  return y + 27 + 16
}

/**
 * 灰底面板。高度取决于内部内容，所以先用 dry 跑一遍 draw 量高度，再画底、再画内容。
 * draw 必须是纯的（同样的入参画两遍结果一致），否则量出来的高度对不上。
 */
function panel(
  p: P,
  y: number,
  bg: string,
  draw: (p: P, x: number, y: number, w: number) => number,
): number {
  const innerX = PAD + 24
  const innerW = CW - 48
  const innerY = y + 22
  const bottom = draw({ ctx: p.ctx, dry: true }, innerX, innerY, innerW)
  const h = bottom - y + 22
  rect(p, PAD, y, CW, h, bg, 12)
  draw(p, innerX, innerY, innerW)
  return y + h
}

/** 项目符号列表，每条可换行 */
function bulletList(
  p: P,
  lines: string[],
  x: number,
  y: number,
  w: number,
  color: string,
): number {
  let cy = y
  for (const ln of lines) {
    if (!p.dry) {
      p.ctx.fillStyle = C.muted
      p.ctx.beginPath()
      p.ctx.arc(x + 4, cy + 12, 3.5, 0, Math.PI * 2)
      p.ctx.fill()
    }
    cy = paragraph(p, ln, x + 18, cy, w - 18, { size: 21, color, lineHeight: 31 })
    cy += 8
  }
  return cy - 8
}

// ---------------------------------------------------------------------------
// 版面

function drawRow(p: P, r: PosterRow, y: number): number {
  const badge = 46
  const nameX = PAD + badge + 16
  const rightX = PAD + CW
  const bodyW = CW - badge - 16

  // 名次
  rect(p, PAD, y + 2, badge, badge, r.rank === 1 ? C.accent : C.accentSoft, 10)
  text(p, String(r.rank), PAD + badge / 2, y + 13, {
    size: 26,
    weight: 700,
    color: r.rank === 1 ? '#ffffff' : C.accent,
    align: 'center',
  })

  // 标签先占位，学校名的可用宽度要把它减掉
  const tagsW = r.tags.length ? drawTagsRight(p, r.tags, rightX, y + 6) : 0
  const nameW = bodyW - (tagsW ? tagsW + 16 : 0)

  let cy = paragraph(p, r.name, nameX, y, nameW, {
    size: 30,
    weight: 700,
    color: C.ink,
    lineHeight: 40,
    maxLines: 2,
  })

  if (r.meta) {
    cy = paragraph(p, r.meta, nameX, cy + 2, bodyW, {
      size: 20,
      color: C.muted,
      lineHeight: 28,
      maxLines: 1,
    })
  }

  // 两个核心数值。密度缺分母时是「—」，后面补一句「分母缺失」说明它不是 0
  const segs: Seg[] = [
    { t: '近三年加权录取 ', size: 20, color: C.sub },
    { t: r.volumeText, size: 27, weight: 700, color: C.ink },
    { t: ' 人', size: 20, color: C.sub },
    { t: '    人均密度 ', size: 20, color: C.sub },
    { t: r.densityText, size: 27, weight: 700, color: r.densityMissing ? C.muted : C.ink },
  ]
  if (r.densityMissing) segs.push({ t: '（分母缺失）', size: 19, color: C.muted })
  inline(p, segs, nameX, cy + 32)
  cy += 40

  if (r.eligibilityNote) {
    cy = paragraph(p, r.eligibilityNote, nameX, cy + 2, bodyW, {
      size: 20,
      color: r.eligibilityTone === 'danger' ? C.danger : C.warn,
      lineHeight: 28,
      maxLines: 2,
    })
  }

  return Math.max(cy, y + badge + 4)
}

/** 画整张海报，返回内容总高度（逻辑像素）。 */
function paint(p: P, m: PosterModel): number {
  const { ctx } = p
  if (!p.dry) {
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
  }

  let y = 0

  // 顶部色条：图片被转发到聊天里时，一条实色顶栏是最容易识别的边界
  rect(p, 0, 0, POSTER_WIDTH, 12, C.accent)
  y = 12 + 34

  // --- 品牌行 ---
  const brand = 'IVY Map'
  const brandW = measure(p, brand, 34, 800)
  text(p, brand, PAD, y, { size: 34, weight: 800, color: C.accent })
  text(p, '常春藤择校地图', PAD + brandW + 12, y + 12, { size: 21, color: C.muted })
  text(p, `生成于 ${m.generatedAt}`, PAD + CW, y + 12, {
    size: 20,
    color: C.muted,
    align: 'right',
  })
  y += 34 + 26

  // --- 目标大学 ---
  text(p, '目标大学', PAD, y, { size: 20, color: C.muted })
  y += 20 + 10
  if (m.university) {
    y = paragraph(p, m.university.nameCn, PAD, y, CW, {
      size: 46,
      weight: 800,
      color: C.ink,
      lineHeight: 58,
      maxLines: 2,
    })
    const sub = [m.university.nameEn, m.university.location].filter(Boolean).join('  ·  ')
    if (sub) {
      y = paragraph(p, sub, PAD, y + 6, CW, { size: 21, color: C.sub, lineHeight: 30, maxLines: 2 })
    }
  } else {
    y = paragraph(p, '未选定目标大学', PAD, y, CW, {
      size: 40,
      weight: 700,
      color: C.muted,
      lineHeight: 52,
    })
  }
  y += 26
  rect(p, PAD, y, CW, 1, C.line)
  y += 28

  // --- 筛选条件 ---
  y = sectionHeader(p, '筛选条件', y)
  y = drawChips(p, m.filterChips, PAD, y, CW)
  if (m.gateLine) {
    y = paragraph(p, m.gateLine, PAD, y + 14, CW, { size: 20, color: C.sub, lineHeight: 29 })
  }
  y += 30

  // --- 榜单 ---
  y = sectionHeader(p, m.rows.length ? `榜单 Top ${m.rows.length}` : '榜单', y, m.totalNote)

  // US-7.3：口径说明常驻在榜单顶部，图上同样不能省
  y = panel(p, y, C.accentSoft, (pp, x, yy, w) =>
    paragraph(pp, m.basisNote, x, yy, w, { size: 21, weight: 600, color: C.accent, lineHeight: 30 }),
  )
  y += 18

  if (m.rows.length === 0) {
    // 空态给具体原因，不留一张空表（PRD §9）
    y = panel(p, y, C.panel, (pp, x, yy, w) =>
      paragraph(pp, m.emptyText ?? '当前筛选下没有收录到数据。', x, yy, w, {
        size: 22,
        color: C.sub,
        lineHeight: 33,
      }),
    )
    y += 12
  } else {
    m.rows.forEach((r, i) => {
      if (i > 0) {
        rect(p, PAD, y, CW, 1, C.line)
        y += 20
      }
      y = drawRow(p, r, y)
      y += 18
    })
  }
  y += 16

  // --- 当前口径 ---
  y = sectionHeader(p, '口径说明', y)
  y = panel(p, y, C.panel, (pp, x, yy, w) => bulletList(pp, m.calibrationLines, x, yy, w, C.sub))
  y += 30

  // --- 数据来源 ---
  y = sectionHeader(p, '数据来源', y)
  y = panel(p, y, C.panel, (pp, x, yy, w) => {
    let cy = yy
    for (const ln of m.sourceLines) {
      cy = paragraph(pp, ln, x, cy, w, { size: 21, color: C.sub, lineHeight: 31 })
      cy += 4
    }
    for (const s of m.sourceSamples) {
      cy = paragraph(pp, s, x, cy + 6, w, { size: 20, color: C.muted, lineHeight: 29, maxLines: 2 })
    }
    return cy
  })
  y += 30

  // --- 免责声明（PRD §12。脱离产品语境传播时，这是唯一的防误读保护）---
  y = panel(p, y, C.warnSoft, (pp, x, yy, w) => {
    text(pp, '免责声明', x, yy, { size: 21, weight: 700, color: C.warn })
    return paragraph(pp, m.disclaimer, x, yy + 21 + 12, w, {
      size: 20,
      color: C.warn,
      lineHeight: 30,
    })
  })
  y += 30

  // --- 页脚 ---
  rect(p, PAD, y, CW, 1, C.line)
  y += 22
  const foot = [m.siteHost, `数据构建于 ${m.builtAt}`].filter(Boolean).join('　·　')
  y = paragraph(p, foot, PAD, y, CW, { size: 20, weight: 600, color: C.sub, lineHeight: 28 })
  y = paragraph(
    p,
    '网站上每个录取数值都可以点开看到来源名称、原始链接、发布日期与置信等级。',
    PAD,
    y + 6,
    CW,
    { size: 19, color: C.muted, lineHeight: 27 },
  )

  return y + 40
}

// ---------------------------------------------------------------------------
// 出图

/**
 * 等字体真正可用再画。
 *
 * fonts.ready 只等**已经在加载中**的字体，从没被请求过的字体它不会等，所以先用
 * fonts.load() 主动请求一遍海报要用到的字重，把它们变成 pending，再 await ready。
 * 少了这一步，别人手机上第一次打开就会得到方框或降级字体 —— 而开发机上字体早已缓存，
 * 这个 bug 在本地永远不复现。
 */
async function ensureFontsReady(): Promise<void> {
  const fonts: FontFaceSet | undefined = document.fonts
  if (!fonts) return
  const sample = '目标大学剑桥人均密度L1估算0123456789'
  try {
    await Promise.all([
      fonts.load(`400 21px ${FONT_STACK}`, sample),
      fonts.load(`700 30px ${FONT_STACK}`, sample),
      fonts.load(`800 46px ${FONT_STACK}`, sample),
    ])
  } catch {
    // 字体加载失败不该阻断出图 —— 用后备字体出一张图，也比什么都出不来强
  }
  try {
    await fonts.ready
  } catch {
    /* 同上 */
  }
}

export interface PosterImage {
  dataUrl: string
  /** 实际像素尺寸，用于 <img> 的 width/height，避免弹层里跳版 */
  width: number
  height: number
}

/**
 * 把模型画成一张 PNG。
 *
 * 画布是 createElement 出来的，**从不挂进 DOM** —— 所以它既不受页面样式影响，
 * 也不会引起一次重排。这就是「不要截真实页面 DOM」那条的实现方式。
 *
 * 用 data URL 而不是 blob URL：微信里长按保存对 data: 的兼容性最好。
 */
export async function renderPosterPng(model: PosterModel): Promise<PosterImage> {
  await ensureFontsReady()

  const probe = document.createElement('canvas')
  probe.width = 1
  probe.height = 1
  const pctx = probe.getContext('2d')
  if (!pctx) throw new Error('当前浏览器不支持 canvas，无法生成长图')

  const height = Math.ceil(paint({ ctx: pctx, dry: true }, model))

  const scale = Math.max(
    1,
    Math.min(
      POSTER_SCALE,
      MAX_EDGE / POSTER_WIDTH,
      MAX_EDGE / height,
      Math.sqrt(MAX_AREA / (POSTER_WIDTH * height)),
    ),
  )

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(POSTER_WIDTH * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 canvas，无法生成长图')

  ctx.scale(scale, scale)
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, POSTER_WIDTH, height)
  ctx.textBaseline = 'top'
  paint({ ctx, dry: false }, model)

  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
}
