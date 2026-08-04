// v2 大学画像（snapshot 卡片的数据）。
//
// **独立于 types/index.ts 的 Dataset。** v2 的策展数据出问题不该阻塞现有站点构建，
// 两套数据也需要能各自演进。所以 profile 是单独的构建产物，不挂在 University 上。
//
// 继承 types/index.ts 的铁律：**null 表示「没有数据」，永远不用 0 顶替。**
// 在雷达图上这条尤其要命 —— value: 0 会画成「这所学校安全性得 0 分」，
// 而真相是「我们还没查到这所学校的安全数据」。两者天壤之别。

/**
 * JSON 里手工维护的三个维度。
 *
 * selectivity 不在此列 —— 它能从 officialAdmissions 的申请/录取数直接算出来，
 * 抄一份到策展文件里就是第二个事实源，官方数据一更新两边就会不一致。
 */
export const CURATED_DIMS = ['affinity', 'safety', 'facilities'] as const
export type CuratedDim = (typeof CURATED_DIMS)[number]

/** 雷达图上的四个维度，顺序即顺时针顺序。 */
export const PROFILE_DIMS = ['selectivity', ...CURATED_DIMS] as const
export type ProfileDim = (typeof PROFILE_DIMS)[number]

export const PROFILE_DIM_LABEL: Record<ProfileDim, string> = {
  selectivity: '录取难度',
  affinity: '中国友好度',
  safety: '安全性',
  facilities: '设施',
}

/**
 * 每根轴的方向，必须显示在图上。
 *
 * 「录取难度」越外越难 —— 这**不是优点**。哈佛 3.6% 录取率在雷达图上顶到最外圈，
 * 看着像满分，实际是「你大概进不去」。不写方向，「面积越大越好」就是个错误暗示。
 */
export const PROFILE_DIM_DIRECTION: Record<ProfileDim, string> = {
  selectivity: '越外越难录',
  affinity: '越外越友好',
  safety: '越外越安全',
  facilities: '越外越完善',
}

/** 一个维度的分。 */
export interface ProfileScore {
  /** 0–100。null = 数据不足，雷达图该轴断开 */
  value: number | null
  /** 口径一句话。有值时说清怎么算的，null 时说清缺什么 */
  basis: string
  /**
   * measured = 由可溯源数据算出，顶点画实心，可点开看来源；
   * editorial = 编辑判断，顶点画空心并标注。
   *
   * 这个区分是雷达图能不能上线的前提：打分天生主观，而这个产品的立场是
   * 「只摆数据不煽动」。形状区分让人一眼看出哪几根轴是实的。
   */
  kind: 'measured' | 'editorial'
  /** measured 必须非空 —— 构建期硬门禁 */
  sourceIds: string[]
}

export interface UniversityProfile {
  universityId: string
  /** 官网首页。卡片左下角跳转用 */
  websiteUrl: string | null
  /** public/logos/<id>.svg。null = 用校色方块 + monogram 兜底 */
  logoPath: string | null
  /** 官方品牌校色 hex。null = 这张卡退回纯黑白，照样成立 */
  brandColor: string | null
  /** logo 缺失时显示的缩写，1–4 字符 */
  monogram: string
  foundedYear: number | null
  /** 公众普遍认知的知名领域。**不是排名结论**，UI 必须这么标 */
  strengths: string[]
  /** 风格一句话（百年老校还是新贵）。编辑撰写，UI 必须标注 */
  vibe: string | null
  scores: Record<CuratedDim, ProfileScore>
  /** profile 全部字段已人工复核。跟 School.verified 同一套纪律 */
  reviewed: boolean
}

/** 录取率趋势的一个点。从 officialAdmissions 现算，不单独存。 */
export interface AdmitRatePoint {
  academicYearStart: number
  applied: number
  admitted: number
  /** 0–1 */
  rate: number
  sourceId: string
}

/** 构建产物 data/university-profiles.json */
export interface ProfileDataset {
  builtAt: string
  profiles: UniversityProfile[]
}
