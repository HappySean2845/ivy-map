import {
  REQUIREMENT_BASIS_LABEL,
  REQUIREMENT_KEYS,
  REQUIREMENT_LABEL,
  type UniversityRequirementProfile,
} from '@/types/university-enrichment'

const COST_LABEL: Record<NonNullable<UniversityRequirementProfile['livingCost']>, string> = {
  Low: '较低',
  'Med-Low': '中低',
  Med: '中等',
  'Med-High': '中高',
  High: '较高',
}

export function UniversityRequirements({ profile }: { profile: UniversityRequirementProfile }) {
  return (
    <section className="mt-12 rounded-[30px] border border-line bg-surface p-5 sm:p-8">
      <p className="label text-leaf">录取要求与生活环境</p>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.75fr)] lg:gap-14">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl leading-tight text-forest-deep sm:text-[32px]">
              成绩参考，不是录取平均分
            </h2>
            <p className="text-[11px] text-ink/45">按本科申请口径整理</p>
          </div>
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-ink/50">
            最低门槛、竞争建议、提交者中段 50% 与典型 offer
            是四种不同事实。达到这些数字不代表会被录取；按专业或申请路径变化的要求，以官网专业页为准。
          </p>

          <dl className="mt-5 border-t border-line">
            {REQUIREMENT_KEYS.map((key) => {
              const requirement = profile.requirements[key]
              return (
                <div
                  key={key}
                  className="grid gap-1 border-b border-line py-3 sm:grid-cols-[5rem_7.5rem_1fr] sm:gap-3"
                >
                  <dt className="text-sm">{REQUIREMENT_LABEL[key]}</dt>
                  <dd className="text-[11px] text-leaf">
                    <span className="inline-flex rounded-full bg-mint px-2 py-1">
                      {REQUIREMENT_BASIS_LABEL[requirement.basis]}
                    </span>
                  </dd>
                  <dd
                    className={`text-sm leading-relaxed ${requirement.basis === 'unavailable' ? 'text-ink/40' : 'text-ink/75'}`}
                  >
                    {requirement.text}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>

        <aside className="rounded-[24px] bg-cream p-5 lg:p-6">
          <p className="label text-leaf">落地环境</p>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-[11px] text-ink/40">地区形态</dt>
              <dd className="mt-1 leading-relaxed text-ink/75">{profile.setting}</dd>
            </div>
            {profile.climate && (
              <div>
                <dt className="text-[11px] text-ink/40">气候</dt>
                <dd className="mt-1 leading-relaxed text-ink/75">{profile.climate}</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] text-ink/40">生活成本</dt>
              <dd className="mt-1 text-ink/75">
                {profile.livingCost ? COST_LABEL[profile.livingCost] : '待补'}
              </dd>
            </div>
            {profile.safety && (
              <div className="border-t border-line pt-4">
                <dt className="text-[11px] text-ink/40">安全提示 · 编辑调研</dt>
                <dd className="mt-1 leading-relaxed text-ink/75">{profile.safety.text}</dd>
              </div>
            )}
          </dl>
        </aside>
      </div>

      <details className="mt-6 rounded-2xl bg-mint px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-forest">
          查看口径备注与来源
        </summary>
        <div className="mt-3 max-w-4xl text-xs leading-relaxed text-ink/60">
          <p>{profile.notes}</p>
          {profile.sourceUrls.length > 0 && (
            <ul className="mt-3 space-y-1">
              {profile.sourceUrls.map((url, index) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="break-all">
                    来源 {index + 1} → {url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </section>
  )
}

export default UniversityRequirements
