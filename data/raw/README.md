# 数据录入说明

完整规范见 [`docs/data-sources.md`](../../docs/data-sources.md)。这里只讲怎么填这几个 CSV。

**录完跑 `pnpm data:build`。** 它会告诉你哪里不对、离门禁还差多少。构建失败就是不让你把有问题的数据带进产品——这是设计好的。

---

## 两条铁律

1. **每行必须有来源链接。** 没链接的一律不录，哪怕你确信它是对的。构建会直接失败。
2. **口径不许留空。** 只有 `admits` / `offers` / `estimated` 三个值。看不出是哪种口径的数据，宁可不录。

多花 10 秒的成本，换的是站点上线后被家长或学校方指出数据没出处时，不至于赔上整个产品的可信度。

---

## 录入顺序

先 `sources.csv`，再 `admissions.csv` / `cohorts.csv` / `feeder-evidence.json`（它们要引用来源 id）。

### 1. `sources.csv` —— 先登记出处

| 列 | 说明 |
|---|---|
| `id` | 自己起，短横线小写，如 `ykpao-2025-report` |
| `type` | `official` 学校官方 / `media` 媒体 / `report` 机构报告 / `crowdsourced` 众包 |
| `title` | 这份材料叫什么 |
| `url` | **必填**，要能打开 |
| `published_at` | 材料的发布日期 `YYYY-MM-DD`，不确定留空 |
| `captured_at` | 你采集它的日期 `YYYY-MM-DD` |
| `confidence` | `L1` 官方一手 / `L2` 权威二手 / `L3` 推断或众包 |

### 2. `admissions.csv` —— 录取记录

| 列 | 说明 |
|---|---|
| `school_id` `university_id` | 必须已存在于 `schools.csv` / `universities.csv` |
| `year` | 毕业届次，如 `2025` |
| `track` | `AP` / `IB` / `ALEVEL` 三选一 |
| `admits` | **去重人头数**。有就填这个 |
| `offers` | offer 数。只有 offer 口径时填 |
| `basis` | 上面填的是哪种：`admits` / `offers` / `estimated` |
| `confidence` | `L1` / `L2` / `L3` |
| `source_id` | 对应 `sources.csv` 的 id |

> 战报上写「斩获 N 枚 offer」→ 填 `offers`，`basis=offers`。构建时会按该校当年的人均 offer 系数折算成人头，**并自动把置信降一级**。
>
> 同一条数据既有人数又有 offer 口径时，**永远优先用人数**。

### 2B. `feeder-evidence.json` —— 未拆分赛道的精确去向证据

当公开来源明确给出「高中 × 大学 × 年份」的 exact count，但没有拆分 AP / IB / A-Level 时，记录到这里而不是 `admissions.csv`。这些行可以在去向证据卡片和地图上展示，但不会进入人均密度排名。

- `sourceArtifact` 必须对应一次本地抓取的 SHA-256，抓取文件保存在已忽略的 `.data/runs/`。
- `scope` 明确年份、录取阶段、人数或 offer 口径、覆盖人群和完整性。
- 每行必须保留 `sourceLocator`；多赛道或未核验单赛道的学校，`track` 必须为 `null`。
- 导入 PG 前运行 `pnpm data:feeder:sql -- --input ... --output ...` 生成幂等 SQL。

### 3. `cohorts.csv` —— 毕业生数（人均密度的分母）

这张表最难拿，也最值钱——大多数学校只报喜不报分母。**谁把分母补齐，谁就有别人算不出来的指标。**

| 列 | 说明 |
|---|---|
| `school_id` `year` `track` | 同上 |
| `graduates` | **该赛道**的毕业生数 |
| `total_offers` | 该校该届的总 offer 数，用于估算折算系数。没有留空 |
| `source_id` | 对应来源 |

> **最容易踩的坑**：同时开 IB 和 OSSD 的学校，`graduates` 要填 **IB 赛道的**毕业生数，不是全校总数。填错会让密度系统性偏低，滑杆的排名反转就出不来了。
>
> **查不到就留空。** 留空会显示「—」，是诚实的；填个猜的数字，整个排序就是伪造的。

### 4. `requirements.csv` —— 门槛（可行性闸门的前提）

打开学校招生页填 8 个字段，约 15 分钟一所。**这是三条护城河里唯一能在本周期真正建立起来的一条。**

| 列 | 取值 |
|---|---|
| `nationality` | `none` 不限 / `foreign` 仅外籍 / `hk_mo_tw` 仅港澳台 / `foreign_or_pr` 外籍或绿卡 / `unknown` |
| `hukou` | `none` 不限 / `local_city` 需本市户籍 / `local_district` 需本区 / `unknown` |
| `entry_grades` | 开放入学的年级，竖线分隔如 `7\|9`。查不到留空 |
| `exam_types` | 竖线分隔如 `数学(英文卷)\|英语\|面谈` |
| `application_window` | 如 `03-01~03-20` |
| `source_id` `notes` | 来源与备注 |

> **查不到填 `unknown`，不要留空、不要猜。** 界面会显示「门槛信息待补充」并带纠错入口——这是诚实的处理，猜错则可能让家长错过报名。

---

## 已经填好的三张表

`cities.csv` `universities.csv` `schools.csv` 是种子数据，可以直接改。

**`schools.csv` 的 `verified` 列全是 `no`** ——学校名、性质、开设赛道都还没逐个核对过来源。核对一所改一所为 `yes`。学校性质（公办国际部 / 民办 / 外籍子女学校）直接决定可行性闸门的判定，填错会误导家长。

---

## 录入优先级

| 优先级 | 范围 | 截止 |
|---|---|---|
| **P0** | 布朗 × 上海 × 三赛道全部相关学校 × 3 届，含门槛 | **7/31** |
| P1 | 其余 7 所藤校 × 上海 + 北京 | 8/2 |
| P2 | 2–3 所择校杠杆低的对照大学 | 8/4 |
| P3 | 其余城市与院校 | 8/6 |

**8/6 之后不再录新数据**，只核对与补来源链接。

时间不够时砍 P3 的广度，**不砍 P0 的深度**。
