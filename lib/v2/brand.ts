// 校色。
//
// v2 对 docs/design-system.md「没有第三个颜色」的偏离**只到装饰层为止**：
// 校色允许出现在卡片色带、monogram 方块、雷达图填充和右划反馈，
// 不允许出现在正文、边框、数字和任何承载信息的元素上（见 docs/design-system-v2.md）。
//
// 所以这个模块只需要解决一件事：**校色深浅不一，配黑字还是白字。**
// 普林斯顿橙 #E77500 和耶鲁蓝 #00356B 上面写白字，一个看不见、一个正好。

/** 校色缺失时的兜底：整块退回纯黑白，卡片照样成立。 */
export const FALLBACK_BRAND = '#000000'

function channelToLinear(c8: number): number {
  const c = c8 / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG 相对亮度。0 = 纯黑，1 = 纯白。 */
export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const r = channelToLinear((n >> 16) & 0xff)
  const g = channelToLinear((n >> 8) & 0xff)
  const b = channelToLinear(n & 0xff)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * 这个底色上该用黑字还是白字。
 *
 * 0.179 是 WCAG 下「黑字与白字对比度相等」的那个亮度点，比拍一个 0.5 准。
 */
export function readableInkOn(hex: string | null): '#000000' | '#ffffff' {
  if (!hex) return '#ffffff' // 兜底底色是纯黑
  return relativeLuminance(hex) > 0.179 ? '#000000' : '#ffffff'
}

/** 半透明校色，用于雷达图填充。alpha 只在 0–1。 */
export function withAlpha(hex: string | null, alpha: number): string {
  const base = hex ?? FALLBACK_BRAND
  const m = /^#?([0-9a-f]{6})$/i.exec(base.trim())
  if (!m) return `rgb(0 0 0 / ${alpha})`
  const n = parseInt(m[1], 16)
  return `rgb(${(n >> 16) & 0xff} ${(n >> 8) & 0xff} ${n & 0xff} / ${alpha})`
}

/** 这张卡实际用的色（含兜底），组件不必各自判 null。 */
export function brandOf(hex: string | null): string {
  return hex ?? FALLBACK_BRAND
}
