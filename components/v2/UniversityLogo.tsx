import { readableInkOn } from '@/lib/v2/brand'
import type { UniversityProfile } from '@/types/profile'

const WIDTH_CLASS = {
  compact: 'w-12',
  card: 'w-14',
  detail: 'w-20',
} as const

const FALLBACK_BOX_CLASS = {
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
  size: keyof typeof WIDTH_CLASS
  eager?: boolean
}) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-start justify-center ${WIDTH_CLASS[size]}`}
    >
      {profile.logoPath ? (
        // eslint-disable-next-line @next/next/no-img-element -- 本地品牌图形已预压缩到 192px，不走远程优化
        <img
          src={profile.logoPath}
          alt=""
          className="h-auto w-full object-contain"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <span
          className={`grid place-items-center font-medium tracking-tight ${FALLBACK_BOX_CLASS[size]} ${MONOGRAM_CLASS[size]}`}
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
