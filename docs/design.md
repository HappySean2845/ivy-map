# 技术设计文档（Design Doc）

> 配套 [`PRD.md`](../PRD.md)。**PRD 说做什么，本文说怎么做。** 需求、验收标准、优先级一律以 PRD 为准，本文不重复也不推翻。

| 项 | 值 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-07-29 |
| 部署 | Vercel |
| 状态 | 待评审 |

---

## 1. 核心架构决策：不做后端

### 1.1 先算数据量

| 实体 | 行数估算 | 依据 |
|---|---|---|
| 录取记录 | ~1,400 | 40 校 × 3 届 × 平均 12 所有录取的大学 |
| 高中（含门槛） | 40 | [`data-sources.md`](data-sources.md) §4.2 |
| 大学 | 30 | §4.1 |
| 届次（密度分母） | ~240 | 40 校 × 3 届 × 平均 2 赛道 |
| 来源 | ~200 | 每份战报/报告一条 |

**合计约 2,000 行。** 序列化后约 200KB，gzip 后 **50–60KB** —— 一次性加载完毕，比一张首屏配图还小。

### 1.2 结论：全站纯读，零后端

在这个体量下，**所有查询都是在 2,000 行内存数据上的过滤和排序**，客户端完成。

而且走后端在这里不只是浪费，是**有害的**：

> US-1.4 的验收标准是「拖动时实时重排，无提交按钮，无加载态」。滑杆每秒触发几十次重排——每次一趟 HTTP，手感就毁了。**而手感就是这个功能的全部价值。**

配合 US-7.4 降级为外部表单链接后，**产品自身没有任何写入路径**。

### 1.3 唯一的例外

| 功能 | 为什么需要服务端 | 处理 |
|---|---|---|
| **US-6.1 AI 解析**（P1） | LLM key 不能进前端 | 一个 Route Handler，`/api/advisor` |

它排在降级顺序**第一位**，砍掉后整个项目退化为纯静态站。

### 1.4 数据质量靠脚本，不靠数据库

早期方案考虑用 Postgres 的外键约束强制「无来源不得入库」（PRD §8）。**否决**——2,000 行数据用不上关系数据库，而且外键根本表达不了真正要检查的东西：

- ✅ 外键能查：每条录取记录有来源
- ❌ 外键查不了：**至少 2 组数据能演示滑杆反转**
- ❌ 外键查不了：**至少 1 所大学 Leverage 判定为「低」**
- ❌ 外键查不了：分母覆盖率 ≥ 80%

后两条恰恰是演示成败的关键（[`data-sources.md`](data-sources.md) §7）。所以质量校验落在**构建时的校验脚本**上，输出一份人能读的报告，而不是一句约束冲突。

---

## 2. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | **Next.js（App Router）** | 页面全部静态预渲染；保留一个 Route Handler 给 AI |
| 样式 | **Tailwind** | |
| 图表 / 地图 | **ECharts**（按需引入） | geo 地图 + 热力 + 柱状；双屏联动的核心 |
| 语言 | TypeScript | 校验脚本也用 TS，全仓库单一工具链 |
| 数据 | 构建期 JSON，`import` 进 bundle | 无运行时数据请求 |
| 测试 | Vitest | 只覆盖 `lib/scoring.ts` 与校验脚本 |
| 部署 | **Vercel** | |

**不使用 `output: 'export'`** —— 那会禁掉 `/api/advisor`。改为：所有页面通过模块顶层 `import` 数据实现静态预渲染，Vercel 自然把它们输出为静态资源，只有那一个 Route Handler 是 Function。

> **约束**：任何页面都不得引入请求时数据获取（`cache: 'no-store'`、动态 `searchParams` 的服务端读取等）。一旦某个页面变成 SSR，就多了一个会在半夜挂掉、且要花钱的东西——而这个站要长期挂在线上。构建后确认所有页面标记为静态。

---

## 3. 仓库结构

```
/
├── PRD.md  PROGRESS.md  README.md
├── docs/          metrics.md · data-sources.md · launch.md · design.md
├── app/
│   ├── page.tsx              首页：双屏地图 + 榜单 + 滑杆 + 闸门
│   ├── school/[id]/page.tsx  学校深度卡片 / 出口画像（generateStaticParams）
│   └── api/advisor/route.ts  唯一的 Route Handler（P1）
├── components/
│   ├── map/       WorldMap · ChinaMap（均为 client-only）
│   ├── ranking/   FeederTable · WeightSlider · Filters · FeasibilityGate
│   ├── school/    DeepCard（四段）· CompareTable
│   ├── trust/     SourcePopover · ConfidenceBadge · BasisNote
│   └── share/     PosterCanvas
├── lib/
│   ├── scoring.ts   Volume / Density / Score / Leverage / CAI —— 纯函数
│   ├── filters.ts   筛选 + 可行性闸门判定
│   ├── copy.ts      解读文案生成（US-1.5）—— 模板拼接，非 LLM
│   ├── urlState.ts  URL ↔ 应用状态（US-8.2）
│   └── data.ts      数据加载与类型
├── data/
│   ├── raw/         表格导出的 CSV —— 数据资产，必须提交
│   └── ivy-map.json 构建产物，也提交（保证构建可复现）
├── scripts/
│   ├── build-data.ts  CSV → 校验 → JSON
│   └── validate.ts    质量检查清单
└── types/index.ts
```

---

## 4. 数据管线

```
在线表格（人工录入，可在手机上填）
   ↓ 导出
data/raw/*.csv          ← 提交进 git，可 diff、可回溯
   ↓ pnpm data:build
scripts/build-data.ts   ← 解析 + 校验 + 折算 + 派生指标
   ↓
data/ivy-map.json       ← 提交进 git
   ↓ import
Next.js 构建 → 静态页面
```

**为什么 CSV 也提交**：数据是本项目唯一的护城河（PRD §2.3）。提交后每次改动都可 diff、可追溯到人，出问题能回滚——这比任何数据库都重要。

### 4.1 构建期完成的工作

在 `build-data.ts` 里做掉，运行时不再重算：

1. **offer → 人数折算**（[`metrics.md`](metrics.md) §3），并**自动下调置信等级**
2. **CAI 五维评分**与等级映射（§8）
3. **Leverage HHI** 与档位，含样本护栏（§7）
4. 多来源冲突检测，打上 `conflict` 标记
5. 跑完整的质量检查清单，**任何一条硬性检查不通过则构建失败**

运行时只算 `Volume / Density / Score` —— 因为它们依赖滑杆的 `alpha` 和当前筛选结果集，必须实时。

### 4.2 校验脚本的硬性检查

不通过就退出非零，CI 拦住合并：

```
[硬性] 每条录取记录有 sourceId，且该 source 存在
[硬性] 每条记录 basis ∈ {admits, offers, estimated}
[硬性] 所有 estimated 记录的 confidence 已下调
[硬性] 每所学校的 requirement 字段齐全（可为 'unknown'，不可缺失）
[硬性] 主线（布朗 × 上海 × 三赛道）无缺口
[硬性] 首屏默认组合存在，且该组合下滑杆会发生排名反转
[警告] 分母覆盖率 ≥ 80%
[警告] 至少 2 组数据能演示滑杆排名反转
[警告] 至少 1 所大学 Leverage 判定为「低」
```

后三条设为**警告而非硬性**，但每次构建都打印在最显眼处——它们决定产品有没有说服力，需要每天被看见（[`data-sources.md`](data-sources.md) §7）。

> **「首屏默认组合会发生排名反转」是硬性检查**：线上没有解说员，滑杆的价值全靠首屏那一次自动演示（PRD US-1.0）。如果默认组合恰好不反转，这个产品最强的一点访客根本看不到——而这是数据一变就可能悄悄失效的东西，必须由构建拦住。

---

## 5. 数据类型

```ts
type Track      = 'AP' | 'IB' | 'ALEVEL'          // 三选一，无 Other
type Basis      = 'admits' | 'offers' | 'estimated'
type Confidence = 'L1' | 'L2' | 'L3'
type SchoolType = 'public_intl_dept' | 'private_intl' | 'foreign_nationals'

interface University {
  id: string; nameCn: string; nameEn: string
  country: string; city: string; lng: number; lat: number
  cai: { grade: 'A'|'B'|'C'|'D'|'E'; dims: Record<string, number>; sourceIds: string[] } | null
  leverage: { hhi: number; level: 'high'|'mid'|'low' } | null   // null = 样本不足，UI 显示「样本不足」
}

interface School {
  id: string; nameCn: string; nameEn?: string
  city: string; district?: string; lng: number; lat: number
  type: SchoolType; tracks: Track[]
  tuitionCny: number | null; boarding: boolean | null
  requirement: Requirement
}

interface Requirement {                            // 可行性闸门（E2）
  nationality: 'none'|'foreign'|'hk_mo_tw'|'foreign_or_pr'|'unknown'
  hukou:       'none'|'local_city'|'local_district'|'unknown'
  entryGrades: number[] | null                     // null = 未查到
  examTypes:   string[]
  applicationWindow: string | null
  sourceId: string; notes?: string
}

interface Cohort {                                 // 届次 —— 密度的分母
  schoolId: string; year: number; track: Track
  graduates: number | null                         // null 就是 null，绝不猜（metrics.md §5）
  totalOffers: number | null                       // 用于折算系数 k
  sourceId: string
}

interface Admission {
  schoolId: string; universityId: string
  year: number; track: Track
  admits: number | null; offers: number | null
  basis: Basis; confidence: Confidence
  sourceId: string
  conflict?: { otherSourceIds: string[] }          // 多来源不一致，UI 必须明示
}

interface Source {
  id: string; type: 'official'|'media'|'report'|'crowdsourced'
  title: string; url: string
  publishedAt: string | null; capturedAt: string
  confidence: Confidence
}
```

**`null` 一律表示「没有数据」，永远不用 `0` 顶替。** 这是 PRD 原则 §5.1 在类型层的落点——`graduates: 0` 和 `graduates: null` 在密度计算里是天壤之别。

---

## 6. 状态管理：URL 就是状态

**不引入任何状态管理库。** 全部应用状态编码进 URL query：

```
/?u=brown&city=shanghai&track=IB&alpha=0.5
 &nat=cn&hukou=non_local&grade=8
 &cmp=school-a,school-b
```

| 参数 | 对应需求 |
|---|---|
| `u` `city` `track` `type` | US-1.3 筛选 |
| `alpha` | US-1.4 滑杆位置 |
| `nat` `hukou` `grade` `year` | US-2.1 可行性闸门 |
| `cmp` | US-3.2 对比集合 |

这一个决定同时满足三条验收标准：**US-8.2 可复现链接**、US-1.3「筛选状态刷新后保持」、US-2.1「闸门输入刷新后保持」。

实现：`useSearchParams` 读，`router.replace`（非 `push`）写——滑杆拖动不该污染浏览器后退栈。滑杆写 URL 需 throttle（~100ms），但**榜单重排不等 URL**，直接用本地 state 驱动，否则手感又没了。

---

## 7. 计算层

`lib/scoring.ts` —— **纯函数、无 IO、无全局状态**，可单测。口径定义见 [`metrics.md`](metrics.md)，本文只说实现约定：

```ts
scoreFeeders(input: {
  admissions: Admission[]      // 已按 university + track 过滤
  cohorts: Cohort[]
  alpha: number                // 0 = 纯概率, 1 = 纯规模
}): FeederRow[]
```

- **归一化在当前结果集内做，不是全局**（`metrics.md` §6）。所以筛选一变必须重算——这也是它不能预计算的原因。
- `Density` 为 `null` 时排在同 Volume 档末尾，并带 `denominatorMissing: true` 供 UI 标注。
- 每个公式一个测试用例，覆盖边界：分母为 0、单条记录、全部同值、null 密度、结果集只有两所（`metrics.md` §9 的退化情形）。

**不缓存。** 2,000 行数据全量算一遍在毫秒级，缓存带来的一致性风险不值得。

**解读文案（US-1.5）走 `lib/copy.ts` 的模板拼接，不经过 LLM。** 它出现在滑杆每次拖动之后，必须是确定性且零延迟的。

---

## 8. AI 解析（US-6.1，P1）

**最小版**：自然语言 → 筛选条件 → 填进筛选器并回显。**模型不接触任何数值**。

```
POST /api/advisor  { text: string }
→  { city?, track?, grade?, budget?, universityIds?, unresolved: string[] }
```

- 用 tool/function calling 强制结构化输出，schema 与 URL 参数一一对应
- 服务端**校验返回值是否在合法枚举内**，越界的字段丢弃并计入 `unresolved`
- 前端拿到后写入 URL（§6），走的是和手动筛选**完全相同**的路径——所以两者结果永远一致（US-6.2 验收标准）
- 解析结果必须回显且可改，不得静默生效

> 这个最小版天然满足 US-6.3 的数值安全边界：模型的输出空间被限制在一组枚举值里，**物理上没有能力编造一个录取人数**。

---

## 9. 已知的坑

### 9.1 ECharts 的中国地图 GeoJSON 不在包里

ECharts 自 v4 起不再内置地图数据，`registerMap()` 需要自己提供 GeoJSON。

**必须使用边界正确的官方来源**（如阿里云 DataV.GeoAtlas 的中国地图数据）。这是一个面向中国用户的产品，地图边界错误不是技术 bug，是**合规事故**。这一条在提交前必须人工确认，不能靠「随便找个 npm 包」。

### 9.2 ECharts 体积

完整包超过 1MB。必须按需引入：

```ts
import * as echarts from 'echarts/core'
import { MapChart, ScatterChart, BarChart } from 'echarts/charts'
import { GeoComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
```

### 9.3 ECharts 需要 DOM，不能 SSR

所有图表组件必须 `'use client'` + `dynamic(..., { ssr: false })`，否则构建期报错或水合不一致。

### 9.4 分享长图的中文字体

用 `html-to-image` 对一个**专门的海报组件**截图，不要截真实页面 DOM（响应式布局会让结果不可控）。

**必须 `await document.fonts.ready` 再截**，否则中文字体没加载完，导出图会是一片方框或降级字体。这个问题在开发机上（字体已缓存）不复现，只在**别人的设备上**复现——而线上产品全都是别人的设备。

### 9.5 移动端的滑杆

US-8.1 要求滑杆在触屏上可拖且变化可见。原生 `<input type="range">` 在移动端可用性尚可，但**必须验证拖动时榜单不被虚拟键盘或滚动劫持**。这一条留到 8/8 的移动端专场验证。

---

## 10. 部署

| | |
|---|---|
| 平台 | Vercel |
| 构建 | `pnpm data:build && pnpm build` —— 数据校验不过则构建失败 |
| 环境变量 | `ANTHROPIC_API_KEY`（仅 `/api/advisor` 使用） |
| 页面 | 全部静态预渲染 |
| Function | 仅 `/api/advisor` 一个 |

### 10.1 上线节奏

**第一天就接上 Vercel，之后每次收工都推。** 交付物是线上站点，「本地好好的」在这里没有任何意义。早上线的真实收益是提前暴露只在生产环境出现的问题——字体加载、图片路径、移动端真机、构建告警。

### 10.2 可用性

纯静态 + CDN，没有可以半夜挂掉的进程。被转发到家长群带来的流量高峰，CDN 直接扛，成本不变。

出问题基本只可能是构建问题，回滚到上一次部署即可。

### 10.3 分享元信息（US-8.5）

- 每个页面独立的 `<title>` 与 `description`，学校页用学校名
- OG / Twitter meta 完整，含预览图
- **微信不读 OG 富卡片**（那需要 JS-SDK + 认证公众号，本次不做），它主要取 `<title>` 和页面里靠前的图——所以这两样要认真写

### 10.4 埋点

Vercel Analytics，一行接入。只看三个数：访问量、滑杆是否被拖动过、分享长图生成次数。

**滑杆拖动率是这个产品最重要的一个指标**——它直接回答「首屏自解释做成功了没有」。

---

## 11. 性能预算

| 项 | 预算 | 对应需求 |
|---|---|---|
| 数据 JSON（gzip） | < 100KB | §1.1 实测约 50–60KB |
| 首屏可交互 | < 3s（4G） | |
| 点击大学 → 内容可读 | < 1s | US-1.1 |
| 滑杆拖动 → 榜单重排 | **< 16ms/帧，无可见延迟** | US-1.4 —— 这条是产品的命 |
| 筛选变更 → 重排 | 用户感知即时 | US-1.3 |

滑杆那条如果达不到，先降级的是**动画**，不是计算——排序结果必须跟手。

---

## 12. 测试范围

时间只有约 30 小时/人（PRD §10.1），**不做全面测试**。只覆盖两处错了会静默出错、且人眼看不出来的地方：

1. **`lib/scoring.ts`** —— 算错了榜单还是会正常显示，只是排序是错的。这是最危险的一类 bug。
2. **`scripts/validate.ts`** —— 它是数据质量的唯一防线，它自己错了整条防线就没了。

UI 靠人工过验收清单，不写自动化测试。

---

## 13. 待定

| 项 | 何时定 |
|---|---|
| 中国地图 GeoJSON 的具体来源与边界核对 | M1（7/31 前，早定早排雷） |
| 大学在世界地图上的投影方式（真实经纬度 vs 示意布局） | M2 |
| 分享长图的具体版式 | M4（8/8） |
| 是否需要暗色模式 | 不做，除非有余量 |
