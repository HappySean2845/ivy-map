// 四维大学画像指纹。它描述差异，不计算总分。
//
// 五个同心方框对应五档，所有轴都统一为“越外表示该特征越强”。实心顶点来自
// 可追溯数据，空心顶点是编辑评估；缺数据时断轴，不用最低档补空。

import { brandOf, withAlpha } from '@/lib/v2/brand'
import {
  PROFILE_LEVELS,
  PROFILE_TRAITS,
  PROFILE_TRAIT_LABEL,
  PROFILE_TRAIT_LEVEL_LABEL,
  PROFILE_TRAIT_SHORT_LABEL,
  type ProfileTrait,
  type ProfileTraitRating,
} from '@/types/profile'

const AXIS_DEG: Record<ProfileTrait, number> = {
  admissionOpenness: -90,
  chinaEcosystem: 0,
  campusImmersion: 90,
  academicBreadth: 180,
}

function polar(deg: number, radius: number, cx: number, cy: number) {
  const radians = (deg * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

export function ProfileFingerprint({
  fingerprint,
  brandColor,
  size = 148,
  labelMode = 'short',
  className = '',
}: {
  fingerprint: Record<ProfileTrait, ProfileTraitRating>
  brandColor: string | null
  size?: number
  labelMode?: 'short' | 'full' | 'none'
  className?: string
}) {
  const brand = brandOf(brandColor)
  const showLabels = labelMode !== 'none'
  const pad = showLabels ? size * 0.19 : size * 0.06
  const center = size / 2
  const radius = size / 2 - pad
  const available = PROFILE_TRAITS.filter((trait) => fingerprint[trait].level != null)

  const points = available
    .map((trait) => {
      const level = fingerprint[trait].level as number
      const point = polar(AXIS_DEG[trait], (radius * level) / 5, center, center)
      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
    })
    .join(' ')

  const summary = PROFILE_TRAITS.map((trait) => {
    const rating = fingerprint[trait]
    if (rating.level == null) return `${PROFILE_TRAIT_LABEL[trait]}：暂无可比数据`
    const provenance = rating.kind === 'measured' ? '官方数据' : '编辑评估'
    return `${PROFILE_TRAIT_LABEL[trait]} ${rating.level}/5，${PROFILE_TRAIT_LEVEL_LABEL[trait][rating.level]}（${provenance}）`
  }).join('；')

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={`大学画像指纹：${summary}`}
      className={className}
    >
      {PROFILE_LEVELS.map((level) => (
        <polygon
          key={level}
          points={PROFILE_TRAITS.map((trait) => {
            const point = polar(AXIS_DEG[trait], (radius * level) / 5, center, center)
            return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
          }).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeOpacity={level === 5 ? 0.3 : level === 3 ? 0.16 : 0.09}
          strokeWidth={1}
        />
      ))}

      {PROFILE_TRAITS.map((trait) => {
        const point = polar(AXIS_DEG[trait], radius, center, center)
        const missing = fingerprint[trait].level == null
        return (
          <line
            key={trait}
            x1={center}
            y1={center}
            x2={point.x}
            y2={point.y}
            stroke="currentColor"
            strokeOpacity={missing ? 0.28 : 0.12}
            strokeDasharray={missing ? '2 3' : undefined}
            strokeWidth={1}
          />
        )
      })}

      {available.length >= 3 && (
        <polygon
          points={points}
          fill={withAlpha(brand, 0.14)}
          stroke={brand}
          strokeWidth={1.5}
        />
      )}
      {available.length === 2 && (
        <polyline points={points} fill="none" stroke={brand} strokeWidth={1.5} />
      )}

      {available.map((trait) => {
        const rating = fingerprint[trait]
        const point = polar(
          AXIS_DEG[trait],
          (radius * (rating.level as number)) / 5,
          center,
          center,
        )
        const measured = rating.kind === 'measured'
        return (
          <circle
            key={trait}
            cx={point.x}
            cy={point.y}
            r={measured ? 3.6 : 3.1}
            fill={measured ? brand : 'var(--paper)'}
            stroke={brand}
            strokeWidth={1.5}
          />
        )
      })}

      {showLabels &&
        PROFILE_TRAITS.map((trait) => {
          const point = polar(AXIS_DEG[trait], radius + pad * 0.54, center, center)
          const deg = AXIS_DEG[trait]
          const horizontal = deg === 0 || deg === 180
          const anchor = deg === 0 ? 'end' : deg === 180 ? 'start' : 'middle'
          const yOffset = deg === -90 ? -1 : deg === 90 ? 8 : -7
          const level = fingerprint[trait].level
          const label =
            labelMode === 'full' ? PROFILE_TRAIT_LABEL[trait] : PROFILE_TRAIT_SHORT_LABEL[trait]
          return (
            <text
              key={trait}
              x={point.x}
              y={point.y + yOffset}
              textAnchor={anchor}
              fontSize={labelMode === 'full' ? (size < 190 ? 9 : 11) : size < 150 ? 9.5 : 10.5}
              fill="currentColor"
              fillOpacity={level == null ? 0.35 : 0.64}
              stroke="var(--paper)"
              strokeWidth={horizontal ? 4 : 3}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {label} {level ?? '—'}
            </text>
          )
        })}
    </svg>
  )
}

export default ProfileFingerprint
