// 关于页。内容取自 docs/launch.md §4 的 FAQ —— 那份 FAQ 同时也是对外说明。
//
// 线上没有解说员，所以「为什么默认是剑桥」这类方法论问题必须有个地方讲清楚，
// 否则会被当成随便挑的。

import type { Metadata } from 'next'
import Link from 'next/link'
import { dataStatus } from '@/lib/data'

export const metadata: Metadata = {
  title: '关于 · 数据来源与方法论',
  description:
    'IVY Map 的数据从哪来、口径怎么定、为什么默认是剑桥、分母拿不到怎么办、AI 会不会编数据。',
}

const QA: { q: string; a: React.ReactNode }[] = [
  {
    q: '这和那些留学排名网站有什么不一样？',
    a: (
      <>
        <p>
          方向是反的。排名网站回答「这所大学好不好」，我们回答
          <strong>「想去这所大学，该上哪所高中」</strong>。
        </p>
        <p>对一个初二孩子的家长来说，选大学是三年后的事，他今年唯一能动的杠杆是选高中。</p>
      </>
    ),
  },
  {
    q: '你们的榜单凭什么比学校自己发的战报准？',
    a: (
      <>
        <p>修正了两件事。</p>
        <p>
          <strong>第一，offer 膨胀。</strong>战报报的是 offer 数，一个孩子能同时拿七八个。 「30
          枚藤校 offer」可能只对应 6 个人。我们折算成人头，并标注哪些是折算过的。
        </p>
        <p>
          <strong>第二，没有分母。</strong>A 校三年送 15 个进剑桥，B 校送 8 个——但 A 校每届 180
          个毕业生，B 校只有 48 个。人均算下来 3.0% vs 5.8%，
          <strong>B 校几乎是 A 校的两倍</strong>。
        </p>
        <p>榜单上那个滑杆，就是这两个视角的切换开关。</p>
      </>
    ),
  },
  {
    q: '为什么默认是剑桥，不是哈佛或藤校？',
    a: (
      <>
        <p>
          因为<strong>只有英国方向的数字是点名到校的</strong>。
        </p>
        <p>
          国内学校的升学战报总会单独列出「牛津 X、剑桥 Y」——那是招牌。但美国方向报的是档位：
          「藤校 12 枚」「US Top 10 共 23 人」，<strong>几乎没有学校会写「布朗 2 人」</strong>。
        </p>
        <p>
          要做一个「布朗的生源校榜单」，就得把那 12 枚藤校按某种比例拆到具体学校头上。
          <strong>那是编造，我们不做。</strong>
        </p>
        <p>
          还有一层：英国走 UCAS，一人一份申请、最多 5 个志愿，牛津和剑桥只能选一个。 所以「剑桥
          4 枚」就是 4 个人头，<strong>根本不存在 offer 膨胀</strong>，也不需要折算。
        </p>
      </>
    ),
  },
  {
    q: '数据从哪来？可信吗？',
    a: (
      <>
        <p>
          三层来源，每条都标了等级：学校官方战报和升学报告是 L1，教育媒体年度汇总是 L2，
          公开统计推断是 L3。
        </p>
        <p>
          <strong>每一个数字都能点开看到来源链接、发布日期和等级。</strong>
          没有来源的数据不允许进入产品——这是构建时强制的，不是「尽量」。
        </p>
      </>
    ),
  },
  {
    q: '分母（毕业生数）拿不到怎么办？',
    a: (
      <>
        <p>显示「—」，不是 0。该校在概率排序下降权并标注「分母缺失」。</p>
        <p>
          <strong>我们不猜分母。</strong>分母是这套算法的地基，猜分母等于伪造结论。
        </p>
        <p>顺带说，这也是最难拿的字段——大多数学校只报喜不报分母。</p>
      </>
    ),
  },
  {
    q: '会不会推荐我去一所我根本报不了的学校？',
    a: (
      <p>
        不会，这正是「可行性闸门」要解决的。填入孩子的国籍、户籍和年级，报不了的学校会自动置灰
        <strong>并写明具体是哪一条不符合</strong>——因为户籍能想办法，国籍不能。
      </p>
    ),
  },
  {
    q: '你们是不是在贩卖教育焦虑？',
    a: (
      <>
        <p>
          判断正相反。焦虑来自信息不对称——家长不知道 offer 数是灌水的，不知道要看分母，
          不知道自己压根没资格报名。
        </p>
        <p>
          而且系统会主动告诉你「这所大学的录取分散在一百多所高中，
          <strong>择校杠杆低，钱和精力建议花在别处</strong>」。一个愿意劝你别花钱的产品，
          很难说是在卖焦虑。
        </p>
      </>
    ),
  },
  {
    q: '数据错了怎么办？',
    a: (
      <>
        <p>
          每所学校页面有「数据有误？」入口。提交需要附来源链接，我们人工核实后更新并标注更新日期。
        </p>
        <p>
          <strong>线上产品最怕的就是错了没人告诉你</strong>，所以这个入口是认真的，不是摆设。
        </p>
      </>
    ),
  },
]

export default function AboutPage() {
  const s = dataStatus()
  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <nav className="pt-5 text-sm">
        <Link href="/universities" className="secondary-action">
          ← 返回大学目录
        </Link>
      </nav>

      <header className="soft-panel mt-5 p-6 sm:p-9">
        <p className="label text-leaf">IVY MAP · 关于</p>
        <h1 className="mt-3 text-3xl leading-snug text-forest-deep sm:text-[44px]">
          数据来源与方法论
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink/60 tnum">
          当前收录 {s.universities} 所大学 · {s.schools} 所高中 · {s.admissions} 条排名录取 ·{' '}
          {s.feederEvidence} 条去向证据 · {s.admissionRateUniversities} 所大学 /{' '}
          {s.admissionRatePoints} 个时期的官方录取率 · {s.admissionCountUniversities} 所大学 /{' '}
          {s.admissionCountPoints} 条招生人数记录 · {s.sources} 个来源
        </p>
      </header>

      <div className="mt-8 space-y-4">
        {QA.map(({ q, a }) => (
          <section key={q} className="rounded-[14px] border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-xl text-forest-deep">{q}</h2>
            <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-ink">{a}</div>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-[14px] bg-cream p-5 sm:p-6">
        <h2 className="text-xl text-forest-deep">本次没有做的</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/60">
          美国方向的单校榜单（战报只报档位，拆到单校即编造）、AI 择校顾问、时间轴规划、
          路径与成本对比、同城对标、多年趋势预警。需求都已拆解完成，只是本轮没做。
        </p>
      </section>
    </main>
  )
}
