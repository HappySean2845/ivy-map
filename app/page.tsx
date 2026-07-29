// 临时的数据状态板。真正的首页是双屏地图 + 榜单（PRD US-1.0 / US-1.1），
// 等主线数据录进来之后替换掉这个文件。
//
// 在此之前它有个实际用途：每次往 CSV 里填完数据，刷新就能看到离
// 里程碑门禁还差多少。

import { dataset, dataStatus, universityById, cityById } from '@/lib/data'
import { TRACK_LABEL } from '@/types'

const pct = (n: number) => `${Math.round(n * 100)}%`

function Gate({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex gap-3 py-2.5">
      <span
        className={`mt-0.5 shrink-0 font-mono text-sm ${ok ? 'text-emerald-600' : 'text-neutral-400'}`}
      >
        {ok ? '✓' : '○'}
      </span>
      <span className="min-w-0">
        <span className={ok ? '' : 'text-neutral-500'}>{label}</span>
        <span className="ml-2 text-xs text-neutral-400">{detail}</span>
      </span>
    </li>
  )
}

export default function Home() {
  const s = dataStatus()
  const dv = dataset.defaultView

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">IVY Map</h1>
      <p className="mt-1.5 text-sm text-neutral-500">常春藤择校地图 · 数据构建状态</p>

      <section className="mt-8 grid grid-cols-3 gap-3 text-center">
        {([
          ['录取记录', s.admissions],
          ['届次', s.cohorts],
          ['来源', s.sources],
        ] as const).map(([label, n]) => (
          <div
            key={label}
            className="rounded-lg border border-neutral-200 py-4 dark:border-neutral-800"
          >
            <div className="font-mono text-2xl tabular-nums">{n}</div>
            <div className="mt-1 text-xs text-neutral-500">{label}</div>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium">里程碑门禁</h2>
        <ul className="mt-2 divide-y divide-neutral-100 text-sm dark:divide-neutral-900">
          <Gate
            ok={s.admissions > 0}
            label="主线录取数据已录入"
            detail={`M1 · 7/31 前 · 当前 ${s.admissions} 条`}
          />
          <Gate
            ok={s.hasDefaultView}
            label="首屏默认组合能演示排名反转"
            detail={
              dv
                ? `${universityById.get(dv.universityId)?.nameCn} × ${cityById.get(dv.cityId)?.name} × ${TRACK_LABEL[dv.track]}`
                : 'US-1.0 的核心说服力依赖它'
            }
          />
          <Gate
            ok={s.denominatorCoverage >= 0.8}
            label="分母（毕业生数）覆盖率 ≥ 80%"
            detail={`当前 ${pct(s.denominatorCoverage)} · 不够的话滑杆演示会失效`}
          />
          <Gate
            ok={s.requirementCoverage >= 1}
            label="门槛数据 100% 填齐"
            detail={`当前 ${pct(s.requirementCoverage)} · 可行性闸门的前提`}
          />
          <Gate
            ok={s.hasLowLeverage}
            label="至少 1 所大学择校杠杆为「低」"
            detail="「别折腾」的叙事需要真实实例"
          />
          <Gate
            ok={s.verifiedSchools === s.schools}
            label="学校身份信息已人工核对"
            detail={`${s.verifiedSchools} / ${s.schools} 所`}
          />
        </ul>
      </section>

      <section className="mt-8 rounded-lg bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        <p className="font-medium text-neutral-900 dark:text-neutral-100">下一步</p>
        <p className="mt-1.5">
          往 <code className="font-mono">data/raw/sources.csv</code> 和{' '}
          <code className="font-mono">data/raw/admissions.csv</code> 里录主线数据（布朗 × 上海 ×
          三赛道），然后跑 <code className="font-mono">pnpm data:build</code>。
        </p>
        <p className="mt-1.5">
          没有来源链接的数据一律不录 —— 构建会直接失败，这是设计好的。
        </p>
      </section>

      <p className="mt-6 font-mono text-[11px] text-neutral-400">
        built {dataset.builtAt.slice(0, 19).replace('T', ' ')} · {s.universities} 大学 · {s.schools}{' '}
        高中
      </p>
    </main>
  )
}
