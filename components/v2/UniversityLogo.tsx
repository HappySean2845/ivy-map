import { readableInkOn } from '@/lib/v2/brand'
import type { UniversityProfile } from '@/types/profile'

const SIZE_CLASS = {
  compact: 'h-10 w-12',
  card: 'h-12 w-14',
  detail: 'h-16 w-20',
} as const

const MONOGRAM_CLASS = {
  compact: 'text-[11px]',
  card: 'text-[13px]',
  detail: 'text-base',
} as const

export function UniversityLogo({
  profile,
  size,
  eager = false,
}: {
  profile: Pick<UniversityProfile, 'brandColor' | 'logoPath' | 'monogram'>
  size: keyof typeof SIZE_CLASS
  eager?: boolean
}) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center overflow-hidden border border-ink/15 bg-paper ${SIZE_CLASS[size]}`}
    >
      {profile.logoPath ? (
        // eslint-disable-next-line @next/next/no-img-element -- 本地品牌图形已预压缩到 192px，不走远程优化
        <img
          src={profile.logoPath}
          alt=""
          className="max-h-[calc(100%-4px)] max-w-[calc(100%-4px)] object-contain"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <span
          className={`grid h-full w-full place-items-center font-medium tracking-tight ${MONOGRAM_CLASS[size]}`}
          style={{
            background: profile.brandColor ?? '#20201e',
            color: readableInkOn(profile.brandColor),
          }}
        >
          {profile.monogram}
        </span>
      )}
    </span>
  )
}

export default UniversityLogo
