import { scoreFeeders } from '../lib/scoring.js'
import ds from '../data/ivy-map.json' with { type: 'json' }
const d: any = ds
const nameOf = (id: string) => d.schools.find((s: any) => s.id === id)?.nameCn ?? id

for (const uid of ['cambridge', 'oxford']) {
  for (const cid of ['shanghai', 'shenzhen', 'guangzhou', 'beijing', 'hangzhou']) {
    for (const t of ['ALEVEL', 'IB', 'AP']) {
      const ids = new Set(d.schools.filter((s: any) => s.cityId === cid && s.tracks.includes(t)).map((s: any) => s.id))
      const subset = d.admissions.filter((a: any) => a.universityId === uid && a.track === t && ids.has(a.schoolId))
      if (new Set(subset.map((a: any) => a.schoolId)).size < 2) continue
      const V = scoreFeeders({ admissions: subset, cohorts: d.cohorts, alpha: 1 })
      const D = scoreFeeders({ admissions: subset, cohorts: d.cohorts, alpha: 0 })
      const flip = V[0].schoolId !== D[0].schoolId
      const allHaveDens = V.every(r => r.density != null)
      console.log(`\n${uid} × ${cid} × ${t}  反转=${flip ? 'YES' : 'no'}  全员有分母=${allHaveDens ? 'YES' : 'NO'}${flip && !allHaveDens ? '  ← 假反转！' : ''}`)
      for (const r of V) {
        const dens = r.density == null ? '  —  ' : (r.density * 100).toFixed(2) + '%'
        console.log(`   ${nameOf(r.schoolId).padEnd(16)} V=${r.volume.toFixed(1).padStart(5)}  密度=${dens}  基于${r.densityYears.join('/') || '无'}${r.densityPartial ? ' (部分)' : ''}`)
      }
      console.log(`   规模序: ${V.map(r => nameOf(r.schoolId)).join(' > ')}`)
      console.log(`   概率序: ${D.map(r => nameOf(r.schoolId)).join(' > ')}`)
    }
  }
}
